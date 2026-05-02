# REQUISITOS: context-formatter

> **Sidecar File** | Vinculado a: `src/backend/services/relationship-index/context-formatter.ts`

---

## Descripcion

Translates `RelationshipContext` into LLM-friendly text blocks for injection into Rovo agent prompts. Pure string operations — no storage reads, no HTTP calls, no external dependencies.

---

## Acceptance Criteria

- [ ] **AC-01**: All 6 format functions implemented (formatRelationshipContext, formatSiblings, formatDocumentation, formatPullRequests, formatTopics, formatCrossReferences)
- [ ] **AC-02**: formatRelationshipContext produces clear, LLM-friendly markdown-like text
- [ ] **AC-03**: buildActionContext customizes context per action type (evaluate-issue, check-pr-consistency, validate-spec-alignment)
- [ ] **AC-10**: Test coverage > 85% for formatter
- [ ] **AC-11**: .reqs.md sidecar created
- [ ] **AC-12**: buildPathContext uses PathRAG-style causal paths (facts at start, evidence in middle, questions at end)
- [ ] **AC-13**: buildEvolvingPrompt generates adaptive instructions from override patterns
- [ ] **AC-14**: Formatted context respects token budget (< 2000 tokens)
- [ ] **AC-15**: Context uses positional optimization (facts at edges per "lost in the middle" research)

---

## Reglas del Rulebook

| ID Regla          | Categoria    | Descripcion breve                                   |
| ----------------- | ------------ | --------------------------------------------------- |
| [ARCH-SOLID-058]  | Arquitectura | Zero framework dependencies                         |
| [ARCH-SOLID-202]  | Arquitectura | Zero any usage                                      |
| [ARCH-SOLID-0912] | Arquitectura | Pure functions — deterministic                      |
| [ARCH-SOLID-006]  | Arquitectura | Service layer imports domain only                   |
| [ARCH-SOLID-232]  | Arquitectura | Named exports only                                  |
| [ARCH-SOLID-205]  | Arquitectura | Explicit return types                               |
| [ARCH-SOLID-052]  | Arquitectura | Functions <= 20 lines                               |
| [ARCH-SOLID-056]  | Arquitectura | Dependencies point inward                           |
| [FORGE-OPS-0101]  | Forge Ops    | Complete within budget                              |
| [FORGE-OPS-0104]  | Forge Ops    | Graceful degradation on empty input                 |
| [FORGE-OPS-0105]  | Forge Ops    | Stateless functions                                 |
| [ROVO-INTEG-0915] | Rovo         | Relationship context is enhancer, never requirement |
| [TEST-QA-056]     | Testing      | TDD cycle                                           |
| [TEST-QA-057]     | Testing      | Edge cases covered                                  |
| [TEST-QA-0764]    | Testing      | Isolated tests, no mocks                            |
| [TEST-QA-0771]    | Testing      | At least one test per exported function             |

---

## Contrato Publico (API del modulo)

### Funciones exportadas

#### `formatRelationshipContext(context: RelationshipContext): string`

- **Proposito**: Full context as markdown-like sections
- **Pre-condiciones**: context is a valid RelationshipContext (may have empty arrays)
- **Post-condiciones**: Returns LLM-friendly markdown string or empty string if no data
- **Errores**: None — graceful degradation

#### `formatSiblings(siblings: readonly EntityNode[]): string`

- **Proposito**: Bullet list of sibling tickets with label and status
- **Post-condiciones**: Returns formatted bullet list or empty string

#### `formatDocumentation(docs: readonly EntityNode[]): string`

- **Proposito**: Confluence pages with relevance and page type from metadata
- **Post-condiciones**: Returns formatted list or empty string

#### `formatPullRequests(prs: readonly EntityNode[]): string`

- **Proposito**: PR list with files, repo from metadata
- **Post-condiciones**: Returns formatted list or empty string

#### `formatTopics(topics: readonly TopicCluster[]): string`

- **Proposito**: Topic clusters with strength and entity count
- **Post-condiciones**: Returns formatted list or empty string

#### `formatCrossReferences(refs: readonly CrossReference[]): string`

- **Proposito**: Cross-refs with source->target, type, confidence
- **Post-condiciones**: Returns formatted list or empty string

#### `buildActionContext(actionKey: string, context: RelationshipContext, budget?: ContextBudget): string`

- **Proposito**: Per-action context customization with token budget
- **Post-condiciones**: Returns action-specific formatted context respecting budget

#### `buildPathContext(paths: readonly CausalPath[], facts: readonly string[], decisions: readonly DecisionRecord[], budget: ContextBudget): string`

- **Proposito**: PathRAG-style context with positional optimization
- **Post-condiciones**: Facts at start, evidence in middle, decisions at end

#### `buildEvolvingPrompt(overridePatterns: readonly { readonly contextSignature: string; readonly overrideRate: number }[]): string`

- **Proposito**: Adaptive prompt snippet from override patterns
- **Post-condiciones**: Returns conditional instruction text, caps at ~200 tokens

---

## Dependencias (imports)

### Internas (proyecto)

- `src/backend/types/relationship-index` -> RelationshipContext, EntityNode, TopicCluster, CrossReference, DecisionRecord, ContextBudget
- `src/backend/services/relationship-index/context-builder.js` -> estimateTokens, CausalPath

### Externas (npm)

- None — pure string operations

---

## Estrategia de Test

### Unit Tests (`tests/unit/services/relationship-index/context-formatter.spec.ts`)

| Test                                                  | AC cubierto  | Regla cubierta  |
| ----------------------------------------------------- | ------------ | --------------- |
| formatSiblings — empty returns empty string           | AC-01        | FORGE-OPS-0104  |
| formatSiblings — single sibling                       | AC-01        | -               |
| formatSiblings — multiple siblings                    | AC-01        | -               |
| formatDocumentation — empty returns empty             | AC-01        | FORGE-OPS-0104  |
| formatDocumentation — formats with relevance/type     | AC-01        | -               |
| formatPullRequests — formats PR                       | AC-01        | -               |
| formatPullRequests — empty returns empty              | AC-01        | FORGE-OPS-0104  |
| formatTopics — formats cluster                        | AC-01        | -               |
| formatTopics — empty returns empty                    | AC-01        | FORGE-OPS-0104  |
| formatCrossReferences — formats source->target        | AC-01        | -               |
| formatCrossReferences — empty returns empty           | AC-01        | FORGE-OPS-0104  |
| formatRelationshipContext — empty context             | AC-02        | FORGE-OPS-0104  |
| formatRelationshipContext — full context all sections | AC-02        | -               |
| formatRelationshipContext — under token budget        | AC-14        | FORGE-OPS-0101  |
| buildActionContext — evaluate-issue                   | AC-03        | -               |
| buildActionContext — check-pr-consistency             | AC-03        | -               |
| buildActionContext — validate-spec-alignment          | AC-03        | -               |
| buildActionContext — unknown action fallback          | AC-03        | -               |
| buildActionContext — respects token budget            | AC-14        | -               |
| buildPathContext — positional optimization            | AC-12, AC-15 | -               |
| buildPathContext — respects budget                    | AC-14        | -               |
| buildPathContext — empty paths                        | AC-12        | -               |
| buildEvolvingPrompt — high override rate              | AC-13        | -               |
| buildEvolvingPrompt — low override rate               | AC-13        | -               |
| buildEvolvingPrompt — empty returns empty             | AC-13        | FORGE-OPS-0104  |
| buildEvolvingPrompt — caps at ~200 tokens             | AC-13        | -               |
| Deterministic output                                  | -            | ARCH-SOLID-0912 |

---

## Historial de Cambios

| Fecha      | Tarea Ralph | Cambio         |
| ---------- | ----------- | -------------- |
| 2026-05-02 | RTASK-043   | Creado inicial |
