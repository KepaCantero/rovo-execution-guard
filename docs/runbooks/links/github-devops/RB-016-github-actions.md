# [RB-016] GitHub Actions - Workflows, Secrets, Deployment Gates

> Fuente: GitHub Actions Documentation - https://docs.github.com/en/actions

## Reglas

### GIT-CI-301

**DEFINICION:** Los workflows de GitHub Actions para Rovo Execution Guard deben estructurarse con jobs explicitos: `lint`, `test`, `build`, `deploy` (en ese orden), donde cada job depende del anterior via `needs` y falla rapido si un job anterior falla.

**VALOR:** Un workflow monolitico oscurece donde fallo el pipeline. Con jobs separados, los desarrolladores ven inmediatamente si fallo lint, tests o build. El despliegue a Forge solo ocurre si lint + test + build pasan, previniendo que codigo roto llegue a produccion.

**IMPLEMENTACION:**
```yaml
name: Rovo Execution Guard CI/CD

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'
      - run: npm ci
      - run: npm run lint
      - run: npm run type-check

  test:
    needs: lint
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'
      - run: npm ci
      - run: npm test -- --coverage --ci
      - uses: actions/upload-artifact@v4
        with:
          name: coverage-report
          path: coverage/

  build:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'
      - run: npm ci
      - run: npm run build
      - run: npm run validate:manifest

  deploy:
    needs: build
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'
    environment: production
    steps:
      - uses: actions/checkout@v4
      - run: npm run deploy:forge
```

**AUDITORIA:** Ralph verifica que los archivos de workflow en `.github/workflows/` definan jobs separados con `needs` encadenados (lint -> test -> build -> deploy). Si se encuentra un workflow con un unico job que hace todo, o sin dependencias entre jobs, el check falla.

---

### SEC-PRIV-303

**DEFINICION:** Los secrets de GitHub Actions (`FORGE_API_TOKEN`, `GITHUB_APP_PRIVATE_KEY`, `WEBHOOK_SECRET`) deben accederse exclusivamente via `${{ secrets.SECRET_NAME }}` y nunca imprimirse en logs. Los workflows deben incluir `echo "::add-mask::<value>"` para cualquier valor sensible derivado.

**VALOR:** Las claves privadas de la GitHub App y los tokens de Forge permiten control total sobre la integracion. Si aparecen en logs, cualquier persona con acceso al repo puede extraerlos. GitHub Actions enmascara automaticamente los secrets, pero valores derivados (ej. JWT generados) no se enmascaran automaticamente.

**IMPLEMENTACION:**
```yaml
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Generate GitHub App JWT
        id: app-token
        env:
          APP_ID: ${{ secrets.GITHUB_APP_ID }}
          PRIVATE_KEY: ${{ secrets.GITHUB_APP_PRIVATE_KEY }}
        run: |
          TOKEN=$(node scripts/generate-app-jwt.js "$APP_ID" "$PRIVATE_KEY")
          echo "::add-mask::$TOKEN"
          echo "token=$TOKEN" >> "$GITHUB_OUTPUT"

      - name: Deploy to Forge
        env:
          FORGE_API_TOKEN: ${{ secrets.FORGE_API_TOKEN }}
        run: |
          npm run deploy:forge
        # Nunca usar `run: echo ${{ secrets.* }}` o similar
```

```typescript
// scripts/generate-app-jwt.js - Nunca logear el token
const jwt = generateJWT(appId, privateKey);
process.stdout.write(jwt); // solo el token, sin texto extra
```

**AUDITORIA:** Ralph escanea los archivos de workflow buscando patrones prohibidos: `echo.*secrets\.`, `print.*secrets\.`, `console\.log.*secrets` o cualquier paso que imprima secrets directamente. Si se encuentra un patron de exposicion de secrets, el check falla. Tambien verifica que los valores derivados de secrets usen `add-mask`.

---

### GIT-CI-302

**DEFINICION:** El workflow de deploy a produccion debe requerir un environment `production` con `required reviewers` (minimo 1 approver) y un `deployment gate` que verifique que los tests de integracion pasaron en el commit exacto que se va a deployar.

**VALOR:** Sin gate de deployment, cualquier merge a `main` se deploya automaticamente. Un gate manual permite revisar el resultado de CI antes de promover a produccion, previniendo deploys de hotfixes no validados. Para una app que bloquea PRs, un deploy erroneo puede paralizar el desarrollo de todo un equipo.

**IMPLEMENTACION:**
```yaml
environments:
  production:
    deployment-branches:
      - name: main
    required-reviewers:
      - rovo-guard-team

  staging:
    deployment-branches:
      - name: develop

jobs:
  deploy-staging:
    needs: build
    if: github.ref == 'refs/heads/develop'
    environment: staging
    runs-on: ubuntu-latest
    steps:
      - run: npm run deploy:forge -- --environment staging

  deploy-production:
    needs: build
    if: github.ref == 'refs/heads/main'
    environment: production
    runs-on: ubuntu-latest
    steps:
      - name: Verify CI passed on this commit
        run: |
          COMMIT_SHA="${{ github.sha }}"
          STATUS=$(gh api "repos/${{ github.repository }}/commits/$COMMIT_SHA/status" \
            --jq '.state')
          if [ "$STATUS" != "success" ]; then
            echo "CI status is '$STATUS', aborting deploy"
            exit 1
          fi
      - run: npm run deploy:forge -- --environment production
```

**AUDITORIA:** Ralph verifica que el job de deploy a produccion tenga configurado `environment: production` con reviewers requeridos. Verifica que exista un paso de verificacion de CI status antes del deploy. Si no existe gate de environment o verificacion de CI, el check falla.

---

### GIT-CI-303

**DEFINICION:** Los workflows deben usar matrix builds para ejecutar tests en las versiones de Node.js soportadas por Forge (`nodejs20.x`, `nodejs22.x`) y en las plataformas relevantes (`ubuntu-latest`), con `fail-fast: false` para detectar problemas de compatibilidad.

**VALOR:** Forge ejecuta funciones en Node.js sobre Lambda. Si el codigo usa APIs de Node 22 pero no se verifica compatibilidad con Node 20, la app falla en runtime sin warning. Matrix builds detectan estos problemas en CI antes del deploy.

**IMPLEMENTACION:**
```yaml
jobs:
  test:
    runs-on: ${{ matrix.os }}
    strategy:
      fail-fast: false
      matrix:
        os: [ubuntu-latest]
        node-version: ['20', '22']
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
          cache: 'npm'
      - run: npm ci
      - run: npm test -- --ci --coverage
      - name: Upload coverage
        if: matrix.node-version == '22'
        uses: actions/upload-artifact@v4
        with:
          name: coverage-report
          path: coverage/
```

**AUDITORIA:** Ralph verifica que el workflow de tests incluya una strategy matrix con las versiones de Node.js soportadas por Forge y que `fail-fast` sea `false`. Si solo se prueba una version de Node.js, emite un warning. Si `fail-fast` no esta seteado a `false`, el check emite un warning.
