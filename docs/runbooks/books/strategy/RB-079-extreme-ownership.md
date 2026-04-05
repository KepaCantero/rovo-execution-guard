# [RB-079] Extreme Ownership

> Libro: Jocko Willink - Extreme Ownership: How U.S. Navy SEALs Lead and Win

## Reglas

### FORGE-OPS-0791
**DEFINICION:** Cada modulo del Forge app debe tener un unico owner responsable definido en un archivo `OWNERS.md` en la raiz del modulo, responsable de la calidad, seguridad y rendimiento de su codigo.
**VALOR:** La titularidad extrema elimina los "no se de quien es este codigo". Cuando un quality gate falla en produccion, hay una persona responsable con contexto para resolverlo rapidamente.
**IMPLEMENTACION:** Crear `src/backend/domain/scoring/OWNERS.md` con formato `# Owner: @username`. El CI puede validar que cada modulo modificado en un PR tenga su owner como reviewer. Los owners son los Code Owners de GitHub para sus respectivos paths.
**AUDITORIA:** Ralph verifica que cada directorio bajo `src/backend/domain/` y `src/backend/integration/` tenga un archivo `OWNERS.md` actualizado.

### SEC-PRIV-0792
**DEFINICION:** Ningun bloque try-catch debe tragarse errores silenciosamente. Todo error debe ser loggeado con contexto suficiente (modulo, operacion, issueKey) y propagado o manejado explicitamente.
**VALOR:** Los errores son responsabilidad del equipo. Un error silencioso en el scoring engine se convierte en un ticket mal validado que llega a produccion. La titularidad extrema exige visibilidad total de fallos.
**IMPLEMENTACION:** En cada catch block, llamar a `forge/log.error()` con un objeto estructurado: `{ module: 'scoring', operation: 'calculateScore', issueKey, error: error.message, stack: error.stack }`. Nunca dejar un catch vacio. Si el error es recuperable, loggearlo como warning y documentar la estrategia de recovery.
**AUDITORIA:** Ralph revisa que no existan bloques `catch` vacios o que solo contengan `console.log` sin contexto estructurado.

### GIT-CI-0793
**DEFINICION:** Cada PR debe explicar en su descripcion que problema resuelve, como se valido, y que riesgos introduce. El autor es responsable de que el PR este completo antes de solicitar review.
**VALOR:** El autor asume titularidad extrema de su cambio. Los reviewers no tienen que adivinar la intencion. Esto reduce reviews superficiales y bugs que pasan por falta de contexto en el equipo de Rovo Execution Guard.
**IMPLEMENTACION:** Crear un PR template en `.github/pull_request_template.md` con secciones: `## Problema`, `## Solucion`, `## Como se valido`, `## Riesgos`, `## Checklist`. Husky o GitHub Actions validan que el PR no se mezcle sin completar todas las secciones.
**AUDITORIA:** Ralph verifica que todos los PRs mergeados en los ultimos 30 dias tengan las secciones del template completadas.

### TEST-QA-0794
**DEFINICION:** Cuando un bug se descubre en produccion, el primer paso es escribir un test que reproduzca el fallo antes de corregir el codigo. El fix no se mergea sin el test de regresion.
**VALOR:** El equipo asume titularidad extrema del bug: no solo lo corrige sino que asegura que nunca vuelva a ocurrir. Cada bug es una oportunidad de mejorar la suite de tests del Forge app.
**IMPLEMENTACION:** Workflow: 1) Escribir test en `tests/regression/` que falle reproduciendo el bug. 2) Corregir el codigo. 3) Verificar que el test pasa. 4) Commit con mensaje `fix(scope): description (regression test)`. El CI verifica que los tests de regresion pasen en cada deploy.
**AUDITORIA:** Ralph revisa que cada issue cerrado como bug en Jira tenga un commit asociado con un test de regresion en `tests/regression/`.

### ROVO-INTEG-0795
**DEFINICION:** Cada llamada a una API externa (Rovo, Jira, GitHub) debe tener un timeout explicito y un fallback definido. El sistema nunca debe quedar en estado indeterminado por una dependencia externa.
**VALOR:** La titularidad extrema significa que el sistema es responsable de su propio estado. Si Rovo no responde, Rovo Execution Guard sigue funcionando con validacion basica, no se cuelga esperando.
**IMPLEMENTACION:** Usar `AbortController` con timeout de 5 segundos para llamadas HTTP. Definir un `FallbackStrategy` por adapter: si Rovo falla, usar `BasicScoringEngine`; si GitHub falla, encolar el status check para reintento; si Jira falla, loggear y reintentar con backoff.
**AUDITORIA:** Ralph verifica que cada adapter en `src/backend/integration/` tenga un timeout configurado y una funcion de fallback documentada y testeada.
