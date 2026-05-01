---
id: RTASK-034
title: 'Orchestration Layer - Rovo Agent Actions Handler'
status: pending
priority: 3
type: orchestration
dependencies: [RTASK-033, RTASK-006, RTASK-007, RTASK-009, RTASK-010, RTASK-011, RTASK-012]
rulebook_refs: [ROVO-INTEG-001, ROVO-INTEG-002, GH-INTEG-001, FORGE-OPS-001]
spec: docs/tickets/TASK-034-orchestration-rovo-agent-actions.md
---

# RTASK-034: Orchestration Layer - Rovo Agent Actions Handler

## Objective

Implement the Forge function handler that routes the 5 Rovo Agent actions to the existing backend services (scoring engine, inconsistency detector, evaluation pipeline, adapters). This handler is the bridge between the Rovo Agent's LLM-driven invocations and the app's business logic, returning structured data that the agent can consume to generate intelligent responses.

## Context

RTASK-033 defines the `rovo:agent` and `action` modules in the manifest, plus the agent prompt. This task implements the actual Forge function (`agent-action-fn`) that backs all 5 actions. The handler receives action invocations from the Rovo Agent LLM, routes them to the appropriate service functions, and returns structured results.

The handler follows the same thin-entry-point pattern used by the existing resolvers (`src/resolver-handler.ts` re-exports from `src/backend/resolvers/index.ts`).

### Action-to-Service Mapping

| Action                    | Primary Services                                                          | Returns                                                     |
| ------------------------- | ------------------------------------------------------------------------- | ----------------------------------------------------------- |
| `evaluate-issue`          | evaluation-pipeline, jira-adapter, scoring-engine, inconsistency-detector | Full ConsistencyScore + Inconsistency[] + QualityGateResult |
| `check-pr-consistency`    | jira-adapter, github-adapter, scoring-engine                              | PR-Issue alignment analysis                                 |
| `validate-spec-alignment` | rovo-adapter (getContext, getDocumentation), inconsistency-detector       | Spec alignment report                                       |
| `explain-score`           | jira-adapter, scoring-engine (calculateScore, generateAxisSuggestions)    | Per-axis breakdown with signals                             |
| `get-improvement-tips`    | jira-adapter, scoring-engine, inconsistency-detector                      | Prioritized suggestions by axis                             |

## Technical Specification

### Location

- `src/agent-action-handler.ts` (create — thin entry point)
- `src/backend/resolvers/agent-actions.ts` (create — handler logic)

### Entry Point (`src/agent-action-handler.ts`)

Thin re-export following existing pattern:

```typescript
export { handler } from './backend/resolvers/agent-actions';
```

### Handler (`src/backend/resolvers/agent-actions.ts`)

#### Types

```typescript
interface ActionContext {
  readonly cloudId: string;
  readonly moduleKey: string;
  readonly jira?: {
    readonly url: string;
    readonly resourceType: string;
    readonly issueKey: string;
    readonly issueId: number;
    readonly issueType: string;
    readonly projectKey: string;
    readonly projectId: number;
  };
}

interface ActionInput {
  readonly issueKey?: string;
  readonly prUrl?: string;
  readonly focusAxis?: string;
}

interface ActionResponse<T> {
  readonly success: boolean;
  readonly data?: T;
  readonly error?: string;
  readonly executionId: string;
}
```

#### Handler Signature

```typescript
export const handler = async (payload: {
  context: ActionContext;
  issueKey?: string;
  prUrl?: string;
  focusAxis?: string;
}): Promise<ActionResponse<unknown>>;
```

#### Routing Logic

The handler extracts the `moduleKey` from `context` to determine which action was invoked, then dispatches to the appropriate sub-handler:

```typescript
const ACTION_HANDLERS: Record<string, ActionHandler> = {
  'evaluate-issue': handleEvaluateIssue,
  'check-pr-consistency': handleCheckPRConsistency,
  'validate-spec-alignment': handleValidateSpecAlignment,
  'explain-score': handleExplainScore,
  'get-improvement-tips': handleGetImprovementTips,
};
```

#### Sub-Handlers

**1. `handleEvaluateIssue(input, context)`**

- Fetches ticket data via `jira-adapter.getTicketData(issueKey)`
- Fetches project config via `jira-adapter.getProjectConfig(projectKey)`
- Invokes evaluation pipeline or manual scoring:
  - `scoring-engine.calculateScore(ticketData, config)`
  - `inconsistency-detector.detectInconsistencies(ticketData, rovoContext)`
  - `quality-gate-rules.evaluateGate(gateType, score, inconsistencies, config)`
- Returns: `{ score, axes, axisDetails, inconsistencies, gateResults, threshold }`

**2. `handleCheckPRConsistency(input, context)`**

- Parses `prUrl` to extract `owner`, `repo`, `prNumber`
- Fetches PR data via `github-adapter.getPRData(repo, prNumber, token)`
- Fetches Jira ticket via `jira-adapter.getTicketData(issueKey)`
- Compares PR scope vs issue scope (title similarity, body overlap, file changes vs acceptance criteria)
- Returns: `{ alignment: 'aligned' | 'partial' | 'misaligned', prSummary, issueSummary, gaps: string[] }`

**3. `handleValidateSpecAlignment(input, context)`**

- Fetches ticket data via `jira-adapter.getTicketData(issueKey)`
- Fetches Rovo context via `rovo-adapter.getContext(ticketData.summary, projectKey)`
- Fetches related documentation via `rovo-adapter.getDocumentation(ticketData.summary)`
- Runs inconsistency detection against context
- Returns: `{ alignedSpecs: SpecSummary[], misalignedSpecs: Misalignment[], suggestions: string[] }`

**4. `handleExplainScore(input, context)`**

- Fetches ticket data via `jira-adapter.getTicketData(issueKey)`
- Fetches project config via `jira-adapter.getProjectConfig(projectKey)`
- Calculates score via `scoring-engine.calculateScore(ticketData, config)`
- Generates axis suggestions via `scoring-engine.generateAxisSuggestions(score, axisKey)` for each axis
- Returns: `{ overallScore, threshold, axes: AxisExplanation[] }` where each `AxisExplanation` includes `name, score, weight, description, signals, suggestions`

**5. `handleGetImprovementTips(input, context)`**

- Fetches ticket data via `jira-adapter.getTicketData(issueKey)`
- Fetches project config via `jira-adapter.getProjectConfig(projectKey)`
- Calculates score and detects inconsistencies
- If `focusAxis` is provided, filters suggestions to that axis only
- Sorts suggestions by impact (lowest-scoring axes first)
- Returns: `{ overallScore, threshold, prioritizedTips: AxisTip[] }` where `AxisTip` includes `axis, currentScore, targetScore, tips: string[]}`

#### Error Handling

Each sub-handler must:

- Catch all errors and wrap them in `ActionResponse<unknown>` with `success: false` and descriptive error message
- Use `generateExecutionId()` for traceability
- Never throw unhandled exceptions (the LLM must receive a structured error it can communicate to the user)
- Handle specific error types:
  - `TicketNotFoundError` → "The issue {issueKey} was not found"
  - `InsufficientDataError` → "Not enough data to evaluate {issueKey}"
  - `TimeoutError` → "Evaluation timed out for {issueKey}"
  - Generic errors → "An unexpected error occurred while evaluating {issueKey}"

#### Structured Logging

All operations must log:

- `executionId` for correlation
- `actionKey` (which action was invoked)
- `issueKey` or `prUrl` (target)
- `duration` (execution time)
- `success` (outcome)
- Error details on failure

## Acceptance Criteria

- [ ] AC-01: `src/agent-action-handler.ts` created as thin re-export
- [ ] AC-02: `src/backend/resolvers/agent-actions.ts` exports a `handler` function
- [ ] AC-03: Handler routes all 5 action keys to dedicated sub-handlers
- [ ] AC-04: `handleEvaluateIssue` returns full score + inconsistencies + gate status
- [ ] AC-05: `handleCheckPRConsistency` returns PR-issue alignment analysis
- [ ] AC-06: `handleValidateSpecAlignment` returns spec alignment report
- [ ] AC-07: `handleExplainScore` returns per-axis breakdown with signals
- [ ] AC-08: `handleGetImprovementTips` returns prioritized suggestions by axis
- [ ] AC-09: All errors caught and returned as structured `ActionResponse` (never throws)
- [ ] AC-10: Structured logging with `executionId`, `actionKey`, `duration`, `success` on every invocation
- [ ] AC-11: Test coverage exceeds 85%
- [ ] AC-12: `.reqs.md` sidecar file created

## QA Gates

### Pre-Implementation Gates

- [ ] **GATE-READY**: All dependencies (RTASK-033, RTASK-006, RTASK-007, RTASK-009, RTASK-010, RTASK-011, RTASK-012) are completed
- [ ] **GATE-SPEC**: Rulebook sections ROVO-INTEG-001, ROVO-INTEG-002, GH-INTEG-001, FORGE-OPS-001 have been read and understood
- [ ] **GATE-DESIGN**: Action routing and sub-handler signatures documented before coding

### Implementation Gates (per sub-handler)

- [ ] **GATE-RED**: Write failing test FIRST for each sub-handler
- [ ] **GATE-GREEN**: Write minimum code to make test pass
- [ ] **GATE-REFACTOR**: Clean up code while keeping tests green

### Post-Implementation Gates

- [ ] **GATE-TYPECHECK**: `pnpm typecheck` passes with zero errors
- [ ] **GATE-LINT**: `pnpm lint` passes with zero warnings
- [ ] **GATE-FORMAT**: `pnpm format:check` passes
- [ ] **GATE-TEST**: `pnpm test:unit` passes with coverage > 85%
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

1. Read all dependency task outputs to understand available service interfaces
2. Read `src/backend/resolvers/index.ts` for existing resolver patterns
3. Read `src/backend/services/evaluation/evaluation-pipeline.ts` for pipeline invocation pattern
4. Create `.reqs.md` sidecar files with requirements traceability

### Step 2: TDD Cycle (per sub-handler)

1. **RED**: Write a failing test that defines expected behavior for one sub-handler
2. **GREEN**: Write the minimum code to make the test pass
3. **REFACTOR**: Clean up while keeping all tests green
4. Repeat for next sub-handler

### Step 3: Integration

1. Create entry point `src/agent-action-handler.ts`
2. Wire routing logic in handler
3. Verify manifest function handler path matches

### Step 4: Validation

1. Run `pnpm typecheck` — must pass
2. Run `pnpm lint` — must pass with zero warnings
3. Run `pnpm format:check` — must pass
4. Run `pnpm test:unit` — must pass with > 85% coverage
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
- [ ] Rulebook rules ROVO-INTEG-001, ROVO-INTEG-002, GH-INTEG-001, FORGE-OPS-001 are satisfied

### Rejection Criteria

The critic MUST reject if:

- Any `any` type is present
- Coverage is below the required threshold (85%)
- A `.reqs.md` sidecar is missing
- A `.spec.ts` test file is missing
- Structured logging is absent
- Error handling is missing or generic (`catch (e) { }`)
- External dependencies were added without approval
- Handler throws unhandled exceptions instead of returning structured errors

## Testing Protocol

### Unit Tests (`tests/unit/resolvers/`)

- Location: `tests/unit/resolvers/agent-actions.spec.ts`
- Coverage target: 85%
- Pattern: Arrange-Act-Assert (AAA)

### Test Categories Required

- [ ] **Happy path**: Each of the 5 sub-handlers returns correct structured data
- [ ] **Routing**: Handler correctly dispatches based on `moduleKey`
- [ ] **Error handling**: Each sub-handler catches and returns structured errors for:
  - `TicketNotFoundError`
  - `InsufficientDataError`
  - `TimeoutError`
  - Generic unexpected errors
- [ ] **Edge cases**: Empty inputs, missing optional fields, invalid issue keys
- [ ] **Integration points**: Mocked adapter/service calls return expected data shapes

### Mock Strategy

- Mock all adapter functions (jira-adapter, github-adapter, rovo-adapter, confluence-adapter)
- Mock scoring-engine and inconsistency-detector functions
- Mock evaluation-pipeline if used
- Use `jest.fn()` for function mocks
- Reset mocks between tests (`beforeEach`)

## Triple Deliverable

| Production                               | Sidecar                                       | Test                                         |
| ---------------------------------------- | --------------------------------------------- | -------------------------------------------- |
| `src/agent-action-handler.ts`            | -                                             | Validated by integration with manifest       |
| `src/backend/resolvers/agent-actions.ts` | `src/backend/resolvers/agent-actions.reqs.md` | `tests/unit/resolvers/agent-actions.spec.ts` |

## Risks

| Risk                                                          | Mitigation                                                                      |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Rovo action payload format differs from documented spec       | Add defensive parsing with type guards; log raw payload for debugging           |
| Service functions throw unexpected error types                | Wrap all sub-handler logic in try-catch with generic fallback error response    |
| Large response data exceeds agent payload limit (5MB)         | Truncate responses; include summary with key metrics only                       |
| Action context missing Jira info when invoked from Confluence | Handle optional `context.jira` gracefully; require `issueKey` input as fallback |
| Service calls slow down agent response                        | Add per-sub-handler timeout (10s default); return partial results on timeout    |
