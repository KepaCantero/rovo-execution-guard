---
id: RTASK-017
title: "Orchestration Layer - Enforcement Actions"
status: pending
priority: 3
type: orchestration
dependencies: [RTASK-009, RTASK-011, RTASK-008]
rulebook_refs: [GH-INTEG-001, ROVO-INTEG-001, SEC-PRIV-005]
spec: docs/tickets/TASK-017-orchestration-enforcement-actions.md
---

# RTASK-017: Orchestration Layer - Enforcement Actions

## Objective
Implement the enforcement actions module that serves as the execution arm of the quality gate system, responsible for blocking transitions, blocking PRs, adding formatted comments, flagging inconsistencies, and approving PRs based on evaluation results.

## Context
Once the quality gate evaluation completes, the system must take concrete enforcement actions across both Jira and GitHub. This module translates evaluation outcomes into tangible enforcement: preventing invalid workflow transitions, blocking non-compliant PRs, and providing rich feedback to users. It depends on quality gate evaluation (RTASK-009), Rove context retrieval (RTASK-011), and Jira integration (RTASK-008).

## Technical Specification

### Location
`src/backend/services/enforcement/` (or `src/backend/services/orchestration/`)

### Core Functions

#### `blockTransition(issueKey: string, transitionId: string, reason: string): Promise<void>`
- Prevents a Jira workflow transition from completing
- Posts a comment on the Jira issue explaining why the transition was blocked
- Logs the enforcement action for audit purposes

#### `blockPR(repo: string, prNumber: number, reason: string, details: object): Promise<void>`
- Creates a failing GitHub status check on the PR
- Posts a comment on the PR with the blocking reasons and suggestions
- Links back to the related Jira ticket(s)

#### `addComment(target: 'jira' | 'github', identifier: string, body: string): Promise<void>`
- Generic comment function for both Jira and GitHub targets
- For Jira: posts in Atlassian Document Format (ADF)
- For GitHub: posts in Markdown format

#### `flagInconsistency(inconsistency: Inconsistency): Promise<void>`
- Registers an inconsistency in the tracking system
- Notifies relevant stakeholders via comment on the associated ticket/PR
- Categorizes by severity (critical, warning, info)

#### `approvePR(repo: string, prNumber: number, details: object): Promise<void>`
- Creates a success GitHub status check on the PR
- Posts an approval comment with the quality scores and breakdown

### Comment Templates

#### Jira Comments (ADF Format)
- **Color badges**: Green for pass, Red for fail, Yellow for warning
- **Score table**: Axis scores in a structured table with color indicators
- **Gate indicator**: Clear visual representation of which gates passed/failed
- **Suggestions**: Expandable sections with actionable improvement suggestions

#### GitHub Comments (Markdown Format)
- **Status emojis**: Green checkmark for pass, Red X for fail, Yellow warning for partial
- **Collapsible details**: Use `<details>` tags for extended information
- **Score breakdown**: Table with axis scores and color indicators
- **Quick links**: Direct links to Jira ticket, Confluence docs, and re-validation

### Template Configuration
- All comment templates should be configurable via the project configuration
- Support custom header/footer text
- Allow enabling/disabling specific template sections

## Acceptance Criteria
- [ ] `blockTransition` prevents the Jira transition and comments the blocking reason
- [ ] `blockPR` creates a failure status check on the GitHub PR
- [ ] Rich format comments posted to Jira in ADF format with color badges and score tables
- [ ] Rich format comments posted to GitHub in Markdown with status emojis and collapsible details
- [ ] `approvePR` creates a success status check on the GitHub PR
- [ ] `flagInconsistency` registers the inconsistency and notifies stakeholders
- [ ] Comment templates are configurable through project configuration
- [ ] All enforcement actions are logged with structured logging
- [ ] Test coverage > 85%
- [ ] `.reqs.md` sidecar file produced

## Triple Deliverable
1. **Implementation**: Enforcement actions module with all five core functions and comment template system
2. **Test Suite**: Unit tests for each enforcement function, template rendering tests, and integration tests with mocked Jira/GitHub APIs
3. **Requirements Traceability**: `.reqs.md` sidecar file mapping implementation to rulebook refs and acceptance criteria

## Risks
- **Permission Issues**: Enforcement actions require write access to both Jira and GitHub; insufficient permissions will cause silent failures
- **Comment Spam**: Over-commenting on rapid PR updates could annoy developers; consider throttling or deduplication
- **ADF Complexity**: Atlassian Document Format is verbose and error-prone; use a builder utility to construct ADF documents safely
- **Race Conditions**: Multiple enforcement actions on the same PR/issue concurrently could cause conflicts; implement idempotency

## QA Gates

### Pre-Implementation Gates
- [ ] **GATE-READY**: All dependencies (RTASK-009, RTASK-011, RTASK-008) are completed
- [ ] **GATE-SPEC**: Rulebook sections GH-INTEG-001, ROVO-INTEG-001, SEC-PRIV-005 have been read and understood
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
1. Read the full task spec (`docs/tickets/TASK-017-orchestration-enforcement-actions.md`)
2. Read referenced rulebook sections (`docs/rulebook/RULEBOOK.md` -> GH-INTEG-001, ROVO-INTEG-001, SEC-PRIV-005)
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
- [ ] Rulebook rules GH-INTEG-001, ROVO-INTEG-001, SEC-PRIV-005 are satisfied

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

### Unit Tests (`tests/unit/services/enforcement/`)
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
