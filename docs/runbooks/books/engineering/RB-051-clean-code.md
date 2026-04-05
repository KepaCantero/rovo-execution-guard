# [RB-051] Clean Code

> Libro: Robert C. Martin - Clean Code: A Handbook of Agile Software Craftsmanship

## Reglas

### ARCH-SOLID-051
**DEFINICION:** Todo nombre de funcion, variable, tipo o constante en el proyecto debe revelar su intencion sin necesidad de comentarios adicionales.
**VALOR:** En un dominio con entidades como `ConsistencyScore`, `JiraIssueContext` y `GitHubPRValidation`, los nombres ambiguos generan bugs en los resolvers de Forge y en la logica de bloqueo de transiciones.
**IMPLEMENTACION:** Usar nombres como `isTicketReadyForTransition(issue: JiraIssue, score: ConsistencyScore)` en vez de `check(issue, s)`. Variables booleanas con prefijo `is/has/can`. Tipos de dominio expresivos: `QualityGateResult`, `InconsistencySeverity`, `EnforcementAction`.
**AUDITORIA:** Ralph verifica que ninguna funcion o variable tenga nombres de una sola letra, abreviaturas crypticas, o nombres genericos como `data`, `info`, `result` sin calificador de dominio.

### ARCH-SOLID-052
**DEFINICION:** Ninguna funcion en el backend de Forge debe superar las 20 lineas de logica efectiva ni tener mas de 3 niveles de anidamiento.
**VALOR:** Los resolvers y triggers de Forge tienen limites estrictos de ejecucion (25 segundos). Funciones largas ocultan errores en la cadena de validacion Rovo-Jira-GitHub y complican el debug en entornos serverless.
**IMPLEMENTACION:** Extraer la validacion de Quality Gates en funciones puras separadas: `calculateConsistencyScore()`, `detectInconsistencies()`, `enforceBlockingAction()`. Cada trigger debe orquestar llamadas a funciones de un solo proposito.
**AUDITORIA:** Ralph cuenta las lineas efectivas de cada funcion en `/src/backend/` y rechaza cualquier funcion que supere 20 lineas o 3 niveles de indentacion.

### ARCH-SOLID-053
**DEFINICION:** El manejo de errores en toda la app debe usar tipos de error especificos del dominio, nunca `catch` vacios ni lanzamiento de `Error` generico.
**VALOR:** Un error no manejado en la integracion GitHub API puede dejar un PR bloqueado sin explicacion. Los errores deben ser trazables por Sentry con el `executionId` y clasificables para el sistema de rollback.
**IMPLEMENTACION:** Crear jerarquia de errores en `/src/backend/errors/`: `RovoApiError`, `GitHubCheckFailure`, `JiraTransitionBlockedError`, `ConsistencyThresholdError`. Cada error debe incluir `executionId`, `issueKey`, y `severity`.
**AUDITORIA:** Ralph busca bloques `catch` vacios, `throw new Error()` sin tipo especifico, y ausencia de `executionId` en los errores lanzados.

### TEST-QA-051
**DEFINICION:** Queda prohibido el uso de comentarios explicativos en el codigo de produccion; si el codigo necesita comentarios, debe ser refactorizado.
**VALOR:** Los comentarios se pudren y desinforman. En un sistema de enforcement como Rovo Execution Guard, un comentario desactualizado sobre el threshold del Consistency Score (80%) puede causar que un ticket pase un Quality Gate que no deberia.
**IMPLEMENTACION:** Reemplazar comentarios con funciones cuyo nombre explique la intencion. Los unicos comentarios permitidos son: TODOs con Jira ID, explicaciones de decisiones arquitectonicas (WHY, no WHAT), y advertencias sobre limitaciones de Forge API.
**AUDITORIA:** Ralph escanea todos los archivos `.ts` en `/src/` y rechaza aquellos con comentarios de linea que expliquen QUE hace el codigo en vez de POR QUE.
