# [RB-036] Sentry Documentation - Error Capture, Breadcrumbs, Structured Logging

> Fuente: Sentry Documentation - Error capture, breadcrumbs, structured logging

## Reglas

### TEST-QA-036-01
**DEFINICION:** Toda excepcion no capturada y rechazo de promesa no manejado debe enviarse a Sentry mediante `Sentry.captureException()` antes de cualquier fallback generico.
**VALOR:** Evita que errores criticos se pierdan en logs silenciosos y garantiza visibilidad completa de fallos en produccion.
**IMPLEMENTACION:** Configurar `Sentry.init({ dsn, environment, release, tracesSampleRate: 0.1 })` en el punto de entrada de la app. Envolver funciones Forge con try/catch y llamar `Sentry.captureException(err)` en el catch. Establecer `integrations: [httpClientIntegration(), captureConsoleIntegration({ levels: ['error'] })]`.
**AUDITORIA:** Ralph verifica que todo archivo de handler contenga al menos un `Sentry.captureException` en su ruta de error y que `Sentry.init` exista en el bootstrap de la aplicacion.

### TEST-QA-036-02
**DEFINICION:** Cada flujo de usuario critico debe registrar breadcrumbs con `Sentry.addBreadcrumb()` en cada paso significativo (llamada API, transformacion de datos, decision de negocio).
**VALOR:** Los breadcrumbs reconstruyen la trayectoria exacta que precedio al error, reduciendo el tiempo de diagnostico de incidentes en un 60% o mas.
**IMPLEMENTACION:** Crear un wrapper `logBreadcrumb(category: string, message: string, data?: Record<string, unknown>)` que invoque `Sentry.addBreadcrumb({ level: 'info', category, message, data, timestamp: Date.now() / 1000 })`. Usar categorias estandar: `api.call`, `data.transform`, `business.decision`, `forge.storage`.
**AUDITORIA:** Ralph busca llamadas a `Sentry.addBreadcrumb` en los archivos de adaptador e integracion y verifica que exista al menos 1 breadcrumb por cada llamada a API externa.

### TEST-QA-036-03
**DEFINICION:** Los eventos de Sentry deben incluir contexto estructurado con `Sentry.setContext()` que contenga: `executionId`, `jiraIssueKey` o `githubPrId`, `tenantId`, y `scoringResult` cuando aplique.
**VALOR:** El contexto enriquecido permite filtrar y agrupar errores por tenant, issue o ejecucion sin necesidad de reproducir el incidente.
**IMPLEMENTACION:** Al inicio de cada handler, invocar `Sentry.setContext('execution', { executionId, resourceKey, tenantCloudId, timestamp: new Date().toISOString() })`. Anadir `Sentry.setTag('adapter', adapterName)` para segmentar por componente.
**AUDITORIA:** Ralph verifica que `Sentry.setContext('execution', ...)` este presente en todos los archivos de orchestration y que contenga al menos `executionId` y `resourceKey`.

### TEST-QA-036-04
**DEFINICION:** El `tracesSampleRate` en produccion debe estar entre 0.05 y 0.2; en staging debe ser 1.0 para capturar el 100% de las trazas.
**VALOR:** Mantiene el coste de Sentry controlado en produccion mientras se preserva la capacidad de detectar regresiones de rendimiento y errores intermitentes.
**IMPLEMENTACION:** Configurar `tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0`. Para endpoints criticos (scoring, enforcement), usar `Sentry.startSpan({ op: 'scoring', name: 'executeQualityGate' })` con muestreo individual.
**AUDITORIA:** Ralph revisa que el valor de `tracesSampleRate` en produccion no exceda 0.2 y que exista muestreo diferenciado por ambiente.

### TEST-QA-036-05
**DEFINICION:** Toda regla de filtro de errores en Sentry debe estar versionada en el repositorio dentro de `config/sentry-filters.ts` y desplegada via Sentry API en el pipeline CI/CD.
**VALOR:** Evita la configuracion drift entre entornos y asegura que las reglas de filtrado de ruido se auditen como codigo.
**IMPLEMENTACION:** Definir `inboundFilters: [{ name: 'ignore-health-checks', conditions: [...] }]` en el archivo de config. En el workflow de GitHub Actions, usar `sentry-cli releases set-commits --auto` tras cada deploy.
**AUDITORIA:** Ralph verifica que `config/sentry-filters.ts` existe, esta sincronizado con el entorno de Sentry, y que el pipeline CI/CD contiene el paso de despliegue de reglas.
