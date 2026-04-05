# [RB-086] Essentialism

> Libro: Greg McKeown - Essentialism: The Disciplined Pursuit of Less

## Reglas

### ARCH-SOLID-0861
**DEFINICION:** El dominio del Forge app contiene exactamente tres capacidades esenciales: scoring, deteccion de inconsistencias y enforcement. Cualquier logica que no contribuya directamente a una de estas tres no pertenece al dominio.
**VALOR:** "Menos pero mejor" aplicado a la arquitectura. Un scoring engine que hace 3 cosas bien es superior a uno que hace 10 cosas mediocremente. Cada capacidad extra genera complejidad y puntos de fallo innecesarios.
**IMPLEMENTACION:** Los unicos directorios bajo `src/backend/domain/` son `scoring/`, `inconsistency/`, y `enforcement/`. Cualquier otra logica (formateo de mensajes, transformacion de datos, cache) vive en la capa que corresponde (presentation, integration, orchestration). Los imports cruzados entre estos tres modulos estan prohibidos; la comunicacion es via la capa de orchestration.
**AUDITORIA:** Ralph verifica que no exista un cuarto directorio bajo `src/backend/domain/` y que no haya imports directos entre los tres modulos esenciales.

### UI-ADS-0862
**DEFINICION:** El Jira issue panel muestra solo informacion esencial para la decision del usuario: estado del ticket, score, y la accion prioritaria. Cualquier dato adicional requiere un click explicito del usuario para expandir.
**VALOR:** Si el usuario ve demasiada informacion, no ve nada. El essentialismo en la UI significa que el 90% de las veces el usuario solo necesita saber si su ticket esta aprobado o que debe corregir primero. El resto es ruido.
**IMPLEMENTACION:** El issue panel usa un patron progresivo: nivel 1 (siempre visible) = Lozenge de estado + score + una accion. Nivel 2 (expandible) = lista completa de reglas fallidas. Nivel 3 (expandible) = contexto de Rovo y evidencia de inconsistencias. Usar `SectionMessage` de ADS para cada nivel.
**AUDITORIA:** Ralph verifica que el nivel 1 del issue panel contenga exactamente tres elementos visibles y que los niveles 2 y 3 esten colapsados por defecto.

### ROVO-INTEG-0863
**DEFINICION:** El sistema solo debe hacer llamadas a Rovo que contribuyan directamente a la decision de enforcement actual. No prefetchar datos "por si acaso" ni obtener contexto que no se va a usar.
**VALOR:** Cada llamada a Rovo consume recursos, agrega latencia y aumenta el riesgo de fallo. El essentialismo exige que cada byte de contexto obtenido sea usado inmediatamente en una decision. El contexto "por si acaso" es desperdicio.
**IMPLEMENTACION:** Cada trigger de validacion declara explicitamente que tipo de contexto necesita: `{ requiredContext: ['confluence:project-X', 'jira:epic-Y'] }`. El `RovoContextProvider` solo obtiene el contexto declarado. Si el scoring engine no usa el contexto de Confluence para una regla especifica, no lo solicita.
**AUDITORIA:** Ralph verifica que cada llamada a Rovo corresponda a un contexto que es efectivamente utilizado por una regla de scoring o un detector de inconsistencias.

### FORGE-OPS-0864
**DEFINICION:** Las reglas de scoring por defecto deben ser las 5 que generan mayor impacto medible en la calidad de tickets. No incluir reglas "por completitud" que no tengan evidencia de impacto.
**VALOR:** Es mejor tener 5 reglas de scoring que realmente reducen rework que 20 reglas que generan ruido. Cada regla extra es una oportunidad de false positive que erosiona la confianza del usuario.
**IMPLEMENTACION:** Las 5 reglas por defecto: 1) `hasAcceptanceCriteria` - verificar presencia de AC, 2) `descriptionMinimumLength` - descripcion mayor a 50 palabras, 3) `hasStoryPoints` - estimacion asignada, 4) `linkedToEpic` - vinculado a un epic, 5) `rovoConsistencyCheck` - consistencia con contexto organizacional. Cada regla debe medir su impacto en `tickets.blocked.false_positive_rate` antes de ser promovida a default.
**AUDITORIA:** Ralph verifica que las reglas por defecto en `src/backend/config/defaults.ts` sean exactamente 5 y que cada una tenga documentado su impacto medible.

### GIT-CI-0865
**DEFINICION:** El CI pipeline solo ejecuta los checks esenciales para la calidad del codigo: lint, type-check, unit tests, y security scan. Checks complementarios (coverage report, bundle analysis) se ejecutan en paralelo sin bloquear el merge.
**VALOR:** Un CI pipeline con 15 pasos secuenciales bloqueantes hace lento el desarrollo. Los checks esenciales (lint, types, tests, security) deben ejecutarse en paralelo y ser los unicos que bloquean. Lo demas es informacion, no gate.
**IMPLEMENTACION:** GitHub Actions workflow con 4 jobs en paralelo como gates: `lint`, `type-check`, `unit-tests`, `security-scan`. Jobs informativos en paralelo: `coverage-report`, `bundle-analysis`, `e2e-tests` (estos fallan si hay errores pero no bloquean el merge del PR, solo el deploy a staging).
**AUDITORIA:** Ralph verifica que el workflow de CI tenga exactamente 4 jobs bloqueantes y que los demas jobs se ejecuten en paralelo sin bloquear el merge.
