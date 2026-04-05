---
id: RTASK-001
title: "Project Foundation and Forge Manifest"
status: pending
priority: 1
type: infrastructure
dependencies: []
rulebook_refs: [FORGE-OPS-001, FORGE-OPS-002, ARCH-SOLID-001]
spec: docs/tickets/TASK-001-project-foundation.md
---

# RTASK-001: Project Foundation and Forge Manifest

## Objective

Set up the complete project foundation: Forge manifest, package.json with all dependencies, tsconfig.json with strict mode and path aliases, and .nvmrc for Node version pinning. This is a BLOCKER — nothing else can start without this.

## Context

This is an Atlassian Forge app ("Rovo Execution Guard") that validates consistency between Jira, Confluence, and GitHub using Rovo AI, blocking low-quality workflow transitions. The project skeleton exists with empty directories and `.gitkeep` files.

## Technical Specification

### 1. `.nvmrc`
- Content: `22`

### 2. `package.json`
- **Dependencies**: `@forge/react@10`, `react@18`, `@forge/api`, `@forge/resolver`
- **DevDependencies**: `typescript`, `jest`, `ts-jest`, `@types/react`, `@types/jest`, `@testing-library/react`, `eslint`, `prettier`, `husky`, `@commitlint/cli`, `@commitlint/config-conventional`, `lint-staged`, `@typescript-eslint/parser`, `@typescript-eslint/eslint-plugin`, `eslint-config-prettier`, `eslint-plugin-react`, `eslint-plugin-react-hooks`, `eslint-import-resolver-typescript`
- **Engines**: `"node": ">=22.0.0"`
- **Scripts**: `lint`, `lint:fix`, `format`, `format:check`, `typecheck`, `test:unit`, `test:staged`, `prepare`

### 3. `tsconfig.json`
- `strict: true`, `noUncheckedIndexedAccess: true`, `noImplicitReturns: true`
- Target: `ES2022`, Module: `ESNext`, ModuleResolution: `bundler`
- Path aliases: `@domain/*` -> `src/backend/*`, `@services/*` -> `src/backend/services/*`, `@resolvers/*` -> `src/backend/resolvers/*`, `@frontend/*` -> `src/frontend/*`, `@shared/*` -> `src/frontend/shared/*`

### 4. `manifest.yml`
- App name: `rovo-execution-guard`
- Modules: `jira:issuePanel`, `jira:adminPage`, `trigger` (Jira workflow transition), `webtrigger` (GitHub webhook)
- Scopes: `read:jira-work`, `write:jira-work`, `read:confluence-content`, `write:confluence-content`, `storage:app`
- External fetch: `api.github.com`

## Acceptance Criteria

- [ ] AC-01: `.nvmrc` exists with `22`
- [ ] AC-02: `package.json` has engines.node >= 22 and all required dependencies
- [ ] AC-03: `npm install` completes without errors
- [ ] AC-04: `tsconfig.json` has `strict: true` and all 5 path aliases
- [ ] AC-05: `npx tsc --noEmit` passes (validates aliases and strict mode)
- [ ] AC-06: `manifest.yml` has jira:issuePanel, jira:adminPage, trigger, webtrigger
- [ ] AC-07: Scopes follow least privilege (only what's needed)
- [ ] AC-08: External fetch configured for `api.github.com`
- [ ] AC-09: `manifest.reqs.md` created with acceptance criteria
- [ ] AC-10: No file beyond what's specified (no over-engineering)

## Triple Deliverable

| File | Sidecar | Test |
|------|---------|------|
| `manifest.yml` | `manifest.reqs.md` | (validated by `forge lint`) |
| `package.json` | - | (validated by `npm install`) |
| `tsconfig.json` | - | (validated by `tsc --noEmit`) |

## Risks

| Risk | Mitigation |
|------|------------|
| Forge scopes insufficient | Review against full spec before deploy |
| Path aliases misconfigured | Validate with `tsc --noEmit` |
| Node version incompatible | Pin 22.x in `.nvmrc` and `engines` |

## QA Gates

### Pre-Implementation Gates
- [ ] **GATE-READY**: All dependencies (none — this is a root task) are completed
- [ ] **GATE-SPEC**: Rulebook sections FORGE-OPS-001, FORGE-OPS-002, ARCH-SOLID-001 have been read and understood
- [ ] **GATE-DESIGN**: Implementation approach documented before coding

### Implementation Gates (per file/function)
- [ ] **GATE-RED**: Write failing test FIRST for each function/component
- [ ] **GATE-GREEN**: Write minimum code to make test pass
- [ ] **GATE-REFACTOR**: Clean up code while keeping tests green

### Post-Implementation Gates
- [ ] **GATE-TYPECHECK**: `npm run typecheck` passes with zero errors
- [ ] **GATE-LINT**: `npm run lint` passes with zero warnings
- [ ] **GATE-FORMAT**: `npm run format:check` passes
- [ ] **GATE-TEST**: `npm run test:unit` passes with coverage > 85%
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
1. Read the full task spec (`docs/tickets/TASK-001-project-foundation.md`)
2. Read referenced rulebook sections (`docs/rulebook/RULEBOOK.md` → FORGE-OPS-001, FORGE-OPS-002, ARCH-SOLID-001)
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
4. Run `npm run test:unit` — must pass with > 85% coverage
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
- [ ] Rulebook rules FORGE-OPS-001, FORGE-OPS-002, ARCH-SOLID-001 are satisfied

### Rejection Criteria
The critic MUST reject if:
- Any `any` type is present
- Coverage is below the required threshold (85%)
- A `.reqs.md` sidecar is missing
- A `.spec.ts` test file is missing (where applicable)
- Structured logging is absent
- Error handling is missing or generic (`catch (e) { }`)
- External dependencies were added without approval

## Testing Protocol

### Config Validation
- Config files: manifest.yml, package.json, tsconfig.json
- Validated by: `forge lint`, `npm install`, `tsc --noEmit`
- Task type: infrastructure (config files, no .spec.ts tests)
- No unit tests required — validation is tool-based

### Validation Checklist
- [ ] `forge lint` passes on manifest.yml
- [ ] `npm install` completes without errors
- [ ] `tsc --noEmit` passes with strict mode and path aliases
- [ ] All npm scripts defined in package.json execute without crash
