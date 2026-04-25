# REQUISITOS: Rovo API Adapter

> **Sidecar File** | Vinculado a: `src/backend/services/rovo/rovo-adapter.ts`

---

## Descripcion

Typed, error-resilient adapter wrapping Atlassian Rovo API with graceful fallback to basic keyword-based search via Jira and Confluence APIs. Provides contextual intelligence capabilities (related tickets, documentation, historical decisions) with quota control, timeouts, and structured logging. When Rovo is unavailable, falls back to keyword matching in Jira and CQL search in Confluence.

---

## Acceptance Criteria

- [ ] **AC-01**: `getContext` returns structured `RovoContext` with relevant project data
- [ ] **AC-02**: Fallback functions are operational when Rovo is unavailable (keyword search in Jira/Confluence)
- [ ] **AC-03**: Quota control prevents exceeding Rovo API query limits per minute
- [ ] **AC-04**: Timeout implemented using `AbortController` with configurable duration (5s for Rovo, 10s for Jira/Confluence fallback)
- [ ] **AC-05**: Structured logging includes `executionId` and fallback indicators in every log entry
- [ ] **AC-06**: Custom error types (`RovoApiError`, `QuotaExceededError`) are implemented and used
- [ ] **AC-07**: Test coverage exceeds 85%
- [ ] **AC-08**: Integration tests use mocked API responses for both Rovo and fallback paths
- [ ] **AC-09**: `.reqs.md` sidecar file is created with requirements traceability

---

## Reglas del Rulebook

Las siguientes reglas del RULEBOOK.md deben respetarse en este modulo:

| ID Regla          | Categoria    | Descripcion breve                                                      |
| ----------------- | ------------ | ---------------------------------------------------------------------- |
| [FORGE-OPS-005]   | Forge Ops    | No Forge function invocation must exceed 10s execution                 |
| [FORGE-OPS-0101]  | Forge Ops    | Critical work within 8s, 2s margin against 10s hard limit              |
| [FORGE-OPS-0104]  | Forge Ops    | Graceful degradation when Rovo unavailable                             |
| [FORGE-OPS-0105]  | Forge Ops    | Stateless functions, no module-level mutable state                     |
| [ROVO-INTEG-001]  | Rovo Integ   | Cursor-based pagination for Confluence REST API v2                     |
| [ROVO-INTEG-002]  | Rovo Integ   | Use Link headers for navigation, not manual URL construction           |
| [ROVO-INTEG-003]  | Rovo Integ   | limit param must not exceed 250                                        |
| [ROVO-INTEG-004]  | Rovo Integ   | Rovo context treated as untrusted data, validated before use           |
| [ROVO-INTEG-005]  | Rovo Integ   | Rovo API calls must implement timeout (max 5s) and graceful fallback   |
| [ROVO-INTEG-0795] | Rovo Integ   | Every external API call must have explicit timeout and fallback        |
| [ROVO-INTEG-0915] | Rovo Integ   | Rovo is enhancer, never a requirement for basic functionality          |
| [ROVO-INTEG-0775] | Rovo Integ   | Wrap every Rovo response in a type guard                               |
| [ROVO-INTEG-0924] | Rovo Integ   | Detect schema changes via validation failure, adapt with degraded mode |
| [ROVO-INTEG-055]  | Rovo Integ   | Cross-verification for Rovo-driven Consistency Score                   |
| [ROVO-INTEG-060]  | Rovo Integ   | Handle uncertainty when Rovo returns insufficient context              |
| [SEC-PRIV-002]    | Security     | No sensitive data in structured logs                                   |
| [SEC-PRIV-004]    | Security     | Validate external API responses before casting                         |
| [SEC-PRIV-008]    | Security     | Data minimization — only request needed fields                         |
| [ARCH-SOLID-003]  | Architecture | Expand only necessary fields, never request full body                  |
| [ARCH-SOLID-007]  | Architecture | Rovo integration decoupled from scoring engine via adapter             |
| [ARCH-SOLID-052]  | Architecture | No function > 20 lines effective logic, max 3 nesting levels           |
| [ARCH-SOLID-053]  | Architecture | Domain-specific error types, never generic Error                       |
| [ARCH-SOLID-058]  | Architecture | Domain types zero framework deps                                       |
| [ARCH-SOLID-202]  | Architecture | Zero `any` usage                                                       |
| [ARCH-SOLID-203]  | Architecture | Interfaces for data structures, `type` for unions                      |
| [ARCH-SOLID-205]  | Architecture | Explicit return types on all public functions                          |
| [ARCH-SOLID-232]  | Architecture | Named exports only, no export default                                  |
| [ARCH-SOLID-233]  | Architecture | async/await, no .then/.catch chains                                    |
| [ARCH-SOLID-234]  | Architecture | Descriptive error messages with operational context                    |
| [ARCH-SOLID-241]  | Architecture | try/catch wrapping all async operations                                |
| [ARCH-SOLID-243]  | Architecture | Explicit I/O timeouts                                                  |

---

## Contrato Publico (API del modulo)

### Funciones exportadas

#### `getContext(query: string, projectKey: string, executionId?: string, timeoutMs?: number): Promise<RovoContext>`

- **Proposito**: Retrieves contextual information for a given query within a project
- **Pre-condiciones**: `query` is a non-empty string, `projectKey` is a non-empty string
- **Post-condiciones**: Returns structured `RovoContext` with documents, related tickets, and decisions
- **Errores**: `RovoApiError` (Rovo API failure), `TimeoutError` (timeout exceeded)
- **Fallback**: Returns basic keyword matches from Jira issues and Confluence pages
- **AC**: AC-01, AC-02, AC-04, AC-05
- **Reglas**: ROVO-INTEG-005, ROVO-INTEG-004, FORGE-OPS-005, ROVO-INTEG-0915

#### `getRelatedTickets(issueKey: string, executionId?: string, timeoutMs?: number): Promise<readonly string[]>`

- **Proposito**: Finds tickets related to the given issue based on Rovo intelligence
- **Pre-condiciones**: `issueKey` is a non-empty string
- **Post-condiciones**: Returns readonly array of related issue keys
- **Errores**: `RovoApiError`, `TimeoutError`
- **Fallback**: Uses title and label overlap to find related tickets via Jira API
- **AC**: AC-01, AC-02, AC-04, AC-05
- **Reglas**: ROVO-INTEG-005, ROVO-INTEG-0915

#### `getDocumentation(query: string, spaceKeys?: readonly string[], executionId?: string, timeoutMs?: number): Promise<readonly RovoDocument[]>`

- **Proposito**: Searches Confluence documentation relevant to the query
- **Pre-condiciones**: `query` is a non-empty string
- **Post-condiciones**: Returns readonly array of `RovoDocument`
- **Errores**: `RovoApiError`, `TimeoutError`
- **Fallback**: Confluence CQL search with keyword extraction
- **AC**: AC-01, AC-02, AC-04, AC-05
- **Reglas**: ROVO-INTEG-001, ROVO-INTEG-002, ROVO-INTEG-003, ROVO-INTEG-005

#### `getHistoricalDecisions(projectKey: string, executionId?: string, timeoutMs?: number): Promise<readonly HistoricalDecision[]>`

- **Proposito**: Retrieves past architectural and technical decisions for the project
- **Pre-condiciones**: `projectKey` is a non-empty string
- **Post-condiciones**: Returns readonly array of `HistoricalDecision`
- **Errores**: `RovoApiError`, `TimeoutError`
- **Fallback**: Searches Confluence for pages tagged as "decision" or "ADR"
- **AC**: AC-01, AC-02, AC-04, AC-05
- **Reglas**: ROVO-INTEG-001, ROVO-INTEG-002, ROVO-INTEG-003

#### `validateConsistency(ticketData: JiraTicketData, context: RovoContext, executionId?: string): Promise<ConsistencyValidation>`

- **Proposito**: Uses Rovo to validate that ticket data is consistent with known context
- **Pre-condiciones**: `ticketData` and `context` are valid objects
- **Post-condiciones**: Returns `ConsistencyValidation` result
- **Errores**: `RovoApiError`
- **Fallback**: Uses rule-based field comparison against Jira data
- **AC**: AC-01, AC-02, AC-05
- **Reglas**: ROVO-INTEG-004, ROVO-INTEG-055, ROVO-INTEG-060

#### `checkQuota(executionId?: string): boolean`

- **Proposito**: Checks if quota is available for a Rovo API call
- **Pre-condiciones**: None
- **Post-condiciones**: Returns `true` if call is allowed, `false` if quota exceeded
- **Errores**: None (returns boolean)
- **AC**: AC-03
- **Reglas**: FORGE-OPS-0105 (stateless)

---

## Dependencias (imports)

### Internas (proyecto)

- `src/backend/types` -> `RovoContext`, `RovoDocument`, `HistoricalDecision`, `RovoApiError`, `QuotaExceededError`, `TimeoutError`, `JiraTicketData`, `ConfluencePageData`, `Inconsistency`

### Externas (npm)

- `@forge/api` -> `requestJira`, `requestConfluence`, `route`

### NOTA: Capa de integracion

- Este archivo esta en `src/backend/services/rovo/` -> puede usar `@forge/api`
- Los tipos de dominio (`src/backend/types/`) NO importan `@forge/api`
- RTASK-013 (resilience layer) not yet available — timeout/retry is self-contained

---

## Estrategia de Test

### Unit Tests (`tests/unit/services/rovo/rovo-adapter.spec.ts`)

| Test                                                       | AC cubierto | Regla cubierta                                |
| ---------------------------------------------------------- | ----------- | --------------------------------------------- |
| should return structured RovoContext for valid query       | AC-01       | ROVO-INTEG-004, ROVO-INTEG-005                |
| should fallback to keyword search when Rovo unavailable    | AC-02       | ROVO-INTEG-0915, FORGE-OPS-0104               |
| should prevent exceeding query quota per minute            | AC-03       | FORGE-OPS-0105                                |
| should timeout via AbortController after 5s for Rovo calls | AC-04       | ROVO-INTEG-005, FORGE-OPS-005                 |
| should include executionId and fallback indicators in logs | AC-05       | SEC-PRIV-002                                  |
| should throw RovoApiError on API failure                   | AC-06       | ARCH-SOLID-053                                |
| should throw QuotaExceededError when quota exceeded        | AC-06       | ARCH-SOLID-053                                |
| should throw TimeoutError on timeout                       | AC-06       | ARCH-SOLID-053                                |
| should use cursor-based pagination for Confluence          | AC-02       | ROVO-INTEG-001, ROVO-INTEG-003                |
| should validate Rovo responses with type guards            | AC-01       | ROVO-INTEG-004, ROVO-INTEG-0775, SEC-PRIV-004 |
| should handle empty/partial Rovo responses gracefully      | AC-02       | ROVO-INTEG-060                                |
| should detect schema changes and trigger fallback          | AC-02       | ROVO-INTEG-0924                               |
| should find related tickets via label/title overlap        | AC-02       | ROVO-INTEG-0915                               |
| should search Confluence for ADR-tagged pages              | AC-02       | ROVO-INTEG-001                                |

### Integration Tests

- Mocked `@forge/api` `requestJira` and `requestConfluence` for both primary and fallback paths

### E2E Tests

- Deployed environment testing per TEST-QA-002

---

## Timeout Configuration

| Call Type           | Default Timeout | Max Timeout | Source         |
| ------------------- | --------------- | ----------- | -------------- |
| Rovo API calls      | 5s              | 5s          | ROVO-INTEG-005 |
| Jira fallback       | 10s             | 10s         | FORGE-OPS-005  |
| Confluence fallback | 10s             | 10s         | FORGE-OPS-005  |
| Total function      | 8s target       | 10s max     | FORGE-OPS-0101 |

---

## Historial de Cambios

| Fecha      | Tarea Ralph | Cambio                         |
| ---------- | ----------- | ------------------------------ |
| 2026-04-20 | RTASK-010   | Creado inicial (Step 1 - reqs) |
