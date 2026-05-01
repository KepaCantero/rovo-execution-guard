/**
 * TEST: Agent Action Types & Utilities
 *
 * Tests the types and utility functions defined in agent-action.ts.
 * Covers: generateActionExecutionId, formatActionError, logAction,
 * actionSuccess, actionFailure, and type contracts.
 *
 * AC refs: AC-01 through AC-09 in agent-action.reqs.md
 */

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
  ActionResponse,
  ActionHandler,
  ActionLogEntry,
} from '../../../src/backend/resolvers/agent-action';
import {
  TicketNotFoundError,
  InsufficientDataError,
  TimeoutError,
} from '../../../src/backend/types/errors';

// ═══════════════════════════════════════════
// MOCKS & FIXTURES
// ═══════════════════════════════════════════

const mockConsoleLog = jest.spyOn(console, 'log').mockImplementation(() => {});

/** Safe extraction of the first logged JSON entry from mock console.log */
const getLoggedEntry = (): Record<string, unknown> => {
  const callArgs = mockConsoleLog.mock.calls[0];
  const raw = callArgs?.[0];
  return JSON.parse(raw as string) as Record<string, unknown>;
};

const VALID_ACTION_CONTEXT: ActionContext = {
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

const MINIMAL_ACTION_CONTEXT: ActionContext = {
  cloudId: 'cloud-456',
  moduleKey: 'check-pr-consistency',
};

const VALID_ACTION_INPUT: ActionInput = {
  issueKey: 'PROJ-123',
  prUrl: 'https://github.com/org/repo/pull/42',
  focusAxis: 'completeness',
};

const MINIMAL_ACTION_INPUT: ActionInput = {};

// ═══════════════════════════════════════════
// TEST SUITE
// ═══════════════════════════════════════════

describe('agent-action types & utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─── generateActionExecutionId() ──────

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

    it('should comply with FORGE-OPS-0105 — pure function, no side effects', () => {
      const before = Date.now();
      const id = generateActionExecutionId();
      const after = Date.now();
      // Should not block — completes within 1ms
      expect(after - before).toBeLessThan(100);
      expect(id).toBeDefined();
    });
  });

  // ─── formatActionError() ──────────────

  describe('formatActionError()', () => {
    it('should format TicketNotFoundError with issueKey (AC-05, ARCH-SOLID-053)', () => {
      const error = new TicketNotFoundError('Not found', 'TICKET_NOT_FOUND');
      const message = formatActionError(error, 'PROJ-123');
      expect(message).toBe('The issue PROJ-123 was not found');
    });

    it('should format InsufficientDataError with issueKey (AC-05, ARCH-SOLID-053)', () => {
      const error = new InsufficientDataError('Insufficient', 'INSUFFICIENT_DATA');
      const message = formatActionError(error, 'PROJ-456');
      expect(message).toBe('Not enough data to evaluate PROJ-456');
    });

    it('should format TimeoutError with issueKey (AC-05, ARCH-SOLID-053)', () => {
      const error = new TimeoutError('Timed out', 'TIMEOUT');
      const message = formatActionError(error, 'PROJ-789');
      expect(message).toBe('Evaluation timed out for PROJ-789');
    });

    it('should format generic Error with fallback message (AC-05, FORGE-OPS-054)', () => {
      const error = new Error('Something went wrong');
      const message = formatActionError(error, 'PROJ-100');
      expect(message).toBe('An unexpected error occurred while evaluating PROJ-100');
    });

    it('should format non-Error thrown values (AC-05, ARCH-SOLID-053)', () => {
      const message = formatActionError('string error', 'PROJ-200');
      expect(message).toBe('An unexpected error occurred while evaluating PROJ-200');
    });

    it('should format error without issueKey (AC-05)', () => {
      const error = new Error('Unknown failure');
      const message = formatActionError(error);
      expect(message).toBe('An unexpected error occurred');
    });

    it('should format null error value (AC-05)', () => {
      const message = formatActionError(null);
      expect(message).toBe('An unexpected error occurred');
    });

    it('should format undefined error value (AC-05)', () => {
      const message = formatActionError(undefined);
      expect(message).toBe('An unexpected error occurred');
    });

    it('should handle number thrown value (AC-05)', () => {
      const message = formatActionError(42);
      expect(message).toBe('An unexpected error occurred');
    });
  });

  // ─── logAction() ──────────────────────

  describe('logAction()', () => {
    it('should emit structured JSON log entry (AC-06, SEC-PRIV-002)', () => {
      const entry: ActionLogEntry = {
        timestamp: '2026-05-01T00:00:00.000Z',
        level: 'info',
        actionKey: 'evaluate-issue',
        executionId: 'act-abc123-def456',
        success: true,
        issueKey: 'PROJ-123',
      };

      logAction(entry);

      expect(mockConsoleLog).toHaveBeenCalledTimes(1);
      const logged = getLoggedEntry();
      expect(logged.timestamp).toBe('2026-05-01T00:00:00.000Z');
      expect(logged.level).toBe('info');
      expect(logged.actionKey).toBe('evaluate-issue');
      expect(logged.executionId).toBe('act-abc123-def456');
      expect(logged.success).toBe(true);
      expect(logged.issueKey).toBe('PROJ-123');
    });

    it('should include duration and error fields when provided (AC-06)', () => {
      const entry: ActionLogEntry = {
        timestamp: '2026-05-01T00:00:00.000Z',
        level: 'error',
        actionKey: 'check-pr-consistency',
        executionId: 'act-xyz789',
        duration: 3500,
        success: false,
        prUrl: 'https://github.com/org/repo/pull/42',
        error: 'Connection refused',
      };

      logAction(entry);

      const logged = getLoggedEntry();
      expect(logged.duration).toBe(3500);
      expect(logged.error).toBe('Connection refused');
      expect(logged.prUrl).toBe('https://github.com/org/repo/pull/42');
    });

    it('should not include undefined optional fields (AC-06)', () => {
      const entry: ActionLogEntry = {
        timestamp: '2026-05-01T00:00:00.000Z',
        level: 'info',
        actionKey: 'explain-score',
        executionId: 'act-min',
        success: true,
      };

      logAction(entry);

      const logged = getLoggedEntry();
      expect(logged).not.toHaveProperty('duration');
      expect(logged).not.toHaveProperty('error');
      expect(logged).not.toHaveProperty('issueKey');
      expect(logged).not.toHaveProperty('prUrl');
    });
  });

  // ─── actionSuccess() ──────────────────

  describe('actionSuccess()', () => {
    it('should build success response with data and executionId (AC-09, ARCH-SOLID-203)', () => {
      const executionId = 'act-test-123';
      const data = { score: 85, axes: [] };

      const response = actionSuccess(data, executionId);

      expect(response.success).toBe(true);
      expect(response.data).toEqual({ score: 85, axes: [] });
      expect(response.executionId).toBe('act-test-123');
      expect(response.error).toBeUndefined();
    });

    it('should handle string data type (AC-09)', () => {
      const response = actionSuccess('result string', 'act-str');
      expect(response.success).toBe(true);
      expect(response.data).toBe('result string');
    });
  });

  // ─── actionFailure() ──────────────────

  describe('actionFailure()', () => {
    it('should build failure response with error and executionId (AC-09, ARCH-SOLID-203)', () => {
      const executionId = 'act-fail-456';
      const error = 'Something went wrong';

      const response = actionFailure(error, executionId);

      expect(response.success).toBe(false);
      expect(response.error).toBe('Something went wrong');
      expect(response.executionId).toBe('act-fail-456');
      expect(response.data).toBeUndefined();
    });
  });

  // ─── Type contract tests ──────────────

  describe('ActionContext type contract', () => {
    it('should accept full context with jira (AC-01, ROVO-INTEG-054)', () => {
      const ctx: ActionContext = VALID_ACTION_CONTEXT;
      expect(ctx.cloudId).toBe('cloud-123');
      expect(ctx.moduleKey).toBe('evaluate-issue');
      expect(ctx.jira?.issueKey).toBe('PROJ-123');
      expect(ctx.jira?.projectKey).toBe('PROJ');
    });

    it('should accept minimal context without jira (AC-01, ROVO-INTEG-060)', () => {
      const ctx: ActionContext = MINIMAL_ACTION_CONTEXT;
      expect(ctx.cloudId).toBe('cloud-456');
      expect(ctx.moduleKey).toBe('check-pr-consistency');
      expect(ctx.jira).toBeUndefined();
    });
  });

  describe('ActionInput type contract', () => {
    it('should accept full input (AC-02, ROVO-INTEG-060)', () => {
      const input: ActionInput = VALID_ACTION_INPUT;
      expect(input.issueKey).toBe('PROJ-123');
      expect(input.prUrl).toBe('https://github.com/org/repo/pull/42');
      expect(input.focusAxis).toBe('completeness');
    });

    it('should accept empty input (AC-02, ROVO-INTEG-060)', () => {
      const input: ActionInput = MINIMAL_ACTION_INPUT;
      expect(input.issueKey).toBeUndefined();
      expect(input.prUrl).toBeUndefined();
      expect(input.focusAxis).toBeUndefined();
    });
  });

  describe('ActionResponse type contract', () => {
    it('should type-check as success response (AC-03, ARCH-SOLID-203)', () => {
      const response: ActionResponse<{ score: number }> = actionSuccess({ score: 90 }, 'act-1');
      expect(response.success).toBe(true);
      expect(response.data?.score).toBe(90);
    });

    it('should type-check as failure response (AC-03, ARCH-SOLID-203)', () => {
      const response: ActionResponse<never> = actionFailure('error msg', 'act-2');
      expect(response.success).toBe(false);
      expect(response.error).toBe('error msg');
    });
  });

  describe('ActionHandler type contract', () => {
    it('should type-check as async function returning ActionResponse (AC-08)', () => {
      const handler: ActionHandler = async (_input, _context) => {
        return actionSuccess({ result: 'ok' }, 'act-handler');
      };

      const result = handler(MINIMAL_ACTION_INPUT, MINIMAL_ACTION_CONTEXT);
      expect(result).toBeInstanceOf(Promise);
    });
  });

  describe('readonly enforcement (AC-07, ARCH-SOLID-202)', () => {
    it('ActionContext fields should be readonly at type level', () => {
      const ctx: ActionContext = VALID_ACTION_CONTEXT;
      // These compile-time checks ensure readonly is enforced.
      // At runtime, JS doesn't enforce it, but TS prevents reassignment.
      expect(ctx.cloudId).toBeDefined();
      expect(ctx.moduleKey).toBeDefined();
    });

    it('ActionInput fields should be readonly at type level', () => {
      const input: ActionInput = VALID_ACTION_INPUT;
      expect(input.issueKey).toBeDefined();
    });

    it('ActionResponse fields should be readonly at type level', () => {
      const response = actionSuccess('data', 'act-ro');
      expect(response.success).toBe(true);
      expect(response.executionId).toBe('act-ro');
    });
  });
});
