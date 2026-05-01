// [ARCH-SOLID-005] Repository layer — Forge Storage access encapsulated here
// [ARCH-SOLID-006] Handler -> Service -> Repository (this is the Repository)
// [FORGE-OPS-0105] Stateless — getStorage() dynamic require, no module-level mutable state

import type {
  EntityNode,
  RelationshipEdge,
  TopicCluster,
  ContextItem,
  CrossReference,
  RelationshipQuery,
  RelationshipQueryResult,
  RelationshipContext,
  GraphStats,
  EntityType,
  EdgeType,
} from '../../types/relationship-index';

import { StorageError } from '../../types/errors';

// ═══════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════

/** [FORGE-OPS-0105] Forge Storage API shape for dynamic require. */
interface ForgeStorage {
  readonly get: (key: string) => Promise<unknown>;
  readonly set: (key: string, value: unknown) => Promise<void>;
  readonly delete: (key: string) => Promise<void>;
}

// ═══════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════

const MAX_KEY_LENGTH = 500; // [FORGE-OPS-012]
const MAX_VALUE_BYTES = 4096; // [FORGE-OPS-013] 4 KB
const SAFE_EDGE_COUNT = 50; // Rough threshold for 4KB edge arrays
const MAX_TRAVERSAL_DEPTH = 2; // [FORGE-OPS-001]

const ENTITY_TYPE_TOOL_MAP: Readonly<
  Record<EntityType, 'jira' | 'confluence' | 'github' | 'none'>
> = {
  'jira-issue': 'jira',
  'jira-epic': 'jira',
  'confluence-page': 'confluence',
  'github-pr': 'github',
  topic: 'none',
};

const DEFAULT_STATS: GraphStats = {
  totalNodes: 0,
  totalEdges: 0,
  nodesByType: {
    'jira-issue': 0,
    'jira-epic': 0,
    'confluence-page': 0,
    'github-pr': 0,
    topic: 0,
  },
  edgesByType: {
    'parent-of': 0,
    'related-to': 0,
    'documented-by': 0,
    implements: 0,
    'topic-match': 0,
    'mentioned-in': 0,
  },
  topicCount: 0,
  lastUpdated: '',
};

// ═══════════════════════════════════════════
// PRIVATE HELPERS
// ═══════════════════════════════════════════

/** [FORGE-OPS-0105] Dynamic require of @forge/api for test-mockability. */
const getStorage = (): ForgeStorage => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const forgeApi = require('@forge/api') as { storage: ForgeStorage };
  return forgeApi.storage;
};

/** Build a storage key and validate length. [FORGE-OPS-012] */
function buildKey(
  prefix: string,
  projectKey: string,
  suffix: string,
  executionId?: string,
): string {
  const key = `${prefix}:${projectKey}:${suffix}`;
  if (key.length > MAX_KEY_LENGTH) {
    throw new StorageError(
      `Storage key exceeds ${MAX_KEY_LENGTH} chars: ${key.length}`,
      'STORAGE_KEY_TOO_LONG',
      executionId,
      key,
    );
  }
  return key;
}

/** [ARCH-SOLID-255] Structured JSON log. */
function logStructured(
  level: 'info' | 'warn' | 'error',
  operation: string,
  executionId: string | undefined,
  details: Readonly<Record<string, unknown>>,
): void {
  console.log(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      level,
      operation,
      executionId: executionId ?? '',
      ...details,
    }),
  );
}

/** Check if a value size exceeds the 4KB limit. [FORGE-OPS-013] */
function checkValueSize(value: unknown, key: string, executionId?: string): void {
  const serialized = JSON.stringify(value);
  const byteLength = new TextEncoder().encode(serialized).length;
  if (byteLength > MAX_VALUE_BYTES) {
    logStructured('warn', 'valueSizeCheck', executionId, {
      key,
      byteLength,
      maxBytes: MAX_VALUE_BYTES,
      message: 'Value exceeds 4KB limit — may be rejected by Forge Storage',
    });
  }
}

/** [FORGE-OPS-0102] Retry with exponential backoff + jitter. */
async function withRetry<T>(
  operation: () => Promise<T>,
  operationName: string,
  executionId?: string,
  maxRetries = 3,
): Promise<T> {
  let lastError: Error | undefined;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error: unknown) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt < maxRetries) {
        const baseDelay = 100; // [FORGE-OPS-0102] 100ms base
        const maxDelay = 1000;
        const delay = Math.min(baseDelay * Math.pow(2, attempt) + Math.random() * 100, maxDelay);
        logStructured('warn', operationName, executionId, {
          attempt: attempt + 1,
          maxRetries,
          delayMs: Math.round(delay),
          error: lastError.message,
        });
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }
  throw lastError ?? new Error('Retry exhausted');
}

/** Type guard for EntityNode. [ARCH-SOLID-202] Zero any. */
function isEntityNode(value: unknown): value is EntityNode {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj['id'] === 'string' &&
    typeof obj['type'] === 'string' &&
    typeof obj['label'] === 'string' &&
    typeof obj['status'] === 'string' &&
    typeof obj['projectKey'] === 'string'
  );
}

/** Type guard for RelationshipEdge array. [ARCH-SOLID-202] */
function isRelationshipEdgeArray(value: unknown): value is RelationshipEdge[] {
  if (!Array.isArray(value)) return false;
  return value.every(
    (item) =>
      typeof item === 'object' &&
      item !== null &&
      typeof (item as Record<string, unknown>)['source'] === 'string' &&
      typeof (item as Record<string, unknown>)['target'] === 'string' &&
      typeof (item as Record<string, unknown>)['type'] === 'string',
  );
}

/** Type guard for string array. */
function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

/** Type guard for GraphStats. */
function isGraphStats(value: unknown): value is GraphStats {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  return typeof obj['totalNodes'] === 'number' && typeof obj['totalEdges'] === 'number';
}

/** Edge filter for query. */
function edgeMatchesFilter(
  edge: RelationshipEdge,
  edgeTypes: readonly EdgeType[] | undefined,
  minWeight: number | undefined,
): boolean {
  if (edgeTypes !== undefined && edgeTypes.length > 0 && !edgeTypes.includes(edge.type)) {
    return false;
  }
  if (minWeight !== undefined && edge.weight < minWeight) {
    return false;
  }
  return true;
}

// ═══════════════════════════════════════════
// CORE CRUD
// ═══════════════════════════════════════════

/** Retrieve a single entity node. Returns null if not found or on error. [FORGE-OPS-054] */
export async function getNode(
  projectKey: string,
  entityId: string,
  executionId?: string,
): Promise<EntityNode | null> {
  try {
    const storage = getStorage();
    const key = buildKey('node', projectKey, entityId, executionId);
    const raw = await storage.get(key);

    if (raw === undefined || raw === null) {
      logStructured('info', 'getNode', executionId, { key, result: 'not_found' });
      return null;
    }

    if (!isEntityNode(raw)) {
      logStructured('warn', 'getNode', executionId, { key, result: 'invalid_data' });
      return null;
    }

    logStructured('info', 'getNode', executionId, { key, result: 'found' });
    return raw;
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    logStructured('error', 'getNode', executionId, { error: msg });
    return null;
  }
}

/** Store or update an entity node. [FORGE-OPS-0102] Retry on write. */
export async function putNode(
  projectKey: string,
  node: EntityNode,
  executionId?: string,
): Promise<void> {
  try {
    const storage = getStorage();
    const key = buildKey('node', projectKey, node.id, executionId);

    await withRetry(async () => storage.set(key, node), 'putNode', executionId);
    logStructured('info', 'putNode', executionId, { key, nodeId: node.id });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    logStructured('error', 'putNode', executionId, { error: msg, nodeId: node.id });
  }
}

/** Delete an entity node. */
export async function deleteNode(
  projectKey: string,
  entityId: string,
  executionId?: string,
): Promise<void> {
  try {
    const storage = getStorage();
    const key = buildKey('node', projectKey, entityId, executionId);

    await withRetry(async () => storage.delete(key), 'deleteNode', executionId);
    logStructured('info', 'deleteNode', executionId, { key });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    logStructured('error', 'deleteNode', executionId, { error: msg });
  }
}

/** Retrieve edges for a source entity. Returns empty array if not found. */
export async function getEdges(
  projectKey: string,
  sourceId: string,
  executionId?: string,
): Promise<readonly RelationshipEdge[]> {
  try {
    const storage = getStorage();
    const key = buildKey('edges', projectKey, sourceId, executionId);
    const raw = await storage.get(key);

    if (raw === undefined || raw === null) {
      return [];
    }

    if (!isRelationshipEdgeArray(raw)) {
      logStructured('warn', 'getEdges', executionId, { key, result: 'invalid_data' });
      return [];
    }

    return raw;
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    logStructured('error', 'getEdges', executionId, { error: msg });
    return [];
  }
}

/** Store edges for a source entity (replaces existing). [FORGE-OPS-013] Size check. */
export async function putEdges(
  projectKey: string,
  sourceId: string,
  edges: readonly RelationshipEdge[],
  executionId?: string,
): Promise<void> {
  try {
    const storage = getStorage();
    const key = buildKey('edges', projectKey, sourceId, executionId);

    if (edges.length > SAFE_EDGE_COUNT) {
      logStructured('warn', 'putEdges', executionId, {
        key,
        edgeCount: edges.length,
        safeThreshold: SAFE_EDGE_COUNT,
        message: 'Edge count exceeds safe threshold — value may exceed 4KB',
      });
    }

    checkValueSize(edges, key, executionId);
    await withRetry(async () => storage.set(key, edges), 'putEdges', executionId);
    logStructured('info', 'putEdges', executionId, { key, edgeCount: edges.length });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    logStructured('error', 'putEdges', executionId, { error: msg });
  }
}

/** Delete edges for a source entity. */
export async function deleteEdges(
  projectKey: string,
  sourceId: string,
  executionId?: string,
): Promise<void> {
  try {
    const storage = getStorage();
    const key = buildKey('edges', projectKey, sourceId, executionId);

    await withRetry(async () => storage.delete(key), 'deleteEdges', executionId);
    logStructured('info', 'deleteEdges', executionId, { key });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    logStructured('error', 'deleteEdges', executionId, { error: msg });
  }
}

/** Retrieve entity IDs for a topic. Returns empty array if not found. */
export async function getTopicEntities(
  projectKey: string,
  topicId: string,
  executionId?: string,
): Promise<readonly string[]> {
  try {
    const storage = getStorage();
    const key = buildKey('topic-index', projectKey, topicId, executionId);
    const raw = await storage.get(key);

    if (raw === undefined || raw === null) {
      return [];
    }

    if (!isStringArray(raw)) {
      logStructured('warn', 'getTopicEntities', executionId, { key, result: 'invalid_data' });
      return [];
    }

    return raw;
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    logStructured('error', 'getTopicEntities', executionId, { error: msg });
    return [];
  }
}

/** Store topic-to-entity mapping. [FORGE-OPS-013] Size check. */
export async function putTopicIndex(
  projectKey: string,
  topicId: string,
  entityIds: readonly string[],
  executionId?: string,
): Promise<void> {
  try {
    const storage = getStorage();
    const key = buildKey('topic-index', projectKey, topicId, executionId);

    checkValueSize(entityIds, key, executionId);
    await withRetry(async () => storage.set(key, entityIds), 'putTopicIndex', executionId);
    logStructured('info', 'putTopicIndex', executionId, { key, entityCount: entityIds.length });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    logStructured('error', 'putTopicIndex', executionId, { error: msg });
  }
}

/** Retrieve index stats. Returns default if not found. */
export async function getStats(projectKey: string, executionId?: string): Promise<GraphStats> {
  try {
    const storage = getStorage();
    const key = `stats:${projectKey}`;
    const raw = await storage.get(key);

    if (raw === undefined || raw === null) {
      return { ...DEFAULT_STATS };
    }

    if (!isGraphStats(raw)) {
      logStructured('warn', 'getStats', executionId, { key, result: 'invalid_data' });
      return { ...DEFAULT_STATS };
    }

    return raw;
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    logStructured('error', 'getStats', executionId, { error: msg });
    return { ...DEFAULT_STATS };
  }
}

/** Store index statistics. */
export async function putStats(
  projectKey: string,
  stats: GraphStats,
  executionId?: string,
): Promise<void> {
  try {
    const storage = getStorage();
    const key = `stats:${projectKey}`;

    await withRetry(async () => storage.set(key, stats), 'putStats', executionId);
    logStructured('info', 'putStats', executionId, { key });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    logStructured('error', 'putStats', executionId, { error: msg });
  }
}

// ═══════════════════════════════════════════
// QUERY HELPERS
// ═══════════════════════════════════════════

/** Process edges from a single frontier node, returning discovered targets. */
async function processFrontierNode(
  projectKey: string,
  sourceId: string,
  edgeTypes: readonly EdgeType[] | undefined,
  minWeight: number | undefined,
  visited: Set<string>,
  nodeMap: Map<string, EntityNode>,
  allEdges: RelationshipEdge[],
  executionId?: string,
): Promise<string[]> {
  const edges = await getEdges(projectKey, sourceId, executionId);
  const discovered: string[] = [];

  for (const edge of edges) {
    if (!edgeMatchesFilter(edge, edgeTypes, minWeight)) {
      continue;
    }
    allEdges.push(edge);

    if (!visited.has(edge.target)) {
      visited.add(edge.target);
      discovered.push(edge.target);
      const targetNode = await getNode(projectKey, edge.target, executionId);
      if (targetNode) {
        nodeMap.set(edge.target, targetNode);
      }
    }
  }
  return discovered;
}

/** Categorize edges into siblings, docs, PRs. */
function categorizeEdges(
  edges: readonly RelationshipEdge[],
  nodeMap: Map<string, EntityNode>,
  seedType: EntityType | undefined,
): {
  readonly siblings: EntityNode[];
  readonly documentation: EntityNode[];
  readonly pullRequests: EntityNode[];
} {
  const siblings: EntityNode[] = [];
  const documentation: EntityNode[] = [];
  const pullRequests: EntityNode[] = [];

  for (const edge of edges) {
    const targetNode = nodeMap.get(edge.target);
    if (!targetNode) continue;

    if ((edge.type === 'parent-of' || edge.type === 'related-to') && targetNode.type === seedType) {
      siblings.push(targetNode);
    }
    if (edge.type === 'documented-by') {
      documentation.push(targetNode);
    }
    if (edge.type === 'implements') {
      pullRequests.push(targetNode);
    }
  }

  return { siblings, documentation, pullRequests };
}

/** Build cross-references from edges. */
function buildCrossRefs(
  edges: readonly RelationshipEdge[],
  nodeMap: Map<string, EntityNode>,
): CrossReference[] {
  const crossReferences: CrossReference[] = [];

  for (const edge of edges) {
    const sourceNode = nodeMap.get(edge.source);
    const targetNode = nodeMap.get(edge.target);
    if (!sourceNode || !targetNode) continue;

    const sourceTool = ENTITY_TYPE_TOOL_MAP[sourceNode.type];
    const targetTool = ENTITY_TYPE_TOOL_MAP[targetNode.type];

    if (sourceTool !== 'none' && targetTool !== 'none' && sourceTool !== targetTool) {
      const referenceType =
        edge.type === 'documented-by'
          ? 'link'
          : edge.type === 'topic-match'
            ? 'keyword'
            : 'structural';
      crossReferences.push({
        source: edge.source,
        target: edge.target,
        sourceTool,
        targetTool,
        referenceType,
        confidence: edge.weight,
      });
    }
  }

  return crossReferences;
}

/** Build ranked items from edges, sorted by relevance. */
function buildRankedItems(
  edges: readonly RelationshipEdge[],
  nodeMap: Map<string, EntityNode>,
): ContextItem[] {
  return edges
    .map((edge) => {
      const targetNode = nodeMap.get(edge.target);
      if (!targetNode) return null;
      return {
        node: targetNode,
        relevanceScore: edge.weight,
        matchReason: `${edge.type}: ${edge.target}`,
      };
    })
    .filter((item): item is ContextItem => item !== null)
    .sort((a, b) => b.relevanceScore - a.relevanceScore);
}

/** Derive topic clusters from topic-match edges. */
function deriveTopics(
  edges: readonly RelationshipEdge[],
  nodeMap: Map<string, EntityNode>,
  entityId: string,
  projectKey: string,
): TopicCluster[] {
  const topics: TopicCluster[] = [];
  const topicEdges = edges.filter((e) => e.type === 'topic-match');
  const topicIds = new Set(topicEdges.map((e) => e.target));

  for (const topicId of topicIds) {
    const topicNode = nodeMap.get(topicId);
    if (topicNode) {
      topics.push({
        id: topicId,
        label: topicNode.label,
        keywords: [],
        entityIds: [entityId],
        projectKeys: [projectKey],
        strength: 0.5,
      });
    }
  }
  return topics;
}

// ═══════════════════════════════════════════
// QUERY OPERATIONS
// ═══════════════════════════════════════════

/**
 * Traverse the relationship graph up to 2 hops. [FORGE-OPS-059] Uses Map/Set.
 * [FORGE-OPS-0101] Bounded BFS with early termination.
 */
export async function queryRelationships(
  query: RelationshipQuery,
  executionId?: string,
): Promise<RelationshipQueryResult> {
  const emptyResult = (eid: string): RelationshipQueryResult => ({
    nodes: [],
    edges: [],
    query,
    executionId: eid,
  });

  try {
    const { projectKey, entityId, maxDepth = MAX_TRAVERSAL_DEPTH, edgeTypes, minWeight } = query;
    const execId = executionId ?? '';

    if (!entityId) {
      return emptyResult(execId);
    }

    const seedNode = await getNode(projectKey, entityId, executionId);
    if (!seedNode) {
      return emptyResult(execId);
    }

    const nodeMap = new Map<string, EntityNode>();
    const visited = new Set<string>();
    nodeMap.set(entityId, seedNode);
    visited.add(entityId);

    const allEdges: RelationshipEdge[] = [];
    let frontier = [entityId];

    for (let depth = 0; depth < maxDepth && frontier.length > 0; depth++) {
      const nextFrontier: string[] = [];
      for (const sourceId of frontier) {
        const discovered = await processFrontierNode(
          projectKey,
          sourceId,
          edgeTypes,
          minWeight,
          visited,
          nodeMap,
          allEdges,
          executionId,
        );
        nextFrontier.push(...discovered);
      }
      frontier = nextFrontier;
    }

    logStructured('info', 'queryRelationships', executionId, {
      nodeCount: nodeMap.size,
      edgeCount: allEdges.length,
      maxDepth,
    });

    return { nodes: [...nodeMap.values()], edges: allEdges, query, executionId: execId };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    logStructured('error', 'queryRelationships', executionId, { error: msg });
    return emptyResult(executionId ?? '');
  }
}

/**
 * Assemble complete relationship context for an entity. [AC-06]
 * Uses queryRelationships internally, then categorizes nodes.
 */
export async function buildRelationshipContext(
  projectKey: string,
  entityId: string,
  executionId?: string,
): Promise<RelationshipContext> {
  const emptyContext = (): RelationshipContext => ({
    siblings: [],
    documentation: [],
    pullRequests: [],
    topics: [],
    crossReferences: [],
    rankedItems: [],
    assembledAt: new Date().toISOString(),
  });

  try {
    const result = await queryRelationships(
      { projectKey, entityId, maxDepth: MAX_TRAVERSAL_DEPTH },
      executionId,
    );

    if (result.nodes.length === 0) {
      return emptyContext();
    }

    const nodeMap = new Map<string, EntityNode>();
    for (const node of result.nodes) {
      nodeMap.set(node.id, node);
    }

    const seedNode = result.nodes.find((n) => n.id === entityId);
    const { siblings, documentation, pullRequests } = categorizeEdges(
      result.edges,
      nodeMap,
      seedNode?.type,
    );
    const crossReferences = buildCrossRefs(result.edges, nodeMap);
    const rankedItems = buildRankedItems(result.edges, nodeMap);
    const topics = deriveTopics(result.edges, nodeMap, entityId, projectKey);

    logStructured('info', 'buildRelationshipContext', executionId, {
      entityId,
      siblingCount: siblings.length,
      docCount: documentation.length,
      prCount: pullRequests.length,
      crossRefCount: crossReferences.length,
    });

    return {
      siblings,
      documentation,
      pullRequests,
      topics,
      crossReferences,
      rankedItems,
      assembledAt: new Date().toISOString(),
    };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    logStructured('error', 'buildRelationshipContext', executionId, { error: msg });
    return emptyContext();
  }
}

// ═══════════════════════════════════════════
// BULK OPERATIONS
// ═══════════════════════════════════════════

/**
 * Store multiple nodes sequentially. [FORGE-OPS-007] ≤10 writes/s.
 * Sequential writes with small delay for rate limiting.
 */
export async function bulkPutNodes(
  projectKey: string,
  nodes: readonly EntityNode[],
  executionId?: string,
): Promise<void> {
  if (nodes.length === 0) return;

  try {
    for (const node of nodes) {
      await putNode(projectKey, node, executionId);
      // [FORGE-OPS-007] Rate limit: small delay between writes
      if (nodes.length > 1) {
        await new Promise((resolve) => setTimeout(resolve, 110)); // ~9 writes/s
      }
    }
    logStructured('info', 'bulkPutNodes', executionId, { nodeCount: nodes.length });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    logStructured('error', 'bulkPutNodes', executionId, { error: msg });
  }
}

/**
 * Store multiple edges, grouped by source ID. [FORGE-OPS-007] ≤10 writes/s.
 */
export async function bulkPutEdges(
  projectKey: string,
  edges: readonly RelationshipEdge[],
  executionId?: string,
): Promise<void> {
  if (edges.length === 0) return;

  try {
    // Group edges by source [FORGE-OPS-007]
    const grouped = new Map<string, RelationshipEdge[]>();
    for (const edge of edges) {
      const existing = grouped.get(edge.source);
      if (existing) {
        existing.push(edge);
      } else {
        grouped.set(edge.source, [edge]);
      }
    }

    const entries = [...grouped.entries()];
    for (const [sourceId, sourceEdges] of entries) {
      await putEdges(projectKey, sourceId, sourceEdges, executionId);
      // [FORGE-OPS-007] Rate limit between groups
      if (entries.length > 1) {
        await new Promise((resolve) => setTimeout(resolve, 110));
      }
    }
    logStructured('info', 'bulkPutEdges', executionId, {
      totalEdges: edges.length,
      sourceGroups: grouped.size,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    logStructured('error', 'bulkPutEdges', executionId, { error: msg });
  }
}
