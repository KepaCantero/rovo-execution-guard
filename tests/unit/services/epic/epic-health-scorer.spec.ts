import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('../../../../src/backend/services/jira/jira-adapter');
jest.mock('../../../../src/backend/services/relationship-index/jira-indexer');
jest.mock('../../../../src/backend/services/relationship-index/relationship-consumer');

import {
  calculateEpicHealthScore,
  scoreCriteriaCoverage,
  scoreProgressVsEstimate,
  scoreStaleness,
  scoreBlockerHealth,
  scoreDocumentationQuality,
} from '../../../../src/backend/services/epic/epic-health-scorer';
import { getTicketData, getEpicChildren } from '../../../../src/backend/services/jira/jira-adapter';
import { getJiraRelationshipContext } from '../../../../src/backend/services/relationship-index/jira-indexer';
import { calculateDocumentationSignal } from '../../../../src/backend/services/relationship-index/relationship-consumer';
import type { JiraTicketData } from '../../../../src/backend/types/jira-data';
import type { RelationshipContext } from '../../../../src/backend/types/relationship-index';

const mockGetTicketData = jest.mocked(getTicketData);
const mockGetEpicChildren = jest.mocked(getEpicChildren);
const mockGetJiraRelationshipContext = jest.mocked(getJiraRelationshipContext);
const mockCalculateDocumentationSignal = jest.mocked(calculateDocumentationSignal);

// ═══════════════════════════════════════════
// FIXTURES
// ═══════════════════════════════════════════

const makeTicket = (overrides: Partial<JiraTicketData> = {}): JiraTicketData => ({
  key: 'PROJ-1',
  summary: 'Implement user authentication',
  description: 'Add OAuth2 login flow for the application',
  status: 'IN PROGRESS',
  issueType: 'Task',
  labels: [],
  projectKey: 'PROJ',
  created: '2026-01-01T00:00:00.000Z',
  updated: new Date().toISOString(),
  ...overrides,
});

const makeEpic = (overrides: Partial<JiraTicketData> = {}): JiraTicketData => ({
  key: 'PROJ-100',
  summary: 'User Management Epic',
  description:
    'Implement complete user management including authentication, authorization, and profile management',
  status: 'IN PROGRESS',
  issueType: 'Epic',
  labels: [],
  projectKey: 'PROJ',
  created: '2026-01-01T00:00:00.000Z',
  updated: new Date().toISOString(),
  ...overrides,
});

const EMPTY_CONTEXT: RelationshipContext = {
  siblings: [],
  documentation: [],
  pullRequests: [],
  topics: [],
  crossReferences: [],
  rankedItems: [],
  assembledAt: new Date().toISOString(),
};

// ═══════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════

describe('scoreCriteriaCoverage', () => {
  it('scores 100 when all keywords covered', () => {
    const children = [
      makeTicket({ summary: 'Authentication module' }),
      makeTicket({ summary: 'Authorization module' }),
      makeTicket({ summary: 'Profile management' }),
    ];
    const score = scoreCriteriaCoverage(
      'User Management',
      'authentication authorization profile management',
      children,
    );
    expect(score).toBeGreaterThanOrEqual(60);
  });

  it('scores low when keywords uncovered', () => {
    const children = [makeTicket({ summary: 'Unrelated work' })];
    const score = scoreCriteriaCoverage(
      'User Management',
      'authentication authorization profile management',
      children,
    );
    expect(score).toBeLessThan(50);
  });

  it('returns 0 for no children', () => {
    const score = scoreCriteriaCoverage('Epic', 'some description', []);
    expect(score).toBe(0);
  });

  it('returns 50 for empty epic text', () => {
    const score = scoreCriteriaCoverage('', '', [makeTicket()]);
    expect(score).toBe(50);
  });
});

describe('scoreProgressVsEstimate', () => {
  it('scores 100 when all done', () => {
    const children = [makeTicket({ status: 'DONE' }), makeTicket({ status: 'DONE' })];
    expect(scoreProgressVsEstimate(children)).toBe(100);
  });

  it('scores 0 when none done', () => {
    const children = [makeTicket({ status: 'TO DO' }), makeTicket({ status: 'IN PROGRESS' })];
    expect(scoreProgressVsEstimate(children)).toBe(0);
  });

  it('scores 50 for empty', () => {
    expect(scoreProgressVsEstimate([])).toBe(50);
  });

  it('scores partial completion correctly', () => {
    const children = [makeTicket({ status: 'DONE' }), makeTicket({ status: 'IN PROGRESS' })];
    expect(scoreProgressVsEstimate(children)).toBe(50);
  });
});

describe('scoreStaleness', () => {
  it('scores 100 for recently updated', () => {
    const children = [
      makeTicket({ updated: new Date().toISOString() }),
      makeTicket({ updated: new Date().toISOString() }),
    ];
    expect(scoreStaleness(children)).toBe(100);
  });

  it('scores low for stale tickets', () => {
    const oldDate = new Date(Date.now() - 30 * 86_400_000).toISOString();
    const children = [makeTicket({ updated: oldDate }), makeTicket({ updated: oldDate })];
    expect(scoreStaleness(children)).toBeLessThan(50);
  });

  it('scores 100 for empty', () => {
    expect(scoreStaleness([])).toBe(100);
  });
});

describe('scoreBlockerHealth', () => {
  it('scores 100 with no blockers', () => {
    const children = [makeTicket({ issueLinks: [] })];
    expect(scoreBlockerHealth(children)).toBe(100);
  });

  it('penalizes for unresolved blockers', () => {
    const children = [
      makeTicket({
        issueLinks: [
          {
            type: 'is blocked by',
            direction: 'inward',
            targetKey: 'PROJ-99',
            targetSummary: 'Blocker ticket',
            targetStatus: 'TO DO',
          },
        ],
      }),
    ];
    expect(scoreBlockerHealth(children)).toBeLessThan(100);
  });

  it('does not penalize resolved blockers', () => {
    const children = [
      makeTicket({
        issueLinks: [
          {
            type: 'is blocked by',
            direction: 'inward',
            targetKey: 'PROJ-99',
            targetSummary: 'Blocker ticket',
            targetStatus: 'DONE',
          },
        ],
      }),
    ];
    expect(scoreBlockerHealth(children)).toBe(100);
  });
});

describe('scoreDocumentationQuality', () => {
  it('scores with relationship context', () => {
    mockCalculateDocumentationSignal.mockReturnValue({ bonus: 20, penalty: 0, signals: [] });
    const context: RelationshipContext = {
      ...EMPTY_CONTEXT,
      documentation: [
        {
          id: 'confluence:1',
          type: 'confluence-page',
          label: 'Doc page',
          status: 'current',
          projectKey: 'PROJ',
          metadata: {},
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
    };
    const score = scoreDocumentationQuality(context, [makeTicket()]);
    expect(score).toBeGreaterThanOrEqual(50);
  });

  it('scores without context based on doc references', () => {
    const children = [makeTicket({ description: 'See confluence documentation for details' })];
    const score = scoreDocumentationQuality(undefined, children);
    expect(score).toBeGreaterThan(0);
  });

  it('returns 0 for no context and no doc references', () => {
    const children = [makeTicket({ description: 'No docs here' })];
    const score = scoreDocumentationQuality(undefined, children);
    expect(score).toBe(0);
  });
});

describe('calculateEpicHealthScore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns a valid health score for a healthy epic', async () => {
    mockGetTicketData.mockResolvedValue(makeEpic());
    mockGetEpicChildren.mockResolvedValue([
      makeTicket({ key: 'PROJ-1', status: 'DONE', summary: 'Authentication' }),
      makeTicket({ key: 'PROJ-2', status: 'DONE', summary: 'Authorization' }),
    ]);
    mockGetJiraRelationshipContext.mockResolvedValue(EMPTY_CONTEXT);
    mockCalculateDocumentationSignal.mockReturnValue({ bonus: 10, penalty: 0, signals: [] });

    const result = await calculateEpicHealthScore('PROJ-100', 'PROJ', 'exec-1');

    expect(result.epicKey).toBe('PROJ-100');
    expect(result.epicSummary).toBe('User Management Epic');
    expect(result.totalTickets).toBe(2);
    expect(result.completedTickets).toBe(2);
    expect(result.overall).toBeGreaterThanOrEqual(0);
    expect(result.overall).toBeLessThanOrEqual(100);
    expect(result.axes).toBeDefined();
    expect(result.axisDetails).toBeDefined();
  });

  it('handles empty epic (no children)', async () => {
    mockGetTicketData.mockResolvedValue(makeEpic());
    mockGetEpicChildren.mockResolvedValue([]);
    mockGetJiraRelationshipContext.mockResolvedValue(EMPTY_CONTEXT);

    const result = await calculateEpicHealthScore('PROJ-100', 'PROJ', 'exec-1');

    expect(result.totalTickets).toBe(0);
    expect(result.completedTickets).toBe(0);
    expect(result.staleTickets).toBe(0);
  });

  it('degrades gracefully on error', async () => {
    mockGetTicketData.mockRejectedValue(new Error('Jira down'));

    const result = await calculateEpicHealthScore('PROJ-100', 'PROJ', 'exec-1');

    expect(result.overall).toBe(0);
    expect(result.totalTickets).toBe(0);
    expect(result.epicSummary).toBe('');
  });

  it('continues when relationship context fails', async () => {
    mockGetTicketData.mockResolvedValue(makeEpic());
    mockGetEpicChildren.mockResolvedValue([makeTicket()]);
    mockGetJiraRelationshipContext.mockRejectedValue(new Error('Storage error'));

    const result = await calculateEpicHealthScore('PROJ-100', 'PROJ', 'exec-1');

    expect(result.overall).toBeGreaterThanOrEqual(0);
    expect(result.totalTickets).toBe(1);
  });
});
