# [RB-064] TDD: By Example

> Libro: Kent Beck - Test Driven Development: By Example

## Reglas

### TEST-QA-056
**DEFINICION:** Toda nueva funcionalidad en la capa de dominio de Rovo Execution Guard debe implementarse siguiendo el ciclo estricto: escribir un test que falle (RED), escribir el minimo codigo para que pase (GREEN), y luego mejorar el diseno (REFACTOR).
**VALOR:** Si se implementa primero la logica de deteccion de inconsistencias y se escriben los tests despues, es facil escribir tests que pasen sobre un diseno pobre en vez de tests que guien hacia un diseno correcto.
**IMPLEMENTACION:** Para cada feature nueva: (1) crear el test en `/tests/unit/services/scoring/` que defina el comportamiento esperado (por ejemplo: "un ticket sin criterios de aceptacion debe tener un score de consistencia menor a 50"), (2) verificar que el test falla, (3) implementar el minimo codigo en `/src/backend/services/scoring/` para que pase, (4) refactorizar manteniendo el test verde.
**AUDITORIA:** Ralph analiza el orden de los commits en cada PR: el primer commit del feature debe contener un test que falle, no codigo de implementacion.

### TEST-QA-057
**DEFINICION:** Los tests unitarios deben cubrir los casos limite del sistema de Quality Gates: score exactamente en el threshold (80%), payloads vacios, respuestas de Rovo con campos faltantes, y timeouts de API.
**VALOR:** Un score de 79.99 vs 80.00 determina si un ticket se bloquea o se permite. Si este borde no esta testeado, un error de redondeo puede aprobar tickets que deberian estar bloqueados.
**IMPLEMENTACION:** Para cada funcion de scoring, escribir tests para: valor exacto en threshold, un punto por encima y por debajo del threshold, entrada nula o vacia, respuesta de API malformada, y timeout. Usar `describe.each` con los casos parametrizados: `[79, false], [80, true], [81, true], [0, false], [100, true]`.
**AUDITORIA:** Ralph verifica que los tests unitarios de scoring cubran los limites exactos de cada threshold definido en la configuracion.

### TEST-QA-058
**DEFINICION:** Los tests de integracion deben simular las respuestas reales de las APIs de Jira, GitHub y Rovo usando contratos grabados, no datos inventados.
**VALOR:** Si los mocks de la API de GitHub no reflejan la estructura real de la respuesta (por ejemplo, omiten campos de paginacion o cambian los nombres de propiedades), los tests pasan pero la integracion real falla en produccion.
**IMPLEMENTACION:** Crear fixtures en `/tests/fixtures/` basados en respuestas reales de las APIs: `jira-issue-response.json`, `github-pr-response.json`, `rovo-context-response.json`. Los mocks de integracion usan estos fixtures. Actualizar los fixtures cuando se detecten cambios en las APIs reales.
**AUDITORIA:** Ralph verifica que los fixtures de test reflejen la estructura documentada de las APIs y que no contengan datos inventados que no correspondan a respuestas reales.
