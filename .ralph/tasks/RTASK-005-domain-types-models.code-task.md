---
id: RTASK-005
title: "Domain Layer - Types and Models"
status: pending
priority: 1
type: domain
dependencies: [RTASK-001, RTASK-003]
rulebook_refs: [ARCH-SOLID-001, ARCH-SOLID-002, ARCH-SOLID-003]
spec: docs/tickets/TASK-005-domain-types-models.md
---

# RTASK-005: Domain Layer - Types and Models

## Objective

Define the complete domain type system for the Rovo Execution Guard. These types are the contract for the entire application — every module depends on them. Types must be immutable, discriminated, zero `any`, and auto-documented.

## Context

This is the most critical task. An error in these types propagates to all 25+ modules. The types must have zero external dependencies and no runtime logic — pure type definitions only.

## Technical Specification

### Constraints
- **Zero external dependencies**: Types import nothing from outside `src/backend/types/`
- **Naming**: PascalCase interfaces/types, camelCase properties
- **Composition over inheritance**: Prefer intersection types over `extends`
- **Immutability**: All interface properties are `readonly`
- **No enums**: Use string literal union types instead
- **Discriminated unions**: Use literal `type` fields for variants

### File Structure (12 files)

```
src/backend/types/
  errors.ts              # Error hierarchy
  consistency-score.ts   # ConsistencyScore, ScoreAxes
  inconsistency.ts       # Inconsistency, InconsistencyType, Severity
  quality-gate.ts        # QualityGateResult, GateType
  project-config.ts      # ProjectConfig, GateConfig
  enforcement.ts         # EnforcementAction (discriminated union)
  rovo-context.ts        # RovoContext, RovoDocument, HistoricalDecision
  jira-data.ts           # JiraTicketData, JiraTransition, JiraStatus
  github-data.ts         # GitHubPRData, PRFile, GitHubStatusCheck
  confluence-data.ts     # ConfluencePageData, ConfluencePageMetadata
  audit-log.ts           # AuditLogEntry, AuditAction
  index.ts               # Barrel file - re-exports everything
```

### Type Definitions

#### `errors.ts`
```typescript
export class REGError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly executionId?: string,
  ) {
    super(message);
    this.name = 'REGError';
  }
}

export class ScoringError extends REGError { ... }
export class InsufficientDataError extends ScoringError { ... }
export class JiraApiError extends REGError { ... }
export class TicketNotFoundError extends JiraApiError { ... }
export class RovoApiError extends REGError { ... }
export class QuotaExceededError extends RovoApiError { ... }
export class GitHubApiError extends REGError { ... }
export class TokenExpiredError extends GitHubApiError { ... }
export class TimeoutError extends REGError { ... }
export class CircuitOpenError extends REGError { ... }
```
Total: 10 error classes in hierarchy.

#### `consistency-score.ts`
```typescript
export interface ConsistencyScore {
  readonly overall: number;
  readonly axes: ScoreAxes;
  readonly timestamp: string;
  readonly executionId: string;
}

export interface ScoreAxes {
  readonly clarity: number;
  readonly consistency: number;
  readonly risk: number;
  readonly documentation: number;
  readonly technicalDebt: number;
}
```

#### `inconsistency.ts`
```typescript
export type InconsistencyType = 'contradiction' | 'duplicate' | 'missing_context' | 'ambiguity';
export type Severity = 'critical' | 'warning' | 'info';
export type InconsistencySource = 'rovo' | 'jira' | 'confluence' | 'github';

export interface Inconsistency {
  readonly id: string;
  readonly type: InconsistencyType;
  readonly severity: Severity;
  readonly source: InconsistencySource;
  readonly description: string;
  readonly affectedTicketKey: string;
  readonly relatedDocs?: readonly string[];
  readonly suggestion?: string;
}
```

#### `quality-gate.ts`
```typescript
export type GateType = 'definition' | 'execution' | 'delivery';

export interface QualityGateResult {
  readonly gate: GateType;
  readonly passed: boolean;
  readonly score: ConsistencyScore;
  readonly inconsistencies: readonly Inconsistency[];
  readonly blockedTransitions: readonly string[];
  readonly executionId: string;
}
```

#### `project-config.ts`
```typescript
export interface ProjectConfig {
  readonly projectKey: string;
  readonly enabled: boolean;
  readonly scoreThreshold: number;
  readonly gates: GateConfig;
  readonly githubRepo?: string;
  readonly githubOwner?: string;
}

export interface GateConfig {
  readonly definition: boolean;
  readonly execution: boolean;
  readonly delivery: boolean;
}
```

#### `enforcement.ts`
```typescript
export type EnforcementAction =
  | BlockTransitionAction
  | BlockPRAction
  | AddCommentAction
  | FlagInconsistencyAction;

interface BlockTransitionAction {
  readonly type: 'block_transition';
  readonly transitionId: string;
  readonly reason: string;
}

interface BlockPRAction {
  readonly type: 'block_pr';
  readonly prNumber: number;
  readonly repo: string;
  readonly reason: string;
}

interface AddCommentAction {
  readonly type: 'add_comment';
  readonly target: 'jira' | 'github';
  readonly body: string;
}

interface FlagInconsistencyAction {
  readonly type: 'flag_inconsistency';
  readonly inconsistency: Inconsistency;
}
```

#### `rovo-context.ts`
```typescript
export interface RovoContext {
  readonly documents: readonly RovoDocument[];
  readonly relatedTickets: readonly string[];
  readonly decisions: readonly HistoricalDecision[];
  readonly query: string;
  readonly timestamp: string;
}

export interface RovoDocument {
  readonly id: string;
  readonly title: string;
  readonly content: string;
  readonly source: string;
  readonly relevance: number; // 0-1
}

export interface HistoricalDecision {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly date: string;
  readonly source: string;
}
```

#### `jira-data.ts`
```typescript
export interface JiraTicketData {
  readonly key: string;
  readonly summary: string;
  readonly description: string;
  readonly status: string;
  readonly assignee?: string;
  readonly reporter?: string;
  readonly priority?: string;
  readonly issueType: string;
  readonly labels: readonly string[];
  readonly projectKey: string;
  readonly created: string;
  readonly updated: string;
}

export interface JiraTransition {
  readonly id: string;
  readonly name: string;
  readonly toStatus: string;
}

export type JiraStatus = 'TO DO' | 'IN PROGRESS' | 'IN REVIEW' | 'DONE';
```

#### `github-data.ts`
```typescript
export interface GitHubPRData {
  readonly number: number;
  readonly title: string;
  readonly body: string;
  readonly state: 'open' | 'closed' | 'merged';
  readonly branch: string;
  readonly baseBranch: string;
  readonly files: readonly PRFile[];
  readonly url: string;
}

export interface PRFile {
  readonly filename: string;
  readonly status: 'added' | 'modified' | 'removed';
  readonly additions: number;
  readonly deletions: number;
}

export interface GitHubStatusCheck {
  readonly state: 'pending' | 'success' | 'failure' | 'error';
  readonly targetUrl: string;
  readonly description: string;
  readonly context: string;
}
```

#### `confluence-data.ts`
```typescript
export interface ConfluencePageData {
  readonly id: string;
  readonly title: string;
  readonly content: string;
  readonly spaceKey: string;
  readonly url: string;
  readonly lastUpdated: string;
}

export interface ConfluencePageMetadata {
  readonly id: string;
  readonly title: string;
  readonly spaceKey: string;
  readonly labels: readonly string[];
  readonly version: number;
  readonly lastUpdated: string;
}
```

#### `audit-log.ts`
```typescript
export type AuditAction =
  | 'gate_evaluated'
  | 'ticket_blocked'
  | 'ticket_approved'
  | 'pr_blocked'
  | 'pr_approved'
  | 'config_updated'
  | 'inconsistency_flagged'
  | 'enforcement_executed';

export interface AuditLogEntry {
  readonly id: string;
  readonly action: AuditAction;
  readonly timestamp: string;
  readonly executionId: string;
  readonly projectKey: string;
  readonly ticketKey?: string;
  readonly prNumber?: number;
  readonly userId?: string;
  readonly details: Record<string, unknown>;
}
```

#### `index.ts` (barrel)
Re-export all types, interfaces, type aliases, and error classes. Organize by category with comments.

### Generation Order (respect dependencies)
1. `errors.ts` — base, no internal deps
2. `consistency-score.ts` — no internal deps
3. `inconsistency.ts` — no internal deps
4. `quality-gate.ts` — depends on consistency-score + inconsistency
5. `project-config.ts` — no internal deps
6. `enforcement.ts` — depends on inconsistency
7. `rovo-context.ts` — no internal deps
8. `jira-data.ts` — no internal deps
9. `github-data.ts` — no internal deps
10. `confluence-data.ts` — no internal deps
11. `audit-log.ts` — depends on inconsistency (indirectly)
12. `index.ts` — barrel, MUST be last

## Acceptance Criteria

- [ ] AC-01: All 12 .ts files created in `src/backend/types/`
- [ ] AC-02: All 12 .reqs.md sidecars created
- [ ] AC-03: All 12 .spec.ts test files created in `tests/unit/types/`
- [ ] AC-04: `npm run typecheck` passes
- [ ] AC-05: `npm run lint` passes with zero warnings
- [ ] AC-06: Zero `any` usage (grep returns empty)
- [ ] AC-07: All interfaces have `readonly` properties
- [ ] AC-08: Discriminated unions have literal `type` fields
- [ ] AC-09: Error hierarchy has 10 classes with proper `super()` calls
- [ ] AC-10: Barrel file exports all types correctly
- [ ] AC-11: Zero imports from outside `src/backend/types/`
- [ ] AC-12: No circular imports (only barrel re-exports)

## Triple Deliverable (36 files total)

| Production (.ts) | Sidecar (.reqs.md) | Test (.spec.ts) |
|------------------|-------------------|-----------------|
| `src/backend/types/errors.ts` | `src/backend/types/errors.reqs.md` | `tests/unit/types/errors.spec.ts` |
| `src/backend/types/consistency-score.ts` | `src/backend/types/consistency-score.reqs.md` | `tests/unit/types/consistency-score.spec.ts` |
| `src/backend/types/inconsistency.ts` | `src/backend/types/inconsistency.reqs.md` | `tests/unit/types/inconsistency.spec.ts` |
| `src/backend/types/quality-gate.ts` | `src/backend/types/quality-gate.reqs.md` | `tests/unit/types/quality-gate.spec.ts` |
| `src/backend/types/project-config.ts` | `src/backend/types/project-config.reqs.md` | `tests/unit/types/project-config.spec.ts` |
| `src/backend/types/enforcement.ts` | `src/backend/types/enforcement.reqs.md` | `tests/unit/types/enforcement.spec.ts` |
| `src/backend/types/rovo-context.ts` | `src/backend/types/rovo-context.reqs.md` | `tests/unit/types/rovo-context.spec.ts` |
| `src/backend/types/jira-data.ts` | `src/backend/types/jira-data.reqs.md` | `tests/unit/types/jira-data.spec.ts` |
| `src/backend/types/github-data.ts` | `src/backend/types/github-data.reqs.md` | `tests/unit/types/github-data.spec.ts` |
| `src/backend/types/confluence-data.ts` | `src/backend/types/confluence-data.reqs.md` | `tests/unit/types/confluence-data.spec.ts` |
| `src/backend/types/audit-log.ts` | `src/backend/types/audit-log.reqs.md` | `tests/unit/types/audit-log.spec.ts` |
| `src/backend/types/index.ts` | `src/backend/types/index.reqs.md` | `tests/unit/types/index.spec.ts` |

## Risks

| Risk | Mitigation |
|------|------------|
| Types too generic | Be specific: literal types, discriminated unions |
| Types too rigid | Use optional fields for extension points |
| Missing types leads to `any` later | Define everything info.txt describes |
| Circular imports | Only barrel imports, no cross-file deps |

## QA Gates

### Pre-Implementation Gates
- [ ] **GATE-READY**: All dependencies (RTASK-001, RTASK-003) are completed
- [ ] **GATE-SPEC**: Rulebook sections ARCH-SOLID-001, ARCH-SOLID-002, ARCH-SOLID-003 have been read and understood
- [ ] **GATE-DESIGN**: Implementation approach documented before coding

### Implementation Gates (per file/function)
- [ ] **GATE-RED**: Write failing test FIRST for each function/component
- [ ] **GATE-GREEN**: Write minimum code to make test pass
- [ ] **GATE-REFACTOR**: Clean up code while keeping tests green

### Post-Implementation Gates
- [ ] **GATE-TYPECHECK**: `npm run typecheck` passes with zero errors
- [ ] **GATE-LINT**: `npm run lint` passes with zero warnings
- [ ] **GATE-FORMAT**: `npm run format:check` passes
- [ ] **GATE-TEST**: `npm run test:unit` passes with coverage > 95%
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
1. Read the full task spec (`docs/tickets/TASK-005-domain-types-models.md`)
2. Read referenced rulebook sections (`docs/rulebook/RULEBOOK.md` → ARCH-SOLID-001, ARCH-SOLID-002, ARCH-SOLID-003)
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
4. Run `npm run test:unit` — must pass with > 95% coverage
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
- [ ] Rulebook rules ARCH-SOLID-001, ARCH-SOLID-002, ARCH-SOLID-003 are satisfied

### Rejection Criteria
The critic MUST reject if:
- Any `any` type is present
- Coverage is below the required threshold (95%)
- A `.reqs.md` sidecar is missing
- A `.spec.ts` test file is missing (where applicable)
- Structured logging is absent
- Error handling is missing or generic (`catch (e) { }`)
- External dependencies were added without approval

## Testing Protocol

### Unit Tests (`tests/unit/types/`)
- Location: Mirror production path under `tests/unit/`
- Naming: `[filename].spec.ts`
- Coverage target: 95%
- Pattern: Arrange-Act-Assert (AAA)
- Must test: Happy path, error paths, edge cases, boundary values

### Test Categories Required
- [ ] **Happy path**: Type compilation succeeds with valid definitions
- [ ] **Error handling**: Error hierarchy instantiates correctly with proper `super()` calls
- [ ] **Edge cases**: Empty inputs, null/undefined, boundary values for type guards
- [ ] **Integration points**: Barrel file re-exports all types correctly

### Mock Strategy
- No mocks needed — pure type definitions with zero external dependencies
- Use type compilation tests and barrel export tests
- Reset mocks between tests (`beforeEach`)
