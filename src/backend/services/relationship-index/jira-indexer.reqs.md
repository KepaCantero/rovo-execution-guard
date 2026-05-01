# REQUISITOS: Jira Relationship Indexer

> **Sidecar File** | Vinculado a: `src/backend/services/relationship-index/jira-indexer.ts`

---

## Descripcion

Service-layer module that indexes Jira issues into the Relationship Index. Builds entity nodes, extracts structural edges (parent-of, related-to, topic-match), and maintains denormalized neighborhoods for O(1) context retrieval.

---

## Acceptance Criteria

- [x] **AC-01**: `buildJiraNode` maps Jira fields to EntityNode with correct ID convention (`jira:{key}`)
- [x] **AC-02**: `extractJiraEdges` produces parent-of (weight 1.0), related-to (weight 0.8), topic-match (weight 0.6) edges
- [x] **AC-03**: `buildJiraNeighborhood` builds pruned denormalized neighborhood (max 50 neighbors)
- [x] **AC-04**: `indexJiraIssue` atomically writes node + edges + topic index + neighborhood + stats
- [x] **AC-05**: `getJiraRelationshipContext` reads neighborhood O(1) with traversal fallback
- [x] **AC-06**: `bootstrapProjectIndex` uses JQL search with batch indexing and rate limiting

---

## Reglas del Rulebook

| ID Regla         | Categoria    | Descripcion breve                            |
| ---------------- | ------------ | -------------------------------------------- |
| [ARCH-SOLID-005] | Arquitectura | Storage access through repository layer only |
| [ARCH-SOLID-006] | Arquitectura | Handler -> Service -> Repository pattern     |
| [ARCH-SOLID-202] | Arquitectura | Zero any usage                               |
| [FORGE-OPS-005]  | Forge Ops    | No invocation exceeds 10 seconds             |
| [FORGE-OPS-013]  | Forge Ops    | Values <= 4KB per key                        |
| [FORGE-OPS-0104] | Forge Ops    | Graceful degradation                         |
| [FORGE-OPS-0105] | Forge Ops    | Stateless functions                          |
| [FORGE-OPS-012]  | Forge Ops    | Storage key format hierarchical              |

---

## Contrato Publico (API del modulo)

### Funciones exportadas

#### `buildJiraNode(input: JiraIndexInput): EntityNode`

- **Proposito**: Maps Jira fields to EntityNode structure
- **Pre-condiciones**: input.issueKey and input.projectKey must be non-empty
- **Post-condiciones**: Returns valid EntityNode with id `jira:{issueKey}`

#### `extractJiraEdges(input: JiraIndexInput, executionId?: string): readonly RelationshipEdge[]`

- **Proposito**: Extracts parent-of, related-to, topic-match edges from Jira issue
- **Pre-condiciones**: input.issueKey must be non-empty
- **Post-condiciones**: Returns array of edges with correct weights

#### `buildJiraNeighborhood(input: JiraIndexInput, edges: readonly RelationshipEdge[]): EntityNeighborhood`

- **Proposito**: Builds denormalized neighborhood for O(1) reads
- **Pre-condiciones**: input and edges from same issue
- **Post-condiciones**: Neighborhood with pruned siblings/linkedIssues (max 50)

#### `indexJiraIssue(input: JiraIndexInput, executionId: string): Promise<void>`

- **Proposito**: Atomically indexes a Jira issue into storage
- **Pre-condiciones**: input.issueKey and projectKey non-empty
- **Post-condiciones**: Node, edges, topic index, neighborhood, and stats updated

#### `getJiraRelationshipContext(issueKey: string, projectKey: string, executionId: string): Promise<RelationshipContext>`

- **Proposito**: Gets relationship context for a Jira issue (O(1) read)
- **Pre-condiciones**: issueKey and projectKey non-empty
- **Post-condiciones**: Returns RelationshipContext or EMPTY_RELATIONSHIP_CONTEXT on error

#### `bootstrapProjectIndex(projectKey: string, executionId: string): Promise<GraphStats>`

- **Proposito**: Fetches and indexes all issues in a project via JQL
- **Pre-condiciones**: projectKey must be valid
- **Post-condiciones**: Returns updated GraphStats

---

## Dependencias (imports)

### Internas (proyecto)

- `src/backend/types/relationship-index` -> EntityNode, RelationshipEdge, RelationshipContext, GraphStats, EntityType, EntityNeighborhood, NeighborSummary
- `src/backend/services/relationship-index/relationship-storage` -> putNode, putEdges, getTopicEntities, putTopicIndex, getStats, putStats, buildRelationshipContext, getNeighborhood, putNeighborhood
- `src/backend/services/jira/jira-adapter` -> searchByJQL
- `src/backend/types/jira-data` -> JiraTicketData

### Externas (npm)

- None

---

## Estrategia de Test

### Unit Tests (`tests/unit/services/relationship-index/jira-indexer.spec.ts`)

| Test                                          | AC cubierto | Regla cubierta |
| --------------------------------------------- | ----------- | -------------- |
| buildJiraNode maps standard issue             | AC-01       | -              |
| buildJiraNode maps epic                       | AC-01       | -              |
| extractJiraEdges with all edge types          | AC-02       | FORGE-OPS-012  |
| extractJiraEdges with no edges                | AC-02       | -              |
| buildJiraNeighborhood prunes at 50            | AC-03       | FORGE-OPS-013  |
| indexJiraIssue writes all data                | AC-04       | ARCH-SOLID-005 |
| getJiraRelationshipContext reads neighborhood | AC-05       | FORGE-OPS-0104 |
| bootstrapProjectIndex batches correctly       | AC-06       | FORGE-OPS-005  |

---

## Historial de Cambios

| Fecha      | Tarea Ralph | Cambio                                |
| ---------- | ----------- | ------------------------------------- |
| 2026-05-01 | RTASK-038   | Creado inicial — 6 exported functions |
