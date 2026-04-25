# REQUISITOS: Error Hierarchy

> **Sidecar File** | Vinculado a: `src/backend/types/errors.ts`

---

## Descripcion

Error hierarchy for the Rovo Execution Guard domain. Provides typed, domain-specific error classes that enable precise error handling and meaningful error propagation across all modules (scoring, enforcement, API integration). The base class `REGError` extends the native `Error` and adds `code` and `executionId` properties for traceability.

---

## Acceptance Criteria

- [ ] **AC-01**: All error classes extend `REGError` (directly or transitively), forming a valid inheritance tree
- [ ] **AC-02**: Each error class sets its `name` property to match its class name for correct stack traces
- [ ] **AC-03**: `REGError` correctly passes `message` to `Error` super constructor
- [ ] **AC-04**: `code` and `executionId` properties are readonly and accessible after construction
- [ ] **AC-05**: `instanceof` checks work correctly across the entire hierarchy
- [ ] **AC-06**: Zero external dependencies — no imports from outside `src/backend/types/`
- [ ] **AC-07**: Zero `any` usage

---

## Reglas del Rulebook

| ID Regla         | Categoria    | Descripcion breve                                |
| ---------------- | ------------ | ------------------------------------------------ |
| [ARCH-SOLID-053] | Arquitectura | Domain-specific error types, never generic Error |
| [ARCH-SOLID-058] | Arquitectura | Domain layer has zero framework dependencies     |
| [ARCH-SOLID-202] | TypeScript   | Zero any usage                                   |
| [ARCH-SOLID-234] | TypeScript   | No empty Error constructor; message required     |
| [ARCH-SOLID-231] | TypeScript   | PascalCase for classes                           |

---

## Contrato Publico (API del modulo)

### Clases exportadas

#### `REGError` (base)

- **Proposito**: Base error class for all Rovo Execution Guard errors
- **Propiedades**: `message: string`, `code: string`, `executionId?: string`, `name: string`

#### `ScoringError` extends `REGError`

- **Proposito**: Errors during consistency score calculation

#### `InsufficientDataError` extends `ScoringError`

- **Proposito**: Not enough data to calculate a meaningful score

#### `JiraApiError` extends `REGError`

- **Proposito**: Errors communicating with Jira REST API

#### `TicketNotFoundError` extends `JiraApiError`

- **Proposito**: Requested Jira ticket does not exist

#### `PermissionDeniedError` extends `JiraApiError`

- **Proposito**: Insufficient permissions for Jira operation (HTTP 403)

#### `TransitionBlockedError` extends `JiraApiError`

- **Proposito**: Requested transition is not allowed for the current issue state

#### `RovoApiError` extends `REGError`

- **Proposito**: Errors communicating with Rovo AI API

#### `QuotaExceededError` extends `RovoApiError`

- **Proposito**: Rovo API quota has been exceeded

#### `GitHubApiError` extends `REGError`

- **Proposito**: Errors communicating with GitHub REST API

#### `TokenExpiredError` extends `GitHubApiError`

- **Proposito**: GitHub App installation token has expired

#### `ConfluenceApiError` extends `REGError`

- **Proposito**: Errors communicating with Confluence Cloud REST API

#### `PageNotFoundError` extends `ConfluenceApiError`

- **Proposito**: Requested Confluence page does not exist

#### `SpaceNotFoundError` extends `ConfluenceApiError`

- **Proposito**: Requested Confluence space does not exist

#### `TimeoutError` extends `REGError`

- **Proposito**: Operation exceeded its time limit

#### `CircuitOpenError` extends `REGError`

- **Proposito**: Circuit breaker is open, calls are blocked

---

## Dependencias (imports)

### Internas

- None (leaf module, no internal dependencies)
