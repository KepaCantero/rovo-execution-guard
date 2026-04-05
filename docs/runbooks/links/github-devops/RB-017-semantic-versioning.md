# [RB-017] Semantic Versioning (SemVer)

> Fuente: Semantic Versioning 2.0.0 - https://semver.org/

## Reglas

### GIT-CI-304

**DEFINICION:** Toda version publicada de Rovo Execution Guard debe seguir el formato SemVer estricto `MAJOR.MINOR.PATCH` (ej. `1.4.2`), donde MAJOR indica cambios incompatibles en el scoring o la API de webhooks, MINOR indica funcionalidad nueva retrocompatible, y PATCH indica correcciones de bugs retrocompatibles.

**VALOR:** Rovo Execution Guard es una Forge App que se instala en instancias de Jira. Un cambio en el formato de scoring (ej. de 0-100 a A-F) es un breaking change para los admins que configuran thresholds. Sin SemVer, los admins no pueden prever el impacto de una actualizacion y pueden encontrar que sus reglas de blocking dejan de funcionar sin aviso.

**IMPLEMENTACION:**
```json
// package.json
{
  "name": "rovo-execution-guard",
  "version": "0.1.0",
  "scripts": {
    "release": "semantic-release",
    "release:dry": "semantic-release --dry-run"
  }
}
```

```typescript
// config/version.ts
export const APP_VERSION = process.env.npm_package_version ?? '0.0.0-dev';

// Incluir en status checks para trazabilidad:
await publishStatusCheck(octokit, {
  // ...
  description: `Rovo Guard v${APP_VERSION}: Score ${score.value}/100`,
  // ...
});
```

**AUDITORIA:** Ralph verifica que `package.json` tenga un campo `version` en formato SemVer (`\d+\.\d+\.\d+`). Verifica que las releases en GitHub sigan el formato `v{MAJOR}.{MINOR}.{PATCH}`. Si se encuentra una version con formato no SemVer (ej. `1.0`, `v2-beta`), el check falla.

---

### GIT-CI-305

**DEFINICION:** Los breaking changes (cambios en la estructura del scoring, formato de webhook, o configuracion de admin) deben incrementar la version MAJOR y documentarse en CHANGELOG.md con una seccion "BREAKING CHANGES" que describa la migracion requerida.

**VALOR:** Los breaking changes en Rovo Execution Guard pueden bloquear todos los PRs de una organizacion si los thresholds se interpretan diferente. Documentar la migracion permite a los admins preparar el cambio antes de actualizar. Sin MAJOR bump, los auto-updates de Forge pueden instalar un cambio destructivo sin warning.

**IMPLEMENTACION:**
```markdown
<!-- CHANGELOG.md -->
# Changelog

## [2.0.0] - 2025-01-15

### BREAKING CHANGES
- **Scoring engine**: Score range changed from 0-100 (numeric) to A-F (letter).
  - Admins must update `threshold.passingScore` from numeric (e.g., 70) to
    letter (e.g., "C") in project settings.
  - Existing Forge Storage entries with numeric scores are automatically
    migrated on first read.
- **Webhook payload**: `score.value` field changed from `number` to `string`.
  - Consumers of webhook events must update type definitions.

### Features
- Added inconsistency detection for linked Confluence pages.

### Bug Fixes
- Fixed false positive when Jira ticket has no description.
```

```yaml
# .github/workflows/release.yml
# semantic-release determina MAJOR/MINOR/PATCH basado en conventional commits
- name: Release
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
  run: npx semantic-release
```

**AUDITORIA:** Ralph verifica que CHANGELOG.md exista y que contenga una seccion `BREAKING CHANGES` para cada version MAJOR. Verifica que cada breaking change tenga instrucciones de migracion. Si una version MAJOR no tiene breaking changes documentados, o si existen breaking changes sin bump MAJOR, el check falla.

---

### GIT-CI-306

**DEFINICION:** El CHANGELOG.md debe generarse automaticamente a partir de los conventional commits usando `semantic-release` o `conventional-changelog`, sin edicion manual. Cada entrada debe incluir el tipo (feat/fix/chore), el scope (scoring/webhook/admin), y opcionalmente el ID de ticket de Jira.

**VALOR:** Un CHANGELOG manual se desincroniza rapidamente del codigo real. La generacion automatica desde conventional commits garantiza trazabilidad entre lo que cambio en el codigo y lo que se documento. Para Rovo Execution Guard, esto permite a los admins entender exactamente que cambio en el scoring engine en cada version.

**IMPLEMENTACION:**
```json
// package.json
{
  "scripts": {
    "changelog": "conventional-changelog -p angular -i CHANGELOG.md -s",
    "release": "npm run changelog && npm version"
  }
}
```

```javascript
// .releaserc.js
module.exports = {
  branches: ['main'],
  plugins: [
    ['@semantic-release/commit-analyzer', {
      preset: 'angular',
      releaseRules: [
        { type: 'feat', release: 'minor' },
        { type: 'fix', release: 'patch' },
        { type: 'perf', release: 'patch' },
        { breaking: true, release: 'major' },
        { type: 'chore', release: false },
      ],
    }],
    ['@semantic-release/release-notes-generator', {
      preset: 'angular',
    }],
    ['@semantic-release/changelog', {
      changelogFile: 'CHANGELOG.md',
    }],
    ['@semantic-release/npm', {
      npmPublish: false,
    }],
    ['@semantic-release/github', {
      assets: ['dist/**'],
    }],
  ],
};
```

**AUDITORIA:** Ralph verifica que CHANGELOG.md exista, que este actualizado con respecto a los commits recientes, y que las entradas sigan el formato tipo-scope-descripcion. Si CHANGELOG.md tiene entradas manuales que no corresponden a commits, o si falta CHANGELOG.md, el check falla.

---

### GIT-CI-307

**DEFINICION:** La version `0.x.x` esta reservada para desarrollo inicial (fase de construccion). El primer release estable debe ser `1.0.0` y solo debe publicarse cuando el scoring engine, la integracion con GitHub y la integracion con Rovo esten completos y con tests de integracion pasando.

**VALOR:** SemVer define que versiones `0.x.x` son para desarrollo inicial donde cualquier cambio puede ser breaking. Publicar `1.0.0` prematuramente compromete a mantener retrocompatibilidad antes de que la API sea estable. Para Rovo Execution Guard, `1.0.0` indica que la app esta lista para ser listada en el Atlassian Marketplace.

**IMPLEMENTACION:**
```json
// Durante desarrollo: package.json
{
  "version": "0.1.0"
}

// Despues de completar: scoring engine + github integration + rovo integration
// Cambiar a:
{
  "version": "1.0.0"
}
```

```yaml
# .github/workflows/release.yml
- name: Check 1.0.0 readiness
  if: steps.version.outputs.version == '1.0.0'
  run: |
    npm run test:integration
    npm run test:e2e
    npm run validate:manifest
```

**AUDITORIA:** Ralph verifica que durante la fase de desarrollo la version en `package.json` comience con `0.`. Verifica que no exista una version `1.0.0` sin que los tickets TASK-005 (scoring engine), TASK-011 (github adapter) y TASK-013 (rovo adapter) esten completos. Si se encuentra `1.0.0` sin los modulos core completos, el check falla.
