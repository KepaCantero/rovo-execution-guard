# [RB-037] Google SRE Book - SLOs, Error Budgets, Incident Response

> Fuente: Google SRE Book - SLOs, error budgets, incident response

## Reglas

### TEST-QA-037-01
**DEFINICION:** El sistema debe definir un SLO de disponibilidad del 99.5% para las operaciones de scoring y un SLO de latencia P99 inferior a 3000ms para respuestas de adaptadores externos.
**VALOR:** Los SLOs cuantifican la fiabilidad esperada y permiten tomar decisiones objetivas sobre cuando priorizar fiabilidad frente a velocidad de entrega.
**IMPLEMENTACION:** Definir `const SLO = { availability: { target: 0.995, window: '30d' }, latency: { targetMs: 3000, percentile: 99, window: '30d' } }` en `config/slo-config.ts`. Instrumentar con metricas `execution_guard_slo_availability` y `execution_guard_slo_latency_p99` exportadas a Datadog.
**AUDITORIA:** Ralph verifica que `config/slo-config.ts` existe con los umbrales definidos y que las metricas de SLO se emiten en cada operacion de scoring.

### TEST-QA-037-02
**DEFINICION:** El error budget se consume proporcionalmente a los fallos; cuando se agota al 100%, todo deploy a produccion debe bloquearse automaticamente hasta que el budget se renueve.
**VALOR:** Convierte la fiabilidad en una decision cuantitativa y protege a los usuarios de degradacion acumulada por deploys sucesivos.
**IMPLEMENTACION:** Implementar un middleware `errorBudgetGuard` que consulte la metrica acumulada de errores en la ventana de 30 dias. Si `1 - (successfulRequests / totalRequests) > (1 - SLO.target)`, retornar estado `BUDGET_EXHAUSTED` y el pipeline CI/CD falla el job de deploy.
**AUDITORIA:** Ralph verifica que existe un check de error budget en el workflow de produccion y que el calculo usa la ventana de 30 dias rodantes.

### TEST-QA-037-03
**DEFINICION:** Toda incidencia que supere 15 minutos de duracion o afecte a mas de 1 tenant debe generar un postmortem sin culpabilidad documentado en `docs/postmortems/` dentro de las 72 horas siguientes.
**VALOR:** Los postmortems convierten fallos en conocimiento organizacional y evitan que incidentes repetidos consumean error budget.
**IMPLEMENTACION:** Crear template en `docs/postmortems/template.md` con secciones: Titulo, Timeline, Impacto, Causa Raiz, Acciones Correctivas (con owner y fecha). Automatizar la creacion de issue en Jira cuando un incidente Sentry supere 15 min de duracion via webhook.
**AUDITORIA:** Ralph verifica que por cada alerta de Sentry resuelta con duracion > 15 min, existe un archivo postmortem correspondiente dentro de las 72 horas.

### TEST-QA-037-04
**DEFINICION:** Las alertas deben clasificarse en 3 niveles: P1 (pagina inmediata, SLO violado), P2 (ticket automatico, tendencia degradante), P3 (dashboard only, informativo).
**VALOR:** Reduce la fatiga de alertas y asegura que solo los eventos que requieren accion inmediata interrumpan al equipo.
**IMPLEMENTACION:** Configurar en Datadog: `P1: slo_availability < 99.5% OR latency_p99 > 5000ms` con notificacion a PagerDuty; `P2: error_rate increase > 50% over 1h` con ticket Jira automatico; `P3: latency_p50 > 1000ms` solo en dashboard. Documentar en `config/alerting-policy.ts`.
**AUDITORIA:** Ralph revisa que `config/alerting-policy.ts` define exactamente 3 niveles, que P1 notifica a PagerDuty o equivalente, y que no existen alertas sin clasificacion.

### TEST-QA-037-05
**DEFINICION:** Cada servicio debe exponer un endpoint `/health` que verifique dependencias criticas (Forge Storage, API Jira, API GitHub) y retorne estado `degraded` si alguna dependencia no critica falla, o `unhealthy` si una critica falla.
**VALOR:** Permite a los orquestadores de incidentes detectar degradacion parcial antes de que viole el SLO y activar circuit breakers proactivos.
**IMPLEMENTACION:** Implementar `GET /health` que ejecute checks en paralelo: `forgeStorage.ping()`, `jiraAdapter.healthCheck()`, `githubAdapter.healthCheck()`. Retornar `{ status: 'healthy' | 'degraded' | 'unhealthy', checks: { storage: 'ok', jira: 'ok', github: 'degraded' }, timestamp: ISO }` con HTTP 200 para healthy/degraded, 503 para unhealthy.
**AUDITORIA:** Ralph verifica que el endpoint `/health` existe, que revisa las 3 dependencias criticas, y que retorna 503 cuando una dependencia critica falla.
