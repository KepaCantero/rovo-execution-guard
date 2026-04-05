# TASK-025: CI/CD - GitHub Actions Pipelines (CI, CD, Rollback)

## Objetivo
Implementar los workflows de GitHub Actions para CI, CD multi-entorno y rollback automatico.

## Contexto
Los pipelines son el backbone de la infraestructura de calidad. Deben garantizar que nada llegue a produccion sin pasar todos los checks.

## Especificacion Tecnica

### Ubicacion
`.github/workflows/`

### Workflow 1: `ci.yml` (Validacion de PRs)

#### Triggers
- `pull_request` a `main` y `develop`

#### Jobs
1. **lint-and-security**
   - `npm run lint`
   - `npm run typecheck`
   - Snyk security scan (dependencias)
   - Forge lint

2. **test-unit**
   - `npm run test:unit -- --coverage`
   - Coverage threshold: > 85%
   - Upload coverage report

3. **test-integration**
   - `npm run test:integration`
   - Con mocks de APIs

4. **test-e2e** (solo en PRs a main)
   - `npm run test:e2e`
   - Playwright con contenedores

#### Reglas
- Todos los jobs deben pasar para permitir merge
- Coverage badge en README

### Workflow 2: `deploy.yml` (Despliegue multi-entorno)

#### Triggers
- Push a `develop` -> deploy a development
- Push a `main` -> deploy a staging
- Tag `v*.*.*` -> deploy a production

#### Jobs
1. **deploy-development**
   - Trigger: push a `develop`
   - `forge deploy -e development`
   - Health check post-deploy

2. **deploy-staging**
   - Trigger: push a `main`
   - `forge deploy -e staging`
   - Ejecutar Playwright E2E en staging
   - Health check post-deploy

3. **deploy-production**
   - Trigger: tag `v*.*.*`
   - Deployment Gate: aprobacion manual
   - `forge deploy -e production`
   - `forge install --upgrade`
   - Health check post-deploy
   - Si falla: trigger rollback

#### Variables de entorno
- `FORGE_API_TOKEN` (secret)
- `FORGE_APP_ID` (secret)
- `SENTRY_DSN` (secret)

### Workflow 3: `rollback.yml` (Reversion)

#### Triggers
- `workflow_dispatch` (manual)
- `repository_dispatch` (automatico desde Sentry)

#### Jobs
1. **rollback**
   - Leer `.forge-versions.json` para obtener version estable anterior
   - `forge deploy -e production --version <stable_version>`
   - Health check post-rollback
   - Notificar al equipo

## Acceptance Criteria
- [ ] AC-01: `ci.yml` ejecuta lint, security, tests en cada PR
- [ ] AC-02: `deploy.yml` despliega al entorno correcto segun el trigger
- [ ] AC-03: `deploy-production` requiere aprobacion manual
- [ ] AC-04: `rollback.yml` puede revertir a version anterior
- [ ] AC-05: Health check post-deploy en todos los entornos
- [ ] AC-06: Secrets gestionados de forma segura
- [ ] AC-07: Fallo en deploy a staging bloquea deploy a production
- [ ] AC-08: Archivo `.reqs.md` sidecar creado

## Reglas del Rulebook
- **[GIT-CI-004]**: Pipeline estricto (fail fast)
- **[GIT-CI-005]**: Deploy bloqueado si tests fallan
- **[GIT-CI-006]**: Rollback automatizado ante fallos

## Estrategia de Test
- **Unit**: N/A (YAML config)
- **Integration**: Simular push y verificar pipeline
- **E2E**: Push real y verificar deploy completo

## Dependencias
- TASK-001 (manifest.yml)
- TASK-004 (husky)
- TASK-023 (health check script)

## Estado: PENDIENTE
