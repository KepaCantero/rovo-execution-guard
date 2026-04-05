# [RB-081] High Output Management

> Libro: Andrew Grove - High Output Management

## Reglas

### ARCH-SOLID-0811
**DEFINICION:** Cada modulo del Forge app debe tener una interfaz publica documentada que defina sus inputs, outputs y side effects, actuando como un "contracto" similar a los OKRs de Grove: lo que el modulo entrega debe ser medible e inequivoco.
**VALOR:** La gestion de alto output requiere que cada componente del sistema tenga output medible. Si el scoring engine recibe un ticket y produce un `ScoreResult { score: number; breakdown: RuleResult[]; timestamp: string }`, su output es auditable y mejorable.
**IMPLEMENTACION:** Cada modulo de dominio exporta un tipo `*Output` y un tipo `*Input`. El `ScoringEngine` recibe `ScoringInput` y produce `ScoringOutput`. Estas interfaces son el contrato del modulo. Los tests validan contra estas interfaces, no contra detalles de implementacion.
**AUDITORIA:** Ralph verifica que cada directorio bajo `src/backend/domain/` exporte tipos `Input` y `Output` en su `index.ts` y que ningun consumidor acceda a tipos internos.

### FORGE-OPS-0812
**DEFINICION:** Las reuniones de sincronizacion entre modulos (scoring -> enforcement -> observability) se reemplazan por eventos asincronos via Forge Event Bridge, donde cada modulo publica su resultado y los modulos downstream reaccionan.
**VALOR:** Grove enfatiza reuniones eficientes. En el Forge app, las "reuniones" entre modulos son eventos asincronos. El scoring engine publica un evento `ScoreCalculated` y el modulo de enforcement lo consume sin acoplamiento temporal.
**IMPLEMENTACION:** Definir eventos en `src/backend/orchestration/events/` con formato CloudEvents: `{ type: 'score.calculated', source: 'scoring-engine', data: { issueKey, score, breakdown } }`. Usar Forge Storage como event bus simplificado: el publisher escribe en una cola, el subscriber la procesa en el siguiente trigger.
**AUDITORIA:** Ralph revisa que ningun modulo de dominio importe directamente a otro modulo de dominio; la comunicacion debe ser via la capa de orchestration.

### ROVO-INTEG-0813
**DEFINICION:** El output del sistema debe medirse con KPIs claros: tickets bloqueados vs permitidos, false positive rate de inconsistencias, tiempo ahorrado por equipo, y adopcion de quality gates por proyecto.
**VALOR:** Sin metricas de output, no hay gestion de alto rendimiento. El equipo necesita saber si el producto esta reduciendo rework (objetivo del negocio) o solo generando ruido.
**IMPLEMENTACION:** Implementar `MetricsService` en `src/backend/observability/metrics/` que aggregate counters: `tickets.blocked`, `tickets.permitted`, `inconsistencies.detected`, `inconsistencies.false_positive` (via feedback), `enforcement.actions.executed`. Exponer estos datos en el admin dashboard con granularidad por proyecto y por periodo.
**AUDITORIA:** Ralph verifica que cada accion de enforcement registre su metrica correspondiente y que el dashboard pueda mostrar tendencias semanales.

### GIT-CI-0814
**DEFINICION:** Los OKRs del sprint deben traducirse a gates en el CI/CD: si el objetivo es 90% coverage, el CI bloquea merges por debajo de ese umbral; si el objetivo es zero vulns criticas, Snyk falla el pipeline.
**VALOR:** Los OKRs no son declaraciones de intencion sino restricciones operativas. Si el equipo dice que quiere 90% coverage, el CI lo exige en cada PR, no solo en retrospectiva.
**IMPLEMENTACION:** Configurar Jest coverage threshold en `jest.config.js` con `branches: 85, functions: 85, lines: 85, statements: 85`. Configurar Snyk con `fail-on: high`. Ambos son gates obligatorios en el workflow de GitHub Actions. Los thresholds se ajustan al inicio de cada sprint en un archivo de configuracion versionado.
**AUDITORIA:** Ralph verifica que los thresholds de CI coincidan con los OKRs documentados en el sprint actual.

### TEST-QA-0815
**DEFINICION:** Cada test de integracion debe documentar que output del sistema valida, creando una relacion directa entre el test y el KPI de negocio que protege.
**VALOR:** Grove mide output, no actividad. Los tests que no estan vinculados a un output de negocio son ruido. Cada test de integracion debe poder responder: "que metrica de negocio se degrada si este test falla?"
**IMPLEMENTACION:** Cada test de integracion incluye un comentario JSDoc: `@business-metric tickets.blocked.accuracy` o `@business-metric enforcement.latency`. El reporte de tests agrupa resultados por metrica de negocio, permitiendo ver rapidamente que areas del producto estan en riesgo.
**AUDITORIA:** Ralph verifica que cada test de integracion tenga su etiqueta `@business-metric` documentada y que no existan tests sin etiqueta.
