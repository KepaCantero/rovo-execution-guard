# REQUISITOS: Inconsistency Detector

> **Sidecar File** | Vinculado a: `src/backend/services/scoring/inconsistency-detector.ts`

---

## Descripcion

Pure domain inconsistency detector that identifies and classifies ticket inconsistencies using deterministic, rule-based logic without any AI dependencies. Surfaces contradictions, duplicates, missing context, and ambiguities with actionable suggestions. Feeds into quality gate evaluation (RTASK-008) and operates independently of the scoring engine (RTASK-006).

---

## Acceptance Criteria

- [ ] **AC-01**: `detectInconsistencies(ticket, context)` detects all 4 inconsistency types: contradiction, duplicate, missing_context, ambiguity
- [ ] **AC-02**: `classifySeverity(inconsistency)` correctly classifies each inconsistency into critical, warning, or info severity levels
- [ ] **AC-03**: `generateSuggestion(inconsistency)` returns actionable, human-readable suggestions without AI
- [ ] **AC-04**: Detection is deterministic: same input always produces same output [ARCH-SOLID-0912]
- [ ] **AC-05**: Zero external dependencies in the inconsistency detector module [ARCH-SOLID-058]
- [ ] **AC-06**: Each detector type is an independent, composable function [ARCH-SOLID-0784]
- [ ] **AC-07**: Contradiction detection uses keyword comparison for negating terms and conflicting priorities
- [ ] **AC-08**: Duplicate detection uses >70% string similarity threshold for title/description overlap [ROVO-INTEG-0943]
- [ ] **AC-09**: Missing context detection checks required fields: acceptance criteria, priority, assignee, labels, story points
- [ ] **AC-10**: Ambiguity detection uses predefined word list (maybe, possibly, somehow, TBD, FIXME, etc., and so on)
- [ ] **AC-11**: Configuration (thresholds, word lists) passed as parameters, not hardcoded [ARCH-SOLID-049-05]
- [ ] **AC-12**: Test coverage exceeds 90%
- [ ] **AC-13**: All algorithms are O(n log n) or better [FORGE-OPS-058]
- [ ] **AC-14**: No function exceeds 20 lines of effective logic or 3 levels of nesting [ARCH-SOLID-052]

---

## Reglas del Rulebook

| ID Regla            | Categoria    | Descripcion breve                                                      |
| ------------------- | ------------ | ---------------------------------------------------------------------- |
| [ARCH-SOLID-049-01] | Arquitectura | SRP: detectors handle only detection, not scoring or enforcement       |
| [ARCH-SOLID-049-02] | Arquitectura | OCP: detectors extensible via strategy pipeline                        |
| [ARCH-SOLID-049-03] | Arquitectura | LSP: detector interfaces allow mock/fake replacements                  |
| [ARCH-SOLID-049-05] | Arquitectura | DIP: configuration injected via parameters, not hardcoded              |
| [ARCH-SOLID-051]    | Arquitectura | Names reveal intention without comments                                |
| [ARCH-SOLID-052]    | Arquitectura | Functions <= 20 lines, <= 3 levels nesting                             |
| [ARCH-SOLID-053]    | Arquitectura | Domain-specific error types, never generic Error                       |
| [ARCH-SOLID-056]    | Arquitectura | Dependencies point inward; domain depends only on types                |
| [ARCH-SOLID-058]    | Arquitectura | Domain layer zero framework dependencies                               |
| [ARCH-SOLID-060]    | Arquitectura | Variables use business vocabulary                                      |
| [ARCH-SOLID-067]    | Arquitectura | Document time complexity for collection operations                     |
| [ARCH-SOLID-069]    | Arquitectura | Pure higher-order functions, no shared mutable state                   |
| [ARCH-SOLID-0784]   | Arquitectura | Detectors as independent pipeline modules                              |
| [ARCH-SOLID-0861]   | Arquitectura | Domain has 3 capabilities: scoring, detection, enforcement             |
| [ARCH-SOLID-0912]   | Arquitectura | Idempotent: same input produces same output                            |
| [ARCH-SOLID-0941]   | Arquitectura | Critical algorithms document Big-O complexity                          |
| [ARCH-SOLID-202]    | TypeScript   | Zero any usage                                                         |
| [ARCH-SOLID-205]    | TypeScript   | All exported functions declare explicit return types                   |
| [FORGE-OPS-058]     | Performance  | Algorithms must not exceed O(n log n)                                  |
| [FORGE-OPS-059]     | Performance  | Use Map/Set for indexed lookups, not linear array search               |
| [TEST-QA-056]       | Testing      | TDD cycle: RED -> GREEN -> REFACTOR                                    |
| [TEST-QA-057]       | Testing      | Cover edge cases: threshold boundaries, empty payloads, missing fields |
| [TEST-QA-201]       | Testing      | Arrange-Act-Assert structure                                           |
| [ROVO-INTEG-0943]   | Integracion  | Text similarity with empirically calibrated >70% threshold             |

---

## Contrato Publico (API del modulo)

### Tipos exportados

#### `DetectorConfig`

- **Proposito**: Configuration for detection thresholds and word lists
- **Propiedades**: `similarityThreshold: number`, `ambiguousWords: readonly string[]`, `contradictionPairs: readonly ContradictionPair[]`, `requiredFields: readonly string[]`

#### `ContradictionPair`

- **Proposito**: A pair of mutually contradictory terms
- **Propiedades**: `term: string`, `negation: string`

### Funciones exportadas

#### `detectInconsistencies(ticket, context?, config?) -> Inconsistency[]`

- **Proposito**: Scan ticket data against provided context and detect all inconsistencies
- **Pre-condiciones**: `ticket.key` must be non-empty
- **Post-condiciones**: Returns deterministic array of Inconsistency objects, sorted by severity (critical first)
- **Errores**: `InsufficientDataError` if ticket.key is empty
- **Complejidad**: O(n) where n = ticket description length + context document count [ARCH-SOLID-0941]

#### `classifySeverity(inconsistency) -> Severity`

- **Proposito**: Classify an inconsistency into severity level based on type and context
- **Pre-condiciones**: Inconsistency object with valid type
- **Post-condiciones**: Returns 'critical', 'warning', or 'info'
- **Complejidad**: O(1)

#### `generateSuggestion(inconsistency) -> string`

- **Proposito**: Produce a human-readable, actionable suggestion for resolving the inconsistency
- **Pre-condiciones**: Valid Inconsistency object
- **Post-condiciones**: Returns non-empty suggestion string
- **Complejidad**: O(1)

---

## Dependencias (imports)

### Internas (proyecto)

- `src/backend/types/inconsistency` -> `Inconsistency`, `InconsistencyType`, `Severity`, `InconsistencySource`
- `src/backend/types/jira-data` -> `JiraTicketData`
- `src/backend/types/rovo-context` -> `RovoContext`
- `src/backend/types/errors` -> `InsufficientDataError`

### Externas

- None (zero external dependencies)

### NOTA: Capa de dominio

- This file is in `src/backend/services/scoring/` -> ZERO external dependencies

---

## Estrategia de Test

### Unit Tests (`tests/unit/services/scoring/inconsistency-detector.spec.ts`)

| Test                                                      | AC cubierto  | Regla cubierta    |
| --------------------------------------------------------- | ------------ | ----------------- |
| should detect contradictions in ticket fields             | AC-01, AC-07 | ARCH-SOLID-0784   |
| should detect duplicates above similarity threshold       | AC-01, AC-08 | ROVO-INTEG-0943   |
| should detect missing context fields                      | AC-01, AC-09 | -                 |
| should detect ambiguous language                          | AC-01, AC-10 | -                 |
| should classify contradictions as critical                | AC-02        | -                 |
| should classify missing context as warning                | AC-02        | -                 |
| should classify ambiguity as info                         | AC-02        | -                 |
| should generate actionable suggestions per type           | AC-03        | -                 |
| should be deterministic for same input                    | AC-04        | ARCH-SOLID-0912   |
| should use injected config for thresholds                 | AC-11        | ARCH-SOLID-049-05 |
| should handle empty ticket fields gracefully              | -            | TEST-QA-057       |
| should handle 70% boundary for similarity threshold       | AC-08        | TEST-QA-057       |
| should handle null/empty description                      | -            | TEST-QA-057       |
| should throw InsufficientDataError for missing ticket key | -            | ARCH-SOLID-053    |
| should detect contradictions against context documents    | AC-07        | ARCH-SOLID-056    |

---

## Historial de Cambios

| Fecha      | Tarea Ralph | Cambio         |
| ---------- | ----------- | -------------- |
| 2026-04-11 | RTASK-007   | Creado inicial |
