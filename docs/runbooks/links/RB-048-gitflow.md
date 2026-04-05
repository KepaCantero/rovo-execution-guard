# [RB-048] GitFlow Workflow - Branch Strategy, Release Management

> Fuente: GitFlow Workflow - Branch strategy, release management

## Reglas

### GIT-CI-048-01
**DEFINICION:** El repositorio debe usar las ramas permanentes `main` (produccion) y `develop` (integracion); las ramas temporales siguen el patron `<type>/<ticket-id>-<short-desc>` donde type es `feature`, `bugfix`, `hotfix`, o `release`.
**VALOR:** La estructura de ramas predecible permite a cualquier desarrollador encontrar el trabajo en curso y a los pipelines CI/CD comportarse diferente segun el tipo de rama.
**IMPLEMENTACION:** Convencion de nombres: `feature/TASK-015-scoring-engine`, `bugfix/TASK-022-sentry-context`, `hotfix/TASK-025-ci-fix`, `release/v1.2.0`. Configurar branch protection en `main` y `develop` que requiera PR con al menos 1 aprobacion. Los pipelines deben distinguir el tipo de rama para ejecutar checks diferentes.
**AUDITORIA:** Ralph verifica que solo existen ramas permanentes `main` y `develop`, que las ramas temporales siguen la convencion `<type>/<ticket-id>-<short-desc>`, y que no existen ramas huerfanas con mas de 30 dias de inactividad.

### GIT-CI-048-02
**DEFINICION:** Los merges a `main` solo se permiten desde ramas `hotfix/*` o `release/*`; los merges a `develop` solo desde `feature/*` o `bugfix/*`; nunca mergear feature directamente a `main`.
**VALOR:** La restriccion de flujo entre ramas asegura que todo codigo en produccion pasa por el proceso de release o hotfix, donde se ejecutan los checks de calidad completos.
**IMPLEMENTACION:** Configurar branch protection en GitHub: `main` permite merge solo desde `hotfix/*` y `release/*`; `develop` permite merge desde `feature/*`, `bugfix/*`, y `release/*`. El workflow CI en `main` ejecuta suite completa + deploy a produccion; en `develop` ejecuta suite completa + deploy a staging.
**AUDITORIA:** Ralph verifica que las branch protection rules estan configuradas correctamente y que el historial de merges a `main` solo proviene de ramas hotfix o release.

### GIT-CI-048-03
**DEFINICION:** Las ramas de feature deben eliminarse dentro de las 24 horas posteriores al merge; las ramas de release se eliminan tras verificar que el deploy a produccion fue exitoso; no deben existir mas de 5 ramas de feature activas simultaneamente.
**VALOR:** Las ramas acumuladas dificultan la navegacion del repositorio y pueden causar conflictos de merge que incrementan exponencialmente con el tiempo.
**IMPLEMENTACION:** Configurar GitHub para eliminar ramas automaticamente tras merge de PR. Anadir step en CI post-merge: `gh api repos/:owner/:repo/git/refs/heads/:branch --method DELETE`. Crear metrica `active_feature_branches` que alerte si supera 5.
**AUDITORIA:** Ralph verifica que no existen ramas de feature fusionadas con mas de 24 horas de antiguedad, que las ramas de release se eliminan tras deploy exitoso, y que el numero de feature branches activas no excede 5.

### GIT-CI-048-04
**DEFINICION:** Las ramas `hotfix/*` deben crearse desde `main`, solucionar un unico issue critico, mergearse de vuelta a `main` y `develop` simultaneamente, y generar un tag `vX.Y.Z` con patch bump inmediato.
**VALOR:** Los hotfixes aislados de `main` garantizan que solo el cambio critico llega a produccion sin arrastrar trabajo en curso de `develop`; el merge a ambas ramas evita regresiones.
**IMPLEMENTACION:** Workflow: `1. git checkout main && git pull && git checkout -b hotfix/TASK-XXX-critical-fix. 2. Implementar fix + test. 3. PR a main (requiere 2 aprobadores para hotfixes). 4. Tras merge: git tag -a vX.Y.Z -m "Hotfix: description". 5. git checkout develop && git merge hotfix/TASK-XXX-critical-fix`. Automatizar pasos 4-5 en GitHub Actions.
**AUDITORIA:** Ralph verifica que los hotfixes se originan de `main`, se mergearon a `main` y `develop`, generaron un tag semver, y contienen un unico cambio critico (no mas de 200 lineas modificadas).

### GIT-CI-048-05
**DEFINICION:** Las ramas `release/*` deben congelarse para nuevas funcionalidades tras su creacion; solo se aceptan bugfixes de ultimo minuto y actualizaciones de documentacion; la duracion de una rama release no debe exceder 7 dias.
**VALOR:** La congelacion de release evita la introduccion de regresiones de ultima hora y limita la ventana de estabilizacion para que no se convierta en un cuello de botella.
**IMPLEMENTACION:** Al crear `release/vX.Y.0` desde `develop`: notificar al equipo que la rama esta en code freeze. Solo PRs con label `release-fix` se aceptan. Tras 7 dias maximo, mergear a `main` con tag y a `develop` con los fixes acumulados. Si no esta lista en 7 dias, escalar para decidir entre extender o eliminar la rama.
**AUDITORIA:** Ralph verifica que las ramas release no exceden 7 dias de vida, que los merges a release solo contienen bugfixes etiquetados, y que tras el merge se crean tags en `main` y se sincroniza con `develop`.
