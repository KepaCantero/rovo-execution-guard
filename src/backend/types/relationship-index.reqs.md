# REQUISITOS: Relationship Index Domain Types

> **Sidecar File** | Vinculado a: `src/backend/types/relationship-index.ts`

---

## Descripcion

Defines the domain types for the Project Relationship Index — a structured adjacency-list index representing entity relationships across Jira, Confluence, and GitHub. These types model the Knowledge Graph bounded context, enabling relational awareness beyond single-ticket scoring and detection.

---

## Acceptance Criteria

- [x] **AC-01**: All types created: `EntityType`, `EntityNode`, `EdgeType`, `RelationshipEdge`, `TopicCluster`, `RelationshipContext`, `CrossReference`, `ContextItem`, `GraphStats`, `RelationshipQuery`, `RelationshipQueryResult`, `RelationshipIndexer`
- [x] **AC-02**: All interface properties are `readonly`, zero `any` types
- [x] **AC-10**: `.reqs.md` sidecar created adjacent to production file
- [x] **AC-11**: `pnpm typecheck` passes
- [x] **AC-12**: Zero `any` usage in new code

---

## Reglas del Rulebook

| ID Regla         | Categoria    | Descripcion breve                                     |
| ---------------- | ------------ | ----------------------------------------------------- |
| [ARCH-SOLID-058] | Arquitectura | Domain layer has zero framework dependencies          |
| [ARCH-SOLID-203] | TypeScript   | Interface for public data structures, type for unions |
| [ARCH-SOLID-232] | TypeScript   | Named exports only, no default export                 |
| [ARCH-SOLID-222] | TypeScript   | `@typescript-eslint/no-explicit-any` at error level   |
| [ARCH-SOLID-001] | Arquitectura | Layer separation — types in domain layer              |
| [ARCH-SOLID-006] | Arquitectura | Dependency inversion — indexer contract for adapters  |
| [FORGE-OPS-001]  | Forge Ops    | Execution limits — max 2-hop traversal constraint     |

---

## Contrato Publico (API del modulo)

### Tipos exportados

#### `EntityType`

- **Proposito**: Entity types in the relationship index, mapping to real Atlassian/GitHub resources
- **Valores**: `'jira-issue' | 'jira-epic' | 'confluence-page' | 'github-pr' | 'topic'`

#### `EntityNode`

- **Proposito**: A node representing a single entity in the index
- **Propiedades**: `id`, `type`, `label`, `status`, `projectKey`, `metadata` (Readonly<Record<string, string>>), `createdAt`, `updatedAt`
- **ID format**: `"jira:PROJ-123" | "confluence:12345" | "github:owner/repo/pull/42" | "topic:cache-migration"`

#### `EdgeType`

- **Proposito**: Relationship types between entities
- **Valores**: `'parent-of' | 'related-to' | 'documented-by' | 'implements' | 'topic-match' | 'mentioned-in'`

#### `RelationshipEdge`

- **Proposito**: A directed edge between two entities in adjacency list
- **Propiedades**: `source`, `target`, `type`, `weight` (0-1), `createdAt`, `updatedAt`

#### `TopicCluster`

- **Proposito**: Groups entities by shared subject matter
- **Propiedades**: `id`, `label`, `keywords`, `entityIds`, `projectKeys`, `strength` (0-1)

#### `RelationshipContext`

- **Proposito**: Structured context consumed by scoring/detection/agent handlers
- **Propiedades**: `siblings`, `documentation`, `pullRequests`, `topics`, `crossReferences`, `rankedItems`, `assembledAt`

#### `ContextItem`

- **Proposito**: Ranked context item for efficient LLM consumption
- **Propiedades**: `node`, `relevanceScore` (0-1), `matchReason`

#### `CrossReference`

- **Proposito**: Cross-tool reference between entities
- **Propiedades**: `source`, `target`, `sourceTool`, `targetTool`, `referenceType`, `confidence` (0-1)

#### `GraphStats`

- **Proposito**: Statistics about the relationship index for monitoring
- **Propiedades**: `totalNodes`, `totalEdges`, `nodesByType`, `edgesByType`, `topicCount`, `lastUpdated`

#### `RelationshipQuery`

- **Proposito**: Parameters for querying the relationship index
- **Propiedades**: `projectKey`, `entityId?`, `entityType?`, `edgeTypes?`, `maxDepth?` (max 2), `minWeight?`

#### `RelationshipQueryResult`

- **Proposito**: Result of a relationship index query
- **Propiedades**: `nodes`, `edges`, `query`, `executionId`

#### `RelationshipIndexer`

- **Proposito**: Contract for data source adapters (Jira, Confluence, GitHub)
- **Propiedades**: `source` (EntityType)
- **Metodos**: `indexNode`, `indexEdges`, `removeNode`

---

## Dependencias (imports)

### Internas

- None (leaf module — pure domain types)

### NOTA: Capa de dominio

- This file is in `src/backend/types/` -> ZERO external dependencies [ARCH-SOLID-058]

---

## Estrategia de Test

### Unit Tests (`tests/unit/types/relationship-index.spec.ts`)

| Test                                          | AC cubierto | Regla cubierta                 |
| --------------------------------------------- | ----------- | ------------------------------ |
| should accept all valid EntityType values     | AC-01       | ARCH-SOLID-203                 |
| should accept all valid EdgeType values       | AC-01       | ARCH-SOLID-203                 |
| should accept a valid EntityNode              | AC-01       | ARCH-SOLID-203, ARCH-SOLID-058 |
| should accept EntityNode with empty metadata  | AC-02       | -                              |
| should accept a valid RelationshipEdge        | AC-01       | -                              |
| should accept a valid TopicCluster            | AC-01       | -                              |
| should accept a valid CrossReference          | AC-01       | -                              |
| should accept a valid ContextItem             | AC-01       | -                              |
| should accept a full RelationshipContext      | AC-01       | -                              |
| should accept a valid GraphStats              | AC-01       | -                              |
| should accept a minimal RelationshipQuery     | AC-01       | -                              |
| should accept a full RelationshipQuery        | AC-01       | -                              |
| should accept a valid RelationshipQueryResult | AC-01       | -                              |
| should enforce readonly on EntityNode         | AC-02       | ARCH-SOLID-203                 |
| should accept RelationshipIndexer contract    | AC-01       | ARCH-SOLID-006                 |

---

## Historial de Cambios

| Fecha      | Tarea Ralph | Cambio                                |
| ---------- | ----------- | ------------------------------------- |
| 2026-05-01 | RTASK-037   | Creado inicial — Step 5a domain types |
