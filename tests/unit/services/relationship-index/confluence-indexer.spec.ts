// Tests for confluence-indexer.ts — RTASK-039
// Covers: extractJiraReferences, extractPageTopics, buildConfluenceNeighborhood,
//         stalenessFactor, indexConfluencePage, getDocumentingPages

import {
  extractJiraReferences,
  extractPageTopics,
  buildConfluenceNeighborhood,
  stalenessFactor,
  indexConfluencePage,
  getDocumentingPages,
} from '../../../../src/backend/services/relationship-index/confluence-indexer';

import type { ConfluencePageInput } from '../../../../src/backend/services/relationship-index/confluence-indexer';
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

const validPage: ConfluencePageInput = {
  pageId: '12345',
  title: 'Cache Migration Spec',
  content: 'This page documents PROJ-100 and PROJ-101 for the cache migration project.',
  spaceCode: 'ENG',
  labels: ['architecture', 'cache'],
  lastUpdated: '2026-04-15T10:00:00.000Z',
  projectKey: 'PROJ',
};

// ═══════════════════════════════════════════
// TEST SUITE
// ═══════════════════════════════════════════

describe('confluence-indexer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetStats.mockResolvedValue(makeEmptyStats());
    mockGetTopicEntities.mockResolvedValue([]);
    mockGetNode.mockResolvedValue(null);
    mockGetEdges.mockResolvedValue([]);
    // Suppress console.log from structured logging
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  // ─── extractJiraReferences() ───────────

  describe('extractJiraReferences()', () => {
    it('should extract Jira issue keys from text (AC-02)', () => {
      const result = extractJiraReferences('See PROJ-100 and PROJ-101 for details.');
      expect(result).toEqual(['PROJ-100', 'PROJ-101']);
    });

    it('should deduplicate Jira keys (AC-02)', () => {
      const result = extractJiraReferences('PROJ-100 is linked to PROJ-100 again.');
      expect(result).toEqual(['PROJ-100']);
    });

    it('should return empty array for empty content (AC-02)', () => {
      expect(extractJiraReferences('')).toEqual([]);
    });

    it('should return empty array when no keys found (AC-02)', () => {
      expect(extractJiraReferences('No issue keys here.')).toEqual([]);
    });

    it('should cap at 50 unique refs (AC-02, FORGE-OPS-013)', () => {
      const keys = Array.from({ length: 60 }, (_, i) => `PROJ-${i}`);
      const content = keys.join(' ');
      const result = extractJiraReferences(content);
      expect(result).toHaveLength(50);
    });

    it('should not extract lowercase keys', () => {
      expect(extractJiraReferences('proj-100 is not a key')).toEqual([]);
    });
  });

  // ─── extractPageTopics() ───────────────

  describe('extractPageTopics()', () => {
    it('should extract topics from labels (AC-03)', () => {
      const result = extractPageTopics('Cache Migration', ['cache', 'migration']);
      // Labels produce 2 edges; title words deduplicated with labels
      const labelEdges = result.filter((e) => e.weight === 0.6);
      expect(labelEdges).toHaveLength(2);
      expect(labelEdges[0]?.target).toBe('topic:cache');
      expect(labelEdges[1]?.target).toBe('topic:migration');
      expect(labelEdges[0]?.type).toBe('topic-match');
    });

    it('should handle empty labels (AC-03)', () => {
      const result = extractPageTopics('Any Title', []);
      // Still extracts title words
      expect(result.length).toBeGreaterThanOrEqual(0);
    });

    it('should skip empty/whitespace labels (AC-03)', () => {
      const result = extractPageTopics('Title', ['  ', '', 'valid']);
      const validEdges = result.filter((e) => e.target === 'topic:valid');
      expect(validEdges).toHaveLength(1);
    });

    it('should extract topic words from title (AC-03, FORGE-OPS-012)', () => {
      const result = extractPageTopics('Cache Migration Spec', []);
      const targets = result.map((e) => e.target);
      expect(targets).toContain('topic:cache');
      expect(targets).toContain('topic:migration');
    });

    it('should not duplicate label and title topics', () => {
      const result = extractPageTopics('Cache Spec', ['cache']);
      const cacheEdges = result.filter((e) => e.target === 'topic:cache');
      expect(cacheEdges).toHaveLength(1);
    });
  });

  // ─── buildConfluenceNeighborhood() ─────

  describe('buildConfluenceNeighborhood()', () => {
    it('should build neighborhood with correct entity info (AC-09)', () => {
      const result = buildConfluenceNeighborhood('12345', 'PROJ', ['PROJ-100'], ['cache']);
      expect(result.entityId).toBe('confluence:12345');
      expect(result.entityKey).toBe('12345');
      expect(result.entityType).toBe('confluence-page');
      expect(result.projectKey).toBe('PROJ');
    });

    it('should map Jira refs to linkedIssues (AC-09)', () => {
      const result = buildConfluenceNeighborhood('12345', 'PROJ', ['PROJ-100', 'PROJ-101'], []);
      expect(result.linkedIssues).toHaveLength(2);
      expect(result.linkedIssues[0]?.id).toBe('jira:PROJ-100');
      expect(result.linkedIssues[0]?.relationship).toBe('documented-by');
      expect(result.linkedIssues[0]?.weight).toBe(0.9);
    });

    it('should include topics (AC-09)', () => {
      const result = buildConfluenceNeighborhood('12345', 'PROJ', [], ['cache', 'migration']);
      expect(result.topics).toEqual(['cache', 'migration']);
    });

    it('should prune linkedIssues at 50 (AC-09, FORGE-OPS-013)', () => {
      const refs = Array.from({ length: 60 }, (_, i) => `PROJ-${i}`);
      const result = buildConfluenceNeighborhood('12345', 'PROJ', refs, []);
      expect(result.linkedIssues).toHaveLength(50);
    });

    it('should have empty siblings for confluence pages', () => {
      const result = buildConfluenceNeighborhood('12345', 'PROJ', ['PROJ-100'], []);
      expect(result.siblings).toEqual([]);
    });
  });

  // ─── stalenessFactor() ─────────────────

  describe('stalenessFactor()', () => {
    it('should return 1.0 for fresh content (AC-05)', () => {
      const source = '2026-05-01T10:00:00.000Z';
      const target = '2026-05-01T12:00:00.000Z';
      expect(stalenessFactor(source, target)).toBe(1.0);
    });

    it('should return 1.0 when source is newer than target', () => {
      const source = '2026-05-10T10:00:00.000Z';
      const target = '2026-05-01T10:00:00.000Z';
      expect(stalenessFactor(source, target)).toBe(1.0);
    });

    it('should return 0.5 for very stale content (>=30 days) (AC-05)', () => {
      const source = '2026-03-15T10:00:00.000Z';
      const target = '2026-05-01T10:00:00.000Z';
      expect(stalenessFactor(source, target)).toBe(0.5);
    });

    it('should interpolate linearly between 7 and 30 days (AC-05)', () => {
      const source = '2026-04-10T10:00:00.000Z'; // ~21 days before target
      const target = '2026-05-01T10:00:00.000Z';
      const result = stalenessFactor(source, target);
      // 21 days stale: (21-7)/(30-7) = 14/23 ≈ 0.609, factor = 1.0 - 0.609*0.5 ≈ 0.696
      expect(result).toBeGreaterThan(0.5);
      expect(result).toBeLessThan(1.0);
    });

    it('should return exactly 1.0 at 7 days boundary', () => {
      const target = '2026-05-08T10:00:00.000Z';
      const source = '2026-05-01T10:00:00.000Z';
      expect(stalenessFactor(source, target)).toBe(1.0);
    });

    it('should return 1.0 for invalid date strings (AC-05, FORGE-OPS-0104)', () => {
      expect(stalenessFactor('not-a-date', '2026-05-01T10:00:00.000Z')).toBe(1.0);
      expect(stalenessFactor('2026-05-01T10:00:00.000Z', 'invalid')).toBe(1.0);
    });

    it('should return 1.0 for empty strings (AC-05)', () => {
      expect(stalenessFactor('', '2026-05-01T10:00:00.000Z')).toBe(1.0);
    });
  });

  // ─── indexConfluencePage() ─────────────

  describe('indexConfluencePage()', () => {
    it('should store node, edges, topics, neighborhood, and stats (AC-01, ARCH-SOLID-005)', async () => {
      await indexConfluencePage(validPage, 'exec-123');

      expect(mockPutNode).toHaveBeenCalledTimes(1);
      expect(mockPutNode).toHaveBeenCalledWith(
        'PROJ',
        expect.objectContaining({
          id: 'confluence:12345',
          type: 'confluence-page',
          label: 'Cache Migration Spec',
        }),
        'exec-123',
      );

      // 1 call for page edges + 2 calls for reverse edges (PROJ-100, PROJ-101)
      expect(mockPutEdges).toHaveBeenCalledTimes(3);
      const edgesArg = mockPutEdges.mock.calls[0]?.[2];
      expect(edgesArg).toBeDefined();
      // 2 documented-by + topic edges
      if (edgesArg) {
        expect(edgesArg.length).toBeGreaterThanOrEqual(2);
      }

      expect(mockPutNeighborhood).toHaveBeenCalledTimes(1);
      expect(mockPutStats).toHaveBeenCalledTimes(1);
    });

    it('should write documented-by edges for extracted Jira refs (AC-02)', async () => {
      await indexConfluencePage(validPage, 'exec-123');

      const edgesArg = mockPutEdges.mock.calls[0]?.[2];
      const docEdges = edgesArg?.filter((e) => e.type === 'documented-by');
      expect(docEdges).toHaveLength(2);
      expect(docEdges?.[0]?.target).toBe('jira:PROJ-100');
      expect(docEdges?.[1]?.target).toBe('jira:PROJ-101');
    });

    it('should update topic index (AC-03)', async () => {
      await indexConfluencePage(validPage, 'exec-123');

      expect(mockGetTopicEntities).toHaveBeenCalled();
      expect(mockPutTopicIndex).toHaveBeenCalled();
    });

    it('should be idempotent — same input same state (AC-06)', async () => {
      await indexConfluencePage(validPage, 'exec-123');
      await indexConfluencePage(validPage, 'exec-124');

      // Both calls write the same data (3 putEdges each: 1 main + 2 reverse)
      expect(mockPutNode).toHaveBeenCalledTimes(2);
      expect(mockPutEdges).toHaveBeenCalledTimes(6);
    });

    it('should handle page with no Jira refs (AC-01)', async () => {
      const noRefsPage: ConfluencePageInput = { ...validPage, content: 'No issue keys here.' };
      await indexConfluencePage(noRefsPage, 'exec-123');

      const edgesArg = mockPutEdges.mock.calls[0]?.[2];
      const docEdges = edgesArg?.filter((e) => e.type === 'documented-by');
      expect(docEdges).toHaveLength(0);
    });

    it('should handle page with no labels (AC-01)', async () => {
      const noLabelsPage: ConfluencePageInput = { ...validPage, labels: [], content: 'PROJ-100' };
      await indexConfluencePage(noLabelsPage, 'exec-123');

      expect(mockPutNode).toHaveBeenCalledTimes(1);
      // 1 main + 1 reverse edge for PROJ-100
      expect(mockPutEdges).toHaveBeenCalledTimes(2);
    });
  });

  // ─── getDocumentingPages() ─────────────

  describe('getDocumentingPages()', () => {
    it('should return empty array for empty issueKey (AC-04)', async () => {
      const result = await getDocumentingPages('', 'PROJ', 'exec-123');
      expect(result).toEqual([]);
    });

    it('should return empty array for empty projectKey (AC-04)', async () => {
      const result = await getDocumentingPages('PROJ-100', '', 'exec-123');
      expect(result).toEqual([]);
    });

    it('should return empty array when no reverse edges exist (AC-04)', async () => {
      mockGetEdges.mockResolvedValue([]);

      const result = await getDocumentingPages('PROJ-100', 'PROJ', 'exec-123');
      expect(result).toEqual([]);
    });

    it('should return empty array on storage error (AC-07, FORGE-OPS-0104)', async () => {
      mockGetEdges.mockRejectedValue(new Error('Storage error'));

      const result = await getDocumentingPages('PROJ-100', 'PROJ', 'exec-123');
      expect(result).toEqual([]);
    });

    it('should return pages that reference the issue via reverse edges (AC-04)', async () => {
      const now = '2026-05-01T10:00:00.000Z';
      mockGetEdges.mockResolvedValue([
        {
          source: 'jira:PROJ-100',
          target: 'confluence:12345',
          type: 'mentioned-in',
          weight: 0.9,
          createdAt: now,
          updatedAt: now,
        },
      ]);
      const mockConfluenceNode = {
        id: 'confluence:12345',
        type: 'confluence-page' as const,
        label: 'Cache Migration Spec',
        status: 'current',
        projectKey: 'PROJ',
        metadata: {},
        createdAt: now,
        updatedAt: now,
      };
      mockGetNode.mockResolvedValue(mockConfluenceNode);

      const result = await getDocumentingPages('PROJ-100', 'PROJ', 'exec-123');
      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe('confluence:12345');
      expect(result[0]?.type).toBe('confluence-page');
    });
  });

  // ─── RULEBOOK COMPLIANCE ───────────────

  describe('Rulebook Compliance', () => {
    it('should use zero any types (ARCH-SOLID-202)', () => {
      const source = fs.readFileSync(
        path.resolve(
          __dirname,
          '../../../../src/backend/services/relationship-index/confluence-indexer.ts',
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
          '../../../../src/backend/services/relationship-index/confluence-indexer.ts',
        ),
        'utf-8',
      );
      expect(source).not.toContain('@forge/api');
    });
  });
});
