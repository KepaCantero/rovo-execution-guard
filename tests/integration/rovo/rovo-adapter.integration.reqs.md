# REQUISITOS: Rovo Adapter Integration Tests

> **Sidecar File** | Vinculado a: `tests/integration/rovo/rovo-adapter.integration.spec.ts`

---

## Descripcion

Integration tests for the Rovo adapter's public contract. Tests validate that the adapter
correctly interacts with the Rovo Search API and Validation API through `@forge/api`'s
`requestConfluence` (used as the Rovo proxy), including happy paths, fallback behavior
when Rovo is unavailable, rate limit retry, timeout handling, and quota management.
All Forge API calls are mocked via `jest.mock('@forge/api')`.

---

## Acceptance Criteria

- [x] **AC-01**: getContext returns RovoContext with documents, relatedTickets, and decisions for valid Rovo search
- [x] **AC-02**: getContext falls back to Jira JQL + Confluence CQL when Rovo returns non-ok
- [x] **AC-03**: getContext falls back when Rovo returns invalid response structure (chaos)
- [x] **AC-04**: getRelatedTickets returns ticket keys excluding the queried ticket
- [x] **AC-05**: getDocumentation returns documents from Rovo search
- [x] **AC-06**: getHistoricalDecisions returns historical decisions from Rovo search
- [x] **AC-07**: validateConsistency returns ConsistencyValidation with source=rovo when Rovo succeeds
- [x] **AC-08**: validateConsistency falls back to rule-based validation when Rovo unavailable
- [x] **AC-09**: checkQuota returns allowed=true when quota is available
- [x] **AC-10**: checkQuota returns allowed=false when quota is exhausted
- [x] **AC-11**: Adapter retries on 429 rate limit and succeeds on second attempt
- [x] **AC-12**: Adapter falls back gracefully when retries exhausted on persistent 429
- [x] **AC-13**: Adapter falls back gracefully when Rovo request is aborted (timeout)

---

## Reglas del Rulebook

| ID Regla            | Categoria    | Descripcion breve                                            |
| ------------------- | ------------ | ------------------------------------------------------------ |
| [TEST-QA-056]       | Testing      | TDD — tests written first against public contract            |
| [TEST-QA-0961]      | Testing      | Every adapter function gets at least one test                |
| [TEST-QA-202]       | Testing      | jest.mock('@forge/api') exception for external Forge runtime |
| [TEST-QA-204]       | Testing      | afterEach(() => jest.resetAllMocks()) mandatory              |
| [TEST-QA-058]       | Testing      | Use realistic fixture data from tests/integration/fixtures/  |
| [TEST-QA-0764]      | Testing      | Self-contained tests, no external dependencies               |
| [TEST-QA-201]       | Testing      | AAA pattern in every test                                    |
| [TEST-QA-0853]      | Testing      | Chaos tests: 429 rate limiting, timeout, invalid response    |
| [TEST-QA-0954]      | Testing      | async/await only, no setTimeout/done()                       |
| [ARCH-SOLID-202]    | Architecture | Zero `any` in test code                                      |
| [ARCH-SOLID-049-03] | Architecture | Test public contract (LSP), not internal implementation      |
| [ARCH-SOLID-053]    | Architecture | Domain-specific error types, not generic Error               |

---

## Contrato Publico (API del modulo)

### Funciones bajo prueba (from `rovo-adapter.ts`)

#### `getContext(query, projectKey, executionId?, timeoutMs?)` -> `Promise<RovoContext>`

- **Tests**: AC-01, AC-02, AC-03, AC-11, AC-12, AC-13
- **Fallback**: Jira JQL + Confluence CQL when Rovo unavailable

#### `getRelatedTickets(issueKey, executionId?, timeoutMs?)` -> `Promise<readonly string[]>`

- **Tests**: AC-04
- **Fallback**: Label-based Jira search, then summary JQL search

#### `getDocumentation(query, spaceKeys?, executionId?, timeoutMs?)` -> `Promise<readonly RovoDocument[]>`

- **Tests**: AC-05
- **Fallback**: Confluence CQL cursor-based pagination

#### `getHistoricalDecisions(projectKey, executionId?, timeoutMs?)` -> `Promise<readonly HistoricalDecision[]>`

- **Tests**: AC-06
- **Fallback**: Confluence ADR search

#### `validateConsistency(ticketData, context, executionId?)` -> `Promise<ConsistencyValidation>`

- **Tests**: AC-07, AC-08
- **Fallback**: `performRuleBasedValidation` (pure logic, no API)

#### `checkQuota(quotaState, executionId?)` -> `QuotaCheckResult`

- **Tests**: AC-09, AC-10
- **Sync**: Pure calculation, no API calls

---

## Dependencias (imports)

### Internas (proyecto)

- `src/backend/services/rovo/rovo-adapter.ts` -> getContext, getRelatedTickets, getDocumentation, getHistoricalDecisions, validateConsistency, checkQuota, ConsistencyValidation, QuotaCheckResult, QuotaState
- `src/backend/types/errors.ts` -> RovoApiError, TimeoutError
- `src/backend/types/jira-data.ts` -> JiraTicketData (type)
- `src/backend/types/rovo-context.ts` -> RovoContext, RovoDocument, HistoricalDecision (types)

### Mock infrastructure

- `tests/mocks/forge-api.ts` -> okResponse, rateLimitedResponse, serverErrorResponse, MockAPIResponse

### External (mocked)

- `@forge/api` -> requestJira, requestConfluence, route (mocked via jest.mock)

---

## Estrategia de Test

### Integration Tests (`tests/integration/rovo/rovo-adapter.integration.spec.ts`)

| Test                                                                    | AC cubierto | Regla cubierta               |
| ----------------------------------------------------------------------- | ----------- | ---------------------------- |
| should return RovoContext with documents, relatedTickets, and decisions | AC-01       | TEST-QA-058                  |
| should fall back to Jira+Confluence when Rovo is unavailable            | AC-02       | ARCH-SOLID-049-03            |
| should fall back when Rovo returns invalid response structure           | AC-03       | TEST-QA-0853                 |
| should return related ticket keys excluding the queried ticket          | AC-04       | TEST-QA-058                  |
| should return documents from Rovo search                                | AC-05       | TEST-QA-058                  |
| should return historical decisions from Rovo search                     | AC-06       | TEST-QA-058                  |
| should return ConsistencyValidation with source=rovo when Rovo succeeds | AC-07       | ARCH-SOLID-049-03            |
| should fall back to rule-based validation when Rovo unavailable         | AC-08       | ARCH-SOLID-049-03            |
| should return allowed=true when quota is available                      | AC-09       | ARCH-SOLID-049-03            |
| should return allowed=false when quota is exhausted                     | AC-10       | ARCH-SOLID-049-03            |
| should retry on 429 and succeed on second attempt                       | AC-11       | TEST-QA-0853                 |
| should fall back when retries exhausted on persistent 429               | AC-12       | TEST-QA-0853                 |
| should throw TimeoutError when Rovo request is aborted                  | AC-13       | TEST-QA-0853, ARCH-SOLID-053 |

---

## Historial de Cambios

| Fecha      | Tarea Ralph      | Cambio                         |
| ---------- | ---------------- | ------------------------------ |
| 2026-04-26 | RTASK-028 Step 4 | Creado — 13 test cases, 13 ACs |
