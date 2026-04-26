# REQUISITOS: GitHub Adapter Integration Tests

> **Sidecar File** | Vinculado a: `tests/integration/github/github-adapter.integration.spec.ts`

---

## Descripcion

Integration tests for the GitHub adapter's public contract. Validates that
`createStatusCheck`, `createPRComment`, `getPRData`, `updateStatusCheck`,
`listPRFiles`, and `extractJiraKeysFromPR` behave correctly when interacting
with the mocked `@forge/api` `fetch` function. Covers error classification,
rate limiting retries, timeouts, and pagination.

---

## Acceptance Criteria

- [x] **AC-01**: `createStatusCheck` happy path — POST to correct URL with body
- [x] **AC-02**: `createStatusCheck` uses default context when not provided
- [x] **AC-03**: `createPRComment` happy path — POST body contains comment text
- [x] **AC-04**: `getPRData` full happy path — returns mapped GitHubPRData with files
- [x] **AC-05**: `getPRData` throws GitHubApiError (GITHUB_NOT_FOUND) on 404
- [x] **AC-06**: `extractJiraKeysFromPR` extracts keys from title and body
- [x] **AC-07**: `extractJiraKeysFromPR` deduplicates and preserves order
- [x] **AC-08**: 401 response throws TokenExpiredError (GITHUB_TOKEN_EXPIRED)
- [x] **AC-09**: 429 retry then success (chaos)
- [x] **AC-10**: Timeout abort throws TimeoutError (GITHUB_TIMEOUT) (chaos)
- [x] **AC-11**: `updateStatusCheck` sends partial update with only provided fields
- [x] **AC-12**: `listPRFiles` follows Link header pagination

---

## Reglas del Rulebook

| ID Regla            | Categoria    | Descripcion breve                           |
| ------------------- | ------------ | ------------------------------------------- |
| [TEST-QA-056]       | Testing      | TDD RED->GREEN->REFACTOR mandatory          |
| [TEST-QA-0961]      | Testing      | Every exported function tested              |
| [ARCH-SOLID-202]    | Architecture | Zero any in all types                       |
| [TEST-QA-204]       | Testing      | afterEach cleanup mandatory                 |
| [TEST-QA-058]       | Testing      | Realistic fixtures from JSON files          |
| [TEST-QA-0764]      | Testing      | Self-contained, mock all Forge API          |
| [TEST-QA-201]       | Testing      | AAA pattern with explicit comments          |
| [TEST-QA-202]       | Testing      | jest.mock exception for @forge/api          |
| [ARCH-SOLID-049-03] | Architecture | Public contract only, no internal tests     |
| [ARCH-SOLID-053]    | Architecture | Domain-specific errors, not generic Error   |
| [TEST-QA-0853]      | Testing      | Chaos tests: 429, timeout, invalid response |
| [TEST-QA-0954]      | Testing      | async/await only, fake timers for retry     |
| [GH-INTEG-305]      | GitHub       | Status check context string                 |
| [GH-INTEG-301]      | GitHub       | Pagination via Link header                  |
| [GH-INTEG-304]      | GitHub       | Error classification by status code         |
| [GH-INTEG-302]      | GitHub       | Rate limit header awareness                 |

---

## Contrato Publico (API del modulo)

### Funciones exportadas

#### `createStatusCheck(params, repo, sha, token, executionId?, timeoutMs?): Promise<void>`

- **Proposito**: Create a GitHub commit status check
- **Errores**: GitHubApiError, TimeoutError, TokenExpiredError

#### `createPRComment(repo, prNumber, body, token, executionId?, timeoutMs?): Promise<void>`

- **Proposito**: Post a comment on a GitHub pull request
- **Errores**: GitHubApiError, TimeoutError, TokenExpiredError

#### `getPRData(repo, prNumber, token, executionId?, timeoutMs?): Promise<GitHubPRData>`

- **Proposito**: Fetch PR metadata and files
- **Errores**: GitHubApiError (GITHUB_NOT_FOUND, GITHUB_INVALID_RESPONSE), TimeoutError

#### `updateStatusCheck(checkId, params, repo, sha, token, executionId?, timeoutMs?): Promise<void>`

- **Proposito**: Update an existing GitHub commit status check
- **Errores**: GitHubApiError, TimeoutError, TokenExpiredError

#### `listPRFiles(repo, prNumber, token, executionId?, timeoutMs?): Promise<PRFile[]>`

- **Proposito**: List all files in a PR, following pagination
- **Errores**: GitHubApiError, TimeoutError

#### `extractJiraKeysFromPR(pr: GitHubPRData): string[]`

- **Proposito**: Extract unique Jira ticket keys from PR title and body
- **Errores**: None (synchronous, pure function)

---

## Estrategia de Test

### Integration Tests (`tests/integration/github/github-adapter.integration.spec.ts`)

| Test                                                  | AC cubierto | Regla cubierta               |
| ----------------------------------------------------- | ----------- | ---------------------------- |
| should create status check with POST to correct URL   | AC-01       | GH-INTEG-305                 |
| should use default context when not provided          | AC-02       | GH-INTEG-305                 |
| should create PR comment with POST body               | AC-03       | -                            |
| should return mapped GitHubPRData with files          | AC-04       | GH-INTEG-301                 |
| should throw GitHubApiError (GITHUB_NOT_FOUND) on 404 | AC-05       | GH-INTEG-304, ARCH-SOLID-053 |
| should extract Jira keys from title and body          | AC-06       | -                            |
| should deduplicate and preserve order of keys         | AC-07       | -                            |
| should throw TokenExpiredError on 401                 | AC-08       | GH-INTEG-304, ARCH-SOLID-053 |
| should retry on 429 and succeed                       | AC-09       | TEST-QA-0853                 |
| should throw TimeoutError on abort                    | AC-10       | TEST-QA-0853, ARCH-SOLID-053 |
| should send only provided fields in update            | AC-11       | -                            |
| should follow Link header pagination in listPRFiles   | AC-12       | GH-INTEG-301                 |

---

## Historial de Cambios

| Fecha      | Tarea Ralph      | Cambio         |
| ---------- | ---------------- | -------------- |
| 2026-04-26 | RTASK-028 Step 5 | Creado inicial |
