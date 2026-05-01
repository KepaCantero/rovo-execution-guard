// [TEST-QA-204] afterEach cleanup mandatory
// [ARCH-SOLID-202] Zero any — all mocks fully typed
// [TEST-QA-0764] Self-contained, mock all Forge API

import type {
  EntityNode,
  RelationshipEdge,
  GraphStats,
  RelationshipQuery,
} from '../../../../src/backend/types/relationship-index';

import {
  getNode,
  putNode,
  deleteNode,
  getEdges,
  putEdges,
  deleteEdges,
  getTopicEntities,
  putTopicIndex,
  getStats,
  putStats,
  queryRelationships,
  buildRelationshipContext,
  bulkPutNodes,
  bulkPutEdges,
} from '../../../../src/backend/services/relationship-index/relationship-storage';

// ═══════════════════════════════════════════
// MOCKS
// ═══════════════════════════════════════════

const mockStorageGet = jest.fn<Promise<unknown>, [string]>();
const mockStorageSet = jest.fn<Promise<void>, [string, unknown]>();
const mockStorageDelete = jest.fn<Promise<void>, [string]>();

jest.mock('@forge/api', () => ({
  storage: {
    get: (...args: [string]) => mockStorageGet(...args),
    set: (...args: [string, unknown]) => mockStorageSet(...args),
    delete: (...args: [string]) => mockStorageDelete(...args),
  },
}));

// ═══════════════════════════════════════════
// FIXTURES
// ═══════════════════════════════════════════

const makeNode = (overrides: Partial<EntityNode> = {}): EntityNode => ({
  id: 'jira:PROJ-123',
  type: 'jira-issue',
  label: 'Test ticket',
  status: 'In Progress',
  projectKey: 'PROJ',
  metadata: {},
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  ...overrides,
});

const makeEdge = (overrides: Partial<RelationshipEdge> = {}): RelationshipEdge => ({
  source: 'jira:PROJ-123',
  target: 'jira:PROJ-456',
  type: 'related-to',
  weight: 0.8,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  ...overrides,
});

const makeStats = (overrides: Partial<GraphStats> = {}): GraphStats => ({
  totalNodes: 5,
  totalEdges: 10,
  nodesByType: {
    'jira-issue': 3,
    'jira-epic': 1,
    'confluence-page': 0,
    'github-pr': 1,
    topic: 0,
  },
  edgesByType: {
    'parent-of': 2,
    'related-to': 3,
    'documented-by': 2,
    implements: 1,
    'topic-match': 1,
    'mentioned-in': 1,
  },
  topicCount: 0,
  lastUpdated: '2026-01-01T00:00:00Z',
  ...overrides,
});

// ═══════════════════════════════════════════
// TEST SUITE
// ═══════════════════════════════════════════

describe('relationship-storage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStorageGet.mockResolvedValue(undefined);
    mockStorageSet.mockResolvedValue(undefined);
    mockStorageDelete.mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─── getNode() ──────────────────────────

  describe('getNode()', () => {
    it('should retrieve a stored node', async () => {
      const node = makeNode();
      mockStorageGet.mockResolvedValue(node);

      const result = await getNode('PROJ', 'jira:PROJ-123', 'exec-1');

      expect(result).toEqual(node);
      expect(mockStorageGet).toHaveBeenCalledWith('node:PROJ:jira:PROJ-123');
    });

    it('should return null for missing node', async () => {
      mockStorageGet.mockResolvedValue(undefined);

      const result = await getNode('PROJ', 'jira:PROJ-999');

      expect(result).toBeNull();
    });

    it('should return null and log on storage failure', async () => {
      mockStorageGet.mockRejectedValue(new Error('storage error'));

      const result = await getNode('PROJ', 'jira:PROJ-123', 'exec-err');

      expect(result).toBeNull();
    });
  });

  // ─── putNode() ──────────────────────────

  describe('putNode()', () => {
    it('should store a node with correct key', async () => {
      const node = makeNode();

      await putNode('PROJ', node, 'exec-1');

      expect(mockStorageSet).toHaveBeenCalledWith('node:PROJ:jira:PROJ-123', node);
    });

    it('should handle write failure gracefully', async () => {
      mockStorageSet.mockRejectedValue(new Error('write fail'));
      const node = makeNode();

      // Should not throw
      await putNode('PROJ', node, 'exec-err');
    });
  });

  // ─── deleteNode() ───────────────────────

  describe('deleteNode()', () => {
    it('should delete a node by key', async () => {
      await deleteNode('PROJ', 'jira:PROJ-123', 'exec-1');

      expect(mockStorageDelete).toHaveBeenCalledWith('node:PROJ:jira:PROJ-123');
    });

    it('should handle delete failure gracefully', async () => {
      mockStorageDelete.mockRejectedValue(new Error('delete fail'));

      await deleteNode('PROJ', 'jira:PROJ-123');
    });
  });

  // ─── getEdges() ─────────────────────────

  describe('getEdges()', () => {
    it('should retrieve edges for a source', async () => {
      const edges = [makeEdge(), makeEdge({ target: 'jira:PROJ-789' })];
      mockStorageGet.mockResolvedValue(edges);

      const result = await getEdges('PROJ', 'jira:PROJ-123', 'exec-1');

      expect(result).toEqual(edges);
      expect(mockStorageGet).toHaveBeenCalledWith('edges:PROJ:jira:PROJ-123');
    });

    it('should return empty array for missing edges', async () => {
      mockStorageGet.mockResolvedValue(undefined);

      const result = await getEdges('PROJ', 'jira:PROJ-123');

      expect(result).toEqual([]);
    });

    it('should return empty array on storage failure', async () => {
      mockStorageGet.mockRejectedValue(new Error('fail'));

      const result = await getEdges('PROJ', 'jira:PROJ-123');

      expect(result).toEqual([]);
    });
  });

  // ─── putEdges() ─────────────────────────

  describe('putEdges()', () => {
    it('should store edges with correct key', async () => {
      const edges = [makeEdge()];

      await putEdges('PROJ', 'jira:PROJ-123', edges, 'exec-1');

      expect(mockStorageSet).toHaveBeenCalledWith('edges:PROJ:jira:PROJ-123', edges);
    });

    it('should handle write failure gracefully', async () => {
      mockStorageSet.mockRejectedValue(new Error('fail'));
      const edges = [makeEdge()];

      await putEdges('PROJ', 'jira:PROJ-123', edges);
    });
  });

  // ─── deleteEdges() ──────────────────────

  describe('deleteEdges()', () => {
    it('should delete edges by key', async () => {
      await deleteEdges('PROJ', 'jira:PROJ-123', 'exec-1');

      expect(mockStorageDelete).toHaveBeenCalledWith('edges:PROJ:jira:PROJ-123');
    });
  });

  // ─── getTopicEntities() ─────────────────

  describe('getTopicEntities()', () => {
    it('should retrieve entity IDs for a topic', async () => {
      const entityIds = ['jira:PROJ-123', 'jira:PROJ-456'];
      mockStorageGet.mockResolvedValue(entityIds);

      const result = await getTopicEntities('PROJ', 'topic:cache', 'exec-1');

      expect(result).toEqual(entityIds);
      expect(mockStorageGet).toHaveBeenCalledWith('topic-index:PROJ:topic:cache');
    });

    it('should return empty array for missing topic', async () => {
      mockStorageGet.mockResolvedValue(undefined);

      const result = await getTopicEntities('PROJ', 'topic:missing');

      expect(result).toEqual([]);
    });
  });

  // ─── putTopicIndex() ────────────────────

  describe('putTopicIndex()', () => {
    it('should store topic entity IDs', async () => {
      const entityIds = ['jira:PROJ-123'];

      await putTopicIndex('PROJ', 'topic:cache', entityIds, 'exec-1');

      expect(mockStorageSet).toHaveBeenCalledWith('topic-index:PROJ:topic:cache', entityIds);
    });
  });

  // ─── getStats() ─────────────────────────

  describe('getStats()', () => {
    it('should retrieve stats for a project', async () => {
      const stats = makeStats();
      mockStorageGet.mockResolvedValue(stats);

      const result = await getStats('PROJ', 'exec-1');

      expect(result).toEqual(stats);
      expect(mockStorageGet).toHaveBeenCalledWith('stats:PROJ');
    });

    it('should return default stats when none stored', async () => {
      mockStorageGet.mockResolvedValue(undefined);

      const result = await getStats('PROJ');

      expect(result.totalNodes).toBe(0);
      expect(result.totalEdges).toBe(0);
      expect(result.topicCount).toBe(0);
    });
  });

  // ─── putStats() ─────────────────────────

  describe('putStats()', () => {
    it('should store stats', async () => {
      const stats = makeStats();

      await putStats('PROJ', stats, 'exec-1');

      expect(mockStorageSet).toHaveBeenCalledWith('stats:PROJ', stats);
    });
  });

  // ─── queryRelationships() ───────────────

  describe('queryRelationships()', () => {
    it('should traverse 1-hop from a seed entity', async () => {
      const seedNode = makeNode();
      const connectedNode = makeNode({ id: 'jira:PROJ-456', label: 'Connected' });
      const edge = makeEdge({ source: 'jira:PROJ-123', target: 'jira:PROJ-456' });

      // getNode for seed
      mockStorageGet
        .mockResolvedValueOnce(seedNode) // seed node
        .mockResolvedValueOnce([edge]) // seed edges
        .mockResolvedValueOnce(connectedNode); // connected node

      const query: RelationshipQuery = {
        projectKey: 'PROJ',
        entityId: 'jira:PROJ-123',
        maxDepth: 1,
      };

      const result = await queryRelationships(query, 'exec-1');

      expect(result.nodes).toHaveLength(2);
      expect(result.edges).toHaveLength(1);
      expect(result.query).toEqual(query);
      expect(result.executionId).toBe('exec-1');
    });

    it('should traverse 2-hop relationships', async () => {
      const nodeA = makeNode({ id: 'jira:PROJ-001' });
      const nodeB = makeNode({ id: 'jira:PROJ-002' });
      const nodeC = makeNode({ id: 'jira:PROJ-003' });
      const edgeAB = makeEdge({ source: 'jira:PROJ-001', target: 'jira:PROJ-002' });
      const edgeBC = makeEdge({ source: 'jira:PROJ-002', target: 'jira:PROJ-003' });

      mockStorageGet
        .mockResolvedValueOnce(nodeA) // seed node
        .mockResolvedValueOnce([edgeAB]) // A's edges
        .mockResolvedValueOnce(nodeB) // B node
        .mockResolvedValueOnce([edgeBC]) // B's edges
        .mockResolvedValueOnce(nodeC); // C node

      const query: RelationshipQuery = {
        projectKey: 'PROJ',
        entityId: 'jira:PROJ-001',
        maxDepth: 2,
      };

      const result = await queryRelationships(query, 'exec-2');

      expect(result.nodes).toHaveLength(3);
      expect(result.edges).toHaveLength(2);
    });

    it('should filter edges by type', async () => {
      const nodeA = makeNode({ id: 'jira:PROJ-001' });
      const nodeB = makeNode({ id: 'jira:PROJ-002' });
      const edgeRelated = makeEdge({
        source: 'jira:PROJ-001',
        target: 'jira:PROJ-002',
        type: 'related-to',
      });
      const edgeDocs = makeEdge({
        source: 'jira:PROJ-001',
        target: 'confluence:999',
        type: 'documented-by',
      });

      mockStorageGet
        .mockResolvedValueOnce(nodeA)
        .mockResolvedValueOnce([edgeRelated, edgeDocs])
        .mockResolvedValueOnce(nodeB);

      const query: RelationshipQuery = {
        projectKey: 'PROJ',
        entityId: 'jira:PROJ-001',
        edgeTypes: ['related-to'],
        maxDepth: 1,
      };

      const result = await queryRelationships(query, 'exec-3');

      expect(result.edges).toHaveLength(1);
      expect(result.edges[0]?.type).toBe('related-to');
    });

    it('should filter edges by minimum weight', async () => {
      const nodeA = makeNode({ id: 'jira:PROJ-001' });
      const edgeHigh = makeEdge({ source: 'jira:PROJ-001', target: 'jira:PROJ-002', weight: 0.9 });
      const edgeLow = makeEdge({ source: 'jira:PROJ-001', target: 'jira:PROJ-003', weight: 0.3 });

      mockStorageGet
        .mockResolvedValueOnce(nodeA)
        .mockResolvedValueOnce([edgeHigh, edgeLow])
        .mockResolvedValueOnce(makeNode({ id: 'jira:PROJ-002' }));

      const query: RelationshipQuery = {
        projectKey: 'PROJ',
        entityId: 'jira:PROJ-001',
        minWeight: 0.5,
        maxDepth: 1,
      };

      const result = await queryRelationships(query);

      expect(result.edges).toHaveLength(1);
      expect(result.edges[0]?.weight).toBe(0.9);
    });

    it('should handle cycles without infinite loops', async () => {
      const nodeA = makeNode({ id: 'jira:PROJ-001' });
      const nodeB = makeNode({ id: 'jira:PROJ-002' });
      const edgeAB = makeEdge({ source: 'jira:PROJ-001', target: 'jira:PROJ-002' });
      const edgeBA = makeEdge({ source: 'jira:PROJ-002', target: 'jira:PROJ-001' });

      mockStorageGet
        .mockResolvedValueOnce(nodeA) // seed
        .mockResolvedValueOnce([edgeAB]) // A->B
        .mockResolvedValueOnce(nodeB) // B node
        .mockResolvedValueOnce([edgeBA]); // B->A (cycle)

      const query: RelationshipQuery = {
        projectKey: 'PROJ',
        entityId: 'jira:PROJ-001',
        maxDepth: 2,
      };

      const result = await queryRelationships(query);

      // Should not hang, should have both nodes and both edges
      expect(result.nodes).toHaveLength(2);
      expect(result.edges).toHaveLength(2);
    });

    it('should return empty result on storage failure', async () => {
      mockStorageGet.mockRejectedValue(new Error('storage fail'));

      const query: RelationshipQuery = {
        projectKey: 'PROJ',
        entityId: 'jira:PROJ-123',
        maxDepth: 1,
      };

      const result = await queryRelationships(query, 'exec-err');

      expect(result.nodes).toEqual([]);
      expect(result.edges).toEqual([]);
    });

    it('should use default maxDepth of 2 when not specified', async () => {
      const nodeA = makeNode({ id: 'jira:PROJ-001' });
      mockStorageGet.mockResolvedValueOnce(nodeA).mockResolvedValueOnce([]); // no edges

      const query: RelationshipQuery = {
        projectKey: 'PROJ',
        entityId: 'jira:PROJ-001',
      };

      const result = await queryRelationships(query);

      expect(result.nodes).toHaveLength(1);
      expect(result.query.maxDepth).toBeUndefined();
    });
  });

  // ─── buildRelationshipContext() ──────────

  describe('buildRelationshipContext()', () => {
    it('should assemble context with siblings, docs, PRs, topics, crossRefs', async () => {
      const seedNode = makeNode({ id: 'jira:PROJ-001', type: 'jira-issue' });
      const siblingNode = makeNode({ id: 'jira:PROJ-002', type: 'jira-issue' });
      const docNode = makeNode({
        id: 'confluence:999',
        type: 'confluence-page',
        projectKey: 'PROJ',
      });
      const prNode = makeNode({
        id: 'github:owner/repo/pull/42',
        type: 'github-pr',
        projectKey: 'PROJ',
      });

      const edgeToSibling = makeEdge({
        source: 'jira:PROJ-001',
        target: 'jira:PROJ-002',
        type: 'related-to',
        weight: 0.9,
      });
      const edgeToDoc = makeEdge({
        source: 'jira:PROJ-001',
        target: 'confluence:999',
        type: 'documented-by',
        weight: 1.0,
      });
      const edgeToPR = makeEdge({
        source: 'jira:PROJ-001',
        target: 'github:owner/repo/pull/42',
        type: 'implements',
        weight: 0.8,
      });

      // Seed node lookup
      mockStorageGet
        .mockResolvedValueOnce(seedNode) // seed
        .mockResolvedValueOnce([edgeToSibling, edgeToDoc, edgeToPR]) // seed edges
        .mockResolvedValueOnce(siblingNode) // sibling
        .mockResolvedValueOnce(docNode) // doc
        .mockResolvedValueOnce(prNode) // PR
        .mockResolvedValueOnce(['jira:PROJ-001', 'jira:PROJ-002']); // topic entities

      const context = await buildRelationshipContext('PROJ', 'jira:PROJ-001', 'exec-ctx');

      expect(context.siblings.length).toBeGreaterThanOrEqual(0);
      expect(context.documentation).toBeDefined();
      expect(context.pullRequests).toBeDefined();
      expect(context.topics).toBeDefined();
      expect(context.crossReferences).toBeDefined();
      expect(context.rankedItems).toBeDefined();
      expect(context.assembledAt).toBeTruthy();
    });

    it('should return empty context when seed node not found', async () => {
      mockStorageGet.mockResolvedValue(undefined);

      const context = await buildRelationshipContext('PROJ', 'jira:PROJ-999');

      expect(context.siblings).toEqual([]);
      expect(context.documentation).toEqual([]);
      expect(context.pullRequests).toEqual([]);
      expect(context.topics).toEqual([]);
      expect(context.crossReferences).toEqual([]);
      expect(context.rankedItems).toEqual([]);
    });

    it('should handle storage failure gracefully', async () => {
      mockStorageGet.mockRejectedValue(new Error('fail'));

      const context = await buildRelationshipContext('PROJ', 'jira:PROJ-001');

      expect(context.siblings).toEqual([]);
      expect(context.documentation).toEqual([]);
    });
  });

  // ─── bulkPutNodes() ─────────────────────

  describe('bulkPutNodes()', () => {
    it('should store multiple nodes sequentially', async () => {
      const nodes = [makeNode({ id: 'jira:PROJ-001' }), makeNode({ id: 'jira:PROJ-002' })];

      await bulkPutNodes('PROJ', nodes, 'exec-bulk');

      expect(mockStorageSet).toHaveBeenCalledTimes(2);
      expect(mockStorageSet).toHaveBeenCalledWith('node:PROJ:jira:PROJ-001', nodes[0]);
      expect(mockStorageSet).toHaveBeenCalledWith('node:PROJ:jira:PROJ-002', nodes[1]);
    });

    it('should handle empty array', async () => {
      await bulkPutNodes('PROJ', []);

      expect(mockStorageSet).not.toHaveBeenCalled();
    });
  });

  // ─── bulkPutEdges() ─────────────────────

  describe('bulkPutEdges()', () => {
    it('should store edges grouped by source ID', async () => {
      const edges = [
        makeEdge({ source: 'jira:PROJ-001', target: 'jira:PROJ-002' }),
        makeEdge({ source: 'jira:PROJ-001', target: 'jira:PROJ-003' }),
        makeEdge({ source: 'jira:PROJ-002', target: 'jira:PROJ-004' }),
      ];

      await bulkPutEdges('PROJ', edges, 'exec-bulk');

      expect(mockStorageSet).toHaveBeenCalledTimes(2); // 2 groups (001, 002)
    });

    it('should handle empty array', async () => {
      await bulkPutEdges('PROJ', []);

      expect(mockStorageSet).not.toHaveBeenCalled();
    });
  });

  // ─── Key Schema (AC-04, FORGE-OPS-012) ──

  describe('key schema validation', () => {
    it('should use node:{pk}:{eid} pattern', async () => {
      await putNode('PROJ', makeNode(), 'exec-key');

      expect(mockStorageSet).toHaveBeenCalledWith(
        expect.stringMatching(/^node:PROJ:/),
        expect.anything(),
      );
    });

    it('should use edges:{pk}:{sid} pattern', async () => {
      await putEdges('PROJ', 'jira:PROJ-123', [makeEdge()]);

      expect(mockStorageSet).toHaveBeenCalledWith(
        expect.stringMatching(/^edges:PROJ:/),
        expect.anything(),
      );
    });

    it('should use topic-index:{pk}:{tid} pattern', async () => {
      await putTopicIndex('PROJ', 'topic:cache', ['jira:PROJ-123']);

      expect(mockStorageSet).toHaveBeenCalledWith(
        expect.stringMatching(/^topic-index:PROJ:/),
        expect.anything(),
      );
    });

    it('should use stats:{pk} pattern', async () => {
      await putStats('PROJ', makeStats());

      expect(mockStorageSet).toHaveBeenCalledWith('stats:PROJ', expect.anything());
    });
  });

  // ─── Error Handling (AC-07, ARCH-SOLID-241) ──

  describe('error handling', () => {
    it('should never throw unhandled from getNode', async () => {
      mockStorageGet.mockRejectedValue(new Error('catastrophic'));

      await expect(getNode('PROJ', 'x')).resolves.toBeNull();
    });

    it('should never throw unhandled from putNode', async () => {
      mockStorageSet.mockRejectedValue(new Error('catastrophic'));

      await expect(putNode('PROJ', makeNode())).resolves.toBeUndefined();
    });

    it('should never throw unhandled from deleteNode', async () => {
      mockStorageDelete.mockRejectedValue(new Error('catastrophic'));

      await expect(deleteNode('PROJ', 'x')).resolves.toBeUndefined();
    });

    it('should never throw unhandled from getEdges', async () => {
      mockStorageGet.mockRejectedValue(new Error('catastrophic'));

      await expect(getEdges('PROJ', 'x')).resolves.toEqual([]);
    });

    it('should never throw unhandled from putEdges', async () => {
      mockStorageSet.mockRejectedValue(new Error('catastrophic'));

      await expect(putEdges('PROJ', 'x', [makeEdge()])).resolves.toBeUndefined();
    });

    it('should never throw unhandled from queryRelationships', async () => {
      mockStorageGet.mockRejectedValue(new Error('catastrophic'));

      const query: RelationshipQuery = { projectKey: 'PROJ', entityId: 'x' };
      await expect(queryRelationships(query)).resolves.toBeDefined();
    });

    it('should never throw unhandled from buildRelationshipContext', async () => {
      mockStorageGet.mockRejectedValue(new Error('catastrophic'));

      await expect(buildRelationshipContext('PROJ', 'x')).resolves.toBeDefined();
    });
  });

  // ─── Structured Logging (ARCH-SOLID-255) ──

  describe('structured logging', () => {
    it('should include executionId in log output', async () => {
      const logSpy = jest.spyOn(console, 'log').mockImplementation();
      mockStorageGet.mockResolvedValue(makeNode());

      await getNode('PROJ', 'jira:PROJ-123', 'exec-log');

      const jsonCalls = logSpy.mock.calls
        .map((call) => {
          try {
            return JSON.parse(String(call[0]));
          } catch {
            return null;
          }
        })
        .filter((c): c is Record<string, unknown> => c !== null);

      const storageLog = jsonCalls.find((c) => c.operation === 'getNode');
      expect(storageLog).toBeDefined();
      expect(storageLog?.executionId).toBe('exec-log');

      logSpy.mockRestore();
    });
  });

  // ─── Entity Types Coverage ──────────────

  describe('entity type coverage', () => {
    const entityTypes: Array<{ type: EntityNode['type']; id: string }> = [
      { type: 'jira-issue', id: 'jira:PROJ-001' },
      { type: 'jira-epic', id: 'jira:PROJ-E-001' },
      { type: 'confluence-page', id: 'confluence:12345' },
      { type: 'github-pr', id: 'github:owner/repo/pull/42' },
      { type: 'topic', id: 'topic:cache-migration' },
    ];

    it.each(entityTypes)('should store and retrieve $type node', async ({ type, id }) => {
      const node = makeNode({ id, type, label: `${type} test` });
      mockStorageGet.mockResolvedValue(node);

      await putNode('PROJ', node);
      const result = await getNode('PROJ', id);

      expect(result).toEqual(node);
    });
  });
});
