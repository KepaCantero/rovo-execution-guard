# REQUISITOS: Graph Maintenance

> **Sidecar File** | Vinculado a: `src/backend/services/relationship-index/graph-maintenance.ts`

---

## Descripcion

Storage-level graph maintenance operations for the Relationship Index: node validation against storage, orphaned edge cleanup, stale node detection, edge compaction, health reporting, operational memory pruning, decision pattern compaction, neighborhood drift validation, and full maintenance cycle orchestration. Keeps the graph healthy by detecting and removing stale data without external API calls.

---

## Acceptance Criteria

- [ ] **AC-01**: `validateNodeBatch` validates nodes against storage, checking both node existence and edge target existence, returning deduplicated orphaned IDs
- [ ] **AC-03**: `removeOrphanedEdges` removes edge entries for orphaned node IDs, returning count of individual edges removed
- [ ] **AC-04**: `refreshStaleNodes` counts nodes whose `updatedAt` is older than the maxAge threshold (pure computation, no external API calls)
- [ ] **AC-05**: `compactStorage` deduplicates edges per source node by `(source, target, type)` key and writes back compacted lists
- [ ] **AC-06**: `generateHealthReport` produces actionable health metrics with healthy/degraded/critical thresholds per spec table
- [ ] **AC-11**: All maintenance operations are idempotent — running twice produces same result
- [ ] **AC-12**: Maintenance never blocks evaluation pipeline (fire-and-forget safe)
- [ ] **AC-15**: `pruneDecisionLog` removes decisions older than configurable retention (default 90 days), keeping overridden decisions younger than 30 days
- [ ] **AC-16**: `compactDecisionPatterns` merges similar decisions (same contextSignature + gateType) into patterns, keeping most recent as representative
- [ ] **AC-17**: `validateNeighborhoods` detects and repairs drift between neighborhood cache and adjacency list, rebuilding from edges on mismatch
- [ ] **AC-18**: `runMaintenanceCycle` orchestrates all phases (validate→removeOrphans→refresh→compact→neighborhoods→prune→compactPatterns) with graceful degradation

---

## Reglas del Rulebook

| ID Regla       | Categoria    | Descripcion breve                                             |
| -------------- | ------------ | ------------------------------------------------------------- |
| FORGE-OPS-005  | Forge Ops    | No Forge function exceeds 10s — bounded batch processing      |
| FORGE-OPS-007  | Forge Ops    | Rate limits: 110ms between writes/deletes                     |
| FORGE-OPS-012  | Forge Ops    | Hierarchical storage keys via repository only                 |
| FORGE-OPS-013  | Forge Ops    | Storage values must not exceed 4KB                            |
| FORGE-OPS-0102 | Forge Ops    | Retry with exponential backoff (baked into storage functions) |
| FORGE-OPS-0104 | Forge Ops    | Graceful degradation — errors logged, not thrown              |
| FORGE-OPS-0105 | Forge Ops    | Stateless functions, no module-level mutable state            |
| ARCH-SOLID-006 | Arquitectura | Handler → Service → Repository (this is Service)              |
| ARCH-SOLID-052 | Arquitectura | Functions < 20 lines effective logic, max 3 nesting levels    |
| ARCH-SOLID-202 | Arquitectura | Zero any                                                      |
| ARCH-SOLID-205 | Arquitectura | Explicit return types on all exports                          |
| ARCH-SOLID-232 | Arquitectura | Named exports only                                            |
| ARCH-SOLID-241 | Arquitectura | Try/catch or delegated error handling                         |
| ARCH-SOLID-255 | Arquitectura | Structured JSON logging                                       |
| TEST-QA-056    | Testing      | TDD cycle — RED, GREEN, REFACTOR                              |
| TEST-QA-057    | Testing      | Edge case coverage                                            |

---

## Contrato Publico (API del modulo)

### Funciones exportadas

#### `validateNodeBatch(nodes: readonly EntityNode[], executionId: string): Promise<readonly string[]>`

- **Proposito**: Validate a batch of nodes against storage, returning IDs of orphaned nodes
- **Pre-condiciones**: nodes array may be empty; each EntityNode has its own projectKey
- **Post-condiciones**: Returns deduplicated list of node IDs that don't exist in storage
- **Errores**: Individual errors logged and skipped (graceful degradation)

#### `removeOrphanedEdges(projectKey: string, orphanedNodeIds: readonly string[], executionId: string): Promise<number>`

- **Proposito**: Remove edge entries for orphaned nodes, counting individual edges removed
- **Pre-condiciones**: orphanedNodeIds may be empty; all IDs belong to same project
- **Post-condiciones**: Returns count of individual edges removed across all orphaned nodes
- **Errores**: Individual errors logged and skipped (graceful degradation)

#### `refreshStaleNodes(nodes: readonly EntityNode[], maxAge: string, executionId: string): Promise<number>`

- **Proposito**: Count nodes whose `updatedAt` is older than the maxAge threshold
- **Pre-condiciones**: nodes array may be empty; maxAge format "Nd" (e.g., "7d"), invalid defaults to epoch
- **Post-condiciones**: Returns count of stale nodes; pure computation, no side effects
- **Errores**: No async errors — pure synchronous date comparison

#### `compactStorage(projectKey: string, sourceIds: readonly string[], executionId: string): Promise<MaintenanceResult>`

- **Proposito**: Deduplicate edges per source node and write back compacted lists
- **Pre-condiciones**: sourceIds may be empty; all IDs belong to same project
- **Post-condiciones**: Returns MaintenanceResult with duplicate removal counts
- **Errores**: Individual errors logged and skipped (graceful degradation)

#### `generateHealthReport(projectKey: string, executionId: string, healthData?: {...}): Promise<GraphHealthReport>`

- **Proposito**: Compute health metrics with healthy/degraded/critical thresholds from GraphStats
- **Pre-condiciones**: projectKey must be valid; healthData is optional caller-provided orphaned/stale counts
- **Post-condiciones**: Returns GraphHealthReport with computed status (worst metric wins)
- **Errores**: Returns best-effort report using default stats on storage failure

#### `pruneDecisionLog(decisions: readonly DecisionRecord[], retentionDays: number, executionId: string): Promise<MaintenanceResult>`

- **Proposito**: Identify decisions older than retention period for pruning. Overridden decisions kept if < 30 days old.
- **Pre-condiciones**: decisions array may be empty; retentionDays must be positive
- **Post-condiciones**: Returns MaintenanceResult with orphansRemoved = count of prunable decisions
- **Errores**: No async errors — pure computation

#### `compactDecisionPatterns(decisions: readonly DecisionRecord[], executionId: string): Promise<MaintenanceResult>`

- **Proposito**: Group decisions by contextSignature + gateType, identify compaction opportunities
- **Pre-condiciones**: decisions array may be empty
- **Post-condiciones**: Returns MaintenanceResult with staleUpdated = count of decisions that can be compacted
- **Errores**: No async errors — pure computation

#### `validateNeighborhoods(projectKey: string, entityIds: readonly string[], executionId: string): Promise<MaintenanceResult>`

- **Proposito**: Detect and repair drift between denormalized neighborhood cache and adjacency list
- **Pre-condiciones**: entityIds may be empty; all IDs belong to same project
- **Post-condiciones**: Returns MaintenanceResult with staleUpdated = count of repaired neighborhoods
- **Errores**: Individual errors logged and skipped (graceful degradation)

#### `runMaintenanceCycle(projectKey: string, nodes: readonly EntityNode[], decisions: readonly DecisionRecord[], executionId: string): Promise<MaintenanceResult>`

- **Proposito**: Orchestrate all 7 maintenance phases with graceful degradation
- **Pre-condiciones**: nodes and decisions may be empty; caller controls batch size
- **Post-condiciones**: Returns accumulated MaintenanceResult across all phases
- **Errores**: Phase failures logged but don't stop cycle; errors collected in result

---

## Dependencias (imports)

### Internas (proyecto)

- `src/backend/services/relationship-index/relationship-storage` → `getNode`, `getEdges`, `deleteEdges`, `putEdges`, `getStats`, `getNeighborhood`, `putNeighborhood`
- `src/backend/types/relationship-index` → `EntityNode`, `RelationshipEdge`, `DecisionRecord`, `EntityNeighborhood`, `NeighborSummary` (type-only)

---

## Health Thresholds Reference

| Metric                      | Healthy | Degraded | Critical |
| --------------------------- | ------- | -------- | -------- |
| Orphaned nodes (% of total) | < 5%    | 5-15%    | > 15%    |
| Stale edges (% of total)    | < 10%   | 10-25%   | > 25%    |
| Max edges per node          | < 50    | 50-100   | > 100    |
| Days since maintenance      | < 14    | 14-30    | > 30     |

---

## Estrategia de Test

### Unit Tests (`tests/unit/services/relationship-index/graph-maintenance.spec.ts`)

| Test                                         | AC cubierto | Regla cubierta |
| -------------------------------------------- | ----------- | -------------- |
| validateNodeBatch: all nodes exist           | AC-01       | -              |
| validateNodeBatch: orphaned IDs for missing  | AC-01       | -              |
| validateNodeBatch: edge target check         | AC-01       | -              |
| validateNodeBatch: dedup                     | AC-01       | -              |
| validateNodeBatch: empty batch               | AC-01       | -              |
| validateNodeBatch: all orphaned              | AC-01       | -              |
| validateNodeBatch: all 5 entity types        | AC-01       | -              |
| validateNodeBatch: idempotent                | AC-11       | -              |
| validateNodeBatch: graceful degradation      | AC-01       | FORGE-OPS-0104 |
| removeOrphanedEdges: deletes and counts      | AC-03       | -              |
| removeOrphanedEdges: no edges                | AC-03       | -              |
| removeOrphanedEdges: empty list              | AC-03       | -              |
| removeOrphanedEdges: idempotent              | AC-11       | -              |
| removeOrphanedEdges: graceful degradation    | AC-03       | FORGE-OPS-0104 |
| refreshStaleNodes: all fresh                 | AC-04       | -              |
| refreshStaleNodes: counts stale              | AC-04       | -              |
| refreshStaleNodes: empty list                | AC-04       | -              |
| refreshStaleNodes: all stale                 | AC-04       | -              |
| refreshStaleNodes: parse 14d                 | AC-04       | -              |
| refreshStaleNodes: invalid maxAge            | AC-04       | -              |
| refreshStaleNodes: mixed entity types        | AC-04       | -              |
| refreshStaleNodes: idempotent                | AC-11       | -              |
| compactStorage: empty sourceIds              | AC-05       | -              |
| compactStorage: deduplicates and writes      | AC-05       | -              |
| compactStorage: no duplicates                | AC-05       | -              |
| compactStorage: multiple sources             | AC-05       | -              |
| compactStorage: rate limiting                | AC-05       | FORGE-OPS-007  |
| compactStorage: idempotent                   | AC-11       | -              |
| compactStorage: graceful degradation         | AC-05       | FORGE-OPS-0104 |
| generateHealthReport: healthy status         | AC-06       | -              |
| generateHealthReport: degraded status        | AC-06       | -              |
| generateHealthReport: critical status        | AC-06       | -              |
| generateHealthReport: days critical          | AC-06       | -              |
| generateHealthReport: worst metric wins      | AC-06       | -              |
| generateHealthReport: empty graph            | AC-06       | -              |
| generateHealthReport: never maintained       | AC-06       | -              |
| generateHealthReport: storage keys estimate  | AC-06       | -              |
| generateHealthReport: avgEdgesPerNode        | AC-06       | -              |
| generateHealthReport: default healthData     | AC-06       | -              |
| pruneDecisionLog: all within retention       | AC-15       | -              |
| pruneDecisionLog: prunes expired             | AC-15       | -              |
| pruneDecisionLog: keeps overridden < 30d     | AC-15       | -              |
| pruneDecisionLog: prunes overridden > 30d    | AC-15       | -              |
| pruneDecisionLog: empty decisions            | AC-15       | -              |
| pruneDecisionLog: all expired                | AC-15       | -              |
| pruneDecisionLog: idempotent                 | AC-11       | -              |
| compactDecisionPatterns: empty decisions     | AC-16       | -              |
| compactDecisionPatterns: unique signatures   | AC-16       | -              |
| compactDecisionPatterns: merges same group   | AC-16       | -              |
| compactDecisionPatterns: keeps most recent   | AC-16       | -              |
| compactDecisionPatterns: multiple groups     | AC-16       | -              |
| compactDecisionPatterns: idempotent          | AC-11       | -              |
| validateNeighborhoods: empty entities        | AC-17       | -              |
| validateNeighborhoods: consistent            | AC-17       | -              |
| validateNeighborhoods: missing edge in nh    | AC-17       | -              |
| validateNeighborhoods: extra entry in nh     | AC-17       | -              |
| validateNeighborhoods: null neighborhood     | AC-17       | -              |
| validateNeighborhoods: partial drift         | AC-17       | -              |
| validateNeighborhoods: graceful degradation  | AC-17       | FORGE-OPS-0104 |
| validateNeighborhoods: idempotent            | AC-11       | -              |
| runMaintenanceCycle: empty data              | AC-18       | -              |
| runMaintenanceCycle: all phases run          | AC-18       | -              |
| runMaintenanceCycle: phase failure continues | AC-18       | FORGE-OPS-0104 |
| runMaintenanceCycle: idempotent              | AC-11       | -              |

---

## Historial de Cambios

| Fecha      | Tarea Ralph | Cambio                                                                                                       |
| ---------- | ----------- | ------------------------------------------------------------------------------------------------------------ |
| 2026-05-02 | RTASK-044   | Creado inicial (Step 11.1: validateNodeBatch, removeOrphanedEdges, MaintenanceResult)                        |
| 2026-05-02 | RTASK-044   | Extendido (Step 11.2: refreshStaleNodes, compactStorage, generateHealthReport, GraphHealthReport)            |
| 2026-05-02 | RTASK-044   | Extendido (Step 11.3: pruneDecisionLog, compactDecisionPatterns, validateNeighborhoods, runMaintenanceCycle) |
