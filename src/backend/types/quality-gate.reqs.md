# REQUISITOS: Quality Gate

> **Sidecar File** | Vinculado a: `src/backend/types/quality-gate.ts`

---

## Descripcion

Defines the `QualityGateResult` interface and `GateType` union type. A quality gate is the core enforcement mechanism: it evaluates a consistency score against thresholds and produces a pass/fail result with associated inconsistencies and blocked transitions. The three gate types (definition, execution, delivery) correspond to the three phases of the software development lifecycle.

---

## Acceptance Criteria

- [ ] **AC-01**: `GateType` is a union of three string literals: definition, execution, delivery
- [ ] **AC-02**: `QualityGateResult` includes `gate`, `passed`, `score`, `inconsistencies`, `blockedTransitions`, `executionId`
- [ ] **AC-03**: `score` property references `ConsistencyScore` from the consistency-score module
- [ ] **AC-04**: `inconsistencies` is a readonly array of `Inconsistency` from the inconsistency module
- [ ] **AC-05**: All interface properties are `readonly`
- [ ] **AC-06**: Zero external dependencies (only internal type imports)

---

## Reglas del Rulebook

| ID Regla          | Categoria    | Descripcion breve                                             |
| ----------------- | ------------ | ------------------------------------------------------------- |
| [ARCH-SOLID-058]  | Arquitectura | Domain layer has zero framework dependencies                  |
| [ARCH-SOLID-202]  | TypeScript   | Zero any usage                                                |
| [ARCH-SOLID-203]  | TypeScript   | Interfaces for public data structures                         |
| [ARCH-SOLID-061]  | Arquitectura | Bounded contexts: Ticket Validation, PR Enforcement           |
| [ARCH-SOLID-0861] | Arquitectura | Three essential capabilities: scoring, detection, enforcement |

---

## Contrato Publico (API del modulo)

### Tipos exportados

#### `GateType`

- **Proposito**: Identifies which lifecycle phase the gate guards
- **Valores**: `'definition' | 'execution' | 'delivery'`

#### `QualityGateResult`

- **Proposito**: Complete result of a quality gate evaluation
- **Propiedades**: `gate: GateType`, `passed: boolean`, `score: ConsistencyScore`, `inconsistencies: readonly Inconsistency[]`, `blockedTransitions: readonly string[]`, `executionId: string`

---

## Dependencias (imports)

### Internas

- `ConsistencyScore` from `./consistency-score`
- `Inconsistency` from `./inconsistency`
