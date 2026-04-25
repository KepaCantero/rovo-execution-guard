---
id: RTASK-014
title: 'Orchestration Layer - Jira Triggers (Workflow Validator)'
status: pending
priority: 3
type: orchestration
dependencies: [RTASK-008, RTASK-009, RTASK-010, RTASK-013, RTASK-017, RTASK-021]
rulebook_refs: [FORGE-OPS-001, FORGE-OPS-004, ROVO-INTEG-001]
spec: docs/tickets/TASK-014-orchestration-jira-triggers.md
---

# RTASK-014: Orchestration Layer - Jira Triggers (Workflow Validator)

## Objective

Implement the Jira workflow triggers that intercept transitions and execute Quality Gates before allowing or blocking state changes. This is the primary enforcement entry point.

## Context

When a user attempts to move a ticket, the trigger evaluates whether the transition is permitted. It orchestrates: Jira adapter (get ticket data) → Rovo adapter (get context) → Quality Gate evaluation → block/allow transition → add explanatory comment → audit log.

## Technical Specification

### Location

Configured in `manifest.yml` as `trigger: onJiraWorkflowTransition`
Handler MUST be at `src/backend/resolvers/workflow-transition.handler` (path declared in manifest.yml function `workflow-transition-fn`)

> **IMPORTANT**: The handler file path MUST match `manifest.yml` exactly. The manifest declares `handler: src/backend/resolvers/workflow-transition.handler`. Do NOT create the handler at `src/backend/handlers/`.

### Trigger Flow

1. Jira fires transition event
2. Handler gets ticket data via Jira adapter
3. Gets context via Rovo adapter
4. Detects inconsistencies via inconsistency detector
5. Calculates score via scoring engine
6. Evaluates corresponding Quality Gate via quality-gate-rules
7. If fails: calls enforcement functions from RTASK-017 (`blockTransition()`, `addComment()`)
8. If passes: allows transition (optionally calls `addComment()` for success notification)
9. Writes audit log entry to Forge Storage

### Transitions Intercepted

- `To Do` → `In Progress`: Gate 1 (Definition) - score >= threshold
- `In Progress` → `In Review`: Gate 2 (Execution) - no critical inconsistencies
- `In Review` → `Done`: Gate 3 (Delivery) - cross-validation final

### Performance

- Must respond in < 5 seconds (Forge limit)
- If evaluation takes longer: allow transition, evaluate async
- Prioritize synchronous blocking when possible

### Error Handling

- If evaluation fails (API error, timeout): fail-open (allow transition)
- Log the failure for investigation
- Notify team via comment on the ticket

## Acceptance Criteria

- [ ] AC-01: Trigger executes on configured workflow transitions
- [ ] AC-02: Gate 1 blocks transition if score < threshold
- [ ] AC-03: Comment on ticket explains block reasons
- [ ] AC-04: Fail-open on evaluation error with logging
- [ ] AC-05: Response time < 5 seconds
- [ ] AC-06: Audit log generated for each evaluation
- [ ] AC-07: Configurable per project (active/inactive gates)
- [ ] AC-08: Unit test coverage > 85%
- [ ] AC-09: `.reqs.md` sidecar created

## Triple Deliverable

| Production (.ts)                                      | Sidecar (.reqs.md)                                         | Test (.spec.ts)                                          |
| ----------------------------------------------------- | ---------------------------------------------------------- | -------------------------------------------------------- |
| `src/backend/resolvers/workflow-transition.ts`        | `src/backend/resolvers/workflow-transition.reqs.md`        | `tests/unit/resolvers/workflow-transition.spec.ts`       |

## Risks

| Risk                | Mitigation                         |
| ------------------- | ---------------------------------- |
| Forge 5s timeout    | Fail-open strategy, async fallback |
| API cascade failure | Circuit breakers on adapters       |

## QA Gates

### Pre-Implementation Gates

- [ ] **GATE-READY**: All dependencies (RTASK-008, RTASK-009, RTASK-010, RTASK-013, RTASK-017, RTASK-021) are completed
- [ ] **GATE-SPEC**: Rulebook sections FORGE-OPS-001, FORGE-OPS-004, ROVO-INTEG-001 have been read and understood
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

1. Read the full task spec (`docs/tickets/TASK-014-orchestration-jira-triggers.md`)
2. Read referenced rulebook sections (`docs/rulebook/RULEBOOK.md` -> FORGE-OPS-001, FORGE-OPS-004, ROVO-INTEG-001)
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

1. Run `npm run typecheck` -- must pass
2. Run `npm run lint` -- must pass with zero warnings
3. Run `npm run format:check` -- must pass
4. Run `npm run test:unit` -- must pass with > 85% coverage
5. Verify zero `any` usage

## Auditing Protocol

### Critic Review Checklist

- [ ] All acceptance criteria verified as implemented
- [ ] No `any` types anywhere in new code
- [ ] All interfaces use `readonly` properties
- [ ] Error handling follows hierarchy (REGError -> domain errors)
- [ ] Structured logging with `executionId` on all operations
- [ ] No hardcoded secrets, tokens, or credentials
- [ ] Input validation on all external-facing functions
- [ ] Triple deliverable complete: `.ts` + `.reqs.md` + `.spec.ts`
- [ ] No code outside specified file locations
- [ ] Dependencies only on completed RTASK modules
- [ ] Rulebook rules FORGE-OPS-001, FORGE-OPS-004, ROVO-INTEG-001 are satisfied

### Rejection Criteria

The critic MUST reject if:

- Any `any` type is present
- Coverage is below the required threshold (85%)
- A `.reqs.md` sidecar is missing
- A `.spec.ts` test file is missing
- Structured logging is absent
- Error handling is missing or generic (`catch (e) { }`)
- External dependencies were added without approval

## Testing Protocol

### Unit Tests (`tests/unit/resolvers/`)

- Location: Mirror production path under `tests/unit/`
- Naming: `[filename].spec.ts`
- Coverage target: 85%
- Pattern: Arrange-Act-Assert (AAA)
- Must test: Happy path, error paths, edge cases, boundary values

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
