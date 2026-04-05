# [RB-065] Continuous Delivery

> Libro: Jez Humble & David Farley - Continuous Delivery: Reliable Software Releases through Build, Test, and Deployment Automation

## Reglas

### GIT-CI-051
**DEFINICION:** Todo cambio de codigo debe pasar por un pipeline de despliegue automatizado con stages secuenciales: lint + security scan, tests unitarios, tests de integracion, tests E2E, deploy a staging, y deploy a produccion con aprobacion manual.
**VALOR:** Sin un pipeline automatizado, es posible que codigo con fallos en los Quality Gates de negocio llegue a produccion y bloquee tickets de Jira incorrectamente para equipos enteros.
**IMPLEMENTACION:** Configurar `.github/workflows/ci.yml` con jobs: (1) `lint-security`: ESLint strict + Snyk scan, (2) `unit-tests`: Jest con cobertura minima 85%, (3) `integration-tests`: mocks de APIs Atlassian/GitHub, (4) `e2e-tests`: Playwright simulando flujo completo de bloqueo. Solo si todos pasan, se habilita el deploy a staging.
**AUDITORIA:** Ralph verifica que el pipeline CI no permita merge de PRs sin que todos los jobs pasen y que la cobertura de tests no baje del umbral configurado.

### GIT-CI-052
**DEFINICION:** Cada commit en `main` debe ser desplegable a produccion en cualquier momento. Si un commit rompe el pipeline, es la maxima prioridad del equipo arreglarlo o revertirlo.
**VALOR:** Si `main` contiene codigo que no se puede desplegar, cualquier hotfix critico (por ejemplo, un bug que bloquea todos los tickets de un proyecto) requiere primero arreglar el pipeline antes de poder desplegar el fix.
**IMPLEMENTACION:** Regla de branch protection en GitHub: `main` requiere status checks de CI passing, cobertura minima, y al menos 1 aprobacion. Si el CI falla en `main`, el protocolo de emergencia es: (1) revert del commit causante, (2) fix en develop, (3) redeploy via release branch.
**AUDITORIA:** Ralph monitorea que `main` nunca tenga un estado de CI roto por mas de 30 minutos y genera una alerta si se detecta.

### GIT-CI-053
**DEFINICION:** Los tests de humo (smoke tests) deben ejecutarse automaticamente despues de cada deploy a cualquier entorno de Forge para verificar que la app responde correctamente.
**VALOR:** Un deploy a Forge puede ser exitoso segun el pipeline pero la app puede no responder correctamente en el entorno (por ejemplo, permisos de scopes incorrectos). Sin smoke tests post-deploy, el problema se detecta solo cuando los usuarios reportan fallos.
**IMPLEMENTACION:** Crear un step en el workflow de deploy que despues de `forge deploy` ejecute un script que: (1) verifique que el resolver de health check responde 200, (2) verifique que el trigger de validacion esta registrado, (3) registre el resultado en Forge Storage con timestamp. Si el smoke test falla, el deploy a produccion se detiene.
**AUDITORIA:** Ralph verifica que cada workflow de deploy incluya un step de smoke test post-deploy y que exista un health check endpoint en el resolver de Forge.
