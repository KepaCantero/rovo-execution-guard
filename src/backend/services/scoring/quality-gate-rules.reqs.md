# REQUISITOS: Quality Gate Rules Engine

> **Sidecar File** | Vinculado a: `src/backend/services/scoring/quality-gate-rules.ts`

---

## Descripcion

Configurable quality gate rules engine that orchestrates scoring results and inconsistency detection to enforce ticket quality standards at three lifecycle transitions (Definition, Execution, Delivery). Maps gate evaluation results to concrete enforcement actions (block transition, block PR, add comment, flag inconsistency) that control ticket progression. Zero external dependencies — pure domain logic building on RTASK-005 types, RTASK-006 scoring, and RTASK-007 inconsistency detection.

---

## Acceptance Criteria

- [ ] **AC-01**: All 3 gates (Definition, Execution, Delivery) are implemented and evaluate correctly
- [ ] **AC-02**: `evaluateGate` returns a `QualityGateResult` with pass/fail status, reasons, and metadata for each gate
- [ ] **AC-03**: `determineEnforcementActions` returns correct `EnforcementAction[]` based on gate result
- [ ] **AC-04**: All rules are configurable via `ProjectConfig` (scoreThreshold, blockOnCritical, requireDocumentation, enabledGates)
- [ ] **AC-05**: Gate 1 (Definition) blocks transition to "In Progress" when score < threshold
- [ ] **AC-06**: Gate 2 (Execution) blocks PR when critical inconsistencies are present (controlled by `blockOnCritical`)
- [ ] **AC-07**: Gate 3 (Delivery) blocks merge and optionally cross-validates documentation (controlled by `requireDocumentation`)
- [ ] **AC-08**: Zero external dependencies in the quality gate rules module
- [ ] **AC-09**: Test coverage exceeds 90%
- [ ] **AC-10**: Gate evaluation is deterministic: same inputs always produce same results
- [ ] **AC-11**: `canTransition` high-level orchestrator determines whether a ticket can transition to a target status
- [ ] **AC-12**: `blockOnCritical` defaults to `true`; `requireDocumentation` defaults to `true` — accepted as optional parameters with defaults (not extending `ProjectConfig` type)
- [ ] **AC-13**: Disabled gates (via `GateConfig` boolean flags) are skipped during evaluation

---

## Reglas del Rulebook

| ID Regla            | Categoria    | Descripcion breve                                                        |
| ------------------- | ------------ | ------------------------------------------------------------------------ |
| [ARCH-SOLID-049-01] | Arquitectura | SRP: gate rules handle enforcement decisions only, not scoring/detection |
| [ARCH-SOLID-049-02] | Arquitectura | OCP: gate behavior configurable without code change                      |
| [ARCH-SOLID-049-05] | Arquitectura | DIP: configuration injected via parameters, not hardcoded                |
| [ARCH-SOLID-051]    | Arquitectura | Names reveal intention without comments                                  |
| [ARCH-SOLID-052]    | Arquitectura | Functions <= 20 lines, <= 3 levels nesting                               |
| [ARCH-SOLID-053]    | Arquitectura | Domain-specific error types, never generic Error                         |
| [ARCH-SOLID-056]    | Arquitectura | Dependencies point inward; domain depends only on types                  |
| [ARCH-SOLID-058]    | Arquitectura | Domain layer zero framework dependencies                                 |
| [ARCH-SOLID-061]    | Arquitectura | Bounded context: Ticket Validation / PR Enforcement                      |
| [ARCH-SOLID-060]    | Arquitectura | Variables use business vocabulary                                        |
| [ARCH-SOLID-069]    | Arquitectura | Pure higher-order functions, no shared mutable state                     |
| [ARCH-SOLID-0861]   | Arquitectura | Three essential capabilities: scoring, detection, enforcement            |
| [ARCH-SOLID-0912]   | Arquitectura | Idempotent: same input produces same output                              |
| [ARCH-SOLID-0941]   | Arquitectura | Critical algorithms document Big-O complexity                            |
| [ARCH-SOLID-202]    | TypeScript   | Zero any usage                                                           |
| [ARCH-SOLID-203]    | TypeScript   | Interfaces for public data structures                                    |
| [ARCH-SOLID-205]    | TypeScript   | All exported functions declare explicit return types                     |
| [ROVO-INTEG-004]    | Integracion  | Rovo context treated as untrusted data, validated before use             |
| [ROVO-INTEG-0915]   | Integracion  | System must not depend on Rovo availability for critical enforcement     |
| [ROVO-INTEG-0943]   | Integracion  | Text similarity with empirically calibrated thresholds                   |
| [GH-INTEG-001]      | Integracion  | PR status check reflects ticket validation state                         |
| [FORGE-OPS-058]     | Performance  | Algorithms must not exceed O(n log n)                                    |
| [FORGE-OPS-059]     | Performance  | Use Map/Set for indexed lookups, not linear array search                 |
| [TEST-QA-056]       | Testing      | TDD cycle: RED -> GREEN -> REFACTOR                                      |
| [TEST-QA-057]       | Testing      | Cover edge cases: threshold boundaries, empty payloads, missing fields   |
| [TEST-QA-201]       | Testing      | Arrange-Act-Assert structure                                             |

---

## Contrato Publico (API del modulo)

### Tipos exportados

#### `GateEvaluationInput`

- **Proposito**: Composite input type for gate evaluation, bundling score, inconsistencies, config, and optional PR data
- **Propiedades**:
  - `score: ConsistencyScore` — the computed consistency score
  - `inconsistencies: readonly Inconsistency[]` — detected inconsistencies
  - `config: ProjectConfig` — project configuration including gate toggles and score threshold
  - `prData?: Readonly<{ prNumber: number; repo: string }>` — optional PR metadata for enforcement actions
  - `ticketKey: string` — the ticket being evaluated
  - `documentationRefs?: readonly string[]` — optional documentation references for delivery gate cross-validation

#### `QualityGateRulesConfig`

- **Proposito**: Additional configuration options not present in `ProjectConfig`, with defaults
- **Propiedades**:
  - `blockOnCritical?: boolean` — whether critical inconsistencies block execution gate (default: `true`)
  - `requireDocumentation?: boolean` — whether documentation cross-check is required for delivery gate (default: `true`)

### Funciones exportadas

#### `evaluateGate(gate, input, rulesConfig?) -> QualityGateResult`

- **Proposito**: Evaluate a specific quality gate using the provided composite input data
- **Pre-condiciones**: `input.score` must be a valid `ConsistencyScore`; `input.config.gates[gate]` should be `true` for evaluation to proceed
- **Post-condiciones**: Returns `QualityGateResult` with deterministic pass/fail status, reasons, and metadata
- **Errores**: None — disabled gates return a "passed" result
- **Complejidad**: O(n) where n = number of inconsistencies [ARCH-SOLID-0941]

#### `determineEnforcementActions(result, prData?) -> EnforcementAction[]`

- **Proposito**: Given a `QualityGateResult`, determine what enforcement actions should be taken
- **Pre-condiciones**: Valid `QualityGateResult` from `evaluateGate`
- **Post-condiciones**: Returns array of `EnforcementAction` discriminated union objects:
  - Definition fail -> `BlockTransitionAction` + `AddCommentAction`
  - Execution fail -> `BlockPRAction` + `FlagInconsistencyAction` for each critical inconsistency
  - Delivery fail -> `BlockTransitionAction` + `AddCommentAction`
- **Errores**: None
- **Complejidad**: O(n) where n = number of critical inconsistencies [ARCH-SOLID-0941]

#### `canTransition(ticketKey, targetStatus, input, rulesConfig?) -> boolean`

- **Proposito**: High-level function that checks whether a ticket can transition to a target status
- **Pre-condiciones**: Valid `GateEvaluationInput` with populated `config` and `score`
- **Post-condiciones**: Returns `true` if the applicable gate passes, `false` otherwise
- **Errores**: None
- **Complejidad**: O(1) — delegates to `evaluateGate` for a single gate [ARCH-SOLID-0941]

---

## Dependencias (imports)

### Internas (proyecto)

- `src/backend/types/quality-gate` -> `QualityGateResult`, `GateType`
- `src/backend/types/consistency-score` -> `ConsistencyScore`
- `src/backend/types/inconsistency` -> `Inconsistency`, `Severity`
- `src/backend/types/enforcement` -> `EnforcementAction`
- `src/backend/types/project-config` -> `ProjectConfig`, `GateConfig`
- `src/backend/types/errors` -> `ScoringError`, `InsufficientDataError`

### Externas

- None (zero external dependencies)

### NOTA: Capa de dominio

- This file is in `src/backend/services/scoring/` -> ZERO external dependencies [ARCH-SOLID-058]

---

## Estrategia de Test

### Unit Tests (`tests/unit/services/scoring/quality-gate-rules.spec.ts`)

| Test                                                                | AC cubierto  | Regla cubierta    |
| ------------------------------------------------------------------- | ------------ | ----------------- |
| should pass Definition gate when score >= threshold                 | AC-01, AC-05 | -                 |
| should fail Definition gate when score < threshold                  | AC-01, AC-05 | -                 |
| should pass Execution gate with no critical inconsistencies         | AC-01, AC-06 | -                 |
| should fail Execution gate when critical inconsistencies exist      | AC-01, AC-06 | -                 |
| should pass Execution gate with critical when blockOnCritical=false | AC-06, AC-12 | ARCH-SOLID-049-05 |
| should pass Delivery gate when all conditions met                   | AC-01, AC-07 | -                 |
| should fail Delivery gate when score below threshold                | AC-01, AC-07 | -                 |
| should skip documentation check when requireDocumentation=false     | AC-07, AC-12 | ARCH-SOLID-049-05 |
| should skip disabled gates and return passed                        | AC-13        | -                 |
| should return BlockTransitionAction for Definition fail             | AC-03, AC-05 | ARCH-SOLID-0861   |
| should return BlockPRAction for Execution fail                      | AC-03, AC-06 | GH-INTEG-001      |
| should return FlagInconsistencyAction for each critical inc         | AC-03        | ARCH-SOLID-0861   |
| should return AddCommentAction for each failed gate                 | AC-03        | -                 |
| should return empty actions for passed gate                         | AC-03        | -                 |
| should allow transition when applicable gate passes                 | AC-11        | -                 |
| should block transition when applicable gate fails                  | AC-11        | -                 |
| should be deterministic for same input                              | AC-10        | ARCH-SOLID-0912   |
| should use ProjectConfig.scoreThreshold                             | AC-04        | ARCH-SOLID-049-05 |
| should respect GateConfig boolean flags                             | AC-04, AC-13 | -                 |
| should handle score exactly at threshold (boundary)                 | AC-05        | TEST-QA-057       |
| should handle empty inconsistencies list                            | AC-01        | TEST-QA-057       |
| should handle all gates disabled                                    | AC-13        | TEST-QA-057       |
| should default blockOnCritical to true                              | AC-12        | -                 |
| should default requireDocumentation to true                         | AC-12        | -                 |

---

## Historial de Cambios

| Fecha      | Tarea Ralph | Cambio         |
| ---------- | ----------- | -------------- |
| 2026-04-15 | RTASK-008   | Creado inicial |
