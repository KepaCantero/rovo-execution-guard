# [RB-077] Atomic Habits

> Libro: James Clear - Atomic Habits: An Easy & Proven Way to Build Good Habits

## Reglas

### TEST-QA-0771
**DEFINICION:** Cada nuevo modulo de dominio debe incrementar la cobertura de tests en al menos un test por funcion publica, escrita antes o inmediatamente despues de la implementacion.
**VALOR:** Las mejoras incrementales de 1% diario en cobertura de tests compuestos generan un sistema confiable. Evita la deuda tecnica acumulativa que seria costosa de resolver despues en el scoring engine.
**IMPLEMENTACION:** Al crear una nueva funcion en el dominio (ej: `calculateConsistencyScore()`), agregar inmediatamente un test en `__tests__/` que valide al menos el happy path y un edge case. El Husky pre-commit hook bloquea commits que reduzcan la cobertura total del modulo.
**AUDITORIA:** Ralph revisa que cada funcion exportada del dominio tenga al menos un test asociado y que la cobertura del modulo no haya disminuido respecto al commit anterior.

### GIT-CI-0772
**DEFINICION:** Cada commit debe representar la mejora mas pequena posible que deja el codigo en estado funcional y con tests pasando.
**VALOR:** Los habitos atomicos de commits reducen el riesgo de cada deploy y facilitan rollback granular. Un sistema de mejora continua evita los grandes bangs de refactorizacion que paralizan el desarrollo del Forge app.
**IMPLEMENTACION:** Configurar Husky para que `pre-commit` ejecute `jest --bail --findRelatedTests` solo sobre los archivos modificados. El commit se bloquea si algun test relacionado falla. Commitlint limita el cuerpo del mensaje a 72 caracteres por linea.
**AUDITORIA:** Ralph verifica que los commits en los ultimos 7 dias no excedan 300 lineas de diff (excluyendo archivos generados) y que todos pasen CI.

### ARCH-SOLID-0773
**DEFINICION:** El sistema de scoring debe estar disenado como un pipeline de reglas independientes donde cada regla es un archivo unico que implementa una interfaz `ScoringRule` comun.
**VALOR:** Agregar una nueva regla de scoring es tan simple como crear un archivo. El sistema de habitos atomicos se aplica: cada regla nueva es una mejora incremental de 1% en la precision del score, sin refactorizar las existentes.
**IMPLEMENTACION:** Definir interfaz `ScoringRule { id: string; weight: number; evaluate(ticket: TicketContext): RuleResult; }`. Cada regla vive en `src/backend/domain/scoring/rules/`. El `ScoringEngine` carga dinamicamente todas las reglas y calcula el score ponderado. Ejemplo: `hasAcceptanceCriteria.rule.ts`, `hasDescriptionMinimum.rule.ts`.
**AUDITORIA:** Ralph verifica que cada archivo en `rules/` implemente la interfaz `ScoringRule` y que no contenga logica de scoring duplicada entre reglas.

### FORGE-OPS-0774
**DEFINICION:** Cada iteracion del sistema debe dejar al menos una metrica de observabilidad nueva o mejorada: un nuevo log estructurado, un counter, o un timer.
**VALOR:** Las mejoras atomicas en observabilidad crean un sistema de monitoreo robusto gradualmente. Cada sprint deja el Forge app mas transparente sin requerir un esfuerzo dedicado de instrumentacion.
**IMPLEMENTACION:** En cada PR, verificar que se agrega al menos una llamada a `forge/log` o un metric point en Datadog. Los timers deben medir latencia de llamadas a APIs externas (Jira, GitHub, Rovo). Los counters deben trackear eventos de negocio (tickets bloqueados, inconsistencias detectadas).
**AUDITORIA:** Ralph revisa que cada PR mergeado en los ultimos 14 dias haya agregado al menos una linea de observabilidad nueva (log, metric, o span).

### ROVO-INTEG-0775
**DEFINICION:** Cada llamada a Rovo debe envolver la respuesta en un type guard que valide la estructura antes de procesarla, agregando una capa de proteccion incremental por cada nuevo campo utilizado.
**VALOR:** La resiliencia del sistema mejora atomicamente con cada type guard agregado. Un campo inesperado de Rovo no causa un crash sino un fallback graceful a validacion sin contexto.
**IMPLEMENTACION:** Usar Zod schemas para validar respuestas de Rovo. Cada schema vive junto al adapter: `src/backend/integration/rovo/schemas/`. Cuando se usa un campo nuevo de Rovo, se agrega al schema. Si la validacion falla, el sistema loggea el error y procede con la validacion basica (sin contexto Rovo).
**AUDITORIA:** Ralph verifica que cada campo de Rovo utilizado en el codigo tenga su correspondiente validacion en el schema de Zod.
