# REQUISITOS: Consistency Score

> **Sidecar File** | Vinculado a: `src/backend/types/consistency-score.ts`

---

## Descripcion

Defines the `ConsistencyScore` and `ScoreAxes` interfaces that represent the output of the scoring engine. The score is a weighted composite across five axes: clarity, consistency, risk, documentation, and technical debt. Each score includes a timestamp and execution ID for traceability.

---

## Acceptance Criteria

- [ ] **AC-01**: `ScoreAxes` has exactly five readonly numeric properties: clarity, consistency, risk, documentation, technicalDebt
- [ ] **AC-02**: `ConsistencyScore` has readonly `overall` number, `axes` object, `timestamp` string, and `executionId` string
- [ ] **AC-03**: All interface properties are `readonly`
- [ ] **AC-04**: Zero external dependencies

---

## Reglas del Rulebook

| ID Regla          | Categoria    | Descripcion breve                                       |
| ----------------- | ------------ | ------------------------------------------------------- |
| [ARCH-SOLID-058]  | Arquitectura | Domain layer has zero framework dependencies            |
| [ARCH-SOLID-202]  | TypeScript   | Zero any usage                                          |
| [ARCH-SOLID-203]  | TypeScript   | Interfaces for public data structures                   |
| [ARCH-SOLID-0802] | Scoring      | Proprietary weighted scoring combining multiple signals |

---

## Contrato Publico (API del modulo)

### Tipos exportados

#### `ScoreAxes`

- **Proposito**: Represents the five individual axis scores that compose the overall score
- **Propiedades**: `clarity`, `consistency`, `risk`, `documentation`, `technicalDebt` (all `number`)

#### `ConsistencyScore`

- **Proposito**: Complete score result from the scoring engine, including breakdown and traceability
- **Propiedades**: `overall: number`, `axes: ScoreAxes`, `timestamp: string`, `executionId: string`

---

## Dependencias (imports)

### Internas

- None (leaf module)
