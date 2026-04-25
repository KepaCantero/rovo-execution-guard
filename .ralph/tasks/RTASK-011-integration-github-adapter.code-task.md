---
id: RTASK-011
title: 'Integration Layer - GitHub API Adapter'
status: pending
priority: 3
type: integration
dependencies: [RTASK-005, RTASK-013]
rulebook_refs: [GH-INTEG-001, GH-INTEG-002, GH-INTEG-003, SEC-PRIV-001]
spec: docs/tickets/TASK-011-integration-github-adapter.md
---

# RTASK-011: Integration Layer - GitHub API Adapter

## Objective

Implement the GitHub REST API v3 adapter for managing Status Checks on PRs, creating automated comments, and extracting Jira ticket keys from PR metadata.

## Context

The GitHub integration is bidirectional: the app injects validated context into PRs and listens for webhooks to re-evaluate tickets. This adapter handles the outgoing API calls (status checks, comments, PR data reads). Token security and rate limiting are critical.

## Technical Specification

### Location

`src/backend/services/github/`

### Functions

- **`createStatusCheck(params: GitHubStatusCheck): Promise<void>`** - Creates/updates a Status Check on a PR (states: success, failure, pending). Includes detail URL linking to Jira panel.
- **`createPRComment(repo: string, prNumber: number, body: string): Promise<void>`** - Publishes a Markdown comment on the PR with validated context, score, and suggestions.
- **`getPRData(repo: string, prNumber: number): Promise<GitHubPRData>`** - Fetches PR data: title, description, branch, commits, files changed. Searches for Jira ticket references in title/body.
- **`extractJiraKeysFromPR(pr: GitHubPRData): string[]`** - Extracts Jira ticket IDs from PR title and body via regex `[A-Z]+-\d+`.
- **`updateStatusCheck(checkId: string, params: Partial<GitHubStatusCheck>): Promise<void>`** - Updates an existing check (for re-evaluation).
- **`listPRFiles(repo: string, prNumber: number): Promise<PRFile[]>`** - Lists modified files in the PR for context analysis.

### Authentication

- GitHub REST API v3 (mandatory)
- Token stored encrypted in Forge Storage
- Scopes: `repo:status`, `pull_requests:read`
- Token rotation supported

### Security

- Tokens encrypted at rest in Forge Storage
- Audit log of every token usage
- No sensitive data in comments

## Acceptance Criteria

- [ ] AC-01: `createStatusCheck` creates checks that block merge in GitHub
- [ ] AC-02: `createPRComment` publishes comments with valid context
- [ ] AC-03: `extractJiraKeysFromPR` extracts IDs via regex `[A-Z]+-\d+`
- [ ] AC-04: Tokens stored encrypted in Forge Storage
- [ ] AC-05: Timeout on API calls via AbortController
- [ ] AC-06: Structured logging with executionId
- [ ] AC-07: Custom error types (`GitHubApiError`, `TokenExpiredError`)
- [ ] AC-08: Unit test coverage > 85%
- [ ] AC-09: Integration tests with GitHub API mocks
- [ ] AC-10: `.reqs.md` sidecar created

## Triple Deliverable

| Production (.ts)                                | Sidecar (.reqs.md)                                   | Test (.spec.ts)                                     |
| ----------------------------------------------- | ---------------------------------------------------- | --------------------------------------------------- |
| `src/backend/services/github/github-adapter.ts` | `src/backend/services/github/github-adapter.reqs.md` | `tests/unit/services/github/github-adapter.spec.ts` |

## Risks

| Risk               | Mitigation                       |
| ------------------ | -------------------------------- |
| Token leakage      | Encrypted storage, audit logging |
| Rate limiting      | Backoff strategy, quota tracking |
| GitHub API changes | Pin API version v3               |

## QA Gates

### Pre-Implementation Gates

- [ ] **GATE-READY**: All dependencies (RTASK-005, RTASK-013) are completed
- [ ] **GATE-SPEC**: Rulebook sections GH-INTEG-001, GH-INTEG-002, GH-INTEG-003, SEC-PRIV-001 have been read and understood
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

1. Read the full task spec (`docs/tickets/TASK-011-integration-github-adapter.md`)
2. Read referenced rulebook sections (`docs/rulebook/RULEBOOK.md` -> GH-INTEG-001, GH-INTEG-002, GH-INTEG-003, SEC-PRIV-001)
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
- [ ] Rulebook rules GH-INTEG-001, GH-INTEG-002, GH-INTEG-003, SEC-PRIV-001 are satisfied

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

### Unit Tests (`tests/unit/services/github/`)

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
