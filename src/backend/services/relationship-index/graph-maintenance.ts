// [ARCH-SOLID-006] Service layer — uses Repository (relationship-storage) for all storage access
// [FORGE-OPS-0105] Stateless — no module-level mutable state
// [ARCH-SOLID-202] Zero any usage

import type { EntityNode, RelationshipEdge } from '../../types/relationship-index';

import { getNode, getEdges, deleteEdges, putEdges, getStats } from './relationship-storage';

// ═══════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════

/** Result of a maintenance operation. */
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

/** Health report for a project's relationship graph. [AC-06] */
export interface GraphHealthReport {
  readonly projectKey: string;
  readonly totalNodes: number;
  readonly totalEdges: number;
  readonly orphanedNodes: number;
  readonly staleEdges: number;
  readonly avgEdgesPerNode: number;
  readonly maxEdgesPerNode: number;
  readonly storageKeysUsed: number;
  readonly lastMaintenanceAt: string;
  readonly status: 'healthy' | 'degraded' | 'critical';
}

// ═══════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════

/** [FORGE-OPS-007] Delay between delete operations in ms (~9 deletes/s). */
const DELETE_DELAY_MS = 110;

// ═══════════════════════════════════════════
// PRIVATE HELPERS
// ═══════════════════════════════════════════

/** [ARCH-SOLID-255] Structured JSON log. */
function logStructured(
  level: 'info' | 'warn' | 'error',
  operation: string,
  executionId: string,
  details: Readonly<Record<string, unknown>>,
): void {
  console.log(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      level,
      operation,
      executionId,
      ...details,
    }),
  );
}

/** [FORGE-OPS-007] Rate-limit delay between write/delete operations. */
const rateLimitDelay = (): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, DELETE_DELAY_MS));

/** Check a single edge's target existence and collect orphaned IDs. */
async function checkEdgeTargets(
  projectKey: string,
  edges: readonly { readonly target: string }[],
  orphanedIds: Set<string>,
  executionId: string,
): Promise<void> {
  for (const edge of edges) {
    const targetNode = await getNode(projectKey, edge.target, executionId);
    if (targetNode === null) {
      orphanedIds.add(edge.target);
    }
  }
}

/** Parse maxAge string (e.g., "7d") to a Date threshold. Invalid → far future (all stale). */
function parseMaxAge(maxAge: string): Date {
  const match = /^(\d+)d$/.exec(maxAge);
  if (!match || !match[1]) {
    return new Date('2099-12-31T23:59:59Z');
  }
  const days = parseInt(match[1], 10);
  const threshold = new Date();
  threshold.setDate(threshold.getDate() - days);
  return threshold;
}

/** Deduplicate edges by (source, target, type) composite key. */
function deduplicateEdges(edges: readonly RelationshipEdge[]): readonly RelationshipEdge[] {
  const seen = new Set<string>();
  const result: RelationshipEdge[] = [];
  for (const edge of edges) {
    const key = `${edge.source}|${edge.target}|${edge.type}`;
    if (!seen.has(key)) {
      seen.add(key);
      result.push(edge);
    }
  }
  return result;
}

/** Classify a metric into healthy/degraded/critical tier. */
function classifyTier(
  value: number,
  degradedThreshold: number,
  criticalThreshold: number,
): 'healthy' | 'degraded' | 'critical' {
  if (value > criticalThreshold) return 'critical';
  if (value > degradedThreshold) return 'degraded';
  return 'healthy';
}

/** Compute overall health status — worst metric wins. */
function computeHealthStatus(metrics: {
  readonly orphanedRatio: number;
  readonly staleEdgeRatio: number;
  readonly maxEdgesPerNode: number;
  readonly daysSinceMaintenance: number;
}): 'healthy' | 'degraded' | 'critical' {
  const { orphanedRatio, staleEdgeRatio, maxEdgesPerNode, daysSinceMaintenance } = metrics;
  const tiers: readonly ('healthy' | 'degraded' | 'critical')[] = [
    classifyTier(orphanedRatio, 0.05, 0.15),
    classifyTier(staleEdgeRatio, 0.1, 0.25),
    classifyTier(maxEdgesPerNode, 50, 100),
    classifyTier(daysSinceMaintenance, 14, 30),
  ];
  if (tiers.includes('critical')) return 'critical';
  if (tiers.includes('degraded')) return 'degraded';
  return 'healthy';
}

// ═══════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════

/**
 * Validate a batch of nodes against storage.
 * Returns deduplicated IDs of nodes that no longer exist or are edge targets of non-existent nodes.
 *
 * AC ref: AC-01 of .reqs.md
 * REGLA: FORGE-OPS-0104 — graceful degradation, individual errors logged not thrown
 */
export async function validateNodeBatch(
  nodes: readonly EntityNode[],
  executionId: string,
): Promise<readonly string[]> {
  if (nodes.length === 0) {
    logStructured('info', 'validateNodeBatch', executionId, {
      totalNodes: 0,
      orphanedCount: 0,
    });
    return [];
  }

  const orphanedIds = new Set<string>();

  for (const node of nodes) {
    try {
      // Check if node still exists in storage
      const existing = await getNode(node.projectKey, node.id, executionId);
      if (existing === null) {
        orphanedIds.add(node.id);
        continue; // [FORGE-OPS-0104] Skip edge check for missing nodes
      }

      // Check edge targets
      const edges = await getEdges(node.projectKey, node.id, executionId);
      await checkEdgeTargets(node.projectKey, edges, orphanedIds, executionId);
    } catch (error: unknown) {
      // [FORGE-OPS-0104] Graceful degradation — log and continue
      const msg = error instanceof Error ? error.message : String(error);
      logStructured('error', 'validateNodeBatch', executionId, {
        nodeId: node.id,
        error: msg,
      });
    }
  }

  logStructured('info', 'validateNodeBatch', executionId, {
    totalNodes: nodes.length,
    orphanedCount: orphanedIds.size,
  });

  return [...orphanedIds];
}

/**
 * Remove edge entries for orphaned nodes.
 * Deletes edge lists where the source is an orphaned node and counts individual edges removed.
 *
 * AC ref: AC-03 of .reqs.md
 * REGLA: FORGE-OPS-007 — rate limit between deletes
 * REGLA: FORGE-OPS-0104 — graceful degradation
 */
export async function removeOrphanedEdges(
  projectKey: string,
  orphanedNodeIds: readonly string[],
  executionId: string,
): Promise<number> {
  if (orphanedNodeIds.length === 0) {
    logStructured('info', 'removeOrphanedEdges', executionId, {
      projectKey,
      edgesRemoved: 0,
    });
    return 0;
  }

  let removedCount = 0;

  for (const nodeId of orphanedNodeIds) {
    try {
      const edges = await getEdges(projectKey, nodeId, executionId);
      if (edges.length > 0) {
        await deleteEdges(projectKey, nodeId, executionId);
        removedCount += edges.length;
      }

      // [FORGE-OPS-007] Rate limit between operations
      if (orphanedNodeIds.length > 1) {
        await rateLimitDelay();
      }
    } catch (error: unknown) {
      // [FORGE-OPS-0104] Graceful degradation — log and continue
      const msg = error instanceof Error ? error.message : String(error);
      logStructured('error', 'removeOrphanedEdges', executionId, {
        nodeId,
        error: msg,
      });
    }
  }

  logStructured('info', 'removeOrphanedEdges', executionId, {
    projectKey,
    orphanedCount: orphanedNodeIds.length,
    edgesRemoved: removedCount,
  });

  return removedCount;
}

/**
 * Count nodes whose updatedAt is older than the maxAge threshold.
 * Pure storage-read — no external API calls. [AC-04]
 *
 * AC ref: AC-04 of .reqs.md
 * REGLA: FORGE-OPS-0105 — stateless, pure computation on provided data
 */
export async function refreshStaleNodes(
  nodes: readonly EntityNode[],
  maxAge: string,
  executionId: string,
): Promise<number> {
  const threshold = parseMaxAge(maxAge);
  let staleCount = 0;

  for (const node of nodes) {
    if (new Date(node.updatedAt) < threshold) {
      staleCount++;
    }
  }

  logStructured('info', 'refreshStaleNodes', executionId, {
    totalNodes: nodes.length,
    staleCount,
    maxAge,
  });

  return staleCount;
}

/**
 * Compact edge storage by deduplicating edges per source node.
 * Returns MaintenanceResult with duplicate removal counts. [AC-05]
 *
 * AC ref: AC-05 of .reqs.md
 * REGLA: FORGE-OPS-007 — rate limit between writes
 * REGLA: FORGE-OPS-0104 — graceful degradation per node
 */
export async function compactStorage(
  projectKey: string,
  sourceIds: readonly string[],
  executionId: string,
): Promise<MaintenanceResult> {
  const startTime = Date.now();

  if (sourceIds.length === 0) {
    logStructured('info', 'compactStorage', executionId, { projectKey, sourceIds: 0 });
    return {
      operation: 'compactStorage',
      executionId,
      durationMs: Date.now() - startTime,
      nodesProcessed: 0,
      edgesProcessed: 0,
      orphansRemoved: 0,
      staleUpdated: 0,
      errors: [],
    };
  }

  let nodesProcessed = 0;
  let edgesProcessed = 0;
  let duplicatesRemoved = 0;
  const errors: string[] = [];

  for (const sourceId of sourceIds) {
    try {
      const edges = await getEdges(projectKey, sourceId, executionId);
      const deduped = deduplicateEdges(edges);
      const removed = edges.length - deduped.length;

      if (removed > 0) {
        await putEdges(projectKey, sourceId, deduped, executionId);
        duplicatesRemoved += removed;
        // [FORGE-OPS-007] Rate limit between writes
        await rateLimitDelay();
      }

      edgesProcessed += edges.length;
      nodesProcessed++;
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      errors.push(msg);
      logStructured('error', 'compactStorage', executionId, { sourceId, error: msg });
    }
  }

  logStructured('info', 'compactStorage', executionId, {
    projectKey,
    nodesProcessed,
    edgesProcessed,
    duplicatesRemoved,
    errorCount: errors.length,
  });

  return {
    operation: 'compactStorage',
    executionId,
    durationMs: Date.now() - startTime,
    nodesProcessed,
    edgesProcessed,
    orphansRemoved: duplicatesRemoved,
    staleUpdated: 0,
    errors,
  };
}

/**
 * Generate a health report for a project's relationship graph.
 * Uses GraphStats from storage plus optional caller-provided counts.
 * Applies healthy/degraded/critical thresholds per spec. [AC-06]
 *
 * AC ref: AC-06 of .reqs.md
 * REGLA: FORGE-OPS-0104 — best-effort metrics even if stats unavailable
 */
export async function generateHealthReport(
  projectKey: string,
  executionId: string,
  healthData?: {
    readonly orphanedNodeCount?: number;
    readonly staleEdgeCount?: number;
    readonly maxEdgesPerNode?: number;
  },
): Promise<GraphHealthReport> {
  const stats = await getStats(projectKey, executionId);
  const now = new Date();

  const lastMaintenance = stats.lastUpdated !== '' ? new Date(stats.lastUpdated) : new Date(0);
  const daysSinceMaintenance = (now.getTime() - lastMaintenance.getTime()) / (1000 * 60 * 60 * 24);

  const totalNodes = stats.totalNodes;
  const totalEdges = stats.totalEdges;

  const orphanedNodes = healthData?.orphanedNodeCount ?? 0;
  const staleEdges = healthData?.staleEdgeCount ?? 0;

  const avgEdgesPerNode = totalNodes > 0 ? totalEdges / totalNodes : 0;
  const maxEdgesPerNode =
    healthData?.maxEdgesPerNode ?? (totalNodes > 0 ? Math.ceil(totalEdges / totalNodes) : 0);

  // Storage keys: 1 stats + N nodes + N edges + T topics + N neighborhoods
  const storageKeysUsed = 1 + totalNodes * 3 + stats.topicCount;

  const status = computeHealthStatus({
    orphanedRatio: totalNodes > 0 ? orphanedNodes / totalNodes : 0,
    staleEdgeRatio: totalEdges > 0 ? staleEdges / totalEdges : 0,
    maxEdgesPerNode,
    daysSinceMaintenance,
  });

  logStructured('info', 'generateHealthReport', executionId, {
    projectKey,
    status,
    totalNodes,
    totalEdges,
  });

  return {
    projectKey,
    totalNodes,
    totalEdges,
    orphanedNodes,
    staleEdges,
    avgEdgesPerNode,
    maxEdgesPerNode,
    storageKeysUsed,
    lastMaintenanceAt: stats.lastUpdated,
    status,
  };
}
