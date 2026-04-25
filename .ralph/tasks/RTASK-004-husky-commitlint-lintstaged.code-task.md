---
id: RTASK-004
title: 'Husky, Commitlint, lint-staged'
status: pending
priority: 2
type: infrastructure
dependencies: [RTASK-001, RTASK-003]
rulebook_refs: [GIT-CI-001, GIT-CI-002, GIT-CI-003]
spec: docs/tickets/TASK-004-husky-commitlint-lintstaged.md
---

# RTASK-004: Husky, Commitlint, lint-staged

## Objective

Set up git hooks as the first real quality gate: pre-commit (lint-staged), commit-msg (commitlint), and pre-push (typecheck + unit tests). These hooks enforce code quality and commit message format before code reaches the remote.

## Context

RTASK-001 set up package.json, RTASK-003 configured ESLint and Prettier. Now we wire them into git hooks so that every commit and push is validated automatically.

## Technical Specification

### 1. Husky Setup

```bash
npm install -D husky
npx husky init
```

### 2. `.husky/pre-commit`

```bash
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

npx lint-staged
```

### 3. `.husky/commit-msg`

```bash
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

npx commitlint --edit "$1"
```

### 4. `.husky/pre-push`

```bash
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

echo "Running typecheck..."
npm run typecheck
echo "Running critical unit tests..."
npm run test:unit -- --findRelatedTests
```

### 5. `commitlint.config.js`

- Extends: `@commitlint/config-conventional`
- Custom parser with regex: `^(\w*)(?:\(([\w\$\.\-\* ]*)\))?\!?\:\s(.+)\s\[(REG-\d+)\]$`
- Enforces: type(scope): description [REG-XXX] format
- Rules: references always required, subject max 100 chars

### 6. `.lintstagedrc.json`

```json
{
  "*.{ts,tsx}": ["eslint --fix", "prettier --write"],
  "*.{json,md}": ["prettier --write"]
}
```

### 7. npm scripts (add to package.json)

- `prepare`: `husky`
- `test:unit`: `jest --coverage`
- `test:staged`: `jest --findRelatedTests`

### 8. Additional dependencies

- `@commitlint/cli`
- `@commitlint/config-conventional`

## Acceptance Criteria

- [ ] AC-01: `husky` in devDependencies
- [ ] AC-02: `@commitlint/cli` and `@commitlint/config-conventional` installed
- [ ] AC-03: `npm run prepare` installs hooks without error
- [ ] AC-04: `.husky/pre-commit` exists and runs `lint-staged`
- [ ] AC-05: `.husky/commit-msg` exists and runs `commitlint`
- [ ] AC-06: `.husky/pre-push` exists and runs typecheck + tests
- [ ] AC-07: Regex accepts: `feat(scope): description [REG-123]`
- [ ] AC-08: Regex rejects: `feat: description` (no JIRA-ID)
- [ ] AC-09: Regex rejects: `update stuff [REG-123]` (invalid type)
- [ ] AC-10: `.lintstagedrc.json` exists with ts and json/md rules
- [ ] AC-11: Sidecar `hooks.reqs.md` created

## Triple Deliverable

Config files with sidecar:

| File                   | Sidecar              |
| ---------------------- | -------------------- |
| `.husky/*` hooks       | `hooks.reqs.md`      |
| `commitlint.config.js` | `commitlint.reqs.md` |
| `.lintstagedrc.json`   | `lintstaged.reqs.md` |

## Risks

| Risk                | Mitigation                                  |
| ------------------- | ------------------------------------------- |
| Hooks don't install | Verify with `npm run prepare` + manual test |
| Regex too strict    | Test with multiple commit formats           |
| lint-staged slow    | Only processes staged files, not full suite |

## QA Gates

### Pre-Implementation Gates

- [ ] **GATE-READY**: All dependencies (RTASK-001, RTASK-003) are completed
- [ ] **GATE-SPEC**: Rulebook sections GIT-CI-001, GIT-CI-002, GIT-CI-003 have been read and understood
- [ ] **GATE-DESIGN**: Implementation approach documented before coding

### Implementation Gates (per file/function)

- [ ] **GATE-RED**: Write failing test FIRST for each function/component
- [ ] **GATE-GREEN**: Write minimum code to make test pass
- [ ] **GATE-REFACTOR**: Clean up code while keeping tests green

### Post-Implementation Gates

- [ ] **GATE-TYPECHECK**: `npm run typecheck` passes with zero errors
- [ ] **GATE-LINT**: `npm run lint` passes with zero warnings
- [ ] **GATE-FORMAT**: `npm run format:check` passes
- [ ] **GATE-TEST**: `npm run test:unit` passes with coverage > N/A (git hooks config)
- [ ] **GATE-REQS**: All `.reqs.md` sidecar files created and complete
- [ ] **GATE-ZERO-ANY**: `grep -r "any" src/` returns zero results (no `any` types)

## Requirements Creation Protocol

For each production file, the builder MUST create a `.reqs.md` sidecar:

1. **Before implementation**: Create `.reqs.md` listing all requirements from the spec
2. **Format**: Use `.ralph/templates/reqs-template.md` format
3. **Content**: Each requirement maps to an acceptance criterion and rulebook rule
4. **Traceability**: Every AC in the task maps to at least one section in the sidecar
5. **Location**: Sidecar lives adjacent to the production file (same directory)

## Implementation Protocol

### Step 1: Preparation

1. Read the full task spec (`docs/tickets/TASK-004-husky-commitlint-lintstaged.md`)
2. Read referenced rulebook sections (`/RULEBOOK.md` → GIT-CI-001, GIT-CI-002, GIT-CI-003)
3. Read all dependency task outputs to understand available interfaces
4. Create `.reqs.md` sidecar files with requirements traceability

### Step 2: TDD Cycle (per function/component)

1. **RED**: Write a failing test that defines expected behavior
2. **GREEN**: Write the minimum code to make the test pass
3. **REFACTOR**: Clean up while keeping all tests green
4. Repeat for next function/component

### Step 3: Integration

1. Wire components together
2. Add integration-level tests if applicable
3. Verify all exports are accessible from barrel files

### Step 4: Validation

1. Run `npm run typecheck` — must pass
2. Run `npm run lint` — must pass with zero warnings
3. Run `npm run format:check` — must pass
4. Run `npm run test:unit` — must pass
5. Verify zero `any` usage

## Auditing Protocol

### Critic Review Checklist

- [ ] All acceptance criteria verified as implemented
- [ ] No `any` types anywhere in new code
- [ ] All interfaces use `readonly` properties
- [ ] Error handling follows hierarchy (REGError → domain errors)
- [ ] Structured logging with `executionId` on all operations
- [ ] No hardcoded secrets, tokens, or credentials
- [ ] Input validation on all external-facing functions
- [ ] Triple deliverable complete: `.ts` + `.reqs.md` + `.spec.ts`
- [ ] No code outside specified file locations
- [ ] Dependencies only on completed RTASK modules
- [ ] Rulebook rules GIT-CI-001, GIT-CI-002, GIT-CI-003 are satisfied

### Rejection Criteria

The critic MUST reject if:

- Any `any` type is present
- Coverage is below the required threshold (N/A — git hooks config)
- A `.reqs.md` sidecar is missing
- A `.spec.ts` test file is missing (where applicable)
- Structured logging is absent
- Error handling is missing or generic (`catch (e) { }`)
- External dependencies were added without approval

## Testing Protocol

### Config Validation

- Config files: .husky/\*, commitlint.config.js, .lintstagedrc.json
- Validated by: `npm run prepare`, manual commit tests
- Task type: infrastructure (git hooks)
- No unit tests required — validation is tool-based

### Validation Checklist

- [ ] `npm run prepare` installs hooks without error
- [ ] `.husky/pre-commit` exists and runs `lint-staged`
- [ ] `.husky/commit-msg` exists and runs `commitlint`
- [ ] `.husky/pre-push` exists and runs typecheck + tests
- [ ] Regex accepts: `feat(scope): description [REG-123]`
- [ ] Regex rejects: `feat: description` (no JIRA-ID)
- [ ] Regex rejects: `update stuff [REG-123]` (invalid type)
