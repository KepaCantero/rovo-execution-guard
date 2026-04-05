---
id: RTASK-016
title: "Orchestration Layer - GitHub Webhook Handler"
status: pending
priority: 3
type: orchestration
dependencies: [RTASK-008, RTASK-011, RTASK-009, RTASK-010, RTASK-013]
rulebook_refs: [GH-INTEG-001, GH-INTEG-004, SEC-PRIV-004]
spec: docs/tickets/TASK-016-orchestration-github-webhook.md
---

# RTASK-016: Orchestration Layer - GitHub Webhook Handler

## Objective
Implement the GitHub Webhook Handler as the primary orchestration entry point for pull request events, responsible for receiving, validating, parsing, and dispatching PR events through the quality gate evaluation pipeline.

## Context
The webhook handler is the bridge between GitHub and the Rovo Execution Guard system. It must be registered as a webtrigger in `manifest.yml` and listen for GitHub PR events to trigger quality gate evaluations at the appropriate stages. This task depends on the Jira integration (RTASK-008), Rove context retrieval (RTASK-011), quality gate evaluation (RTASK-009), project configuration (RTASK-010), and audit logging (RTASK-013).

## Technical Specification

### Webtrigger Configuration
- Register as a **webtrigger** in `manifest.yml`
- Listen for GitHub PR events via incoming HTTP requests
- Endpoint must handle POST requests with JSON payloads

### Supported Events
| Event | Action | Behavior |
|---|---|---|
| `pull_request.opened` | New PR created | Evaluate Gate 2, create status check |
| `pull_request.synchronize` | PR updated (new commits) | Re-evaluate Gate 2 |
| `pull_request.closed` / `merged` | PR closed or merged | Evaluate Gate 3 |
| `pull_request.edited` | PR title/body edited | Re-extract Jira keys |

### Security: HMAC-SHA256 Signature Validation
- Validate the `X-Hub-Signature-256` header on every incoming request
- Compute HMAC-SHA256 using the stored webhook secret
- Use constant-time comparison to prevent timing attacks
- Reject requests with invalid or missing signatures immediately (HTTP 403)

### Orchestration Flow
```
receive webhook
  -> validate HMAC-SHA256 signature
  -> parse event payload
  -> extract Jira keys from PR title/body
  -> for each Jira key:
       -> fetch Jira ticket + Rovo context
       -> evaluate Quality Gate
       -> update GitHub status check
       -> write audit log entry
```

### Key Implementation Details
- **Jira Key Extraction**: Parse PR title and body using regex pattern matching (e.g., `[A-Z][A-Z0-9]+-\d+`)
- **Status Check Management**: Use GitHub Commit Status API to create/update status checks on the PR head commit
- **Rate Limiting**: Implement rate limiting to prevent abuse (configurable threshold)
- **PRs Without Jira Keys**: Gracefully ignore and log a warning when no Jira keys are found in the PR

### Structured Logging
- Log all webhook events with structured fields: event type, PR number, repository, Jira keys found, gate evaluation result
- Include correlation IDs for tracing across the pipeline

## Acceptance Criteria
- [ ] HMAC-SHA256 signature validation implemented with constant-time comparison
- [ ] `pull_request.opened` event triggers Gate 2 evaluation and creates GitHub status check
- [ ] `pull_request.synchronize` event triggers re-evaluation of Gate 2
- [ ] `pull_request.closed`/`merged` events trigger Gate 3 evaluation
- [ ] `pull_request.edited` event triggers re-extraction of Jira keys
- [ ] Jira keys correctly extracted from PR title and body
- [ ] GitHub status check created and updated per evaluation result
- [ ] PRs without Jira keys are gracefully ignored with a warning log
- [ ] Rate limiting implemented to prevent webhook abuse
- [ ] Structured logging across all webhook processing stages
- [ ] Test coverage > 85%
- [ ] `.reqs.md` sidecar file produced

## Triple Deliverable
1. **Implementation**: Webhook handler module with signature validation, event parsing, Jira key extraction, and orchestration dispatch
2. **Test Suite**: Unit tests for signature validation, event routing, key extraction, and integration tests for the full pipeline
3. **Requirements Traceability**: `.reqs.md` sidecar file mapping implementation to rulebook refs and acceptance criteria

## Risks
- **Webhook Secret Management**: Secret must be securely stored and rotated; compromise allows forged events
- **GitHub Event Schema Changes**: GitHub may evolve their event payload format; defensive parsing required
- **High Volume PRs**: Rapid PR updates (synchronize) could overwhelm the evaluation pipeline; debounce or queue mechanism may be needed
- **Missing Jira Keys**: Teams not following the Jira key convention will have PRs silently ignored; consider a notification mechanism

## QA Gates

### Pre-Implementation Gates
- [ ] **GATE-READY**: All dependencies (RTASK-008, RTASK-011, RTASK-009, RTASK-010, RTASK-013) are completed
- [ ] **GATE-SPEC**: Rulebook sections GH-INTEG-001, GH-INTEG-004, SEC-PRIV-004 have been read and understood
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
1. Read the full task spec (`docs/tickets/TASK-016-orchestration-github-webhook.md`)
2. Read referenced rulebook sections (`docs/rulebook/RULEBOOK.md` -> GH-INTEG-001, GH-INTEG-004, SEC-PRIV-004)
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
- [ ] Rulebook rules GH-INTEG-001, GH-INTEG-004, SEC-PRIV-004 are satisfied

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

### Unit Tests (`tests/unit/handlers/`)
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
