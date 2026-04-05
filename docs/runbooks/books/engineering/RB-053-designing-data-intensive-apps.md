# [RB-053] Designing Data-Intensive Applications

> Libro: Martin Kleppmann - Designing Data-Intensive Applications: The Big Ideas Behind Reliable, Scalable, and Maintainable Systems

## Reglas

### FORGE-OPS-053
**DEFINICION:** Toda llamada a la API de Rovo, Jira, Confluence o GitHub debe manejar fallos de forma que el sistema nunca quede en un estado inconsistente entre las plataformas.
**VALOR:** Si la llamada a Rovo falla a mitad de una validacion de Quality Gate, el ticket de Jira y el PR de GitHub pueden quedar en estados contradictorios (ticket aprobado pero PR bloqueado, o viceversa).
**IMPLEMENTACION:** Implementar idempotencia en los triggers de Forge usando `executionId` como clave de deduplicacion. Persistir el estado de cada validacion en Forge Storage como `ValidationRecord` con campos `status`, `issueKey`, `prId`, `score`, y `timestamp`. Antes de ejecutar un enforcement, verificar el ultimo estado persistido.
**AUDITORIA:** Ralph verifica que cada trigger que modifica estado en Jira o GitHub tenga un punto de control persistido en Forge Storage y que las re-ejecuciones por timeout de Forge no produzcan efectos duplicados.

### ROVO-INTEG-051
**DEFINICION:** El resultado de una consulta a Rovo debe ser consistente durante la duracion de una transaccion de validacion completa, incluso si el contexto organizacional cambia entre la consulta inicial y el enforcement final.
**VALOR:** Si Rovo actualiza su indice entre la evaluacion del Consistency Score y el bloqueo del PR en GitHub, el enforcement puede basarse en datos obsoletos o prematuramente actualizados, generando falsos positivos o negativos.
**IMPLEMENTACION:** Implementar un cache con TTL corto (60 segundos) en Forge Storage para los resultados de Rovo asociados a un `issueKey`. Usar el `executionId` como version del contexto. Todas las operaciones del mismo flujo de validacion deben leer del mismo snapshot cacheado.
**AUDITORIA:** Ralph verifica que no existan dos llamadas independientes a Rovo dentro del mismo flujo de validacion sin compartir el resultado cacheado.

### FORGE-OPS-054
**DEFINICION:** El sistema debe degradarse gracefulmente cuando Rovo o GitHub esten unavailable, sin bloquear permanentemente los flujos de trabajo de los usuarios.
**VALOR:** Si Rovo esta caido y todos los Quality Gates fallan, los equipos quedan imposibilitados de trabajar. El sistema debe tener un modo degradado que permita operar con validacion reducida.
**IMPLEMENTACION:** Implementar un toggle configurable en `/src/backend/constants/` para modo `DEGRADED` que: (1) permite transiciones de Jira con un warning en vez de bloqueo, (2) marca los checks de GitHub como "neutral" en vez de "failure", (3) registra el evento en el log de auditoria. El modo degradado se activa automaticamente tras 3 fallos consecutivos de Rovo en un periodo de 5 minutos.
**AUDITORIA:** Ralph verifica la existencia del circuit breaker para Rovo, el modo degradado configurable, y que los tests de integracion cubran el escenario de fallo de Rovo.
