---
id: RTASK-008
title: "Domain Layer - Quality Gate Rules Engine"
status: pending
priority: 2
type: domain
dependencies: [RTASK-005, RTASK-006, RTASK-007]
rulebook_refs: [ARCH-SOLID-002, ROVO-INTEG-001, GH-INTEG-001]
spec: docs/tickets/TASK-008-domain-quality-gate-rules.md
---

# RTASK-008: Domain Layer - Quality Gate Rules Engine

## Objective

Implement a configurable quality gate rules engine that enforces ticket quality standards at three lifecycle transitions (Definition, Execution, Delivery). The engine orchestrates scoring results and inconsistency detection to determine whether tickets can progress through their lifecycle.

## Context

The quality gate rules engine is the decision-making layer that ties together the scoring engine (RTASK-006) and inconsistency detector (RTASK-007). It evaluates gate conditions and produces enforcement actions that control ticket transitions. This task depends on RTASK-005 for domain types, RTASK-006 for scoring, and RTASK-007 for inconsistency detection.

## Technical Specification

### Location

`src/backend/services/scoring/`

### Core Functions

- `evaluateGate(gate, data) -> QualityGateResult`
  - Evaluates a specific gate using the provided data (scores, inconsistencies, config).
  - Returns a `QualityGateResult` with pass/fail status, reasons, and metadata.

- `determineEnforcementActions(result) -> EnforcementAction[]`
  - Given a `QualityGateResult`, determines what enforcement actions should be taken.
  - Returns an array of `EnforcementAction` objects (e.g., block transition, add comment, set PR status).

- `canTransition(ticketKey, targetStatus, config) -> Promise<boolean>`
  - High-level function that checks whether a ticket can transition to a target status.
  - Orchestrates gate evaluation based on the target transition.

### Gate Definitions

**Gate 1 - Definition Gate:**
- Condition: `score >= scoreThreshold` (default threshold: 80).
- Purpose: Ensures ticket quality before work begins.
- Enforcement: Blocks transition to "In Progress".
- Configuration: `scoreThreshold` is configurable via `ProjectConfig`.

**Gate 2 - Execution Gate:**
- Condition: No critical unresolved inconsistencies.
- Purpose: Ensures no blocking issues exist during execution.
- Enforcement: PR status check set to failure if gate fails.
- Configuration: `blockOnCritical` flag controls whether critical inconsistencies block.

**Gate 3 - Delivery Gate:**
- Condition: Cross-validation of PR content against historical context.
- Purpose: Ensures delivered work matches the original intent and documented decisions.
- Enforcement: Blocks merge.
- Configuration: `requireDocumentation` flag controls documentation cross-check.

### Configuration Options

| Option                | Type     | Default | Description                                    |
|-----------------------|----------|---------|------------------------------------------------|
| `scoreThreshold`      | number   | 80      | Minimum score to pass the Definition gate       |
| `blockOnCritical`     | boolean  | true    | Whether critical inconsistencies block execution |
| `requireDocumentation`| boolean  | true    | Whether documentation cross-check is required   |
| `enabledGates`        | string[] | all     | Which gates are active for the project          |

All configuration is managed via `ProjectConfig`.

### Constraints

- Zero external dependencies. Pure domain logic only.
- Gate evaluation must be deterministic given the same inputs.
- Must include a `.reqs.md` sidecar file documenting requirements traceability.

## Acceptance Criteria

1. All 3 gates (Definition, Execution, Delivery) are implemented and evaluate correctly.
2. `evaluateGate` returns a `QualityGateResult` with pass/fail status, reasons, and metadata.
3. `determineEnforcementActions` returns correct enforcement actions based on the gate result.
4. All rules are configurable via `ProjectConfig` (scoreThreshold, blockOnCritical, requireDocumentation, enabledGates).
5. Gate 1 blocks transition when score is below threshold.
6. Gate 2 blocks PR when critical inconsistencies are present.
7. Zero external dependencies in the quality gate module.
8. Test coverage exceeds 90%.
9. `.reqs.md` sidecar file is created with requirements traceability.

## Triple Deliverable

- **Source Code**: `src/backend/services/scoring/quality-gate-rules.ts` with gate evaluation, enforcement actions, and transition checking.
- **Tests**: `src/backend/services/scoring/__tests__/quality-gate-rules.test.ts` with >90% coverage.
- **Requirements**: `src/backend/services/scoring/quality-gate-rules.reqs.md` sidecar file.

## Risks

- **Gate calibration**: Default thresholds may be too strict or lenient for different project types. Mitigate with per-project configuration and iterative tuning.
- **Cross-validation complexity**: Delivery gate cross-validation between PR and historical context may have limited data. Mitigate with graceful degradation when historical data is insufficient.
- **Configuration explosion**: Too many configuration options could overwhelm users. Mitigate with sensible defaults and validation.

## QA Gates

### Pre-Implementation Gates
- [ ] **GATE-READY**: All dependencies (RTASK-005, RTASK-006, RTASK-007) are completed
- [ ] **GATE-SPEC**: Rulebook sections ARCH-SOLID-002, ROVO-INTEG-001, GH-INTEG-001 have been read and understood
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
1. Read the full task spec (`docs/tickets/TASK-008-domain-quality-gate-rules.md`)
2. Read referenced rulebook sections (`docs/rulebook/RULEBOOK.md` → ARCH-SOLID-002, ROVO-INTEG-001, GH-INTEG-001)
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
- [ ] Rulebook rules ARCH-SOLID-002, ROVO-INTEG-001, GH-INTEG-001 are satisfied

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
- [ ] **Happy path**: All 3 gates evaluate correctly with valid inputs
- [ ] **Error handling**: Missing config, invalid threshold values, empty data
- [ ] **Edge cases**: Score exactly at threshold, empty inconsistencies list, all gates disabled
- [ ] **Integration points**: Enforcement actions generated correctly from gate results

### Mock Strategy
- Mock scoring engine and inconsistency detector outputs
- Use deterministic test fixtures for gate evaluation
- Reset mocks between tests (`beforeEach`)
