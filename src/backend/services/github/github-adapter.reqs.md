# REQUISITOS: GitHub API Adapter

> **Sidecar File** | Vinculado a: `src/backend/services/github/github-adapter.ts`

---

## Descripcion

Typed, error-resilient adapter wrapping GitHub REST API v3 for all GitHub interactions. Provides a clean domain-facing API for creating/updating status checks on PRs, publishing PR comments, fetching PR data, listing PR files, and extracting Jira ticket keys from PR metadata. Handles authentication, rate limiting, timeouts, and structured logging transparently. Follows the same patterns as `jira-adapter.ts` for consistency.

---

## Acceptance Criteria

- [ ] **AC-01**: `createStatusCheck` creates checks that block merge in GitHub [GH-INTEG-305]
- [ ] **AC-02**: `createPRComment` publishes comments with valid context [SEC-PRIV-002]
- [ ] **AC-03**: `extractJiraKeysFromPR` extracts IDs via regex `[A-Z]+-\d+`
- [ ] **AC-04**: Tokens stored encrypted in Forge Storage [SEC-PRIV-003]
- [ ] **AC-05**: Timeout on API calls via AbortController (default < 8s) [FORGE-OPS-005, FORGE-OPS-0101]
- [ ] **AC-06**: Structured logging with `executionId` correlation on every API call [SEC-PRIV-002, SEC-PRIV-0792]
- [ ] **AC-07**: Custom error types (`GitHubApiError`, `TokenExpiredError`) from domain types [ARCH-SOLID-053]
- [ ] **AC-08**: Unit test coverage > 85%
- [ ] **AC-09**: Integration tests with GitHub API mocks (mocked `@forge/api`)
- [ ] **AC-10**: `.reqs.md` sidecar created with requirements traceability

---

## Reglas del Rulebook

| ID Regla         | Categoria    | Descripcion breve                                                   |
| ---------------- | ------------ | ------------------------------------------------------------------- |
| [GH-INTEG-301]   | GitHub       | Paginacion via Link header, per_page=100, nunca asumir pagina unica |
| [GH-INTEG-302]   | GitHub       | Rate limiting: leer X-RateLimit-\* headers, 5000 req/hr, backoff    |
| [GH-INTEG-303]   | GitHub       | Conditional requests con ETag/If-Modified-Since                     |
| [GH-INTEG-304]   | GitHub       | Error classification: 400/403/404/422/5xx con acciones distintas    |
| [GH-INTEG-305]   | GitHub       | Status checks via POST /repos/{owner}/{repo}/statuses/{sha}         |
| [GH-INTEG-309]   | GitHub       | Retry: max 3, exponential backoff 1s/4s/16s, jitter, no retry 4xx   |
| [GH-INTEG-310]   | GitHub       | Error capture: transient->retry, 404->skip+log, auth->surface       |
| [SEC-PRIV-001]   | Security     | Least privilege: scopes repo:status, pull_requests:read only        |
| [SEC-PRIV-002]   | Security     | No sensitive data in logs, comments, or responses                   |
| [SEC-PRIV-003]   | Security     | Token lifecycle: fresh token per operation, never cache >1hr        |
| [SEC-PRIV-004]   | Security     | Validate external API responses before casting (type guards)        |
| [SEC-PRIV-010]   | Security     | Audit log of every token usage (who/what/when/resource)             |
| [SEC-PRIV-051]   | Security     | Validate and sanitize all external input (GitHub API responses)     |
| [SEC-PRIV-0792]  | Security     | No silent error swallowing; every catch logs with context           |
| [FORGE-OPS-005]  | Forge Ops    | No Forge function invocation must exceed 10s execution              |
| [FORGE-OPS-0101] | Forge Ops    | Complete critical work in max 8s, 2s margin against 10s hard limit  |
| [FORGE-OPS-0105] | Forge Ops    | Functions stateless and disposable, no mutable module-level state   |
| [ARCH-SOLID-053] | Architecture | Domain-specific error types, never generic Error                    |
| [ARCH-SOLID-058] | Architecture | Domain types zero framework deps (already satisfied in types/)      |
| [ARCH-SOLID-232] | Architecture | Named exports only, no export default                               |
| [ARCH-SOLID-202] | Architecture | Zero any usage                                                      |
| [ARCH-SOLID-203] | Architecture | Interfaces for data structures, type for unions                     |

---

## Contrato Publico (API del modulo)

### Funciones exportadas

#### `createStatusCheck(params: GitHubStatusCheck, repo: string, sha: string, executionId?: string, timeoutMs?: number): Promise<void>`

- **Proposito**: Creates/updates a Status Check on a PR commit via `POST /repos/{owner}/{repo}/statuses/{sha}` [GH-INTEG-305]
- **Pre-condiciones**: `params` is a valid `GitHubStatusCheck`, `repo` is non-empty string (`owner/repo`), `sha` is a valid commit SHA
- **Post-condiciones**: Status check is created on the commit in GitHub
- **Errores**: `GitHubApiError` (API failure), `TokenExpiredError` (401), `TimeoutError`

#### `createPRComment(repo: string, prNumber: number, body: string, executionId?: string, timeoutMs?: number): Promise<void>`

- **Proposito**: Publishes a Markdown comment on the PR with validated context, score, and suggestions
- **Pre-condiciones**: `repo` is non-empty (`owner/repo`), `prNumber` > 0, `body` is non-empty string with no sensitive data [SEC-PRIV-002]
- **Post-condiciones**: Comment is published on the PR
- **Errores**: `GitHubApiError` (API failure), `TokenExpiredError` (401), `TimeoutError`

#### `getPRData(repo: string, prNumber: number, executionId?: string, timeoutMs?: number): Promise<GitHubPRData>`

- **Proposito**: Fetches PR data: title, description, branch, commits, files changed
- **Pre-condiciones**: `repo` is non-empty (`owner/repo`), `prNumber` > 0
- **Post-condiciones**: Returns typed `GitHubPRData` with all fields populated
- **Errores**: `GitHubApiError` (API failure, 404), `TokenExpiredError` (401), `TimeoutError`

#### `extractJiraKeysFromPR(pr: GitHubPRData): string[]`

- **Proposito**: Extracts Jira ticket IDs from PR title and body via regex `[A-Z]+-\d+`
- **Pre-condiciones**: `pr` is a valid `GitHubPRData` object
- **Post-condiciones**: Returns array of unique Jira ticket key strings (e.g. `['PROJ-123', 'PROJ-456']`)
- **Errores**: None (pure function, no API call)

#### `updateStatusCheck(checkId: string, params: Partial<GitHubStatusCheck>, executionId?: string, timeoutMs?: number): Promise<void>`

- **Proposito**: Updates an existing status check (for re-evaluation)
- **Pre-condiciones**: `checkId` is non-empty string, `params` contains fields to update
- **Post-condiciones**: Status check is updated in GitHub
- **Errores**: `GitHubApiError` (API failure), `TokenExpiredError` (401), `TimeoutError`

#### `listPRFiles(repo: string, prNumber: number, executionId?: string, timeoutMs?: number): Promise<PRFile[]>`

- **Proposito**: Lists modified files in the PR for context analysis (paginated) [GH-INTEG-301]
- **Pre-condiciones**: `repo` is non-empty (`owner/repo`), `prNumber` > 0
- **Post-condiciones**: Returns array of `PRFile` with all files from all pages
- **Errores**: `GitHubApiError` (API failure), `TokenExpiredError` (401), `TimeoutError`

---

## Dependencias (imports)

### Internas (proyecto)

- `src/backend/types` -> `PRFile`, `GitHubPRData`, `GitHubStatusCheck`, `GitHubApiError`, `TokenExpiredError`, `TimeoutError`

### Externas (npm)

- `@forge/api` -> Forge platform API for external HTTP requests (`asApp().requestExternal`)

### NOTA: Capa de integracion

- Este archivo esta en `src/backend/services/github/` -> puede usar `@forge/api`
- Los tipos de dominio (`src/backend/types/`) NO importan `@forge/api`
- **Deviation from GH-INTEG-308**: Octokit.js is not used because Forge runtime does not support it; `@forge/api` fetch wrapper is used instead (same pattern as jira-adapter.ts)

---

## Estrategia de Test

### Unit Tests (`tests/unit/services/github/github-adapter.spec.ts`)

| Test                                                      | AC cubierto | Regla cubierta                |
| --------------------------------------------------------- | ----------- | ----------------------------- |
| should create status check with correct endpoint and body | AC-01       | GH-INTEG-305                  |
| should publish PR comment with valid context              | AC-02       | SEC-PRIV-002                  |
| should extract single Jira key from PR title              | AC-03       | -                             |
| should extract multiple Jira keys from title and body     | AC-03       | -                             |
| should return empty array when no Jira keys found         | AC-03       | -                             |
| should handle mixed case and deduplicate keys             | AC-03       | -                             |
| should timeout via AbortController under 8s               | AC-05       | FORGE-OPS-005, FORGE-OPS-0101 |
| should include executionId in all structured log entries  | AC-06       | SEC-PRIV-002, SEC-PRIV-0792   |
| should throw GitHubApiError on API failure                | AC-07       | ARCH-SOLID-053                |
| should throw TokenExpiredError on 401                     | AC-07       | ARCH-SOLID-053                |
| should classify 400 as no-retry                           | AC-07       | GH-INTEG-304                  |
| should classify 403 as rate-limit backoff                 | AC-07       | GH-INTEG-304                  |
| should classify 404 as skip with log                      | AC-07       | GH-INTEG-304                  |
| should classify 422 as validation failure log+skip        | AC-07       | GH-INTEG-304                  |
| should classify 5xx as transient retry                    | AC-07       | GH-INTEG-304                  |
| should retry with exponential backoff on 429              | -           | GH-INTEG-309                  |
| should not retry on 4xx client errors                     | -           | GH-INTEG-309                  |
| should read rate limit headers before calls               | -           | GH-INTEG-302                  |
| should paginate listPRFiles via Link header               | -           | GH-INTEG-301                  |
| should validate API response with type guards             | -           | SEC-PRIV-004                  |

### Integration Tests

- Mocked `@forge/api` for all 6 public functions

### E2E Tests

- Deployed environment testing per TEST-QA-002

---

## Historial de Cambios

| Fecha      | Tarea Ralph | Cambio                         |
| ---------- | ----------- | ------------------------------ |
| 2026-04-21 | RTASK-011   | Creado inicial (Step 1 - reqs) |
