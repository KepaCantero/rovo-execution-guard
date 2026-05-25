import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('../../../../src/backend/services/jira/jira-adapter');

import {
  validateCrossEpicConsistency,
  detectDuplicateCriteria,
  detectConflictingScope,
  detectCoverageHoles,
  detectDependencyGaps,
  calculateCrossEpicConsistencyScore,
} from '../../../../src/backend/services/epic/cross-epic-validator';
import { getEpicChildren, getTicketData } from '../../../../src/backend/services/jira/jira-adapter';
import type { JiraTicketData } from '../../../../src/backend/types/jira-data';
import type { SiblingContradictionResult } from '../../../../src/backend/types/epic-types';

const mockGetEpicChildren = jest.mocked(getEpicChildren);
const mockGetTicketData = jest.mocked(getTicketData);

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

const makeEpic = (overrides: Partial<JiraTicketData> = {}): JiraTicketData => ({
  key: 'PROJ-100',
  summary: 'Epic',
  description: 'Epic description',
  status: 'IN PROGRESS',
  issueType: 'Epic',
  labels: [],
  projectKey: 'PROJ',
  created: '2026-01-01T00:00:00.000Z',
  updated: new Date().toISOString(),
  ...overrides,
});

// ═══════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════

describe('detectDuplicateCriteria', () => {
  it('detects similar summaries above threshold', () => {
    const siblings = [
      makeTicket({ key: 'PROJ-1', summary: 'Implement user authentication module' }),
      makeTicket({ key: 'PROJ-2', summary: 'Implement user authentication modules' }),
    ];

    const result = detectDuplicateCriteria(siblings);
    expect(result.length).toBeGreaterThanOrEqual(1);
    const first = result[0];
    expect(first?.contradictionType).toBe('duplicate_criteria');
    expect(first?.severity).toBe('warning');
  });

  it('ignores unrelated summaries', () => {
    const siblings = [
      makeTicket({ key: 'PROJ-1', summary: 'Build login page' }),
      makeTicket({ key: 'PROJ-2', summary: 'Create database migration script' }),
    ];

    const result = detectDuplicateCriteria(siblings);
    expect(result).toHaveLength(0);
  });

  it('returns empty for single ticket', () => {
    const siblings = [makeTicket({ key: 'PROJ-1', summary: 'Only one ticket' })];

    const result = detectDuplicateCriteria(siblings);
    expect(result).toHaveLength(0);
  });

  it('returns empty for empty array', () => {
    const result = detectDuplicateCriteria([]);
    expect(result).toHaveLength(0);
  });

  it('does not flag identical summaries as duplicates (similarity < 1)', () => {
    const siblings = [
      makeTicket({ key: 'PROJ-1', summary: 'Setup CI pipeline' }),
      makeTicket({ key: 'PROJ-2', summary: 'Setup CI pipeline' }),
    ];

    // Identical strings have similarity === 1, which is excluded by the < 1 check
    const result = detectDuplicateCriteria(siblings);
    expect(result).toHaveLength(0);
  });
});

describe('detectConflictingScope', () => {
  it('detects include/exclude contradiction across siblings', () => {
    const siblings = [
      makeTicket({ key: 'PROJ-1', summary: 'Include user profiles in export', description: '' }),
      makeTicket({ key: 'PROJ-2', summary: 'Exclude user profiles from export', description: '' }),
    ];

    const result = detectConflictingScope(siblings);
    expect(result.length).toBeGreaterThanOrEqual(1);
    const first = result[0];
    expect(first?.contradictionType).toBe('conflicting_scope');
    expect(first?.severity).toBe('critical');
  });

  it('detects enable/disable contradiction across siblings', () => {
    const siblings = [
      makeTicket({ key: 'PROJ-1', summary: 'Enable dark mode', description: '' }),
      makeTicket({ key: 'PROJ-2', summary: 'Disable dark mode', description: '' }),
    ];

    const result = detectConflictingScope(siblings);
    expect(result.length).toBeGreaterThanOrEqual(1);
  });

  it('detects must/must not contradiction across siblings', () => {
    const siblings = [
      makeTicket({ key: 'PROJ-1', summary: 'Must validate input', description: '' }),
      makeTicket({ key: 'PROJ-2', summary: 'Must not validate input', description: '' }),
    ];

    const result = detectConflictingScope(siblings);
    expect(result.length).toBeGreaterThanOrEqual(1);
  });

  it('returns empty for aligned tickets', () => {
    const siblings = [
      makeTicket({
        key: 'PROJ-1',
        summary: 'Implement login',
        description: 'Build the login page',
      }),
      makeTicket({
        key: 'PROJ-2',
        summary: 'Implement logout',
        description: 'Build the logout page',
      }),
    ];

    const result = detectConflictingScope(siblings);
    expect(result).toHaveLength(0);
  });

  it('returns empty for single ticket', () => {
    const siblings = [makeTicket({ key: 'PROJ-1', summary: 'Enable feature', description: '' })];

    const result = detectConflictingScope(siblings);
    expect(result).toHaveLength(0);
  });
});

describe('detectCoverageHoles', () => {
  it('finds uncovered keywords from epic description', () => {
    const epicSummary = 'Authentication System';
    const epicDescription = 'Implement login logout registration password-reset two-factor';
    const siblings = [
      makeTicket({ key: 'PROJ-1', summary: 'Implement login page', description: '' }),
      makeTicket({ key: 'PROJ-2', summary: 'Implement logout functionality', description: '' }),
    ];

    const result = detectCoverageHoles(epicSummary, epicDescription, siblings);
    expect(result.length).toBeGreaterThan(0);

    const areas = result.map((g) => g.area);
    expect(areas).not.toContain('login');
    expect(areas).not.toContain('logout');
  });

  it('generates suggested ticket summaries for gaps', () => {
    const epicSummary = 'Data Pipeline';
    const epicDescription = 'Build the ingestion transformation storage export modules';
    const siblings = [
      makeTicket({ key: 'PROJ-1', summary: 'Build ingestion module', description: '' }),
    ];

    const result = detectCoverageHoles(epicSummary, epicDescription, siblings);
    for (const gap of result) {
      expect(gap.suggestedTicketSummary).toContain('Implement');
      expect(gap.description).toContain('not covered');
    }
  });

  it('returns empty when all keywords are covered', () => {
    const epicSummary = 'Login Page';
    const epicDescription = 'Build the login page';
    const siblings = [
      makeTicket({ key: 'PROJ-1', summary: 'Build the login page', description: '' }),
    ];

    const result = detectCoverageHoles(epicSummary, epicDescription, siblings);
    expect(result).toHaveLength(0);
  });

  it('returns empty when no siblings', () => {
    const result = detectCoverageHoles('Epic', 'Some description', []);
    expect(result).toHaveLength(0);
  });

  it('returns empty when epic has no extractable keywords', () => {
    const result = detectCoverageHoles('A an the', 'or but in', [
      makeTicket({ key: 'PROJ-1', summary: 'Build feature', description: '' }),
    ]);
    expect(result).toHaveLength(0);
  });
});

describe('detectDependencyGaps', () => {
  it('finds unresolved external dependencies', () => {
    const siblings = [
      makeTicket({
        key: 'PROJ-1',
        summary: 'Feature A',
        description: '',
        issueLinks: [
          {
            type: 'Blocks',
            direction: 'outward',
            targetKey: 'EXT-1',
            targetSummary: 'External ticket',
            targetStatus: 'IN PROGRESS',
          },
        ],
      }),
    ];

    const result = detectDependencyGaps(siblings);
    expect(result).toHaveLength(1);
    const first = result[0];
    expect(first?.sourceTicket).toBe('PROJ-1');
    expect(first?.missingDependency).toBe('EXT-1');
  });

  it('ignores dependencies that are done', () => {
    const siblings = [
      makeTicket({
        key: 'PROJ-1',
        summary: 'Feature A',
        description: '',
        issueLinks: [
          {
            type: 'Blocks',
            direction: 'outward',
            targetKey: 'EXT-1',
            targetSummary: 'External ticket',
            targetStatus: 'DONE',
          },
        ],
      }),
    ];

    const result = detectDependencyGaps(siblings);
    expect(result).toHaveLength(0);
  });

  it('ignores dependencies within the same epic', () => {
    const siblings = [
      makeTicket({
        key: 'PROJ-1',
        summary: 'Feature A',
        description: '',
        issueLinks: [
          {
            type: 'Blocks',
            direction: 'outward',
            targetKey: 'PROJ-2',
            targetSummary: 'Sibling ticket',
            targetStatus: 'IN PROGRESS',
          },
        ],
      }),
      makeTicket({ key: 'PROJ-2', summary: 'Feature B', description: '' }),
    ];

    const result = detectDependencyGaps(siblings);
    expect(result).toHaveLength(0);
  });

  it('returns empty when no links', () => {
    const siblings = [makeTicket({ key: 'PROJ-1', summary: 'Feature A', description: '' })];

    const result = detectDependencyGaps(siblings);
    expect(result).toHaveLength(0);
  });

  it('returns empty for undefined issueLinks', () => {
    const siblings = [
      makeTicket({ key: 'PROJ-1', summary: 'Feature A', description: '', issueLinks: undefined }),
    ];

    const result = detectDependencyGaps(siblings);
    expect(result).toHaveLength(0);
  });
});

describe('calculateCrossEpicConsistencyScore', () => {
  it('returns 100 for no contradictions', () => {
    const score = calculateCrossEpicConsistencyScore([], []);
    expect(score).toBe(100);
  });

  it('penalizes -20 per critical contradiction', () => {
    const contradictions: readonly SiblingContradictionResult[] = [
      {
        ticketA: 'PROJ-1',
        ticketB: 'PROJ-2',
        contradictionType: 'conflicting_scope',
        description: 'Test',
        severity: 'critical',
      },
    ];

    const score = calculateCrossEpicConsistencyScore(contradictions, []);
    expect(score).toBe(80);
  });

  it('penalizes -10 per warning contradiction', () => {
    const contradictions: readonly SiblingContradictionResult[] = [
      {
        ticketA: 'PROJ-1',
        ticketB: 'PROJ-2',
        contradictionType: 'duplicate_criteria',
        description: 'Test',
        severity: 'warning',
      },
    ];

    const score = calculateCrossEpicConsistencyScore(contradictions, []);
    expect(score).toBe(90);
  });

  it('penalizes -2 per info contradiction', () => {
    const contradictions: readonly SiblingContradictionResult[] = [
      {
        ticketA: 'PROJ-1',
        ticketB: 'PROJ-2',
        contradictionType: 'duplicate_criteria',
        description: 'Test',
        severity: 'info',
      },
    ];

    const score = calculateCrossEpicConsistencyScore(contradictions, []);
    expect(score).toBe(98);
  });

  it('does not go below 0', () => {
    const contradictions: readonly SiblingContradictionResult[] = Array.from(
      { length: 10 },
      (_, i): SiblingContradictionResult => ({
        ticketA: 'PROJ-1',
        ticketB: `PROJ-${i + 2}`,
        contradictionType: 'conflicting_scope',
        description: 'Test',
        severity: 'critical',
      }),
    );

    const score = calculateCrossEpicConsistencyScore(contradictions, []);
    expect(score).toBe(0);
  });

  it('accumulates penalties from mixed severities', () => {
    const contradictions: readonly SiblingContradictionResult[] = [
      {
        ticketA: 'PROJ-1',
        ticketB: 'PROJ-2',
        contradictionType: 'conflicting_scope',
        description: 'T',
        severity: 'critical',
      },
      {
        ticketA: 'PROJ-3',
        ticketB: 'PROJ-4',
        contradictionType: 'duplicate_criteria',
        description: 'T',
        severity: 'warning',
      },
      {
        ticketA: 'PROJ-5',
        ticketB: 'PROJ-6',
        contradictionType: 'duplicate_criteria',
        description: 'T',
        severity: 'info',
      },
    ];

    const score = calculateCrossEpicConsistencyScore(contradictions, []);
    expect(score).toBe(100 - 20 - 10 - 2);
  });
});

describe('validateCrossEpicConsistency', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns full result with mocked adapters', async () => {
    const epic = makeEpic({
      key: 'PROJ-100',
      summary: 'Authentication System',
      description: 'Implement login logout registration',
    });

    const children = [
      makeTicket({ key: 'PROJ-1', summary: 'Implement login page', description: 'Build login' }),
      makeTicket({ key: 'PROJ-2', summary: 'Implement logout page', description: 'Build logout' }),
    ];

    mockGetEpicChildren.mockResolvedValue(children);
    mockGetTicketData.mockResolvedValue(epic);

    const result = await validateCrossEpicConsistency({
      epicKey: 'PROJ-100',
      projectKey: 'PROJ',
      executionId: 'exec-1',
    });

    expect(result.epicKey).toBe('PROJ-100');
    expect(result.siblingsAnalyzed).toBe(2);
    expect(result.executionId).toBe('exec-1');
    expect(result.timestamp).toBeTruthy();
    expect(typeof result.overallConsistency).toBe('number');
    expect(Array.isArray(result.contradictions)).toBe(true);
    expect(Array.isArray(result.coverageGaps)).toBe(true);
    expect(Array.isArray(result.dependencyGaps)).toBe(true);
  });

  it('detects contradictions between siblings', async () => {
    const epic = makeEpic({
      key: 'PROJ-100',
      summary: 'Feature Set',
      description: 'Features for the system',
    });

    const children = [
      makeTicket({ key: 'PROJ-1', summary: 'Implement user auth module', description: '' }),
      makeTicket({ key: 'PROJ-2', summary: 'Implement user auth modules', description: '' }),
    ];

    mockGetEpicChildren.mockResolvedValue(children);
    mockGetTicketData.mockResolvedValue(epic);

    const result = await validateCrossEpicConsistency({
      epicKey: 'PROJ-100',
      projectKey: 'PROJ',
      executionId: 'exec-2',
    });

    expect(result.contradictions.length).toBeGreaterThanOrEqual(1);
    expect(result.overallConsistency).toBeLessThan(100);
  });

  it('degrades gracefully on adapter error', async () => {
    mockGetEpicChildren.mockRejectedValue(new Error('Jira API down'));
    mockGetTicketData.mockResolvedValue(makeEpic());

    const result = await validateCrossEpicConsistency({
      epicKey: 'PROJ-100',
      projectKey: 'PROJ',
      executionId: 'exec-3',
    });

    // Fail-open: returns empty result
    expect(result.epicKey).toBe('PROJ-100');
    expect(result.siblingsAnalyzed).toBe(0);
    expect(result.contradictions).toHaveLength(0);
    expect(result.coverageGaps).toHaveLength(0);
    expect(result.dependencyGaps).toHaveLength(0);
    expect(result.overallConsistency).toBe(100);
  });

  it('handles empty epic (no children)', async () => {
    const epic = makeEpic();
    mockGetEpicChildren.mockResolvedValue([]);
    mockGetTicketData.mockResolvedValue(epic);

    const result = await validateCrossEpicConsistency({
      epicKey: 'PROJ-100',
      projectKey: 'PROJ',
      executionId: 'exec-4',
    });

    expect(result.siblingsAnalyzed).toBe(0);
    expect(result.contradictions).toHaveLength(0);
    expect(result.overallConsistency).toBe(100);
  });

  it('caps analysis at 50 siblings', async () => {
    const epic = makeEpic({ summary: 'Big Epic', description: 'Many children' });
    const children = Array.from(
      { length: 60 },
      (_, i): JiraTicketData =>
        makeTicket({
          key: `PROJ-${i + 1}`,
          summary: `Ticket ${i + 1} for the system`,
          description: `Description for ticket ${i + 1}`,
        }),
    );

    mockGetEpicChildren.mockResolvedValue(children);
    mockGetTicketData.mockResolvedValue(epic);

    const result = await validateCrossEpicConsistency({
      epicKey: 'PROJ-100',
      projectKey: 'PROJ',
      executionId: 'exec-5',
    });

    expect(result.siblingsAnalyzed).toBe(50);
  });
});
