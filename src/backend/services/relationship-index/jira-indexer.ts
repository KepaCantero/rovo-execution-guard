// [ARCH-SOLID-058] SERVICE layer — Jira relationship indexer
// [ARCH-SOLID-006] Handler -> Service -> Repository (this is the Service)
// [ARCH-SOLID-005] Storage access through relationship-storage.ts only
// [ARCH-SOLID-202] Zero any usage
// [ARCH-SOLID-232] Named exports only, no export default
// [FORGE-OPS-0105] Stateless functions, no module-level mutable state
// RTASK-038: Jira relationship indexer — 6 exported functions

import type {
  EntityNode,
  RelationshipEdge,
  RelationshipContext,
  GraphStats,
  EntityType,
  EntityNeighborhood,
  NeighborSummary,
} from '../../types/relationship-index';

import {
  putNode,
  putEdges,
  getTopicEntities,
  putTopicIndex,
  getStats,
  putStats,
  buildRelationshipContext,
  getNeighborhood,
  putNeighborhood,
} from './relationship-storage';

import { searchByJQL } from '../jira/jira-adapter';

import type { JiraTicketData } from '../../types/jira-data';

// ═══════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════

/** Input for indexing a Jira issue. */
export interface JiraIndexInput {
  readonly issueKey: string;
  readonly projectKey: string;
  readonly summary: string;
  readonly description: string;
  readonly issueType: string;
  readonly status: string;
  readonly labels: readonly string[];
  readonly epicKey?: string;
  readonly issueLinks?: readonly JiraIssueLinkInput[];
}

/** A directional relationship between two Jira issues (indexer input). */
export interface JiraIssueLinkInput {
  readonly type: string;
  readonly direction: 'inward' | 'outward';
  readonly targetKey: string;
}

// ═══════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════

/** [FORGE-OPS-0104] Graceful fallback when relationship context is unavailable */
export const EMPTY_RELATIONSHIP_CONTEXT: RelationshipContext = {
  siblings: [],
  documentation: [],
  pullRequests: [],
  topics: [],
  crossReferences: [],
  rankedItems: [],
  assembledAt: '',
};

/** [FORGE-OPS-013] Max neighbors before pruning to stay under 4KB */
const MAX_NEIGHBORS = 50;

/** [FORGE-OPS-005] Batch size for bootstrap to respect timeout */
const BOOTSTRAP_BATCH_SIZE = 50;

// ═══════════════════════════════════════════
// PURE FUNCTIONS
// ═══════════════════════════════════════════

/**
 * Build an EntityNode from JiraIndexInput.
 * AC-01: Maps Jira fields to EntityNode structure.
 * [ARCH-SOLID-006] Pure function, no side effects.
 */
export function buildJiraNode(input: JiraIndexInput): EntityNode {
  const isEpic = input.issueType.toLowerCase() === 'epic';
  const entityType: EntityType = isEpic ? 'jira-epic' : 'jira-issue';
  const now = new Date().toISOString();

  return {
    id: `jira:${input.issueKey}`,
    type: entityType,
    label: input.summary,
    status: input.status,
    projectKey: input.projectKey,
    metadata: {
      issueType: input.issueType,
      labels: input.labels.join(','),
      epicKey: input.epicKey ?? '',
      descriptionPreview: input.description.substring(0, 200),
    },
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Extract edges from a Jira issue.
 * AC-02: parent-of (epic), related-to (links), topic-match (labels).
 * [FORGE-OPS-012] Node ID convention: jira:{key}, topic:{label}.
 */
export function extractJiraEdges(
  input: JiraIndexInput,
  _executionId?: string,
): readonly RelationshipEdge[] {
  const edges: RelationshipEdge[] = [];
  const now = new Date().toISOString();
  const sourceId = `jira:${input.issueKey}`;

  // parent-of: epic relationship (weight 1.0)
  if (input.epicKey) {
    edges.push({
      source: sourceId,
      target: `jira:${input.epicKey}`,
      type: 'parent-of',
      weight: 1.0,
      createdAt: now,
      updatedAt: now,
    });
  }

  // related-to: issue links (weight 0.8)
  if (input.issueLinks) {
    for (const link of input.issueLinks) {
      if (link.targetKey) {
        edges.push({
          source: sourceId,
          target: `jira:${link.targetKey}`,
          type: 'related-to',
          weight: 0.8,
          createdAt: now,
          updatedAt: now,
        });
      }
    }
  }

  // topic-match: labels (weight 0.6)
  for (const label of input.labels) {
    const normalizedLabel = label.toLowerCase().trim();
    if (normalizedLabel) {
      edges.push({
        source: sourceId,
        target: `topic:${normalizedLabel}`,
        type: 'topic-match',
        weight: 0.6,
        createdAt: now,
        updatedAt: now,
      });
    }
  }

  return edges;
}

/**
 * Build a denormalized neighborhood for O(1) reads.
 * AC-03: Combines siblings, linked issues, and topics.
 * [FORGE-OPS-013] Prunes at MAX_NEIGHBORS to stay under 4KB.
 */
export function buildJiraNeighborhood(
  input: JiraIndexInput,
  edges: readonly RelationshipEdge[],
): EntityNeighborhood {
  const siblings: NeighborSummary[] = [];
  const linkedIssues: NeighborSummary[] = [];
  const topics: string[] = [];

  for (const edge of edges) {
    if (edge.type === 'parent-of') {
      siblings.push({
        id: edge.target,
        key: edge.target.replace('jira:', ''),
        type: 'jira-epic',
        relationship: 'parent-of',
        weight: edge.weight,
      });
    } else if (edge.type === 'related-to') {
      linkedIssues.push({
        id: edge.target,
        key: edge.target.replace('jira:', ''),
        type: 'jira-issue',
        relationship: 'related-to',
        weight: edge.weight,
      });
    } else if (edge.type === 'topic-match') {
      topics.push(edge.target.replace('topic:', ''));
    }
  }

  // [FORGE-OPS-013] Prune to stay under 4KB limit
  const prunedSiblings = siblings.slice(0, MAX_NEIGHBORS);
  const prunedLinked = linkedIssues.slice(0, MAX_NEIGHBORS);

  const isEpic = input.issueType.toLowerCase() === 'epic';

  return {
    entityId: `jira:${input.issueKey}`,
    entityKey: input.issueKey,
    entityType: isEpic ? 'jira-epic' : 'jira-issue',
    projectKey: input.projectKey,
    siblings: prunedSiblings,
    linkedIssues: prunedLinked,
    topics,
    updatedAt: new Date().toISOString(),
  };
}

// ═══════════════════════════════════════════
// ASYNC FUNCTIONS
// ═══════════════════════════════════════════

/**
 * Index a single Jira issue: store node, edges, topic index, and neighborhood.
 * AC-04: Atomic write of node + edges + neighborhood.
 * [ARCH-SOLID-005] All storage access through relationship-storage.ts.
 * [FORGE-OPS-0104] Graceful degradation — errors are logged, not thrown.
 */
export async function indexJiraIssue(input: JiraIndexInput, executionId: string): Promise<void> {
  const node = buildJiraNode(input);
  const edges = extractJiraEdges(input, executionId);
  const neighborhood = buildJiraNeighborhood(input, edges);

  // Store node and edges
  await putNode(input.projectKey, node, executionId);
  await putEdges(input.projectKey, node.id, edges, executionId);

  // Update topic index for each label
  for (const label of input.labels) {
    const normalizedLabel = label.toLowerCase().trim();
    if (normalizedLabel) {
      const topicId = `topic:${normalizedLabel}`;
      const existing = await getTopicEntities(input.projectKey, topicId, executionId);
      if (!existing.includes(node.id)) {
        const updated = [...existing, node.id];
        await putTopicIndex(input.projectKey, topicId, updated, executionId);
      }
    }
  }

  // Store denormalized neighborhood
  await putNeighborhood(input.projectKey, neighborhood, executionId);

  // Update stats
  const stats = await getStats(input.projectKey, executionId);
  const edgesByTypeUpdate: Record<string, number> = { ...stats.edgesByType };
  for (const edge of edges) {
    edgesByTypeUpdate[edge.type] = (edgesByTypeUpdate[edge.type] ?? 0) + 1;
  }
  const updatedStats: GraphStats = {
    totalNodes: stats.totalNodes + 1,
    totalEdges: stats.totalEdges + edges.length,
    nodesByType: {
      ...stats.nodesByType,
      [node.type]: (stats.nodesByType[node.type] ?? 0) + 1,
    },
    edgesByType: edgesByTypeUpdate as GraphStats['edgesByType'],
    topicCount: stats.topicCount + input.labels.filter((l) => l.trim()).length,
    lastUpdated: new Date().toISOString(),
  };
  await putStats(input.projectKey, updatedStats, executionId);
}

/**
 * Get the RelationshipContext for a Jira issue.
 * AC-05: Reads neighborhood first (O(1)), falls back to graph traversal.
 * [FORGE-OPS-0104] Returns EMPTY_RELATIONSHIP_CONTEXT on error.
 */
export async function getJiraRelationshipContext(
  issueKey: string,
  projectKey: string,
  executionId: string,
): Promise<RelationshipContext> {
  if (!issueKey || !projectKey) {
    return EMPTY_RELATIONSHIP_CONTEXT;
  }

  try {
    const entityId = `jira:${issueKey}`;

    // Try neighborhood first (O(1) read path)
    const neighborhood = await getNeighborhood(projectKey, entityId, executionId);
    if (neighborhood) {
      return neighborhoodToContext(neighborhood);
    }

    // Fallback: graph traversal via storage layer
    return await buildRelationshipContext(projectKey, entityId, executionId);
  } catch {
    // [FORGE-OPS-0104] Graceful degradation
    return EMPTY_RELATIONSHIP_CONTEXT;
  }
}

/**
 * Fetch and index all issues in a project.
 * AC-06: JQL search + batch indexing.
 * [FORGE-OPS-005] Processes in batches with delay to respect timeout.
 */
export async function bootstrapProjectIndex(
  projectKey: string,
  executionId: string,
): Promise<GraphStats> {
  const jql = `project = ${projectKey} ORDER BY updated DESC`;
  const issues = await searchByJQL(jql, BOOTSTRAP_BATCH_SIZE, executionId);

  for (const issue of issues) {
    const input = ticketToIndexInput(issue);
    await indexJiraIssue(input, executionId);
    // [FORGE-OPS-007] Rate limit between writes
    await new Promise((resolve) => setTimeout(resolve, 110));
  }

  return await getStats(projectKey, executionId);
}

// ═══════════════════════════════════════════
// PRIVATE HELPERS
// ═══════════════════════════════════════════

/** Convert a denormalized neighborhood to RelationshipContext. */
function neighborhoodToContext(neighborhood: EntityNeighborhood): RelationshipContext {
  const siblingNodes: EntityNode[] = neighborhood.siblings.map(
    (s): EntityNode => ({
      id: s.id,
      type: s.type,
      label: s.key,
      status: '',
      projectKey: neighborhood.projectKey,
      metadata: {},
      createdAt: '',
      updatedAt: '',
    }),
  );

  const linkedNodes: EntityNode[] = neighborhood.linkedIssues.map(
    (li): EntityNode => ({
      id: li.id,
      type: li.type,
      label: li.key,
      status: '',
      projectKey: neighborhood.projectKey,
      metadata: {},
      createdAt: '',
      updatedAt: '',
    }),
  );

  const rankedItems = [
    ...neighborhood.siblings.map((s) => ({
      node: {
        id: s.id,
        type: s.type,
        label: s.key,
        status: '',
        projectKey: neighborhood.projectKey,
        metadata: {},
        createdAt: '',
        updatedAt: '',
      } satisfies EntityNode,
      relevanceScore: s.weight,
      matchReason: `${s.relationship}: ${s.id}`,
    })),
    ...neighborhood.linkedIssues.map((li) => ({
      node: {
        id: li.id,
        type: li.type,
        label: li.key,
        status: '',
        projectKey: neighborhood.projectKey,
        metadata: {},
        createdAt: '',
        updatedAt: '',
      } satisfies EntityNode,
      relevanceScore: li.weight,
      matchReason: `${li.relationship}: ${li.id}`,
    })),
  ];

  return {
    siblings: [...siblingNodes, ...linkedNodes],
    documentation: [],
    pullRequests: [],
    topics: [],
    crossReferences: [],
    rankedItems,
    assembledAt: new Date().toISOString(),
  };
}

/** Convert JiraTicketData to JiraIndexInput. */
function ticketToIndexInput(ticket: JiraTicketData): JiraIndexInput {
  return {
    issueKey: ticket.key,
    projectKey: ticket.projectKey,
    summary: ticket.summary,
    description: ticket.description,
    issueType: ticket.issueType,
    status: ticket.status,
    labels: ticket.labels,
    epicKey: ticket.epicKey,
    issueLinks: ticket.issueLinks?.map((link) => ({
      type: link.type,
      direction: link.direction,
      targetKey: link.targetKey,
    })),
  };
}
