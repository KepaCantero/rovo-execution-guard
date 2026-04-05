---
id: RTASK-006
title: "Domain Layer - Scoring Engine"
status: pending
priority: 2
type: domain
dependencies: [RTASK-005]
rulebook_refs: [ARCH-SOLID-001, ARCH-SOLID-002, TEST-QA-001, ROVO-INTEG-001]
spec: docs/tickets/TASK-006-domain-scoring-engine.md
---

# RTASK-006: Domain Layer - Scoring Engine

## Objective

Implement a pure domain scoring engine that calculates consistency scores across 5 axes and evaluates quality gates for ticket lifecycle transitions. The engine must operate with zero external dependencies, producing deterministic, reproducible results.

## Context

The scoring engine is the core analytical component of the execution guard. It receives ticket data and contextual information, produces a multi-axis consistency score, and evaluates whether tickets meet quality thresholds at each lifecycle gate (Definition, Execution, Delivery). This task depends on RTASK-005 for domain types and models.

## Technical Specification

### Location

`src/backend/services/scoring/`

### Core Functions

- `calculateScore(ticket, context) -> ConsistencyScore`
  - Accepts a ticket object and optional context data.
  - Returns a `ConsistencyScore` containing individual axis scores and an overall weighted score.
  - Generates a unique `executionId` for each scoring run.

- `evaluateQualityGate(score, config) -> QualityGateResult`
  - Accepts a `ConsistencyScore` and gate configuration.
  - Returns a `QualityGateResult` indicating pass/fail with detailed reasoning.

### Score Axes (0-100 each)

| Axis           | Weight | Description                                        |
|----------------|--------|----------------------------------------------------|
| Clarity        | 25%    | How clear and unambiguous the ticket description is |
| Consistency    | 25%    | Alignment between title, description, and criteria  |
| Risk           | 20%    | Presence or absence of risk indicators             |
| Documentation  | 15%    | Completeness of documentation and references       |
| TechnicalDebt  | 15%    | Indicators of technical debt in the ticket scope    |

- Overall score = weighted average of all axes.
- Weights are configurable via `ProjectConfig` and must default to the values above.

### Quality Gates

1. **Definition Gate**: Score >= configurable threshold (default 80). Blocks transition to "In Progress".
2. **Execution Gate**: No critical unresolved inconsistencies. Used as PR status check; sets status to failure if gate fails.
3. **Delivery Gate**: Cross-validation of PR content against historical context. Blocks merge.

### Error Types

- `ScoringError`: Base error for scoring failures.
- `InsufficientDataError`: Thrown when ticket lacks minimum data for scoring.

### Constraints

- Zero external dependencies. Pure domain logic only.
- All scoring must be deterministic given the same input.
- Must include a `.reqs.md` sidecar file documenting requirements traceability.

## Acceptance Criteria

1. `calculateScore` returns scores in the 0-100 range for all 5 axes and overall score.
2. Weighted average is configurable via `ProjectConfig` with sensible defaults.
3. All 3 quality gates (Definition, Execution, Delivery) evaluate correctly.
4. Each scoring run produces a unique `executionId`.
5. Custom error types (`ScoringError`, `InsufficientDataError`) are implemented and used.
6. Zero external dependencies in the scoring module.
7. Test coverage exceeds 90%.
8. `.reqs.md` sidecar file is created with requirements traceability.

## Triple Deliverable

- **Source Code**: `src/backend/services/scoring/scoring-engine.ts` with scoring logic and quality gate evaluation.
- **Tests**: `src/backend/services/scoring/__tests__/scoring-engine.test.ts` with >90% coverage.
- **Requirements**: `src/backend/services/scoring/scoring-engine.reqs.md` sidecar file.

## Risks

- **Score calibration**: Initial axis weights may not reflect real-world priorities. Mitigate with configurable weights and iterative tuning.
- **Insufficient data edge cases**: Tickets with minimal content may produce unreliable scores. Mitigate with `InsufficientDataError` and minimum data thresholds.
- **Determinism requirement**: Floating-point arithmetic could cause non-determinism across environments. Mitigate with integer-based scoring or fixed-precision rounding.

## QA Gates

### Pre-Implementation Gates
- [ ] **GATE-READY**: All dependencies (RTASK-005) are completed
- [ ] **GATE-SPEC**: Rulebook sections ARCH-SOLID-001, ARCH-SOLID-002, TEST-QA-001, ROVO-INTEG-001 have been read and understood
- [ ] **GATE-DESIGN**: Implementation approach documented before coding

### Implementation Gates (per file/function)
- [ ] **GATE-RED**: Write failing test FIRST for each function/component
- [ ] **GATE-GREEN**: Write minimum code to make test pass
- [ ] **GATE-REFACTOR**: Clean up code while keeping tests green

### Post-Implementation Gates
- [ ] **GATE-TYPECHECK**: `npm run typecheck` passes with zero errors
- [ ] **GATE-LINT**: `npm run lint` passes with zero warnings
- [ ] **GATE-FORMAT**: `npm run format:check` passes
- [ ] **GATE-TEST**: `npm run test:unit` passes with coverage > 90%
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
1. Read the full task spec (`docs/tickets/TASK-006-domain-scoring-engine.md`)
2. Read referenced rulebook sections (`docs/rulebook/RULEBOOK.md` → ARCH-SOLID-001, ARCH-SOLID-002, TEST-QA-001, ROVO-INTEG-001)
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
4. Run `npm run test:unit` — must pass with > 90% coverage
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
- [ ] Rulebook rules ARCH-SOLID-001, ARCH-SOLID-002, TEST-QA-001, ROVO-INTEG-001 are satisfied

### Rejection Criteria
The critic MUST reject if:
- Any `any` type is present
- Coverage is below the required threshold (90%)
- A `.reqs.md` sidecar is missing
- A `.spec.ts` test file is missing (where applicable)
- Structured logging is absent
- Error handling is missing or generic (`catch (e) { }`)
- External dependencies were added without approval

## Testing Protocol

### Unit Tests (`tests/unit/services/scoring/`)
- Location: Mirror production path under `tests/unit/`
- Naming: `[filename].spec.ts`
- Coverage target: 90%
- Pattern: Arrange-Act-Assert (AAA)
- Must test: Happy path, error paths, edge cases, boundary values

### Test Categories Required
- [ ] **Happy path**: Scoring algorithm produces correct weighted averages
- [ ] **Error handling**: `InsufficientDataError` thrown for minimal ticket data
- [ ] **Edge cases**: Score 0, score 100, missing optional fields, boundary values
- [ ] **Integration points**: Quality gate evaluation with mocked scoring results

### Mock Strategy
- No external dependencies to mock — pure domain logic
- Use deterministic test fixtures for scoring inputs
- Reset mocks between tests (`beforeEach`)
