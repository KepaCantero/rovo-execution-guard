# REQUISITOS: Agent Action Handler

> **Sidecar File** | Vinculado a: `src/backend/resolvers/agent-action.ts`

---

## Descripcion

Forge function handler that routes 5 Rovo Agent actions (evaluate-issue, check-pr-consistency, validate-spec-alignment, explain-score, get-improvement-tips) to existing backend services. This handler is the bridge between the Rovo Agent's LLM-driven invocations and the app's business logic, returning structured data that the agent can consume to generate intelligent responses.

Also defines core types (ActionContext, ActionInput, ActionResponse, ActionHandler, ActionLogEntry) and utility functions (generateActionExecutionId, formatActionError, logAction, actionSuccess, actionFailure).

---

## Acceptance Criteria

- [x] **AC-01**: `src/agent-action-handler.ts` created as thin re-export
- [x] **AC-02**: `src/backend/resolvers/agent-action.ts` exports types (ActionContext, ActionInput, ActionResponse, ActionHandler, ActionLogEntry)
- [x] **AC-03**: Handler routes all 5 action keys to dedicated sub-handlers via ACTION_HANDLERS record
- [x] **AC-04**: `handleEvaluateIssue` returns full score + inconsistencies + gate status
- [x] **AC-05**: `handleCheckPRConsistency` returns PR-issue alignment analysis with aligned/partial/misaligned classification
- [x] **AC-06**: `handleValidateSpecAlignment` returns spec alignment report with aligned/misaligned specs and suggestions
- [x] **AC-07**: `handleExplainScore` returns per-axis breakdown with signals and suggestions
- [x] **AC-08**: `handleGetImprovementTips` returns prioritized suggestions by axis (sorted by lowest score first)
- [x] **AC-09**: All errors caught and returned as structured `ActionResponse` (never throws)
- [x] **AC-10**: Structured logging with `executionId`, `actionKey`, `duration`, `success` on every invocation
- [x] **AC-11**: Test coverage exceeds 85% (60 tests passing)
- [x] **AC-12**: `.reqs.md` sidecar file created (this file)

---

## Reglas del Rulebook

| ID Regla            | Categoria    | Descripcion breve                                          |
| ------------------- | ------------ | ---------------------------------------------------------- |
| [ARCH-SOLID-058]    | Arquitectura | HANDLER layer — resolvers are in HANDLER layer             |
| [ARCH-SOLID-006]    | Arquitectura | Handler -> Service -> Repository pattern                   |
| [ARCH-SOLID-202]    | Arquitectura | Zero any usage — generic ActionResponse<T>                 |
| [ARCH-SOLID-232]    | Arquitectura | Named exports only, no export default                      |
| [ARCH-SOLID-049-03] | Arquitectura | Interfaces for LSP/mocking                                 |
| [ARCH-SOLID-052]    | Arquitectura | Functions ≤ 20 lines                                       |
| [ARCH-SOLID-053]    | Arquitectura | Domain-specific error types for all failure paths          |
| [ARCH-SOLID-203]    | Arquitectura | Standard response wrapper pattern                          |
| [FORGE-OPS-005]     | Forge Ops    | No invocation exceeds 10s                                  |
| [FORGE-OPS-0101]    | Forge Ops    | Complete critical work in 8s                               |
| [FORGE-OPS-0105]    | Forge Ops    | Stateless functions, no module-level mutable state         |
| [FORGE-OPS-054]     | Forge Ops    | Graceful degradation when services unavailable             |
| [SEC-PRIV-002]      | Seguridad    | No tokens/PII in logs — only operation metadata            |
| [ROVO-INTEG-002]    | Rovo         | Rovo context for documentation cross-reference             |
| [ROVO-INTEG-004]    | Rovo         | Untrusted data — validate before use                       |
| [ROVO-INTEG-054]    | Rovo         | Communication contracts as versioned TypeScript interfaces |
| [ROVO-INTEG-060]    | Rovo         | Never assume complete information — optional jira context  |
| [GH-INTEG-001]      | GitHub       | GitHub adapter for PR data                                 |
| [TEST-QA-036-03]    | Testing      | Structured context with executionId and actionKey          |

---

## Contrato Publico (API del modulo)

### Tipos exportados

#### `ActionContext`

- **Proposito**: Rovo Agent invocation context
- **Campos**: `cloudId`, `moduleKey`, optional `jira` (with `url`, `resourceType`, `issueKey`, `issueId`, `issueType`, `projectKey`, `projectId`)
- **Regla**: [ROVO-INTEG-004], [ROVO-INTEG-060]

#### `ActionInput`

- **Proposito**: Action invocation parameters
- **Campos**: optional `issueKey`, `prUrl`, `focusAxis`
- **Regla**: [ROVO-INTEG-060]

#### `ActionResponse<T>`

- **Proposito**: Standard response wrapper for all action results
- **Campos**: `success`, optional `data: T`, optional `error`, `executionId`
- **Regla**: [ARCH-SOLID-203]

#### `ActionHandler`

- **Proposito**: Type alias for sub-handler function signatures
- **Signature**: `(input: ActionInput, context: ActionContext) => Promise<ActionResponse<unknown>>`
- **Regla**: [ARCH-SOLID-049-03]

#### `ActionLogEntry`

- **Proposito**: Structured log entry for action operations
- **Campos**: `timestamp`, `level`, `actionKey`, `executionId`, optional `duration`, `success`, optional `issueKey`, `prUrl`, `error`
- **Regla**: [SEC-PRIV-002]

### Funciones exportadas

#### `generateActionExecutionId(): string`

- **Proposito**: Generate unique execution ID with `act-` prefix
- **Post-condiciones**: Returns string matching `act-{timestamp}-{random}`
- **Regla**: [FORGE-OPS-0105]

#### `formatActionError(error: unknown, issueKey?: string): string`

- **Proposito**: Maps domain errors to user-friendly messages
- **Errores**: TicketNotFoundError → "not found", InsufficientDataError → "insufficient data", TimeoutError → "timed out", generic → "unexpected error"
- **Regla**: [ARCH-SOLID-053], [FORGE-OPS-054]

#### `logAction(entry: ActionLogEntry): void`

- **Proposito**: Emits structured JSON log entry
- **Post-condiciones**: console.log with JSON stringified entry
- **Regla**: [SEC-PRIV-002], [TEST-QA-036-03]

#### `actionSuccess<T>(data: T, executionId: string): ActionResponse<T>`

- **Proposito**: Build success response
- **Post-condiciones**: Returns `{ success: true, data, executionId }`
- **Regla**: [ARCH-SOLID-203]

#### `actionFailure(error: string, executionId: string): ActionResponse<never>`

- **Proposito**: Build failure response
- **Post-condiciones**: Returns `{ success: false, error, executionId }`
- **Regla**: [ARCH-SOLID-203]

#### `handler(payload, forgeContext): Promise<ActionResponse<unknown>>`

- **Proposito**: Forge-compatible handler for Rovo Agent action invocations
- **Pre-condiciones**: payload contains optional `context` with `moduleKey`
- **Post-condiciones**: Routes to sub-handler via ACTION_HANDLERS record, returns structured ActionResponse, logs invocation
- **Errores**: Never throws — all errors caught and returned as ActionResponse
- **Regla**: [FORGE-OPS-005], [AC-09], [AC-10]

### Sub-handlers (internal)

#### `handleEvaluateIssue(input, context)` — AC-04

- Calls: getTicketData, getProjectConfig, detectInconsistencies, calculateScore, evaluateGate
- Returns: `{ score, axes, axisDetails, inconsistencies, gateResults?, threshold? }`

#### `handleCheckPRConsistency(input, context)` — AC-05

- Calls: getTicketData, getPRData (via parsePrUrl)
- Returns: `{ alignment: 'aligned'|'partial'|'misaligned', prSummary, issueSummary, gaps }`

#### `handleValidateSpecAlignment(input, context)` — AC-06

- Calls: getTicketData, getContext (graceful), getDocumentation (graceful), detectInconsistencies
- Returns: `{ alignedSpecs, misalignedSpecs, suggestions }`

#### `handleExplainScore(input, context)` — AC-07

- Calls: getTicketData, getProjectConfig, calculateScore, generateAxisSuggestions
- Returns: `{ overallScore, threshold?, axes: Array<{name, score, description, signals, suggestions}> }`

#### `handleGetImprovementTips(input, context)` — AC-08

- Calls: getTicketData, getProjectConfig, detectInconsistencies, calculateScore, generateAxisSuggestions
- Returns: `{ overallScore, threshold?, prioritizedTips: Array<{axis, currentScore, targetScore, tips}> }`
- Notes: Sorted by lowest score first; filters to focusAxis if provided

---

## Dependencias (imports)

### Internas (proyecto)

- `src/backend/services/jira/jira-adapter` -> `getTicketData`, `getProjectConfig`
- `src/backend/services/scoring/scoring-engine` -> `calculateScore`, `generateAxisSuggestions`
- `src/backend/services/scoring/inconsistency-detector` -> `detectInconsistencies`
- `src/backend/services/scoring/quality-gate-rules` -> `evaluateGate`
- `src/backend/services/github/github-adapter` -> `getPRData`
- `src/backend/services/rovo/rovo-adapter` -> `getContext`, `getDocumentation`
- `src/backend/types/errors` -> `TicketNotFoundError`, `InsufficientDataError`, `TimeoutError`

### Externas (npm)

- None

---

## Estrategia de Test

### Unit Tests (`tests/unit/resolvers/agent-action.spec.ts`)

60 tests covering all 12 acceptance criteria.

| Category                    | Tests | ACs Covered         |
| --------------------------- | ----- | ------------------- |
| generateActionExecutionId   | 2     | AC-04               |
| formatActionError           | 6     | AC-05               |
| logAction                   | 1     | AC-06               |
| actionSuccess/actionFailure | 2     | AC-09               |
| Type contracts              | 4     | AC-01, AC-02, AC-08 |
| Handler routing             | 7     | AC-03               |
| handleEvaluateIssue         | 4     | AC-04               |
| handleCheckPRConsistency    | 6     | AC-05               |
| handleValidateSpecAlignment | 6     | AC-06               |
| handleExplainScore          | 3     | AC-07               |
| handleGetImprovementTips    | 5     | AC-08               |
| Error handling              | 5     | AC-09               |
| Structured logging          | 5     | AC-10               |
| ExecutionId traceability    | 2     | AC-10               |
| Edge cases                  | 3     | AC-05, AC-06, AC-04 |

### Mock Strategy

All service adapters mocked via jest.mock(). Mocks reset in beforeEach.

---

## Historial de Cambios

| Fecha      | Tarea Ralph          | Cambio                                                                     |
| ---------- | -------------------- | -------------------------------------------------------------------------- |
| 2026-04-30 | RTASK-033            | Created as stub for manifest validation                                    |
| 2026-05-01 | RTASK-034 Step 1     | Added types, utilities, and initial test coverage                          |
| 2026-05-01 | RTASK-034 Steps 2-10 | Full handler routing, 5 sub-handlers, comprehensive tests, .reqs.md update |
