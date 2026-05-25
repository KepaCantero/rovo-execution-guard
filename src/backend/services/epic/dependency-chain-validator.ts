// [ARCH-SOLID-058] Dependency Chain Validator — zero framework dependencies
// [ARCH-SOLID-049-01] SRP: dependency chain traversal, cycle detection, upstream resolution
// [ARCH-SOLID-202] Zero any usage
// [ARCH-SOLID-232] Named exports only, no default export

import type { JiraTicketData, JiraIssueLink } from '../../types/jira-data';
import type { Severity } from '../../types/inconsistency';
import type {
  DependencyChainResult,
  DependencyNode,
  DependencyEdge,
  DependencyLinkType,
  CircularDependency,
} from '../../types/epic-types';
import { getTicketData } from '../jira/jira-adapter';

// ═══════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════

const MAX_TRAVERSAL_DEPTH = 3;
const MAX_CONCURRENT_FETCHES = 5;
const MAX_LINKS_PER_HOP = 10;

// ═══════════════════════════════════════════
// STRUCTURED LOGGING
// ═══════════════════════════════════════════

interface StructuredLogEntry {
  readonly timestamp: string;
  readonly level: 'info' | 'warn' | 'error';
  readonly operation: string;
  readonly executionId?: string;
  readonly [key: string]: unknown;
}

const log = (
  level: StructuredLogEntry['level'],
  operation: string,
  executionId?: string,
  data?: Record<string, unknown>,
): void => {
  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify({ timestamp: new Date().toISOString(), level, operation, executionId, ...data }),
  );
};

// ═══════════════════════════════════════════
// NODE MAPPING
// ═══════════════════════════════════════════

const DONE_STATUSES = new Set(['DONE', 'CLOSED', 'RESOLVED']);

const toDependencyNode = (ticket: JiraTicketData): DependencyNode => ({
  ticketKey: ticket.key,
  summary: ticket.summary,
  status: ticket.status,
  epicKey: ticket.epicKey,
  resolved: DONE_STATUSES.has(ticket.status.toUpperCase()),
});

// ═══════════════════════════════════════════
// LINK TYPE CLASSIFICATION
// ═══════════════════════════════════════════

type EdgeDirection = 'upstream' | 'downstream';

const classifyEdgeDirection = (
  linkType: string,
  direction: 'inward' | 'outward',
): EdgeDirection => {
  const normalized = linkType.toLowerCase();

  if (normalized.includes('blocks')) {
    // "blocks" outward = this ticket blocks another (downstream)
    // "blocks" inward = another ticket blocks this one (upstream)
    return direction === 'outward' ? 'downstream' : 'upstream';
  }

  if (normalized.includes('depend')) {
    // "depends on" is always upstream from the perspective of this ticket
    return 'upstream';
  }

  // Default: treat inward links as upstream, outward as downstream
  return direction === 'inward' ? 'upstream' : 'downstream';
};

const toDependencyLinkType = (rawType: string): DependencyLinkType => {
  const normalized = rawType.toLowerCase();
  if (normalized.includes('blocks') && !normalized.includes('blocked')) return 'blocks';
  if (normalized.includes('blocked')) return 'is blocked by';
  if (normalized.includes('depends')) return 'depends on';
  if (normalized.includes('implements')) return 'implements';
  return 'relates to';
};

// ═══════════════════════════════════════════
// BATCH FETCH
// ═══════════════════════════════════════════

export const batchFetchLinkedTickets = async (
  links: readonly JiraIssueLink[],
  executionId: string,
): Promise<readonly DependencyNode[]> => {
  const cappedLinks = links.slice(0, MAX_LINKS_PER_HOP);
  const results: DependencyNode[] = [];

  for (let i = 0; i < cappedLinks.length; i += MAX_CONCURRENT_FETCHES) {
    const batch = cappedLinks.slice(i, i + MAX_CONCURRENT_FETCHES);
    const settled = await Promise.allSettled(
      batch.map((link) => getTicketData(link.targetKey, executionId)),
    );

    for (const outcome of settled) {
      if (outcome.status === 'fulfilled') {
        results.push(toDependencyNode(outcome.value));
      } else {
        log('warn', 'batchFetchLinkedTickets', executionId, {
          note: 'skipped failed ticket fetch',
          error: outcome.reason instanceof Error ? outcome.reason.message : String(outcome.reason),
        });
      }
    }
  }

  return results;
};

// ═══════════════════════════════════════════
// DEPENDENCY GRAPH BUILDER
// ═══════════════════════════════════════════

const createEdgeFromLink = (link: JiraIssueLink, ticketKey: string): DependencyEdge => {
  const edgeDirection = classifyEdgeDirection(link.type, link.direction);
  const linkType = toDependencyLinkType(link.type);

  if (edgeDirection === 'upstream') {
    return {
      source: link.targetKey,
      target: ticketKey,
      linkType,
      direction: 'upstream',
    };
  }
  return {
    source: ticketKey,
    target: link.targetKey,
    linkType,
    direction: 'downstream',
  };
};

const mergeChildGraph = (
  childGraph: {
    readonly nodes: readonly DependencyNode[];
    readonly edges: readonly DependencyEdge[];
  },
  allNodes: DependencyNode[],
  allEdges: DependencyEdge[],
  visited: Set<string>,
): void => {
  for (const childNode of childGraph.nodes) {
    if (!visited.has(childNode.ticketKey)) {
      visited.add(childNode.ticketKey);
      allNodes.push(childNode);
    }
  }

  for (const childEdge of childGraph.edges) {
    const isDuplicate = allEdges.some(
      (existing) =>
        existing.source === childEdge.source &&
        existing.target === childEdge.target &&
        existing.linkType === childEdge.linkType,
    );
    if (!isDuplicate) {
      allEdges.push(childEdge);
    }
  }
};

const expandLinkedNodes = async (
  linkedNodes: readonly DependencyNode[],
  executionId: string,
  depth: number,
  allNodes: DependencyNode[],
  allEdges: DependencyEdge[],
  visited: Set<string>,
): Promise<void> => {
  for (const node of linkedNodes) {
    if (visited.has(node.ticketKey)) continue;
    visited.add(node.ticketKey);
    allNodes.push(node);

    if (depth + 1 >= MAX_TRAVERSAL_DEPTH) continue;

    try {
      const childTicket = await getTicketData(node.ticketKey, executionId);
      const childGraph = await buildDependencyGraph(childTicket, executionId, depth + 1);
      mergeChildGraph(childGraph, allNodes, allEdges, visited);
    } catch (error: unknown) {
      log('warn', 'expandLinkedNodes', executionId, {
        ticketKey: node.ticketKey,
        depth: depth + 1,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
};

export const buildDependencyGraph = async (
  ticket: JiraTicketData,
  executionId: string,
  depth: number = 0,
): Promise<{
  readonly nodes: readonly DependencyNode[];
  readonly edges: readonly DependencyEdge[];
}> => {
  const allNodes: DependencyNode[] = [toDependencyNode(ticket)];
  const allEdges: DependencyEdge[] = [];
  const visited = new Set<string>([ticket.key]);

  const links = ticket.issueLinks ?? [];
  if (links.length === 0 || depth >= MAX_TRAVERSAL_DEPTH) {
    log('info', 'buildDependencyGraph', executionId, {
      ticketKey: ticket.key,
      depth,
      note: depth >= MAX_TRAVERSAL_DEPTH ? 'max depth reached' : 'no links',
    });
    return { nodes: allNodes, edges: allEdges };
  }

  const cappedLinks = links.slice(0, MAX_LINKS_PER_HOP);
  const linkedNodes = await batchFetchLinkedTickets(cappedLinks, executionId);

  for (const link of cappedLinks) {
    allEdges.push(createEdgeFromLink(link, ticket.key));
  }

  await expandLinkedNodes(linkedNodes, executionId, depth, allNodes, allEdges, visited);

  log('info', 'buildDependencyGraph', executionId, {
    ticketKey: ticket.key,
    depth,
    nodeCount: allNodes.length,
    edgeCount: allEdges.length,
  });

  return { nodes: allNodes, edges: allEdges };
};

// ═══════════════════════════════════════════
// CIRCULAR DEPENDENCY DETECTION (DFS coloring)
// ═══════════════════════════════════════════

type NodeColor = 'white' | 'gray' | 'black';

export const detectCircularDependencies = (
  nodes: readonly DependencyNode[],
  edges: readonly DependencyEdge[],
): readonly CircularDependency[] => {
  if (nodes.length === 0 || edges.length === 0) return [];

  const adjacency = new Map<string, string[]>();
  for (const node of nodes) {
    adjacency.set(node.ticketKey, []);
  }
  for (const edge of edges) {
    const neighbors = adjacency.get(edge.source);
    if (neighbors) {
      neighbors.push(edge.target);
    }
  }

  const color = new Map<string, NodeColor>();
  const parent = new Map<string, string | null>();
  const cycles: CircularDependency[] = [];
  const seenCycles = new Set<string>();

  for (const node of nodes) {
    color.set(node.ticketKey, 'white');
    parent.set(node.ticketKey, null);
  }

  const extractCycle = (startKey: string, endKey: string): readonly string[] => {
    const path: string[] = [endKey];
    let current: string | null = startKey;
    while (current !== null && current !== endKey) {
      path.unshift(current);
      current = parent.get(current) ?? null;
    }
    path.unshift(endKey);
    return path;
  };

  const dfs = (nodeKey: string): void => {
    color.set(nodeKey, 'gray');
    const neighbors = adjacency.get(nodeKey) ?? [];

    for (const neighbor of neighbors) {
      const neighborColor = color.get(neighbor);

      if (neighborColor === 'gray') {
        // Back edge found — cycle detected
        const cycle = extractCycle(nodeKey, neighbor);
        const cycleKey = [...cycle].sort().join('|');

        if (!seenCycles.has(cycleKey)) {
          seenCycles.add(cycleKey);
          const uniqueNodes = new Set(cycle).size;
          const severity: Severity = uniqueNodes <= 2 ? 'critical' : 'warning';
          cycles.push({
            cycle,
            severity,
            description: `Circular dependency detected: ${cycle.join(' -> ')}`,
          });
        }
      } else if (neighborColor === 'white') {
        parent.set(neighbor, nodeKey);
        dfs(neighbor);
      }
    }

    color.set(nodeKey, 'black');
  };

  for (const node of nodes) {
    if (color.get(node.ticketKey) === 'white') {
      dfs(node.ticketKey);
    }
  }

  return cycles;
};

// ═══════════════════════════════════════════
// UPSTREAM RESOLUTION CHECK
// ═══════════════════════════════════════════

export const checkUpstreamResolution = (
  edges: readonly DependencyEdge[],
  nodes: readonly DependencyNode[],
): readonly DependencyNode[] => {
  const nodeMap = new Map<string, DependencyNode>();
  for (const node of nodes) {
    nodeMap.set(node.ticketKey, node);
  }

  const unresolvedKeys = new Set<string>();
  for (const edge of edges) {
    if (edge.direction === 'upstream') {
      const sourceNode = nodeMap.get(edge.source);
      if (sourceNode && !sourceNode.resolved) {
        unresolvedKeys.add(sourceNode.ticketKey);
      }
    }
  }

  return [...unresolvedKeys]
    .map((key) => nodeMap.get(key))
    .filter((node): node is DependencyNode => node !== undefined);
};

// ═══════════════════════════════════════════
// MAIN ORCHESTRATOR
// ═══════════════════════════════════════════

export const validateDependencyChain = async (
  ticketKey: string,
  projectKey: string,
  executionId: string,
): Promise<DependencyChainResult> => {
  const timestamp = new Date().toISOString();

  try {
    const ticket = await getTicketData(ticketKey, executionId);
    const { nodes, edges } = await buildDependencyGraph(ticket, executionId);

    const circularDependencies = detectCircularDependencies(nodes, edges);
    const unresolvedUpstream = checkUpstreamResolution(edges, nodes);

    const canTransition = unresolvedUpstream.length === 0 && circularDependencies.length === 0;

    const blockingReasons: string[] = [];
    if (unresolvedUpstream.length > 0) {
      blockingReasons.push(
        `Unresolved upstream dependencies: ${unresolvedUpstream.map((n) => n.ticketKey).join(', ')}`,
      );
    }
    if (circularDependencies.length > 0) {
      blockingReasons.push(
        `Circular dependencies: ${circularDependencies.map((c) => c.cycle.join('->')).join('; ')}`,
      );
    }

    const upstreamDeps = nodes.filter((n) =>
      edges.some((e) => e.direction === 'upstream' && e.source === n.ticketKey),
    );
    const downstreamDeps = nodes.filter((n) =>
      edges.some((e) => e.direction === 'downstream' && e.target === n.ticketKey),
    );

    log('info', 'validateDependencyChain', executionId, {
      ticketKey,
      projectKey,
      canTransition,
      upstreamCount: upstreamDeps.length,
      downstreamCount: downstreamDeps.length,
      unresolvedCount: unresolvedUpstream.length,
      circularCount: circularDependencies.length,
    });

    return {
      ticketKey,
      upstreamDeps,
      downstreamDeps,
      unresolvedUpstream,
      circularDependencies,
      canTransition,
      blockingReason: blockingReasons.length > 0 ? blockingReasons.join('; ') : undefined,
      executionId,
      timestamp,
    };
  } catch (error: unknown) {
    log('error', 'validateDependencyChain', executionId, {
      ticketKey,
      projectKey,
      error: error instanceof Error ? error.message : String(error),
    });

    return {
      ticketKey,
      upstreamDeps: [],
      downstreamDeps: [],
      unresolvedUpstream: [],
      circularDependencies: [],
      canTransition: true,
      executionId,
      timestamp,
    };
  }
};
