---
id: RTASK-XXX
title: "[Task Title]"
status: pending
priority: 2
type: [domain|infrastructure|integration|orchestration|presentation]
dependencies: [RTASK-XXX]
rulebook_refs: [RULE-ID-001, RULE-ID-002]
spec: docs/tickets/TASK-XXX.md
---

# RTASK-XXX: [Task Title]

## Objective

[1-2 sentences describing what this task accomplishes and why it matters.]

## Context

[What has been built so far that this task builds upon. Reference dependency tasks.]
[What the builder needs to know before starting implementation.]

## Technical Specification

### [Component/Section 1]

[Detailed specification of what needs to be built. Include code snippets for type definitions, function signatures, or configuration that must be followed exactly.]

### [Component/Section 2]

[Continue with more sections as needed.]

## Acceptance Criteria

- [ ] AC-01: [Specific, verifiable criterion]
- [ ] AC-02: [Specific, verifiable criterion]
- [ ] AC-03: [Specific, verifiable criterion]
- [ ] AC-04: [Specific, verifiable criterion]
- [ ] AC-05: [Specific, verifiable criterion]

## QA Gates

### Pre-Implementation Gates
- [ ] **GATE-READY**: All dependencies (RTASK-XXX) are completed
- [ ] **GATE-SPEC**: Rulebook sections `[RULE-ID]` have been read and understood
- [ ] **GATE-DESIGN**: Implementation approach documented in task comments before coding

### Implementation Gates (per file)
- [ ] **GATE-REDS**: Write failing test FIRST for each function/component
- [ ] **GATE-GREEN**: Write minimum code to make test pass
- [ ] **GATE-REFACTOR**: Clean up code while keeping tests green

### Post-Implementation Gates
- [ ] **GATE-TYPECHECK**: `npm run typecheck` passes with zero errors
- [ ] **GATE-LINT**: `npm run lint` passes with zero warnings
- [ ] **GATE-FORMAT**: `npm run format:check` passes
- [ ] **GATE-TEST**: `npm run test:unit` passes with coverage > [85|90|95]%
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
1. Read the full task spec (`docs/tickets/TASK-XXX.md`)
2. Read referenced rulebook sections (`docs/rulebook/RULEBOOK.md` → `[RULE-ID]`)
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
4. Run `npm run test:unit` — must pass with required coverage
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
- [ ] Rulebook rules `[RULE-ID]` are satisfied

### Rejection Criteria
The critic MUST reject if:
- Any `any` type is present
- Coverage is below the required threshold
- A `.reqs.md` sidecar is missing
- A `.spec.ts` test file is missing
- Structured logging is absent
- Error handling is missing or generic (`catch (e) { }`)
- External dependencies were added without approval

## Testing Protocol

### Unit Tests (`tests/unit/...`)
- Location: Mirror production path under `tests/unit/`
- Naming: `[filename].spec.ts`
- Coverage target: [85|90|95]%
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

## Triple Deliverable

[For .ts modules - every production file gets all 3:]

| Production (.ts) | Sidecar (.reqs.md) | Test (.spec.ts) |
|------------------|-------------------|-----------------|
| `src/path/file.ts` | `src/path/file.reqs.md` | `tests/unit/path/file.spec.ts` |

[For config files - sidecars only:]

| File | Sidecar |
|------|---------|
| `config.file` | `config.reqs.md` |

## Risks

| Risk | Mitigation |
|------|------------|
| [Risk 1] | [How to prevent/handle] |
