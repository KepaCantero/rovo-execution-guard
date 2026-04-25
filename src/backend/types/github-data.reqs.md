# REQUISITOS: GitHub Data

> **Sidecar File** | Vinculado a: `src/backend/types/github-data.ts`

---

## Descripcion

Defines the data structures representing GitHub pull request data and status checks as consumed by the Rovo Execution Guard domain. These types model the GitHub-side bounded context of the PR Enforcement capability.

---

## Acceptance Criteria

- [ ] **AC-01**: `PRFile` has `filename`, `status` (added | modified | removed), `additions`, `deletions`
- [ ] **AC-02**: `GitHubPRData` has `number`, `title`, `body`, `state` (open | closed | merged), `branch`, `baseBranch`, `files`, `url`
- [ ] **AC-03**: `GitHubStatusCheck` has `state` (pending | success | failure | error), `targetUrl`, `description`, `context`
- [ ] **AC-04**: All interface properties are `readonly`
- [ ] **AC-05**: Zero external dependencies

---

## Reglas del Rulebook

| ID Regla         | Categoria    | Descripcion breve                             |
| ---------------- | ------------ | --------------------------------------------- |
| [ARCH-SOLID-058] | Arquitectura | Domain layer has zero framework dependencies  |
| [ARCH-SOLID-202] | TypeScript   | Zero any usage                                |
| [ARCH-SOLID-203] | TypeScript   | Interfaces for public data structures         |
| [ARCH-SOLID-061] | Arquitectura | Bounded context: PR Enforcement (GitHub-side) |

---

## Contrato Publico (API del modulo)

### Tipos exportados

#### `PRFile`

- **Proposito**: A single file changed in a pull request
- **Propiedades**: `filename`, `status: 'added' | 'modified' | 'removed'`, `additions`, `deletions`

#### `GitHubPRData`

- **Proposito**: Complete pull request data as consumed by the domain
- **Propiedades**: `number`, `title`, `body`, `state`, `branch`, `baseBranch`, `files: readonly PRFile[]`, `url`

#### `GitHubStatusCheck`

- **Proposito**: A status check published to a GitHub commit
- **Propiedades**: `state`, `targetUrl`, `description`, `context`

---

## Dependencias (imports)

### Internas

- None (leaf module)
