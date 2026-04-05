# [RB-056] Code Complete

> Libro: Steve McConnell - Code Complete: A Practical Handbook of Software Construction

## Reglas

### ARCH-SOLID-060
**DEFINICION:** Las variables en el dominio de Rovo Execution Guard deben usar nomenclatura basada en el vocabulario del negocio: `issueKey`, `consistencyScore`, `enforcementAction`, `inconsistencySeverity`, nunca `x`, `temp`, `val`, `obj`.
**VALOR:** La claridad en los nombres reduce el tiempo de depuracion cuando un ticket de Jira es bloqueado incorrectamente y el equipo necesita rastrear el problema desde el webhook de GitHub hasta la consulta de Rovo.
**IMPLEMENTACION:** Definir y documentar el vocabulario de dominio en `/src/backend/types/`. Todas las variables deben usar terminos del glosario. Los enumerados deben ser autoexplicativos: `EnforcementAction.BLOCK_TRANSITION`, `EnforcementAction.ADD_WARNING`, `InconsistencySeverity.CRITICAL`, `InconsistencySeverity.WARNING`.
**AUDITORIA:** Ralph busca variables de una sola letra, prefijos genericos (`tmp`, `obj`, `data` sin calificador), y nombres que no correspondan al vocabulario de dominio documentado.

### SEC-PRIV-051
**DEFINICION:** Toda entrada externa (payload de webhook de GitHub, respuesta de Rovo, datos de Jira API) debe ser validada y saneada antes de ser procesada por la capa de dominio.
**VALOR:** Un payload malicioso o corrupto de un webhook de GitHub puede inyectar datos que causen que el sistema de enforcement tome decisiones incorrectas, como aprobar un PR que deberia estar bloqueado.
**IMPLEMENTACION:** Crear schemas de validacion con Zod o tipos estrictos en `/src/backend/utils/validation.ts`. Cada resolver debe validar el payload de entrada antes de pasarlo a la capa de dominio. Ejemplo: `validateGitHubWebhookPayload(payload): VerifiedWebhookPayload`. Las respuestas de Rovo deben validarse contra una interfaz `RovoContextResponse` antes de consumirse.
**AUDITORIA:** Ralph verifica que cada resolver y trigger en `/src/backend/resolvers/` contenga una llamada a validacion de entrada antes de cualquier logica de negocio.

### SEC-PRIV-052
**DEFINICION:** Ningun assertion interno debe ser omitido o deshabilitado. Las precondiciones y postcondiciones de las funciones criticas de Quality Gate deben ser verificadas en runtime.
**VALOR:** Si se asume que `consistencyScore` siempre esta entre 0 y 100 sin validarlo, un bug en el calculo podria generar scores negativos o mayores a 100, rompiendo la logica de comparacion contra el threshold del 80%.
**IMPLEMENTACION:** Usar assertiones en funciones criticas: `assert(score >= 0 && score <= 100, 'ConsistencyScore out of range')`, `assert(issueKey.match(/^[A-Z]+-\d+$/), 'Invalid issue key format')`. Estas assertiones deben estar presentes en `calculateConsistencyScore()`, `enforceQualityGate()`, y `updatePRStatus()`.
**AUDITORIA:** Ralph verifica la presencia de assertiones en todas las funciones que calculan scores o ejecutan acciones de enforcement.
