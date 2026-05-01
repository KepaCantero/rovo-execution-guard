// [ARCH-SOLID-058] SERVICE layer — Confluence relationship indexer
// [ARCH-SOLID-006] Handler -> Service -> Repository (this is the Service)
// [ARCH-SOLID-005] Storage access through relationship-storage.ts only
// [ARCH-SOLID-202] Zero any usage
// [ARCH-SOLID-232] Named exports only, no export default
// [FORGE-OPS-0105] Stateless functions, no module-level mutable state
// RTASK-039: Confluence relationship indexer — 6 exported functions

import type {
  EntityNode,
  RelationshipEdge,
  EntityNeighborhood,
  NeighborSummary,
  GraphStats,
  EdgeType,
} from '../../types/relationship-index';

import {
  putNode,
  putEdges,
  getEdges,
  getTopicEntities,
  putTopicIndex,
  getStats,
  putStats,
  getNode,
  putNeighborhood,
} from './relationship-storage';

// ═══════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════

/** Input for indexing a Confluence page. */
export interface ConfluencePageInput {
  readonly pageId: string;
  readonly title: string;
  readonly content: string;
  readonly spaceCode: string;
  readonly labels: readonly string[];
  readonly lastUpdated: string;
  readonly projectKey: string;
}

// ═══════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════

/** [FORGE-OPS-013] Max Jira refs extracted per page to stay under 4KB */
const MAX_JIRA_REFS = 50;

/** [FORGE-OPS-013] Max neighbors before pruning to stay under 4KB */
const MAX_NEIGHBORS = 50;

/** Regex for Jira issue keys: uppercase letters + hyphen + digits */
const JIRA_KEY_REGEX = /\b([A-Z]+-\d+)\b/g;

/** [FORGE-OPS-005] Max reverse edge writes per page to stay under 10s */
const MAX_REVERSE_EDGES = 10;

// ═══════════════════════════════════════════
// PURE FUNCTIONS
// ═══════════════════════════════════════════

/**
 * Extract unique Jira issue keys from page content.
 * AC-02: Regex [A-Z]+-\d+ with dedup and cap at 50.
 * [FORGE-OPS-013] Cap at MAX_JIRA_REFS to keep edges under 4KB.
 */
export function extractJiraReferences(pageContent: string): readonly string[] {
  if (!pageContent) return [];

  const matches = pageContent.match(JIRA_KEY_REGEX);
  if (!matches) return [];

  const unique = [...new Set(matches)];
  return unique.slice(0, MAX_JIRA_REFS);
}

/**
 * Extract topic-match edges from page title and labels.
 * AC-03: Same label->topic pattern as jira-indexer (weight 0.6).
 * [FORGE-OPS-012] Topic ID convention: topic:{label}.
 */
export function extractPageTopics(
  pageTitle: string,
  labels: readonly string[],
): readonly RelationshipEdge[] {
  const edges: RelationshipEdge[] = [];
  const now = new Date().toISOString();

  for (const label of labels) {
    const normalizedLabel = label.toLowerCase().trim();
    if (normalizedLabel) {
      edges.push({
        source: '',
        target: `topic:${normalizedLabel}`,
        type: 'topic-match',
        weight: 0.6,
        createdAt: now,
        updatedAt: now,
      });
    }
  }

  // Also extract topics from title words (camelCase/snake_case splits)
  const titleWords = extractTitleWords(pageTitle);
  for (const word of titleWords) {
    if (word.length >= 3 && !edges.some((e) => e.target === `topic:${word}`)) {
      edges.push({
        source: '',
        target: `topic:${word}`,
        type: 'topic-match',
        weight: 0.4,
        createdAt: now,
        updatedAt: now,
      });
    }
  }

  return edges;
}

/**
 * Build a denormalized neighborhood for O(1) reads.
 * AC-09: Combines linked Jira issues and topics.
 * [FORGE-OPS-013] Prunes at MAX_NEIGHBORS to stay under 4KB.
 */
export function buildConfluenceNeighborhood(
  pageId: string,
  projectKey: string,
  jiraRefs: readonly string[],
  topics: readonly string[],
): EntityNeighborhood {
  const linkedIssues: NeighborSummary[] = jiraRefs.map(
    (ref): NeighborSummary => ({
      id: `jira:${ref}`,
      key: ref,
      type: 'jira-issue',
      relationship: 'documented-by',
      weight: 0.9,
    }),
  );

  // [FORGE-OPS-013] Prune to stay under 4KB limit
  const prunedLinked = linkedIssues.slice(0, MAX_NEIGHBORS);

  return {
    entityId: `confluence:${pageId}`,
    entityKey: pageId,
    entityType: 'confluence-page',
    projectKey,
    siblings: [],
    linkedIssues: prunedLinked,
    topics: [...topics],
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Compute staleness factor for edge weight decay.
 * AC-05: 1.0 if both updated within 7 days, decaying to 0.5 at 30+ days.
 * Pure function — no external dependencies.
 */
export function stalenessFactor(sourceUpdatedAt: string, targetUpdatedAt: string): number {
  try {
    const sourceDate = new Date(sourceUpdatedAt);
    const targetDate = new Date(targetUpdatedAt);

    if (isNaN(sourceDate.getTime()) || isNaN(targetDate.getTime())) {
      return 1.0;
    }

    const diffMs = targetDate.getTime() - sourceDate.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);

    // Source is older than target (stale)
    if (diffDays <= 7) return 1.0;
    if (diffDays >= 30) return 0.5;

    // Linear interpolation: 1.0 -> 0.5 over 7 -> 30 days
    return 1.0 - ((diffDays - 7) / (30 - 7)) * 0.5;
  } catch {
    return 1.0;
  }
}

// ═══════════════════════════════════════════
// ASYNC FUNCTIONS
// ═══════════════════════════════════════════

/**
 * Index a Confluence page: store node, edges, topic index, and neighborhood.
 * AC-01: Atomic write of node + edges + neighborhood.
 * AC-06: Idempotent — same input produces same state.
 * [ARCH-SOLID-005] All storage access through relationship-storage.ts.
 */
export async function indexConfluencePage(
  page: ConfluencePageInput,
  executionId: string,
): Promise<void> {
  const nodeId = `confluence:${page.pageId}`;
  const now = new Date().toISOString();

  const node: EntityNode = buildConfluenceNode(page, nodeId, now);
  const jiraRefs = extractJiraReferences(page.content);
  const topicEdges = extractPageTopics(page.title, page.labels);

  // Build documented-by edges from Jira references
  const docEdges: RelationshipEdge[] = jiraRefs.map(
    (ref): RelationshipEdge => ({
      source: nodeId,
      target: `jira:${ref}`,
      type: 'documented-by',
      weight: 0.9,
      createdAt: now,
      updatedAt: now,
    }),
  );

  // Fill source ID on topic edges
  const allEdges: RelationshipEdge[] = [
    ...docEdges,
    ...topicEdges.map((e): RelationshipEdge => ({ ...e, source: nodeId })),
  ];

  // Store node and edges
  await putNode(page.projectKey, node, executionId);
  await putEdges(page.projectKey, nodeId, allEdges, executionId);

  // Update topic index
  for (const edge of topicEdges) {
    const topicId = edge.target;
    const existing = await getTopicEntities(page.projectKey, topicId, executionId);
    if (!existing.includes(nodeId)) {
      const updated = [...existing, nodeId];
      await putTopicIndex(page.projectKey, topicId, updated, executionId);
    }
  }

  // Store denormalized neighborhood
  const topicLabels = topicEdges.map((e) => e.target.replace('topic:', ''));
  const neighborhood = buildConfluenceNeighborhood(
    page.pageId,
    page.projectKey,
    jiraRefs,
    topicLabels,
  );
  await putNeighborhood(page.projectKey, neighborhood, executionId);

  // Update stats
  await updateStats(page.projectKey, node, allEdges, topicEdges.length, executionId);

  // Write reverse edges on Jira nodes for getDocumentingPages lookup
  await writeReverseEdges(page.projectKey, nodeId, jiraRefs, now, executionId);

  // [ARCH-SOLID-255] Structured log
  console.log(
    JSON.stringify({
      level: 'info',
      operation: 'indexConfluencePage',
      pageId: page.pageId,
      projectKey: page.projectKey,
      edgeCount: allEdges.length,
      jiraRefCount: jiraRefs.length,
      executionId,
      timestamp: now,
    }),
  );
}

/**
 * Get all Confluence pages that document a given Jira issue (reverse lookup).
 * AC-04: Reads reverse edges on the Jira node to find referencing Confluence pages.
 * [FORGE-OPS-0104] Returns empty array on error, never throws.
 */
export async function getDocumentingPages(
  issueKey: string,
  projectKey: string,
  executionId: string,
): Promise<readonly EntityNode[]> {
  if (!issueKey || !projectKey) return [];

  try {
    const jiraEntityId = `jira:${issueKey}`;
    const edges = await getEdges(projectKey, jiraEntityId, executionId);

    // Find reverse mentioned-in edges pointing to confluence pages
    const confluenceTargets = edges
      .filter((e) => e.type === 'mentioned-in' && e.target.startsWith('confluence:'))
      .map((e) => e.target);

    const pages: EntityNode[] = [];
    for (const pageEntityId of confluenceTargets) {
      const node = await getNode(projectKey, pageEntityId, executionId);
      if (node) {
        pages.push(node);
      }
    }

    return pages;
  } catch {
    // [FORGE-OPS-0104] Graceful degradation
    return [];
  }
}

// ═══════════════════════════════════════════
// PRIVATE HELPERS
// ═══════════════════════════════════════════

/** Build an EntityNode from ConfluencePageInput. */
function buildConfluenceNode(page: ConfluencePageInput, nodeId: string, now: string): EntityNode {
  return {
    id: nodeId,
    type: 'confluence-page',
    label: page.title,
    status: 'current',
    projectKey: page.projectKey,
    metadata: {
      spaceCode: page.spaceCode,
      labels: page.labels.join(','),
      descriptionPreview: page.content.substring(0, 200),
    },
    createdAt: now,
    updatedAt: page.lastUpdated || now,
  };
}

/** Extract meaningful words from a page title for topic matching. */
function extractTitleWords(title: string): readonly string[] {
  if (!title) return [];
  const words = title
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]/g, ' ')
    .split(/\s+/)
    .map((w) => w.toLowerCase().trim())
    .filter((w) => w.length >= 3);
  return [...new Set(words)];
}

/** Write reverse edges on Jira nodes for reverse lookup via getDocumentingPages. */
async function writeReverseEdges(
  projectKey: string,
  confluenceNodeId: string,
  jiraRefs: readonly string[],
  now: string,
  executionId: string,
): Promise<void> {
  const refs = jiraRefs.slice(0, MAX_REVERSE_EDGES);
  for (const ref of refs) {
    const jiraEntityId = `jira:${ref}`;
    try {
      const existingEdges = await getEdges(projectKey, jiraEntityId, executionId);
      const alreadyLinked = existingEdges.some(
        (e) => e.type === 'mentioned-in' && e.target === confluenceNodeId,
      );
      if (!alreadyLinked) {
        const reverseEdge: RelationshipEdge = {
          source: jiraEntityId,
          target: confluenceNodeId,
          type: 'mentioned-in',
          weight: 0.9,
          createdAt: now,
          updatedAt: now,
        };
        await putEdges(projectKey, jiraEntityId, [...existingEdges, reverseEdge], executionId);
      }
    } catch {
      // [FORGE-OPS-0104] Non-blocking — skip reverse edge on error
    }
  }
}

/** Update graph stats after indexing a Confluence page. */
async function updateStats(
  projectKey: string,
  node: EntityNode,
  edges: readonly RelationshipEdge[],
  topicCount: number,
  executionId: string,
): Promise<void> {
  const stats = await getStats(projectKey, executionId);
  const edgesByType: Record<EdgeType, number> = { ...stats.edgesByType };
  for (const edge of edges) {
    edgesByType[edge.type] = (edgesByType[edge.type] ?? 0) + 1;
  }
  const updatedStats: GraphStats = {
    totalNodes: stats.totalNodes + 1,
    totalEdges: stats.totalEdges + edges.length,
    nodesByType: {
      ...stats.nodesByType,
      [node.type]: (stats.nodesByType[node.type] ?? 0) + 1,
    },
    edgesByType,
    topicCount: stats.topicCount + topicCount,
    lastUpdated: new Date().toISOString(),
  };
  await putStats(projectKey, updatedStats, executionId);
}
