---
id: RTASK-012
title: 'Integration Layer - Confluence API Adapter'
status: pending
priority: 3
type: integration
dependencies: [RTASK-005, RTASK-013]
rulebook_refs: [FORGE-OPS-001, FORGE-OPS-003, SEC-PRIV-001]
spec: docs/tickets/TASK-012-integration-confluence-adapter.md
---

# RTASK-012: Integration Layer - Confluence API Adapter

## Objective

Implement the Confluence Cloud API adapter for searching and reading documentation relevant to ticket validation.

## Context

Confluence is the organizational documentation source. The adapter enables searching pages, extracting content, and cross-referencing with Jira ticket data.

## Technical Specification

### Location

`src/backend/services/confluence/`

### Functions

- **`searchPages(query: string, spaceKeys?: string[]): Promise<ConfluencePageData[]>`** - Searches pages by text in Confluence. Filters by spaces if specified. Uses `@forge/api` => `requestConfluence`.
- **`getPageContent(pageId: string): Promise<string>`** - Gets page content as plain text. Handles Atlassian Document Format (ADF).
- **`getPageMetadata(pageId: string): Promise<ConfluencePageMetadata>`** - Gets metadata: title, space, last edit, labels, version.
- **`getSpacePages(spaceKey: string, limit?: number): Promise<ConfluencePageData[]>`** - Gets pages from a specific space with controlled pagination.

### Authentication

- Via `@forge/api` (no manual tokens needed)
- Scopes: `read:confluence-content`, `write:confluence-content`

### Error Handling

- `ConfluenceApiError`: Base communication error
- `PageNotFoundError`: Page doesn't exist
- `SpaceNotFoundError`: Space doesn't exist

## Acceptance Criteria

- [ ] AC-01: All functions use `@forge/api` for authentication
- [ ] AC-02: Search works with and without space filters
- [ ] AC-03: ADF format handled in content responses
- [ ] AC-04: Correct pagination for large result sets
- [ ] AC-05: Timeout on API calls via AbortController
- [ ] AC-06: Structured logging with executionId
- [ ] AC-07: Unit test coverage > 85%
- [ ] AC-08: `.reqs.md` sidecar created

## Triple Deliverable

| Production (.ts)                                        | Sidecar (.reqs.md)                                           | Test (.spec.ts)                                             |
| ------------------------------------------------------- | ------------------------------------------------------------ | ----------------------------------------------------------- |
| `src/backend/services/confluence/confluence-adapter.ts` | `src/backend/services/confluence/confluence-adapter.reqs.md` | `tests/unit/services/confluence/confluence-adapter.spec.ts` |

## Risks

| Risk               | Mitigation                                 |
| ------------------ | ------------------------------------------ |
| ADF format changes | Parse defensively, test with real examples |
| Large page content | Limit content extraction size              |

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

1. Read the full task spec (`docs/tickets/TASK-012-integration-confluence-adapter.md`)
2. Read referenced rulebook sections (`docs/rulebook/RULEBOOK.md` -> FORGE-OPS-001, FORGE-OPS-003, SEC-PRIV-001)
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
- [ ] Rulebook rules FORGE-OPS-001, FORGE-OPS-003, SEC-PRIV-001 are satisfied

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

### Unit Tests (`tests/unit/services/confluence/`)

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
