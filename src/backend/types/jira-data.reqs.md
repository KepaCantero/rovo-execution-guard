# REQUISITOS: Jira Data

> **Sidecar File** | Vinculado a: `src/backend/types/jira-data.ts`

---

## Descripcion

Defines the data structures representing Jira ticket data as consumed by the Rovo Execution Guard domain. Includes ticket data, transitions, status types, and relationship types (issue links, epic hierarchy, fix versions). These types model the Jira-side bounded context of the Ticket Validation capability.

---

## Acceptance Criteria

- [x] **AC-01**: `JiraStatus` is a union of four string literals: TO DO, IN PROGRESS, IN REVIEW, DONE
- [x] **AC-02**: `JiraTransition` has `id`, `name`, `toStatus` (all readonly)
- [x] **AC-03**: `JiraTicketData` has all required ticket fields with optional `assignee`, `reporter`, `priority`
- [x] **AC-04**: All interface properties are `readonly`
- [x] **AC-05**: Zero external dependencies
- [ ] **AC-06**: `JiraIssueLink` type defined with `type`, `direction`, `targetKey`, `targetSummary`, `targetStatus` (all readonly) — [RTASK-042 AC-01]
- [ ] **AC-07**: `JiraTicketData` extended with optional `epicKey`, `epicSummary`, `issueLinks`, `fixVersions` — [RTASK-042 AC-02]
- [ ] **AC-08**: All new fields are optional — existing callers compile unchanged — [RTASK-042 AC-07]

---

## Reglas del Rulebook

| ID Regla         | Categoria    | Descripcion breve                                                |
| ---------------- | ------------ | ---------------------------------------------------------------- |
| [ARCH-SOLID-058] | Arquitectura | Domain layer has zero framework dependencies                     |
| [ARCH-SOLID-202] | TypeScript   | Zero any usage                                                   |
| [ARCH-SOLID-203] | TypeScript   | Interfaces for public data structures                            |
| [ARCH-SOLID-061] | Arquitectura | Bounded context: Ticket Validation (Jira-side)                   |
| [ARCH-SOLID-222] | TypeScript   | `@typescript-eslint/no-explicit-any` at error level              |
| [SEC-PRIV-008]   | Seguridad    | Data minimization — only fields needed for relationship indexing |

---

## Contrato Publico (API del modulo)

### Tipos exportados

#### `JiraStatus`

- **Proposito**: Well-known Jira workflow statuses
- **Valores**: `'TO DO' | 'IN PROGRESS' | 'IN REVIEW' | 'DONE'`

#### `JiraTransition`

- **Proposito**: A single workflow transition available for a ticket
- **Propiedades**: `id`, `name`, `toStatus`

#### `JiraIssueLink`

- **Proposito**: A directional relationship between two Jira issues (blocks, depends on, relates to, etc.)
- **Propiedades**: `type` (link type name), `direction` (`'inward' | 'outward'`), `targetKey`, `targetSummary`, `targetStatus`
- **Rule refs**: ARCH-SOLID-203 (interface), ARCH-SOLID-204 (discriminated union for direction)

#### `JiraTicketData`

- **Proposito**: Complete ticket data as consumed by the domain
- **Propiedades (required)**: `key`, `summary`, `description`, `status`, `issueType`, `labels`, `projectKey`, `created`, `updated`
- **Propiedades (optional, original)**: `assignee`, `reporter`, `priority`
- **Propiedades (optional, RTASK-042)**: `epicKey`, `epicSummary`, `issueLinks` (readonly `JiraIssueLink[]`), `fixVersions` (readonly `string[]`)

---

## Dependencias (imports)

### Internas

- None (leaf module)

---

## Historial de Cambios

| Fecha      | Tarea Ralph | Cambio                                                                                  |
| ---------- | ----------- | --------------------------------------------------------------------------------------- |
| 2026-01-15 | RTASK-009   | Creado inicial                                                                          |
| 2026-05-01 | RTASK-042   | Added `JiraIssueLink` type; extended `JiraTicketData` with optional relationship fields |
