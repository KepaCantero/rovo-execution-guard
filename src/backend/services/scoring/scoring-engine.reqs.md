# REQUISITOS: Scoring Engine

> **Sidecar File** | Vinculado a: `src/backend/services/scoring/scoring-engine.ts`

---

## Descripcion

Pure domain scoring engine that calculates consistency scores across 5 axes (Clarity, Consistency, Risk, Documentation, TechnicalDebt) and evaluates quality gates for ticket lifecycle transitions. Operates with zero external dependencies, producing deterministic, reproducible results. Uses fixed-precision integer arithmetic internally to avoid floating-point non-determinism.

---

## Acceptance Criteria

- [ ] **AC-01**: `calculateScore` returns scores in the 0-100 range for all 5 axes and overall score
- [ ] **AC-02**: Weighted average is configurable via `ProjectConfig` with sensible defaults (Clarity 25%, Consistency 25%, Risk 20%, Documentation 15%, TechnicalDebt 15%)
- [ ] **AC-03**: All 3 quality gates (Definition, Execution, Delivery) evaluate correctly
- [ ] **AC-04**: Each scoring run produces a unique `executionId`
- [ ] **AC-05**: Custom error types (`ScoringError`, `InsufficientDataError`) are implemented and used
- [ ] **AC-06**: Zero external dependencies in the scoring module
- [ ] **AC-07**: Test coverage exceeds 90%
- [ ] **AC-08**: Scoring is deterministic given the same input
- [ ] **AC-09**: `InsufficientDataError` thrown when ticket lacks minimum data (empty key, summary, or description)
- [ ] **AC-10**: Definition Gate passes when overall score >= configurable threshold (default 80)
- [ ] **AC-11**: Execution Gate fails when there are critical unresolved inconsistencies
- [ ] **AC-12**: Delivery Gate evaluates cross-validation of PR content against historical context
- [ ] **AC-13**: All scoring constants exported and configurable
- [ ] **AC-14**: Fixed-precision rounding (no floating-point drift)
- [ ] **AC-15**: `ScoringInput` extended with optional `relationshipContext` field [AC-04, RTASK-041]
- [ ] **AC-16**: `scoreConsistency` and `scoreDocumentation` use relationship signals when available [AC-05, RTASK-041]

---

## Reglas del Rulebook

| ID Regla          | Categoria    | Descripcion breve                                             |
| ----------------- | ------------ | ------------------------------------------------------------- |
| [ARCH-SOLID-001]  | Arquitectura | Single Responsibility per module                              |
| [ARCH-SOLID-002]  | Arquitectura | Open/Closed: scoring weights configurable without code change |
| [TEST-QA-001]     | Testing      | TDD cycle: RED -> GREEN -> REFACTOR                           |
| [ROVO-INTEG-001]  | Integracion  | Rovo AI integration contract for scoring inputs               |
| [ARCH-SOLID-058]  | Arquitectura | Domain layer has zero framework dependencies                  |
| [ARCH-SOLID-202]  | TypeScript   | Zero any usage                                                |
| [ARCH-SOLID-203]  | TypeScript   | Interfaces for public data structures                         |
| [ARCH-SOLID-0802] | Scoring      | Proprietary weighted scoring combining multiple signals       |
| [ARCH-SOLID-0861] | Arquitectura | Three essential capabilities: scoring, detection, enforcement |

---

## Contrato Publico (API del modulo)

### Constantes exportadas

#### `DEFAULT_AXIS_WEIGHTS`

- **Proposito**: Default weight configuration for the 5 scoring axes
- **Tipo**: `Readonly<Record<ScoringAxisName, number>>`
- **Valores**: clarity=25, consistency=25, risk=20, documentation=15, technicalDebt=15

#### `DEFAULT_SCORE_THRESHOLD`

- **Proposito**: Default minimum score to pass the Definition gate
- **Valor**: 80

#### `SCORING_PRECISION`

- **Proposito**: Number of decimal places for rounding operations
- **Valor**: 2

### Tipos exportados

#### `ScoringAxisName`

- **Proposito**: Union type naming each scoring axis
- **Valores**: `'clarity' | 'consistency' | 'risk' | 'documentation' | 'technicalDebt'`

#### `ScoringInput`

- **Proposito**: Input payload for the scoring engine
- **Propiedades**: `ticket: JiraTicketData`, optional `inconsistencies: readonly Inconsistency[]`, optional `relationshipContext: RelationshipContext` [AC-04, RTASK-041]

#### `AxisWeights`

- **Proposito**: Weight map for scoring axes (must sum to 100)
- **Tipo**: `Readonly<Record<ScoringAxisName, number>>`

### Funciones exportadas

#### `calculateScore(input, config?)`

- **Proposito**: Calculate multi-axis consistency score from ticket data
- **Parametros**: `ScoringInput`, optional `Partial<ProjectConfig>` for weights/threshold
- **Retorna**: `ConsistencyScore`
- **Errores**: `InsufficientDataError` if ticket lacks key/summary/description

#### `evaluateQualityGate(score, gateType, config?, inconsistencies?)`

- **Proposito**: Evaluate whether a score passes a specific quality gate
- **Parametros**: `ConsistencyScore`, `GateType`, optional `ProjectConfig`, optional `Inconsistency[]`
- **Retorna**: `QualityGateResult`

---

## Dependencias (imports)

### Internas

- `ConsistencyScore`, `ScoreAxes` from `../../types/consistency-score`
- `QualityGateResult`, `GateType` from `../../types/quality-gate`
- `Inconsistency` from `../../types/inconsistency`
- `ProjectConfig` from `../../types/project-config`
- `JiraTicketData` from `../../types/jira-data`
- `ScoringError`, `InsufficientDataError` from `../../types/errors`
- `RelationshipContext` from `../../types/relationship-index` (type-only) [RTASK-041]
- `calculateDocumentationSignal`, `calculateConsistencySignal` from `../relationship-index/relationship-consumer` [RTASK-041]

### Externas

- None (zero external dependencies)
