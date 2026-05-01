/**
 * TEST: Jira Relationship Indexer — 6 exported functions
 *
 * Covers: buildJiraNode, extractJiraEdges, buildJiraNeighborhood,
 * indexJiraIssue, getJiraRelationshipContext, bootstrapProjectIndex.
 *
 * AC refs: AC-01 through AC-06 in jira-indexer.reqs.md
 */

import {
  buildJiraNode,
  extractJiraEdges,
  buildJiraNeighborhood,
  indexJiraIssue,
  getJiraRelationshipContext,
  bootstrapProjectIndex,
  EMPTY_RELATIONSHIP_CONTEXT,
} from '../../../../src/backend/services/relationship-index/jira-indexer';

import type {
  JiraIndexInput,
  JiraIssueLinkInput,
} from '../../../../src/backend/services/relationship-index/jira-indexer';

import type { RelationshipContext } from '../../../../src/backend/types/relationship-index';

// ═══════════════════════════════════════════
// MOCKS
// ═══════════════════════════════════════════

jest.mock('../../../../src/backend/services/relationship-index/relationship-storage', () => ({
  putNode: jest.fn().mockResolvedValue(undefined),
  putEdges: jest.fn().mockResolvedValue(undefined),
  getTopicEntities: jest.fn().mockResolvedValue([]),
  putTopicIndex: jest.fn().mockResolvedValue(undefined),
  getStats: jest.fn().mockResolvedValue({
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
  }),
  putStats: jest.fn().mockResolvedValue(undefined),
  buildRelationshipContext: jest.fn().mockResolvedValue({
    siblings: [],
    documentation: [],
    pullRequests: [],
    topics: [],
    crossReferences: [],
    rankedItems: [],
    assembledAt: '2026-05-01T00:00:00Z',
  }),
  getNeighborhood: jest.fn().mockResolvedValue(null),
  putNeighborhood: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../../../src/backend/services/jira/jira-adapter', () => ({
  searchByJQL: jest.fn().mockResolvedValue([]),
}));

import {
  putNode,
  putEdges,
  getTopicEntities,
  putTopicIndex,
  putStats,
  buildRelationshipContext,
  getNeighborhood,
  putNeighborhood,
} from '../../../../src/backend/services/relationship-index/relationship-storage';

import { searchByJQL } from '../../../../src/backend/services/jira/jira-adapter';

// ═══════════════════════════════════════════
// FIXTURES
// ═══════════════════════════════════════════

const FULL_INPUT: JiraIndexInput = {
  issueKey: 'PROJ-123',
  projectKey: 'PROJ',
  summary: 'Implement user authentication flow',
  description: 'Add login, logout, and session management for the application',
  issueType: 'Story',
  status: 'In Progress',
  labels: ['auth', 'security'],
  epicKey: 'PROJ-100',
  issueLinks: [
    { type: 'Blocks', direction: 'outward', targetKey: 'PROJ-200' },
    { type: 'Relates', direction: 'inward', targetKey: 'PROJ-300' },
  ],
};

const MINIMAL_INPUT: JiraIndexInput = {
  issueKey: 'PROJ-456',
  projectKey: 'PROJ',
  summary: 'Fix typo in readme',
  description: '',
  issueType: 'Task',
  status: 'To Do',
  labels: [],
};

const EPIC_INPUT: JiraIndexInput = {
  issueKey: 'PROJ-100',
  projectKey: 'PROJ',
  summary: 'Authentication Epic',
  description: 'Epic for all auth-related stories',
  issueType: 'Epic',
  status: 'In Progress',
  labels: ['auth'],
};

// ═══════════════════════════════════════════
// TEST SUITE
// ═══════════════════════════════════════════

describe('jira-indexer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  /** Safe array element access — throws descriptive error if missing. */
  const at = <T>(arr: readonly T[], idx: number): T => {
    const val = arr[idx];
    if (val === undefined) throw new Error(`Index ${idx} out of bounds (length ${arr.length})`);
    return val;
  };

  // ═══════════════════════════════════════════
  // buildJiraNode (AC-01)
  // ═══════════════════════════════════════════

  describe('buildJiraNode()', () => {
    it('should map standard issue to EntityNode (AC-01)', () => {
      const node = buildJiraNode(FULL_INPUT);

      expect(node.id).toBe('jira:PROJ-123');
      expect(node.type).toBe('jira-issue');
      expect(node.label).toBe('Implement user authentication flow');
      expect(node.status).toBe('In Progress');
      expect(node.projectKey).toBe('PROJ');
      expect(node.metadata.issueType).toBe('Story');
      expect(node.metadata.labels).toBe('auth,security');
      expect(node.metadata.epicKey).toBe('PROJ-100');
      expect(node.createdAt).toBeDefined();
      expect(node.updatedAt).toBeDefined();
    });

    it('should map epic to jira-epic type (AC-01)', () => {
      const node = buildJiraNode(EPIC_INPUT);

      expect(node.id).toBe('jira:PROJ-100');
      expect(node.type).toBe('jira-epic');
    });

    it('should handle minimal input (AC-01)', () => {
      const node = buildJiraNode(MINIMAL_INPUT);

      expect(node.id).toBe('jira:PROJ-456');
      expect(node.type).toBe('jira-issue');
      expect(node.metadata.epicKey).toBe('');
      expect(node.metadata.labels).toBe('');
    });

    it('should truncate description preview to 200 chars (AC-01)', () => {
      const longDesc = 'x'.repeat(500);
      const input: JiraIndexInput = { ...FULL_INPUT, description: longDesc };
      const node = buildJiraNode(input);

      expect(node.metadata.descriptionPreview).toHaveLength(200);
    });

    it('should normalize epic case-insensitively (AC-01)', () => {
      const input: JiraIndexInput = { ...FULL_INPUT, issueType: 'EPIC' };
      const node = buildJiraNode(input);

      expect(node.type).toBe('jira-epic');
    });
  });

  // ═══════════════════════════════════════════
  // extractJiraEdges (AC-02)
  // ═══════════════════════════════════════════

  describe('extractJiraEdges()', () => {
    it('should extract all edge types (AC-02, FORGE-OPS-012)', () => {
      const edges = extractJiraEdges(FULL_INPUT);

      // parent-of: 1 (epic)
      const parentEdges = edges.filter((e) => e.type === 'parent-of');
      expect(parentEdges).toHaveLength(1);
      expect(at(parentEdges, 0).source).toBe('jira:PROJ-123');
      expect(at(parentEdges, 0).target).toBe('jira:PROJ-100');
      expect(at(parentEdges, 0).weight).toBe(1.0);

      // related-to: 2 (issue links)
      const relatedEdges = edges.filter((e) => e.type === 'related-to');
      expect(relatedEdges).toHaveLength(2);
      expect(at(relatedEdges, 0).weight).toBe(0.8);
      expect(at(relatedEdges, 0).target).toBe('jira:PROJ-200');
      expect(at(relatedEdges, 1).target).toBe('jira:PROJ-300');

      // topic-match: 2 (labels)
      const topicEdges = edges.filter((e) => e.type === 'topic-match');
      expect(topicEdges).toHaveLength(2);
      expect(at(topicEdges, 0).weight).toBe(0.6);
      expect(topicEdges.map((e) => e.target)).toEqual(
        expect.arrayContaining(['topic:auth', 'topic:security']),
      );
    });

    it('should return empty array for minimal input (AC-02)', () => {
      const edges = extractJiraEdges(MINIMAL_INPUT);

      expect(edges).toHaveLength(0);
    });

    it('should produce parent-of without issue links (AC-02)', () => {
      const input: JiraIndexInput = { ...FULL_INPUT, issueLinks: undefined };
      const edges = extractJiraEdges(input);

      expect(edges.filter((e) => e.type === 'parent-of')).toHaveLength(1);
      expect(edges.filter((e) => e.type === 'related-to')).toHaveLength(0);
    });

    it('should skip empty labels (AC-02)', () => {
      const input: JiraIndexInput = { ...FULL_INPUT, labels: ['', '  ', 'valid'] };
      const edges = extractJiraEdges(input);
      const topicEdges = edges.filter((e) => e.type === 'topic-match');

      expect(topicEdges).toHaveLength(1);
      expect(at(topicEdges, 0).target).toBe('topic:valid');
    });

    it('should normalize labels to lowercase (AC-02, FORGE-OPS-012)', () => {
      const input: JiraIndexInput = { ...FULL_INPUT, labels: ['Auth'] };
      const edges = extractJiraEdges(input);
      const topicEdges = edges.filter((e) => e.type === 'topic-match');

      expect(at(topicEdges, 0).target).toBe('topic:auth');
    });

    it('should skip issue links with empty targetKey (AC-02)', () => {
      const input: JiraIndexInput = {
        ...FULL_INPUT,
        issueLinks: [{ type: 'Blocks', direction: 'outward', targetKey: '' }],
      };
      const edges = extractJiraEdges(input);
      const relatedEdges = edges.filter((e) => e.type === 'related-to');

      expect(relatedEdges).toHaveLength(0);
    });
  });

  // ═══════════════════════════════════════════
  // buildJiraNeighborhood (AC-03)
  // ═══════════════════════════════════════════

  describe('buildJiraNeighborhood()', () => {
    it('should build neighborhood from edges (AC-03)', () => {
      const edges = extractJiraEdges(FULL_INPUT);
      const neighborhood = buildJiraNeighborhood(FULL_INPUT, edges);

      expect(neighborhood.entityId).toBe('jira:PROJ-123');
      expect(neighborhood.entityKey).toBe('PROJ-123');
      expect(neighborhood.entityType).toBe('jira-issue');
      expect(neighborhood.projectKey).toBe('PROJ');
      expect(neighborhood.siblings).toHaveLength(1); // epic
      expect(at(neighborhood.siblings, 0).key).toBe('PROJ-100');
      expect(neighborhood.linkedIssues).toHaveLength(2); // 2 issue links
      expect(neighborhood.topics).toEqual(['auth', 'security']);
      expect(neighborhood.updatedAt).toBeDefined();
    });

    it('should build epic neighborhood (AC-03)', () => {
      const edges = extractJiraEdges(EPIC_INPUT);
      const neighborhood = buildJiraNeighborhood(EPIC_INPUT, edges);

      expect(neighborhood.entityType).toBe('jira-epic');
    });

    it('should prune at 50 neighbors (AC-03, FORGE-OPS-013)', () => {
      const manyLinks: JiraIssueLinkInput[] = Array.from({ length: 100 }, (_, i) => ({
        type: 'Relates',
        direction: 'inward' as const,
        targetKey: `PROJ-${i}`,
      }));
      const input: JiraIndexInput = { ...FULL_INPUT, issueLinks: manyLinks };
      const edges = extractJiraEdges(input);
      const neighborhood = buildJiraNeighborhood(input, edges);

      expect(neighborhood.linkedIssues.length).toBeLessThanOrEqual(50);
    });

    it('should handle empty edges (AC-03)', () => {
      const neighborhood = buildJiraNeighborhood(MINIMAL_INPUT, []);

      expect(neighborhood.siblings).toHaveLength(0);
      expect(neighborhood.linkedIssues).toHaveLength(0);
      expect(neighborhood.topics).toHaveLength(0);
    });
  });

  // ═══════════════════════════════════════════
  // indexJiraIssue (AC-04)
  // ═══════════════════════════════════════════

  describe('indexJiraIssue()', () => {
    it('should store node, edges, topic index, neighborhood, and stats (AC-04, ARCH-SOLID-005)', async () => {
      await indexJiraIssue(FULL_INPUT, 'exec-123');

      expect(putNode).toHaveBeenCalledWith(
        'PROJ',
        expect.objectContaining({ id: 'jira:PROJ-123' }),
        'exec-123',
      );
      expect(putEdges).toHaveBeenCalledWith('PROJ', 'jira:PROJ-123', expect.any(Array), 'exec-123');
      expect(putNeighborhood).toHaveBeenCalledWith(
        'PROJ',
        expect.objectContaining({ entityId: 'jira:PROJ-123' }),
        'exec-123',
      );
      expect(putStats).toHaveBeenCalledWith(
        'PROJ',
        expect.objectContaining({ totalNodes: 1 }),
        'exec-123',
      );
    });

    it('should update topic index for each label (AC-04)', async () => {
      await indexJiraIssue(FULL_INPUT, 'exec-456');

      // Two labels: auth and security
      expect(getTopicEntities).toHaveBeenCalledTimes(2);
      expect(putTopicIndex).toHaveBeenCalledTimes(2);
    });

    it('should not duplicate entity in topic index (AC-04)', async () => {
      (getTopicEntities as jest.Mock).mockResolvedValue(['jira:PROJ-123']);

      await indexJiraIssue(FULL_INPUT, 'exec-789');

      // Should not call putTopicIndex since entity already exists
      expect(putTopicIndex).toHaveBeenCalledTimes(0);
    });

    it('should handle minimal input without errors (AC-04)', async () => {
      await expect(indexJiraIssue(MINIMAL_INPUT, 'exec-min')).resolves.toBeUndefined();

      expect(putNode).toHaveBeenCalled();
      expect(putEdges).toHaveBeenCalledWith('PROJ', 'jira:PROJ-456', [], 'exec-min');
    });
  });

  // ═══════════════════════════════════════════
  // getJiraRelationshipContext (AC-05)
  // ═══════════════════════════════════════════

  describe('getJiraRelationshipContext()', () => {
    it('should return EMPTY_RELATIONSHIP_CONTEXT for empty issueKey (AC-05)', async () => {
      const result = await getJiraRelationshipContext('', 'PROJ', 'exec-1');

      expect(result).toBe(EMPTY_RELATIONSHIP_CONTEXT);
    });

    it('should return EMPTY_RELATIONSHIP_CONTEXT for empty projectKey (AC-05)', async () => {
      const result = await getJiraRelationshipContext('PROJ-123', '', 'exec-2');

      expect(result).toBe(EMPTY_RELATIONSHIP_CONTEXT);
    });

    it('should read neighborhood first (O(1)) (AC-05)', async () => {
      const mockNeighborhood = {
        entityId: 'jira:PROJ-123',
        entityKey: 'PROJ-123',
        entityType: 'jira-issue',
        projectKey: 'PROJ',
        siblings: [],
        linkedIssues: [],
        topics: ['auth'],
        updatedAt: '2026-05-01T00:00:00Z',
      };
      (getNeighborhood as jest.Mock).mockResolvedValue(mockNeighborhood);

      const result = await getJiraRelationshipContext('PROJ-123', 'PROJ', 'exec-3');

      expect(getNeighborhood).toHaveBeenCalledWith('PROJ', 'jira:PROJ-123', 'exec-3');
      expect(result.assembledAt).toBeDefined();
      expect(result.topics).toEqual([]);
    });

    it('should fall back to buildRelationshipContext when no neighborhood (AC-05)', async () => {
      (getNeighborhood as jest.Mock).mockResolvedValue(null);
      const fallbackContext: RelationshipContext = {
        siblings: [],
        documentation: [],
        pullRequests: [],
        topics: [],
        crossReferences: [],
        rankedItems: [],
        assembledAt: '2026-05-01T00:00:00Z',
      };
      (buildRelationshipContext as jest.Mock).mockResolvedValue(fallbackContext);

      const result = await getJiraRelationshipContext('PROJ-123', 'PROJ', 'exec-4');

      expect(buildRelationshipContext).toHaveBeenCalledWith('PROJ', 'jira:PROJ-123', 'exec-4');
      expect(result.assembledAt).toBe('2026-05-01T00:00:00Z');
    });

    it('should return EMPTY_RELATIONSHIP_CONTEXT on error (AC-05, FORGE-OPS-0104)', async () => {
      (getNeighborhood as jest.Mock).mockRejectedValue(new Error('Storage error'));
      (buildRelationshipContext as jest.Mock).mockRejectedValue(new Error('Traversal error'));

      const result = await getJiraRelationshipContext('PROJ-123', 'PROJ', 'exec-5');

      expect(result).toBe(EMPTY_RELATIONSHIP_CONTEXT);
    });
  });

  // ═══════════════════════════════════════════
  // bootstrapProjectIndex (AC-06)
  // ═══════════════════════════════════════════

  describe('bootstrapProjectIndex()', () => {
    it('should call searchByJQL with correct JQL (AC-06)', async () => {
      (searchByJQL as jest.Mock).mockResolvedValue([]);

      await bootstrapProjectIndex('PROJ', 'exec-boot');

      expect(searchByJQL).toHaveBeenCalledWith(
        'project = PROJ ORDER BY updated DESC',
        50,
        'exec-boot',
      );
    });

    it('should index each issue found (AC-06)', async () => {
      const mockIssues = [
        {
          key: 'PROJ-1',
          summary: 'Issue 1',
          description: 'Desc 1',
          status: 'Done',
          issueType: 'Story',
          labels: ['bug'],
          projectKey: 'PROJ',
          created: '2026-01-01T00:00:00Z',
          updated: '2026-04-01T00:00:00Z',
        },
        {
          key: 'PROJ-2',
          summary: 'Issue 2',
          description: 'Desc 2',
          status: 'In Progress',
          issueType: 'Task',
          labels: [],
          projectKey: 'PROJ',
          created: '2026-01-01T00:00:00Z',
          updated: '2026-04-01T00:00:00Z',
        },
      ];
      (searchByJQL as jest.Mock).mockResolvedValue(mockIssues);

      const stats = await bootstrapProjectIndex('PROJ', 'exec-boot2');

      expect(putNode).toHaveBeenCalledTimes(2);
      expect(stats).toBeDefined();
    });

    it('should return stats for empty project (AC-06)', async () => {
      (searchByJQL as jest.Mock).mockResolvedValue([]);

      const stats = await bootstrapProjectIndex('EMPTY', 'exec-boot3');

      expect(stats.totalNodes).toBe(0);
    });
  });

  // ═══════════════════════════════════════════
  // EMPTY_RELATIONSHIP_CONTEXT
  // ═══════════════════════════════════════════

  describe('EMPTY_RELATIONSHIP_CONTEXT', () => {
    it('should have all empty arrays', () => {
      expect(EMPTY_RELATIONSHIP_CONTEXT.siblings).toEqual([]);
      expect(EMPTY_RELATIONSHIP_CONTEXT.documentation).toEqual([]);
      expect(EMPTY_RELATIONSHIP_CONTEXT.pullRequests).toEqual([]);
      expect(EMPTY_RELATIONSHIP_CONTEXT.topics).toEqual([]);
      expect(EMPTY_RELATIONSHIP_CONTEXT.crossReferences).toEqual([]);
      expect(EMPTY_RELATIONSHIP_CONTEXT.rankedItems).toEqual([]);
      expect(EMPTY_RELATIONSHIP_CONTEXT.assembledAt).toBe('');
    });
  });
});
