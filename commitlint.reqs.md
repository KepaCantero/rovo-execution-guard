# REQUISITOS: commitlint.config.js

> **Sidecar File** | Vinculado a: `commitlint.config.js`

---

## Descripcion

Commitlint configuration for Rovo Execution Guard. Enforces conventional commit format with mandatory JIRA ticket reference in `[REG-XXX]` format. Validates commit messages against project standards before they enter the git history.

---

## Acceptance Criteria

- [x] **AC-02**: `@commitlint/cli` and `@commitlint/config-conventional` installed
- [x] **AC-05**: `.husky/commit-msg` exists and runs `commitlint`
- [x] **AC-07**: Regex accepts: `feat(scope): description [REG-123]`
- [x] **AC-08**: Regex rejects: `feat: description` (no JIRA-ID)
- [x] **AC-09**: Regex rejects: `update stuff [REG-123]` (invalid type)

---

## Reglas del Rulebook

| ID Regla     | Categoria   | Descripcion breve                                                                      |
| ------------ | ----------- | -------------------------------------------------------------------------------------- |
| [GIT-CI-205] | Git & CI/CD | commit-msg hook must invoke commitlint with conventional commits + project scope rules |
| [GIT-CI-211] | Git & CI/CD | Commit messages must follow Conventional Commits format                                |
| [GIT-CI-212] | Git & CI/CD | Scope must correspond to valid project module                                          |
| [GIT-CI-213] | Git & CI/CD | Subject must include Jira ID in PROJECTKEY-NNN format for functional commits           |
| [GIT-CI-214] | Git & CI/CD | Subject line max 72 characters                                                         |
| [GIT-CI-308] | Git & CI/CD | Every commit must follow Conventional Commits format                                   |

---

## Configuration Details

### Parser Preset

| Setting          | Value                                                      | Purpose                                      |
| ---------------- | ---------------------------------------------------------- | -------------------------------------------- |
| headerPattern    | `^(\w*)(?:\(([\w\$\.\-\* ]*)\))?!?:\s(.+)\s\[(REG-\d+)\]$` | Matches `type(scope): description [REG-XXX]` |
| referencePattern | `REG-\d+`                                                  | Extracts JIRA ticket reference               |
| issuePrefixes    | `['REG-']`                                                 | Project-specific ticket prefix               |

### headerPattern Capture Groups

| Group         | Matches          | Example                |
| ------------- | ---------------- | ---------------------- |
| 1 (type)      | `\w+`            | `feat`, `fix`, `chore` |
| 2 (scope)     | `[\w\$\.\-\* ]*` | `core`, `api`, `ui`    |
| 3 (subject)   | `.+`             | Description text       |
| 4 (reference) | `REG-\d+`        | `REG-123`              |

### Rules

| Rule               | Level     | Value                                        | Purpose                           |
| ------------------ | --------- | -------------------------------------------- | --------------------------------- |
| references-empty   | error (2) | never                                        | Must include REG-XXX reference    |
| subject-max-length | error (2) | always, 100                                  | Subject must not exceed 100 chars |
| type-enum          | error (2) | always, [list]                               | Only allowed commit types         |
| subject-case       | error (2) | never, [start-case, pascal-case, upper-case] | Disallow certain casing           |
| subject-empty      | error (2) | never                                        | Subject must not be empty         |
| type-case          | error (2) | always, lower-case                           | Type must be lowercase            |

### Allowed Types

| Type     | Usage                   |
| -------- | ----------------------- |
| feat     | New feature             |
| fix      | Bug fix                 |
| refactor | Code restructuring      |
| perf     | Performance improvement |
| test     | Test additions/changes  |
| docs     | Documentation           |
| style    | Formatting only         |
| build    | Build system changes    |
| ci       | CI/CD changes           |
| chore    | Maintenance tasks       |
| revert   | Revert previous commit  |

### Validation Examples

| Input                                 | Result | Reason                                |
| ------------------------------------- | ------ | ------------------------------------- |
| `feat(scope): add feature [REG-123]`  | PASS   | Valid format                          |
| `fix(api): resolve timeout [REG-456]` | PASS   | Valid format                          |
| `feat: description`                   | FAIL   | Missing [REG-XXX] reference           |
| `update stuff [REG-123]`              | FAIL   | Invalid type, missing colon separator |
| `feat(scope): description`            | FAIL   | Missing [REG-XXX] reference           |

---

## Estrategia de Test

- Validated by: `npx commitlint --edit` with test commit messages
- Manual validation: test with valid and invalid commit message formats
- No unit tests — config file validation is tool-based

---

## Historial de Cambios

| Fecha      | Tarea Ralph | Cambio                                               |
| ---------- | ----------- | ---------------------------------------------------- |
| 2026-04-05 | RTASK-004   | Created sidecar documenting commitlint configuration |
