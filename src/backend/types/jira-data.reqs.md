# REQUISITOS: Jira Data

> **Sidecar File** | Vinculado a: `src/backend/types/jira-data.ts`

---

## Descripcion

Defines the data structures representing Jira ticket data as consumed by the Rovo Execution Guard domain. Includes ticket data, transitions, and status types. These types model the Jira-side bounded context of the Ticket Validation capability.

---

## Acceptance Criteria

- [ ] **AC-01**: `JiraStatus` is a union of four string literals: TO DO, IN PROGRESS, IN REVIEW, DONE
- [ ] **AC-02**: `JiraTransition` has `id`, `name`, `toStatus` (all readonly)
- [ ] **AC-03**: `JiraTicketData` has all required ticket fields with optional `assignee`, `reporter`, `priority`
- [ ] **AC-04**: All interface properties are `readonly`
- [ ] **AC-05**: Zero external dependencies

---

## Reglas del Rulebook

| ID Regla         | Categoria    | Descripcion breve                                            |
| ---------------- | ------------ | ------------------------------------------------------------ |
| [ARCH-SOLID-058] | Arquitectura | Domain layer has zero framework dependencies                 |
| [ARCH-SOLID-202] | TypeScript   | Zero any usage                                               |
| [ARCH-SOLID-203] | TypeScript   | Interfaces for public data structures                        |
| [ARCH-SOLID-061] | Arquitectura | Bounded context: Ticket Validation (Jira-side)               |
| [ARCH-SOLID-002] | Forge        | Jira content read as ADF (upstream concern, not this module) |

---

## Contrato Publico (API del modulo)

### Tipos exportados

#### `JiraStatus`

- **Proposito**: Well-known Jira workflow statuses
- **Valores**: `'TO DO' | 'IN PROGRESS' | 'IN REVIEW' | 'DONE'`

#### `JiraTransition`

- **Proposito**: A single workflow transition available for a ticket
- **Propiedades**: `id`, `name`, `toStatus`

#### `JiraTicketData`

- **Proposito**: Complete ticket data as consumed by the domain
- **Propiedades**: `key`, `summary`, `description`, `status`, optional `assignee`, `reporter`, `priority`, `issueType`, `labels`, `projectKey`, `created`, `updated`

---

## Dependencias (imports)

### Internas

- None (leaf module)
