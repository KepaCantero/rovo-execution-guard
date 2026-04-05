# [RB-096] The Clean Coder

> Libro: Robert C. Martin - The Clean Coder: A Code of Conduct for Professional Programmers

## Reglas

### TEST-QA-0961
**DEFINICION:** Todo el codigo del dominio (scoring, inconsistency, enforcement) debe desarrollarse con TDD: escribir el test fallido primero, luego la implementacion minima que pase el test, y finalmente refactorizar. Ninguna funcion del dominio se escribe sin un test previo.
**VALOR:** Martin exige disciplina TDD como marca de profesionalismo. En el contexto de Rovo Execution Guard, donde las decisiones de enforcement afectan directamente el workflow de los equipos, la certeza de que el codigo hace lo que debe es innegociable.
**IMPLEMENTACION:** Workflow TDD: 1) Escribir test que defina el comportamiento esperado (ej: `it('should score 0 when ticket has no description')`), 2) Verificar que falla (red), 3) Escribir la implementacion minima, 4) Verificar que pasa (green), 5) Refactorizar manteniendo tests verdes. El Husky pre-commit asegura que los tests pasen antes de cada commit.
**AUDITORIA:** Ralph verifica que cada funcion del dominio tenga al menos un test y que la cobertura del dominio sea >= 90%.

### ARCH-SOLID-0962
**DEFINICION:** Un desarrollador profesional debe poder decir "no" a estimaciones irreales. En el contexto del Forge app, esto significa: si una feature no se puede implementar con calidad en el tiempo estimado, se reduce el scope, no se salta los tests.
**VALOR:** La presion para entregar rapido es la mayor amenaza a la calidad. Martin dice que un profesional negocia el scope, nunca la calidad. Un scoring engine sin tests es peor que un scoring engine con menos reglas pero bien testeado.
**IMPLEMENTACION:** Cada tarea en Jira tiene un campo "Definition of Done" que incluye: tests unitarios pasando, coverage >= 85%, lint limpio, y al menos una persona que hizo code review. Si la tarea no cumple el DoD al final del sprint, no se cierra, se reduce el scope en lugar de saltar los requisitos de calidad.
**AUDITORIA:** Ralph verifica que todas las tareas cerradas en los ultimos 30 dias cumplan el Definition of Done (tests pasando, coverage, lint, review).

### SEC-PRIV-0963
**DEFINICION:** Los desarrolladores son responsables de la seguridad del codigo que escriben. Cada PR debe incluir una auto-revision de seguridad: ¿esta funcion expone datos sensibles? ¿esta consulta es vulnerable a injection? ¿este token se almacena correctamente?
**VALOR:** La seguridad no es solo del equipo de seguridad. Martin exige que cada profesional sea responsable de la calidad de su trabajo, incluyendo la seguridad. Un token de GitHub filtrado en un log puede comprometer un repositorio entero.
**IMPLEMENTACION:** El PR template incluye una seccion `## Security Self-Review` con checklist: - No se loggean datos sensibles - No se exponen tokens en el cliente - Inputs se validan antes de procesar - Forge Storage se usa correctamente para datos sensibles. El reviewer tambien verifica esta seccion. Snyk se ejecuta automaticamente en cada PR.
**AUDITORIA:** Ralph verifica que cada PR mergeado tenga la seccion de Security Self-Review completada y que Snyk no reporte vulnerabilidades nuevas.

### FORGE-OPS-0964
**DEFINICION:** El equipo debe mantener un horario sostenible de desarrollo. Si el sprint requiere horas extra recurrentes para completarse, el sprint esta mal estimado, no el equipo es lento.
**VALOR:** Martin argumenta que la velocidad sostenible es mas productiva que los sprints de madrugada. El codigo escrito con fatiga tiene mas bugs. Un Forge app con bugs en el enforcement es peor que un Forge app con features retrasadas.
**IMPLEMENTACION:** Las estimaciones de tareas incluyen un buffer del 20% para imprevistos. Las tareas se estiman en puntos (no horas) con planning poker. Si un sprint completa menos del 70% de los puntos, el siguiente sprint reduce la carga. La velocidad del equipo se mide como promedio de los ultimos 3 sprints.
**AUDITORIA:** Ralph verifica que la velocidad del equipo sea estable (variacion < 25% entre sprints) y que no haya sprints con mas del 30% de tareas sin completar.

### GIT-CI-0965
**DEFINICION:** Ningun codigo se mergea sin al menos una revision por un par. Los reviewers son tan responsables del codigo como el autor. Un "LGTM" sin leer el codigo es una falta profesional.
**VALOR:** El code review es la ultima linea de defensa antes de que el codigo llega a produccion. Un reviewer que aprueba sin leer es coparticipe de cualquier bug que se introduzca. El profesionalismo exige revisiones serias y constructivas.
**IMPLEMENTACION:** GitHub branch protection rules: requerir al menos 1 approval antes de merge. El reviewer debe verificar: 1) tests pasan, 2) coverage no disminuye, 3) no hay vulnerabilidades, 4) el codigo es legible. Las revisiones deben completarse en menos de 24 horas. Si un reviewer no responde en 24h, se reasigna automaticamente.
**AUDITORIA:** Ralph verifica que todos los PRs mergeados tengan al menos un approval con comentarios sustanciales (no solo "LGTM") y que las revisiones se completen en menos de 24 horas.
