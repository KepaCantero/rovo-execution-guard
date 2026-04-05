---
id: RTASK-020
title: "Presentation Layer - GitHub PR Comments (Automated)"
status: pending
priority: 4
type: presentation
dependencies: [RTASK-011, RTASK-008]
rulebook_refs: [GH-INTEG-001, SEC-PRIV-005]
spec: docs/tickets/TASK-020-presentation-github-pr-comments.md
---

# RTASK-020: Presentation Layer - GitHub PR Comments (Automated)

## Objective
Implement the GitHub PR comment templating system that generates rich, informative Markdown comments for automated posting on pull requests based on quality gate evaluation results.

## Context
Automated PR comments are the primary feedback mechanism for developers working with GitHub. When a quality gate evaluation completes, the system must post a well-formatted, actionable comment on the PR. This task focuses on the template rendering layer that transforms evaluation results into human-readable GitHub Markdown. It depends on the GitHub integration (RTASK-011) and Jira integration (RTASK-008) for cross-referencing.

## Technical Specification

### Location
`src/backend/services/github/` (templates are part of the enforcement module)

### Template Functions

#### `formatPassedComment(result: EvaluationResult, ticketKey: string): string`
Generates a Markdown comment when the PR passes all quality gates:
- **Score table**: Overall score and per-axis breakdown in a Markdown table
- **Axes summary**: Each quality dimension with its score and pass/fail indicator
- **"Clear to merge" header**: Prominent success message
- **Badge**: Visual quality indicator (using Markdown/shields.io if available)

#### `formatFailedComment(result: EvaluationResult, ticketKey: string): string`
Generates a Markdown comment when the PR fails quality gates:
- **Blocked reasons**: Each failing criterion listed with severity level (critical/warning)
- **Suggestions**: Actionable suggestions for each failing criterion, formatted as a checklist
- **Score breakdown**: Overall and per-axis scores showing which dimensions failed
- **Guidance**: Steps to resolve the issues and re-trigger evaluation

#### `formatContextComment(context: RovoContext, ticketKey: string): string`
Generates a contextual information comment providing additional resources:
- **Related tickets**: Links to associated Jira tickets found in the PR
- **Documentation links**: Links to relevant Confluence pages and project documentation
- **Similar PRs**: Links to similar PRs that were previously evaluated (if available)
- **Quick actions**: Links to re-validate or view the issue panel

### Markdown Formatting Standards
All templates must produce valid GitHub Flavored Markdown (GFM):
- Use headers (`##`, `###`) for sections
- Use tables (`| Col | Col |`) for score breakdowns
- Use checkboxes (`- [ ]`, `- [x]`) for suggestions
- Use collapsible sections (`<details><summary>...</summary>...</details>`) for extended info
- Use emojis for visual indicators (where appropriate and consistent)

### Security Considerations
- **No sensitive data exposed**: Templates must never include webhook secrets, API tokens, internal URLs, or system configuration
- **Sanitized input**: All dynamic values (ticket keys, scores, reasons) must be sanitized before insertion into Markdown
- **Link safety**: All generated links must use HTTPS and point to trusted domains only

### Template Configuration
- Templates should be configurable via project configuration
- Support custom header/footer text
- Allow enabling/disabling specific sections per template
- Support org-wide and project-level template overrides

## Acceptance Criteria
- [ ] Rich Markdown format for all three comment types (passed, failed, context)
- [ ] Approval template includes overall score and per-axis breakdown
- [ ] Block template includes specific reasons with severity levels and actionable suggestions
- [ ] Context template includes Jira ticket links and Confluence documentation links
- [ ] No sensitive data (secrets, tokens, internal URLs) exposed in any template output
- [ ] Templates are configurable through project configuration
- [ ] Test coverage > 90% for formatting functions
- [ ] `.reqs.md` sidecar file produced

## Triple Deliverable
1. **Implementation**: Template functions for passed, failed, and context comments with Markdown rendering and sanitization
2. **Test Suite**: Exhaustive formatting tests covering all templates, edge cases (empty scores, missing data), security tests (no sensitive data leaks), and snapshot tests for template output
3. **Requirements Traceability**: `.reqs.md` sidecar file mapping implementation to rulebook refs and acceptance criteria

## Risks
- **Markdown Injection**: Malicious ticket data could inject unintended Markdown; sanitize all dynamic content
- **Template Drift**: If templates are configurable, diverging from the standard format could reduce readability; provide sensible defaults
- **GitHub Comment Length**: GitHub has a character limit on comments; long evaluation results may need truncation with a "view more" link
- **Rate Limiting**: Posting comments on every PR event could hit GitHub API rate limits; batch or throttle where possible

## QA Gates

### Pre-Implementation Gates
- [ ] **GATE-READY**: All dependencies (RTASK-011, RTASK-008) are completed
- [ ] **GATE-SPEC**: Rulebook sections GH-INTEG-001, SEC-PRIV-005 have been read and understood
- [ ] **GATE-DESIGN**: Implementation approach documented before coding

### Implementation Gates (per file/function)
- [ ] **GATE-RED**: Write failing test FIRST for each function/component
- [ ] **GATE-GREEN**: Write minimum code to make test pass
- [ ] **GATE-REFACTOR**: Clean up code while keeping tests green

### Post-Implementation Gates
- [ ] **GATE-TYPECHECK**: `npm run typecheck` passes with zero errors
- [ ] **GATE-LINT**: `npm run lint` passes with zero warnings
- [ ] **GATE-FORMAT**: `npm run format:check` passes
- [ ] **GATE-TEST**: `npm run test:unit` passes with coverage > 90%
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
1. Read the full task spec (`docs/tickets/TASK-020-presentation-github-pr-comments.md`)
2. Read referenced rulebook sections (`docs/rulebook/RULEBOOK.md` -> GH-INTEG-001, SEC-PRIV-005)
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
4. Run `npm run test:unit` -- must pass with > 90% coverage
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
- [ ] Rulebook rules GH-INTEG-001, SEC-PRIV-005 are satisfied

### Rejection Criteria
The critic MUST reject if:
- Any `any` type is present
- Coverage is below the required threshold (90%)
- A `.reqs.md` sidecar is missing
- A `.spec.ts` test file is missing
- Structured logging is absent
- Error handling is missing or generic (`catch (e) { }`)
- External dependencies were added without approval

## Testing Protocol

### Unit Tests (`tests/unit/services/github/`)
- Location: Mirror production path under `tests/unit/`
- Naming: `[filename].spec.ts`
- Coverage target: 90%
- Pattern: Arrange-Act-Assert (AAA)
- Must test: Happy path, error paths, edge cases, boundary values

### Test Categories Required
- [ ] **Happy path**: Template functions produce valid Markdown with correct data
- [ ] **Error handling**: Template functions handle missing or malformed data gracefully
- [ ] **Edge cases**: Empty scores, missing ticket keys, zero-length inputs, boundary values
- [ ] **Snapshot tests**: Snapshot tests for all three template outputs (passed, failed, context) to catch regressions
- [ ] **Sanitization tests**: Verify no sensitive data (tokens, secrets, internal URLs) appears in template output
- [ ] **Markdown validity**: All output is valid GitHub Flavored Markdown

### Mock Strategy
- Mock all external APIs (Jira, Confluence, Rovo, GitHub)
- Mock `@forge/api` and `@forge/resolver` calls
- Use `jest.fn()` for function mocks, not hand-rolled stubs
- Reset mocks between tests (`beforeEach`)
