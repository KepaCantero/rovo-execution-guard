import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('../../../../src/backend/services/jira/jira-adapter');

import {
  detectStaleTickets,
  classifyStaleness,
  suggestAction,
  generateStalenessComment,
  autoTriageStaleTickets,
} from '../../../../src/backend/services/epic/stale-detector';
import { getEpicChildren } from '../../../../src/backend/services/jira/jira-adapter';
import type { JiraTicketData } from '../../../../src/backend/types/jira-data';
import type {
  StaleTicketReport,
  EpicStalenessReport,
} from '../../../../src/backend/types/epic-types';

const mockGetEpicChildren = jest.mocked(getEpicChildren);

// ═══════════════════════════════════════════
// FIXTURES
// ═══════════════════════════════════════════

const makeTicket = (overrides: Partial<JiraTicketData> = {}): JiraTicketData => ({
  key: 'PROJ-1',
  summary: 'Test ticket',
  description: 'Description',
  status: 'TO DO',
  issueType: 'Task',
  labels: [],
  projectKey: 'PROJ',
  created: '2026-01-01T00:00:00.000Z',
  updated: new Date().toISOString(),
  ...overrides,
});

const makeStaleReport = (overrides: Partial<StaleTicketReport> = {}): StaleTicketReport => ({
  ticketKey: 'PROJ-1',
  summary: 'Stale ticket',
  status: 'TO DO',
  lastUpdated: '2026-01-01T00:00:00.000Z',
  daysSinceUpdate: 30,
  staleReasons: ['no_updates'],
  suggestedAction: 'comment',
  epicKey: 'PROJ-100',
  severity: 'warning',
  ...overrides,
});

// ═══════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════

describe('classifyStaleness', () => {
  const threshold = 14;

  it('returns no_updates when ticket updated beyond threshold', () => {
    const oldDate = new Date(Date.now() - 20 * 86_400_000).toISOString();
    const ticket = makeTicket({ updated: oldDate });
    const reasons = classifyStaleness(ticket, threshold);
    expect(reasons).toContain('no_updates');
  });

  it('returns no_assignee when ticket has no assignee', () => {
    const ticket = makeTicket({ assignee: undefined });
    const reasons = classifyStaleness(ticket, threshold);
    expect(reasons).toContain('no_assignee');
  });

  it('returns stale_status for non-terminal status beyond threshold', () => {
    const oldDate = new Date(Date.now() - 20 * 86_400_000).toISOString();
    const ticket = makeTicket({ updated: oldDate, status: 'IN PROGRESS' });
    const reasons = classifyStaleness(ticket, threshold);
    expect(reasons).toContain('stale_status');
  });

  it('returns empty for healthy ticket', () => {
    const ticket = makeTicket({ assignee: 'user1', status: 'IN PROGRESS' });
    const reasons = classifyStaleness(ticket, threshold);
    expect(reasons).toHaveLength(0);
  });

  it('returns multiple reasons for severely stale ticket', () => {
    const oldDate = new Date(Date.now() - 30 * 86_400_000).toISOString();
    const ticket = makeTicket({ updated: oldDate, assignee: undefined, status: 'TO DO' });
    const reasons = classifyStaleness(ticket, threshold);
    expect(reasons.length).toBeGreaterThanOrEqual(2);
  });
});

describe('suggestAction', () => {
  it('suggests reassign for no assignee', () => {
    const ticket = makeTicket({ assignee: undefined });
    const action = suggestAction(ticket, ['no_assignee'], []);
    expect(action).toBe('reassign');
  });

  it('suggests close for stale TO DO ticket', () => {
    const ticket = makeTicket({ status: 'TO DO' });
    const action = suggestAction(ticket, ['stale_status'], []);
    expect(action).toBe('close');
  });

  it('suggests escalate for multiple staleness indicators', () => {
    const ticket = makeTicket({ status: 'IN PROGRESS' });
    const action = suggestAction(ticket, ['no_updates', 'stale_status'], []);
    expect(action).toBe('escalate');
  });

  it('suggests comment for mild staleness', () => {
    const ticket = makeTicket({ status: 'IN PROGRESS' });
    const action = suggestAction(ticket, ['no_updates'], []);
    expect(action).toBe('comment');
  });

  it('suggests comment for no reasons', () => {
    const ticket = makeTicket();
    const action = suggestAction(ticket, [], []);
    expect(action).toBe('comment');
  });
});

describe('generateStalenessComment', () => {
  it('produces formatted comment text', () => {
    const report = makeStaleReport();
    const comment = generateStalenessComment(report);
    expect(comment).toContain('Stale Ticket Alert');
    expect(comment).toContain('PROJ-1');
    expect(comment).toContain('PROJ-100');
    expect(comment).toContain('30');
  });

  it('includes reassign suggestion when suggestedAction is reassign', () => {
    const report = makeStaleReport({ suggestedAction: 'reassign' });
    const comment = generateStalenessComment(report);
    expect(comment).toContain('no assignee');
  });

  it('includes close suggestion when suggestedAction is close', () => {
    const report = makeStaleReport({ suggestedAction: 'close' });
    const comment = generateStalenessComment(report);
    expect(comment).toContain('inactive');
  });

  it('includes escalate suggestion when suggestedAction is escalate', () => {
    const report = makeStaleReport({ suggestedAction: 'escalate' });
    const comment = generateStalenessComment(report);
    expect(comment).toContain('escalating');
  });
});

describe('autoTriageStaleTickets', () => {
  it('produces add_comment actions for stale tickets', () => {
    const report: EpicStalenessReport = {
      epicKey: 'PROJ-100',
      staleTickets: [makeStaleReport()],
      totalTickets: 5,
      stalenessPercentage: 20,
      enforcementActions: [],
      executionId: 'test-exec',
      timestamp: new Date().toISOString(),
    };

    const actions = autoTriageStaleTickets(report);
    expect(actions).toHaveLength(1);
    const first = actions[0];
    expect(first?.type).toBe('add_comment');
    if (first?.type === 'add_comment') {
      expect(first.target).toBe('jira');
      expect(first.body).toContain('PROJ-1');
    }
  });

  it('returns empty actions for no stale tickets', () => {
    const report: EpicStalenessReport = {
      epicKey: 'PROJ-100',
      staleTickets: [],
      totalTickets: 5,
      stalenessPercentage: 0,
      enforcementActions: [],
      executionId: 'test-exec',
      timestamp: new Date().toISOString(),
    };

    const actions = autoTriageStaleTickets(report);
    expect(actions).toHaveLength(0);
  });
});

describe('detectStaleTickets', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns empty report when no children found', async () => {
    mockGetEpicChildren.mockResolvedValue([]);
    const result = await detectStaleTickets('PROJ-100', 'PROJ', 14, 'exec-1');
    expect(result.staleTickets).toHaveLength(0);
    expect(result.totalTickets).toBe(0);
    expect(result.stalenessPercentage).toBe(0);
  });

  it('detects stale tickets in epic', async () => {
    const oldDate = new Date(Date.now() - 30 * 86_400_000).toISOString();
    const freshDate = new Date().toISOString();

    mockGetEpicChildren.mockResolvedValue([
      makeTicket({ key: 'PROJ-1', updated: oldDate, assignee: undefined }),
      makeTicket({ key: 'PROJ-2', updated: freshDate, assignee: 'user1' }),
    ]);

    const result = await detectStaleTickets('PROJ-100', 'PROJ', 14, 'exec-1');
    expect(result.totalTickets).toBe(2);
    expect(result.staleTickets.length).toBeGreaterThanOrEqual(1);
    expect(result.stalenessPercentage).toBeGreaterThan(0);
  });

  it('returns all healthy for recently updated tickets', async () => {
    const freshDate = new Date().toISOString();
    mockGetEpicChildren.mockResolvedValue([
      makeTicket({ key: 'PROJ-1', updated: freshDate, assignee: 'user1' }),
      makeTicket({ key: 'PROJ-2', updated: freshDate, assignee: 'user2' }),
    ]);

    const result = await detectStaleTickets('PROJ-100', 'PROJ', 14, 'exec-1');
    expect(result.staleTickets).toHaveLength(0);
    expect(result.stalenessPercentage).toBe(0);
  });

  it('degrades gracefully on fetch error', async () => {
    mockGetEpicChildren.mockRejectedValue(new Error('Jira API down'));
    const result = await detectStaleTickets('PROJ-100', 'PROJ', 14, 'exec-1');
    expect(result.staleTickets).toHaveLength(0);
    expect(result.totalTickets).toBe(0);
  });

  it('respects custom threshold', async () => {
    const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();
    mockGetEpicChildren.mockResolvedValue([
      makeTicket({ key: 'PROJ-1', updated: sevenDaysAgo, assignee: 'user1' }),
    ]);

    const result = await detectStaleTickets('PROJ-100', 'PROJ', 14, 'exec-1');
    expect(result.staleTickets).toHaveLength(0);

    mockGetEpicChildren.mockResolvedValue([
      makeTicket({ key: 'PROJ-1', updated: sevenDaysAgo, assignee: 'user1' }),
    ]);

    const result2 = await detectStaleTickets('PROJ-100', 'PROJ', 5, 'exec-2');
    expect(result2.staleTickets.length).toBeGreaterThanOrEqual(1);
  });
});
