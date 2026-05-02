import {
  validateNodeBatch,
  removeOrphanedEdges,
} from '../../../../src/backend/services/relationship-index/graph-maintenance';

import type {
  EntityNode,
  RelationshipEdge,
} from '../../../../src/backend/types/relationship-index';

import * as storage from '../../../../src/backend/services/relationship-index/relationship-storage';

jest.mock('../../../../src/backend/services/relationship-index/relationship-storage');

const mockGetNode = storage.getNode as jest.MockedFunction<typeof storage.getNode>;
const mockGetEdges = storage.getEdges as jest.MockedFunction<typeof storage.getEdges>;
const mockDeleteEdges = storage.deleteEdges as jest.MockedFunction<typeof storage.deleteEdges>;

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

const EDGE_TO_200 = makeEdge();
const EDGE_TO_EPIC = makeEdge({
  source: 'jira:PROJ-100',
  target: 'jira:PROJ-E1',
  type: 'parent-of',
  weight: 1.0,
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
});
