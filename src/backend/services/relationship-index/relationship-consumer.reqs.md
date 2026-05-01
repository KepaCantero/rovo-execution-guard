# REQUISITOS: Relationship Consumer

> **Sidecar File** | Vinculado a: `src/backend/services/relationship-index/relationship-consumer.ts`

---

## Descripcion

Translates raw relationship graph data into structured inputs for scoring and detection modules. Implements 4 detection functions (sibling contradictions, spec drift, scope mismatch, orphan references), 1 aggregator, and 2 signal calculators (documentation, consistency). All functions are pure and synchronous — no storage reads, no external deps.

---

## Acceptance Criteria

- [ ] **AC-01**: `detectSiblingContradictions` identifies contradictions between ticket and sibling summaries using term/negation pairs
- [ ] **AC-02**: `detectSpecDrift` detects stale documentation: warning at >30 days, critical at >90 days
- [ ] **AC-03**: `detectScopeMismatch` flags PR scope issues — unlinked PRs or excessive file changes
- [ ] **AC-04**: `detectOrphanReferences` flags weak-confidence and missing-entity cross-references
- [ ] **AC-05**: `detectRelationshipInconsistencies` aggregates all 4 detectors into a single call
- [ ] **AC-06**: `calculateDocumentationSignal` returns bonus/penalty/signals from doc freshness analysis
- [ ] **AC-07**: `calculateConsistencySignal` returns bonus/penalty/signals from sibling alignment analysis
- [ ] **AC-08**: Zero `any` types — all types explicit [ARCH-SOLID-202]
- [ ] **AC-09**: Pure functions — same input produces same output [ARCH-SOLID-0912]
- [ ] **AC-10**: Named exports only [ARCH-SOLID-232]
- [ ] **AC-14**: Test coverage > 85% for all exported functions

---

## Reglas del Rulebook

| ID Regla          | Categoria    | Descripcion breve                                  |
| ----------------- | ------------ | -------------------------------------------------- |
| [ARCH-SOLID-058]  | Arquitectura | SERVICE layer — zero framework dependencies        |
| [ARCH-SOLID-202]  | TypeScript   | Zero any usage                                     |
| [ARCH-SOLID-006]  | Arquitectura | Service layer — Handler -> Service -> Repository   |
| [ARCH-SOLID-0912] | Arquitectura | Pure functions — deterministic                     |
| [ARCH-SOLID-232]  | TypeScript   | Named exports only, no default                     |
| [ARCH-SOLID-205]  | TypeScript   | Explicit return types on public functions          |
| [ARCH-SOLID-0941] | Arquitectura | Document algorithm complexity                      |
| [FORGE-OPS-0105]  | Forge Ops    | Stateless functions, no module-level mutable state |

---

## Contrato Publico (API del modulo)

### Funciones exportadas

#### `detectSiblingContradictions(ticketSummary: string, ticketDescription: string, siblings: readonly EntityNode[], ticketKey: string): readonly Inconsistency[]`

- **Proposito**: Detect contradictions between a ticket and its sibling issues in the same epic
- **Pre-condiciones**: ticketSummary and ticketDescription are non-empty strings
- **Post-condiciones**: Returns Inconsistency[] with type `sibling_contradiction`, severity scaled by count

#### `detectSpecDrift(documentation: readonly EntityNode[], ticketUpdatedAt: string, ticketKey: string): readonly Inconsistency[]`

- **Proposito**: Detect documentation staleness by comparing update timestamps
- **Pre-condiciones**: documentation array and valid ISO date string
- **Post-condiciones**: Returns Inconsistency[] with type `spec_drift`, severity based on staleness

#### `detectScopeMismatch(pullRequests: readonly EntityNode[], ticketKey: string, ticketSummary: string): readonly Inconsistency[]`

- **Proposito**: Detect PR scope issues relative to the ticket
- **Pre-condiciones**: pullRequests array provided
- **Post-condiciones**: Returns Inconsistency[] with type `scope_mismatch`

#### `detectOrphanReferences(crossReferences: readonly CrossReference[], ticketKey: string): readonly Inconsistency[]`

- **Proposito**: Detect cross-references that are weak or point to missing entities
- **Pre-condiciones**: crossReferences array provided
- **Post-condiciones**: Returns Inconsistency[] with type `orphan_reference`

#### `detectRelationshipInconsistencies(context: RelationshipContext, ticketSummary: string, ticketDescription: string, ticketUpdatedAt: string, ticketKey: string): readonly Inconsistency[]`

- **Proposito**: Aggregate all relationship-aware detectors into a single result
- **Pre-condiciones**: Valid RelationshipContext
- **Post-condiciones**: Returns combined Inconsistency[] from all 4 detectors

#### `calculateDocumentationSignal(context: RelationshipContext): { bonus: number; penalty: number; signals: readonly string[] }`

- **Proposito**: Calculate documentation score adjustment from relationship context
- **Pre-condiciones**: Valid RelationshipContext
- **Post-condiciones**: Returns bonus (0 to +20), penalty (0 to -15), and human-readable signals

#### `calculateConsistencySignal(context: RelationshipContext): { bonus: number; penalty: number; signals: readonly string[] }`

- **Proposito**: Calculate consistency score adjustment from sibling alignment
- **Pre-condiciones**: Valid RelationshipContext
- **Post-condiciones**: Returns bonus (0 to +15), penalty (0 to -20), and human-readable signals

---

## Dependencias (imports)

### Internas (proyecto)

- `src/backend/types/relationship-index` -> `RelationshipContext`, `EntityNode`, `CrossReference`
- `src/backend/types/inconsistency` -> `Inconsistency`, `InconsistencyType`, `Severity`, `InconsistencySource`

### NOTA: Capa de dominio

- Pure functions only — no storage reads, no external dependencies [ARCH-SOLID-058]

---

## Estrategia de Test

### Unit Tests (`tests/unit/services/relationship-index/relationship-consumer.spec.ts`)

| Test                                                    | AC cubierto | Regla cubierta  |
| ------------------------------------------------------- | ----------- | --------------- |
| should detect contradictions between ticket and sibling | AC-01       | ARCH-SOLID-0912 |
| should return empty for no siblings                     | AC-01       | -               |
| should escalate severity for multiple contradictions    | AC-01       | -               |
| should detect spec drift at >30 days                    | AC-02       | ARCH-SOLID-0912 |
| should detect critical spec drift at >90 days           | AC-02       | -               |
| should detect scope mismatch for large PRs              | AC-03       | ARCH-SOLID-0912 |
| should detect orphan references with low confidence     | AC-04       | ARCH-SOLID-0912 |
| should aggregate all detectors                          | AC-05       | -               |
| should calculate documentation signal bonus             | AC-06       | ARCH-SOLID-0912 |
| should calculate documentation signal penalty           | AC-06       | -               |
| should calculate consistency signal bonus               | AC-07       | ARCH-SOLID-0912 |
| should calculate consistency signal penalty             | AC-07       | -               |
| should have zero any types                              | AC-08       | ARCH-SOLID-202  |
| should be deterministic (same input, same output)       | AC-09       | ARCH-SOLID-0912 |

---

## Historial de Cambios

| Fecha      | Tarea Ralph | Cambio         |
| ---------- | ----------- | -------------- |
| 2026-05-02 | RTASK-041   | Creado inicial |
