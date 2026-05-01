# REQUISITOS: Jira API Adapter

> **Sidecar File** | Vinculado a: `src/backend/services/jira/jira-adapter.ts`

---

## Descripcion

Typed, error-resilient adapter wrapping `@forge/api` `requestJira` for all Jira interactions. Provides a clean domain-facing API for reading ticket data, managing project configurations, controlling ticket transitions, and adding comments. Handles authentication, rate limiting, timeouts, and structured logging transparently.

---

## Acceptance Criteria

- [ ] **AC-01**: All functions (`getTicketData`, `getProjectConfig`, `saveProjectConfig`, `transitionIssue`, `getTransitions`, `addComment`, `getIssueStatus`) use `@forge/api` `requestJira` for authentication
- [ ] **AC-02**: Custom error types (`JiraApiError`, `TicketNotFoundError`, `PermissionDeniedError`, `TransitionBlockedError`) are used for all failure paths
- [ ] **AC-03**: Structured logging includes `executionId` correlation on every API call
- [ ] **AC-04**: Rate limiting respected with exponential backoff on HTTP 429 responses
- [ ] **AC-05**: Timeout implemented using `AbortController` with configurable duration (default 10s)
- [ ] **AC-06**: Test coverage exceeds 85%
- [ ] **AC-07**: Integration tests use mocked `@forge/api` responses
- [ ] **AC-08**: `.reqs.md` sidecar file created with requirements traceability
- [ ] **AC-09**: `getTicketData` fetches epic link (customfield_10014) and issue links when available — graceful undefined when absent [RTASK-042]
- [ ] **AC-10**: `searchByJQL(jql, maxResults?, executionId?)` executes JQL queries and returns typed `JiraTicketData[]` [RTASK-042]
- [ ] **AC-11**: `getEpicChildren(epicKey, executionId?)` fetches all children of an epic with parent=/Epic Link fallback — never throws [RTASK-042]
- [ ] **AC-12**: `discoverEpicLinkField()` discovers epic link custom field ID via /rest/api/3/field with customfield_10014 fallback [RTASK-042]
- [ ] **AC-13**: All new relationship fields optional — existing callers unaffected [RTASK-042]

---

## Reglas del Rulebook

| ID Regla         | Categoria    | Descripcion breve                                          |
| ---------------- | ------------ | ---------------------------------------------------------- |
| [FORGE-OPS-005]  | Forge Ops    | No Forge function invocation must exceed 10s execution     |
| [FORGE-OPS-010]  | Forge Ops    | Handle HTTP 303 async operations with polling              |
| [SEC-PRIV-001]   | Security     | Least privilege - only `read:jira-work`, `write:jira-work` |
| [SEC-PRIV-002]   | Security     | No sensitive data in structured logs                       |
| [SEC-PRIV-004]   | Security     | Validate external API responses before casting             |
| [SEC-PRIV-008]   | Security     | Data minimization - only request needed fields             |
| [ARCH-SOLID-003] | Architecture | Expand only necessary fields, never request full body      |
| [ARCH-SOLID-053] | Architecture | Domain-specific error types, never generic Error           |
| [ARCH-SOLID-058] | Architecture | Domain types zero framework deps (errors.ts stays pure)    |
| [ARCH-SOLID-201] | Architecture | `"strict": true` in tsconfig.json                          |
| [ARCH-SOLID-202] | Architecture | Zero `any` usage                                           |
| [ARCH-SOLID-203] | Architecture | Interfaces for data structures, `type` for unions          |
| [ARCH-SOLID-204] | Architecture | Generics with explicit constraints where needed            |
| [ARCH-SOLID-232] | Architecture | Named exports as default, no `export default`              |
| [ARCH-SOLID-003] | Architecture | Expand only necessary fields, never request full body      |
| [ARCH-SOLID-205] | Architecture | Explicit return types on exported functions                |
| [FORGE-OPS-0101] | Forge Ops    | 8s timeout budget (10s limit - 2s margin)                  |
| [FORGE-OPS-008]  | Forge Ops    | No Forge function must make more than 100 network requests |

---

## Contrato Publico (API del modulo)

### Funciones exportadas

#### `getTicketData(issueKey: string, executionId?: string): Promise<JiraTicketData>`

- **Proposito**: Fetches complete ticket data for a given issue key
- **Pre-condiciones**: `issueKey` is a non-empty string
- **Post-condiciones**: Returns typed `JiraTicketData` with all fields populated
- **Errores**: `TicketNotFoundError` (404), `PermissionDeniedError` (403), `JiraApiError` (other), `TimeoutError`

#### `getProjectConfig(projectKey: string, executionId?: string): Promise<ProjectConfig>`

- **Proposito**: Retrieves project-level configuration for the execution guard
- **Pre-condiciones**: `projectKey` is a non-empty string
- **Post-condiciones**: Returns `ProjectConfig` (default config if none stored)
- **Errores**: `PermissionDeniedError` (403), `JiraApiError` (other), `TimeoutError`

#### `saveProjectConfig(config: ProjectConfig, executionId?: string): Promise<void>`

- **Proposito**: Persists project configuration via app storage
- **Pre-condiciones**: `config` is a valid `ProjectConfig`
- **Post-condiciones**: Configuration is persisted
- **Errores**: `PermissionDeniedError` (403), `JiraApiError` (other), `TimeoutError`

#### `transitionIssue(issueKey: string, transitionId: string, executionId?: string): Promise<void>`

- **Proposito**: Transitions an issue using the given transition ID
- **Pre-condiciones**: `issueKey` and `transitionId` are non-empty strings
- **Post-condiciones**: Issue is transitioned to new status
- **Errores**: `TicketNotFoundError` (404), `PermissionDeniedError` (403), `TransitionBlockedError` (disallowed), `JiraApiError` (other), `TimeoutError`

#### `getTransitions(issueKey: string, executionId?: string): Promise<readonly JiraTransition[]>`

- **Proposito**: Returns available transitions for the given issue
- **Pre-condiciones**: `issueKey` is a non-empty string
- **Post-condiciones**: Returns readonly array of `JiraTransition`
- **Errores**: `TicketNotFoundError` (404), `PermissionDeniedError` (403), `JiraApiError` (other), `TimeoutError`

#### `addComment(issueKey: string, body: string, executionId?: string): Promise<void>`

- **Proposito**: Adds a comment to the specified issue
- **Pre-condiciones**: `issueKey` and `body` are non-empty strings
- **Post-condiciones**: Comment is added to the issue
- **Errores**: `TicketNotFoundError` (404), `PermissionDeniedError` (403), `JiraApiError` (other), `TimeoutError`

#### `getIssueStatus(issueKey: string, executionId?: string): Promise<string>`

- **Proposito**: Returns the current status name of the issue
- **Pre-condiciones**: `issueKey` is a non-empty string
- **Post-condiciones**: Returns status name as string
- **Errores**: `TicketNotFoundError` (404), `PermissionDeniedError` (403), `JiraApiError` (other), `TimeoutError`

#### `searchByJQL(jql: string, maxResults?: number, executionId?: string): Promise<readonly JiraTicketData[]>`

- **Proposito**: Search for Jira issues using JQL query [RTASK-042]
- **Pre-condiciones**: `jql` is a non-empty valid JQL string
- **Post-condiciones**: Returns readonly array of `JiraTicketData` matching the query (max 100)
- **Errores**: `JiraApiError` (API failure), `TimeoutError` (timeout)

#### `getEpicChildren(epicKey: string, executionId?: string): Promise<readonly JiraTicketData[]>`

- **Proposito**: Fetch all issues belonging to an epic [RTASK-042]
- **Pre-condiciones**: `epicKey` is a valid epic issue key
- **Post-condiciones**: Returns readonly array of child `JiraTicketData` (empty if no children or errors)
- **Errores**: Never throws — graceful degradation with empty array

---

## Dependencias (imports)

### Internas (proyecto)

- `src/backend/types` -> `JiraTicketData`, `JiraTransition`, `JiraStatus`, `JiraIssueLink`, `ProjectConfig`, `JiraApiError`, `TicketNotFoundError`, `PermissionDeniedError`, `TransitionBlockedError`, `TimeoutError`

### Externas (npm)

- `@forge/api` -> `requestJira` (Forge platform API)

### NOTA: Capa de integracion

- Este archivo esta en `src/backend/services/jira/` -> puede usar `@forge/api`
- Los tipos de dominio (`src/backend/types/`) NO importan `@forge/api`

---

## Estrategia de Test

### Unit Tests (`tests/unit/services/jira/jira-adapter.spec.ts`)

| Test                                             | AC cubierto | Regla cubierta               |
| ------------------------------------------------ | ----------- | ---------------------------- |
| should return typed ticket data for valid key    | AC-01       | SEC-PRIV-004                 |
| should throw TicketNotFoundError on 404          | AC-02       | ARCH-SOLID-053               |
| should throw PermissionDeniedError on 403        | AC-02       | ARCH-SOLID-053               |
| should throw TransitionBlockedError on reject    | AC-02       | ARCH-SOLID-053               |
| should include executionId in all log entries    | AC-03       | SEC-PRIV-002                 |
| should backoff and retry on HTTP 429             | AC-04       | FORGE-OPS-005                |
| should timeout via AbortController after 10s     | AC-05       | FORGE-OPS-005                |
| should validate API response before casting      | AC-01       | SEC-PRIV-004                 |
| should use only read:jira-work, write:jira-work  | AC-01       | SEC-PRIV-001                 |
| should request only needed fields                | AC-01       | ARCH-SOLID-003, SEC-PRIV-008 |
| should include epicKey from customfield_10014    | AC-09       | SEC-PRIV-008                 |
| should include issueLinks with direction         | AC-09       | SEC-PRIV-004                 |
| should include fixVersions                       | AC-09       | SEC-PRIV-008                 |
| should return undefined when fields absent       | AC-13       | ARCH-SOLID-202               |
| should search by JQL and return typed results    | AC-10       | ARCH-SOLID-003, SEC-PRIV-008 |
| should cap maxResults at 100                     | AC-10       | FORGE-OPS-008                |
| should get epic children with parent= fallback   | AC-11       | ARCH-SOLID-053               |
| should return empty array on both query failures | AC-11       | ARCH-SOLID-053               |
| should discover epic link field with fallback    | AC-12       | SEC-PRIV-004                 |

### Integration Tests

- Mocked `@forge/api` `requestJira` for all 9 functions

### E2E Tests

- Deployed environment testing per TEST-QA-002

---

## Historial de Cambios

| Fecha      | Tarea Ralph | Cambio                                                                                          |
| ---------- | ----------- | ----------------------------------------------------------------------------------------------- |
| 2026-04-19 | RTASK-009   | Creado inicial (Step 1 - reqs)                                                                  |
| 2026-05-01 | RTASK-042   | Added AC-09 to AC-13 (relationship fields, searchByJQL, getEpicChildren, discoverEpicLinkField) |
