# REQUISITOS: Confluence API Adapter

> **Sidecar File** | Vinculado a: `src/backend/services/confluence/confluence-adapter.ts`

---

## Descripcion

Typed, error-resilient adapter wrapping `@forge/api` `requestConfluence` for all Confluence Cloud API interactions. Provides a clean domain-facing API for searching pages, extracting content (including ADF format handling), retrieving metadata, and listing space pages. Handles authentication, rate limiting, timeouts, and structured logging transparently.

---

## Acceptance Criteria

- [ ] **AC-01**: All functions (`searchPages`, `getPageContent`, `getPageMetadata`, `getSpacePages`) use `@forge/api` `requestConfluence` for authentication
- [ ] **AC-02**: Custom error types (`ConfluenceApiError`, `PageNotFoundError`, `SpaceNotFoundError`) are used for all failure paths
- [ ] **AC-03**: ADF format handled in content responses — plain text extraction from Atlassian Document Format
- [ ] **AC-04**: Correct pagination for large result sets using `start` and `limit` parameters
- [ ] **AC-05**: Timeout implemented using `AbortController` with configurable duration (default 10s, capped at 10s)
- [ ] **AC-06**: Structured logging includes `executionId` correlation on every API call
- [ ] **AC-07**: Unit test coverage exceeds 85%
- [ ] **AC-08**: `.reqs.md` sidecar file created with requirements traceability

---

## Reglas del Rulebook

| ID Regla         | Categoria    | Descripcion breve                                                            |
| ---------------- | ------------ | ---------------------------------------------------------------------------- |
| [FORGE-OPS-001]  | Forge Ops    | Manifest must have exactly app, modules, permissions                         |
| [FORGE-OPS-003]  | Forge Ops    | App must not declare more than 100 modules in manifest                       |
| [FORGE-OPS-005]  | Forge Ops    | No Forge function invocation must exceed 10s execution                       |
| [SEC-PRIV-001]   | Security     | Least privilege — only `read:confluence-content`, `write:confluence-content` |
| [SEC-PRIV-002]   | Security     | No sensitive data in structured logs                                         |
| [SEC-PRIV-004]   | Security     | Validate external API responses before casting                               |
| [SEC-PRIV-008]   | Security     | Data minimization — only request needed fields                               |
| [ARCH-SOLID-003] | Architecture | Expand only necessary fields, never request full body                        |
| [ARCH-SOLID-053] | Architecture | Domain-specific error types, never generic Error                             |
| [ARCH-SOLID-058] | Architecture | Domain types zero framework deps (integration layer wraps @forge/api)        |
| [ARCH-SOLID-201] | Architecture | `"strict": true` in tsconfig.json                                            |
| [ARCH-SOLID-202] | Architecture | Zero `any` usage                                                             |
| [ARCH-SOLID-203] | Architecture | Interfaces for data structures, `type` for unions                            |
| [ARCH-SOLID-232] | Architecture | Named exports as default, no `export default`                                |

---

## Contrato Publico (API del modulo)

### Funciones exportadas

#### `searchPages(query: string, spaceKeys?: string[], executionId?: string, timeoutMs?: number): Promise<ConfluencePageData[]>`

- **Proposito**: Searches pages by text in Confluence. Filters by spaces if specified.
- **Pre-condiciones**: `query` is a non-empty string
- **Post-condiciones**: Returns array of `ConfluencePageData` matching the search
- **Errores**: `ConfluenceApiError` (general), `TimeoutError`
- **API Endpoint**: `GET /wiki/rest/api/content/search?cql=...`
- **CQL Construction**: `type=page AND title~"{query}"` with optional `AND space in (...)` filter
- **Pagination**: Supports `start` and `limit` parameters

#### `getPageContent(pageId: string, executionId?: string, timeoutMs?: number): Promise<string>`

- **Proposito**: Gets page content as plain text. Handles Atlassian Document Format (ADF).
- **Pre-condiciones**: `pageId` is a non-empty string
- **Post-condiciones**: Returns page content as plain text string
- **Errores**: `PageNotFoundError` (404), `ConfluenceApiError` (other), `TimeoutError`
- **API Endpoint**: `GET /wiki/rest/api/content/{pageId}?expand=body.storage`
- **ADF Handling**: Extracts text from storage format (HTML), strips markup for plain text

#### `getPageMetadata(pageId: string, executionId?: string, timeoutMs?: number): Promise<ConfluencePageMetadata>`

- **Proposito**: Gets metadata: title, space, last edit, labels, version
- **Pre-condiciones**: `pageId` is a non-empty string
- **Post-condiciones**: Returns typed `ConfluencePageMetadata` with all fields populated
- **Errores**: `PageNotFoundError` (404), `ConfluenceApiError` (other), `TimeoutError`
- **API Endpoint**: `GET /wiki/rest/api/content/{pageId}?expand=metadata.labels,version,space`
- **Data Mapping**: Maps Confluence API response fields to domain `ConfluencePageMetadata`

#### `getSpacePages(spaceKey: string, limit?: number, executionId?: string, timeoutMs?: number): Promise<ConfluencePageData[]>`

- **Proposito**: Gets pages from a specific space with controlled pagination
- **Pre-condiciones**: `spaceKey` is a non-empty string
- **Post-condiciones**: Returns array of `ConfluencePageData` from the specified space
- **Errores**: `SpaceNotFoundError` (404), `ConfluenceApiError` (other), `TimeoutError`
- **API Endpoint**: `GET /wiki/rest/api/content?spaceKey={spaceKey}&limit={limit}`
- **Pagination**: Controlled via `limit` parameter (default 25, max 100)

---

## Dependencias (imports)

### Internas (proyecto)

- `src/backend/types` -> `ConfluencePageData`, `ConfluencePageMetadata`, `ConfluenceApiError`, `PageNotFoundError`, `SpaceNotFoundError`, `TimeoutError`

### Externas (npm)

- `@forge/api` -> `requestConfluence` (Forge platform API)

### NOTA: Capa de integracion

- Este archivo esta en `src/backend/services/confluence/` -> puede usar `@forge/api`
- Los tipos de dominio (`src/backend/types/`) NO importan `@forge/api`

---

## Estrategia de Test

### Unit Tests (`tests/unit/services/confluence/confluence-adapter.spec.ts`)

| Test                                                  | AC cubierto | Regla cubierta |
| ----------------------------------------------------- | ----------- | -------------- |
| should search pages with valid query                  | AC-01       | SEC-PRIV-004   |
| should search pages filtered by space keys            | AC-01       | SEC-PRIV-004   |
| should extract plain text from ADF/HTML content       | AC-03       | ARCH-SOLID-003 |
| should return page metadata for valid page ID         | AC-01       | SEC-PRIV-004   |
| should return pages from a specific space             | AC-01       | SEC-PRIV-004   |
| should throw PageNotFoundError on HTTP 404 for page   | AC-02       | ARCH-SOLID-053 |
| should throw SpaceNotFoundError on HTTP 404 for space | AC-02       | ARCH-SOLID-053 |
| should throw ConfluenceApiError on HTTP 500           | AC-02       | ARCH-SOLID-053 |
| should include executionId in all log entries         | AC-06       | SEC-PRIV-002   |
| should backoff and retry on HTTP 429                  | AC-05       | FORGE-OPS-005  |
| should timeout via AbortController after 10s          | AC-05       | FORGE-OPS-005  |
| should validate API response before casting           | AC-01       | SEC-PRIV-004   |
| should paginate correctly for large result sets       | AC-04       | ARCH-SOLID-003 |
| should handle empty search results                    | AC-01       | SEC-PRIV-004   |
| should handle network errors with ConfluenceApiError  | AC-02       | ARCH-SOLID-053 |

### Integration Tests

- Mocked `@forge/api` `requestConfluence` for all 4 functions

### E2E Tests

- Deployed environment testing per TEST-QA-002

---

## Historial de Cambios

| Fecha      | Tarea Ralph | Cambio                         |
| ---------- | ----------- | ------------------------------ |
| 2026-04-24 | RTASK-012   | Creado inicial (Step 1 - reqs) |
