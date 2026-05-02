// [ARCH-SOLID-006] Service layer — uses Repository (relationship-storage) for all storage access
// [FORGE-OPS-0105] Stateless — no module-level mutable state
// [ARCH-SOLID-202] Zero any usage

import type { EntityNode } from '../../types/relationship-index';

import { getNode, getEdges, deleteEdges } from './relationship-storage';

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
