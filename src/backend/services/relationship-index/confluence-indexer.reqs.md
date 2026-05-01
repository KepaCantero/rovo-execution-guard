# REQUISITOS: Confluence Relationship Indexer

> **Sidecar File** | Vinculado a: `src/backend/services/relationship-index/confluence-indexer.ts`

---

## Descripcion

Service-layer module that indexes Confluence pages into the Relationship Index. Extracts Jira issue references, topic edges, and builds denormalized neighborhoods for O(1) context retrieval. Enables Rovo to detect spec drift and find cross-references between Confluence specs and Jira tickets.

---

## Acceptance Criteria

- [ ] **AC-01**: `indexConfluencePage` writes node + edges + topic index + neighborhood + stats atomically
- [ ] **AC-02**: `extractJiraReferences` extracts `documented-by` edges from Jira issue keys in page body (regex `[A-Z]+-\d+`, cap 50)
- [ ] **AC-03**: `extractPageTopics` produces `topic-match` edges from page title and labels (weight 0.6)
- [ ] **AC-04**: `getDocumentingPages` performs reverse lookup — given a Jira issue key, finds all Confluence pages that reference it
- [ ] **AC-05**: `stalenessFactor` computes weight decay 1.0->0.5 over 7->30 days for stale pages
- [ ] **AC-06**: All operations are idempotent — calling `indexConfluencePage` twice with same input produces same state
- [ ] **AC-07**: Error handling never throws unhandled — graceful degradation with empty results
- [ ] **AC-08**: Test coverage > 85%, all 6 exported functions tested
- [ ] **AC-09**: `buildConfluenceNeighborhood` builds pruned denormalized neighborhood (max 50 neighbors)

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

#### `indexConfluencePage(page: ConfluencePageInput, executionId: string): Promise<void>`

- **Proposito**: Indexes a Confluence page into storage with node, edges, topics, neighborhood, and stats
- **Pre-condiciones**: page.pageId and page.projectKey must be non-empty
- **Post-condiciones**: Node, edges, topic index, neighborhood, and stats updated

#### `extractJiraReferences(pageContent: string): readonly string[]`

- **Proposito**: Extracts unique Jira issue keys from page content via regex
- **Pre-condiciones**: pageContent is a string (may be empty)
- **Post-condiciones**: Returns deduplicated issue keys, capped at 50

#### `extractPageTopics(pageTitle: string, labels: readonly string[]): readonly RelationshipEdge[]`

- **Proposito**: Extracts topic-match edges from page title words and labels
- **Pre-condiciones**: pageTitle is a string, labels is array
- **Post-condiciones**: Returns edges with weight 0.6 targeting topic:{label}

#### `getDocumentingPages(issueKey: string, projectKey: string, executionId: string): Promise<readonly EntityNode[]>`

- **Proposito**: Reverse lookup — finds all Confluence pages that reference a given Jira issue
- **Pre-condiciones**: issueKey and projectKey non-empty
- **Post-condiciones**: Returns array of EntityNode or empty array on error

#### `buildConfluenceNeighborhood(pageId: string, projectKey: string, jiraRefs: readonly string[], topics: readonly string[]): EntityNeighborhood`

- **Proposito**: Builds denormalized neighborhood for O(1) reads
- **Pre-condiciones**: pageId and projectKey non-empty
- **Post-condiciones**: Neighborhood with pruned linkedIssues (max 50)

#### `stalenessFactor(sourceUpdatedAt: string, targetUpdatedAt: string): number`

- **Proposito**: Computes weight decay for stale edges
- **Pre-condiciones**: ISO date strings
- **Post-condiciones**: 1.0 if fresh (<=7 days), 0.5 if very stale (>=30 days), linear interpolation otherwise

---

## Dependencias (imports)

### Internas (proyecto)

- `src/backend/types/relationship-index` -> EntityNode, RelationshipEdge, EntityNeighborhood, NeighborSummary, GraphStats
- `src/backend/services/relationship-index/relationship-storage` -> putNode, putEdges, getEdges, getTopicEntities, putTopicIndex, getStats, putStats, getNode, putNeighborhood

### Externas (npm)

- None

---

## Estrategia de Test

### Unit Tests (`tests/unit/services/relationship-index/confluence-indexer.spec.ts`)

| Test                                       | AC cubierto | Regla cubierta |
| ------------------------------------------ | ----------- | -------------- |
| extractJiraReferences finds keys in text   | AC-02       | -              |
| extractJiraReferences caps at 50 refs      | AC-02       | FORGE-OPS-013  |
| extractJiraReferences deduplicates         | AC-02       | -              |
| extractPageTopics from labels              | AC-03       | FORGE-OPS-012  |
| extractPageTopics with empty labels        | AC-03       | -              |
| buildConfluenceNeighborhood prunes at 50   | AC-09       | FORGE-OPS-013  |
| stalenessFactor fresh returns 1.0          | AC-05       | -              |
| stalenessFactor stale returns 0.5          | AC-05       | -              |
| stalenessFactor linear interpolation       | AC-05       | -              |
| stalenessFactor parse error returns 1.0    | AC-05       | -              |
| indexConfluencePage writes all data        | AC-01       | ARCH-SOLID-005 |
| indexConfluencePage idempotent             | AC-06       | -              |
| getDocumentingPages reverse lookup         | AC-04       | -              |
| getDocumentingPages returns empty on error | AC-07       | FORGE-OPS-0104 |

---

## Historial de Cambios

| Fecha      | Tarea Ralph | Cambio                                |
| ---------- | ----------- | ------------------------------------- |
| 2026-05-01 | RTASK-039   | Creado inicial — 6 exported functions |
