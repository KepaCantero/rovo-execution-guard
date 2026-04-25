# REQUISITOS: Enforcement

> **Sidecar File** | Vinculado a: `src/backend/types/enforcement.ts`

---

## Descripcion

Defines the `EnforcementAction` discriminated union type representing all actions the system can take when a quality gate fails. Each action type has a literal `type` field for narrowing. The four action types cover Jira transition blocking, PR blocking, commenting on Jira/GitHub, and flagging inconsistencies.

---

## Acceptance Criteria

- [ ] **AC-01**: `EnforcementAction` is a discriminated union of four types with literal `type` fields
- [ ] **AC-02**: Each variant has `type` as a unique string literal: `block_transition`, `block_pr`, `add_comment`, `flag_inconsistency`
- [ ] **AC-03**: `BlockTransitionAction` has `transitionId` and `reason`
- [ ] **AC-04**: `BlockPRAction` has `prNumber`, `repo`, and `reason`
- [ ] **AC-05**: `AddCommentAction` has `target` (jira | github) and `body`
- [ ] **AC-06**: `FlagInconsistencyAction` references `Inconsistency` from inconsistency module
- [ ] **AC-07**: All interface properties are `readonly`

---

## Reglas del Rulebook

| ID Regla          | Categoria    | Descripcion breve                                  |
| ----------------- | ------------ | -------------------------------------------------- |
| [ARCH-SOLID-058]  | Arquitectura | Domain layer has zero framework dependencies       |
| [ARCH-SOLID-202]  | TypeScript   | Zero any usage                                     |
| [ARCH-SOLID-203]  | TypeScript   | Interfaces for public data structures              |
| [ARCH-SOLID-0861] | Arquitectura | Enforcement is one of three essential capabilities |

---

## Contrato Publico (API del modulo)

### Tipos exportados

#### `EnforcementAction`

- **Proposito**: Discriminated union of all enforcement actions the system can execute
- **Variantes**: `BlockTransitionAction | BlockPRAction | AddCommentAction | FlagInconsistencyAction`

---

## Dependencias (imports)

### Internas

- `Inconsistency` from `./inconsistency`
