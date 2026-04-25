---
id: RTASK-015
title: 'Orchestration Layer - Resolvers (Forge Bridge)'
status: pending
priority: 3
type: orchestration
dependencies: [RTASK-006, RTASK-007, RTASK-008, RTASK-009, RTASK-024]
rulebook_refs: [FORGE-OPS-003, SEC-PRIV-002, SEC-PRIV-003]
spec: docs/tickets/TASK-015-orchestration-resolvers.md
---

# RTASK-015: Orchestration Layer - Resolvers (Forge Bridge)

## Objective

Implement the Forge resolvers that connect the frontend (Custom UI) with the backend, enabling the UI to query scores, inconsistencies, quality gate status, and configuration via `@forge/resolver`.

## Context

Resolvers are the interface between the React Custom UI and the Forge backend. They use `@forge/resolver` to expose invocable functions from the frontend. This task depends on the scoring engine (RTASK-006), inconsistency detector (RTASK-007), quality gates (RTASK-008), Jira adapter (RTASK-009), and project config (RTASK-024).

## Technical Specification

### Location

`src/backend/resolvers/`

### Resolvers to Implement

#### `getConsistencyScore(issueKey: string): Promise<ConsistencyScore>`

- Returns the current score for the ticket
- Calculates in real-time or returns cached (if recent)

#### `getInconsistencies(issueKey: string): Promise<Inconsistency[]>`

- Returns detected inconsistencies for the ticket

#### `getQualityGateStatus(issueKey: string): Promise<QualityGateResult>`

- Returns current Quality Gate status for the ticket

#### `getProjectConfig(projectKey: string): Promise<ProjectConfig>`

- Returns project configuration

#### `updateProjectConfig(projectKey: string, config: Partial<ProjectConfig>): Promise<void>`

- Updates project configuration (admin only)

#### `getAuditLog(projectKey: string, limit?: number): Promise<AuditLogEntry[]>`

- Returns latest audit log entries

#### `enrichTicket(issueKey: string): Promise<void>`

- Triggers ticket enrichment with Rovo context (manual)

#### `revalidateTicket(issueKey: string): Promise<ConsistencyScore>`

- Forces ticket re-validation

### Security

- Validate permissions of invoking user
- Rate limiting to prevent abuse
- Sanitize inputs

## Acceptance Criteria

- [ ] AC-01: All resolvers work via `@forge/resolver`
- [ ] AC-02: Resolvers are invocable from Custom UI
- [ ] AC-03: Permission validation on each resolver
- [ ] AC-04: Basic rate limiting implemented
- [ ] AC-05: Input sanitization on all parameters
- [ ] AC-06: Structured logging on each invocation
- [ ] AC-07: Unit test coverage > 85%
- [ ] AC-08: `.reqs.md` sidecar created

## QA Gates

### Pre-Implementation Gates

- [ ] **GATE-READY**: All dependencies (RTASK-006, RTASK-007, RTASK-008, RTASK-009, RTASK-024) are completed
- [ ] **GATE-SPEC**: Rulebook sections `FORGE-OPS-003`, `SEC-PRIV-002`, `SEC-PRIV-003` have been read
- [ ] **GATE-DESIGN**: Implementation approach documented in task comments before coding

### Implementation Gates (per resolver)

- [ ] **GATE-RED**: Write failing test FIRST for each resolver
- [ ] **GATE-GREEN**: Write minimum code to make test pass
- [ ] **GATE-REFACTOR**: Clean up code while keeping tests green

### Post-Implementation Gates

- [ ] **GATE-TYPECHECK**: `npm run typecheck` passes with zero errors
- [ ] **GATE-LINT**: `npm run lint` passes with zero warnings
- [ ] **GATE-FORMAT**: `npm run format:check` passes
- [ ] **GATE-TEST**: `npm run test:unit` passes with coverage > 85%
- [ ] **GATE-REQS**: All `.reqs.md` sidecar files created and complete
- [ ] **GATE-ZERO-ANY**: `grep -r "any" src/backend/resolvers/` returns zero results

## Requirements Creation Protocol

For each production file, the builder MUST create a `.reqs.md` sidecar:

1. **Before implementation**: Create `.reqs.md` listing all requirements from the spec
2. **Format**: Use `.ralph/templates/reqs-template.md` format
3. **Content**: Each requirement maps to an acceptance criterion and rulebook rule
4. **Traceability**: Every AC in the task maps to at least one section in the sidecar
5. **Location**: Sidecar lives adjacent to the production file (same directory)

## Implementation Protocol

### Step 1: Preparation

1. Read the full task spec (`docs/tickets/TASK-015-orchestration-resolvers.md`)
2. Read referenced rulebook sections (`FORGE-OPS-003`, `SEC-PRIV-002`, `SEC-PRIV-003`)
3. Read dependency task outputs: RTASK-006 (scoring engine), RTASK-007 (inconsistency), RTASK-008 (quality gates), RTASK-009 (Jira adapter), RTASK-024 (project config)
4. Create `.reqs.md` sidecar files with requirements traceability

### Step 2: TDD Cycle (per resolver)

1. **RED**: Write a failing test that defines expected resolver behavior
2. **GREEN**: Write the minimum code to make the test pass
3. **REFACTOR**: Clean up while keeping all tests green
4. Repeat for next resolver

### Step 3: Integration

1. Wire all resolvers into the Forge resolver index
2. Add integration-level tests for resolver chain
3. Verify exports are accessible from `src/backend/resolvers/index.ts`

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
- [ ] Permission validation present on every resolver
- [ ] Input sanitization on all string parameters
- [ ] Rate limiting prevents abuse
- [ ] Structured logging with `executionId` on all resolver invocations
- [ ] Triple deliverable complete: `.ts` + `.reqs.md` + `.spec.ts`
- [ ] No code outside specified file locations
- [ ] Dependencies only on completed RTASK modules
- [ ] Rulebook rules `FORGE-OPS-003`, `SEC-PRIV-002`, `SEC-PRIV-003` are satisfied

### Rejection Criteria

The critic MUST reject if:

- Any `any` type is present
- Coverage is below 85%
- A `.reqs.md` sidecar is missing
- A `.spec.ts` test file is missing
- Permission validation is absent on any resolver
- Input sanitization is missing
- Structured logging is absent
- Error handling is missing or generic

## Testing Protocol

### Unit Tests (`tests/unit/resolvers/`)

- Location: Mirror production path under `tests/unit/resolvers/`
- Naming: `[filename].spec.ts`
- Coverage target: 85%
- Pattern: Arrange-Act-Assert (AAA)
- Must test: Happy path, error paths, edge cases, permission failures

### Test Categories Required

- [ ] **Happy path**: Each resolver returns correct data with valid inputs
- [ ] **Error handling**: Resolvers handle service errors gracefully
- [ ] **Edge cases**: Empty issue keys, invalid project keys, null inputs
- [ ] **Permission failures**: Unauthorized users are rejected
- [ ] **Rate limiting**: Rate limiter blocks excessive requests
- [ ] **Input sanitization**: Malicious inputs are sanitized

### Mock Strategy

- Mock `@forge/resolver` for resolver registration
- Mock all service calls (scoring engine, inconsistency detector, etc.)
- Use `jest.fn()` for function mocks
- Reset mocks between tests (`beforeEach`)

## Triple Deliverable

| Production (.ts)                 | Sidecar (.reqs.md)                    | Test (.spec.ts)                      |
| -------------------------------- | ------------------------------------- | ------------------------------------ |
| `src/backend/resolvers/index.ts` | `src/backend/resolvers/index.reqs.md` | `tests/unit/resolvers/index.spec.ts` |

## Risks

| Risk                        | Mitigation                     |
| --------------------------- | ------------------------------ |
| Forge resolver API changes  | Pin `@forge/resolver` version  |
| Permission model complexity | Start with simple admin check  |
| Rate limiting in Forge      | Use Forge Storage for counters |
