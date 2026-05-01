# REQUISITOS: Inconsistency

> **Sidecar File** | Vinculado a: `src/backend/types/inconsistency.ts`

---

## Descripcion

Defines the types for inconsistency detection between Jira tickets, Confluence documentation, GitHub PRs, and Rovo context. An inconsistency is a detected contradiction, duplication, missing context, or ambiguity found during quality gate evaluation. Uses string literal union types instead of enums per project conventions.

---

## Acceptance Criteria

- [ ] **AC-01**: `InconsistencyType` is a union of eight string literals: contradiction, duplicate, missing_context, ambiguity, sibling_contradiction, spec_drift, scope_mismatch, orphan_reference
- [ ] **AC-02**: `Severity` is a union of three string literals: critical, warning, info
- [ ] **AC-03**: `InconsistencySource` is a union of four string literals: rovo, jira, confluence, github
- [ ] **AC-04**: `Inconsistency` interface has all required fields and optional `relatedDocs` and `suggestion`
- [ ] **AC-05**: No enums used — string literal unions only
- [ ] **AC-06**: All interface properties are `readonly`

---

## Reglas del Rulebook

| ID Regla          | Categoria    | Descripcion breve                               |
| ----------------- | ------------ | ----------------------------------------------- |
| [ARCH-SOLID-058]  | Arquitectura | Domain layer has zero framework dependencies    |
| [ARCH-SOLID-202]  | TypeScript   | Zero any usage                                  |
| [ARCH-SOLID-203]  | TypeScript   | Interfaces for public data structures           |
| [ARCH-SOLID-0784] | Arquitectura | Pipeline of independent inconsistency detectors |

---

## Contrato Publico (API del modulo)

### Tipos exportados

#### `InconsistencyType`

- **Proposito**: Discriminates the kind of inconsistency detected
- **Valores**: `'contradiction' | 'duplicate' | 'missing_context' | 'ambiguity' | 'sibling_contradiction' | 'spec_drift' | 'scope_mismatch' | 'orphan_reference'`

#### `Severity`

- **Proposito**: How severe the inconsistency is
- **Valores**: `'critical' | 'warning' | 'info'`

#### `InconsistencySource`

- **Proposito**: Which system detected or owns the inconsistency
- **Valores**: `'rovo' | 'jira' | 'confluence' | 'github'`

#### `Inconsistency`

- **Proposito**: Full representation of a detected inconsistency
- **Propiedades**: `id`, `type`, `severity`, `source`, `description`, `affectedTicketKey`, optional `relatedDocs`, optional `suggestion`

---

## Dependencias (imports)

### Internas

- None (leaf module)
