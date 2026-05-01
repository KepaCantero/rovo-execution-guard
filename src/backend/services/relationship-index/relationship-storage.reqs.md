# REQUISITOS: Relationship Storage Adapter

> **Sidecar File** | Vinculado a: `src/backend/services/relationship-index/relationship-storage.ts`

---

## Descripcion

Forge Storage adapter for the Project Relationship Index. Provides typed CRUD operations over Forge's key-value storage using an adjacency-list model. All keys are prefixed with project key for multi-tenancy. Supports up to 2-hop traversal constrained by Forge function timeout limits.

---

## Acceptance Criteria

- [x] **AC-03**: `relationship-storage.ts` implements all storage functions with structured logging
- [x] **AC-04**: Storage keys follow the documented schema pattern (`node:{projectKey}:{entityId}`, etc.)
- [x] **AC-05**: `queryRelationships` supports traversal up to depth 2 with edge type and weight filtering
- [x] **AC-06**: `buildRelationshipContext` assembles a complete `RelationshipContext` for a given entity
- [x] **AC-07**: All storage operations have error handling that returns gracefully (never throws unhandled)
- [x] **AC-09**: Test coverage exceeds 90%
- [x] **AC-10**: `.reqs.md` sidecar created
- [x] **AC-11**: `pnpm typecheck` passes
- [x] **AC-12**: Zero `any` usage in new code

---

## Reglas del Rulebook

| ID Regla         | Categoria    | Descripcion breve                                  |
| ---------------- | ------------ | -------------------------------------------------- |
| [ARCH-SOLID-005] | Arquitectura | Forge Storage access encapsulated in Repository    |
| [ARCH-SOLID-006] | Arquitectura | Handler -> Service -> Repository pattern           |
| [ARCH-SOLID-053] | Arquitectura | Domain-specific error types (StorageError)         |
| [ARCH-SOLID-202] | Arquitectura | Zero any usage                                     |
| [ARCH-SOLID-205] | Arquitectura | Explicit return types on all exported functions    |
| [ARCH-SOLID-232] | Arquitectura | Named exports only                                 |
| [ARCH-SOLID-241] | Arquitectura | All async functions try/catch or delegate          |
| [ARCH-SOLID-243] | Arquitectura | I/O operations need explicit timeout               |
| [ARCH-SOLID-255] | Arquitectura | Structured JSON logs                               |
| [FORGE-OPS-005]  | Forge Ops    | No Forge function exceeds 10s execution            |
| [FORGE-OPS-007]  | Forge Ops    | Throughput: 50 reads/s, 10 writes/s                |
| [FORGE-OPS-0101] | Forge Ops    | Critical work in <= 8s                             |
| [FORGE-OPS-0102] | Forge Ops    | Backoff with jitter on writes                      |
| [FORGE-OPS-012]  | Forge Ops    | Key format with `:` separators, max 500 chars      |
| [FORGE-OPS-013]  | Forge Ops    | Values max 4 KB per key                            |
| [FORGE-OPS-0105] | Forge Ops    | Stateless functions, no module-level mutable state |
| [FORGE-OPS-053]  | Forge Ops    | Never leave system in inconsistent state           |
| [FORGE-OPS-054]  | Forge Ops    | Graceful degradation — return safe defaults        |
| [FORGE-OPS-058]  | Forge Ops    | O(n log n) max complexity                          |
| [FORGE-OPS-059]  | Forge Ops    | Use Map/Set for indexed lookups                    |

---

## Contrato Publico (API del modulo)

### Core CRUD

#### `getNode(projectKey: string, entityId: string, executionId?: string): Promise<EntityNode | null>`

- **Proposito**: Retrieve a single entity node by project key and entity ID
- **Post-condiciones**: Returns the node or null if not found
- **Errores**: Logs and returns null on storage failure [FORGE-OPS-054]

#### `putNode(projectKey: string, node: EntityNode, executionId?: string): Promise<void>`

- **Proposito**: Store or update an entity node
- **Pre-condiciones**: Key length < 500 chars [FORGE-OPS-012]
- **Errores**: Logs error, does not throw [ARCH-SOLID-241]

#### `deleteNode(projectKey: string, entityId: string, executionId?: string): Promise<void>`

- **Proposito**: Remove an entity node from storage
- **Errores**: Logs error, does not throw

#### `getEdges(projectKey: string, sourceId: string, executionId?: string): Promise<readonly RelationshipEdge[]>`

- **Proposito**: Retrieve all edges originating from a source entity
- **Post-condiciones**: Returns edges or empty array if none found

#### `putEdges(projectKey: string, sourceId: string, edges: readonly RelationshipEdge[], executionId?: string): Promise<void>`

- **Proposito**: Store edges for a source entity (replaces existing)
- **Pre-condiciones**: Edge array must not exceed 4KB when serialized [FORGE-OPS-013]
- **Errores**: Logs warning if payload exceeds safe size, logs error on failure

#### `deleteEdges(projectKey: string, sourceId: string, executionId?: string): Promise<void>`

- **Proposito**: Remove all edges for a source entity

#### `getTopicEntities(projectKey: string, topicId: string, executionId?: string): Promise<readonly string[]>`

- **Proposito**: Retrieve entity IDs associated with a topic

#### `putTopicIndex(projectKey: string, topicId: string, entityIds: readonly string[], executionId?: string): Promise<void>`

- **Proposito**: Store topic-to-entity mapping
- **Pre-condiciones**: Entity ID list must not exceed 4KB [FORGE-OPS-013]

#### `getStats(projectKey: string, executionId?: string): Promise<GraphStats>`

- **Proposito**: Retrieve index statistics for a project
- **Post-condiciones**: Returns default stats if not found

#### `putStats(projectKey: string, stats: GraphStats, executionId?: string): Promise<void>`

- **Proposito**: Store updated index statistics

### Query Operations

#### `queryRelationships(query: RelationshipQuery, executionId?: string): Promise<RelationshipQueryResult>`

- **Proposito**: Traverse the relationship graph up to 2 hops from a seed entity
- **Pre-condiciones**: query.projectKey required, maxDepth <= 2
- **Post-condiciones**: Returns all reachable nodes and edges within constraints
- **Errores**: Returns empty result on failure [FORGE-OPS-054]
- **Constraints**: Bounded BFS using Map/Set [FORGE-OPS-059], early termination at 8s budget [FORGE-OPS-0101]

#### `buildRelationshipContext(projectKey: string, entityId: string, executionId?: string): Promise<RelationshipContext>`

- **Proposito**: Assemble complete context for an entity (siblings, docs, PRs, topics, cross-refs)
- **Post-condiciones**: Returns fully populated RelationshipContext
- **Errores**: Returns context with empty arrays on failure

### Bulk Operations

#### `bulkPutNodes(projectKey: string, nodes: readonly EntityNode[], executionId?: string): Promise<void>`

- **Proposito**: Store multiple nodes sequentially with rate limiting
- **Constraints**: <= 10 writes/s [FORGE-OPS-007]

#### `bulkPutEdges(projectKey: string, edges: readonly RelationshipEdge[], executionId?: string): Promise<void>`

- **Proposito**: Store multiple edges sequentially, grouped by source ID
- **Constraints**: <= 10 writes/s [FORGE-OPS-007]

---

## Dependencias (imports)

### Internas (proyecto)

- `src/backend/types/relationship-index` -> EntityNode, RelationshipEdge, TopicCluster, ContextItem, CrossReference, RelationshipQuery, RelationshipQueryResult, RelationshipContext, GraphStats, EntityType, EdgeType
- `src/backend/types/errors` -> StorageError

### Externas (npm)

- `@forge/api` -> storage (via dynamic require for test-mockability) [FORGE-OPS-0105]

---

## Estrategia de Test

### Unit Tests (`tests/unit/services/relationship-index/relationship-storage.spec.ts`)

| Test                                                  | AC cubierto | Regla cubierta |
| ----------------------------------------------------- | ----------- | -------------- |
| should store and retrieve a node                      | AC-03       | ARCH-SOLID-005 |
| should return null for missing node                   | AC-03       | FORGE-OPS-054  |
| should delete a node                                  | AC-03       | -              |
| should store and retrieve edges                       | AC-03       | ARCH-SOLID-005 |
| should return empty array for missing edges           | AC-03       | FORGE-OPS-054  |
| should delete edges                                   | AC-03       | -              |
| should store and retrieve topic entities              | AC-03       | -              |
| should store and retrieve stats                       | AC-03       | -              |
| should use correct key schema                         | AC-04       | FORGE-OPS-012  |
| should validate key length < 500 chars                | AC-04       | FORGE-OPS-012  |
| should traverse 1-hop relationships                   | AC-05       | FORGE-OPS-059  |
| should traverse 2-hop relationships                   | AC-05       | FORGE-OPS-0101 |
| should filter by edge types in query                  | AC-05       | -              |
| should filter by min weight in query                  | AC-05       | -              |
| should build complete relationship context            | AC-06       | -              |
| should handle graceful degradation on storage failure | AC-07       | FORGE-OPS-054  |
| should handle missing keys gracefully                 | AC-07       | ARCH-SOLID-241 |
| should bulk put nodes sequentially                    | AC-03       | FORGE-OPS-007  |
| should bulk put edges sequentially                    | AC-03       | FORGE-OPS-007  |
| should warn on oversized edge arrays                  | AC-03       | FORGE-OPS-013  |
| should use structured logging with executionId        | AC-03       | ARCH-SOLID-255 |
| should handle cycles in traversal                     | AC-05       | FORGE-OPS-058  |

---

## Historial de Cambios

| Fecha      | Tarea Ralph | Cambio         |
| ---------- | ----------- | -------------- |
| 2026-05-01 | RTASK-037   | Creado inicial |
