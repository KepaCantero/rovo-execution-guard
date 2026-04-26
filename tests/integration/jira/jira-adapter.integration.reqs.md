# REQUISITOS: Jira Adapter Integration Tests

> **Sidecar File** | Vinculado a: `tests/integration/jira/jira-adapter.integration.spec.ts`

---

## Descripcion

Integration tests for the Jira adapter's public contract. Tests validate that the adapter
correctly interacts with the Jira REST API v2 through `@forge/api`'s `requestJira`, including
happy paths, error mapping, rate limit retry, and timeout behavior. All Forge API calls are
mocked via `jest.mock('@forge/api')`.

---

## Acceptance Criteria

- [x] **AC-01**: getTicketData returns mapped JiraTicketData for a full ticket with all fields
- [x] **AC-02**: getTicketData throws TicketNotFoundError (JIRA_NOT_FOUND) for 404 response
- [x] **AC-03**: getTicketData maps null assignee/reporter/priority to undefined in result
- [x] **AC-04**: getTicketData throws PermissionDeniedError (JIRA_PERMISSION_DENIED) for 403 response
- [x] **AC-05**: transitionIssue completes without error for valid transition
- [x] **AC-06**: transitionIssue throws TransitionBlockedError (JIRA_TRANSITION_BLOCKED) when rejected
- [x] **AC-07**: addComment sends ADF body via POST and completes successfully
- [x] **AC-08**: Adapter retries on 429 rate limit and succeeds on second attempt
- [x] **AC-09**: Adapter throws JiraApiError (JIRA_API_ERROR) after exhausting retries on persistent 429
- [x] **AC-10**: Adapter throws TimeoutError (JIRA_TIMEOUT) when request is aborted

---

## Reglas del Rulebook

| ID Regla            | Categoria    | Descripcion breve                                            |
| ------------------- | ------------ | ------------------------------------------------------------ |
| [TEST-QA-056]       | Testing      | TDD — tests written first against public contract            |
| [TEST-QA-0961]      | Testing      | Every adapter function gets at least one test                |
| [TEST-QA-202]       | Testing      | jest.mock('@forge/api') exception for external Forge runtime |
| [TEST-QA-204]       | Testing      | afterEach(() => jest.clearAllMocks()) mandatory              |
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

### Funciones bajo prueba (from `jira-adapter.ts`)

#### `getTicketData(issueKey, executionId?, timeoutMs?)` -> `Promise<JiraTicketData>`

- **Tests**: AC-01, AC-02, AC-03, AC-04, AC-08, AC-09, AC-10
- **Errores**: TicketNotFoundError, PermissionDeniedError, JiraApiError, TimeoutError

#### `transitionIssue(issueKey, transitionId, executionId?, timeoutMs?)` -> `Promise<void>`

- **Tests**: AC-05, AC-06
- **Errores**: TransitionBlockedError

#### `addComment(issueKey, body, executionId?, timeoutMs?)` -> `Promise<void>`

- **Tests**: AC-07
- **Errores**: JiraApiError (from executeJiraRequest)

---

## Dependencias (imports)

### Internas (proyecto)

- `src/backend/services/jira/jira-adapter.ts` -> getTicketData, transitionIssue, addComment
- `src/backend/types/errors.ts` -> JiraApiError, TicketNotFoundError, PermissionDeniedError, TransitionBlockedError, TimeoutError
- `src/backend/types/jira-data.ts` -> JiraTicketData (type)

### Mock infrastructure

- `tests/mocks/forge-api.ts` -> okResponse, notFoundResponse, forbiddenResponse, rateLimitedResponse, MockAPIResponse

### External (mocked)

- `@forge/api` -> requestJira, route (mocked via jest.mock)

---

## Estrategia de Test

### Integration Tests (`tests/integration/jira/jira-adapter.integration.spec.ts`)

| Test                                                                 | AC cubierto | Regla cubierta    |
| -------------------------------------------------------------------- | ----------- | ----------------- |
| should return mapped JiraTicketData for a full ticket                | AC-01       | TEST-QA-058       |
| should throw TicketNotFoundError for 404 response                    | AC-02       | ARCH-SOLID-053    |
| should map null assignee/reporter/priority to undefined              | AC-03       | ARCH-SOLID-049-03 |
| should throw PermissionDeniedError for 403 response                  | AC-04       | ARCH-SOLID-053    |
| should throw JiraApiError for invalid response structure             | -           | TEST-QA-0853      |
| should complete successfully for valid transition                    | AC-05       | TEST-QA-0764      |
| should throw TransitionBlockedError when transition is rejected      | AC-06       | ARCH-SOLID-053    |
| should complete successfully when adding an ADF comment              | AC-07       | TEST-QA-058       |
| should retry on 429 and succeed on second attempt                    | AC-08       | TEST-QA-0853      |
| should throw JiraApiError after exhausting retries on persistent 429 | AC-09       | TEST-QA-0853      |
| should throw TimeoutError when request is aborted                    | AC-10       | TEST-QA-0853      |

---

## Historial de Cambios

| Fecha      | Tarea Ralph      | Cambio                         |
| ---------- | ---------------- | ------------------------------ |
| 2026-04-26 | RTASK-028 Step 3 | Creado — 11 test cases, 10 ACs |
