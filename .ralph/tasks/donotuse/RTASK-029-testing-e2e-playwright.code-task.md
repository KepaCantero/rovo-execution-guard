---
id: RTASK-029
title: "Testing - E2E Playwright Suite"
status: pending
priority: 4
type: testing
dependencies: [RTASK-014, RTASK-016, RTASK-017, RTASK-018, RTASK-019, RTASK-025]
rulebook_refs: [TEST-QA-006, GIT-CI-004]
spec: docs/tickets/TASK-029-testing-e2e-playwright.md
---

# RTASK-029: Testing - E2E Playwright Suite

## Objective
Implement end-to-end test suites using Playwright that validate complete user flows across Jira panels, GitHub integrations, enforcement gates, and the admin dashboard, ensuring the system works correctly from the user's perspective.

## Context
Unit and integration tests cover individual components and adapters, but the full user experience must be validated through end-to-end tests. Playwright provides browser automation to verify that Jira panels render correctly, enforcement gates block or allow transitions, GitHub status checks report accurately, and the admin dashboard functions as expected.

## Technical Specification

### Test Location
- `tests/e2e/` directory

### Playwright Configuration (`playwright.config.ts`)
- Timeout: 60 seconds per test
- Retries: 2 in CI environment, 0 locally
- Reporters: HTML and JSON output
- Base URL: configurable via environment variable

### E2E Test Flows

**Flow 1: Block Ticket by Low Score**
1. Navigate to Jira ticket view
2. Verify execution panel is visible
3. Verify consistency score is below 80
4. Attempt to transition ticket to In Progress
5. Verify transition is blocked by enforcement gate

**Flow 2: Block PR in GitHub**
1. Create a pull request referencing a ticket with low score
2. Verify webhook triggers processing
3. Verify status check reports failure
4. Verify context comment is posted on PR
5. Resolve the ticket score issue
6. Verify status check reports success after resolution

**Flow 3: Happy Path**
1. Ensure ticket has consistency score >= 80
2. Move ticket to In Progress successfully
3. Create a pull request referencing the ticket
4. Verify status check reports success
5. Move ticket to Done

**Flow 4: Admin Dashboard**
1. Navigate to admin dashboard
2. Verify metrics are displayed correctly
3. Change a configuration setting
4. Verify the configuration change takes effect

## Acceptance Criteria
- [ ] Playwright is configured via `playwright.config.ts`
- [ ] Flow 1 (ticket block by low score) passes end to end
- [ ] Flow 2 (PR block and resolution) passes end to end
- [ ] Flow 3 (happy path - high score ticket through full lifecycle) passes end to end
- [ ] Flow 4 (admin dashboard navigation and config change) passes end to end
- [ ] Tests run successfully in CI staging environment
- [ ] Screenshots and videos are captured on test failure
- [ ] `npm run test:e2e` passes with all flows green
- [ ] `.reqs.md` sidecar file is maintained

## Triple Deliverable
1. **Source**: `playwright.config.ts`, all e2e test files under `tests/e2e/`
2. **Tests**: The e2e test suite itself; validated by `npm run test:e2e` in CI staging
3. **Documentation**: E2E testing guide in `docs/tickets/TASK-029-testing-e2e-playwright.md`; updated `.reqs.md` sidecar

## Risks
- E2E tests depend on staging environment availability and stability
- Jira and GitHub UI changes can break selectors and test locators
- Test execution time may be significant with retries and multiple flows
- Webhook-based flows (Flow 2) require careful timing and wait strategies
- Screenshot/video artifacts may consume significant storage in CI
- Authentication and session management for Jira/GitHub may need special handling

## QA Gates

### Pre-Implementation Gates
- [ ] **GATE-READY**: All dependencies ([RTASK-014, RTASK-016, RTASK-017, RTASK-018, RTASK-019, RTASK-025]) are completed
- [ ] **GATE-SPEC**: Rulebook sections TEST-QA-006, GIT-CI-004 have been read and understood
- [ ] **GATE-DESIGN**: Implementation approach documented before coding

### Implementation Gates (per test flow)
- [ ] **GATE-RED**: Write failing test FIRST for each function/component
- [ ] **GATE-GREEN**: Write minimum code to make test pass
- [ ] **GATE-REFACTOR**: Clean up code while keeping tests green

### Post-Implementation Gates
- [ ] **GATE-TYPECHECK**: `npm run typecheck` passes with zero errors
- [ ] **GATE-LINT**: `npm run lint` passes with zero warnings
- [ ] **GATE-FORMAT**: `npm run format:check` passes
- [ ] **GATE-TEST**: `npm run test:e2e` passes with all flows green in CI staging
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
1. Read the full task spec (`docs/tickets/TASK-029-testing-e2e-playwright.md`)
2. Read referenced rulebook sections (`docs/rulebook/RULEBOOK.md` → TEST-QA-006, GIT-CI-004)
3. Read all dependency task outputs to understand available interfaces
4. Create `.reqs.md` sidecar files with requirements traceability

### Step 2: TDD Cycle (per test flow)
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
4. Run `npm run test:e2e` in CI staging — must pass with all flows green
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
- [ ] Rulebook rules TEST-QA-006, GIT-CI-004 are satisfied

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
- **The test suite IS the deliverable** — this is a meta-task that creates E2E test infrastructure
- Location: `tests/e2e/` (test files)
- Self-validation: `npm run test:e2e` in CI staging
- Coverage: N/A (E2E tests)

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
