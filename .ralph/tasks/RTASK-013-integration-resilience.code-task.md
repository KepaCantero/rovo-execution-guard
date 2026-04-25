---
id: RTASK-013
title: 'Integration Layer - Resilience (Circuit Breaker, Retry, Timeout)'
status: pending
priority: 2
type: infrastructure
dependencies: [RTASK-005]
rulebook_refs: [FORGE-OPS-001, ARCH-SOLID-004, TEST-QA-001]
spec: docs/tickets/TASK-013-integration-resilience.md
---

# RTASK-013: Integration Layer - Resilience (Circuit Breaker, Retry, Timeout)

## Objective

Implement the resilience patterns used by all adapters: Circuit Breaker, Exponential Backoff, AbortController for timeouts, and centralized error classification. All adapters depend on this module.

## Context

Every external API call (Jira, Confluence, Rovo, GitHub) needs resilience. This module provides generic, reusable patterns with zero external dependencies. It must be battle-tested with >95% coverage since it's the foundation of reliability.

## Technical Specification

### Location

`src/backend/utils/`

### Components

#### `withTimeout<T>(promise: Promise<T>, ms: number): Promise<T>`

- Default timeout: 9000ms (leaves margin for Forge's 10s hard limit)
- Aborts operation and throws `TimeoutError`

#### `retryWithBackoff<T>(fn: () => Promise<T>, options: RetryOptions): Promise<T>`

- `maxRetries`: 3 (default)
- `baseDelay`: 1000ms (default)
- `maxDelay`: 10000ms
- Backoff: `delay * 2^attempt + jitter`
- Only retries on transient errors (429, 500, 502, 503, 504)

#### `createCircuitBreaker(options: CircuitBreakerOptions): CircuitBreaker`

- States: `closed`, `open`, `half-open`
- `failureThreshold`: 5 consecutive failures opens circuit
- `resetTimeout`: 30 seconds before half-open
- In `open` state: throws `CircuitOpenError` immediately

#### `isTransientError(error: unknown): boolean`

- Transient: timeout, rate limit (429), server errors (5xx), network errors
- Permanent: 401, 403, 404, 400

## Acceptance Criteria

- [ ] AC-01: `withTimeout` aborts operations exceeding timeout
- [ ] AC-02: `retryWithBackoff` retries with exponential backoff + jitter
- [ ] AC-03: `createCircuitBreaker` opens/closes circuit correctly
- [ ] AC-04: `isTransientError` classifies errors correctly
- [ ] AC-05: Permanent errors (401, 403, 404) are NOT retried
- [ ] AC-06: Structured logging on each retry and state change
- [ ] AC-07: Zero external dependencies
- [ ] AC-08: Unit test coverage > 95%
- [ ] AC-09: `.reqs.md` sidecar created

## Triple Deliverable

| Production (.ts)                  | Sidecar (.reqs.md)                     | Test (.spec.ts)                       |
| --------------------------------- | -------------------------------------- | ------------------------------------- |
| `src/backend/utils/resilience.ts` | `src/backend/utils/resilience.reqs.md` | `tests/unit/utils/resilience.spec.ts` |

## Risks

| Risk                       | Mitigation                         |
| -------------------------- | ---------------------------------- |
| Timer mock issues in tests | Use jest fake timers carefully     |
| Circuit breaker stuck open | Half-open state with reset timeout |

## QA Gates

### Pre-Implementation Gates

- [ ] **GATE-READY**: All dependencies (RTASK-005) are completed
- [ ] **GATE-SPEC**: Rulebook sections FORGE-OPS-001, ARCH-SOLID-004, TEST-QA-001 have been read and understood
- [ ] **GATE-DESIGN**: Implementation approach documented before coding

### Implementation Gates (per file/function)

- [ ] **GATE-RED**: Write failing test FIRST for each function/component
- [ ] **GATE-GREEN**: Write minimum code to make test pass
- [ ] **GATE-REFACTOR**: Clean up code while keeping tests green

### Post-Implementation Gates

- [ ] **GATE-TYPECHECK**: `npm run typecheck` passes with zero errors
- [ ] **GATE-LINT**: `npm run lint` passes with zero warnings
- [ ] **GATE-FORMAT**: `npm run format:check` passes
- [ ] **GATE-TEST**: `npm run test:unit` passes with coverage > 95%
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

1. Read the full task spec (`docs/tickets/TASK-013-integration-resilience.md`)
2. Read referenced rulebook sections (`docs/rulebook/RULEBOOK.md` -> FORGE-OPS-001, ARCH-SOLID-004, TEST-QA-001)
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
4. Run `npm run test:unit` -- must pass with > 95% coverage
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
- [ ] Rulebook rules FORGE-OPS-001, ARCH-SOLID-004, TEST-QA-001 are satisfied

### Rejection Criteria

The critic MUST reject if:

- Any `any` type is present
- Coverage is below the required threshold (95%)
- A `.reqs.md` sidecar is missing
- A `.spec.ts` test file is missing
- Structured logging is absent
- Error handling is missing or generic (`catch (e) { }`)
- External dependencies were added without approval

## Testing Protocol

### Unit Tests (`tests/unit/utils/`)

- Location: Mirror production path under `tests/unit/`
- Naming: `[filename].spec.ts`
- Coverage target: 95%
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
