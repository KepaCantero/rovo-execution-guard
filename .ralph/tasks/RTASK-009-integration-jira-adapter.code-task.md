---
id: RTASK-009
title: "Integration Layer - Jira API Adapter"
status: pending
priority: 3
type: integration
dependencies: [RTASK-005, RTASK-013]
rulebook_refs: [FORGE-OPS-001, FORGE-OPS-003, SEC-PRIV-001]
spec: docs/tickets/TASK-009-integration-jira-adapter.md
---

# RTASK-009: Integration Layer - Jira API Adapter

## Objective

Implement a Jira API adapter that provides a typed, error-resilient interface to Jira data and operations via the Atlassian Forge platform. The adapter handles authentication, rate limiting, timeouts, and structured logging for all Jira interactions.

## Context

The Jira adapter is the primary integration layer for reading ticket data, managing project configurations, and controlling ticket transitions. It wraps the `@forge/api` `requestJira` function and provides a clean domain-facing API. This task depends on RTASK-005 for domain types and RTASK-013 for shared infrastructure (logging, error handling).

## Technical Specification

### Location

`src/backend/services/jira/`

### Core Functions

- `getTicketData(issueKey) -> TicketData`
  - Fetches complete ticket data for a given issue key.
  - Returns a typed `TicketData` object.

- `getProjectConfig(projectKey) -> ProjectConfig`
  - Retrieves project-level configuration for the execution guard.
  - Returns default config if no custom config is stored.

- `saveProjectConfig(config) -> void`
  - Persists project configuration via Jira entity properties or app storage.

- `transitionIssue(issueKey, transitionId) -> void`
  - Transitions an issue to a new status using the given transition ID.
  - Validates transition is allowed before executing.

- `getTransitions(issueKey) -> Transition[]`
  - Returns available transitions for the given issue.

- `addComment(issueKey, body) -> void`
  - Adds a comment to the specified issue.

- `getIssueStatus(issueKey) -> string`
  - Returns the current status name of the issue.

### Authentication

- All API calls use `@forge/api` `requestJira` for authentication.
- Required Forge scopes: `read:jira-work`, `write:jira-work`.
- No manual token management; Forge handles auth transparently.

### Error Handling

| Error Type               | Trigger                                          |
|--------------------------|--------------------------------------------------|
| `JiraApiError`           | Generic Jira API failure with status code        |
| `TicketNotFoundError`    | Issue key does not exist (HTTP 404)              |
| `PermissionDeniedError`  | Insufficient permissions (HTTP 403)              |
| `TransitionBlockedError` | Transition not allowed for current issue state   |

### Non-Functional Requirements

- **Structured logging**: All operations must log with `executionId` correlation.
- **Rate limiting**: Respect Jira API rate limits. Implement backoff on 429 responses.
- **Timeout**: All requests must use `AbortController` with configurable timeout (default 10s).
- Must include a `.reqs.md` sidecar file documenting requirements traceability.

## Acceptance Criteria

1. All functions (`getTicketData`, `getProjectConfig`, `saveProjectConfig`, `transitionIssue`, `getTransitions`, `addComment`, `getIssueStatus`) use `@forge/api` `requestJira`.
2. Custom error types (`JiraApiError`, `TicketNotFoundError`, `PermissionDeniedError`, `TransitionBlockedError`) are implemented and used.
3. Structured logging includes `executionId` in every log entry.
4. Rate limiting is respected with appropriate backoff on 429 responses.
5. Timeout implemented using `AbortController` with configurable duration.
6. Test coverage exceeds 85%.
7. Integration tests use mocked `@forge/api` responses.
8. `.reqs.md` sidecar file is created with requirements traceability.

## Triple Deliverable

- **Source Code**: `src/backend/services/jira/jira-adapter.ts` with all API functions, error types, and logging.
- **Tests**: `src/backend/services/jira/__tests__/jira-adapter.test.ts` with >85% coverage and integration tests using mocks.
- **Requirements**: `src/backend/services/jira/jira-adapter.reqs.md` sidecar file.

## Risks

- **Forge API changes**: Atlassian may change the `requestJira` API or scopes. Mitigate by isolating Forge-specific code behind the adapter interface.
- **Rate limiting variability**: Jira Cloud rate limits are not strictly documented. Mitigate with conservative backoff strategy.
- **Entity property storage limits**: Project config stored in entity properties has size limits. Mitigate with schema validation and size checks.

## QA Gates

### Pre-Implementation Gates
- [ ] **GATE-READY**: All dependencies (RTASK-005, RTASK-013) are completed
- [ ] **GATE-SPEC**: Rulebook sections FORGE-OPS-001, FORGE-OPS-003, SEC-PRIV-001 have been read and understood
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
1. Read the full task spec (`docs/tickets/TASK-009-integration-jira-adapter.md`)
2. Read referenced rulebook sections (`docs/rulebook/RULEBOOK.md` → FORGE-OPS-001, FORGE-OPS-003, SEC-PRIV-001)
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
- [ ] Rulebook rules FORGE-OPS-001, FORGE-OPS-003, SEC-PRIV-001 are satisfied

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

### Unit Tests (`tests/unit/services/jira/`)
- Location: Mirror production path under `tests/unit/`
- Naming: `[filename].spec.ts`
- Coverage target: 85%
- Pattern: Arrange-Act-Assert (AAA)
- Must test: Happy path, error paths, edge cases, boundary values

### Test Categories Required
- [ ] **Happy path**: All API functions return typed data correctly
- [ ] **Error handling**: HTTP 404, 403, 429, and network errors handled gracefully
- [ ] **Edge cases**: Empty issue key, non-existent ticket, rate limit responses
- [ ] **Integration points**: Mocked `@forge/api` `requestJira` calls work correctly

### Mock Strategy
- Mock all external APIs (Jira via `@forge/api`)
- Mock `@forge/api` and `@forge/resolver` calls
- Use `jest.fn()` for function mocks, not hand-rolled stubs
- Reset mocks between tests (`beforeEach`)
