---
id: RTASK-010
title: "Integration Layer - Rovo API Adapter"
status: pending
priority: 3
type: integration
dependencies: [RTASK-005, RTASK-013]
rulebook_refs: [ROVO-INTEG-001, ROVO-INTEG-002, ROVO-INTEG-003, FORGE-OPS-001]
spec: docs/tickets/TASK-010-integration-rovo-adapter.md
---

# RTASK-010: Integration Layer - Rovo API Adapter

## Objective

Implement a Rovo API adapter that provides contextual intelligence capabilities with graceful fallback to basic keyword search when Rovo is unavailable. The adapter manages quota, timeouts, and structured logging for all Rovo interactions.

## Context

The Rovo adapter enriches ticket data with contextual intelligence from Atlassian Rovo, providing related tickets, documentation references, and historical decisions. When Rovo is unavailable, the adapter falls back to basic keyword-based search in Jira and Confluence. This task depends on RTASK-005 for domain types and RTASK-013 for shared infrastructure.

## Technical Specification

### Location

`src/backend/services/rovo/`

### Core Functions

- `getContext(query, projectKey) -> RovoContext`
  - Retrieves contextual information for a given query within a project.
  - Returns structured `RovoContext` with relevant data.

- `getRelatedTickets(issueKey) -> RelatedTicket[]`
  - Finds tickets related to the given issue based on Rovo intelligence.
  - Falls back to keyword matching in Jira when Rovo is unavailable.

- `getDocumentation(query, spaceKeys?) -> DocumentationResult[]`
  - Searches Confluence documentation relevant to the query.
  - Optionally filters by specific Confluence space keys.

- `getHistoricalDecisions(projectKey) -> HistoricalDecision[]`
  - Retrieves past architectural and technical decisions for the project.
  - Sources from both Rovo intelligence and Confluence decision pages.

- `validateConsistency(ticketData, context) -> ConsistencyValidation`
  - Uses Rovo to validate that ticket data is consistent with known context.
  - Falls back to rule-based validation when Rovo is unavailable.

### Authentication

- Primary: Atlassian Rovo API via Forge extension API.
- Fallback: Direct Jira/Confluence API calls via `@forge/api`.

### Fallback Strategy (No AI)

When Rovo is unavailable (quota exceeded, API error, feature disabled):
- **`getContext`**: Returns basic keyword matches from Jira issues and Confluence pages.
- **`getRelatedTickets`**: Uses title and label overlap to find related tickets.
- **`getDocumentation`**: Falls back to Confluence CQL search with keyword extraction.
- **`getHistoricalDecisions`**: Searches Confluence for pages tagged as "decision" or "ADR".
- **`validateConsistency`**: Uses rule-based field comparison against Jira data.

### Quota Control

- Track queries per minute to stay within Rovo API limits.
- Implement a simple in-memory rate limiter with configurable limits.
- Return `QuotaExceededError` when limits are approached, triggering fallback.

### Error Handling

| Error Type           | Trigger                                          |
|----------------------|--------------------------------------------------|
| `RovoApiError`       | Generic Rovo API failure                         |
| `QuotaExceededError` | Query limit reached, triggers fallback behavior  |

### Non-Functional Requirements

- **Timeout**: All requests must use `AbortController` with configurable timeout (default 15s).
- **Structured logging**: All operations must log with `executionId` correlation and fallback indicators.
- Must include a `.reqs.md` sidecar file documenting requirements traceability.

## Acceptance Criteria

1. `getContext` returns structured `RovoContext` with relevant project data.
2. Fallback functions are operational when Rovo is unavailable (keyword search in Jira/Confluence).
3. Quota control prevents exceeding Rovo API query limits per minute.
4. Timeout implemented using `AbortController` with configurable duration.
5. Structured logging includes `executionId` and fallback indicators in every log entry.
6. Custom error types (`RovoApiError`, `QuotaExceededError`) are implemented and used.
7. Test coverage exceeds 85%.
8. Integration tests use mocked API responses for both Rovo and fallback paths.
9. `.reqs.md` sidecar file is created with requirements traceability.

## Triple Deliverable

- **Source Code**: `src/backend/services/rovo/rovo-adapter.ts` with all API functions, fallback logic, quota control, and error types.
- **Tests**: `src/backend/services/rovo/__tests__/rovo-adapter.test.ts` with >85% coverage and integration tests for both primary and fallback paths.
- **Requirements**: `src/backend/services/rovo/rovo-adapter.reqs.md` sidecar file.

## Risks

- **Rovo API availability**: Rovo may be unavailable or not enabled for all tenants. Mitigate with comprehensive fallback strategy.
- **Fallback quality gap**: Keyword-based fallback produces lower-quality results than Rovo intelligence. Mitigate by clearly documenting limitations and logging fallback usage.
- **Quota limit uncertainty**: Rovo API quota limits may not be publicly documented. Mitigate with conservative default limits and runtime configuration.
- **Confluence search variability**: CQL-based fallback depends on Confluence indexing. Mitigate with error handling for empty or incomplete results.

## QA Gates

### Pre-Implementation Gates
- [ ] **GATE-READY**: All dependencies (RTASK-005, RTASK-013) are completed
- [ ] **GATE-SPEC**: Rulebook sections ROVO-INTEG-001, ROVO-INTEG-002, ROVO-INTEG-003, FORGE-OPS-001 have been read and understood
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
1. Read the full task spec (`docs/tickets/TASK-010-integration-rovo-adapter.md`)
2. Read referenced rulebook sections (`docs/rulebook/RULEBOOK.md` → ROVO-INTEG-001, ROVO-INTEG-002, ROVO-INTEG-003, FORGE-OPS-001)
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
- [ ] Rulebook rules ROVO-INTEG-001, ROVO-INTEG-002, ROVO-INTEG-003, FORGE-OPS-001 are satisfied

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

### Unit Tests (`tests/unit/services/rovo/`)
- Location: Mirror production path under `tests/unit/`
- Naming: `[filename].spec.ts`
- Coverage target: 85%
- Pattern: Arrange-Act-Assert (AAA)
- Must test: Happy path, error paths, edge cases, boundary values

### Test Categories Required
- [ ] **Happy path**: Rovo API returns structured context correctly
- [ ] **Error handling**: API failures, quota exceeded, timeout errors handled gracefully
- [ ] **Edge cases**: Empty query results, Rovo unavailable, fallback path execution
- [ ] **Integration points**: Mocked API calls for both primary and fallback paths work correctly

### Mock Strategy
- Mock all external APIs (Rovo, Confluence, Jira via `@forge/api`)
- Mock `@forge/api` and `@forge/resolver` calls
- Use `jest.fn()` for function mocks, not hand-rolled stubs
- Reset mocks between tests (`beforeEach`)
