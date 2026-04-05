---
id: RTASK-028
title: "Testing - Integration Tests with Mocks"
status: pending
priority: 3
type: testing
dependencies: [RTASK-009, RTASK-010, RTASK-011, RTASK-012, RTASK-013]
rulebook_refs: [TEST-QA-004, TEST-QA-005]
spec: docs/tickets/TASK-028-testing-integration-tests.md
---

# RTASK-028: Testing - Integration Tests with Mocks

## Objective
Implement integration tests that validate the full contract behavior of external adapter integrations (Jira, Rovo, GitHub) using HTTP mocking via `nock`, standardized fixtures, and independent repeatable test scenarios.

## Context
Unit tests validate individual functions in isolation, but the project also needs integration tests that verify the full request/response cycle for each external adapter. These tests must use realistic fixture data, mock HTTP responses, and validate error handling for common failure modes like timeouts, rate limiting, and missing resources.

## Technical Specification

### Test Location
- `tests/integration/` directory with the following subdirectories:
  - `fixtures/` - Shared test fixture files
  - `jira/` - Jira adapter integration tests
  - `rovo/` - Rovo adapter integration tests
  - `github/` - GitHub adapter integration tests

### Fixture Files
- `jira-ticket-full.json` - Complete Jira ticket payload with all fields
- `jira-ticket-minimal.json` - Minimal Jira ticket with required fields only
- `rovo-context-full.json` - Full Rovo context response with related data
- `github-pr-full.json` - Complete GitHub pull request payload
- `confluence-pages.json` - Confluence pages fixture for related documentation

### Test Scenarios

**Jira Adapter Tests:**
- `getTicketData` - Retrieve and parse full ticket data
- `transitionIssue` - Transition ticket between statuses
- `addComment` - Add comment to a ticket
- Rate limiting handling - Verify backoff and retry on 429 responses

**Rovo Adapter Tests:**
- `getContext` - Retrieve full Rovo context
- Fallback behavior - Verify graceful degradation on partial responses
- `relatedTickets` - Retrieve related ticket suggestions
- Quota handling - Verify behavior when API quota is exceeded

**GitHub Adapter Tests:**
- `createStatusCheck` - Create commit status check
- `createPRComment` - Post comment on pull request
- `extractJiraKeysFromPR` - Parse Jira keys from PR title/body
- Token expiration handling - Verify refresh or error on expired tokens
- Rate limiting handling - Verify backoff and retry on 429 responses

### Mock Strategy
- Use `nock` for HTTP interception on all external API calls
- Centralized fixtures in `tests/integration/fixtures/` for consistent test data
- Each test is independent and repeatable with no shared mutable state

## Acceptance Criteria
- [ ] Standardized mock fixtures exist for all external APIs (Jira, Rovo, GitHub, Confluence)
- [ ] Jira adapter contract tests: 6+ test cases covering all methods and error scenarios
- [ ] Rovo adapter contract tests: 4+ test cases covering context, fallback, related tickets, and quota
- [ ] GitHub adapter contract tests: 5+ test cases covering status checks, comments, key extraction, and errors
- [ ] Error handling tests cover: timeout, rate limit (429), and not found (404) scenarios
- [ ] All tests are independent and repeatable with no cross-test dependencies
- [ ] `npm run test:integration` passes with all tests green
- [ ] All HTTP mocking is done via `nock`
- [ ] `.reqs.md` sidecar file is maintained

## Triple Deliverable
1. **Source**: All integration test files under `tests/integration/`, fixture files under `tests/integration/fixtures/`
2. **Tests**: The integration test suite itself; validated by `npm run test:integration`
3. **Documentation**: Integration testing guide in `docs/tickets/TASK-028-testing-integration-tests.md`; updated `.reqs.md` sidecar

## Risks
- `nock` interceptor ordering and cleanup must be managed carefully to avoid test pollution
- Fixture data must be kept in sync with actual API schemas as they evolve
- Rate limit and timeout simulations may behave differently across CI environments
- Large fixture files could slow down test loading if not managed properly

## QA Gates

### Pre-Implementation Gates
- [ ] **GATE-READY**: All dependencies ([RTASK-009, RTASK-010, RTASK-011, RTASK-012, RTASK-013]) are completed
- [ ] **GATE-SPEC**: Rulebook sections TEST-QA-004, TEST-QA-005 have been read and understood
- [ ] **GATE-DESIGN**: Implementation approach documented before coding

### Implementation Gates (per test file)
- [ ] **GATE-RED**: Write failing test FIRST for each function/component
- [ ] **GATE-GREEN**: Write minimum code to make test pass
- [ ] **GATE-REFACTOR**: Clean up code while keeping tests green

### Post-Implementation Gates
- [ ] **GATE-TYPECHECK**: `npm run typecheck` passes with zero errors
- [ ] **GATE-LINT**: `npm run lint` passes with zero warnings
- [ ] **GATE-FORMAT**: `npm run format:check` passes
- [ ] **GATE-TEST**: `npm run test:integration` passes with all tests green
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
1. Read the full task spec (`docs/tickets/TASK-028-testing-integration-tests.md`)
2. Read referenced rulebook sections (`docs/rulebook/RULEBOOK.md` → TEST-QA-004, TEST-QA-005)
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
4. Run `npm run test:integration` — must pass with all tests green
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
- [ ] Rulebook rules TEST-QA-004, TEST-QA-005 are satisfied

### Rejection Criteria
The critic MUST reject if:
- Any `any` type is present
- A `.reqs.md` sidecar is missing
- A `.spec.ts` test file is missing
- Structured logging is absent
- Error handling is missing or generic (`catch (e) { }`)
- External dependencies were added without approval

## Testing Protocol

### Self-Validating Test Suite
- **The test suite IS the deliverable** — this is a meta-task that creates integration test infrastructure
- Location: `tests/integration/` (test files and fixtures)
- Self-validation: `npm run test:integration`
- Coverage: N/A (integration tests themselves)

### Test Categories Required
- [ ] **Happy path**: Primary function works with valid inputs
- [ ] **Error handling**: Function handles errors gracefully
- [ ] **Edge cases**: Empty inputs, null/undefined, boundary values
- [ ] **Integration points**: Mocked adapter/service calls work correctly

### Mock Strategy
- Use `nock` for HTTP interception on all external API calls
- Centralized fixtures in `tests/integration/fixtures/` for consistent test data
- Each test is independent and repeatable with no shared mutable state
- Reset mocks between tests (`beforeEach`)
