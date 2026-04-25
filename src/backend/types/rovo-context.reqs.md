# REQUISITOS: Rovo Context

> **Sidecar File** | Vinculado a: `src/backend/types/rovo-context.ts`

---

## Descripcion

Defines the data structures returned by Rovo AI when querying organizational context. `RovoContext` aggregates documents, related tickets, and historical decisions into a single object used by the scoring engine to evaluate ticket quality against the broader organizational knowledge base.

---

## Acceptance Criteria

- [ ] **AC-01**: `RovoDocument` has `id`, `title`, `content`, `source`, `relevance` (all readonly)
- [ ] **AC-02**: `HistoricalDecision` has `id`, `title`, `description`, `date`, `source` (all readonly)
- [ ] **AC-03**: `RovoContext` has `documents`, `relatedTickets`, `decisions`, `query`, `timestamp` (all readonly)
- [ ] **AC-04**: Array properties use `readonly` modifier for immutability
- [ ] **AC-05**: Zero external dependencies

---

## Reglas del Rulebook

| ID Regla          | Categoria    | Descripcion breve                               |
| ----------------- | ------------ | ----------------------------------------------- |
| [ARCH-SOLID-058]  | Arquitectura | Domain layer has zero framework dependencies    |
| [ARCH-SOLID-202]  | TypeScript   | Zero any usage                                  |
| [ARCH-SOLID-203]  | TypeScript   | Interfaces for public data structures           |
| [ROVO-INTEG-004]  | Rovo         | Rovo context treated as untrusted data          |
| [ROVO-INTEG-0893] | Rovo         | RovoContext is typed and reliable for consumers |

---

## Contrato Publico (API del modulo)

### Tipos exportados

#### `RovoDocument`

- **Proposito**: A single document retrieved from Rovo AI
- **Propiedades**: `id`, `title`, `content`, `source`, `relevance: number`

#### `HistoricalDecision`

- **Proposito**: A past architectural or design decision found by Rovo
- **Propiedades**: `id`, `title`, `description`, `date`, `source`

#### `RovoContext`

- **Proposito**: Complete context bundle returned by Rovo for a query
- **Propiedades**: `documents: readonly RovoDocument[]`, `relatedTickets: readonly string[]`, `decisions: readonly HistoricalDecision[]`, `query`, `timestamp`

---

## Dependencias (imports)

### Internas

- None (leaf module)
