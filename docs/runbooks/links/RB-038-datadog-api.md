# [RB-038] Datadog API Docs - Metrics, Dashboards, Alerts

> Fuente: Datadog API Docs - Metrics, dashboards, alerts

## Reglas

### TEST-QA-038-01
**DEFINICION:** Toda metrica custom debe seguir la convencion de nombrado `execution_guard.<namespace>.<metric_name>` con tags obligatorios: `environment`, `adapter`, `tenant_cloud_id`.
**VALOR:** La nomenclatura consistente y los tags obligatorios permiten segmentar y correlacionar metricas sin ambiguedad entre entornos y tenants.
**IMPLEMENTACION:** Usar el patron `const metricPrefix = 'execution_guard'; dogstatsd.gauge(`${metricPrefix}.scoring.duration_ms`, duration, [...baseTags, ...extraTags])` donde `baseTags = [`env:${process.env.NODE_ENV}`, `adapter:${adapterName}`, `tenant:${tenantCloudId}`]`. Nunca enviar metricas sin el tag de environment.
**AUDITORIA:** Ralph escanea todas las llamadas a Datadog y verifica que el prefijo `execution_guard.` esta presente y que las 3 tags obligatorias se incluyen en cada envio.

### TEST-QA-038-02
**DEFINICION:** Los dashboards deben definirse como codigo en `config/datadog-dashboards/` usando la API de Datadog y desplegarse automaticamente en el pipeline CI/CD.
**VALOR:** Elimina la configuracion manual propensa a drift y permite revision de cambios via pull requests, igual que cualquier otro asset del sistema.
**IMPLEMENTACION:** Crear `config/datadog-dashboards/scoring-overview.json` con la definicion del dashboard via Datadog API spec. En GitHub Actions, anadir step `datadog-ci dashboards publish --config config/datadog-dashboards/` que sincroniza los dashboards con la cuenta de Datadog.
**AUDITORIA:** Ralph verifica que todos los dashboards de Datadog referenciados en runbooks existen como archivos JSON en `config/datadog-dashboards/` y que el pipeline de CI/CD contiene el paso de sincronizacion.

### TEST-QA-038-03
**DEFINICION:** Las metricas de histograma deben usarse para distribuciones (latencia, tamano de payload) y las metricas de gauge para valores puntuales (conexiones activas, items en cola); nunca usar counters para lo que es un histograma.
**VALOR:** Los histogramas calculan percentiles (P50, P95, P99) que son esenciales para SLOs de latencia; usar tipos incorrectos produce alertas falsas o silenciadas.
**IMPLEMENTACION:** Para latencia: `dogstatsd.histogram('execution_guard.adapter.request_duration_ms', duration, tags)`. Para estado puntual: `dogstatsd.gauge('execution_guard.queue.depth', queueLength, tags)`. Para conteo de eventos: `dogstatsd.increment('execution_guard.scoring.total', 1, tags)`.
**AUDITORIA:** Ralph verifica que las metricas de latencia usan `histogram` y no `gauge` o `counter`, y que cada tipo de metrica se usa segun su semantica correcta.

### TEST-QA-038-04
**DEFINICION:** Toda alerta debe incluir un runbook vinculado en el campo `message` con la URL al archivo correspondiente en `docs/runbooks/`, y las alertas sin runbook asociado se consideran tecnicamente endeudas.
**VALOR:** Las alertas con runbook reducen el tiempo medio de resolucion (MTTR) porque el respondedor tiene instrucciones inmediatas en vez de investigar desde cero.
**IMPLEMENTACION:** En cada definicion de monitor via API: `message: '@slack-team Alert: scoring latency P99 exceeded threshold. Runbook: https://github.com/org/revo-execution-guard/blob/main/docs/runbooks/RB-XXX-scoring-latency.md'`. Anadir check en CI que valide que toda alerta definida en `config/datadog-alerts/` contiene un link a runbook.
**AUDITORIA:** Ralph revisa que cada alerta en `config/datadog-alerts/` contiene un campo `message` con URL a un archivo existente en `docs/runbooks/`.

### TEST-QA-038-05
**DEFINICION:** El client de Datadog debe inicializarse con `bufferSize: 8192` y `flushInterval: 10000` y apagarse gracefulmente en el lifecycle de Forge para evitar perdida de metricas.
**VALOR:** El buffer adecuado y el flush periodico previenen perdida de datos por limites de Forge Runtime sin sobrecargar el agente.
**IMPLEMENTACION:** Configurar `const dogstatsd = new StatsD({ host: process.env.DD_AGENT_HOST, port: 8125, bufferSize: 8192, flushInterval: 10000 })`. Registrar `process.on('beforeExit', () => dogstatsd.close())` o el equivalente en el lifecycle de Forge para vaciar el buffer.
**AUDITORIA:** Ralph verifica que la inicializacion de Datadog usa los parametros de buffer y flush especificados, y que existe un handler de shutdown que cierra el cliente.
