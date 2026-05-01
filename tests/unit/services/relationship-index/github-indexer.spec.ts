// Tests for github-indexer.ts — RTASK-040
// Covers: extractJiraKeysFromPR, extractPRTopics, buildPRNeighborhood,
//         indexPullRequest, getImplementingPRs

import {
  extractJiraKeysFromPR,
  extractPRTopics,
  buildPRNeighborhood,
  indexPullRequest,
  getImplementingPRs,
} from '../../../../src/backend/services/relationship-index/github-indexer';

import type { PRIndexInput } from '../../../../src/backend/services/relationship-index/github-indexer';
import type {
  GraphStats,
  EntityType,
  EdgeType,
} from '../../../../src/backend/types/relationship-index';

import * as storage from '../../../../src/backend/services/relationship-index/relationship-storage';

import * as fs from 'fs';
import * as path from 'path';

// ═══════════════════════════════════════════
// MOCKS
// ═══════════════════════════════════════════

jest.mock('../../../../src/backend/services/relationship-index/relationship-storage');

const mockPutNode = storage.putNode as jest.MockedFunction<typeof storage.putNode>;
const mockPutEdges = storage.putEdges as jest.MockedFunction<typeof storage.putEdges>;
const mockGetTopicEntities = storage.getTopicEntities as jest.MockedFunction<
  typeof storage.getTopicEntities
>;
const mockPutTopicIndex = storage.putTopicIndex as jest.MockedFunction<
  typeof storage.putTopicIndex
>;
const mockGetStats = storage.getStats as jest.MockedFunction<typeof storage.getStats>;
const mockPutStats = storage.putStats as jest.MockedFunction<typeof storage.putStats>;
const mockGetNode = storage.getNode as jest.MockedFunction<typeof storage.getNode>;
const mockPutNeighborhood = storage.putNeighborhood as jest.MockedFunction<
  typeof storage.putNeighborhood
>;
const mockGetEdges = storage.getEdges as jest.MockedFunction<typeof storage.getEdges>;

function makeEmptyStats(): GraphStats {
  const nodesByType = {} as Record<EntityType, number>;
  const edgesByType = {} as Record<EdgeType, number>;
  return {
    totalNodes: 0,
    totalEdges: 0,
    nodesByType,
    edgesByType,
    topicCount: 0,
    lastUpdated: '',
  };
}

const validPR: PRIndexInput = {
  prNumber: 42,
  repo: 'org/repo',
  title: 'Implement PROJ-100 caching layer',
  body: 'This PR implements PROJ-100 and PROJ-101.',
  branch: 'feature/PROJ-100-cache',
  baseBranch: 'main',
  state: 'open',
  labels: ['enhancement', 'cache'],
  url: 'https://github.com/org/repo/pull/42',
  fileCount: 5,
  additions: 120,
  deletions: 30,
  author: 'developer',
};

// ═══════════════════════════════════════════
// TEST SUITE
// ═══════════════════════════════════════════

describe('github-indexer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetStats.mockResolvedValue(makeEmptyStats());
    mockGetTopicEntities.mockResolvedValue([]);
    mockGetNode.mockResolvedValue(null);
    mockGetEdges.mockResolvedValue([]);
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  // ─── extractJiraKeysFromPR() ────────────

  describe('extractJiraKeysFromPR()', () => {
    it('should extract keys from title and body (AC-02)', () => {
      const result = extractJiraKeysFromPR('Fix PROJ-100', 'Also PROJ-101', '');
      expect(result).toContain('PROJ-100');
      expect(result).toContain('PROJ-101');
    });

    it('should extract keys from branch name (AC-02)', () => {
      const result = extractJiraKeysFromPR('', '', 'feature/PROJ-100-cache');
      expect(result).toContain('PROJ-100');
    });

    it('should deduplicate keys across title, body, and branch (AC-02)', () => {
      const result = extractJiraKeysFromPR('PROJ-100', 'PROJ-100 again', 'PROJ-100-branch');
      expect(result).toEqual(['PROJ-100']);
    });

    it('should return empty array when no keys found (AC-02)', () => {
      expect(extractJiraKeysFromPR('No keys', 'here', 'main')).toEqual([]);
    });

    it('should return empty array for empty inputs (AC-02)', () => {
      expect(extractJiraKeysFromPR('', '', '')).toEqual([]);
    });

    it('should cap at 10 unique keys (AC-02, FORGE-OPS-013)', () => {
      const keys = Array.from({ length: 15 }, (_, i) => `PROJ-${i}`);
      const title = keys.join(' ');
      const result = extractJiraKeysFromPR(title, '', '');
      expect(result).toHaveLength(10);
    });

    it('should extract branch keys with underscore separator (AC-02)', () => {
      const result = extractJiraKeysFromPR('', '', 'PROJ_100_feature');
      expect(result).toContain('PROJ-100');
    });

    it('should normalize branch keys to uppercase (AC-02)', () => {
      const result = extractJiraKeysFromPR('', '', 'feature/proj-100-fix');
      expect(result).toContain('PROJ-100');
    });
  });

  // ─── extractPRTopics() ──────────────────

  describe('extractPRTopics()', () => {
    it('should extract topics from labels (AC-03)', () => {
      const result = extractPRTopics(['cache', 'enhancement']);
      expect(result).toHaveLength(2);
      expect(result[0]?.target).toBe('topic:cache');
      expect(result[0]?.type).toBe('topic-match');
      expect(result[0]?.weight).toBe(0.6);
    });

    it('should handle empty labels (AC-03)', () => {
      expect(extractPRTopics([])).toEqual([]);
    });

    it('should skip empty/whitespace labels (AC-03)', () => {
      const result = extractPRTopics(['  ', '', 'valid']);
      const validEdges = result.filter((e) => e.target === 'topic:valid');
      expect(validEdges).toHaveLength(1);
    });

    it('should normalize labels to lowercase (AC-03, FORGE-OPS-012)', () => {
      const result = extractPRTopics(['Cache']);
      expect(result[0]?.target).toBe('topic:cache');
    });
  });

  // ─── buildPRNeighborhood() ──────────────

  describe('buildPRNeighborhood()', () => {
    it('should build neighborhood with correct entity info', () => {
      const result = buildPRNeighborhood(validPR, 'PROJ', ['PROJ-100'], ['cache']);
      expect(result.entityId).toBe('github:org/repo/pull/42');
      expect(result.entityKey).toBe('org/repo/pull/42');
      expect(result.entityType).toBe('github-pr');
      expect(result.projectKey).toBe('PROJ');
    });

    it('should map Jira keys to linkedIssues', () => {
      const result = buildPRNeighborhood(validPR, 'PROJ', ['PROJ-100', 'PROJ-101'], []);
      expect(result.linkedIssues).toHaveLength(2);
      expect(result.linkedIssues[0]?.id).toBe('jira:PROJ-100');
      expect(result.linkedIssues[0]?.relationship).toBe('implements');
      expect(result.linkedIssues[0]?.weight).toBe(0.9);
    });

    it('should include topics', () => {
      const result = buildPRNeighborhood(validPR, 'PROJ', [], ['cache', 'enhancement']);
      expect(result.topics).toEqual(['cache', 'enhancement']);
    });

    it('should prune linkedIssues at 50 (FORGE-OPS-013)', () => {
      const keys = Array.from({ length: 60 }, (_, i) => `PROJ-${i}`);
      const result = buildPRNeighborhood(validPR, 'PROJ', keys, []);
      expect(result.linkedIssues).toHaveLength(50);
    });

    it('should have empty siblings for PRs', () => {
      const result = buildPRNeighborhood(validPR, 'PROJ', ['PROJ-100'], []);
      expect(result.siblings).toEqual([]);
    });
  });

  // ─── indexPullRequest() ─────────────────

  describe('indexPullRequest()', () => {
    it('should store node, edges, topics, neighborhood, and stats (AC-01, ARCH-SOLID-005)', async () => {
      await indexPullRequest(validPR, 'PROJ', 'exec-123');

      expect(mockPutNode).toHaveBeenCalledTimes(1);
      expect(mockPutNode).toHaveBeenCalledWith(
        'PROJ',
        expect.objectContaining({
          id: 'github:org/repo/pull/42',
          type: 'github-pr',
          label: 'Implement PROJ-100 caching layer',
        }),
        'exec-123',
      );

      // 1 main edge write + 2 reverse edge writes (PROJ-100, PROJ-101)
      expect(mockPutEdges).toHaveBeenCalledTimes(3);
      expect(mockPutNeighborhood).toHaveBeenCalledTimes(1);
      expect(mockPutStats).toHaveBeenCalledTimes(1);
    });

    it('should write implements edges for extracted Jira keys (AC-02)', async () => {
      await indexPullRequest(validPR, 'PROJ', 'exec-123');

      const edgesArg = mockPutEdges.mock.calls[0]?.[2];
      const implEdges = edgesArg?.filter((e) => e.type === 'implements');
      expect(implEdges).toHaveLength(2);
      expect(implEdges?.[0]?.target).toBe('jira:PROJ-100');
      expect(implEdges?.[1]?.target).toBe('jira:PROJ-101');
      expect(implEdges?.[0]?.weight).toBe(0.9);
    });

    it('should write topic edges for labels (AC-03)', async () => {
      await indexPullRequest(validPR, 'PROJ', 'exec-123');

      const edgesArg = mockPutEdges.mock.calls[0]?.[2];
      const topicEdges = edgesArg?.filter((e) => e.type === 'topic-match');
      expect(topicEdges).toHaveLength(2);
    });

    it('should update topic index (AC-03)', async () => {
      await indexPullRequest(validPR, 'PROJ', 'exec-123');

      expect(mockGetTopicEntities).toHaveBeenCalled();
      expect(mockPutTopicIndex).toHaveBeenCalled();
    });

    it('should be idempotent — same input same state (AC-05, GH-INTEG-306)', async () => {
      await indexPullRequest(validPR, 'PROJ', 'exec-123');
      await indexPullRequest(validPR, 'PROJ', 'exec-124');

      expect(mockPutNode).toHaveBeenCalledTimes(2);
      // 3 putEdges per call (1 main + 2 reverse)
      expect(mockPutEdges).toHaveBeenCalledTimes(6);
    });

    it('should handle PR with no Jira keys (AC-01)', async () => {
      const noKeysPR: PRIndexInput = {
        ...validPR,
        title: 'Cleanup',
        body: 'No keys',
        branch: 'main',
      };
      await indexPullRequest(noKeysPR, 'PROJ', 'exec-123');

      const edgesArg = mockPutEdges.mock.calls[0]?.[2];
      const implEdges = edgesArg?.filter((e) => e.type === 'implements');
      expect(implEdges).toHaveLength(0);
    });

    it('should handle PR with no labels (AC-01)', async () => {
      const noLabelsPR: PRIndexInput = { ...validPR, labels: [], body: 'PROJ-100' };
      await indexPullRequest(noLabelsPR, 'PROJ', 'exec-123');

      expect(mockPutNode).toHaveBeenCalledTimes(1);
      // 1 main + 1 reverse edge for PROJ-100
      expect(mockPutEdges).toHaveBeenCalledTimes(2);
    });

    it('should include metadata in node (AC-01)', async () => {
      await indexPullRequest(validPR, 'PROJ', 'exec-123');

      const nodeArg = mockPutNode.mock.calls[0]?.[1];
      expect(nodeArg?.metadata).toEqual(
        expect.objectContaining({
          repo: 'org/repo',
          branch: 'feature/PROJ-100-cache',
          baseBranch: 'main',
          fileCount: '5',
          additions: '120',
          deletions: '30',
          author: 'developer',
        }),
      );
    });

    it('should log structured output (AC-01)', async () => {
      await indexPullRequest(validPR, 'PROJ', 'exec-123');

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('"operation":"indexPullRequest"'),
      );
    });
  });

  // ─── getImplementingPRs() ───────────────

  describe('getImplementingPRs()', () => {
    it('should return empty array for empty issueKey (AC-04)', async () => {
      const result = await getImplementingPRs('', 'PROJ', 'exec-123');
      expect(result).toEqual([]);
    });

    it('should return empty array for empty projectKey (AC-04)', async () => {
      const result = await getImplementingPRs('PROJ-100', '', 'exec-123');
      expect(result).toEqual([]);
    });

    it('should return empty array when no edges exist (AC-04)', async () => {
      mockGetEdges.mockResolvedValue([]);

      const result = await getImplementingPRs('PROJ-100', 'PROJ', 'exec-123');
      expect(result).toEqual([]);
    });

    it('should return empty array on storage error (FORGE-OPS-0104)', async () => {
      mockGetEdges.mockRejectedValue(new Error('Storage error'));

      const result = await getImplementingPRs('PROJ-100', 'PROJ', 'exec-123');
      expect(result).toEqual([]);
    });

    it('should return PRs that implement the issue via reverse edges (AC-04)', async () => {
      const now = '2026-05-01T10:00:00.000Z';
      mockGetEdges.mockResolvedValue([
        {
          source: 'jira:PROJ-100',
          target: 'github:org/repo/pull/42',
          type: 'implements',
          weight: 0.9,
          createdAt: now,
          updatedAt: now,
        },
      ]);
      const mockPRNode = {
        id: 'github:org/repo/pull/42',
        type: 'github-pr' as const,
        label: 'Implement PROJ-100 caching layer',
        status: 'open',
        projectKey: 'PROJ',
        metadata: {},
        createdAt: now,
        updatedAt: now,
      };
      mockGetNode.mockResolvedValue(mockPRNode);

      const result = await getImplementingPRs('PROJ-100', 'PROJ', 'exec-123');
      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe('github:org/repo/pull/42');
      expect(result[0]?.type).toBe('github-pr');
    });

    it('should only return implements edges pointing to github: nodes (AC-04)', async () => {
      const now = '2026-05-01T10:00:00.000Z';
      mockGetEdges.mockResolvedValue([
        {
          source: 'jira:PROJ-100',
          target: 'github:org/repo/pull/42',
          type: 'implements',
          weight: 0.9,
          createdAt: now,
          updatedAt: now,
        },
        {
          source: 'jira:PROJ-100',
          target: 'jira:PROJ-200',
          type: 'related-to',
          weight: 0.8,
          createdAt: now,
          updatedAt: now,
        },
      ]);
      mockGetNode.mockResolvedValue(null);

      await getImplementingPRs('PROJ-100', 'PROJ', 'exec-123');
      // Should only try to fetch the github: node, not jira:PROJ-200
      expect(mockGetNode).toHaveBeenCalledTimes(1);
      expect(mockGetNode).toHaveBeenCalledWith('PROJ', 'github:org/repo/pull/42', 'exec-123');
    });

    it('should skip nodes that are not found (AC-04)', async () => {
      const now = '2026-05-01T10:00:00.000Z';
      mockGetEdges.mockResolvedValue([
        {
          source: 'jira:PROJ-100',
          target: 'github:org/repo/pull/99',
          type: 'implements',
          weight: 0.9,
          createdAt: now,
          updatedAt: now,
        },
      ]);
      mockGetNode.mockResolvedValue(null);

      const result = await getImplementingPRs('PROJ-100', 'PROJ', 'exec-123');
      expect(result).toEqual([]);
    });
  });

  // ─── RULEBOOK COMPLIANCE ────────────────

  describe('Rulebook Compliance', () => {
    it('should use zero any types (ARCH-SOLID-202)', () => {
      const source = fs.readFileSync(
        path.resolve(
          __dirname,
          '../../../../src/backend/services/relationship-index/github-indexer.ts',
        ),
        'utf-8',
      );
      const codeOnly = source.replace(/\/\/.*$/gm, '');
      const anyUsage = codeOnly.match(/:\s*any\b|\bas\s+any\b|<any>|\bany\s*\[/g);
      expect(anyUsage).toBeNull();
    });

    it('should never import @forge/api directly (ARCH-SOLID-005)', () => {
      const source = fs.readFileSync(
        path.resolve(
          __dirname,
          '../../../../src/backend/services/relationship-index/github-indexer.ts',
        ),
        'utf-8',
      );
      expect(source).not.toContain('@forge/api');
    });
  });
});
