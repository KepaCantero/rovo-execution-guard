// [ARCH-SOLID-058] SERVICE layer — GitHub PR relationship indexer
// [ARCH-SOLID-006] Handler -> Service -> Repository (this is the Service)
// [ARCH-SOLID-005] Storage access through relationship-storage.ts only
// [ARCH-SOLID-202] Zero any usage
// [ARCH-SOLID-232] Named exports only, no export default
// [FORGE-OPS-0105] Stateless functions, no module-level mutable state
// RTASK-040: GitHub PR relationship indexer — 4 exported functions

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

/** Input for indexing a GitHub PR. */
export interface PRIndexInput {
  readonly prNumber: number;
  /** Repository in `owner/repo` format */
  readonly repo: string;
  readonly title: string;
  readonly body: string;
  readonly branch: string;
  readonly baseBranch: string;
  readonly state: 'open' | 'closed' | 'merged';
  readonly labels: readonly string[];
  readonly url: string;
  readonly fileCount: number;
  readonly additions: number;
  readonly deletions: number;
  readonly author: string;
}

// ═══════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════

/** [FORGE-OPS-013] Max implements edges per PR to stay under 4KB */
const MAX_IMPLEMENTS = 10;

/** [FORGE-OPS-013] Max neighbors before pruning to stay under 4KB */
const MAX_NEIGHBORS = 50;

/** [FORGE-OPS-005] Max reverse edge writes per PR to stay under 10s */
const MAX_REVERSE_EDGES = 10;

/** Regex for Jira issue keys: uppercase letters + hyphen + digits */
const JIRA_KEY_REGEX = /\b([A-Z]+-\d+)\b/g;

/** Regex for branch name Jira keys: supports PROJ-123, PROJ_123, proj123 */
const BRANCH_KEY_REGEX = /(?:^|[/\-_])([A-Za-z]+[-_]\d+)(?:[/\-_]|$)/g;

// ═══════════════════════════════════════════
// PURE FUNCTIONS
// ═══════════════════════════════════════════

/** Collect unique keys into a capped array. Returns true when cap reached. */
function collectUniqueKey(key: string, seen: Set<string>, keys: string[]): boolean {
  if (seen.has(key)) return false;
  seen.add(key);
  keys.push(key);
  return keys.length >= MAX_IMPLEMENTS;
}

/** Normalize a branch match fragment to a standard Jira key format. */
function normalizeBranchMatch(match: string): string | null {
  const cleaned = match
    .replace(/^[/\-_]/, '')
    .replace(/[/\-_]$/, '')
    .toUpperCase()
    .replace('_', '-');
  return /^[A-Z]+-\d+$/.test(cleaned) ? cleaned : null;
}

/** Extract Jira keys from text content (title + body). */
function extractTextKeys(text: string, seen: Set<string>, keys: string[]): boolean {
  const matches = text.match(JIRA_KEY_REGEX);
  if (!matches) return false;
  for (const match of matches) {
    if (collectUniqueKey(match, seen, keys)) return true;
  }
  return false;
}

/** Extract Jira keys from branch name patterns. */
function extractBranchKeys(branch: string, seen: Set<string>, keys: string[]): boolean {
  const matches = branch.match(BRANCH_KEY_REGEX);
  if (!matches) return false;
  for (const match of matches) {
    const normalized = normalizeBranchMatch(match);
    if (normalized && collectUniqueKey(normalized, seen, keys)) return true;
  }
  return false;
}

/**
 * Extract unique Jira issue keys from PR title, body, and branch name.
 * AC-02: Regex match with dedup and cap at 10.
 * [FORGE-OPS-013] Cap at MAX_IMPLEMENTS to keep edges under 4KB.
 */
export function extractJiraKeysFromPR(
  prTitle: string,
  prBody: string,
  branchName: string,
): readonly string[] {
  const seen = new Set<string>();
  const keys: string[] = [];

  const textContent = `${prTitle ?? ''} ${prBody ?? ''}`;
  if (extractTextKeys(textContent, seen, keys)) return keys;
  if (branchName) extractBranchKeys(branchName, seen, keys);

  return keys;
}

/**
 * Extract topic-match edges from PR labels.
 * AC-03: Same label->topic pattern as jira-indexer (weight 0.6).
 * [FORGE-OPS-012] Topic ID convention: topic:{label}.
 */
export function extractPRTopics(labels: readonly string[]): readonly RelationshipEdge[] {
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

  return edges;
}

/**
 * Build a denormalized neighborhood for O(1) reads.
 * Combines linked Jira issues and topics.
 * [FORGE-OPS-013] Prunes at MAX_NEIGHBORS to stay under 4KB.
 */
export function buildPRNeighborhood(
  pr: PRIndexInput,
  projectKey: string,
  jiraKeys: readonly string[],
  topics: readonly string[],
): EntityNeighborhood {
  const nodeId = `github:${pr.repo}/pull/${pr.prNumber}`;

  const linkedIssues: NeighborSummary[] = jiraKeys.map(
    (key): NeighborSummary => ({
      id: `jira:${key}`,
      key,
      type: 'jira-issue',
      relationship: 'implements',
      weight: 0.9,
    }),
  );

  const prunedLinked = linkedIssues.slice(0, MAX_NEIGHBORS);

  return {
    entityId: nodeId,
    entityKey: `${pr.repo}/pull/${pr.prNumber}`,
    entityType: 'github-pr',
    projectKey,
    siblings: [],
    linkedIssues: prunedLinked,
    topics: [...topics],
    updatedAt: new Date().toISOString(),
  };
}

// ═══════════════════════════════════════════
// ASYNC FUNCTIONS
// ═══════════════════════════════════════════

/**
 * Index a GitHub PR: store node, edges, topic index, and neighborhood.
 * AC-01: Atomic write of node + edges + neighborhood.
 * AC-05: Idempotent — same input produces same state.
 * [ARCH-SOLID-005] All storage access through relationship-storage.ts.
 * [FORGE-OPS-0104] Graceful degradation — errors are logged, not thrown.
 */
export async function indexPullRequest(
  pr: PRIndexInput,
  projectKey: string,
  executionId: string,
): Promise<void> {
  const nodeId = `github:${pr.repo}/pull/${pr.prNumber}`;
  const now = new Date().toISOString();

  const node = buildPRNode(pr, nodeId, now);
  const jiraKeys = extractJiraKeysFromPR(pr.title, pr.body, pr.branch);
  const topicEdges = extractPRTopics(pr.labels);

  // Build implements edges from Jira keys
  const implementsEdges: RelationshipEdge[] = jiraKeys.map(
    (key): RelationshipEdge => ({
      source: nodeId,
      target: `jira:${key}`,
      type: 'implements',
      weight: 0.9,
      createdAt: now,
      updatedAt: now,
    }),
  );

  // Fill source ID on topic edges
  const allEdges: RelationshipEdge[] = [
    ...implementsEdges,
    ...topicEdges.map((e): RelationshipEdge => ({ ...e, source: nodeId })),
  ];

  // Store node and edges
  await putNode(projectKey, node, executionId);
  await putEdges(projectKey, nodeId, allEdges, executionId);

  // Update topic index
  for (const edge of topicEdges) {
    const topicId = edge.target;
    const existing = await getTopicEntities(projectKey, topicId, executionId);
    if (!existing.includes(nodeId)) {
      const updated = [...existing, nodeId];
      await putTopicIndex(projectKey, topicId, updated, executionId);
    }
  }

  // Store denormalized neighborhood
  const topicLabels = topicEdges.map((e) => e.target.replace('topic:', ''));
  const neighborhood = buildPRNeighborhood(pr, projectKey, jiraKeys, topicLabels);
  await putNeighborhood(projectKey, neighborhood, executionId);

  // Update stats
  await updateStats(projectKey, node, allEdges, topicEdges.length, executionId);

  // Write reverse edges on Jira nodes for getImplementingPRs lookup
  await writeReverseEdges(projectKey, nodeId, jiraKeys, now, executionId);

  console.log(
    JSON.stringify({
      level: 'info',
      operation: 'indexPullRequest',
      prNumber: pr.prNumber,
      repo: pr.repo,
      projectKey,
      edgeCount: allEdges.length,
      jiraKeyCount: jiraKeys.length,
      executionId,
      timestamp: now,
    }),
  );
}

/**
 * Get all PRs that implement a given Jira issue (reverse lookup).
 * AC-04: Reads reverse edges on the Jira node to find referencing PR nodes.
 * [FORGE-OPS-0104] Returns empty array on error, never throws.
 */
export async function getImplementingPRs(
  issueKey: string,
  projectKey: string,
  executionId: string,
): Promise<readonly EntityNode[]> {
  if (!issueKey || !projectKey) return [];

  try {
    const jiraEntityId = `jira:${issueKey}`;
    const edges = await getEdges(projectKey, jiraEntityId, executionId);

    const prTargets = edges
      .filter((e) => e.type === 'implements' && e.target.startsWith('github:'))
      .map((e) => e.target);

    const prs: EntityNode[] = [];
    for (const prEntityId of prTargets) {
      const node = await getNode(projectKey, prEntityId, executionId);
      if (node) {
        prs.push(node);
      }
    }

    return prs;
  } catch {
    return [];
  }
}

// ═══════════════════════════════════════════
// PRIVATE HELPERS
// ═══════════════════════════════════════════

/** Build an EntityNode from PRIndexInput. */
function buildPRNode(pr: PRIndexInput, nodeId: string, now: string): EntityNode {
  return {
    id: nodeId,
    type: 'github-pr',
    label: pr.title,
    status: pr.state,
    projectKey: '',
    metadata: {
      repo: pr.repo,
      branch: pr.branch,
      baseBranch: pr.baseBranch,
      fileCount: String(pr.fileCount),
      additions: String(pr.additions),
      deletions: String(pr.deletions),
      author: pr.author,
      descriptionPreview: (pr.body ?? '').substring(0, 200),
    },
    createdAt: now,
    updatedAt: now,
  };
}

/** Write reverse edges on Jira nodes for reverse lookup via getImplementingPRs. */
async function writeReverseEdges(
  projectKey: string,
  prNodeId: string,
  jiraKeys: readonly string[],
  now: string,
  executionId: string,
): Promise<void> {
  const keys = jiraKeys.slice(0, MAX_REVERSE_EDGES);
  for (const key of keys) {
    const jiraEntityId = `jira:${key}`;
    try {
      const existingEdges = await getEdges(projectKey, jiraEntityId, executionId);
      const alreadyLinked = existingEdges.some(
        (e) => e.type === 'implements' && e.target === prNodeId,
      );
      if (!alreadyLinked) {
        const reverseEdge: RelationshipEdge = {
          source: jiraEntityId,
          target: prNodeId,
          type: 'implements',
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

/** Update graph stats after indexing a PR. */
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
