# [RB-080] Zero to One

> Libro: Peter Thiel - Zero to One: Notes on Startups, or How to Build the Future

## Reglas

### ROVO-INTEG-0801
**DEFINICION:** Rovo Execution Guard debe ofrecer una capacidad que no existe en ningun otro producto de Atlassian Marketplace: validacion cruzada automatica entre tickets Jira, documentacion Confluence y PRs GitHub con enforcement activo (bloqueo, no sugerencia).
**VALOR:** La diferenciacion no es "mejor dashboard" sino "enforcement activo". Si el producto solo sugiere, es un commodity. Si bloquea tickets invalidos y PRs no alineados, es una categoria nueva (zero to one).
**IMPLEMENTACION:** El core del producto es el motor de enforcement en `src/backend/orchestration/enforcement/`. Cada accion de enforcement (bloquear transicion, fallar status check, comentar en PR) debe ser auditable e irreversible hasta que el problema se resuelva. Las sugerencias son secundarias al bloqueo.
**AUDITORIA:** Ralph verifica que cada quality gate implementado tenga al menos una accion de enforcement activo (bloqueo) y no solo notificaciones pasivas.

### ARCH-SOLID-0802
**DEFINICION:** El scoring engine debe usar un algoritmo propietario de weighting que combine senales de multiples fuentes (Jira fields, Rovo context, PR diffs) en un score unificado que no sea replicable por reglas simples de Jira Automation.
**VALOR:** Si el score es solo "verificar si tiene description", cualquier automatizacion de Jira lo replica. El valor esta en la combinacion ponderada de senales cruzadas que solo Rovo Execution Guard puede calcular.
**IMPLEMENTACION:** Implementar `CompositeScoringStrategy` en `src/backend/domain/scoring/strategies/` que reciba multiples `Signal` objects y los combine con pesos configurables por proyecto. Las senales incluyen: `FieldCompletenessSignal`, `RovoConsistencySignal`, `CrossReferenceSignal`, `HistoricalPatternSignal`. Los pesos se almacenan en Forge Storage por proyecto.
**AUDITORIA:** Ralph verifica que el score producido por el `CompositeScoringStrategy` no sea equivalente a una simple suma booleana de campos presentes/ausentes.

### FORGE-OPS-0803
**DEFINICION:** El producto debe capturar un nicho inicial (equipos de desarrollo usando Jira + GitHub) antes de expandirse a otros casos de uso, y la arquitectura debe reflejar esta verticalizacion.
**VALOR:** Seguir la estrategia de monopolio de Thiel: dominar un nicho antes de expandirse. El Forge app esta optimizado para el workflow Jira-to-GitHub, no para ser generico.
**IMPLEMENTACION:** El manifest.yml de Forge define scopes especificos para Jira y GitHub. Los adaptadores estan disenados para el flujo ticket-PR, no para workflows genericos. La configuracion por proyecto tiene defaults optimizados para equipos de software. Expandir a otros workflows (ej: Confluence-only) requiere un nuevo strategy, no modificar el existente.
**AUDITORIA:** Ralph verifica que los defaults de configuracion (`src/backend/config/defaults.ts`) esten optimizados para el caso de uso principal (Jira + GitHub para equipos de desarrollo).

### SEC-PRIV-0804
**DEFINICION:** Los datos de contexto organizacional obtenidos via Rovo nunca deben almacenarse fuera de Forge Storage ni exponerse en logs. El diferenciador del producto (el contexto) es tambien el activo mas sensible.
**VALOR:** Si los datos de contexto se filtran, se pierde la confianza del cliente y la ventaja competitiva. La seguridad no es un feature, es un requisito existencial para un producto que maneja conocimiento organizacional completo.
**IMPLEMENTACION:** Toda lectura de Rovo pasa por un `SecureContextService` que enmascara datos sensibles en logs (reemplazar contenido con `[REDACTED: tipo]`). Forge Storage usa encryption at rest. Los datos en cache tienen TTL de 5 minutos. Nunca loggear el contenido completo de un documento de Confluence o la descripcion extendida de un ticket.
**AUDITORIA:** Ralph revisa que los logs estructurados no contengan datos de contexto de Rovo sin enmascarar y que el cache en Forge Storage tenga TTL configurado.

### TEST-QA-0805
**DEFINICION:** Las pruebas de integracion deben validar el flujo completo end-to-end: trigger de Jira -> scoring -> deteccion de inconsistencias -> enforcement en GitHub, usando datos de prueba que simulen el mundo real de un equipo de software.
**VALOR:** Las pruebas unitarias validan componentes aislados, pero el valor unico del producto esta en la orquestacion completa. Si el flujo end-to-end falla, el diferenciador desaparece.
**IMPLEMENTACION:** Crear `tests/integration/flows/` con escenarios completos: `ticket-validation-blocks-pr.flow.test.ts` simula un ticket con inconsistencias que bloquea el PR asociado. Usar Nock para mockear Jira/GitHub/Rovo APIs con respuestas realistas. Cada flow test valida el resultado final (bloqueo exitoso o permitido con score).
**AUDITORIA:** Ralph verifica que exista al menos un test de flujo end-to-end por cada quality gate definido en `docs/architecture/quality-gates.md`.
