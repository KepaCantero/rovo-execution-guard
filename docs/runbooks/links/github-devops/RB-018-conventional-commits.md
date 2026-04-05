# [RB-018] Conventional Commits

> Fuente: Conventional Commits 1.0.0 - https://www.conventionalcommits.org/

## Reglas

### GIT-CI-308

**DEFINICION:** Todo commit en el repositorio debe seguir el formato Conventional Commits: `<type>(<scope>): <description>`, donde `type` es uno de `feat`, `fix`, `perf`, `refactor`, `test`, `docs`, `chore`, `ci`, `build`; `scope` es el modulo afectado (`scoring`, `github`, `jira`, `rovo`, `webhook`, `admin`, `ui`); y `description` esta en minusculas sin punto final.

**VALOR:** Los conventional commits alimentan automaticamente la generacion de CHANGELOG, la determinacion de version SemVer (feat = MINOR, fix = PATCH, BREAKING = MAJOR), y permiten filtrar commits por modulo. Para Rovo Execution Guard, donde multiples adaptadores evolucionan en paralelo, el scope permite entender rapidamente que parte de la integracion cambio.

**IMPLEMENTACION:**
```
# Formato obligatorio:
<type>(<scope>): <description>

# Ejemplos validos:
feat(scoring): add weighted inconsistency detection for confluence sources
fix(github): handle 304 not modified in status check polling
perf(rovo): cache context queries with 24h TTL in Forge Storage
refactor(jira): extract ADF parser to shared utility module
test(webhook): add HMAC-SHA256 signature verification edge cases
docs(admin): update configuration guide for new threshold format
chore(ci): add Node 22 to matrix build strategy
ci(deploy): add staging environment deployment workflow
build(manifest): update runtime to nodejs22.x

# Ejemplos invalidos:
added new scoring feature              # sin tipo ni scope
Fix: resolved bug in GitHub adapter    # tipo en mayuscula, formato incorrecto
feat: new feature.                     # punto final
feat(scoring)                          # sin descripcion
```

```javascript
// commitlint.config.js
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [2, 'always', [
      'feat', 'fix', 'perf', 'refactor', 'test',
      'docs', 'chore', 'ci', 'build',
    ]],
    'scope-enum': [2, 'always', [
      'scoring', 'github', 'jira', 'rovo', 'webhook',
      'admin', 'ui', 'config', 'manifest', 'storage',
    ]],
    'scope-case': [2, 'always', 'lower-case'],
    'subject-case': [2, 'never', ['start-case', 'pascal-case', 'upper-case']],
    'subject-full-stop': [2, 'never', '.'],
    'subject-max-length': [2, 'always', 72],
  },
};
```

**AUDITORIA:** Ralph ejecuta `commitlint` contra los ultimos N commits y verifica que todos sigan el formato `<type>(<scope>): <description>`. Si algun commit no cumple, el check falla listando los commits invalidos.

---

### GIT-CI-309

**DEFINICION:** Los commits que introducen breaking changes deben incluir un footer `BREAKING CHANGE:` con una descripcion del cambio y la migracion requerida, o bien usar el sufijo `!` despues del tipo (ej. `feat(scoring)!:`).

**VALOR:** Rovo Execution Guard tiene un contrato con sus usuarios: el formato del scoring, la estructura de los comentarios en PRs, y los campos de configuracion. Un breaking change sin footer `BREAKING CHANGE:` no sera detectado por `semantic-release`, que no incrementara la version MAJOR, desplegando un cambio incompatible como si fuera retrocompatible.

**IMPLEMENTACION:**
```
# Opcion 1: Footer BREAKING CHANGE
feat(scoring): change score format from numeric to letter grade

BREAKING CHANGE: Score values are now letters (A-F) instead of numbers (0-100).
Admins must update threshold configuration:
- Before: `passingScore: 70`
- After: `passingScore: "C"`
Migration: Run `npm run migrate:scores` before upgrading.

# Opcion 2: Sufijo !
feat(scoring)!: replace numeric scoring with letter grades

BREAKING CHANGE: Score format changed. See migration guide.
```

```javascript
// commitlint.config.js - regla adicional
module.exports = {
  rules: {
    'footer-breaking-change': [2, 'always'],
  },
  plugins: [
    {
      rules: {
        'footer-breaking-change': ({ body }) => {
          const hasBreaking = body && body.includes('BREAKING CHANGE:');
          return [
            hasBreaking || !((parsed) => parsed.header.includes('!'))({ header: '' }),
            'Breaking changes must include BREAKING CHANGE: footer',
          ];
        },
      },
    },
  ],
};
```

**AUDITORIA:** Ralph verifica que todo commit con `!` en el header o con cambios en interfaces publicas (tipos exportados, schemas de Storage, formato de scoring) incluya un footer `BREAKING CHANGE:` con instrucciones de migracion. Si se detecta un breaking change sin footer, el check falla.

---

### GIT-CI-310

**DEFINICION:** Los commits que corresponden a trabajo tracked en Jira deben incluir el ID del ticket de Jira en el footer del commit en el formato `Jira: <PROJECT>-<NUMBER>` (ej. `Jira: ROVO-042`). Para PRs que afectan multiples tickets, listar todos los IDs separados por coma.

**VALOR:** Rovo Execution Guard es una app que valida tickets de Jira. Es coherente que su propio desarrollo mantenga trazabilidad con Jira. El ID en el commit permite navegar desde el historial de git al contexto del ticket, y desde el ticket a los commits que lo implementaron. Esto es especialmente valioso durante el desarrollo cuando Ralph audita que cada ticket tiene commits asociados.

**IMPLEMENTACION:**
```
feat(scoring): add weighted factor for stale confluence sources

Implement a time-decay factor that reduces the weight of Confluence
documents older than 90 days in the consistency scoring algorithm.

Jira: ROVO-042

# Para multiples tickets:
fix(github): handle rate limit during batch PR validation

Jira: ROVO-089, ROVO-091
```

```javascript
// commitlint.config.js - regla para Jira ID
module.exports = {
  rules: {
    'references-empty': [2, 'never'], // Requiere al menos un reference (Jira ID)
    'footer-has-jira-id': [2, 'always'],
  },
  plugins: [
    {
      rules: {
        'footer-has-jira-id': ({ footer }) => {
          if (!footer) return [false, 'Commit must include Jira ticket ID'];
          const hasJiraId = /Jira:\s*[A-Z]+-\d+/.test(footer);
          return [hasJiraId, 'Footer must include Jira ID in format: Jira: PROJECT-123'];
        },
      },
    },
  ],
};
```

**AUDITORIA:** Ralph verifica que cada commit en `main` tenga un footer con formato `Jira: <PROJECT>-<NUMBER>`. Si se encuentra un commit en `main` sin Jira ID, emite un warning. Si se encuentra un commit con un Jira ID que no existe o esta en estado cerrado hace mas de 30 dias sin actividad, emite un warning.

---

### GIT-CI-311

**DEFINICION:** El `husky` pre-commit hook debe ejecutar `commitlint` para validar el mensaje antes de que el commit se cree, y el `commit-msg` hook debe rechazar commits que no cumplan el formato. En CI, un step adicional debe validar todos los commits del PR.

**VALOR:** Validar commits solo en CI es tarde: el commit ya existe y el desarrollador tiene que hacer `git commit --amend`. Validar en pre-commit mediante husky da feedback inmediato. Para CI, validar todos los commits del PR previene que se mergen commits con formato incorrecto que despues rompen el CHANGELOG automatico.

**IMPLEMENTACION:**
```yaml
# .husky/commit-msg
npx --no -- commitlint --edit "$1"
```

```yaml
# .github/workflows/ci.yml - validacion de commits en PR
jobs:
  commitlint:
    if: github.event_name == 'pull_request'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
      - run: npm ci
      - name: Validate PR commits
        run: npx commitlint --from ${{ github.event.pull_request.base.sha }} --to ${{ github.sha }}
```

**AUDITORIA:** Ralph verifica que exista un hook de husky en `.husky/commit-msg` que ejecute `commitlint`. Verifica que el workflow de CI tenga un step de commitlint que valide los commits del PR. Si falta cualquiera de los dos, el check falla.
