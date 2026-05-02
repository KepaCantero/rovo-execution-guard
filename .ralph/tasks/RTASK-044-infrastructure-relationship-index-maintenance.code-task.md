---
id: RTASK-044
title: 'Infrastructure — Relationship Index Maintenance: Scheduled Re-index, Orphan Cleanup, Compaction'
status: pending
priority: 3
type: infrastructure
dependencies: [RTASK-037, RTASK-038, RTASK-039, RTASK-040]
rulebook_refs: [ARCH-SOLID-006, FORGE-OPS-001, FORGE-OPS-005]
---

# RTASK-044: Infrastructure — Relationship Index Maintenance

## Objective

Implement scheduled maintenance for the Relationship Index: periodic re-indexing to keep the graph fresh, orphan detection and cleanup, storage compaction, and health monitoring. Without this, the graph degrades over time as entities are deleted, updated, or moved between projects.

## Context

RTASK-037..040 build and populate the Relationship Index. RTASK-041 wires it into Rovo's decisions. But the graph is a cache — it drifts from truth as:

1. **Jira issues are deleted or moved** — orphaned nodes and edges remain
2. **Confluence pages are archived** — stale documentation links persist
3. **Issue links are removed** — edges no longer reflect reality
4. **Labels change** — topic clusters become inaccurate
5. **Storage grows** — Forge Storage has per-key and total limits

This task adds the maintenance infrastructure to keep the graph healthy.

It also implements **deliberate forgetting** for operational memory — pruning stale decisions, compacting override patterns, and ensuring the decision log doesn't grow unbounded (HippoRAG 2 pattern). The maintenance cycle operates on two separate timelines:

- **Knowledge graph**: Weekly validation + orphan cleanup + refresh
- **Operational memory**: Daily pruning of decisions older than retention period + pattern compaction

### What Breaks Without Maintenance

| Scenario                                                  | Impact on Rovo Decisions                                                  |
| --------------------------------------------------------- | ------------------------------------------------------------------------- |
| Issue PROJ-100 deleted but node `jira:PROJ-100` remains   | Rovo detects contradictions with a non-existent ticket                    |
| Confluence page archived but `documented-by` edge remains | `handleValidateSpecAlignment` reports alignment with dead page            |
| Issue moved from project PROJ to project ORG              | Node still indexed under `node:PROJ:jira:PROJ-100`, wrong project context |
| 500+ edges accumulated over months                        | Traversal exceeds Forge function timeout; queries fail                    |
| Stale topic clusters                                      | `topic-match` edges point to outdated entity groupings                    |

### Existing Components to Reuse

| Module                 | Location                                                                      | What to Reuse                                         |
| ---------------------- | ----------------------------------------------------------------------------- | ----------------------------------------------------- |
| **Storage layer**      | `src/backend/services/relationship-index/relationship-storage.ts` (RTASK-037) | All CRUD operations, `getStats`, `queryRelationships` |
| **Domain types**       | `src/backend/types/relationship-index.ts` (RTASK-037)                         | `EntityNode`, `RelationshipEdge`, `GraphStats`        |
| **Jira indexer**       | `src/backend/services/relationship-index/jira-indexer.ts` (RTASK-038)         | `bootstrapProjectIndex` for full re-sync              |
| **Confluence indexer** | `src/backend/services/relationship-index/confluence-indexer.ts` (RTASK-039)   | `indexConfluencePage` for re-indexing                 |
| **GitHub indexer**     | `src/backend/services/relationship-index/github-indexer.ts` (RTASK-040)       | `indexPullRequest` for re-indexing                    |

## Technical Specification

### Location

- `src/backend/services/relationship-index/graph-maintenance.ts` (create — maintenance operations)
- `src/backend/services/relationship-index/index.ts` (modify — add maintenance exports)
- `src/backend/resolvers/scheduled-indexer.ts` (create — Forge scheduled trigger handler)
- `manifest.yml` (modify — add scheduled trigger)

### Step 1: Graph Maintenance Module

**File**: `src/backend/services/relationship-index/graph-maintenance.ts`

```typescript
/** Maintenance operation result */
export interface MaintenanceResult {
  readonly operation: string;
  readonly executionId: string;
  readonly durationMs: number;
  readonly nodesProcessed: number;
  readonly edgesProcessed: number;
  readonly orphansRemoved: number;
  readonly staleUpdated: number;
  readonly errors: readonly string[];
}

/** Graph health report */
export interface GraphHealthReport {
  readonly projectKey: string;
  readonly totalNodes: number;
  readonly totalEdges: number;
  readonly orphanedNodes: number;
  readonly staleEdges: number; // edges pointing to deleted/outdated entities
  readonly avgEdgesPerNode: number;
  readonly maxEdgesPerNode: number;
  readonly storageKeysUsed: number;
  readonly lastMaintenanceAt: string;
  readonly status: 'healthy' | 'degraded' | 'critical';
}

/**
 * Run full maintenance cycle for a project's graph.
 * 1. Validate all nodes against source systems
 * 2. Remove orphaned edges
 * 3. Update stale nodes
 * 4. Compact storage
 */
export async function runMaintenanceCycle(
  projectKey: string,
  executionId: string,
): Promise<MaintenanceResult>;

/**
 * Validate a batch of nodes against their source systems.
 * Returns list of node IDs that no longer exist in the source.
 */
export async function validateNodeBatch(
  nodes: readonly EntityNode[],
  executionId: string,
): Promise<readonly string[]>;

/**
 * Remove all edges that reference orphaned (deleted) entities.
 */
export async function removeOrphanedEdges(
  projectKey: string,
  orphanedNodeIds: readonly string[],
  executionId: string,
): Promise<number>;

/**
 * Update nodes whose source data has changed since last index.
 */
export async function refreshStaleNodes(
  projectKey: string,
  maxAge: string, // e.g., "7d"
  executionId: string,
): Promise<number>;

/**
 * Compact storage by merging edge lists and removing duplicates.
 */
export async function compactStorage(
  projectKey: string,
  executionId: string,
): Promise<MaintenanceResult>;

/**
 * Generate a health report for a project's graph.
 */
export async function generateHealthReport(
  projectKey: string,
  executionId: string,
): Promise<GraphHealthReport>;

/**
 * Prune operational memory — remove decisions older than retention period.
 * Implements "deliberate forgetting" from HippoRAG 2 research.
 */
export async function pruneDecisionLog(
  projectKey: string,
  retentionDays: number, // default: 90
  executionId: string,
): Promise<MaintenanceResult>;

/**
 * Compact operational memory — merge similar decision patterns.
 * Instead of storing 100 individual decisions, store 10 patterns.
 */
export async function compactDecisionPatterns(
  projectKey: string,
  executionId: string,
): Promise<MaintenanceResult>;

/**
 * Validate neighborhood consistency — ensure denormalized neighborhoods
 * match the adjacency list. Repair if drift detected.
 */
export async function validateNeighborhoods(
  projectKey: string,
  executionId: string,
): Promise<MaintenanceResult>;
```

### Step 2: Node Validation Logic

For each entity type, validate differently:

| Entity Type       | Validation Method                                            | Staleness Check                                                                   |
| ----------------- | ------------------------------------------------------------ | --------------------------------------------------------------------------------- |
| `jira-issue`      | Fetch via `getTicketData` — if 404, node is orphaned         | `updatedAt` > 7 days old → refresh                                                |
| `jira-epic`       | Fetch via `getTicketData` — if 404, node is orphaned         | `updatedAt` > 7 days old → refresh                                                |
| `confluence-page` | Fetch via `getPageMetadata` — if 404 or archived, orphaned   | `updatedAt` > 14 days old → refresh                                               |
| `github-pr`       | Check if PR still open/recent — merged PRs > 30 days → stale | `updatedAt` > 30 days old → refresh or remove                                     |
| `topic`           | Check if any entities still belong to topic cluster          | No entities → remove topic                                                        |
| `decision`        | Check age against retention period                           | Age > 90 days → prune; overridden decisions < 30 days → keep for pattern analysis |

### Step 3: Scheduled Trigger Handler

**File**: `src/backend/resolvers/scheduled-indexer.ts`

```typescript
/**
 * Forge scheduled trigger handler for graph maintenance.
 * Runs weekly to keep the Relationship Index healthy.
 *
 * Forge manifest configuration:
 *   trigger:
 *     - key: scheduled-maintenance
 *       function: scheduled-maintenance-fn
 *       interval: weekly
 */
export async function handler(
  payload: { readonly projectKey?: string },
  context: { readonly accountId: string },
): Promise<{ readonly result: string; readonly maintenance?: MaintenanceResult }>;
```

### Step 4: Manifest Addition

**File**: `manifest.yml`

```yaml
# Under triggers:
trigger:
  - key: scheduled-maintenance
    function: scheduled-maintenance-fn
    interval: '0 3 * * 1' # Every Monday at 3 AM (project timezone)

# Under functions:
function:
  # ... existing functions ...
  - key: scheduled-maintenance-fn
    handler: scheduled-indexer.handler
```

### Step 5: Incremental Re-index on Events

In addition to scheduled maintenance, add hooks for incremental re-indexing:

**In `workflow-transition.ts`** (existing):

```typescript
// After evaluation, schedule incremental re-index of the ticket
void indexJiraIssue(buildIndexInput(ticket), executionId).catch(() => {});
```

**In `github-webhook.ts`** (existing):

```typescript
// After processing PR event, re-index the PR
void indexPullRequest(buildPRIndexInput(prData), projectKey, executionId).catch(() => {});
```

### Step 6: Health Monitoring

Add graph health metrics to the admin dashboard (RTASK-019) via resolver:

```typescript
// In src/backend/resolvers/index.ts, add:
export async function getGraphHealth(
  projectKey: string,
  executionId?: string,
): Promise<GraphHealthReport>;
```

The admin dashboard can display:

- Total nodes/edges per project
- Orphan count
- Last maintenance timestamp
- Health status (healthy/degraded/critical)

**Health thresholds**:

| Metric                 | Healthy | Degraded | Critical |
| ---------------------- | ------- | -------- | -------- |
| Orphaned nodes         | < 5%    | 5-15%    | > 15%    |
| Stale edges            | < 10%   | 10-25%   | > 25%    |
| Max edges per node     | < 50    | 50-100   | > 100    |
| Days since maintenance | < 14    | 14-30    | > 30     |

## Acceptance Criteria

- [ ] AC-01: `graph-maintenance.ts` implements `runMaintenanceCycle` with all 4 phases
- [ ] AC-02: `validateNodeBatch` validates nodes against source systems
- [ ] AC-03: `removeOrphanedEdges` cleans up edges referencing deleted entities
- [ ] AC-04: `refreshStaleNodes` re-indexes nodes older than threshold
- [ ] AC-05: `compactStorage` merges edge lists and removes duplicates
- [ ] AC-06: `generateHealthReport` produces actionable health metrics
- [ ] AC-07: `scheduled-indexer.ts` handler registered in manifest
- [ ] AC-08: Scheduled trigger configured for weekly execution
- [ ] AC-09: Incremental re-index hooks in transition and webhook handlers
- [ ] AC-10: Graph health resolver endpoint for admin dashboard
- [ ] AC-11: All maintenance operations are idempotent
- [ ] AC-12: Maintenance never blocks evaluation pipeline (fire-and-forget)
- [ ] AC-13: Test coverage > 85%
- [ ] AC-14: `.reqs.md` sidecars created
- [ ] AC-15: `pruneDecisionLog` removes decisions older than configurable retention
- [ ] AC-16: `compactDecisionPatterns` merges similar decisions into patterns
- [ ] AC-17: `validateNeighborhoods` detects and repairs drift between neighborhood cache and adjacency list
- [ ] AC-18: Maintenance runs on separate schedules for knowledge graph (weekly) and operational memory (daily)

## QA Gates

### Pre-Implementation

- [ ] **GATE-READY**: RTASK-037..040 completed (indexers)
- [ ] **GATE-REVIEW**: Read Forge scheduled trigger documentation

### Implementation

- [ ] **GATE-IDEMPOTENT**: Running maintenance twice produces same result
- [ ] **GATE-NONBLOCKING**: Maintenance does not block evaluation pipeline
- [ ] **GATE-TIMEOUT**: Maintenance cycle completes within Forge function timeout (25s)
- [ ] **GATE-BATCH**: Large projects processed in batches

### Post-Implementation

- [ ] **GATE-TYPECHECK**: `pnpm typecheck` passes
- [ ] **GATE-LINT**: `pnpm lint` passes
- [ ] **GATE-TEST**: `pnpm test:unit` passes
- [ ] **GATE-FORGE**: `forge lint` passes, `forge deploy` succeeds

## Implementation Protocol

### Step 1: Maintenance Module

1. Create `graph-maintenance.ts`
2. Implement `validateNodeBatch` for each entity type
3. Implement `removeOrphanedEdges`
4. Implement `refreshStaleNodes`
5. Implement `compactStorage`
6. Implement `runMaintenanceCycle` (orchestrates all phases)
7. Implement `generateHealthReport`
8. Write tests

### Step 2: Scheduled Handler

1. Create `scheduled-indexer.ts`
2. Implement handler with timeout guard
3. Add to manifest.yml
4. Verify `forge lint` passes

### Step 3: Incremental Hooks

1. Add re-index hook to `workflow-transition.ts`
2. Add re-index hook to `github-webhook.ts`
3. Write tests

### Step 4: Health Monitoring

1. Add `getGraphHealth` to resolvers
2. Add resolver to manifest
3. Write tests

### Step 5: Validation

1. `pnpm typecheck`
2. `pnpm lint`
3. `pnpm test:unit`
4. `forge lint`
5. `forge deploy -e kcantero`

## Triple Deliverable

| Production                                                           | Sidecar            | Test                                                               |
| -------------------------------------------------------------------- | ------------------ | ------------------------------------------------------------------ |
| `src/backend/services/relationship-index/graph-maintenance.ts` (new) | `.reqs.md`         | `tests/unit/services/relationship-index/graph-maintenance.spec.ts` |
| `src/backend/resolvers/scheduled-indexer.ts` (new)                   | `.reqs.md`         | `tests/unit/resolvers/scheduled-indexer.spec.ts`                   |
| `src/backend/resolvers/workflow-transition.ts` (modified)            | updated `.reqs.md` | extended                                                           |
| `src/backend/resolvers/github-webhook.ts` (modified)                 | updated `.reqs.md` | extended                                                           |
| `manifest.yml` (modified)                                            | -                  | -                                                                  |

## Risks

| Risk                                                        | Mitigation                                                                            |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Forge function timeout during maintenance                   | Batch processing; each batch < 5s; timeout guard at 20s                               |
| Maintenance conflicts with active evaluation                | Fire-and-forget; evaluation always uses current graph state                           |
| Source system API rate limits during validation             | Batch with configurable delay (default: 100ms between calls)                          |
| Forge Storage limits exceeded during compaction             | Compact removes data; net storage always decreases                                    |
| Scheduled trigger not firing                                | Log maintenance runs; alert on health degradation in admin dashboard                  |
| Large project maintenance exceeds single function execution | Split into multiple scheduled runs (one per entity type)                              |
| Decision log grows unbounded                                | Default 90-day retention; configurable per project; pattern compaction reduces volume |
| Neighborhood cache drifts from adjacency list               | Weekly validation during maintenance cycle; repair on detection                       |
| Maintenance itself times out                                | Split into phases; each phase < 5s; continue from last checkpoint                     |
