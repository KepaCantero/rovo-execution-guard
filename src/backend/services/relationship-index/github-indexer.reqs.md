# REQUISITOS: github-indexer

> **Sidecar File** | Vinculado a: `src/backend/services/relationship-index/github-indexer.ts`

---

## Descripcion

GitHub PR relationship indexer that populates the Relationship Index with PR nodes and their edges to Jira issues and topics. Enables Rovo to detect scope misalignment between PRs and their linked issues using structural relationships rather than string matching. Part of the cross-tool Knowledge Graph (Jira + Confluence + GitHub).

---

## Acceptance Criteria

- [x] **AC-01**: `indexPullRequest` stores node, edges, topic index, neighborhood, and stats with structured logging
- [x] **AC-02**: Extracts `implements` edges from PR title, body (weight 0.9), and branch name (weight 0.7)
- [x] **AC-03**: Extracts `topic-match` edges from PR labels (weight 0.6)
- [x] **AC-04**: `getImplementingPRs` performs reverse lookup via edges on Jira nodes
- [x] **AC-05**: All operations are idempotent (upsert pattern in storage)
- [x] **AC-06**: Test coverage > 85% with meaningful assertions
- [x] **AC-07**: `.reqs.md` sidecar created

---

## Reglas del Rulebook

| ID Regla       | Categoria    | Descripcion breve                |
| -------------- | ------------ | -------------------------------- |
| FORGE-OPS-005  | Forge Ops    | Handler execution <= 10s         |
| FORGE-OPS-006  | Forge Ops    | Storage <= 100MB                 |
| FORGE-OPS-007  | Forge Ops    | Throughput <= 10 writes/s        |
| FORGE-OPS-013  | Forge Ops    | Storage value <= 4KB             |
| FORGE-OPS-0105 | Forge Ops    | Stateless functions              |
| ARCH-SOLID-005 | Arquitectura | Repository layer only            |
| ARCH-SOLID-006 | Arquitectura | Handler -> Service -> Repository |
| ARCH-SOLID-202 | Arquitectura | Zero any types                   |
| GH-INTEG-306   | GitHub       | Idempotent operations            |

---

## Contrato Publico (API del modulo)

### Tipos exportados

#### `PRIndexInput`

- **Proposito**: Input for indexing a GitHub PR
- **Campos**: prNumber, repo, title, body, branch, baseBranch, state, labels, url, fileCount, additions, deletions, author

### Funciones exportadas

#### `indexPullRequest(pr: PRIndexInput, projectKey: string, executionId: string): Promise<void>`

- **Proposito**: Index a GitHub PR as EntityNode + edges + neighborhood + stats
- **Pre-condiciones**: pr.repo in `owner/repo` format
- **Post-condiciones**: Node, edges, topic index, neighborhood, and stats written to storage
- **Errores**: Never throws — graceful degradation

#### `extractJiraKeysFromPR(prTitle: string, prBody: string, branchName: string): readonly string[]`

- **Proposito**: Extract unique Jira issue keys from PR title, body, and branch name
- **Pre-condiciones**: String inputs (may be empty)
- **Post-condiciones**: Deduplicated, capped at 10 unique keys
- **Errores**: Never throws

#### `getImplementingPRs(issueKey: string, projectKey: string, executionId: string): Promise<readonly EntityNode[]>`

- **Proposito**: Reverse lookup — find all PRs that implement a given Jira issue
- **Pre-condiciones**: Non-empty issueKey and projectKey
- **Post-condiciones**: Returns EntityNode array of github-pr nodes
- **Errores**: Returns empty array on error, never throws

#### `buildPRNeighborhood(pr: PRIndexInput, projectKey: string, jiraKeys: readonly string[], topics: readonly string[]): EntityNeighborhood`

- **Proposito**: Build denormalized neighborhood for O(1) reads
- **Pre-condiciones**: Valid PRIndexInput
- **Post-condiciones**: EntityNeighborhood with linkedIssues and topics, pruned to MAX_NEIGHBORS

---

## Dependencias (imports)

### Internas (proyecto)

- `src/backend/types/relationship-index` -> EntityNode, RelationshipEdge, EntityNeighborhood, NeighborSummary, GraphStats, EdgeType
- `src/backend/services/relationship-index/relationship-storage` -> putNode, putEdges, getEdges, getTopicEntities, putTopicIndex, getStats, putStats, getNode, putNeighborhood

### Externas (npm)

- None

---

## Estrategia de Test

### Unit Tests (`tests/unit/services/relationship-index/github-indexer.spec.ts`)

| Test                                                  | AC cubierto | Regla cubierta |
| ----------------------------------------------------- | ----------- | -------------- |
| should extract keys from title and body               | AC-02       | -              |
| should extract keys from branch name                  | AC-02       | -              |
| should deduplicate keys across sources                | AC-02       | -              |
| should cap at 10 keys                                 | AC-02       | FORGE-OPS-013  |
| should extract topics from labels                     | AC-03       | -              |
| should build neighborhood with correct fields         | -           | -              |
| should store node, edges, topics, neighborhood, stats | AC-01       | ARCH-SOLID-005 |
| should return PRs for issue via reverse lookup        | AC-04       | -              |
| should return empty on error                          | AC-04       | FORGE-OPS-0104 |
| should use zero any types                             | -           | ARCH-SOLID-202 |
| should not import @forge/api                          | -           | ARCH-SOLID-005 |

---

## Historial de Cambios

| Fecha      | Tarea Ralph | Cambio         |
| ---------- | ----------- | -------------- |
| 2026-05-01 | RTASK-040   | Creado inicial |
