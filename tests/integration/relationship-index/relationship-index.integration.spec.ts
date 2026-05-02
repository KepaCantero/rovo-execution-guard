/**
 * Relationship Index Integration Tests
 *
 * Tests bootstrapProjectIndex, indexJiraIssue, and storage interactions
 * using mocked @forge/api for Forge Storage and Jira search.
 *
 * [TEST-QA-202] jest.mock('@forge/api') — Forge is an external runtime, not internal dep.
 * [TEST-QA-056] TDD: tests written against existing public contract.
 * [ARCH-SOLID-202] Zero any — all types explicit.
 * [TEST-QA-204] afterEach cleanup mandatory.
 * [TEST-QA-201] AAA pattern in every test.
 * [ARCH-SOLID-049-03] Test public contract, not internal implementation.
 * [TEST-QA-0954] async/await only, no setTimeout/done().
 */

import type { JiraTicketData } from '../../../src/backend/types/jira-data';
import type {
  GraphStats,
  EntityNode as _EntityNode,
} from '../../../src/backend/types/relationship-index';
import type { JiraIndexInput } from '../../../src/backend/services/relationship-index/jira-indexer';

// ═══════════════════════════════════════════
// FORGE API MOCK — Storage + route
// ═══════════════════════════════════════════

// In-memory Forge Storage backed by a Map
const storageMap = new Map<string, unknown>();
const mockStorageGet = jest.fn((key: string) => Promise.resolve(storageMap.get(key) ?? null));
const mockStorageSet = jest.fn((key: string, value: unknown) => {
  storageMap.set(key, value);
  return Promise.resolve();
});
const mockStorageDelete = jest.fn((key: string) => {
  storageMap.delete(key);
  return Promise.resolve();
});

jest.mock('@forge/api', () => ({
  storage: {
    get: mockStorageGet,
    set: mockStorageSet,
    delete: mockStorageDelete,
  },
  requestJira: jest.fn(),
  requestConfluence: jest.fn(),
  fetch: jest.fn(),
  route: jest.fn((template: TemplateStringsArray, ...values: readonly string[]) => ({
    value: template.reduce(
      (acc: string, str: string, i: number) => acc + str + (values[i] ?? ''),
      '',
    ),
  })),
}));

// Mock jira-adapter's searchByJQL so bootstrapProjectIndex uses our mock
const mockSearchByJQL = jest.fn<Promise<readonly JiraTicketData[]>, [string, number?, string?]>();
jest.mock('../../../src/backend/services/jira/jira-adapter', () => ({
  searchByJQL: mockSearchByJQL,
}));

// Import SUT after mock setup
import {
  bootstrapProjectIndex,
  indexJiraIssue,
} from '../../../src/backend/services/relationship-index/jira-indexer';
import {
  extractJiraReferences,
  extractPageTopics,
  stalenessFactor,
} from '../../../src/backend/services/relationship-index/confluence-indexer';
import { JiraApiError } from '../../../src/backend/types/errors';

// ═══════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════

function makeTicketData(overrides: Partial<JiraTicketData> = {}): JiraTicketData {
  return {
    key: 'ROVO-1',
    summary: 'Implement auth flow',
    description: 'OAuth 2.0 with PKCE',
    status: 'In Progress',
    assignee: 'Maria Garcia',
    reporter: 'John Smith',
    priority: 'High',
    issueType: 'Story',
    labels: ['auth', 'security'],
    projectKey: 'ROVO',
    created: '2025-01-15T09:30:00.000+0000',
    updated: '2025-02-20T14:45:22.000+0000',
    ...overrides,
  };
}

function makeIndexInput(overrides: Partial<JiraIndexInput> = {}): JiraIndexInput {
  return {
    issueKey: 'ROVO-1',
    projectKey: 'ROVO',
    summary: 'Implement auth flow',
    description: 'OAuth 2.0 with PKCE',
    issueType: 'Story',
    status: 'In Progress',
    labels: ['auth', 'security'],
    ...overrides,
  };
}

// ═══════════════════════════════════════════
// TEST SUITE
// ═══════════════════════════════════════════

describe('Relationship Index Integration', () => {
  beforeEach(() => {
    storageMap.clear();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─── bootstrapProjectIndex() ──────────

  describe('bootstrapProjectIndex()', () => {
    // AC-01: Indexes all issues from a project

    it('should index all issues returned by searchByJQL (AC-01)', async () => {
      // Arrange — use fake timers to skip the 110ms rate-limit delay
      jest.useFakeTimers();
      const tickets: readonly JiraTicketData[] = [
        makeTicketData({ key: 'ROVO-1' }),
        makeTicketData({ key: 'ROVO-2', summary: 'Fix login bug', labels: ['bug'] }),
        makeTicketData({ key: 'ROVO-3', summary: 'Add tests', labels: ['testing'] }),
      ];
      mockSearchByJQL.mockResolvedValueOnce(tickets);

      // Act
      const promise = bootstrapProjectIndex('ROVO', 'exec-001');
      await jest.advanceTimersByTimeAsync(500);
      const stats: GraphStats = await promise;

      // Assert
      expect(mockSearchByJQL).toHaveBeenCalledWith(
        'project = ROVO ORDER BY updated DESC',
        50,
        'exec-001',
      );
      expect(stats.totalNodes).toBe(3);
      expect(stats.nodesByType['jira-issue']).toBe(3);
      // Labels: ROVO-1 has ['auth','security'], ROVO-2 has ['bug'], ROVO-3 has ['testing'] = 4 topics
      expect(stats.topicCount).toBe(4);
      // Verify stats reflect indexed nodes
      expect(stats.lastUpdated).toBeTruthy();

      jest.useRealTimers();
    });

    // AC-02: Empty project returns zero stats

    it('should return zero stats for empty project (AC-02)', async () => {
      // Arrange
      mockSearchByJQL.mockResolvedValueOnce([]);

      // Act
      const stats: GraphStats = await bootstrapProjectIndex('EMPTY', 'exec-002');

      // Assert
      expect(stats.totalNodes).toBe(0);
      expect(stats.totalEdges).toBe(0);
      expect(stats.nodesByType).toEqual({
        'jira-issue': 0,
        'jira-epic': 0,
        'confluence-page': 0,
        'github-pr': 0,
        topic: 0,
      });
    });

    // AC-03: searchByJQL failure propagates

    it('should propagate JiraApiError when searchByJQL fails (AC-03)', async () => {
      // Arrange
      mockSearchByJQL.mockRejectedValueOnce(
        new JiraApiError('search failed', 'JIRA_API_ERROR', 'exec-003'),
      );

      // Act
      const error = await bootstrapProjectIndex('ROVO', 'exec-003').catch(
        (err: unknown) => err as Error,
      );

      // Assert
      expect(error).toBeInstanceOf(JiraApiError);
    });
  });

  // ─── indexJiraIssue() ─────────────────

  describe('indexJiraIssue()', () => {
    // AC-04: Issue with links creates edges + neighborhood

    it('should create node, edges, neighborhood, and update stats (AC-04)', async () => {
      // Arrange
      const input = makeIndexInput({
        issueLinks: [
          { type: 'blocks', direction: 'outward', targetKey: 'ROVO-2' },
          { type: 'relates', direction: 'inward', targetKey: 'ROVO-3' },
        ],
      });

      // Act
      await indexJiraIssue(input, 'exec-004');

      // Assert — node stored
      const nodeKey = Array.from(storageMap.keys()).find((k) => k.includes('jira:ROVO-1'));
      expect(nodeKey).toBeTruthy();
      const node = storageMap.get(nodeKey ?? '') as _EntityNode;
      expect(node.id).toBe('jira:ROVO-1');
      expect(node.type).toBe('jira-issue');

      // Stats updated — key pattern is "stats:<projectKey>"
      const statsKey = Array.from(storageMap.keys()).find((k) => k.startsWith('stats:'));
      expect(statsKey).toBeTruthy();
      const stats = storageMap.get(statsKey ?? '') as GraphStats;
      expect(stats.totalNodes).toBe(1);
      expect(stats.totalEdges).toBeGreaterThan(0);
    });

    // AC-05: Issue without links creates node with empty edges

    it('should create node with topic-match edges even without links (AC-05)', async () => {
      // Arrange — no issueLinks, but has labels → topic-match edges
      const input = makeIndexInput({ labels: ['auth'] });

      // Act
      await indexJiraIssue(input, 'exec-005');

      // Assert — node exists
      const nodeKey = Array.from(storageMap.keys()).find((k) => k.includes('jira:ROVO-1'));
      expect(nodeKey).toBeTruthy();

      // Topic index created for 'auth' label
      const topicKey = Array.from(storageMap.keys()).find((k) => k.includes('topic:auth'));
      expect(topicKey).toBeTruthy();
      const topicEntities = storageMap.get(topicKey ?? '') as string[];
      expect(topicEntities).toContain('jira:ROVO-1');
    });
  });

  // ─── Confluence Indexer Pure Functions ─

  describe('extractJiraReferences()', () => {
    // AC-06: Extracts Jira issue keys from content

    it('should extract Jira issue keys from page content (AC-06)', () => {
      // Arrange
      const content = 'This page documents ROVO-1 and ROVO-2, also mentions PROJ-999.';

      // Act
      const refs = extractJiraReferences(content);

      // Assert
      expect(refs).toContain('ROVO-1');
      expect(refs).toContain('ROVO-2');
      expect(refs).toContain('PROJ-999');
    });

    it('should return empty array when no keys found', () => {
      // Arrange
      const content = 'This page has no issue references.';

      // Act
      const refs = extractJiraReferences(content);

      // Assert
      expect(refs).toEqual([]);
    });

    it('should cap at 50 unique references', () => {
      // Arrange — generate 60 unique keys
      const keys = Array.from({ length: 60 }, (_, i) => `PROJ-${i + 1}`);
      const content = keys.join(', ');

      // Act
      const refs = extractJiraReferences(content);

      // Assert
      expect(refs.length).toBeLessThanOrEqual(50);
    });
  });

  describe('extractPageTopics()', () => {
    // AC-07: Creates topic-match edges from labels and title

    it('should create topic edges from labels and title words (AC-07)', () => {
      // Arrange
      const title = 'Authentication Architecture';
      const labels = ['security', 'oauth'];

      // Act
      const edges = extractPageTopics(title, labels);

      // Assert
      expect(edges.length).toBeGreaterThan(0);
      const types = edges.map((e) => e.type);
      expect(types.every((t) => t === 'topic-match')).toBe(true);
      // Label-based topics should have weight 0.6
      const labelEdges = edges.filter(
        (e) => e.target.includes('security') || e.target.includes('oauth'),
      );
      expect(labelEdges.length).toBeGreaterThan(0);
      labelEdges.forEach((e) => expect(e.weight).toBe(0.6));
    });
  });

  describe('stalenessFactor()', () => {
    // AC-08: Fresh sources return 1.0, stale decay to 0.5

    it('should return 1.0 for both updated within 7 days (AC-08)', () => {
      // Arrange
      const now = new Date();
      const recent = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString();

      // Act
      const factor = stalenessFactor(recent, recent);

      // Assert
      expect(factor).toBe(1.0);
    });

    it('should decay towards 0.5 for 30+ day old sources', () => {
      // Arrange — source is 35 days older than target
      const now = new Date();
      const target = now.toISOString();
      const source = new Date(now.getTime() - 35 * 24 * 60 * 60 * 1000).toISOString();

      // Act
      const factor = stalenessFactor(source, target);

      // Assert
      expect(factor).toBe(0.5);
    });

    it('should interpolate between 7 and 30 days', () => {
      // Arrange — source is 18 days older than target (roughly midway)
      const now = new Date();
      const target = now.toISOString();
      const source = new Date(now.getTime() - 18 * 24 * 60 * 60 * 1000).toISOString();

      // Act
      const factor = stalenessFactor(source, target);

      // Assert — should be between 0.5 and 1.0
      expect(factor).toBeGreaterThan(0.5);
      expect(factor).toBeLessThan(1.0);
    });
  });
});
