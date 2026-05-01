# REQUISITOS: Context Builder

> **Sidecar File** | Vinculado a: `src/backend/services/relationship-index/context-builder.ts`

---

## Descripcion

JIT context assembly pipeline inspired by PathRAG's path-centric prompting. Extracts causal paths from the relationship graph, ranks by signal strength, prunes to a token budget, and assembles context with positional optimization (facts at START/END, evidence in MIDDLE) to counteract "lost in the middle" LLM behavior.

---

## Acceptance Criteria

- [ ] **AC-01**: `extractCausalPaths` extracts paths from `EntityNeighborhood` + `RelationshipContext` with correct path types: contradiction, alignment, gap, drift, neutral
- [ ] **AC-02**: `rankPaths` sorts by `signalScore` descending and prunes to fit token budget (maxTokens - reserveForPrompt)
- [ ] **AC-03**: `assembleContext` places high-signal facts at START, evidence in MIDDLE, decision points at END
- [ ] **AC-04**: `estimateTokens` returns `Math.ceil(text.length / 4)` (1 token ≈ 4 chars)
- [ ] **AC-05**: Default token budget enforced: max 2,500 tokens with 500 reserved for prompt
- [ ] **AC-06**: Path extraction caps at MAX_PATHS (20) to prevent oversized context
- [ ] **AC-07**: Documentation drift detected when doc updatedAt > 30 days old
- [ ] **AC-08**: Topic gap detected when topic has no matching documentation
- [ ] **AC-09**: Cross-reference paths scaled by confidence factor
- [ ] **AC-10**: Override decisions surfaced in END position for threshold adjustment
- [ ] **AC-11**: Zero `any` types — all types explicit [ARCH-SOLID-202]
- [ ] **AC-12**: Pure functions — same input produces same output [ARCH-SOLID-0912]
- [ ] **AC-13**: Named exports only [ARCH-SOLID-232]

---

## Reglas del Rulebook

| ID Regla          | Categoria    | Descripcion breve                                |
| ----------------- | ------------ | ------------------------------------------------ |
| [ARCH-SOLID-058]  | Arquitectura | Domain layer has zero framework dependencies     |
| [ARCH-SOLID-202]  | TypeScript   | Zero any usage                                   |
| [ARCH-SOLID-006]  | Arquitectura | Service layer — Handler -> Service -> Repository |
| [ARCH-SOLID-005]  | Arquitectura | Storage access through repository only           |
| [ARCH-SOLID-0912] | Arquitectura | Idempotent operations                            |
| [ARCH-SOLID-232]  | TypeScript   | Named exports only                               |
| [ARCH-SOLID-205]  | TypeScript   | Explicit return types on public functions        |
| [FORGE-OPS-013]   | Forge Ops    | Storage values ≤ 4KB                             |
| [FORGE-OPS-0105]  | Forge Ops    | Stateless functions                              |
| [FORGE-OPS-005]   | Forge Ops    | ≤10s execution — O(n log n) or better            |

---

## Contrato Publico (API del modulo)

### Interfaces exportadas

#### `CausalPath`

- **Proposito**: A causal path extracted from the graph — the unit of context
- **Propiedades**: `steps` (readonly string[]), `signalScore` (number), `pathType`, `summary` (string)

#### `BuiltContext`

- **Proposito**: Result of context building with positional optimization
- **Propiedades**: `paths`, `factsAtStart`, `evidenceInMiddle`, `questionAtEnd`, `totalTokens`, `budget`

### Funciones exportadas

#### `extractCausalPaths(neighborhood: EntityNeighborhood, context: RelationshipContext): readonly CausalPath[]`

- **Proposito**: Extract causal paths from the relationship graph
- **Pre-condiciones**: neighborhood and context provided (may be empty)
- **Post-condiciones**: Returns array of CausalPath with correct types and signal scores

#### `rankPaths(paths: readonly CausalPath[], budget: ContextBudget): readonly CausalPath[]`

- **Proposito**: Sort paths by signal strength and prune to token budget
- **Pre-condiciones**: paths array (may be empty), budget with maxTokens and reserveForPrompt
- **Post-condiciones**: Sorted descending by signalScore, pruned to fit (maxTokens - reserveForPrompt)

#### `assembleContext(rankedPaths, primaryEntity, recentDecisions, budget): BuiltContext`

- **Proposito**: Assemble context with positional optimization for LLM consumption
- **Pre-condiciones**: rankedPaths (pre-sorted), primaryEntity with key/summary/status, recentDecisions
- **Post-condiciones**: BuiltContext with facts at START, evidence MIDDLE, questions END

#### `estimateTokens(text: string): number`

- **Proposito**: Rough token estimation (1 token ≈ 4 chars)
- **Pre-condiciones**: Non-null text string
- **Post-condiciones**: `Math.ceil(text.length / 4)`

---

## Dependencias (imports)

### Internas (proyecto)

- `src/backend/types/relationship-index` -> `EntityNeighborhood`, `RelationshipContext`, `ContextBudget`, `DecisionRecord`

### NOTA: Capa de dominio

- Pure functions only — no storage reads, no external dependencies [ARCH-SOLID-058]

---

## Estrategia de Test

### Unit Tests (`tests/unit/services/relationship-index/context-builder.spec.ts`)

| Test                                         | AC cubierto  | Regla cubierta  |
| -------------------------------------------- | ------------ | --------------- |
| should extract sibling contradiction paths   | AC-01        | ARCH-SOLID-0912 |
| should extract PR alignment paths            | AC-01        | ARCH-SOLID-0912 |
| should extract documentation drift paths     | AC-01, AC-07 | ARCH-SOLID-0912 |
| should extract topic gap paths               | AC-01, AC-08 | ARCH-SOLID-0912 |
| should extract neutral cross-reference paths | AC-01, AC-09 | ARCH-SOLID-0912 |
| should cap at MAX_PATHS                      | AC-06        | FORGE-OPS-013   |
| should handle empty context                  | AC-01        | -               |
| should rank paths by signal score descending | AC-02        | ARCH-SOLID-0912 |
| should prune paths to token budget           | AC-02, AC-05 | FORGE-OPS-013   |
| should place high-signal facts at START      | AC-03        | -               |
| should place evidence in MIDDLE              | AC-03        | -               |
| should place questions at END                | AC-03, AC-10 | -               |
| should estimate tokens correctly             | AC-04        | -               |
| should estimate zero tokens for empty string | AC-04        | -               |

---

## Historial de Cambios

| Fecha      | Tarea Ralph | Cambio         |
| ---------- | ----------- | -------------- |
| 2026-05-01 | RTASK-041   | Creado inicial |
