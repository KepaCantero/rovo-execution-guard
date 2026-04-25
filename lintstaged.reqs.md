# REQUISITOS: .lintstagedrc.json

> **Sidecar File** | Vinculado a: `.lintstagedrc.json`

---

## Descripcion

lint-staged configuration for Rovo Execution Guard. Runs ESLint and Prettier only on staged files, ensuring code quality without the overhead of full-project linting on every commit. Triggered by the `.husky/pre-commit` hook.

---

## Acceptance Criteria

- [x] **AC-04**: `.husky/pre-commit` exists and runs `lint-staged`
- [x] **AC-10**: `.lintstagedrc.json` exists with ts and json/md rules

---

## Reglas del Rulebook

| ID Regla        | Categoria   | Descripcion breve                                                                                |
| --------------- | ----------- | ------------------------------------------------------------------------------------------------ |
| [GIT-CI-201]    | Git & CI/CD | pre-commit hook must run lint-staged with ESLint --fix and Prettier --write only on staged files |
| [GIT-CI-044-02] | Git & CI/CD | Prettier must run as pre-commit hook via lint-staged, formatting only staged files               |

---

## Configuration Details

### File Patterns

| Glob Pattern  | Commands                           | Purpose                          |
| ------------- | ---------------------------------- | -------------------------------- |
| `*.{ts,tsx}`  | `eslint --fix`, `prettier --write` | Lint and format TypeScript files |
| `*.{json,md}` | `prettier --write`                 | Format JSON and Markdown files   |

### Execution Order

For TypeScript files (`.ts`, `.tsx`):

1. `eslint --fix` — Auto-fix linting issues
2. `prettier --write` — Enforce consistent formatting

For JSON and Markdown files:

1. `prettier --write` — Enforce consistent formatting

### Key Behaviors

| Behavior    | Description                                                              |
| ----------- | ------------------------------------------------------------------------ |
| Staged only | Only files staged for commit are processed                               |
| Auto-fix    | ESLint runs with `--fix` to auto-resolve fixable issues                  |
| Re-stage    | lint-staged automatically re-stages files modified by linting/formatting |
| Fail-fast   | If any command fails, the commit is aborted                              |

---

## Estrategia de Test

- Validated by: staging files and attempting a commit to verify lint-staged runs
- Manual validation: `npx lint-staged --diff="HEAD"` to test on staged files
- No unit tests — config file validation is tool-based

---

## Historial de Cambios

| Fecha      | Tarea Ralph | Cambio                                                |
| ---------- | ----------- | ----------------------------------------------------- |
| 2026-04-05 | RTASK-004   | Created sidecar documenting lint-staged configuration |
