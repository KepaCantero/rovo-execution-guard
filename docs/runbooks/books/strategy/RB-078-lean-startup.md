# [RB-078] The Lean Startup

> Libro: Eric Ries - The Lean Startup: How Today's Entrepreneurs Use Continuous Innovation

## Reglas

### ROVO-INTEG-0781
**DEFINICION:** El MVP del scoring engine debe calcular un score basado exclusivamente en campos nativos de Jira (summary, description, acceptance criteria) antes de integrar contexto de Rovo.
**VALOR:** Permite validar la hipotesis de que un score de calidad es util para los equipos sin depender de la integracion con Rovo. Si el score basico no genera valor, el score con contexto tampoco lo hara.
**IMPLEMENTACION:** Implementar `BasicScoringEngine` que evalua longitud de descripcion, presencia de acceptance criteria, y claridad del summary. Este engine vive en `src/backend/domain/scoring/engines/basic.engine.ts`. La integracion con Rovo se agrega despues como un decorador o estrategia alternativa.
**AUDITORIA:** Ralph verifica que el `BasicScoringEngine` funcione correctamente sin ninguna llamada a la API de Rovo y que sus tests pasen sin mocks de Rovo.

### TEST-QA-0782
**DEFINICION:** Cada feature del Forge app debe tener una metrica de adopcion medible (quantitative) y un mecanismo de feedback cualitativo antes de considerarse completa.
**VALOR:** Sigue el ciclo build-measure-learn: la feature se construye, se mide si los equipos la usan, y se aprende del feedback. Evita construir funcionalidades que nadie usa, como dashboards genericos.
**IMPLEMENTACION:** Cada quality gate debe registrar en Forge Storage un evento con `{gateId, ticketKey, action, timestamp, userId}`. El panel de admin muestra un ranking de gates mas/menos activos. Incluir un boton de feedback directo en la UI del issue panel que almacena comentarios en Forge Storage.
**AUDITORIA:** Ralph verifica que cada quality gate implementado tenga su correspondiente evento de auditoria registrado y que el panel de admin pueda mostrar estadisticas de uso.

### FORGE-OPS-0783
**DEFINICION:** Las features experimentales (como sugerencias de reescritura de tickets con IA) deben estar protegidas por feature flags almacenadas en Forge Storage, con valores por defecto desactivados.
**VALOR:** Permite desplegar codigo experimental sin riesgo y activarlo gradualmente por proyecto. Si la feature no funciona, se desactiva sin deploy. Esto es validated learning en produccion.
**IMPLEMENTACION:** Implementar `FeatureFlagService` en `src/backend/config/flags/` que lee de Forge Storage con formato `{ flagName: { enabled: boolean, projects: string[] } }`. Cada feature experimental verifica la flag antes de ejecutarse. El admin dashboard permite togglear flags por proyecto.
**AUDITORIA:** Ralph revisa que ninguna feature marcada como experimental en el ticket correspondiente se ejecute sin verificar su feature flag.

### ARCH-SOLID-0784
**DEFINICION:** El sistema de inconsistency detection debe implementarse como un pipeline donde cada detector es un modulo independiente que puede agregarse o removerse sin afectar los demas.
**VALOR:** Permite iterar rapidamente sobre los detectores de inconsistencia, agregando los de mayor impacto primero y refinando los menores despues. Cada detector es una hipotesis validable independientemente.
**IMPLEMENTACION:** Definir interfaz `InconsistencyDetector { id: string; detect(context: TicketContext): Inconsistency[]; }`. Los detectores viven en `src/backend/domain/inconsistency/detectors/`. El `InconsistencyPipeline` los ejecuta en paralelo y agrega resultados. Los detectores se registran via un array de configuracion, no por import directa.
**AUDITORIA:** Ralph verifica que agregar o remover un detector del array de configuracion no rompa ningun test existente y que cada detector tenga tests unitarios propios.

### GIT-CI-0785
**DEFINICION:** Los deploys a staging deben ocurrir automaticamente en cada merge a `main`, y los deploys a produccion requieren una metrica de calidad explicita (score de coverage, zero security vulns) como gate manual.
**VALOR:** El ciclo build-measure-learn se acelera con deploys continuos a staging. El gate manual a produccion asegura que solo codigo validado llega a usuarios reales. MVPs se pueden probar en staging sin riesgo.
**IMPLEMENTACION:** GitHub Actions workflow: en push a `main`, ejecutar tests + deploy a Forge staging environment. Para produccion, agregar un job manual `workflow_dispatch` que verifica: coverage >= 85%, Snyk scan limpio, y E2E tests pasando al 100%.
**AUDITORIA:** Ralph verifica que el workflow de CI/CD tenga separados los jobs de staging (automatico) y produccion (manual con gates).
