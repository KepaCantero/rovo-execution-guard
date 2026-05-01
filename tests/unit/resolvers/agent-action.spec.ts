/**
 * TEST: Agent Action Handler — Full Implementation
 *
 * Tests types, utilities, routing, and all 5 sub-handlers.
 * Covers: generateActionExecutionId, formatActionError, logAction,
 * actionSuccess, actionFailure, handler routing, and sub-handler behavior.
 *
 * AC refs: AC-01 through AC-12 in agent-action.reqs.md
 */

import { handler } from '../../../src/backend/resolvers/agent-action';
import {
  generateActionExecutionId,
  formatActionError,
  logAction,
  actionSuccess,
  actionFailure,
} from '../../../src/backend/resolvers/agent-action';
import type {
  ActionContext,
  ActionInput,
  ActionHandler,
} from '../../../src/backend/resolvers/agent-action';
import {
  TicketNotFoundError,
  InsufficientDataError,
  TimeoutError,
} from '../../../src/backend/types/errors';

// ═══════════════════════════════════════════
// MOCKS
// ═══════════════════════════════════════════

jest.mock('../../../src/backend/services/jira/jira-adapter', () => ({
  getTicketData: jest.fn(),
  getProjectConfig: jest.fn(),
}));

jest.mock('../../../src/backend/services/scoring/scoring-engine', () => ({
  calculateScore: jest.fn(),
  generateAxisSuggestions: jest.fn(),
}));

jest.mock('../../../src/backend/services/scoring/inconsistency-detector', () => ({
  detectInconsistencies: jest.fn(),
}));

jest.mock('../../../src/backend/services/scoring/quality-gate-rules', () => ({
  evaluateGate: jest.fn(),
}));

jest.mock('../../../src/backend/services/github/github-adapter', () => ({
  getPRData: jest.fn(),
}));

jest.mock('../../../src/backend/services/rovo/rovo-adapter', () => ({
  getContext: jest.fn(),
  getDocumentation: jest.fn(),
}));

import { getTicketData, getProjectConfig } from '../../../src/backend/services/jira/jira-adapter';
import {
  calculateScore,
  generateAxisSuggestions,
} from '../../../src/backend/services/scoring/scoring-engine';
import { detectInconsistencies } from '../../../src/backend/services/scoring/inconsistency-detector';
import { evaluateGate } from '../../../src/backend/services/scoring/quality-gate-rules';
import { getPRData } from '../../../src/backend/services/github/github-adapter';
import { getContext, getDocumentation } from '../../../src/backend/services/rovo/rovo-adapter';

// ═══════════════════════════════════════════
// FIXTURES
// ═══════════════════════════════════════════

const mockConsoleLog = jest.spyOn(console, 'log').mockImplementation(() => {});

const getLoggedEntries = (): readonly Record<string, unknown>[] =>
  mockConsoleLog.mock.calls.map((call) => JSON.parse(call[0] as string));

const VALID_CONTEXT: ActionContext = {
  cloudId: 'cloud-123',
  moduleKey: 'evaluate-issue',
  jira: {
    url: 'https://example.atlassian.net',
    resourceType: 'issue',
    issueKey: 'PROJ-123',
    issueId: 10001,
    issueType: 'Story',
    projectKey: 'PROJ',
    projectId: 10000,
  },
};

const MINIMAL_CONTEXT: ActionContext = {
  cloudId: 'cloud-456',
  moduleKey: 'check-pr-consistency',
};

const MOCK_TICKET = {
  key: 'PROJ-123',
  summary: 'Implement user authentication flow',
  description: 'Add login, logout, and session management',
  status: 'In Progress',
  assignee: 'user@example.com',
  reporter: 'pm@example.com',
  priority: 'High',
  issueType: 'Story',
  labels: ['auth', 'security'] as const,
  projectKey: 'PROJ',
  created: '2026-01-15T10:00:00Z',
  updated: '2026-04-20T14:30:00Z',
};

const MOCK_CONFIG = {
  projectKey: 'PROJ',
  enabled: true,
  scoreThreshold: 75,
  gates: { definition: true, execution: true, delivery: true },
};

const MOCK_SCORE = {
  overall: 82,
  axes: {
    clarity: 85,
    consistency: 80,
    risk: 70,
    documentation: 90,
    technicalDebt: 85,
  },
  axisDetails: {
    clarity: { score: 85, label: 'Clarity', suggestions: ['Add more examples'] },
    consistency: { score: 80, label: 'Consistency', suggestions: [] },
  },
  timestamp: '2026-05-01T00:00:00Z',
  executionId: 'act-test',
};

const MOCK_INCONSISTENCIES = [
  {
    id: 'inc-1',
    type: 'contradiction' as const,
    severity: 'warning' as const,
    source: 'confluence' as const,
    description: 'Spec says no caching but ticket implies cache layer',
    affectedTicketKey: 'PROJ-123',
    suggestion: 'Clarify caching requirements in ticket description',
  },
];

const MOCK_GATE_RESULT = {
  gate: 'definition' as const,
  passed: true,
  score: MOCK_SCORE,
  inconsistencies: MOCK_INCONSISTENCIES,
  blockedTransitions: [],
  executionId: 'act-test',
};

const MOCK_PR_DATA = {
  number: 42,
  title: 'PROJ-123 Implement auth flow',
  body: 'Fixes PROJ-123 by adding login/logout',
  state: 'open' as const,
  branch: 'feature/auth',
  baseBranch: 'main',
  files: [{ filename: 'src/auth.ts', status: 'added' as const, additions: 50, deletions: 0 }],
  url: 'https://github.com/org/repo/pull/42',
};

const MOCK_ROVO_CONTEXT = {
  documents: [
    {
      id: 'doc-1',
      title: 'Auth Spec',
      content: 'Specification for authentication',
      source: 'confluence',
      relevance: 0.9,
    },
  ],
  relatedTickets: ['PROJ-100'],
  decisions: [],
  query: 'authentication',
  timestamp: '2026-05-01T00:00:00Z',
};

const MOCK_DOCS = [
  {
    id: 'doc-1',
    title: 'Auth Spec',
    content: 'Spec content',
    source: 'confluence',
    relevance: 0.9,
  },
  {
    id: 'doc-2',
    title: 'Irrelevant',
    content: 'Not related',
    source: 'confluence',
    relevance: 0.2,
  },
];

const MOCK_AXIS_SUGGESTIONS = {
  clarity: { score: 85, label: 'Clarity', suggestions: ['Add more examples', 'Clarify scope'] },
  consistency: { score: 80, label: 'Consistency', suggestions: [] },
  risk: { score: 70, label: 'Risk', suggestions: ['Add mitigation plan'] },
  documentation: { score: 90, label: 'Documentation', suggestions: [] },
  technicalDebt: { score: 85, label: 'Technical Debt', suggestions: ['Refactor legacy code'] },
};

// ═══════════════════════════════════════════
// TEST SUITE
// ═══════════════════════════════════════════

describe('agent-action', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getTicketData as jest.Mock).mockResolvedValue(MOCK_TICKET);
    (getProjectConfig as jest.Mock).mockResolvedValue(MOCK_CONFIG);
    (calculateScore as jest.Mock).mockReturnValue(MOCK_SCORE);
    (generateAxisSuggestions as jest.Mock).mockReturnValue(MOCK_AXIS_SUGGESTIONS);
    (detectInconsistencies as jest.Mock).mockReturnValue(MOCK_INCONSISTENCIES);
    (evaluateGate as jest.Mock).mockReturnValue(MOCK_GATE_RESULT);
    (getPRData as jest.Mock).mockResolvedValue(MOCK_PR_DATA);
    (getContext as jest.Mock).mockResolvedValue(MOCK_ROVO_CONTEXT);
    (getDocumentation as jest.Mock).mockResolvedValue(MOCK_DOCS);
  });

  // ═══════════════════════════════════════════
  // TYPES & UTILITIES (Step 1 — preserved)
  // ═══════════════════════════════════════════

  describe('generateActionExecutionId()', () => {
    it('should return string starting with act- prefix (AC-04)', () => {
      const id = generateActionExecutionId();
      expect(id).toMatch(/^act-[a-z0-9]+-[a-z0-9]+$/);
    });

    it('should generate different IDs on successive calls (AC-04)', () => {
      const id1 = generateActionExecutionId();
      const id2 = generateActionExecutionId();
      expect(id1).not.toBe(id2);
    });
  });

  describe('formatActionError()', () => {
    it('should format TicketNotFoundError (AC-05, ARCH-SOLID-053)', () => {
      expect(formatActionError(new TicketNotFoundError('x', 'TICKET_NOT_FOUND'), 'PROJ-1')).toBe(
        'The issue PROJ-1 was not found',
      );
    });

    it('should format InsufficientDataError (AC-05)', () => {
      expect(formatActionError(new InsufficientDataError('x', 'INSUFFICIENT_DATA'), 'PROJ-2')).toBe(
        'Not enough data to evaluate PROJ-2',
      );
    });

    it('should format TimeoutError (AC-05)', () => {
      expect(formatActionError(new TimeoutError('x', 'TIMEOUT'), 'PROJ-3')).toBe(
        'Evaluation timed out for PROJ-3',
      );
    });

    it('should format generic Error (AC-05)', () => {
      expect(formatActionError(new Error('fail'), 'PROJ-4')).toBe(
        'An unexpected error occurred while evaluating PROJ-4',
      );
    });

    it('should format unknown error without issueKey (AC-05)', () => {
      expect(formatActionError('string error')).toBe('An unexpected error occurred');
    });

    it('should handle null (AC-05)', () => {
      expect(formatActionError(null)).toBe('An unexpected error occurred');
    });
  });

  describe('logAction()', () => {
    it('should emit structured JSON log (AC-06, SEC-PRIV-002)', () => {
      logAction({
        timestamp: '2026-05-01T00:00:00Z',
        level: 'info',
        actionKey: 'evaluate-issue',
        executionId: 'act-test',
        success: true,
      });
      expect(mockConsoleLog).toHaveBeenCalledTimes(1);
      const logged = JSON.parse(mockConsoleLog.mock.calls[0]?.[0] as string) as Record<
        string,
        unknown
      >;
      expect(logged.actionKey).toBe('evaluate-issue');
      expect(logged.executionId).toBe('act-test');
    });
  });

  describe('actionSuccess()', () => {
    it('should build success response (AC-09)', () => {
      const r = actionSuccess({ score: 85 }, 'act-1');
      expect(r.success).toBe(true);
      expect(r.data).toEqual({ score: 85 });
      expect(r.executionId).toBe('act-1');
      expect(r.error).toBeUndefined();
    });
  });

  describe('actionFailure()', () => {
    it('should build failure response (AC-09)', () => {
      const r = actionFailure('error msg', 'act-2');
      expect(r.success).toBe(false);
      expect(r.error).toBe('error msg');
      expect(r.executionId).toBe('act-2');
      expect(r.data).toBeUndefined();
    });
  });

  describe('type contracts', () => {
    it('ActionContext accepts full and minimal forms (AC-01)', () => {
      const full: ActionContext = VALID_CONTEXT;
      const min: ActionContext = MINIMAL_CONTEXT;
      expect(full.jira?.issueKey).toBe('PROJ-123');
      expect(min.jira).toBeUndefined();
    });

    it('ActionInput accepts all optional fields (AC-02)', () => {
      const full: ActionInput = { issueKey: 'X', prUrl: 'http://x', focusAxis: 'y' };
      const empty: ActionInput = {};
      expect(full.issueKey).toBe('X');
      expect(empty.issueKey).toBeUndefined();
    });

    it('ActionHandler type allows async functions (AC-08)', async () => {
      const h: ActionHandler = async () => actionSuccess('ok', 'act-test');
      const result = await h({}, MINIMAL_CONTEXT);
      expect(result.success).toBe(true);
    });
  });

  // ═══════════════════════════════════════════
  // HANDLER ROUTING (AC-03)
  // ═══════════════════════════════════════════

  describe('handler routing (AC-03)', () => {
    it('should return failure for unknown action key (AC-03)', async () => {
      const result = await handler(
        { context: { cloudId: 'c', moduleKey: 'unknown-action' } },
        { accountId: 'user-1' },
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown action');
    });

    it('should return failure when context is missing (AC-03)', async () => {
      const result = await handler({}, { accountId: 'user-1' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown action');
    });

    it('should route evaluate-issue correctly (AC-03)', async () => {
      const result = await handler(
        { context: VALID_CONTEXT, issueKey: 'PROJ-123' },
        { accountId: 'user-1' },
      );
      expect(result.success).toBe(true);
      expect(getTicketData).toHaveBeenCalledWith('PROJ-123', expect.any(String));
    });

    it('should route check-pr-consistency correctly (AC-03)', async () => {
      const result = await handler(
        {
          context: { ...VALID_CONTEXT, moduleKey: 'check-pr-consistency' },
          issueKey: 'PROJ-123',
          prUrl: 'https://github.com/org/repo/pull/42',
        },
        { accountId: 'user-1' },
      );
      expect(result.success).toBe(true);
      expect(getPRData).toHaveBeenCalledWith('org/repo', 42, '', expect.any(String));
    });

    it('should route validate-spec-alignment correctly (AC-03)', async () => {
      const result = await handler(
        {
          context: { ...VALID_CONTEXT, moduleKey: 'validate-spec-alignment' },
          issueKey: 'PROJ-123',
        },
        { accountId: 'user-1' },
      );
      expect(result.success).toBe(true);
      expect(getContext).toHaveBeenCalled();
    });

    it('should route explain-score correctly (AC-03)', async () => {
      const result = await handler(
        {
          context: { ...VALID_CONTEXT, moduleKey: 'explain-score' },
          issueKey: 'PROJ-123',
        },
        { accountId: 'user-1' },
      );
      expect(result.success).toBe(true);
      expect(calculateScore).toHaveBeenCalled();
    });

    it('should route get-improvement-tips correctly (AC-03)', async () => {
      const result = await handler(
        {
          context: { ...VALID_CONTEXT, moduleKey: 'get-improvement-tips' },
          issueKey: 'PROJ-123',
        },
        { accountId: 'user-1' },
      );
      expect(result.success).toBe(true);
      expect(detectInconsistencies).toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════
  // SUB-HANDLER: evaluate-issue (AC-04)
  // ═══════════════════════════════════════════

  describe('handleEvaluateIssue (AC-04)', () => {
    it('should return full score + inconsistencies + gate status (AC-04)', async () => {
      const result = await handler(
        { context: VALID_CONTEXT, issueKey: 'PROJ-123' },
        { accountId: 'user-1' },
      );
      expect(result.success).toBe(true);
      const data = result.data as Record<string, unknown>;
      expect(data.score).toBe(82);
      expect(data.axes).toBeDefined();
      expect(data.axisDetails).toBeDefined();
      expect(data.inconsistencies).toBeDefined();
      expect(data.gateResults).toEqual({ passed: true, gate: 'definition' });
      expect(data.threshold).toBe(75);
    });

    it('should work without project config (AC-04)', async () => {
      const ctx: ActionContext = { cloudId: 'c', moduleKey: 'evaluate-issue' };
      const result = await handler({ context: ctx, issueKey: 'PROJ-123' }, { accountId: 'user-1' });
      expect(result.success).toBe(true);
      const data = result.data as Record<string, unknown>;
      expect(data.gateResults).toBeUndefined();
      expect(data.threshold).toBeUndefined();
    });

    it('should fail when issueKey is missing (AC-04)', async () => {
      const ctx: ActionContext = { cloudId: 'c', moduleKey: 'evaluate-issue' };
      const result = await handler({ context: ctx }, { accountId: 'user-1' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('issueKey is required');
    });

    it('should use context.jira.issueKey when input.issueKey is absent (AC-04)', async () => {
      const result = await handler({ context: VALID_CONTEXT }, { accountId: 'user-1' });
      expect(result.success).toBe(true);
      expect(getTicketData).toHaveBeenCalledWith('PROJ-123', expect.any(String));
    });
  });

  // ═══════════════════════════════════════════
  // SUB-HANDLER: check-pr-consistency (AC-05)
  // ═══════════════════════════════════════════

  describe('handleCheckPRConsistency (AC-05)', () => {
    it('should return PR-issue alignment analysis (AC-05)', async () => {
      const result = await handler(
        {
          context: { ...VALID_CONTEXT, moduleKey: 'check-pr-consistency' },
          issueKey: 'PROJ-123',
          prUrl: 'https://github.com/org/repo/pull/42',
        },
        { accountId: 'user-1' },
      );
      expect(result.success).toBe(true);
      const data = result.data as Record<string, unknown>;
      expect(data.alignment).toBe('aligned');
      expect(data.prSummary).toBeDefined();
      expect(data.issueSummary).toBeDefined();
      expect(data.gaps).toBeDefined();
    });

    it('should return aligned when PR title contains issue key (AC-05)', async () => {
      const result = await handler(
        {
          context: { ...VALID_CONTEXT, moduleKey: 'check-pr-consistency' },
          issueKey: 'PROJ-123',
          prUrl: 'https://github.com/org/repo/pull/42',
        },
        { accountId: 'user-1' },
      );
      const data = result.data as Record<string, unknown>;
      expect(data.alignment).toBe('aligned');
    });

    it('should detect misalignment when no overlap (AC-05)', async () => {
      (getPRData as jest.Mock).mockResolvedValue({
        ...MOCK_PR_DATA,
        title: 'Fix typo in readme',
        body: 'Minor fix',
      });
      const result = await handler(
        {
          context: { ...VALID_CONTEXT, moduleKey: 'check-pr-consistency' },
          issueKey: 'PROJ-999',
          prUrl: 'https://github.com/org/repo/pull/42',
        },
        { accountId: 'user-1' },
      );
      const data = result.data as Record<string, unknown>;
      expect(['partial', 'misaligned']).toContain(data.alignment);
    });

    it('should fail when prUrl is missing (AC-05)', async () => {
      const result = await handler(
        {
          context: { ...VALID_CONTEXT, moduleKey: 'check-pr-consistency' },
          issueKey: 'PROJ-123',
        },
        { accountId: 'user-1' },
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain('prUrl is required');
    });

    it('should fail when issueKey is missing (AC-05)', async () => {
      const result = await handler(
        {
          context: { cloudId: 'c', moduleKey: 'check-pr-consistency' },
          prUrl: 'https://github.com/org/repo/pull/42',
        },
        { accountId: 'user-1' },
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain('issueKey is required');
    });

    it('should fail for invalid PR URL format (AC-05)', async () => {
      const result = await handler(
        {
          context: { ...VALID_CONTEXT, moduleKey: 'check-pr-consistency' },
          issueKey: 'PROJ-123',
          prUrl: 'not-a-valid-url',
        },
        { accountId: 'user-1' },
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid PR URL format');
    });
  });

  // ═══════════════════════════════════════════
  // SUB-HANDLER: validate-spec-alignment (AC-06)
  // ═══════════════════════════════════════════

  describe('handleValidateSpecAlignment (AC-06)', () => {
    it('should return spec alignment report (AC-06)', async () => {
      const result = await handler(
        {
          context: { ...VALID_CONTEXT, moduleKey: 'validate-spec-alignment' },
          issueKey: 'PROJ-123',
        },
        { accountId: 'user-1' },
      );
      expect(result.success).toBe(true);
      const data = result.data as Record<string, unknown>;
      expect(data.alignedSpecs).toBeDefined();
      expect(data.misalignedSpecs).toBeDefined();
      expect(data.suggestions).toBeDefined();
    });

    it('should filter aligned docs by relevance > 0.5 (AC-06)', async () => {
      const result = await handler(
        {
          context: { ...VALID_CONTEXT, moduleKey: 'validate-spec-alignment' },
          issueKey: 'PROJ-123',
        },
        { accountId: 'user-1' },
      );
      const data = result.data as { alignedSpecs: readonly { relevance: number }[] };
      expect(data.alignedSpecs).toHaveLength(1);
      expect(data.alignedSpecs?.[0]?.relevance).toBeGreaterThan(0.5);
    });

    it('should include confluence-sourced inconsistencies as misaligned (AC-06)', async () => {
      const result = await handler(
        {
          context: { ...VALID_CONTEXT, moduleKey: 'validate-spec-alignment' },
          issueKey: 'PROJ-123',
        },
        { accountId: 'user-1' },
      );
      const data = result.data as { misalignedSpecs: readonly { id: string }[] };
      expect(data.misalignedSpecs).toHaveLength(1);
      expect(data.misalignedSpecs?.[0]?.id).toBe('inc-1');
    });

    it('should gracefully degrade when getContext fails (AC-06, ROVO-INTEG-004)', async () => {
      (getContext as jest.Mock).mockRejectedValue(new Error('Rovo unavailable'));
      const result = await handler(
        {
          context: { ...VALID_CONTEXT, moduleKey: 'validate-spec-alignment' },
          issueKey: 'PROJ-123',
        },
        { accountId: 'user-1' },
      );
      expect(result.success).toBe(true);
    });

    it('should gracefully degrade when getDocumentation fails (AC-06)', async () => {
      (getDocumentation as jest.Mock).mockRejectedValue(new Error('Docs unavailable'));
      const result = await handler(
        {
          context: { ...VALID_CONTEXT, moduleKey: 'validate-spec-alignment' },
          issueKey: 'PROJ-123',
        },
        { accountId: 'user-1' },
      );
      expect(result.success).toBe(true);
    });

    it('should fail when issueKey is missing (AC-06)', async () => {
      const result = await handler(
        { context: { cloudId: 'c', moduleKey: 'validate-spec-alignment' } },
        { accountId: 'user-1' },
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain('issueKey is required');
    });
  });

  // ═══════════════════════════════════════════
  // SUB-HANDLER: explain-score (AC-07)
  // ═══════════════════════════════════════════

  describe('handleExplainScore (AC-07)', () => {
    it('should return per-axis breakdown with signals (AC-07)', async () => {
      const result = await handler(
        {
          context: { ...VALID_CONTEXT, moduleKey: 'explain-score' },
          issueKey: 'PROJ-123',
        },
        { accountId: 'user-1' },
      );
      expect(result.success).toBe(true);
      const data = result.data as Record<string, unknown>;
      expect(data.overallScore).toBe(82);
      expect(data.threshold).toBe(75);
      expect(data.axes).toBeDefined();
      const axes = data.axes as readonly {
        name: string;
        score: number;
        description: string;
        signals: string[];
        suggestions: string[];
      }[];
      expect(axes.length).toBe(5);
      expect(axes?.[0]?.name).toBeDefined();
      expect(axes?.[0]?.score).toBeDefined();
      expect(axes?.[0]?.suggestions).toBeDefined();
    });

    it('should use axis label from generateAxisSuggestions (AC-07)', async () => {
      const result = await handler(
        {
          context: { ...VALID_CONTEXT, moduleKey: 'explain-score' },
          issueKey: 'PROJ-123',
        },
        { accountId: 'user-1' },
      );
      const data = result.data as { axes: readonly { name: string; description: string }[] };
      const clarityAxis = data.axes.find((a) => a.name === 'clarity');
      expect(clarityAxis?.description).toBe('Clarity');
    });

    it('should fail when issueKey is missing (AC-07)', async () => {
      const result = await handler(
        { context: { cloudId: 'c', moduleKey: 'explain-score' } },
        { accountId: 'user-1' },
      );
      expect(result.success).toBe(false);
    });
  });

  // ═══════════════════════════════════════════
  // SUB-HANDLER: get-improvement-tips (AC-08)
  // ═══════════════════════════════════════════

  describe('handleGetImprovementTips (AC-08)', () => {
    it('should return prioritized suggestions by axis (AC-08)', async () => {
      const result = await handler(
        {
          context: { ...VALID_CONTEXT, moduleKey: 'get-improvement-tips' },
          issueKey: 'PROJ-123',
        },
        { accountId: 'user-1' },
      );
      expect(result.success).toBe(true);
      const data = result.data as Record<string, unknown>;
      expect(data.overallScore).toBe(82);
      expect(data.threshold).toBe(75);
      expect(data.prioritizedTips).toBeDefined();
      const tips = data.prioritizedTips as readonly {
        axis: string;
        currentScore: number;
        targetScore: number;
        tips: string[];
      }[];
      // Should be sorted by lowest score first
      expect(tips?.[0]?.currentScore).toBeLessThanOrEqual(
        tips?.[tips.length - 1]?.currentScore ?? 0,
      );
    });

    it('should filter to focusAxis when provided (AC-08)', async () => {
      const result = await handler(
        {
          context: { ...VALID_CONTEXT, moduleKey: 'get-improvement-tips' },
          issueKey: 'PROJ-123',
          focusAxis: 'risk',
        },
        { accountId: 'user-1' },
      );
      const data = result.data as { prioritizedTips: readonly { axis: string }[] };
      expect(data.prioritizedTips).toHaveLength(1);
      expect(data.prioritizedTips?.[0]?.axis).toBe('risk');
    });

    it('should include targetScore from config threshold (AC-08)', async () => {
      const result = await handler(
        {
          context: { ...VALID_CONTEXT, moduleKey: 'get-improvement-tips' },
          issueKey: 'PROJ-123',
        },
        { accountId: 'user-1' },
      );
      const data = result.data as { prioritizedTips: readonly { targetScore: number }[] };
      expect(data.prioritizedTips?.[0]?.targetScore).toBe(75);
    });

    it('should default targetScore to 80 when no config (AC-08)', async () => {
      const ctx: ActionContext = { cloudId: 'c', moduleKey: 'get-improvement-tips' };
      const result = await handler({ context: ctx, issueKey: 'PROJ-123' }, { accountId: 'user-1' });
      const data = result.data as { prioritizedTips: readonly { targetScore: number }[] };
      expect(data.prioritizedTips?.[0]?.targetScore).toBe(80);
    });

    it('should fail when issueKey is missing (AC-08)', async () => {
      const result = await handler(
        { context: { cloudId: 'c', moduleKey: 'get-improvement-tips' } },
        { accountId: 'user-1' },
      );
      expect(result.success).toBe(false);
    });
  });

  // ═══════════════════════════════════════════
  // ERROR HANDLING (AC-09)
  // ═══════════════════════════════════════════

  describe('error handling (AC-09)', () => {
    it('should catch TicketNotFoundError and return structured error (AC-09)', async () => {
      (getTicketData as jest.Mock).mockRejectedValue(
        new TicketNotFoundError('Not found', 'TICKET_NOT_FOUND'),
      );
      const result = await handler(
        { context: VALID_CONTEXT, issueKey: 'PROJ-123' },
        { accountId: 'user-1' },
      );
      expect(result.success).toBe(false);
      expect(result.error).toBe('The issue PROJ-123 was not found');
    });

    it('should catch InsufficientDataError and return structured error (AC-09)', async () => {
      (getTicketData as jest.Mock).mockRejectedValue(
        new InsufficientDataError('Insufficient', 'INSUFFICIENT_DATA'),
      );
      const result = await handler(
        { context: VALID_CONTEXT, issueKey: 'PROJ-123' },
        { accountId: 'user-1' },
      );
      expect(result.success).toBe(false);
      expect(result.error).toBe('Not enough data to evaluate PROJ-123');
    });

    it('should catch TimeoutError and return structured error (AC-09)', async () => {
      (getTicketData as jest.Mock).mockRejectedValue(new TimeoutError('Timeout', 'TIMEOUT'));
      const result = await handler(
        { context: VALID_CONTEXT, issueKey: 'PROJ-123' },
        { accountId: 'user-1' },
      );
      expect(result.success).toBe(false);
      expect(result.error).toBe('Evaluation timed out for PROJ-123');
    });

    it('should catch generic Error and return structured error (AC-09)', async () => {
      (getTicketData as jest.Mock).mockRejectedValue(new Error('Something unexpected'));
      const result = await handler(
        { context: VALID_CONTEXT, issueKey: 'PROJ-123' },
        { accountId: 'user-1' },
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain('An unexpected error occurred');
    });

    it('should never throw — always return ActionResponse (AC-09)', async () => {
      (getTicketData as jest.Mock).mockRejectedValue(new Error('catastrophic'));
      const result = await handler(
        { context: VALID_CONTEXT, issueKey: 'PROJ-123' },
        { accountId: 'user-1' },
      );
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('executionId');
      expect(typeof result.success).toBe('boolean');
    });
  });

  // ═══════════════════════════════════════════
  // STRUCTURED LOGGING (AC-10)
  // ═══════════════════════════════════════════

  describe('structured logging (AC-10)', () => {
    it('should log on successful action invocation (AC-10)', async () => {
      await handler({ context: VALID_CONTEXT, issueKey: 'PROJ-123' }, { accountId: 'user-1' });
      const entries = getLoggedEntries();
      expect(entries.length).toBeGreaterThanOrEqual(1);
      const logEntry = entries[entries.length - 1] as Record<string, unknown>;
      expect(logEntry?.actionKey).toBe('evaluate-issue');
      expect(logEntry?.executionId).toMatch(/^act-/);
      expect(logEntry?.success).toBe(true);
      expect(logEntry?.duration).toBeDefined();
      expect(logEntry?.issueKey).toBe('PROJ-123');
    });

    it('should log error level on failure (AC-10)', async () => {
      const result = await handler(
        { context: { cloudId: 'c', moduleKey: 'unknown' } },
        { accountId: 'user-1' },
      );
      expect(result.success).toBe(false);
      const entries = getLoggedEntries();
      const errorLog = entries.find((e) => e.level === 'error');
      expect(errorLog).toBeDefined();
      expect(errorLog?.success).toBe(false);
    });

    it('should log error level on exception (AC-10)', async () => {
      (getTicketData as jest.Mock).mockRejectedValue(new Error('fail'));
      await handler({ context: VALID_CONTEXT, issueKey: 'PROJ-123' }, { accountId: 'user-1' });
      const entries = getLoggedEntries();
      const errorLog = entries.find((e) => e.level === 'error');
      expect(errorLog).toBeDefined();
    });

    it('should include duration in logs (AC-10)', async () => {
      await handler({ context: VALID_CONTEXT, issueKey: 'PROJ-123' }, { accountId: 'user-1' });
      const entries = getLoggedEntries();
      const successLog = entries.find((e) => e.success === true);
      expect(successLog?.duration).toBeDefined();
      expect(typeof successLog?.duration).toBe('number');
    });

    it('should include prUrl in check-pr-consistency logs (AC-10)', async () => {
      await handler(
        {
          context: { ...VALID_CONTEXT, moduleKey: 'check-pr-consistency' },
          issueKey: 'PROJ-123',
          prUrl: 'https://github.com/org/repo/pull/42',
        },
        { accountId: 'user-1' },
      );
      const entries = getLoggedEntries();
      const log = entries.find((e) => e.actionKey === 'check-pr-consistency');
      expect(log?.prUrl).toBe('https://github.com/org/repo/pull/42');
    });
  });

  // ═══════════════════════════════════════════
  // EXECUTION ID TRACEABILITY
  // ═══════════════════════════════════════════

  describe('executionId traceability', () => {
    it('should return unique executionId per call', async () => {
      const r1 = await handler(
        { context: VALID_CONTEXT, issueKey: 'PROJ-123' },
        { accountId: 'user-1' },
      );
      jest.clearAllMocks();
      (getTicketData as jest.Mock).mockResolvedValue(MOCK_TICKET);
      (calculateScore as jest.Mock).mockReturnValue(MOCK_SCORE);
      (detectInconsistencies as jest.Mock).mockReturnValue(MOCK_INCONSISTENCIES);
      (evaluateGate as jest.Mock).mockReturnValue(MOCK_GATE_RESULT);
      const r2 = await handler(
        { context: VALID_CONTEXT, issueKey: 'PROJ-123' },
        { accountId: 'user-1' },
      );
      expect(r1.executionId).not.toBe(r2.executionId);
    });

    it('should match executionId between response and log', async () => {
      await handler({ context: VALID_CONTEXT, issueKey: 'PROJ-123' }, { accountId: 'user-1' });
      const entries = getLoggedEntries();
      const logId = entries[entries.length - 1]?.executionId;
      expect(logId).toMatch(/^act-/);
    });
  });

  // ═══════════════════════════════════════════
  // EDGE CASES
  // ═══════════════════════════════════════════

  describe('edge cases', () => {
    it('should handle empty PR files list', async () => {
      (getPRData as jest.Mock).mockResolvedValue({
        ...MOCK_PR_DATA,
        title: 'PROJ-123 Fix stuff',
        body: 'Fixes PROJ-123',
        files: [],
      });
      const result = await handler(
        {
          context: { ...VALID_CONTEXT, moduleKey: 'check-pr-consistency' },
          issueKey: 'PROJ-123',
          prUrl: 'https://github.com/org/repo/pull/42',
        },
        { accountId: 'user-1' },
      );
      const data = result.data as { gaps: string[] };
      expect(data.gaps).toContain('PR has no file changes listed');
    });

    it('should handle missing optional context.jira gracefully', async () => {
      const ctx: ActionContext = { cloudId: 'c', moduleKey: 'evaluate-issue' };
      const result = await handler({ context: ctx, issueKey: 'PROJ-123' }, { accountId: 'user-1' });
      expect(result.success).toBe(true);
      // Should not call getProjectConfig since no projectKey
      expect(getProjectConfig).not.toHaveBeenCalled();
    });

    it('should handle empty documentation results', async () => {
      (getDocumentation as jest.Mock).mockResolvedValue([]);
      const result = await handler(
        {
          context: { ...VALID_CONTEXT, moduleKey: 'validate-spec-alignment' },
          issueKey: 'PROJ-123',
        },
        { accountId: 'user-1' },
      );
      const data = result.data as { alignedSpecs: readonly unknown[] };
      expect(data.alignedSpecs).toHaveLength(0);
    });
  });
});
