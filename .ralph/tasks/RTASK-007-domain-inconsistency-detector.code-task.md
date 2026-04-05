---
id: RTASK-007
title: "Domain Layer - Inconsistency Detector"
status: pending
priority: 2
type: domain
dependencies: [RTASK-005]
rulebook_refs: [ARCH-SOLID-002, ROVO-INTEG-002, ROVO-INTEG-003]
spec: docs/tickets/TASK-007-domain-inconsistency-detector.md
---

# RTASK-007: Domain Layer - Inconsistency Detector

## Objective

Implement a pure domain inconsistency detector that identifies and classifies ticket inconsistencies using deterministic, rule-based logic without any AI dependencies. The detector must surface contradictions, duplicates, missing context, and ambiguities with actionable suggestions.

## Context

Inconsistency detection is a critical capability that feeds into the quality gate evaluation. The detector analyzes ticket content and context to find problems that could lead to execution failures. This task depends on RTASK-005 for domain types and models. It operates independently of the scoring engine (RTASK-006) but its output is consumed by the quality gate rules engine (RTASK-008).

## Technical Specification

### Location

`src/backend/services/scoring/`

### Core Functions

- `detectInconsistencies(ticket, context) -> Inconsistency[]`
  - Scans ticket data against provided context.
  - Returns an array of detected `Inconsistency` objects.
  - Must be deterministic: same input always produces same output.

- `classifySeverity(inconsistency) -> Severity`
  - Classifies an inconsistency into one of three severity levels.

- `generateSuggestion(inconsistency) -> string`
  - Produces a human-readable, actionable suggestion for resolving the inconsistency.

### Inconsistency Types

| Type              | Description                                                    |
|-------------------|----------------------------------------------------------------|
| `contradiction`   | Conflicting information within the ticket or against context   |
| `duplicate`       | Overlapping or redundant content detected                      |
| `missing_context` | Required fields or references are absent                       |
| `ambiguity`       | Vague or unclear language that could lead to multiple readings |

### Severity Levels

| Level      | Behavior                                                        |
|------------|-----------------------------------------------------------------|
| `critical` | Blocks ticket progression; must be resolved before proceeding   |
| `warning`  | Requires attention; does not block but should be reviewed       |
| `info`     | Informational suggestion; no blocking, purely advisory          |

### Detection Rules (No AI)

- **Contradiction**: Keyword comparison between ticket fields (title, description, acceptance criteria). Detect negating terms, conflicting priorities, or opposing technical directions.
- **Duplicate**: Title and description overlap analysis using >70% string similarity threshold for identifying redundant tickets or duplicated content within a ticket.
- **Missing context**: Required field checks against a schema. Verify presence of acceptance criteria, priority, assignee, labels, and story points where applicable.
- **Ambiguity**: Ambiguous word detection using a predefined word list (e.g., "maybe", "possibly", "somehow", "TBD", "FIXME", "etc.", "and so on").

### Constraints

- Zero external dependencies. Pure domain logic only.
- No AI or machine learning APIs. All detection is rule-based and deterministic.
- Must include a `.reqs.md` sidecar file documenting requirements traceability.

## Acceptance Criteria

1. All 4 inconsistency types (contradiction, duplicate, missing_context, ambiguity) are detected.
2. Each inconsistency is correctly classified by severity (critical, warning, info).
3. `generateSuggestion` returns actionable, human-readable suggestions without AI.
4. Zero external dependencies in the inconsistency detector module.
5. Test coverage exceeds 90%.
6. `.reqs.md` sidecar file is created with requirements traceability.

## Triple Deliverable

- **Source Code**: `src/backend/services/scoring/inconsistency-detector.ts` with detection, classification, and suggestion logic.
- **Tests**: `src/backend/services/scoring/__tests__/inconsistency-detector.test.ts` with >90% coverage.
- **Requirements**: `src/backend/services/scoring/inconsistency-detector.reqs.md` sidecar file.

## Risks

- **False positives**: Rule-based detection may flag valid content as inconsistent. Mitigate with tunable thresholds and comprehensive test cases covering edge scenarios.
- **Limited detection depth**: Without AI, complex semantic inconsistencies may be missed. Mitigate by focusing on high-confidence patterns and documenting known limitations.
- **Ambiguity word list maintenance**: The predefined word list requires ongoing updates. Mitigate by externalizing the list to a configuration file.

## QA Gates

### Pre-Implementation Gates
- [ ] **GATE-READY**: All dependencies (RTASK-005) are completed
- [ ] **GATE-SPEC**: Rulebook sections ARCH-SOLID-002, ROVO-INTEG-002, ROVO-INTEG-003 have been read and understood
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
1. Read the full task spec (`docs/tickets/TASK-007-domain-inconsistency-detector.md`)
2. Read referenced rulebook sections (`docs/rulebook/RULEBOOK.md` → ARCH-SOLID-002, ROVO-INTEG-002, ROVO-INTEG-003)
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
4. Run `npm run test:unit` — must pass with > 90% coverage
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
- [ ] Rulebook rules ARCH-SOLID-002, ROVO-INTEG-002, ROVO-INTEG-003 are satisfied

### Rejection Criteria
The critic MUST reject if:
- Any `any` type is present
- Coverage is below the required threshold (90%)
- A `.reqs.md` sidecar is missing
- A `.spec.ts` test file is missing (where applicable)
- Structured logging is absent
- Error handling is missing or generic (`catch (e) { }`)
- External dependencies were added without approval

## Testing Protocol

### Unit Tests (`tests/unit/services/scoring/`)
- Location: Mirror production path under `tests/unit/`
- Naming: `[filename].spec.ts`
- Coverage target: 90%
- Pattern: Arrange-Act-Assert (AAA)
- Must test: Happy path, error paths, edge cases, boundary values

### Test Categories Required
- [ ] **Happy path**: Detection rules identify all 4 inconsistency types correctly
- [ ] **Error handling**: Graceful handling of malformed ticket data
- [ ] **Edge cases**: Empty ticket fields, null descriptions, boundary similarity thresholds
- [ ] **Integration points**: Classification and suggestion generation work with detection output

### Mock Strategy
- No external dependencies to mock — pure domain logic
- Use deterministic test fixtures for detection inputs
- Reset mocks between tests (`beforeEach`)
