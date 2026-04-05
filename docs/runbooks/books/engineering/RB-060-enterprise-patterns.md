# [RB-060] Patterns of Enterprise Application Architecture

> Libro: Martin Fowler - Patterns of Enterprise Application Architecture

## Reglas

### ARCH-SOLID-065
**DEFINICION:** Todo acceso a datos de Jira, GitHub, y Forge Storage debe realizarse a traves de una capa Repository que encapsule las llamadas a la API y devuelva entidades de dominio.
**VALOR:** Sin el patron Repository, la logica de validacion se mezcla con detalles de paginacion de la API de Jira, manejo de rate limits de GitHub, y transformacion de respuestas HTTP, haciendo el codigo ilegible e intestable.
**IMPLEMENTACION:** Crear repositorios en `/src/backend/services/`: `JiraIssueRepository` con metodos como `getIssueWithContext(key: IssueKey)`, `updateTransition(key: IssueKey, action: EnforcementAction)`; `GitHubPRRepository` con metodos como `updateCheckStatus(prId: number, result: QualityGateResult)`, `addReviewComment(prId: number, report: InconsistencyReport)`. Los repositorios manejan paginacion, rate limiting, y mapeo de datos.
**AUDITORIA:** Ralph verifica que ningun resolver o servicio de dominio contenga llamadas directas a APIs externas sin pasar por un repositorio.

### ARCH-SOLID-066
**DEFINICION:** La orquestacion de las operaciones de validacion (consultar Rovo, calcular score, bloquear transicion, actualizar PR) debe centralizarse en una capa Service que coordine los repositorios sin contener logica de dominio.
**VALOR:** Si un resolver de Forge orquesta directamente llamadas a Rovo, Jira y GitHub, cualquier cambio en el orden de las operaciones o en los datos requeridos implica modificar multiples resolvers, generando inconsistencias.
**IMPLEMENTACION:** Crear `ValidationService` en `/src/backend/services/scoring/` que orqueste: `contextRepo.getOrganizationalContext()` -> `scorer.calculateScore()` -> `enforcement.decideAction()` -> `jiraRepo.applyAction()` y/o `githubRepo.updateCheck()`. Los resolvers solo llaman a `ValidationService.validateIssue()`.
**AUDITORIA:** Ralph verifica que los resolvers en `/src/backend/resolvers/` no contengan mas de 3 lineas de logica (una llamada al servicio y manejo de respuesta).

### FORGE-OPS-057
**DEFINICION:** Las operaciones que modifican estado en multiples sistemas (Jira + GitHub + Forge Storage) deben ejecutarse como una unidad logica de trabajo con compensacion en caso de fallo parcial.
**VALOR:** Si el sistema bloquea exitosamente la transicion en Jira pero falla al actualizar el status check en GitHub, los sistemas quedan en estado inconsistente: el ticket esta bloqueado pero el PR aparece como aprobado.
**IMPLEMENTACION:** Implementar un patron de compensacion: (1) registrar la intencion de la operacion en Forge Storage, (2) ejecutar la accion en Jira, (3) ejecutar la accion en GitHub, (4) marcar como completada. Si el paso 3 falla, ejecutar una accion compensatoria en Jira (revertir el bloqueo) y registrar el fallo en el log de auditoria con el `executionId`.
**AUDITORIA:** Ralph verifica que las operaciones multi-sistema tengan compensacion definida y que los tests de integracion cubran el escenario de fallo parcial.
