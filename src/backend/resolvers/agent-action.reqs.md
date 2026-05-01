# REQUISITOS: Agent Action Types & Utilities

> **Sidecar File** | Vinculado a: `src/backend/resolvers/agent-action.ts`

---

## Descripcion

Defines the core types and shared utility functions for the Rovo Agent action handler.
This module provides the type interfaces (`ActionContext`, `ActionInput`, `ActionResponse<T>`)
that bound the communication contract between the Rovo Agent LLM and the app's backend services,
plus utility functions for execution ID generation, error formatting, and structured logging.

---

## Acceptance Criteria

- [ ] **AC-01**: `ActionContext` interface with `readonly cloudId`, `readonly moduleKey`, and optional `readonly jira` nested context
- [ ] **AC-02**: `ActionInput` interface with optional `readonly issueKey`, `readonly prUrl`, `readonly focusAxis`
- [ ] **AC-03**: `ActionResponse<T>` generic interface with `readonly success`, `data?`, `error?`, `executionId` — follows `ResolverResponse<T>` pattern
- [ ] **AC-04**: `generateActionExecutionId()` returns unique IDs with `act-` prefix (distinct from resolver `res-` prefix)
- [ ] **AC-05**: `formatActionError(error, issueKey)` maps domain errors to user-friendly messages with specific handling for `TicketNotFoundError`, `InsufficientDataError`, `TimeoutError`, and generic fallback
- [ ] **AC-06**: `logAction(entry)` structured logging helper with `actionKey`, `executionId`, `duration`, `success` fields — never logs tokens or PII
- [ ] **AC-07**: All interfaces use `readonly` properties — zero `any` usage
- [ ] **AC-08**: `ActionHandler` type alias for sub-handler function signatures
- [ ] **AC-09**: `actionSuccess<T>()` and `actionFailure()` response builder helpers follow existing `success()`/`failure()` pattern

---

## Reglas del Rulebook

| ID Regla            | Categoria    | Descripcion breve                                                 |
| ------------------- | ------------ | ----------------------------------------------------------------- |
| [ARCH-SOLID-202]    | Arquitectura | Zero any usage — use generics and discriminated unions            |
| [ARCH-SOLID-232]    | Arquitectura | Named exports only, no export default                             |
| [ARCH-SOLID-049-03] | Arquitectura | Use interfaces for LSP — support test mocking                     |
| [ARCH-SOLID-052]    | Arquitectura | Functions <= 20 lines, max 3 nesting levels                       |
| [ARCH-SOLID-053]    | Arquitectura | Domain-specific error types for all failure paths                 |
| [ARCH-SOLID-203]    | Arquitectura | Standard response wrappers — follow `ResolverResponse<T>` pattern |
| [FORGE-OPS-0105]    | Forge Ops    | Stateless functions, no module-level mutable state                |
| [SEC-PRIV-002]      | Seguridad    | Never log tokens or PII                                           |
| [ROVO-INTEG-054]    | Rovo         | Communication contracts as versioned TypeScript interfaces        |
| [ROVO-INTEG-060]    | Rovo         | Never assume complete information — all input fields optional     |
| [ROVO-INTEG-004]    | Rovo         | Rovo context treated as untrusted data                            |

---

## Contrato Publico (API del modulo)

### Types

#### `ActionContext`

- **Proposito**: Defines the invocation context from the Rovo Agent
- **Propiedades**: `cloudId` (tenant), `moduleKey` (action identifier), optional `jira` context
- **Regla**: [ROVO-INTEG-004] — all fields treated as untrusted

#### `ActionInput`

- **Proposito**: Defines the input payload for action invocations
- **Propiedades**: `issueKey?`, `prUrl?`, `focusAxis?` — all optional per [ROVO-INTEG-060]

#### `ActionResponse<T>`

- **Proposito**: Standard response wrapper for all action results — mirrors `ResolverResponse<T>`
- **Propiedades**: `success`, `data?`, `error?`, `executionId`
- **Regla**: [ARCH-SOLID-203]

#### `ActionHandler`

- **Proposito**: Type alias for sub-handler function signatures
- **Firma**: `(input: ActionInput, context: ActionContext) => Promise<ActionResponse<unknown>>`

#### `ActionLogEntry`

- **Proposito**: Structured log entry for action operations
- **Propiedades**: `timestamp`, `level`, `actionKey`, `executionId`, optional `duration`, `success`, `issueKey?`, `prUrl?`, `error?`
- **Regla**: [SEC-PRIV-002]

### Functions

#### `generateActionExecutionId(): string`

- **Proposito**: Generate unique execution ID with `act-` prefix for action traceability
- **Post-condiciones**: Returns string in format `act-{timestamp}-{random}`
- **Regla**: [FORGE-OPS-0105] — pure function, no side effects

#### `formatActionError(error: unknown, issueKey?: string): string`

- **Proposito**: Maps domain errors to user-friendly messages
- **Errores mapeados**: `TicketNotFoundError`, `InsufficientDataError`, `TimeoutError`, generic fallback
- **Regla**: [ARCH-SOLID-053], [FORGE-OPS-054]

#### `logAction(entry: ActionLogEntry): void`

- **Proposito**: Structured logging for action invocations
- **Campos**: `timestamp`, `level`, `actionKey`, `executionId`, `duration?`, `success`, `issueKey?`, `prUrl?`, `error?`
- **Regla**: [SEC-PRIV-002] — never logs tokens or PII

#### `actionSuccess<T>(data: T, executionId: string): ActionResponse<T>`

- **Proposito**: Build a success response
- **Regla**: [ARCH-SOLID-203]

#### `actionFailure(error: string, executionId: string): ActionResponse<never>`

- **Proposito**: Build a failure response
- **Regla**: [ARCH-SOLID-203]

---

## Dependencias (imports)

### Internas (proyecto)

- `src/backend/types/errors` -> `TicketNotFoundError`, `InsufficientDataError`, `TimeoutError`, `REGError`

### Externas (npm)

- None

---

## Estrategia de Test

### Unit Tests (`tests/unit/resolvers/agent-action.spec.ts`)

| Test                                                     | AC cubierto | Regla cubierta |
| -------------------------------------------------------- | ----------- | -------------- |
| should generate unique execution IDs with act- prefix    | AC-04       | FORGE-OPS-0105 |
| should generate different IDs on successive calls        | AC-04       | FORGE-OPS-0105 |
| should format TicketNotFoundError with issueKey          | AC-05       | ARCH-SOLID-053 |
| should format InsufficientDataError with issueKey        | AC-05       | ARCH-SOLID-053 |
| should format TimeoutError with issueKey                 | AC-05       | ARCH-SOLID-053 |
| should format generic Error with fallback message        | AC-05       | FORGE-OPS-054  |
| should format non-Error thrown values                    | AC-05       | ARCH-SOLID-053 |
| should format error without issueKey                     | AC-05       | ARCH-SOLID-053 |
| should log structured action entries                     | AC-06       | SEC-PRIV-002   |
| should build success response with data and executionId  | AC-09       | ARCH-SOLID-203 |
| should build failure response with error and executionId | AC-09       | ARCH-SOLID-203 |
| ActionContext has required readonly fields               | AC-01       | ROVO-INTEG-054 |
| ActionInput has all optional readonly fields             | AC-02       | ROVO-INTEG-060 |
| ActionResponse has generic data field                    | AC-03       | ARCH-SOLID-203 |

---

## Historial de Cambios

| Fecha      | Tarea Ralph      | Cambio                                                 |
| ---------- | ---------------- | ------------------------------------------------------ |
| 2026-04-30 | RTASK-033        | Created as stub for manifest validation                |
| 2026-05-01 | RTASK-034 Step 1 | Upgraded with full types, utilities, and test coverage |
