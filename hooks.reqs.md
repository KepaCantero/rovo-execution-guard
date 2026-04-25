# REQUISITOS: .husky/\* (Git Hooks)

> **Sidecar File** | Vinculado a: `.husky/pre-commit`, `.husky/commit-msg`, `.husky/pre-push`

---

## Descripcion

Husky git hooks for Rovo Execution Guard. Three hooks enforce quality gates: pre-commit (lint-staged), commit-msg (commitlint), and pre-push (typecheck + unit tests). These hooks are the first automated quality barrier before code reaches the remote.

---

## Acceptance Criteria

- [x] **AC-01**: `husky` in devDependencies
- [x] **AC-03**: `npm run prepare` installs hooks without error
- [x] **AC-04**: `.husky/pre-commit` exists and runs `lint-staged`
- [x] **AC-05**: `.husky/commit-msg` exists and runs `commitlint`
- [x] **AC-06**: `.husky/pre-push` exists and runs typecheck + tests
- [x] **AC-11**: Sidecar `hooks.reqs.md` created

---

## Reglas del Rulebook

| ID Regla        | Categoria   | Descripcion breve                                                                                |
| --------------- | ----------- | ------------------------------------------------------------------------------------------------ |
| [GIT-CI-201]    | Git & CI/CD | pre-commit hook must run lint-staged with ESLint --fix and Prettier --write only on staged files |
| [GIT-CI-202]    | Git & CI/CD | pre-push hook must run unit tests with jest --changedSince and coverage thresholds               |
| [GIT-CI-203]    | Git & CI/CD | Husky hooks must be installed via `prepare` script in package.json                               |
| [GIT-CI-204]    | Git & CI/CD | Prohibit `--no-verify` in documented workflows                                                   |
| [GIT-CI-205]    | Git & CI/CD | commit-msg hook must invoke commitlint with conventional commits + project scope rules           |
| [GIT-CI-044-02] | Git & CI/CD | Prettier must run as pre-commit hook via lint-staged, formatting only staged files               |

---

## Configuration Details

### `.husky/pre-commit`

| Setting      | Value                                                       |
| ------------ | ----------------------------------------------------------- |
| Shell        | `#!/usr/bin/env sh`                                         |
| Husky source | `. "$(dirname -- "$0")/_/husky.sh"`                         |
| Command      | `npx lint-staged`                                           |
| Purpose      | Runs ESLint --fix and Prettier --write on staged files only |

### `.husky/commit-msg`

| Setting      | Value                                                                       |
| ------------ | --------------------------------------------------------------------------- |
| Shell        | `#!/usr/bin/env sh`                                                         |
| Husky source | `. "$(dirname -- "$0")/_/husky.sh"`                                         |
| Command      | `npx --no-install commitlint --edit "$1"`                                   |
| Purpose      | Validates commit message follows conventional format with REG-XXX reference |

### `.husky/pre-push`

| Setting      | Value                                                                |
| ------------ | -------------------------------------------------------------------- |
| Shell        | `#!/usr/bin/env sh`                                                  |
| Husky source | `. "$(dirname -- "$0")/_/husky.sh"`                                  |
| Command 1    | `npm run typecheck`                                                  |
| Command 2    | `npm run test:unit -- --findRelatedTests`                            |
| Purpose      | Runs TypeScript compilation check and related unit tests before push |

### package.json scripts

| Script        | Value                                                           | Purpose                             |
| ------------- | --------------------------------------------------------------- | ----------------------------------- |
| `prepare`     | `husky`                                                         | Installs git hooks on `npm install` |
| `test:unit`   | `jest --passWithNoTests --config config/jest.config.js`         | Runs unit tests                     |
| `test:staged` | `jest --bail --findRelatedTests --config config/jest.config.js` | Runs tests for staged files         |

---

## Estrategia de Test

- Validated by: `npm run prepare` (installs hooks without error)
- Manual validation: create a test commit to verify hook execution
- No unit tests — hook scripts are infrastructure config

---

## Historial de Cambios

| Fecha      | Tarea Ralph | Cambio                                                    |
| ---------- | ----------- | --------------------------------------------------------- |
| 2026-04-05 | RTASK-004   | Created sidecar documenting Husky git hooks configuration |
