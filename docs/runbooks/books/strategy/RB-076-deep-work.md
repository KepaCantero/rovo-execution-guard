# [RB-076] Deep Work

> Libro: Cal Newport - Deep Work: Rules for Focused Success in a Distracted World

## Reglas

### ARCH-SOLID-0761
**DEFINICION:** Cada modulo del dominio (scoring engine, inconsistency detector, quality gate rules) debe poder desarrollarse en un bloque de enfoque continuo sin cambiar archivos fuera de su directorio.
**VALOR:** Permite sesiones de deep work sin cambios de contexto entre capas, reduciendo errores de integracion en la logica de validacion de tickets.
**IMPLEMENTACION:** Estructurar cada dominio bajo `src/backend/domain/<module>/` con su propio `index.ts` de exportacion. El scoring engine, por ejemplo, vive en `src/backend/domain/scoring/` y expone solo la interfaz `ScoreResult`. Ningun otro modulo importa sus archivos internos directamente.
**AUDITORIA:** Ralph verifica que no existan imports cruzados entre subdirectorios de `domain/` que salteen los archivos `index.ts`.

### FORGE-OPS-0762
**DEFINICION:** Las funciones Forge que orquestan validaciones (triggers, resolvers) deben ejecutar toda la logica de negocio en menos de 5 segundos, delegando trabajo superficial (notificaciones, logging) a funciones pospuestas o queues.
**VALOR:** Respeta el limite de ejecucion de Forge (25s) y concentra el tiempo de computo en el trabajo profundo: calculo de scores y deteccion de inconsistencias. Las tareas superficiales no bloquean la respuesta al usuario.
**IMPLEMENTACION:** En cada resolver, medir con `performance.now()` el tiempo total. Si el score + deteccion de inconsistencias toma menos de 5s, retornar inmediatamente. El logging estructurado y las actualizaciones de UI se envian via `forge/asApp()` calls posteriores o via `scheduleFunction` si exceden el presupuesto.
**AUDITORIA:** Ralph revisa que ningun resolver contenga llamadas secuenciales a APIs externas que no sean estrictamente necesarias para la decision de bloqueo.

### GIT-CI-0763
**DEFINICION:** Las sesiones de desarrollo deben producir commits atomicos donde cada commit representa una unidad completa de deep work: una feature de dominio, un adapter, o un test suite completo.
**VALOR:** Cada commit es revertible sin romper la aplicacion. Facilita code reviews enfocados y evita diffs de miles de lineas que mezclan trabajo profundo con cambios superficiales.
**IMPLEMENTACION:** Husky pre-commit ejecuta lint + tests unitarios del modulo modificado. Commitlint exige formato `type(scope): description` donde scope coincide con un modulo del dominio. Ejemplo: `feat(scoring): add consistency weight to knowledge-base signals`.
**AUDITORIA:** Ralph verifica que el scope en el mensaje de commit corresponda a un directorio real bajo `src/backend/` o `src/frontend/`.

### TEST-QA-0764
**DEFINICION:** Los tests de cada modulo de dominio deben poder ejecutarse de forma aislada sin levantar dependencias externas (Jira API, GitHub API, Rovo), usando mocks que simulen respuestas de Forge Storage.
**VALOR:** Permite ejecutar tests en menos de 2 segundos por modulo, facilitando el flujo TDD durante sesiones de deep work sin esperas por I/O o red.
**IMPLEMENTACION:** Cada modulo de dominio tiene su propio `__tests__/` con fixtures en `__fixtures__/`. Los adapters externos se mockean con `jest.mock()` a nivel de test. El CI ejecuta primero los tests unitarios por modulo (rapidos) y luego los de integracion (lentos) en paralelo.
**AUDITORIA:** Ralph revisa que los tests unitarios bajo `src/backend/domain/*/` no importen directamente modulos de `integration/` o `orchestration/`.

### ROVO-INTEG-0765
**DEFINICION:** Las llamadas a Rovo para obtener contexto organizacional deben agruparse en una unica funcion `fetchRovoContext()` que cachee resultados por ticket por 5 minutos, evitando llamadas repetidas durante una sesion de validacion.
**VALOR:** Reduce el trabajo superficial (llamadas HTTP redundantes) y concentra el deep work en el analisis del contexto ya obtenido. Mantiene la latencia total de los quality gates por debajo del umbral aceptable.
**IMPLEMENTACION:** Implementar un cache en Forge Storage con clave `rovo:context:{issueKey}` y TTL de 300 segundos. La funcion `fetchRovoContext()` consulta el cache antes de hacer la llamada a Rovo. Invalidar el cache cuando el ticket se transiciona.
**AUDITORIA:** Ralph verifica que no existan multiples llamadas a la API de Rovo para el mismo `issueKey` dentro del mismo flujo de validacion.
