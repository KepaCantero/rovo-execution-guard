# REQUISITOS: Integration Test Fixtures

> **Sidecar File** | Vinculado a: `tests/integration/fixtures/*.json`

---

## Descripcion

Standardized JSON fixture files representing realistic API responses from Jira, GitHub, Rovo, and Confluence. These fixtures are used by integration tests to mock `@forge/api` responses and validate adapter behavior against known-good data.

---

## Acceptance Criteria

- [x] **AC-01**: `jira-ticket-full.json` matches `JiraIssueResponse` interface with all fields populated
- [x] **AC-02**: `jira-ticket-minimal.json` matches `JiraIssueResponse` interface with nullable fields set to null
- [x] **AC-03**: `rovo-context-full.json` matches `RawRovoSearchResponse` interface with valid documents, decisions, and related tickets
- [x] **AC-04**: `github-pr-full.json` matches `GitHubPRResponse` interface and includes files array matching `GitHubPRFileResponse`
- [x] **AC-05**: `confluence-pages.json` matches `ConfluenceSearchResponse` interface with realistic page data
- [x] **AC-06**: All fixtures use realistic data: ISO 8601 dates, proper Jira keys (PROJ-1234), valid GitHub URLs, numeric Confluence IDs
- [x] **AC-07**: Fixture validation spec (`validate-fixtures.spec.ts`) programmatically verifies structural correctness of all fixtures

---

## Reglas del Rulebook

| ID Regla          | Categoria    | Descripcion breve                                               |
| ----------------- | ------------ | --------------------------------------------------------------- |
| TEST-QA-058       | Testing      | Fixtures use realistic data matching actual API response shapes |
| TEST-QA-0973      | Testing      | Automatic fixture validation (tests-about-tests)                |
| TEST-QA-0764      | Testing      | Self-contained fixtures, no external dependencies               |
| ARCH-SOLID-049-03 | Arquitectura | Fixtures match adapter interfaces exactly (LSP)                 |
| ARCH-SOLID-058    | Arquitectura | Fixtures are raw API responses (wire format), not domain types  |
| ARCH-SOLID-202    | Arquitectura | Zero `any` in validation code                                   |
| TEST-QA-204       | Testing      | afterEach cleanup mandatory                                     |
| TEST-QA-056       | Testing      | TDD — validation tests written first, then fixtures             |

---

## Fixture Files

### `jira-ticket-full.json`

- **Proposito**: Complete Jira ticket with all fields populated (Story type, In Progress status)
- **Matches**: `JiraIssueResponse` from `src/backend/services/jira/jira-adapter.ts`
- **Usage**: Happy-path tests for `getTicketData`, scoring engine inputs

### `jira-ticket-minimal.json`

- **Proposito**: Minimal Jira ticket with null optional fields (Bug type, To Do status)
- **Matches**: `JiraIssueResponse` with `assignee: null`, `reporter: null`, `priority: null`, `labels: []`
- **Usage**: Edge-case tests for adapters handling null fields

### `rovo-context-full.json`

- **Proposito**: Full Rovo Search API response with documents, decisions, and related tickets
- **Matches**: `RawRovoSearchResponse` from `src/backend/services/rovo/rovo-adapter.ts`
- **Usage**: Happy-path tests for `getContext`, `getHistoricalDecisions`, `getRelatedTickets`

### `github-pr-full.json`

- **Proposito**: Complete GitHub PR with metadata and changed files
- **Matches**: `GitHubPRResponse` + files array of `GitHubPRFileResponse` from `src/backend/services/github/github-adapter.ts`
- **Usage**: Happy-path tests for `getPRData`, `listPRFiles`, `extractJiraKeysFromPR`

### `confluence-pages.json`

- **Proposito**: Confluence search results with page metadata
- **Matches**: `ConfluenceSearchResponse` from `src/backend/services/confluence/confluence-adapter.ts`
- **Usage**: Happy-path tests for `searchPages`

---

## Dependencias (imports)

### Internas (proyecto)

- Fixture types mirror interfaces from `src/backend/services/jira/jira-adapter.ts`
- Fixture types mirror interfaces from `src/backend/services/github/github-adapter.ts`
- Fixture types mirror interfaces from `src/backend/services/rovo/rovo-adapter.ts`
- Fixture types mirror interfaces from `src/backend/services/confluence/confluence-adapter.ts`

### Externas (npm)

- None — fixtures are pure JSON data

---

## Estrategia de Test

### Fixture Validation (`tests/integration/fixtures/validate-fixtures.spec.ts`)

| Test                                          | AC cubierto         | Regla cubierta    |
| --------------------------------------------- | ------------------- | ----------------- |
| File existence checks (5 tests)               | AC-01 through AC-05 | TEST-QA-0973      |
| jira-ticket-full structure + fields           | AC-01, AC-06        | ARCH-SOLID-049-03 |
| jira-ticket-minimal structure + nulls         | AC-02, AC-06        | ARCH-SOLID-049-03 |
| rovo-context-full documents/decisions/tickets | AC-03, AC-06        | ARCH-SOLID-049-03 |
| github-pr-full structure + files              | AC-04, AC-06        | ARCH-SOLID-049-03 |
| confluence-pages structure + IDs              | AC-05, AC-06        | ARCH-SOLID-049-03 |
| Valid JSON parsing (5 tests)                  | AC-07               | TEST-QA-058       |

---

## Historial de Cambios

| Fecha      | Tarea Ralph | Cambio                                            |
| ---------- | ----------- | ------------------------------------------------- |
| 2026-04-26 | RTASK-028   | Created fixtures + validation spec + reqs sidecar |
