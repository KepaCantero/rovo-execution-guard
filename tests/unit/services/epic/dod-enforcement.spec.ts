// [TEST-QA-204] afterEach cleanup mandatory
// [ARCH-SOLID-202] Zero any — all mocks fully typed
// [TEST-QA-0764] Self-contained, mock all external dependencies

import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('../../../../src/backend/services/jira/jira-adapter');
jest.mock('../../../../src/backend/services/relationship-index/jira-indexer');
jest.mock('../../../../src/backend/services/scoring/inconsistency-detector');
jest.mock('../../../../src/backend/services/scoring/scoring-engine');

import {
  evaluateAllSubticketsClosed,
  evaluateConfluencePageUpdated,
  evaluatePRsMerged,
  evaluateNoOpenBlockers,
  evaluateNoCriticalInconsistencies,
  evaluateScoreAboveThreshold,
  evaluateEpicDoD,
  determineDoDEnforcementActions,
} from '../../../../src/backend/services/epic/dod-enforcement';

import { getEpicChildren } from '../../../../src/backend/services/jira/jira-adapter';
import { getJiraRelationshipContext } from '../../../../src/backend/services/relationship-index/jira-indexer';
import { detectInconsistencies } from '../../../../src/backend/services/scoring/inconsistency-detector';
import { calculateScore } from '../../../../src/backend/services/scoring/scoring-engine';

import type { JiraTicketData } from '../../../../src/backend/types/jira-data';
import type { RelationshipContext } from '../../../../src/backend/types/relationship-index';
import type { EpicDoDConfig, DoDEvaluationResult } from '../../../../src/backend/types/epic-types';

const mockGetEpicChildren = jest.mocked(getEpicChildren);
const mockGetJiraRelationshipContext = jest.mocked(getJiraRelationshipContext);
const mockDetectInconsistencies = jest.mocked(detectInconsistencies);
const mockCalculateScore = jest.mocked(calculateScore);

// ═══════════════════════════════════════════
// FIXTURES
// ═══════════════════════════════════════════

const makeTicket = (overrides: Partial<JiraTicketData> = {}): JiraTicketData => ({
  key: 'PROJ-1',
  summary: 'Test',
  description: 'Desc',
  status: 'DONE',
  issueType: 'Task',
  labels: [],
  projectKey: 'PROJ',
  created: '2026-01-01T00:00:00.000Z',
  updated: new Date().toISOString(),
  ...overrides,
});

const makeDoDConfig = (overrides: Partial<EpicDoDConfig> = {}): EpicDoDConfig => ({
  epicKey: 'PROJ-100',
  projectKey: 'PROJ',
  criteria: [
    { type: 'all_subtickets_closed', enabled: true },
    { type: 'confluence_page_updated', enabled: true, config: { maxAgeDays: 30 } },
    { type: 'prs_merged', enabled: true },
    { type: 'no_open_blockers', enabled: true },
    { type: 'no_critical_inconsistencies', enabled: true },
    { type: 'score_above_threshold', enabled: true, config: { threshold: 80 } },
  ],
  updatedAt: new Date().toISOString(),
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

describe('evaluateAllSubticketsClosed', () => {
  it('passes when all children are in terminal status', () => {
    const children = [
      makeTicket({ key: 'PROJ-1', status: 'DONE' }),
      makeTicket({ key: 'PROJ-2', status: 'CLOSED' }),
      makeTicket({ key: 'PROJ-3', status: 'RESOLVED' }),
    ];

    const result = evaluateAllSubticketsClosed(children);

    expect(result.passed).toBe(true);
    expect(result.type).toBe('all_subtickets_closed');
  });

  it('fails when any child is not done', () => {
    const children = [
      makeTicket({ key: 'PROJ-1', status: 'DONE' }),
      makeTicket({ key: 'PROJ-2', status: 'IN PROGRESS' }),
    ];

    const result = evaluateAllSubticketsClosed(children);

    expect(result.passed).toBe(false);
    expect(result.type).toBe('all_subtickets_closed');
    expect(result.remediation).toContain('PROJ-2');
  });

  it('passes vacuously when there are no children', () => {
    const result = evaluateAllSubticketsClosed([]);

    expect(result.passed).toBe(true);
  });
});

describe('evaluateConfluencePageUpdated', () => {
  it('passes with fresh documentation', () => {
    const context: RelationshipContext = {
      ...EMPTY_CONTEXT,
      documentation: [
        {
          id: 'confluence:123',
          type: 'confluence-page',
          label: 'Design Doc',
          status: 'current',
          projectKey: 'PROJ',
          metadata: {},
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: new Date().toISOString(),
        },
      ],
    };

    const result = evaluateConfluencePageUpdated(context, 30);

    expect(result.passed).toBe(true);
    expect(result.type).toBe('confluence_page_updated');
  });

  it('fails with stale documentation', () => {
    const staleDate = new Date(Date.now() - 45 * 86_400_000).toISOString();
    const context: RelationshipContext = {
      ...EMPTY_CONTEXT,
      documentation: [
        {
          id: 'confluence:456',
          type: 'confluence-page',
          label: 'Old Doc',
          status: 'current',
          projectKey: 'PROJ',
          metadata: {},
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: staleDate,
        },
      ],
    };

    const result = evaluateConfluencePageUpdated(context, 30);

    expect(result.passed).toBe(false);
    expect(result.details).toContain('30');
  });

  it('fails with no context', () => {
    const result = evaluateConfluencePageUpdated(undefined, 30);

    expect(result.passed).toBe(false);
    expect(result.remediation).toBeTruthy();
  });

  it('fails with empty documentation', () => {
    const result = evaluateConfluencePageUpdated(EMPTY_CONTEXT, 30);

    expect(result.passed).toBe(false);
  });
});

describe('evaluatePRsMerged', () => {
  it('passes with merged PRs in context', () => {
    const context: RelationshipContext = {
      ...EMPTY_CONTEXT,
      pullRequests: [
        {
          id: 'github:org/repo/pull/42',
          type: 'github-pr',
          label: 'Fix auth',
          status: 'MERGED',
          projectKey: 'PROJ',
          metadata: {},
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: new Date().toISOString(),
        },
      ],
    };

    const result = evaluatePRsMerged([], context);

    expect(result.passed).toBe(true);
  });

  it('passes with PR references in ticket descriptions', () => {
    const children = [
      makeTicket({
        key: 'PROJ-1',
        description: 'Implemented in https://github.com/org/repo/pull/42',
      }),
    ];

    const result = evaluatePRsMerged(children, undefined);

    expect(result.passed).toBe(true);
  });

  it('handles no context gracefully (passes by default)', () => {
    const result = evaluatePRsMerged([], undefined);

    expect(result.passed).toBe(true);
    expect(result.details).toContain('best-effort');
  });
});

describe('evaluateNoOpenBlockers', () => {
  it('passes with no blockers', () => {
    const children = [
      makeTicket({ key: 'PROJ-1', issueLinks: [] }),
      makeTicket({ key: 'PROJ-2', issueLinks: [] }),
    ];

    const result = evaluateNoOpenBlockers(children);

    expect(result.passed).toBe(true);
    expect(result.type).toBe('no_open_blockers');
  });

  it('fails with unresolved blocker', () => {
    const children = [
      makeTicket({
        key: 'PROJ-1',
        issueLinks: [
          {
            type: 'is blocked by',
            direction: 'inward',
            targetKey: 'PROJ-99',
            targetSummary: 'Blocking issue',
            targetStatus: 'IN PROGRESS',
          },
        ],
      }),
    ];

    const result = evaluateNoOpenBlockers(children);

    expect(result.passed).toBe(false);
    expect(result.remediation).toContain('PROJ-99');
  });

  it('passes when blocker is resolved', () => {
    const children = [
      makeTicket({
        key: 'PROJ-1',
        issueLinks: [
          {
            type: 'is blocked by',
            direction: 'inward',
            targetKey: 'PROJ-99',
            targetSummary: 'Resolved blocker',
            targetStatus: 'DONE',
          },
        ],
      }),
    ];

    const result = evaluateNoOpenBlockers(children);

    expect(result.passed).toBe(true);
  });

  it('passes with no issue links at all', () => {
    const children = [makeTicket({ key: 'PROJ-1' })];

    const result = evaluateNoOpenBlockers(children);

    expect(result.passed).toBe(true);
  });
});

describe('evaluateNoCriticalInconsistencies', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('passes with no critical inconsistencies', async () => {
    mockDetectInconsistencies.mockReturnValue([
      {
        id: '1',
        type: 'ambiguity',
        severity: 'warning',
        source: 'jira',
        description: 'vague',
        affectedTicketKey: 'PROJ-1',
      },
    ]);

    const children = [makeTicket({ key: 'PROJ-1' })];
    const result = await evaluateNoCriticalInconsistencies(children, 'exec-1');

    expect(result.passed).toBe(true);
    expect(result.type).toBe('no_critical_inconsistencies');
  });

  it('fails with critical inconsistency', async () => {
    mockDetectInconsistencies.mockReturnValue([
      {
        id: '2',
        type: 'contradiction',
        severity: 'critical',
        source: 'jira',
        description: 'conflict',
        affectedTicketKey: 'PROJ-1',
      },
    ]);

    const children = [makeTicket({ key: 'PROJ-1' })];
    const result = await evaluateNoCriticalInconsistencies(children, 'exec-2');

    expect(result.passed).toBe(false);
    expect(result.remediation).toContain('PROJ-1');
  });

  it('passes when detectInconsistencies throws (fail-open)', async () => {
    mockDetectInconsistencies.mockImplementation(() => {
      throw new Error('detection failed');
    });

    const children = [makeTicket({ key: 'PROJ-1' })];
    const result = await evaluateNoCriticalInconsistencies(children, 'exec-3');

    expect(result.passed).toBe(true);
  });
});

describe('evaluateScoreAboveThreshold', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('passes when all scores above threshold', async () => {
    mockCalculateScore.mockReturnValue({
      overall: 90,
      axes: { clarity: 90, consistency: 90, risk: 90, documentation: 90, technicalDebt: 90 },
      timestamp: new Date().toISOString(),
      executionId: 'exec-s',
    });

    const children = [makeTicket({ key: 'PROJ-1' })];
    const result = await evaluateScoreAboveThreshold(children, 80, 'exec-s');

    expect(result.passed).toBe(true);
    expect(result.type).toBe('score_above_threshold');
  });

  it('fails when score below threshold', async () => {
    mockCalculateScore.mockReturnValue({
      overall: 50,
      axes: { clarity: 50, consistency: 50, risk: 50, documentation: 50, technicalDebt: 50 },
      timestamp: new Date().toISOString(),
      executionId: 'exec-s',
    });

    const children = [makeTicket({ key: 'PROJ-1' })];
    const result = await evaluateScoreAboveThreshold(children, 80, 'exec-s');

    expect(result.passed).toBe(false);
    expect(result.remediation).toContain('PROJ-1');
  });

  it('passes vacuously with no children', async () => {
    const result = await evaluateScoreAboveThreshold([], 80, 'exec-s');

    expect(result.passed).toBe(true);
  });

  it('passes when calculateScore throws (fail-open)', async () => {
    mockCalculateScore.mockImplementation(() => {
      throw new Error('scoring failed');
    });

    const children = [makeTicket({ key: 'PROJ-1' })];
    const result = await evaluateScoreAboveThreshold(children, 80, 'exec-s');

    expect(result.passed).toBe(true);
  });
});

describe('evaluateEpicDoD', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('passes when all criteria met', async () => {
    const children = [
      makeTicket({ key: 'PROJ-1', status: 'DONE', issueLinks: [] }),
      makeTicket({ key: 'PROJ-2', status: 'DONE', issueLinks: [] }),
    ];

    mockGetEpicChildren.mockResolvedValue(children);
    mockGetJiraRelationshipContext.mockResolvedValue(EMPTY_CONTEXT);
    mockDetectInconsistencies.mockReturnValue([]);
    mockCalculateScore.mockReturnValue({
      overall: 90,
      axes: { clarity: 90, consistency: 90, risk: 90, documentation: 90, technicalDebt: 90 },
      timestamp: new Date().toISOString(),
      executionId: 'exec-e',
    });

    const baseConfig = makeDoDConfig();
    const criteria = baseConfig.criteria.map((c, i) => (i === 1 ? { ...c, enabled: false } : c));
    const config = makeDoDConfig({ criteria });

    const result = await evaluateEpicDoD('PROJ-100', 'PROJ', config, 'exec-e');

    expect(result.passed).toBe(true);
    expect(result.overallCompletion).toBe(100);
    expect(result.failingCriteria).toHaveLength(0);
    expect(result.epicKey).toBe('PROJ-100');
  });

  it('fails with failing criteria', async () => {
    const children = [makeTicket({ key: 'PROJ-1', status: 'IN PROGRESS', issueLinks: [] })];

    mockGetEpicChildren.mockResolvedValue(children);
    mockGetJiraRelationshipContext.mockResolvedValue(EMPTY_CONTEXT);

    const config = makeDoDConfig({
      criteria: [{ type: 'all_subtickets_closed', enabled: true }],
    });

    const result = await evaluateEpicDoD('PROJ-100', 'PROJ', config, 'exec-f');

    expect(result.passed).toBe(false);
    expect(result.failingCriteria).toContain('all_subtickets_closed');
    expect(result.overallCompletion).toBe(0);
  });

  it('handles mixed pass/fail criteria', async () => {
    const children = [makeTicket({ key: 'PROJ-1', status: 'DONE', issueLinks: [] })];

    mockGetEpicChildren.mockResolvedValue(children);
    mockGetJiraRelationshipContext.mockResolvedValue(EMPTY_CONTEXT);
    mockDetectInconsistencies.mockReturnValue([]);
    mockCalculateScore.mockReturnValue({
      overall: 50,
      axes: { clarity: 50, consistency: 50, risk: 50, documentation: 50, technicalDebt: 50 },
      timestamp: new Date().toISOString(),
      executionId: 'exec-m',
    });

    const config = makeDoDConfig({
      criteria: [
        { type: 'all_subtickets_closed', enabled: true },
        { type: 'score_above_threshold', enabled: true, config: { threshold: 80 } },
      ],
    });

    const result = await evaluateEpicDoD('PROJ-100', 'PROJ', config, 'exec-m');

    expect(result.passed).toBe(false);
    expect(result.failingCriteria).toContain('score_above_threshold');
    expect(result.overallCompletion).toBe(50);
  });

  it('skips disabled criteria', async () => {
    mockGetEpicChildren.mockResolvedValue([]);

    const config = makeDoDConfig({
      criteria: [
        { type: 'all_subtickets_closed', enabled: false },
        { type: 'no_open_blockers', enabled: true },
      ],
    });

    const result = await evaluateEpicDoD('PROJ-100', 'PROJ', config, 'exec-d');

    expect(result.passed).toBe(true);
    expect(result.criterionResults).toHaveLength(1);
    expect(result.criterionResults[0]?.type).toBe('no_open_blockers');
  });

  it('gracefully handles relationship context failure', async () => {
    const children = [makeTicket({ key: 'PROJ-1', status: 'DONE' })];

    mockGetEpicChildren.mockResolvedValue(children);
    mockGetJiraRelationshipContext.mockRejectedValue(new Error('context unavailable'));

    const config = makeDoDConfig({
      criteria: [
        { type: 'all_subtickets_closed', enabled: true },
        { type: 'confluence_page_updated', enabled: true, config: { maxAgeDays: 30 } },
      ],
    });

    const result = await evaluateEpicDoD('PROJ-100', 'PROJ', config, 'exec-g');

    expect(result.criterionResults).toHaveLength(2);
    // confluence should fail because context is undefined
    const confluenceResult = result.criterionResults.find(
      (r) => r.type === 'confluence_page_updated',
    );
    expect(confluenceResult?.passed).toBe(false);
  });
});

describe('determineDoDEnforcementActions', () => {
  it('returns empty array when passed', () => {
    const result: DoDEvaluationResult = {
      epicKey: 'PROJ-100',
      passed: true,
      criterionResults: [{ type: 'all_subtickets_closed', passed: true, details: 'All done' }],
      failingCriteria: [],
      overallCompletion: 100,
      executionId: 'exec-a',
      timestamp: new Date().toISOString(),
    };

    const actions = determineDoDEnforcementActions(result, 'PROJ-100');

    expect(actions).toHaveLength(0);
  });

  it('produces block_transition and add_comment when failed', () => {
    const result: DoDEvaluationResult = {
      epicKey: 'PROJ-100',
      passed: false,
      criterionResults: [
        { type: 'all_subtickets_closed', passed: false, details: '2 not done' },
        { type: 'no_open_blockers', passed: true, details: 'No blockers' },
      ],
      failingCriteria: ['all_subtickets_closed'],
      overallCompletion: 50,
      executionId: 'exec-b',
      timestamp: new Date().toISOString(),
    };

    const actions = determineDoDEnforcementActions(result, 'PROJ-100');

    expect(actions).toHaveLength(2);

    const comment = actions.find((a) => a.type === 'add_comment');
    expect(comment).toBeDefined();
    if (comment?.type === 'add_comment') {
      expect(comment.target).toBe('jira');
      expect(comment.body).toContain('Definition of Done check failed');
      expect(comment.body).toContain('PROJ-100');
    }

    const block = actions.find((a) => a.type === 'block_transition');
    expect(block).toBeDefined();
    if (block?.type === 'block_transition') {
      expect(block.reason).toContain('all_subtickets_closed');
    }
  });
});
