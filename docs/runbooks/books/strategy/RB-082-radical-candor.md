# [RB-082] Radical Candor

> Libro: Kim Scott - Radical Candor: Be a Kick-Ass Boss Without Losing Your Humanity

## Reglas

### UI-ADS-0821
**DEFINICION:** Los mensajes de enforcement (bloqueo de ticket, fallo de PR check) deben explicar directamente por que se bloqueo y que accion concreta debe tomar el usuario, sin eufemismos ni jerga tecnica interna.
**VALOR:** La honestidad radical exige que el sistema diga claramente "Tu ticket fue bloqueado porque no tiene acceptance criteria" en lugar de "Quality gate no superado". El usuario necesita saber que hacer, no que paso en abstracto.
**IMPLEMENTACION:** Cada regla de scoring y cada detector de inconsistencias debe tener un campo `userMessage` y un campo `actionSuggestion`. Ejemplo: `{ userMessage: 'Este ticket no tiene criterios de aceptacion', actionSuggestion: 'Agrega al menos un criterio de aceptacion verificable en el campo "Acceptance Criteria"' }`. Estos mensajes se muestran en el Jira issue panel y en los comentarios de GitHub PR.
**AUDITORIA:** Ralph verifica que cada regla de scoring y cada detector de inconsistencias tenga `userMessage` y `actionSuggestion` definidos y que los mensajes no contengan terminos tecnicos internos (ej: "CompositeScoringStrategy").

### ARCH-SOLID-0822
**DEFINICION:** El sistema de feedback de usuarios (cuando un ticket es bloqueado incorrectamente) debe fluir directamente al modulo de scoring como senal de false positive, ajustando los pesos automaticamente si el volumen supera un umbral.
**VALOR:** El feedback directo de los usuarios es la forma mas honesta de mejorar el sistema. Si muchos usuarios marcan un bloqueo como incorrecto, el sistema debe escuchar y adaptarse, no defender su decision.
**IMPLEMENTACION:** Cuando un usuario hace click en "Esto es incorrecto" en el issue panel, se registra un evento `FalsePositiveReported` con `{ ruleId, issueKey, userId, timestamp }`. Si una regla acumula mas de 5 false positive reports en 7 dias, su peso se reduce automaticamente un 20% y se genera una alerta para revision manual.
**AUDITORIA:** Ralph verifica que el flujo de feedback este implementado desde la UI hasta el ajuste de pesos y que cada false positive reportado este registrado en el audit log.

### TEST-QA-0823
**DEFINICION:** Los code reviews deben incluir una seccion especifica para dar feedback sobre la claridad del codigo, no solo sobre su correccion. Los PRs deben ser una oportunidad de aprendizaje, no solo un checkpoint.
**VALOR:** La critica radical en code reviews mejora la calidad del codigo y el crecimiento del equipo. Rovo Execution Guard es un proyecto complejo (6 capas, multiples APIs) donde la claridad del codigo es critica para el mantenimiento.
**IMPLEMENTACION:** El PR template incluye una seccion `## Claridad del Codigo` donde el reviewer debe comentar sobre: nombres de variables, estructura de funciones, y documentacion de decisiones. No se aprueba un PR sin feedback en esta seccion. Los comentarios deben seguir el formato: "En [archivo:linea], [observacion]. Sugerencia: [alternativa]."
**AUDITORIA:** Ralph verifica que los PRs mergeados tengan al menos un comentario de review sobre claridad de codigo y que no existan approvals sin comentarios.

### ROVO-INTEG-0824
**DEFINICION:** Cuando Rovo Execution Guard detecta una inconsistencia entre un ticket y la documentacion, el mensaje al usuario debe citar la fuente especifica de la contradiccion, no solo decir "hay inconsistencia".
**VALOR:** La honestidad radical exige evidencia. Si el sistema dice que un ticket contradice la documentacion, debe mostrar exactamente donde: "Tu ticket dice X, pero la pagina Y de Confluence dice Z". Sin evidencia, el enforcement es autoritario, no colaborativo.
**IMPLEMENTACION:** Cada `Inconsistency` devuelta por los detectores debe incluir `source`: `{ field: string; ticketValue: string; documentTitle: string; documentUrl: string; documentExcerpt: string }`. La UI muestra esta evidencia directamente en el issue panel con links al documento fuente.
**AUDITORIA:** Ralph verifica que cada inconsistencia reportada en la UI tenga su fuente citada con URL al documento de Confluence o campo especifico del ticket.

### SEC-PRIV-0825
**DEFINICION:** Las decisiones de seguridad (que datos se loggean, que se almacena en cache, que se envia al cliente) deben documentarse explicitamente en un archivo `SECURITY-DECISIONS.md` con la justificacion de cada una.
**VALOR:** La transparencia radical sobre decisiones de seguridad permite que cualquier miembro del equipo entienda por que se eligio una estrategia. Las decisiones de seguridad no deben ser opacas ni perderse en commits individuales.
**IMPLEMENTACION:** Crear `SECURITY-DECISIONS.md` en la raiz del repositorio. Cada decision tiene formato: `## [ID] Titulo | Fecha: YYYY-MM-DD | Contexto: ... | Decision: ... | Consecuencias: ...`. Las decisiones incluyen: que datos de Rovo se cachean, que se loggea, como se manejan tokens de GitHub, etc.
**AUDITORIA:** Ralph verifica que cada decision de seguridad implementada en el codigo tenga su correspondiente entrada en `SECURITY-DECISIONS.md`.
