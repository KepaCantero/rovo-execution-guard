# TASK-026: CI/CD - Semantic Release and Versioning

## Objetivo
Implementar el versionado semantico automatizado usando Semantic Release, con generacion automatica de CHANGELOG.md y GitHub Releases.

## Contexto
El versionado automatizado asegura que cada cambio de nivel (major/minor/patch) se refleje correctamente en el manifest.yml de Forge y en el package.json.

## Especificacion Tecnica

### Ubicacion
Config en raiz del proyecto

### Configuracion

#### Semantic Release (`.releaserc.json`)
- Plugins:
  - `@semantic-release/commit-analyzer`: Analiza conventional commits
  - `@semantic-release/release-notes-generator`: Genera notas
  - `@semantic-release/changelog`: Genera `CHANGELOG.md`
  - `@semantic-release/npm`: Actualiza `package.json`
  - `@semantic-release/github`: Crea GitHub Release
  - Custom plugin: Actualiza `manifest.yml` version

#### Reglas de versionado
- `feat:` -> MINOR (1.1.0)
- `fix:` -> PATCH (1.0.1)
- `BREAKING CHANGE:` -> MAJOR (2.0.0)
- `chore:`, `docs:`, `style:`, `refactor:` -> Sin release

#### `.forge-versions.json`
```json
{
  "current": "1.0.0",
  "lastStable": "1.0.0",
  "environments": {
    "development": "1.1.0-dev.1",
    "staging": "1.0.0",
    "production": "1.0.0"
  }
}
```

#### Git hooks
- `pre-commit`: commitlint valida formato
- CI: semantic-release ejecuta solo en merge a main

## Acceptance Criteria
- [ ] AC-01: Semantic Release configurado y funcional
- [ ] AC-02: `feat:` genera version MINOR
- [ ] AC-03: `fix:` genera version PATCH
- [ ] AC-04: `BREAKING CHANGE:` genera version MAJOR
- [ ] AC-05: `CHANGELOG.md` generado automaticamente
- [ ] AC-06: GitHub Release creada con notas
- [ ] AC-07: `manifest.yml` version actualizada
- [ ] AC-08: `.forge-versions.json` actualizado
- [ ] AC-09: Archivo `.reqs.md` sidecar creado

## Reglas del Rulebook
- **[GIT-CI-007]**: Versionado SemVer automatizado
- **[GIT-CI-001]**: Conventional Commits obligatorios

## Estrategia de Test
- **Unit**: N/A (tooling config)
- **Integration**: Simular merge con feat y verificar version
- **E2E**: Release real a GitHub

## Dependencias
- TASK-004 (commitlint para conventional commits)
- TASK-025 (pipeline de deploy)

## Estado: PENDIENTE
