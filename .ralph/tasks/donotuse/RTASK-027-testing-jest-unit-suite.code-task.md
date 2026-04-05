---
id: RTASK-027
title: "Testing - Jest Unit Test Suite"
status: pending
priority: 3
type: testing
dependencies: [RTASK-006, RTASK-007, RTASK-013, RTASK-021, RTASK-009, RTASK-010, RTASK-011]
rulebook_refs: [TEST-QA-001, TEST-QA-002, TEST-QA-003]
spec: docs/tickets/TASK-027-testing-jest-unit-suite.md
---

# RTASK-027: Testing - Jest Unit Suite

## Objective
Implement a comprehensive Jest unit test suite that mirrors the `src/backend/` structure, achieving high coverage thresholds across all domain modules and adapters with proper TypeScript support.

## Context
The project requires rigorous unit testing to ensure correctness of the scoring engine, inconsistency detection, resilience patterns, and all external adapter integrations. Tests must be co-located with the source structure, use mocked dependencies, and enforce strict coverage thresholds to prevent regression.

## Technical Specification

### Test Location
- `tests/unit/` directory mirroring the `src/backend/` structure

### Jest Configuration (`jest.config.js`)
- Test runner: `ts-jest` with TypeScript support
- Test environment: `node`
- Path aliases: configured to match project `tsconfig.json` paths
- Coverage thresholds:
  - **Global**: 85% across branches, functions, lines, and statements
  - **scoring/ directory**: 90% minimum coverage

### Test Files
- `scoring-engine.spec.ts` - Scoring algorithm unit tests
- `inconsistency-detector.spec.ts` - Inconsistency detection logic tests
- `resilience.spec.ts` - Resilience patterns (retry, circuit breaker, fallback) tests
- `logger.spec.ts` - Logging utility tests
- `jira/*.spec.ts` - Jira adapter unit tests with mocked HTTP calls
- `github/*.spec.ts` - GitHub adapter unit tests with mocked HTTP calls
- `rovo/*.spec.ts` - Rovo adapter unit tests with mocked HTTP calls

### NPM Scripts
- `test:unit` - Runs `jest --coverage`
- `test:unit:watch` - Runs Jest in watch mode
- `test:unit:ci` - Runs Jest with CI-friendly output and coverage reporting

## Acceptance Criteria
- [ ] Jest is configured with TypeScript via `ts-jest`
- [ ] Coverage in `scoring/` directory exceeds 90%
- [ ] Global coverage exceeds 85%
- [ ] All domain modules (scoring, inconsistency, resilience, logger) are tested
- [ ] All adapters (Jira, GitHub, Rovo) are tested with mocked dependencies
- [ ] Resilience and logger modules achieve >90% coverage
- [ ] `npm run test:unit` passes with all tests green
- [ ] Coverage report is generated in `coverage/` directory
- [ ] `.reqs.md` sidecar file is maintained

## Triple Deliverable
1. **Source**: `jest.config.js`, all `*.spec.ts` test files under `tests/unit/`
2. **Tests**: The test suite itself is the primary deliverable; self-validating via `npm run test:unit`
3. **Documentation**: Coverage report in `coverage/`; testing guidelines in `docs/tickets/TASK-027-testing-jest-unit-suite.md`; updated `.reqs.md` sidecar

## Risks
- Test mocking strategy for external APIs (Jira, GitHub, Rovo) must be carefully designed to avoid brittle tests
- Achieving 90% coverage in scoring may require testing edge cases and boundary conditions that are not immediately obvious
- `ts-jest` path alias configuration must stay in sync with `tsconfig.json` to avoid resolution errors
- Watch mode may have performance issues on large test suites

## QA Gates

### Pre-Implementation Gates
- [ ] **GATE-READY**: All dependencies ([RTASK-006, RTASK-007, RTASK-013, RTASK-021, RTASK-009, RTASK-010, RTASK-011]) are completed
- [ ] **GATE-SPEC**: Rulebook sections TEST-QA-001, TEST-QA-002, TEST-QA-003 have been read and understood
- [ ] **GATE-DESIGN**: Implementation approach documented before coding

### Implementation Gates (per test file)
- [ ] **GATE-RED**: Write failing test FIRST for each function/component
- [ ] **GATE-GREEN**: Write minimum code to make test pass
- [ ] **GATE-REFACTOR**: Clean up code while keeping tests green

### Post-Implementation Gates
- [ ] **GATE-TYPECHECK**: `npm run typecheck` passes with zero errors
- [ ] **GATE-LINT**: `npm run lint` passes with zero warnings
- [ ] **GATE-FORMAT**: `npm run format:check` passes
- [ ] **GATE-TEST**: `npm run test:unit` passes with coverage > 85% global, 90% scoring/
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
1. Read the full task spec (`docs/tickets/TASK-027-testing-jest-unit-suite.md`)
2. Read referenced rulebook sections (`docs/rulebook/RULEBOOK.md` → TEST-QA-001, TEST-QA-002, TEST-QA-003)
3. Read all dependency task outputs to understand available interfaces
4. Create `.reqs.md` sidecar files with requirements traceability

### Step 2: TDD Cycle (per test file)
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
4. Run `npm run test:unit` — must pass with > 85% global coverage, > 90% scoring/ coverage
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
- [ ] Rulebook rules TEST-QA-001, TEST-QA-002, TEST-QA-003 are satisfied

### Rejection Criteria
The critic MUST reject if:
- Any `any` type is present
- Coverage is below the required threshold (85% global, 90% scoring/)
- A `.reqs.md` sidecar is missing
- A `.spec.ts` test file is missing
- Structured logging is absent
- Error handling is missing or generic (`catch (e) { }`)
- External dependencies were added without approval

## Testing Protocol

### Self-Validating Test Suite
- **The test suite IS the deliverable** — this is a meta-task that creates test infrastructure
- Location: `tests/unit/` (test files)
- Self-validation: `npm run test:unit`
- Coverage target: 85% global, 90% scoring/

### Test Categories Required
- [ ] **Happy path**: Primary function works with valid inputs
- [ ] **Error handling**: Function handles errors gracefully
- [ ] **Edge cases**: Empty inputs, null/undefined, boundary values
- [ ] **Integration points**: Mocked adapter/service calls work correctly

### Mock Strategy
- Mock all external APIs (Jira, Confluence, Rovo, GitHub)
- Mock `@forge/api` and `@forge/resolver` calls
- Use `jest.fn()` for function mocks, not hand-rolled stubs
- Reset mocks between tests (`beforeEach`)
