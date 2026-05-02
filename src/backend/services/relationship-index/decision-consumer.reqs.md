# REQUISITOS: Decision Consumer

> **Sidecar File** | Vinculado a: `src/backend/services/relationship-index/decision-consumer.ts`

---

## Descripcion

Operational memory consumer that analyzes past enforcement decisions to detect override patterns and suggest threshold adjustments. Pure function module — receives `DecisionRecord[]` as input, no storage reads. Prevents the system from repeating enforcement mistakes by consulting historical patterns before acting.

---

## Acceptance Criteria

- [ ] **AC-18**: `analyzeDecisionPatterns` queries past decisions and detects override patterns
- [ ] **AC-21**: Operational memory consulted before enforcement decisions
- [ ] **AC-22**: Override patterns adjust threshold suggestions (soften/escalate/proceed)
- [ ] **AC-DC-01**: `computeContextSignature` produces deterministic signature for same inputs
- [ ] **AC-DC-02**: Score bucketing: 0-40 low, 40-70 mid, 70-100 high
- [ ] **AC-DC-03**: Inconsistency count bucketing: 0 none, 1-3 few, 4+ many
- [ ] **AC-DC-04**: Empty decisions returns proceed with zero override rate
- [ ] **AC-DC-05**: >3 overridden blocks for similar context triggers soften
- [ ] **AC-DC-06**: Override rate >50% triggers soften with false positive reason
- [ ] **AC-DC-07**: Override rate <10% with low score triggers escalate
- [ ] **AC-DC-08**: Zero overrides with high score triggers proceed
- [ ] **AC-DC-09**: Zero `any` types [ARCH-SOLID-202]
- [ ] **AC-DC-10**: Pure functions — deterministic output [ARCH-SOLID-0912]
- [ ] **AC-DC-11**: Named exports only [ARCH-SOLID-232]

---

## Reglas del Rulebook

| ID Regla          | Categoria    | Descripcion breve                         |
| ----------------- | ------------ | ----------------------------------------- |
| [ARCH-SOLID-058]  | Arquitectura | Zero framework dependencies               |
| [ARCH-SOLID-202]  | TypeScript   | Zero any usage                            |
| [ARCH-SOLID-0912] | Arquitectura | Pure functions — idempotent               |
| [FORGE-OPS-0105]  | Forge Ops    | Stateless functions                       |
| [ARCH-SOLID-006]  | Arquitectura | Service layer — domain types only         |
| [ARCH-SOLID-232]  | TypeScript   | Named exports only                        |
| [ARCH-SOLID-205]  | TypeScript   | Explicit return types on public functions |
| [ARCH-SOLID-052]  | Arquitectura | Functions <= 20 lines                     |
| [ARCH-SOLID-056]  | Arquitectura | Dependencies point inward                 |
| [TEST-QA-056]     | Testing      | TDD cycle                                 |
| [TEST-QA-057]     | Testing      | Edge cases covered                        |
| [TEST-QA-0764]    | Testing      | Isolated tests, no external deps          |
| [TEST-QA-0771]    | Testing      | At least one test per exported function   |

---

## Contrato Publico (API del modulo)

### Interfaces exportadas

#### `DecisionPattern`

- **Proposito**: Result of decision pattern analysis
- **Propiedades**: `similarPastDecisions`, `overrideRate`, `suggestedAction`, `reason`

### Funciones exportadas

#### `analyzeDecisionPatterns(decisions: readonly DecisionRecord[], currentScore: number, currentAction: 'block' | 'approve' | 'comment'): DecisionPattern`

- **Proposito**: Analyze past decisions to detect override patterns and suggest action adjustments
- **Pre-condiciones**: decisions array (may be empty), valid score and action
- **Post-condiciones**: Returns DecisionPattern with suggested action and reasoning
- **Errores**: None — pure function, always returns valid result

#### `computeContextSignature(issueKey: string, score: number, gateType: string, inconsistencyCount: number): string`

- **Proposito**: Compute a deterministic context signature for similarity matching
- **Pre-condiciones**: Valid issueKey, score 0-100, gateType string, non-negative inconsistencyCount
- **Post-condiciones**: Returns `{issueKey}:{scoreRange}:{gateType}:{bucket}` format string
- **Errores**: None — pure function, always returns valid string

---

## Dependencias (imports)

### Internas (proyecto)

- `src/backend/types/relationship-index` -> `DecisionRecord`

### NOTA: Capa de dominio

- Pure functions only — no storage reads, no external dependencies [ARCH-SOLID-058]

---

## Estrategia de Test

### Unit Tests (`tests/unit/services/relationship-index/decision-consumer.spec.ts`)

| Test                                                        | AC cubierto     | Regla cubierta  |
| ----------------------------------------------------------- | --------------- | --------------- |
| should return deterministic signature                       | AC-DC-01        | ARCH-SOLID-0912 |
| should produce different signatures for different inputs    | AC-DC-01        | ARCH-SOLID-0912 |
| should bucket scores correctly                              | AC-DC-02        | -               |
| should bucket inconsistency counts correctly                | AC-DC-03        | -               |
| should proceed with empty decisions                         | AC-DC-04, AC-21 | ARCH-SOLID-0912 |
| should soften when many overridden blocks                   | AC-DC-05, AC-22 | -               |
| should soften on high override rate                         | AC-DC-06, AC-22 | -               |
| should escalate on low override rate with low score         | AC-DC-07, AC-22 | -               |
| should proceed on zero overrides with high score            | AC-DC-08        | -               |
| should handle override rate exactly at threshold            | AC-22           | -               |
| should handle override rate exactly at confidence threshold | AC-22           | -               |

---

## Historial de Cambios

| Fecha      | Tarea Ralph | Cambio         |
| ---------- | ----------- | -------------- |
| 2026-05-02 | RTASK-041   | Creado inicial |
