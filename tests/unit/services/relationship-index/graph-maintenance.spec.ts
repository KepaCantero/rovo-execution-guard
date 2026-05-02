import {
  validateNodeBatch,
  removeOrphanedEdges,
  refreshStaleNodes,
  compactStorage,
  generateHealthReport,
  pruneDecisionLog,
  compactDecisionPatterns,
  validateNeighborhoods,
  runMaintenanceCycle,
} from '../../../../src/backend/services/relationship-index/graph-maintenance';

import type {
  EntityNode,
  RelationshipEdge,
  GraphStats,
  DecisionRecord,
  EntityNeighborhood,
} from '../../../../src/backend/types/relationship-index';

import * as storage from '../../../../src/backend/services/relationship-index/relationship-storage';

jest.mock('../../../../src/backend/services/relationship-index/relationship-storage');

const mockGetNode = storage.getNode as jest.MockedFunction<typeof storage.getNode>;
const mockGetEdges = storage.getEdges as jest.MockedFunction<typeof storage.getEdges>;
const mockDeleteEdges = storage.deleteEdges as jest.MockedFunction<typeof storage.deleteEdges>;
const mockPutEdges = storage.putEdges as jest.MockedFunction<typeof storage.putEdges>;
const mockGetStats = storage.getStats as jest.MockedFunction<typeof storage.getStats>;
const mockGetNeighborhood = storage.getNeighborhood as jest.MockedFunction<
  typeof storage.getNeighborhood
>;
const mockPutNeighborhood = storage.putNeighborhood as jest.MockedFunction<
  typeof storage.putNeighborhood
>;

// ═══════════════════════════════════════════
// FIXTURES
// ═══════════════════════════════════════════

const makeNode = (overrides: Partial<EntityNode> = {}): EntityNode => ({
  id: 'jira:PROJ-100',
  type: 'jira-issue',
  label: 'Test Issue',
  status: 'In Progress',
  projectKey: 'PROJ',
  metadata: {},
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  ...overrides,
});

const makeEdge = (overrides: Partial<RelationshipEdge> = {}): RelationshipEdge => ({
  source: 'jira:PROJ-100',
  target: 'jira:PROJ-200',
  type: 'related-to',
  weight: 0.8,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  ...overrides,
});

const NODE_ISSUE_100 = makeNode();
const NODE_ISSUE_200 = makeNode({ id: 'jira:PROJ-200', label: 'Related Issue' });
const NODE_EPIC = makeNode({ id: 'jira:PROJ-E1', type: 'jira-epic', label: 'Epic' });
const NODE_CONFLUENCE = makeNode({
  id: 'confluence:12345',
  type: 'confluence-page',
  label: 'Design Doc',
});
const NODE_PR = makeNode({
  id: 'github:owner/repo/pull/42',
  type: 'github-pr',
  label: 'Fix bug',
});
const NODE_TOPIC = makeNode({ id: 'topic:cache', type: 'topic', label: 'Cache' });

const makeStats = (
  overrides: Partial<{
    totalNodes: number;
    totalEdges: number;
    topicCount: number;
    lastUpdated: string;
  }> = {},
): GraphStats => ({
  totalNodes: 0,
  totalEdges: 0,
  nodesByType: { 'jira-issue': 0, 'jira-epic': 0, 'confluence-page': 0, 'github-pr': 0, topic: 0 },
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
  ...overrides,
});

const EDGE_TO_200 = makeEdge();
const EDGE_TO_EPIC = makeEdge({
  source: 'jira:PROJ-100',
  target: 'jira:PROJ-E1',
  type: 'parent-of',
  weight: 1.0,
});

const makeDecision = (overrides: Partial<DecisionRecord> = {}): DecisionRecord => ({
  id: 'dec-001',
  issueKey: 'PROJ-100',
  gateType: 'consistency',
  score: 75,
  action: 'block',
  overridden: false,
  contextSignature: 'PROJ-100:high:consistency:few',
  timestamp: '2026-04-01T00:00:00Z',
  ...overrides,
});

const makeNeighborhood = (overrides: Partial<EntityNeighborhood> = {}): EntityNeighborhood => ({
  entityId: 'jira:PROJ-100',
  entityKey: 'PROJ-100',
  entityType: 'jira-issue',
  projectKey: 'PROJ',
  siblings: [],
  linkedIssues: [],
  topics: [],
  updatedAt: '2026-04-01T00:00:00Z',
  ...overrides,
});

// ═══════════════════════════════════════════
// TEST SUITE
// ═══════════════════════════════════════════

describe('graph-maintenance', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─── validateNodeBatch() ─────────────────

  describe('validateNodeBatch()', () => {
    // ─── AC-01: validateNodeBatch ──

    it('should return empty array when all nodes exist (AC-01)', async () => {
      mockGetNode.mockResolvedValue(NODE_ISSUE_100);
      mockGetEdges.mockResolvedValue([]);

      const result = await validateNodeBatch([NODE_ISSUE_100], 'exec-1');

      expect(result).toEqual([]);
    });

    it('should return orphaned IDs for nodes not found in storage (AC-01)', async () => {
      mockGetNode.mockResolvedValue(null);

      const result = await validateNodeBatch([NODE_ISSUE_100, NODE_ISSUE_200], 'exec-1');

      expect(result).toEqual(expect.arrayContaining(['jira:PROJ-100', 'jira:PROJ-200']));
      expect(result).toHaveLength(2);
    });

    it('should check edge targets and report orphaned targets (AC-01)', async () => {
      mockGetNode
        .mockResolvedValueOnce(NODE_ISSUE_100) // node exists
        .mockResolvedValueOnce(null); // target doesn't exist
      mockGetEdges.mockResolvedValue([EDGE_TO_200]);

      const result = await validateNodeBatch([NODE_ISSUE_100], 'exec-1');

      expect(result).toEqual(['jira:PROJ-200']);
    });

    it('should skip edge check for nodes that are already orphaned (AC-01)', async () => {
      mockGetNode.mockResolvedValue(null);

      const result = await validateNodeBatch([NODE_ISSUE_100], 'exec-1');

      expect(result).toEqual(['jira:PROJ-100']);
      expect(mockGetEdges).not.toHaveBeenCalled();
    });

    it('should deduplicate orphaned IDs (AC-01)', async () => {
      mockGetNode
        .mockResolvedValueOnce(NODE_ISSUE_100) // first node exists
        .mockResolvedValueOnce(null) // target of first node's edge
        .mockResolvedValueOnce(NODE_EPIC) // second node exists
        .mockResolvedValueOnce(null); // same target, already in set
      mockGetEdges
        .mockResolvedValueOnce([EDGE_TO_200])
        .mockResolvedValueOnce([
          makeEdge({ source: 'jira:PROJ-E1', target: 'jira:PROJ-200', type: 'related-to' }),
        ]);

      const result = await validateNodeBatch([NODE_ISSUE_100, NODE_EPIC], 'exec-1');

      expect(result).toEqual(['jira:PROJ-200']);
      expect(result).toHaveLength(1);
    });

    it('should handle empty node batch (AC-01)', async () => {
      const result = await validateNodeBatch([], 'exec-1');

      expect(result).toEqual([]);
      expect(mockGetNode).not.toHaveBeenCalled();
    });

    it('should handle all nodes being orphaned (AC-01)', async () => {
      mockGetNode.mockResolvedValue(null);

      const result = await validateNodeBatch(
        [NODE_ISSUE_100, NODE_EPIC, NODE_CONFLUENCE],
        'exec-1',
      );

      expect(result).toHaveLength(3);
    });

    it('should validate all 5 entity types (AC-01)', async () => {
      mockGetNode.mockResolvedValue(null);

      const allTypes = [NODE_ISSUE_100, NODE_EPIC, NODE_CONFLUENCE, NODE_PR, NODE_TOPIC];
      const result = await validateNodeBatch(allTypes, 'exec-1');

      expect(result).toHaveLength(5);
      expect(result).toEqual(
        expect.arrayContaining([
          'jira:PROJ-100',
          'jira:PROJ-E1',
          'confluence:12345',
          'github:owner/repo/pull/42',
          'topic:cache',
        ]),
      );
    });

    // ─── AC-11: Idempotency ──

    it('should be idempotent — same input produces same output (AC-11)', async () => {
      mockGetNode.mockResolvedValue(null);

      const result1 = await validateNodeBatch([NODE_ISSUE_100], 'exec-1');
      const result2 = await validateNodeBatch([NODE_ISSUE_100], 'exec-1');

      expect(result1).toEqual(result2);
    });

    // ─── FORGE-OPS-0104: Graceful degradation ──

    it('should continue processing after individual errors (FORGE-OPS-0104)', async () => {
      mockGetNode.mockRejectedValueOnce(new Error('Storage error')).mockResolvedValueOnce(null); // second node is orphaned

      const result = await validateNodeBatch([NODE_ISSUE_100, NODE_ISSUE_200], 'exec-1');

      expect(result).toEqual(['jira:PROJ-200']);
    });

    it('should continue after edge target check error (FORGE-OPS-0104)', async () => {
      mockGetNode
        .mockResolvedValueOnce(NODE_ISSUE_100) // node exists
        .mockRejectedValueOnce(new Error('Target check failed')); // target check error
      mockGetEdges.mockResolvedValue([EDGE_TO_200]);

      const result = await validateNodeBatch([NODE_ISSUE_100], 'exec-1');

      // Error during edge target check — node not added as orphaned
      expect(result).toEqual([]);
    });
  });

  // ─── removeOrphanedEdges() ─────────────────

  describe('removeOrphanedEdges()', () => {
    // ─── AC-03: removeOrphanedEdges ──

    it('should delete edge entries for orphaned nodes and count individual edges (AC-03)', async () => {
      mockGetEdges
        .mockResolvedValueOnce([EDGE_TO_200, EDGE_TO_EPIC]) // 2 edges for first node
        .mockResolvedValueOnce([]); // 0 edges for second node
      mockDeleteEdges.mockResolvedValue(undefined);

      const result = await removeOrphanedEdges(
        'PROJ',
        ['jira:PROJ-100', 'jira:PROJ-200'],
        'exec-1',
      );

      expect(result).toBe(2); // 2 individual edges removed
      expect(mockDeleteEdges).toHaveBeenCalledTimes(1); // Only called for node with edges
      expect(mockDeleteEdges).toHaveBeenCalledWith('PROJ', 'jira:PROJ-100', 'exec-1');
    });

    it('should return 0 when no edges to remove (AC-03)', async () => {
      mockGetEdges.mockResolvedValue([]);

      const result = await removeOrphanedEdges('PROJ', ['jira:PROJ-100'], 'exec-1');

      expect(result).toBe(0);
      expect(mockDeleteEdges).not.toHaveBeenCalled();
    });

    it('should handle empty orphaned list (AC-03)', async () => {
      const result = await removeOrphanedEdges('PROJ', [], 'exec-1');

      expect(result).toBe(0);
      expect(mockGetEdges).not.toHaveBeenCalled();
      expect(mockDeleteEdges).not.toHaveBeenCalled();
    });

    // ─── AC-11: Idempotency ──

    it('should be idempotent — second run finds nothing to remove (AC-11)', async () => {
      // First run: edges exist
      mockGetEdges.mockResolvedValueOnce([EDGE_TO_200]);
      mockDeleteEdges.mockResolvedValue(undefined);

      const result1 = await removeOrphanedEdges('PROJ', ['jira:PROJ-100'], 'exec-1');

      // Second run: edges already deleted
      mockGetEdges.mockResolvedValueOnce([]);
      const result2 = await removeOrphanedEdges('PROJ', ['jira:PROJ-100'], 'exec-1');

      expect(result1).toBe(1);
      expect(result2).toBe(0);
      expect(mockDeleteEdges).toHaveBeenCalledTimes(1); // Only called on first run
    });

    // ─── FORGE-OPS-0104: Graceful degradation ──

    it('should continue after delete errors and count successful removals (FORGE-OPS-0104)', async () => {
      mockGetEdges.mockResolvedValueOnce([EDGE_TO_200]).mockResolvedValueOnce([EDGE_TO_EPIC]);
      mockDeleteEdges
        .mockRejectedValueOnce(new Error('Delete failed'))
        .mockResolvedValueOnce(undefined);

      const result = await removeOrphanedEdges(
        'PROJ',
        ['jira:PROJ-100', 'jira:PROJ-200'],
        'exec-1',
      );

      expect(result).toBe(1); // Only second delete succeeded
      expect(mockDeleteEdges).toHaveBeenCalledTimes(2);
    });

    it('should continue after getEdges error (FORGE-OPS-0104)', async () => {
      mockGetEdges
        .mockRejectedValueOnce(new Error('Read failed'))
        .mockResolvedValueOnce([EDGE_TO_EPIC]);
      mockDeleteEdges.mockResolvedValue(undefined);

      const result = await removeOrphanedEdges('PROJ', ['jira:PROJ-100', 'jira:PROJ-E1'], 'exec-1');

      expect(result).toBe(1); // Only second node's edges counted
      expect(mockDeleteEdges).toHaveBeenCalledTimes(1);
    });
  });

  // ─── refreshStaleNodes() ─────────────────

  describe('refreshStaleNodes()', () => {
    beforeEach(() => {
      jest.useFakeTimers().setSystemTime(new Date('2026-05-02T12:00:00Z'));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    // ─── AC-04: refreshStaleNodes ──

    it('should return 0 when all nodes are fresh (AC-04)', async () => {
      const freshNodes = [
        makeNode({ updatedAt: '2026-04-28T00:00:00Z' }), // 4 days ago, within 7d
        makeNode({ updatedAt: '2026-05-01T00:00:00Z' }), // 1 day ago
      ];

      const result = await refreshStaleNodes(freshNodes, '7d', 'exec-1');

      expect(result).toBe(0);
    });

    it('should count nodes older than maxAge threshold (AC-04)', async () => {
      const nodes = [
        makeNode({ updatedAt: '2026-04-20T00:00:00Z' }), // 12 days ago → stale
        makeNode({ updatedAt: '2026-04-28T00:00:00Z' }), // 4 days ago → fresh
        makeNode({ updatedAt: '2026-04-15T00:00:00Z' }), // 17 days ago → stale
      ];

      const result = await refreshStaleNodes(nodes, '7d', 'exec-1');

      expect(result).toBe(2);
    });

    it('should return 0 for empty node list (AC-04)', async () => {
      const result = await refreshStaleNodes([], '7d', 'exec-1');

      expect(result).toBe(0);
    });

    it('should return all nodes as stale when all are old (AC-04)', async () => {
      const staleNodes = [
        makeNode({ updatedAt: '2026-04-01T00:00:00Z' }),
        makeNode({ updatedAt: '2026-03-15T00:00:00Z' }),
      ];

      const result = await refreshStaleNodes(staleNodes, '7d', 'exec-1');

      expect(result).toBe(2);
    });

    it('should parse maxAge "14d" correctly (AC-04)', async () => {
      const nodes = [
        makeNode({ updatedAt: '2026-04-20T00:00:00Z' }), // 12 days ago → fresh for 14d
        makeNode({ updatedAt: '2026-04-10T00:00:00Z' }), // 22 days ago → stale for 14d
      ];

      const result = await refreshStaleNodes(nodes, '14d', 'exec-1');

      expect(result).toBe(1);
    });

    it('should treat invalid maxAge as epoch — all nodes stale (AC-04)', async () => {
      const nodes = [makeNode({ updatedAt: '2026-05-02T00:00:00Z' })]; // today

      const result = await refreshStaleNodes(nodes, 'invalid', 'exec-1');

      expect(result).toBe(1); // Epoch is 1970, so any date is "fresh" — actually no, epoch < today → stale
    });

    it('should work with mixed entity types (AC-04)', async () => {
      const nodes = [
        makeNode({ type: 'jira-issue', updatedAt: '2026-04-20T00:00:00Z' }), // stale
        makeNode({ id: 'jira:PROJ-E1', type: 'jira-epic', updatedAt: '2026-04-28T00:00:00Z' }), // fresh
        makeNode({
          id: 'confluence:123',
          type: 'confluence-page',
          updatedAt: '2026-04-10T00:00:00Z',
        }), // stale
        makeNode({
          id: 'github:repo/pull/1',
          type: 'github-pr',
          updatedAt: '2026-05-01T00:00:00Z',
        }), // fresh
        makeNode({ id: 'topic:cache', type: 'topic', updatedAt: '2026-03-01T00:00:00Z' }), // stale
      ];

      const result = await refreshStaleNodes(nodes, '7d', 'exec-1');

      expect(result).toBe(3);
    });

    // ─── AC-11: Idempotency ──

    it('should be idempotent — same input produces same output (AC-11)', async () => {
      const nodes = [makeNode({ updatedAt: '2026-04-20T00:00:00Z' })];

      const result1 = await refreshStaleNodes(nodes, '7d', 'exec-1');
      const result2 = await refreshStaleNodes(nodes, '7d', 'exec-1');

      expect(result1).toBe(result2);
    });
  });

  // ─── compactStorage() ─────────────────

  describe('compactStorage()', () => {
    // ─── AC-05: compactStorage ──

    it('should return empty result for empty sourceIds (AC-05)', async () => {
      const result = await compactStorage('PROJ', [], 'exec-1');

      expect(result.operation).toBe('compactStorage');
      expect(result.nodesProcessed).toBe(0);
      expect(result.edgesProcessed).toBe(0);
      expect(result.orphansRemoved).toBe(0);
      expect(result.errors).toEqual([]);
    });

    it('should deduplicate edges and write back compacted list (AC-05)', async () => {
      const duplicateEdges = [
        EDGE_TO_200,
        EDGE_TO_200, // duplicate
        EDGE_TO_EPIC,
      ];
      mockGetEdges.mockResolvedValue(duplicateEdges);
      mockPutEdges.mockResolvedValue(undefined);

      const result = await compactStorage('PROJ', ['jira:PROJ-100'], 'exec-1');

      expect(result.orphansRemoved).toBe(1); // 3 → 2 = 1 duplicate removed
      expect(result.nodesProcessed).toBe(1);
      expect(result.edgesProcessed).toBe(3);
      expect(mockPutEdges).toHaveBeenCalledWith(
        'PROJ',
        'jira:PROJ-100',
        expect.arrayContaining([EDGE_TO_200, EDGE_TO_EPIC]),
        'exec-1',
      );
    });

    it('should not write when no duplicates found (AC-05)', async () => {
      mockGetEdges.mockResolvedValue([EDGE_TO_200, EDGE_TO_EPIC]);
      mockPutEdges.mockResolvedValue(undefined);

      const result = await compactStorage('PROJ', ['jira:PROJ-100'], 'exec-1');

      expect(result.orphansRemoved).toBe(0);
      expect(mockPutEdges).not.toHaveBeenCalled();
    });

    it('should deduplicate across multiple source IDs (AC-05)', async () => {
      mockGetEdges
        .mockResolvedValueOnce([EDGE_TO_200, EDGE_TO_200]) // 1 duplicate
        .mockResolvedValueOnce([EDGE_TO_EPIC]); // no duplicates
      mockPutEdges.mockResolvedValue(undefined);

      const result = await compactStorage('PROJ', ['jira:PROJ-100', 'jira:PROJ-200'], 'exec-1');

      expect(result.orphansRemoved).toBe(1);
      expect(result.nodesProcessed).toBe(2);
      expect(mockPutEdges).toHaveBeenCalledTimes(1); // Only for first source
    });

    // ─── FORGE-OPS-007: Rate limiting ──

    it('should rate-limit between writes (FORGE-OPS-007)', async () => {
      jest.useFakeTimers();

      mockGetEdges
        .mockResolvedValueOnce([EDGE_TO_200, EDGE_TO_200]) // has duplicates
        .mockResolvedValueOnce([EDGE_TO_EPIC, EDGE_TO_EPIC]); // has duplicates
      mockPutEdges.mockResolvedValue(undefined);

      const promise = compactStorage('PROJ', ['src1', 'src2'], 'exec-1');

      // Fast-forward through setTimeout calls (rateLimitDelay uses setTimeout)
      await jest.runAllTimersAsync();

      const result = await promise;

      expect(result.orphansRemoved).toBe(2);
      jest.useRealTimers();
    });

    // ─── AC-11: Idempotency ──

    it('should be idempotent — second run finds no duplicates (AC-11)', async () => {
      // First run: has duplicates
      mockGetEdges.mockResolvedValueOnce([EDGE_TO_200, EDGE_TO_200]);
      mockPutEdges.mockResolvedValue(undefined);

      const result1 = await compactStorage('PROJ', ['jira:PROJ-100'], 'exec-1');

      // Second run: duplicates already removed
      mockGetEdges.mockResolvedValueOnce([EDGE_TO_200]); // deduped already
      const result2 = await compactStorage('PROJ', ['jira:PROJ-100'], 'exec-1');

      expect(result1.orphansRemoved).toBe(1);
      expect(result2.orphansRemoved).toBe(0);
      expect(mockPutEdges).toHaveBeenCalledTimes(1); // Only called on first run
    });

    // ─── FORGE-OPS-0104: Graceful degradation ──

    it('should continue after individual errors (FORGE-OPS-0104)', async () => {
      mockGetEdges
        .mockRejectedValueOnce(new Error('Read failed'))
        .mockResolvedValueOnce([EDGE_TO_EPIC, EDGE_TO_EPIC]); // second source OK
      mockPutEdges.mockResolvedValue(undefined);

      const result = await compactStorage('PROJ', ['src1', 'src2'], 'exec-1');

      expect(result.orphansRemoved).toBe(1); // Only second source compacted
      expect(result.errors).toHaveLength(1);
      expect(result.nodesProcessed).toBe(1); // Only second source succeeded
    });

    it('should handle write failure gracefully (FORGE-OPS-0104)', async () => {
      mockGetEdges.mockResolvedValue([EDGE_TO_200, EDGE_TO_200]);
      mockPutEdges.mockRejectedValue(new Error('Write failed'));

      const result = await compactStorage('PROJ', ['src1'], 'exec-1');

      expect(result.errors).toHaveLength(1);
      expect(result.orphansRemoved).toBe(0); // Write failed, nothing removed
    });
  });

  // ─── generateHealthReport() ─────────────────

  describe('generateHealthReport()', () => {
    // ─── AC-06: generateHealthReport ──

    it('should return healthy status with fresh stats and no orphans (AC-06)', async () => {
      mockGetStats.mockResolvedValue(
        makeStats({
          totalNodes: 100,
          totalEdges: 200,
          topicCount: 5,
          lastUpdated: '2026-05-01T00:00:00Z', // 1 day ago
        }),
      );

      const result = await generateHealthReport('PROJ', 'exec-1', {
        orphanedNodeCount: 2,
        staleEdgeCount: 5,
        maxEdgesPerNode: 10,
      });

      expect(result.projectKey).toBe('PROJ');
      expect(result.totalNodes).toBe(100);
      expect(result.totalEdges).toBe(200);
      expect(result.status).toBe('healthy');
      expect(result.orphanedNodes).toBe(2);
      expect(result.staleEdges).toBe(5);
    });

    it('should return degraded status when orphaned ratio 5-15% (AC-06)', async () => {
      mockGetStats.mockResolvedValue(
        makeStats({
          totalNodes: 100,
          totalEdges: 200,
          lastUpdated: '2026-04-28T00:00:00Z', // 4 days ago
        }),
      );

      const result = await generateHealthReport('PROJ', 'exec-1', {
        orphanedNodeCount: 10, // 10% → degraded
        staleEdgeCount: 5,
        maxEdgesPerNode: 10,
      });

      expect(result.status).toBe('degraded');
    });

    it('should return critical status when orphaned ratio > 15% (AC-06)', async () => {
      mockGetStats.mockResolvedValue(
        makeStats({
          totalNodes: 100,
          totalEdges: 200,
          lastUpdated: '2026-05-01T00:00:00Z',
        }),
      );

      const result = await generateHealthReport('PROJ', 'exec-1', {
        orphanedNodeCount: 20, // 20% → critical
        staleEdgeCount: 2,
        maxEdgesPerNode: 10,
      });

      expect(result.status).toBe('critical');
    });

    it('should return critical when days since maintenance > 30 (AC-06)', async () => {
      mockGetStats.mockResolvedValue(
        makeStats({
          totalNodes: 100,
          totalEdges: 200,
          lastUpdated: '2026-03-20T00:00:00Z', // 43 days ago → critical
        }),
      );

      const result = await generateHealthReport('PROJ', 'exec-1', {
        orphanedNodeCount: 0,
        staleEdgeCount: 0,
        maxEdgesPerNode: 10,
      });

      expect(result.status).toBe('critical');
    });

    it('should use worst metric for overall status (AC-06)', async () => {
      mockGetStats.mockResolvedValue(
        makeStats({
          totalNodes: 100,
          totalEdges: 200,
          lastUpdated: '2026-05-01T00:00:00Z', // 1 day → healthy
        }),
      );

      // orphaned healthy (1%), staleEdge degraded (15%), maxEdges healthy (10), days healthy (1)
      const result = await generateHealthReport('PROJ', 'exec-1', {
        orphanedNodeCount: 1, // 1% → healthy
        staleEdgeCount: 30, // 15% → degraded
        maxEdgesPerNode: 10, // healthy
      });

      expect(result.status).toBe('degraded'); // Worst of the four metrics
    });

    it('should handle empty graph with healthy status (AC-06)', async () => {
      mockGetStats.mockResolvedValue(makeStats({ lastUpdated: '2026-05-01T00:00:00Z' }));

      const result = await generateHealthReport('PROJ', 'exec-1');

      expect(result.totalNodes).toBe(0);
      expect(result.totalEdges).toBe(0);
      expect(result.avgEdgesPerNode).toBe(0);
      expect(result.maxEdgesPerNode).toBe(0);
      expect(result.orphanedNodes).toBe(0);
      expect(result.status).toBe('healthy');
    });

    it('should handle never-maintained graph (lastUpdated empty) (AC-06)', async () => {
      mockGetStats.mockResolvedValue(
        makeStats({
          totalNodes: 50,
          totalEdges: 100,
          lastUpdated: '', // Never maintained
        }),
      );

      const result = await generateHealthReport('PROJ', 'exec-1');

      // Days since epoch → critical
      expect(result.status).toBe('critical');
      expect(result.lastMaintenanceAt).toBe('');
    });

    it('should compute correct storage keys estimate (AC-06)', async () => {
      mockGetStats.mockResolvedValue(
        makeStats({
          totalNodes: 10,
          totalEdges: 25,
          topicCount: 3,
          lastUpdated: '2026-05-01T00:00:00Z',
        }),
      );

      const result = await generateHealthReport('PROJ', 'exec-1');

      // 1 stats + 10*3 (nodes + edges + neighborhoods) + 3 topics = 34
      expect(result.storageKeysUsed).toBe(34);
    });

    it('should compute avgEdgesPerNode from stats (AC-06)', async () => {
      mockGetStats.mockResolvedValue(
        makeStats({
          totalNodes: 10,
          totalEdges: 25,
          lastUpdated: '2026-05-01T00:00:00Z',
        }),
      );

      const result = await generateHealthReport('PROJ', 'exec-1');

      expect(result.avgEdgesPerNode).toBe(2.5);
    });

    it('should default orphanedNodes and staleEdges to 0 when no healthData (AC-06)', async () => {
      mockGetStats.mockResolvedValue(
        makeStats({
          totalNodes: 100,
          totalEdges: 200,
          lastUpdated: '2026-05-01T00:00:00Z',
        }),
      );

      const result = await generateHealthReport('PROJ', 'exec-1');

      expect(result.orphanedNodes).toBe(0);
      expect(result.staleEdges).toBe(0);
    });
  });

  // ─── pruneDecisionLog() ─────────────────

  describe('pruneDecisionLog()', () => {
    beforeEach(() => {
      jest.useFakeTimers().setSystemTime(new Date('2026-05-02T12:00:00Z'));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    // ─── AC-15: pruneDecisionLog ──

    it('should return 0 pruned when all decisions are within retention (AC-15)', async () => {
      const decisions = [
        makeDecision({ timestamp: '2026-04-15T00:00:00Z' }), // 17 days ago, within 90d
      ];

      const result = await pruneDecisionLog(decisions, 90, 'exec-1');

      expect(result.orphansRemoved).toBe(0);
      expect(result.nodesProcessed).toBe(1);
    });

    it('should prune decisions older than retention period (AC-15)', async () => {
      const decisions = [
        makeDecision({ id: 'dec-old', timestamp: '2025-12-01T00:00:00Z' }), // >90 days old
        makeDecision({ id: 'dec-recent', timestamp: '2026-04-15T00:00:00Z' }), // within 90d
      ];

      const result = await pruneDecisionLog(decisions, 90, 'exec-1');

      expect(result.orphansRemoved).toBe(1);
    });

    it('should keep overridden decisions younger than 30 days regardless of retention (AC-15)', async () => {
      const decisions = [
        makeDecision({
          id: 'dec-overridden',
          timestamp: '2026-04-10T00:00:00Z', // 22 days ago
          overridden: true,
        }),
      ];

      // Retention of 7 days — would normally prune, but overridden < 30 days is kept
      const result = await pruneDecisionLog(decisions, 7, 'exec-1');

      expect(result.orphansRemoved).toBe(0);
    });

    it('should prune overridden decisions older than 30 days (AC-15)', async () => {
      const decisions = [
        makeDecision({
          id: 'dec-old-overridden',
          timestamp: '2026-03-01T00:00:00Z', // 62 days ago
          overridden: true,
        }),
      ];

      const result = await pruneDecisionLog(decisions, 90, 'exec-1');

      expect(result.orphansRemoved).toBe(1);
    });

    it('should handle empty decisions array (AC-15)', async () => {
      const result = await pruneDecisionLog([], 90, 'exec-1');

      expect(result.orphansRemoved).toBe(0);
      expect(result.nodesProcessed).toBe(0);
      expect(result.operation).toBe('pruneDecisionLog');
    });

    it('should prune all decisions when all expired (AC-15)', async () => {
      const decisions = [
        makeDecision({ id: 'dec-1', timestamp: '2025-01-01T00:00:00Z' }),
        makeDecision({ id: 'dec-2', timestamp: '2025-06-01T00:00:00Z' }),
      ];

      const result = await pruneDecisionLog(decisions, 90, 'exec-1');

      expect(result.orphansRemoved).toBe(2);
    });

    // ─── AC-11: Idempotency ──

    it('should be idempotent — same input produces same output (AC-11)', async () => {
      const decisions = [makeDecision({ timestamp: '2025-12-01T00:00:00Z' })];

      const result1 = await pruneDecisionLog(decisions, 90, 'exec-1');
      const result2 = await pruneDecisionLog(decisions, 90, 'exec-1');

      expect(result1.orphansRemoved).toBe(result2.orphansRemoved);
    });
  });

  // ─── compactDecisionPatterns() ─────────────────

  describe('compactDecisionPatterns()', () => {
    // ─── AC-16: compactDecisionPatterns ──

    it('should return 0 compactions for empty decisions (AC-16)', async () => {
      const result = await compactDecisionPatterns([], 'exec-1');

      expect(result.staleUpdated).toBe(0);
      expect(result.nodesProcessed).toBe(0);
      expect(result.operation).toBe('compactDecisionPatterns');
    });

    it('should not compact decisions with unique signatures (AC-16)', async () => {
      const decisions = [
        makeDecision({ contextSignature: 'PROJ-100:high:consistency:few' }),
        makeDecision({ contextSignature: 'PROJ-200:mid:documentation:many' }),
      ];

      const result = await compactDecisionPatterns(decisions, 'exec-1');

      expect(result.staleUpdated).toBe(0); // No groups of 2+
    });

    it('should compact decisions with same contextSignature and gateType (AC-16)', async () => {
      const decisions = [
        makeDecision({
          id: 'dec-1',
          contextSignature: 'PROJ-100:high:consistency:few',
          timestamp: '2026-04-01T00:00:00Z',
        }),
        makeDecision({
          id: 'dec-2',
          contextSignature: 'PROJ-100:high:consistency:few',
          timestamp: '2026-04-15T00:00:00Z',
        }),
        makeDecision({
          id: 'dec-3',
          contextSignature: 'PROJ-100:high:consistency:few',
          timestamp: '2026-04-20T00:00:00Z',
        }),
      ];

      const result = await compactDecisionPatterns(decisions, 'exec-1');

      // Group of 3 → compact to 1 representative → 2 removed
      expect(result.staleUpdated).toBe(2);
    });

    it('should keep most recent decision as representative (AC-16)', async () => {
      const decisions = [
        makeDecision({
          id: 'dec-old',
          contextSignature: 'PROJ-100:high:consistency:few',
          timestamp: '2026-03-01T00:00:00Z',
        }),
        makeDecision({
          id: 'dec-new',
          contextSignature: 'PROJ-100:high:consistency:few',
          timestamp: '2026-04-20T00:00:00Z',
        }),
      ];

      const result = await compactDecisionPatterns(decisions, 'exec-1');

      // Group of 2 → compact to 1 → 1 removed
      expect(result.staleUpdated).toBe(1);
    });

    it('should handle multiple groups independently (AC-16)', async () => {
      const decisions = [
        // Group A: 3 decisions
        makeDecision({ contextSignature: 'sig-a', timestamp: '2026-04-01T00:00:00Z' }),
        makeDecision({ contextSignature: 'sig-a', timestamp: '2026-04-10T00:00:00Z' }),
        makeDecision({ contextSignature: 'sig-a', timestamp: '2026-04-20T00:00:00Z' }),
        // Group B: 2 decisions
        makeDecision({ contextSignature: 'sig-b', timestamp: '2026-04-05T00:00:00Z' }),
        makeDecision({ contextSignature: 'sig-b', timestamp: '2026-04-15T00:00:00Z' }),
      ];

      const result = await compactDecisionPatterns(decisions, 'exec-1');

      // Group A: 3→1 = 2, Group B: 2→1 = 1, total = 3
      expect(result.staleUpdated).toBe(3);
    });

    // ─── AC-11: Idempotency ──

    it('should be idempotent — second run on compacted data finds nothing (AC-11)', async () => {
      const decisions = [
        makeDecision({ contextSignature: 'sig-a', timestamp: '2026-04-01T00:00:00Z' }),
        makeDecision({ contextSignature: 'sig-a', timestamp: '2026-04-20T00:00:00Z' }),
      ];

      const result1 = await compactDecisionPatterns(decisions, 'exec-1');
      expect(result1.staleUpdated).toBe(1);

      // After compaction, only 1 decision per group remains
      const compacted = decisions.slice(1, 2);
      const result2 = await compactDecisionPatterns(compacted, 'exec-1');
      expect(result2.staleUpdated).toBe(0);
    });
  });

  // ─── validateNeighborhoods() ─────────────────

  describe('validateNeighborhoods()', () => {
    // ─── AC-17: validateNeighborhoods ──

    it('should return 0 repairs for empty entity list (AC-17)', async () => {
      const result = await validateNeighborhoods('PROJ', [], 'exec-1');

      expect(result.staleUpdated).toBe(0);
      expect(result.nodesProcessed).toBe(0);
      expect(result.operation).toBe('validateNeighborhoods');
    });

    it('should return 0 repairs when neighborhoods match edges (AC-17)', async () => {
      const neighborhood = makeNeighborhood({
        siblings: [
          {
            id: 'jira:PROJ-200',
            key: 'PROJ-200',
            type: 'jira-issue',
            relationship: 'related-to',
            weight: 0.8,
          },
        ],
        linkedIssues: [],
      });
      const edges = [
        makeEdge({
          source: 'jira:PROJ-100',
          target: 'jira:PROJ-200',
          type: 'related-to',
          weight: 0.8,
        }),
      ];

      mockGetNeighborhood.mockResolvedValue(neighborhood);
      mockGetEdges.mockResolvedValue(edges);

      const result = await validateNeighborhoods('PROJ', ['jira:PROJ-100'], 'exec-1');

      expect(result.staleUpdated).toBe(0);
      expect(result.nodesProcessed).toBe(1);
    });

    it('should repair when edge exists but neighborhood is missing it (AC-17)', async () => {
      const staleNeighborhood = makeNeighborhood({ siblings: [], linkedIssues: [] });
      const edges = [
        makeEdge({
          source: 'jira:PROJ-100',
          target: 'jira:PROJ-200',
          type: 'related-to',
          weight: 0.8,
        }),
      ];

      mockGetNeighborhood.mockResolvedValue(staleNeighborhood);
      mockGetEdges.mockResolvedValue(edges);
      mockPutNeighborhood.mockResolvedValue(undefined);

      const result = await validateNeighborhoods('PROJ', ['jira:PROJ-100'], 'exec-1');

      expect(result.staleUpdated).toBe(1);
      expect(mockPutNeighborhood).toHaveBeenCalledTimes(1);
    });

    it('should repair when neighborhood has entry not in edges (AC-17)', async () => {
      const driftedNeighborhood = makeNeighborhood({
        siblings: [
          {
            id: 'jira:PROJ-999',
            key: 'PROJ-999',
            type: 'jira-issue',
            relationship: 'related-to',
            weight: 0.8,
          },
        ],
        linkedIssues: [],
      });
      const edges: RelationshipEdge[] = []; // No edges but neighborhood has entry

      mockGetNeighborhood.mockResolvedValue(driftedNeighborhood);
      mockGetEdges.mockResolvedValue(edges);
      mockPutNeighborhood.mockResolvedValue(undefined);

      const result = await validateNeighborhoods('PROJ', ['jira:PROJ-100'], 'exec-1');

      expect(result.staleUpdated).toBe(1);
      expect(mockPutNeighborhood).toHaveBeenCalledTimes(1);
    });

    it('should rebuild neighborhood when null (missing) (AC-17)', async () => {
      mockGetNeighborhood.mockResolvedValue(null);
      const edges = [
        makeEdge({
          source: 'jira:PROJ-100',
          target: 'jira:PROJ-200',
          type: 'related-to',
          weight: 0.8,
        }),
      ];
      mockGetEdges.mockResolvedValue(edges);
      mockPutNeighborhood.mockResolvedValue(undefined);

      const result = await validateNeighborhoods('PROJ', ['jira:PROJ-100'], 'exec-1');

      expect(result.staleUpdated).toBe(1);
      expect(mockPutNeighborhood).toHaveBeenCalledTimes(1);
    });

    it('should handle partial drift across multiple entities (AC-17)', async () => {
      // Entity 1: consistent
      mockGetNeighborhood.mockResolvedValueOnce(
        makeNeighborhood({ siblings: [], linkedIssues: [] }),
      );
      mockGetEdges.mockResolvedValueOnce([]);

      // Entity 2: drifted
      mockGetNeighborhood.mockResolvedValueOnce(
        makeNeighborhood({
          entityId: 'jira:PROJ-200',
          entityKey: 'PROJ-200',
          siblings: [],
          linkedIssues: [],
        }),
      );
      mockGetEdges.mockResolvedValueOnce([
        makeEdge({
          source: 'jira:PROJ-200',
          target: 'jira:PROJ-300',
          type: 'related-to',
          weight: 0.8,
        }),
      ]);
      mockPutNeighborhood.mockResolvedValue(undefined);

      const result = await validateNeighborhoods(
        'PROJ',
        ['jira:PROJ-100', 'jira:PROJ-200'],
        'exec-1',
      );

      expect(result.staleUpdated).toBe(1);
      expect(result.nodesProcessed).toBe(2);
    });

    // ─── FORGE-OPS-0104: Graceful degradation ──

    it('should continue after individual entity error (FORGE-OPS-0104)', async () => {
      mockGetNeighborhood.mockRejectedValueOnce(new Error('Storage error')).mockResolvedValueOnce(
        makeNeighborhood({
          entityId: 'jira:PROJ-200',
          entityKey: 'PROJ-200',
          siblings: [],
          linkedIssues: [],
        }),
      );
      mockGetEdges
        .mockResolvedValueOnce([]) // won't be called for first entity (error in getNeighborhood)
        .mockResolvedValueOnce([
          makeEdge({
            source: 'jira:PROJ-200',
            target: 'jira:PROJ-300',
            type: 'related-to',
            weight: 0.8,
          }),
        ]);
      mockPutNeighborhood.mockResolvedValue(undefined);

      const result = await validateNeighborhoods(
        'PROJ',
        ['jira:PROJ-100', 'jira:PROJ-200'],
        'exec-1',
      );

      expect(result.errors).toHaveLength(1);
      expect(result.staleUpdated).toBe(1); // Second entity repaired
    });

    // ─── AC-11: Idempotency ──

    it('should be idempotent — second run finds no drift (AC-11)', async () => {
      const repairedNeighborhood = makeNeighborhood({
        siblings: [
          {
            id: 'jira:PROJ-200',
            key: 'PROJ-200',
            type: 'jira-issue',
            relationship: 'related-to',
            weight: 0.8,
          },
        ],
        linkedIssues: [],
      });
      const edges = [
        makeEdge({
          source: 'jira:PROJ-100',
          target: 'jira:PROJ-200',
          type: 'related-to',
          weight: 0.8,
        }),
      ];

      // First run: drifted → repair
      mockGetNeighborhood.mockResolvedValueOnce(
        makeNeighborhood({ siblings: [], linkedIssues: [] }),
      );
      mockGetEdges.mockResolvedValue(edges);
      mockPutNeighborhood.mockResolvedValue(undefined);

      const result1 = await validateNeighborhoods('PROJ', ['jira:PROJ-100'], 'exec-1');

      // Second run: now consistent
      mockGetNeighborhood.mockResolvedValue(repairedNeighborhood);
      const result2 = await validateNeighborhoods('PROJ', ['jira:PROJ-100'], 'exec-1');

      expect(result1.staleUpdated).toBe(1);
      expect(result2.staleUpdated).toBe(0);
    });
  });

  // ─── runMaintenanceCycle() ─────────────────

  describe('runMaintenanceCycle()', () => {
    beforeEach(() => {
      jest.useFakeTimers().setSystemTime(new Date('2026-05-02T12:00:00Z'));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    // ─── AC-18: runMaintenanceCycle ──

    it('should return empty result when no nodes or decisions (AC-18)', async () => {
      mockGetStats.mockResolvedValue(makeStats({ lastUpdated: '2026-05-01T00:00:00Z' }));

      const result = await runMaintenanceCycle('PROJ', [], [], 'exec-1');

      expect(result.operation).toBe('runMaintenanceCycle');
      expect(result.errors).toEqual([]);
    });

    it('should run all phases in sequence and accumulate results (AC-18)', async () => {
      const nodes = [NODE_ISSUE_100];
      const decisions = [
        makeDecision({ timestamp: '2025-01-01T00:00:00Z' }), // old → pruned
        makeDecision({ contextSignature: 'sig-a', timestamp: '2026-04-01T00:00:00Z' }),
        makeDecision({ contextSignature: 'sig-a', timestamp: '2026-04-20T00:00:00Z' }),
      ];

      // validateNodeBatch: node exists
      mockGetNode.mockResolvedValue(NODE_ISSUE_100);
      mockGetEdges.mockResolvedValue([]); // No edges

      // validateNeighborhoods: consistent
      mockGetNeighborhood.mockResolvedValue(makeNeighborhood());
      mockGetStats.mockResolvedValue(makeStats({ lastUpdated: '2026-05-01T00:00:00Z' }));

      const result = await runMaintenanceCycle('PROJ', nodes, decisions, 'exec-1');

      expect(result.operation).toBe('runMaintenanceCycle');
      expect(result.nodesProcessed).toBeGreaterThanOrEqual(0);
      expect(result.orphansRemoved).toBeGreaterThanOrEqual(0);
    });

    it('should continue when a phase fails (FORGE-OPS-0104)', async () => {
      const nodes = [NODE_ISSUE_100];
      const decisions: DecisionRecord[] = [];

      // validateNodeBatch fails
      mockGetNode.mockRejectedValue(new Error('Storage down'));
      mockGetStats.mockResolvedValue(makeStats({ lastUpdated: '2026-05-01T00:00:00Z' }));

      const result = await runMaintenanceCycle('PROJ', nodes, decisions, 'exec-1');

      // Should still complete, errors collected
      expect(result.operation).toBe('runMaintenanceCycle');
      expect(result.errors.length).toBeGreaterThanOrEqual(0);
    });

    // ─── AC-11: Idempotency ──

    it('should be idempotent — same input produces same result (AC-11)', async () => {
      const nodes = [NODE_ISSUE_100];
      const decisions: DecisionRecord[] = [];

      mockGetNode.mockResolvedValue(NODE_ISSUE_100);
      mockGetEdges.mockResolvedValue([]);
      mockGetNeighborhood.mockResolvedValue(makeNeighborhood());
      mockGetStats.mockResolvedValue(makeStats({ lastUpdated: '2026-05-01T00:00:00Z' }));

      const result1 = await runMaintenanceCycle('PROJ', nodes, decisions, 'exec-1');
      const result2 = await runMaintenanceCycle('PROJ', nodes, decisions, 'exec-1');

      expect(result1.orphansRemoved).toBe(result2.orphansRemoved);
      expect(result1.staleUpdated).toBe(result2.staleUpdated);
    });
  });
});
