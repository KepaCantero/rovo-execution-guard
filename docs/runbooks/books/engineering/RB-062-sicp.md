# [RB-062] Structure and Interpretation of Computer Programs

> Libro: Harold Abelson, Gerald Jay Sussman, Julie Sussman - Structure and Interpretation of Computer Programs (SICP)

## Reglas

### ARCH-SOLID-068
**DEFINICION:** Las capas del sistema deben comunicarse exclusivamente a traves de interfaces que oculten los detalles de implementacion, creando barreras de abstraccion estrictas entre dominio, integracion y presentacion.
**VALOR:** Sin barreras de abstraccion, un cambio en el formato de respuesta de la API de Rovo requiere modificar tanto el calculo del score como la UI del Spider Chart, amplificando el impacto de cualquier cambio.
**IMPLEMENTACION:** Cada capa define su propio tipo de dato y proporciona funciones de transformacion: `toDomainEntity(apiResponse)` en la capa de integracion, `toPresentationModel(domainEntity)` en la capa de presentacion. Los tipos nunca se comparten directamente entre capas no adyacentes.
**AUDITORIA:** Ralph verifica que no existan imports de tipos de la capa de integracion (ej: `GitHubAPIResponse`) en la capa de presentacion (ej: componentes React).

### ARCH-SOLID-069
**DEFINICION:** Las operaciones de validacion deben construirse como composicion de funciones puras de orden superior, evitando estado mutable compartido entre las etapas del pipeline de Quality Gate.
**VALOR:** El estado mutable compartido entre `calculateScore()` y `enforceAction()` hace que el orden de ejecucion afecte el resultado, generando comportamiento no determinista en los triggers de Forge.
**IMPLEMENTACION:** Diseñar el pipeline como composicion funcional: `pipe(fetchContext, analyzeInconsistencies, calculateScore, decideEnforcement, executeAction)`. Cada funcion recibe datos inmutables y devuelve nuevos datos sin modificar los originales. El estado de la validacion fluye como un parametro, no como una variable compartida.
**AUDITORIA:** Ralph busca mutaciones directas de objetos compartidos (`.push()`, `.splice()`, asignaciones a propiedades de objetos pasados como parametros) en el pipeline de validacion.

### ROVO-INTEG-053
**DEFINICION:** El sistema debe modelar el tiempo como un concepto de primera clase, con representaciones inmutables para instantes (timestamp de validacion), duraciones (TTL de cache), y periodos (ventana de reintentos).
**VALOR:** Si los timestamps se manejan como numeros sin tipo, es facil comparar milisegundos con segundos o usar el timezone incorrecto, causando que un cache expire antes de tiempo o que un Quality Gate evaluado en horario diferente produzca resultados distintos.
**IMPLEMENTACION:** Crear Value Objects para tiempo: `ValidationTimestamp`, `CacheDuration`, `RetryWindow`. Implementar operaciones seguras: `isExpired(cacheEntry, now)`, `nextRetryDelay(attempt)`. Nunca comparar numeros crudos de timestamps directamente.
**AUDITORIA:** Ralph busca comparaciones directas de timestamps como numeros sin usar los Value Objects de tiempo definidos.
