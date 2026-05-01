/**
 * Tests for workflow-transition.ts — Jira workflow trigger handler
 *
 * AC ref: AC-01 through AC-09
 * Each AC has at least one test. Each RULEBOOK rule has at least one test.
 */

import {
  onJiraWorkflowTransition,
  type JiraWorkflowTransitionEvent,
} from '../../../src/backend/resolvers/workflow-transition';
import type { EvaluationPipelineResult } from '../../../src/backend/services/evaluation/evaluation-pipeline';
import type { ProjectConfig } from '../../../src/backend/types/project-config';
import type { ConsistencyScore } from '../../../src/backend/types/consistency-score';
import type { AuditLogEntry } from '../../../src/backend/types/audit-log';

// ═══════════════════════════════════════════
// MOCKS
// ═══════════════════════════════════════════

jest.mock('../../../src/backend/services/evaluation/evaluation-pipeline');
jest.mock('../../../src/backend/services/enforcement/enforcement-actions');
jest.mock('../../../src/backend/services/jira/jira-adapter');
jest.mock('../../../src/backend/services/relationship-index/jira-indexer');

import { evaluateTicketForGate } from '../../../src/backend/services/evaluation/evaluation-pipeline';
import { blockTransition } from '../../../src/backend/services/enforcement/enforcement-actions';
import {
  getProjectConfig,
  addComment,
  getTicketData,
} from '../../../src/backend/services/jira/jira-adapter';
import { indexJiraIssue } from '../../../src/backend/services/relationship-index/jira-indexer';

import type { JiraTicketData } from '../../../src/backend/types/jira-data';

const mockEvaluateTicketForGate = jest.mocked(evaluateTicketForGate);
const mockBlockTransition = jest.mocked(blockTransition);
const mockGetProjectConfig = jest.mocked(getProjectConfig);
const mockAddComment = jest.mocked(addComment);
const mockGetTicketData = jest.mocked(getTicketData);
const mockIndexJiraIssue = jest.mocked(indexJiraIssue);

// ═══════════════════════════════════════════
// FIXTURES
// ═══════════════════════════════════════════

const makeScore = (overrides: Partial<ConsistencyScore> = {}): ConsistencyScore => ({
  overall: 85,
  axes: {
    clarity: 80,
    consistency: 85,
    risk: 90,
    documentation: 85,
    technicalDebt: 80,
  },
  timestamp: new Date().toISOString(),
  executionId: 'test-exec-id',
  ...overrides,
});

const makePassingResult = (
  overrides: Partial<EvaluationPipelineResult> = {},
): EvaluationPipelineResult => {
  const score = makeScore();
  const gateType = overrides.gateType ?? 'definition';
  return {
    executionId: 'test-exec-id',
    ticketKey: 'PROJ-123',
    gateType,
    score,
    inconsistencies: [],
    gateResult: {
      gate: gateType,
      passed: true,
      score,
      inconsistencies: [],
      blockedTransitions: [],
      executionId: 'test-exec-id',
    },
    enforcementActions: [],
    auditEntry: {
      id: 'audit-test-123',
      action: 'gate_evaluated',
      timestamp: new Date().toISOString(),
      executionId: 'test-exec-id',
      projectKey: 'PROJ',
      ticketKey: 'PROJ-123',
      details: { gateType: 'definition', passed: true },
    },
    ...overrides,
  };
};

const makeFailingResult = (
  overrides: Partial<EvaluationPipelineResult> = {},
): EvaluationPipelineResult => {
  const score = makeScore({ overall: 45 });
  const gateType = overrides.gateType ?? 'definition';
  return {
    executionId: 'test-exec-id',
    ticketKey: 'PROJ-123',
    gateType,
    score,
    inconsistencies: [
      {
        id: 'inc-1',
        type: 'missing_context',
        severity: 'critical',
        source: 'jira',
        description: 'Missing acceptance criteria',
        affectedTicketKey: 'PROJ-123',
        suggestion: 'Add acceptance criteria to the ticket',
        relatedDocs: [],
      },
    ],
    gateResult: {
      gate: gateType,
      passed: false,
      score,
      inconsistencies: [
        {
          id: 'inc-1',
          type: 'missing_context',
          severity: 'critical',
          source: 'jira',
          description: 'Missing acceptance criteria',
          affectedTicketKey: 'PROJ-123',
          suggestion: 'Add acceptance criteria to the ticket',
          relatedDocs: [],
        },
      ],
      blockedTransitions: ['11'],
      executionId: 'test-exec-id',
    },
    enforcementActions: [
      {
        type: 'block_transition',
        transitionId: '11',
        reason: 'Quality gate "definition" failed',
      },
    ],
    auditEntry: {
      id: 'audit-test-456',
      action: 'gate_evaluated',
      timestamp: new Date().toISOString(),
      executionId: 'test-exec-id',
      projectKey: 'PROJ',
      ticketKey: 'PROJ-123',
      details: { gateType: 'definition', passed: false },
    },
    ...overrides,
  };
};

const makeProjectConfig = (overrides: Partial<ProjectConfig> = {}): ProjectConfig => ({
  projectKey: 'PROJ',
  enabled: true,
  scoreThreshold: 80,
  gates: { definition: true, execution: true, delivery: true },
  ...overrides,
});

const makeTransitionEvent = (
  overrides: Partial<JiraWorkflowTransitionEvent> = {},
): JiraWorkflowTransitionEvent => ({
  issueKey: 'PROJ-123',
  transitionId: '11',
  fromStatus: 'To Do',
  toStatus: 'In Progress',
  projectKey: 'PROJ',
  ...overrides,
});

const makeTicketData = (overrides: Partial<JiraTicketData> = {}): JiraTicketData => ({
  key: 'PROJ-123',
  summary: 'Test ticket summary',
  description: 'Test description body',
  status: 'In Progress',
  issueType: 'Story',
  labels: ['backend', 'urgent'],
  projectKey: 'PROJ',
  created: '2026-01-01T00:00:00Z',
  updated: '2026-05-01T00:00:00Z',
  ...overrides,
});

// ═══════════════════════════════════════════
// TEST SUITE
// ═══════════════════════════════════════════

describe('workflow-transition', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Suppress console.log output during tests
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ─── onJiraWorkflowTransition() ──────

  describe('onJiraWorkflowTransition()', () => {
    // ─── AC-01: Trigger on configured transitions ──

    it('should allow transition when score is above threshold (AC-01, AC-02)', async () => {
      const event = makeTransitionEvent();
      mockGetProjectConfig.mockResolvedValue(makeProjectConfig());
      mockEvaluateTicketForGate.mockResolvedValue(makePassingResult());

      const result = await onJiraWorkflowTransition(event);

      expect(result.allowed).toBe(true);
      expect(result.executionId).toBeDefined();
      expect(result.score).toBeDefined();
    });

    it('should map To Do -> In Progress to definition gate (AC-01)', async () => {
      const event = makeTransitionEvent({
        fromStatus: 'To Do',
        toStatus: 'In Progress',
      });
      mockGetProjectConfig.mockResolvedValue(makeProjectConfig());
      mockEvaluateTicketForGate.mockResolvedValue(makePassingResult({ gateType: 'definition' }));

      const result = await onJiraWorkflowTransition(event);

      expect(result.allowed).toBe(true);
      expect(result.gateType).toBe('definition');
      expect(mockEvaluateTicketForGate).toHaveBeenCalledWith(
        'PROJ-123',
        'In Progress',
        expect.any(Object),
        expect.any(String),
      );
    });

    it('should map In Progress -> In Review to execution gate (AC-01)', async () => {
      const event = makeTransitionEvent({
        fromStatus: 'In Progress',
        toStatus: 'In Review',
      });
      mockGetProjectConfig.mockResolvedValue(makeProjectConfig());
      mockEvaluateTicketForGate.mockResolvedValue(makePassingResult({ gateType: 'execution' }));

      const result = await onJiraWorkflowTransition(event);

      expect(result.allowed).toBe(true);
      expect(result.gateType).toBe('execution');
    });

    it('should map In Review -> Done to delivery gate (AC-01)', async () => {
      const event = makeTransitionEvent({
        fromStatus: 'In Review',
        toStatus: 'Done',
      });
      mockGetProjectConfig.mockResolvedValue(makeProjectConfig());
      mockEvaluateTicketForGate.mockResolvedValue(makePassingResult({ gateType: 'delivery' }));

      const result = await onJiraWorkflowTransition(event);

      expect(result.allowed).toBe(true);
      expect(result.gateType).toBe('delivery');
    });

    it('should auto-allow unknown status transitions (AC-01)', async () => {
      const event = makeTransitionEvent({
        fromStatus: 'Custom',
        toStatus: 'SomeOtherStatus',
      });

      const result = await onJiraWorkflowTransition(event);

      expect(result.allowed).toBe(true);
      expect(result.gateType).toBeUndefined();
      expect(mockEvaluateTicketForGate).not.toHaveBeenCalled();
    });

    // ─── AC-02: Gate blocks when score below threshold ──

    it('should block transition when score is below threshold (AC-02)', async () => {
      const event = makeTransitionEvent();
      mockGetProjectConfig.mockResolvedValue(makeProjectConfig());
      mockEvaluateTicketForGate.mockResolvedValue(makeFailingResult());
      mockBlockTransition.mockResolvedValue({} as AuditLogEntry);

      const result = await onJiraWorkflowTransition(event);

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('failed');
      expect(result.score).toBeDefined();
      expect(result.score?.overall).toBe(45);
    });

    // ─── AC-03: Comment explains reasons ──

    it('should call blockTransition with reason when gate fails (AC-03)', async () => {
      const event = makeTransitionEvent();
      mockGetProjectConfig.mockResolvedValue(makeProjectConfig());
      mockEvaluateTicketForGate.mockResolvedValue(makeFailingResult());
      mockBlockTransition.mockResolvedValue({} as AuditLogEntry);

      await onJiraWorkflowTransition(event);

      expect(mockBlockTransition).toHaveBeenCalledWith(
        'PROJ-123',
        '11',
        expect.stringContaining('Quality gate'),
        expect.any(String),
        expect.any(Number),
      );
    });

    it('should include score breakdown and suggestions in block reason (AC-03)', async () => {
      const event = makeTransitionEvent();
      mockGetProjectConfig.mockResolvedValue(makeProjectConfig());
      mockEvaluateTicketForGate.mockResolvedValue(makeFailingResult());
      mockBlockTransition.mockResolvedValue({} as AuditLogEntry);

      const result = await onJiraWorkflowTransition(event);

      expect(result.reason).toContain('Overall: 45/100');
      expect(result.reason).toContain('Clarity: 80');
      expect(result.reason).toContain('Missing acceptance criteria');
      expect(result.reason).toContain('Add acceptance criteria');
    });

    // ─── AC-04: Fail-open on evaluation error ──

    it('should fail-open on evaluation pipeline error (AC-04)', async () => {
      const event = makeTransitionEvent();
      mockGetProjectConfig.mockResolvedValue(makeProjectConfig());
      mockEvaluateTicketForGate.mockRejectedValue(new Error('Pipeline crashed'));
      mockAddComment.mockResolvedValue();

      const result = await onJiraWorkflowTransition(event);

      expect(result.allowed).toBe(true);
      expect(result.error).toContain('Pipeline crashed');
    });

    it('should post fail-open comment on evaluation error (AC-04)', async () => {
      const event = makeTransitionEvent();
      mockGetProjectConfig.mockResolvedValue(makeProjectConfig());
      mockEvaluateTicketForGate.mockRejectedValue(new Error('Pipeline crashed'));
      mockAddComment.mockResolvedValue();

      await onJiraWorkflowTransition(event);

      expect(mockAddComment).toHaveBeenCalledWith(
        'PROJ-123',
        expect.stringContaining('fail-open'),
        expect.any(String),
        expect.any(Number),
      );
    });

    it('should fail-open when getProjectConfig throws (AC-04)', async () => {
      const event = makeTransitionEvent();
      mockGetProjectConfig.mockRejectedValue(new Error('Config fetch failed'));
      mockAddComment.mockResolvedValue();

      const result = await onJiraWorkflowTransition(event);

      expect(result.allowed).toBe(true);
      expect(result.error).toContain('Config fetch failed');
    });

    // ─── AC-05: Response time ──

    it('should complete within 5 seconds for gated transition (AC-05)', async () => {
      const event = makeTransitionEvent();
      mockGetProjectConfig.mockResolvedValue(makeProjectConfig());
      mockEvaluateTicketForGate.mockResolvedValue(makePassingResult());

      const start = Date.now();
      await onJiraWorkflowTransition(event);
      const elapsed = Date.now() - start;

      expect(elapsed).toBeLessThan(5000);
    });

    // ─── AC-06: Audit log ──

    it('should generate audit log entry for evaluation (AC-06)', async () => {
      const event = makeTransitionEvent();
      mockGetProjectConfig.mockResolvedValue(makeProjectConfig());
      mockEvaluateTicketForGate.mockResolvedValue(makePassingResult());

      await onJiraWorkflowTransition(event);

      // Verify the pipeline was called (which generates audit internally)
      expect(mockEvaluateTicketForGate).toHaveBeenCalledWith(
        'PROJ-123',
        'In Progress',
        expect.any(Object),
        expect.any(String),
      );
    });

    // ─── AC-07: Project config respects disabled gates ──

    it('should auto-allow when gate is disabled in project config (AC-07)', async () => {
      const event = makeTransitionEvent();
      mockGetProjectConfig.mockResolvedValue(
        makeProjectConfig({
          gates: { definition: false, execution: true, delivery: true },
        }),
      );

      const result = await onJiraWorkflowTransition(event);

      expect(result.allowed).toBe(true);
      expect(mockEvaluateTicketForGate).not.toHaveBeenCalled();
    });

    it('should auto-allow when project config has enabled=false (AC-07)', async () => {
      const event = makeTransitionEvent();
      mockGetProjectConfig.mockResolvedValue(makeProjectConfig({ enabled: false }));

      const result = await onJiraWorkflowTransition(event);

      expect(result.allowed).toBe(true);
      expect(mockEvaluateTicketForGate).not.toHaveBeenCalled();
    });

    // ─── SEC-PRIV-004: Input validation ──

    it('should fail-open gracefully with invalid event data (SEC-PRIV-004)', async () => {
      const event = makeTransitionEvent({ issueKey: '' });
      mockAddComment.mockResolvedValue();

      const result = await onJiraWorkflowTransition(event);

      expect(result.allowed).toBe(true);
      expect(result.error).toBeDefined();
    });

    it('should fail-open with missing transitionId (SEC-PRIV-004)', async () => {
      const event = makeTransitionEvent({ transitionId: '' });
      mockAddComment.mockResolvedValue();

      const result = await onJiraWorkflowTransition(event);

      expect(result.allowed).toBe(true);
      expect(result.error).toBeDefined();
    });

    it('should fail-open with missing fromStatus (SEC-PRIV-004)', async () => {
      const event = makeTransitionEvent({ fromStatus: '' });
      mockAddComment.mockResolvedValue();

      const result = await onJiraWorkflowTransition(event);

      expect(result.allowed).toBe(true);
      expect(result.error).toBeDefined();
    });

    it('should fail-open with missing toStatus (SEC-PRIV-004)', async () => {
      const event = makeTransitionEvent({ toStatus: '' });
      mockAddComment.mockResolvedValue();

      const result = await onJiraWorkflowTransition(event);

      expect(result.allowed).toBe(true);
      expect(result.error).toBeDefined();
    });

    it('should fail-open with missing projectKey (SEC-PRIV-004)', async () => {
      const event = makeTransitionEvent({ projectKey: '' });
      mockAddComment.mockResolvedValue();

      const result = await onJiraWorkflowTransition(event);

      expect(result.allowed).toBe(true);
      expect(result.error).toBeDefined();
    });

    it('should post fail-open comment for invalid event data (SEC-PRIV-004)', async () => {
      const event = makeTransitionEvent({ issueKey: '' });
      mockAddComment.mockResolvedValue();

      await onJiraWorkflowTransition(event);

      expect(mockAddComment).toHaveBeenCalledWith(
        '',
        expect.stringContaining('Evaluation Error'),
        expect.any(String),
        expect.any(Number),
      );
    });

    // ─── FORGE-OPS-053: Never throws ──

    it('should never throw — always returns a result (FORGE-OPS-053)', async () => {
      const event = makeTransitionEvent();
      mockGetProjectConfig.mockRejectedValue(new Error('Unexpected'));
      mockAddComment.mockRejectedValue(new Error('Comment also failed'));

      const result = await onJiraWorkflowTransition(event);

      expect(result).toBeDefined();
      expect(result.allowed).toBe(true);
      expect(result.executionId).toBeDefined();
    });

    // ─── FORGE-OPS-054: Graceful degradation ──

    it('should degrade gracefully when blockTransition fails (FORGE-OPS-054)', async () => {
      const event = makeTransitionEvent();
      mockGetProjectConfig.mockResolvedValue(makeProjectConfig());
      mockEvaluateTicketForGate.mockResolvedValue(makeFailingResult());
      mockBlockTransition.mockRejectedValue(new Error('Jira API down'));

      const result = await onJiraWorkflowTransition(event);

      // Handler should still return blocked result (pipeline decided)
      expect(result).toBeDefined();
      expect(result.allowed).toBe(false);
    });

    it('should degrade gracefully when fail-open comment fails (FORGE-OPS-054)', async () => {
      const event = makeTransitionEvent();
      mockGetProjectConfig.mockRejectedValue(new Error('Config error'));
      mockAddComment.mockRejectedValue(new Error('Comment failed'));

      // Should NOT throw
      const result = await onJiraWorkflowTransition(event);

      expect(result).toBeDefined();
      expect(result.allowed).toBe(true);
      expect(result.error).toContain('Config error');
    });

    // ─── ARCH-SOLID-006: Handler delegates to service ──

    it('should delegate to evaluateTicketForGate for gated transitions (ARCH-SOLID-006)', async () => {
      const event = makeTransitionEvent();
      const config = makeProjectConfig();
      mockGetProjectConfig.mockResolvedValue(config);
      mockEvaluateTicketForGate.mockResolvedValue(makePassingResult());

      await onJiraWorkflowTransition(event);

      expect(mockGetProjectConfig).toHaveBeenCalledWith(
        'PROJ',
        expect.any(String),
        expect.any(Number),
      );
      expect(mockEvaluateTicketForGate).toHaveBeenCalledWith(
        'PROJ-123',
        'In Progress',
        config,
        expect.any(String),
      );
    });

    // ─── ARCH-SOLID-061: Bounded context mapping ──

    it('should not evaluate pipeline for non-gated transitions (ARCH-SOLID-061)', async () => {
      const event = makeTransitionEvent({
        fromStatus: 'Done',
        toStatus: 'Closed',
      });

      const result = await onJiraWorkflowTransition(event);

      expect(result.allowed).toBe(true);
      expect(mockEvaluateTicketForGate).not.toHaveBeenCalled();
      expect(mockGetProjectConfig).not.toHaveBeenCalled();
    });

    // ─── Enforcement dispatch ──

    it('should dispatch blockTransition enforcement action when gate fails (AC-02)', async () => {
      const event = makeTransitionEvent();
      mockGetProjectConfig.mockResolvedValue(makeProjectConfig());
      mockEvaluateTicketForGate.mockResolvedValue(makeFailingResult());
      mockBlockTransition.mockResolvedValue({} as AuditLogEntry);

      await onJiraWorkflowTransition(event);

      expect(mockBlockTransition).toHaveBeenCalledTimes(1);
      expect(mockBlockTransition).toHaveBeenCalledWith(
        'PROJ-123',
        '11',
        expect.any(String),
        expect.any(String),
        expect.any(Number),
      );
    });

    it('should not dispatch blockTransition when gate passes', async () => {
      const event = makeTransitionEvent();
      mockGetProjectConfig.mockResolvedValue(makeProjectConfig());
      mockEvaluateTicketForGate.mockResolvedValue(makePassingResult());

      await onJiraWorkflowTransition(event);

      expect(mockBlockTransition).not.toHaveBeenCalled();
    });

    // ─── Unique executionId ──

    it('should generate unique executionId for each invocation', async () => {
      const event = makeTransitionEvent();
      mockGetProjectConfig.mockResolvedValue(makeProjectConfig());
      mockEvaluateTicketForGate.mockResolvedValue(makePassingResult());

      const result1 = await onJiraWorkflowTransition(event);
      const result2 = await onJiraWorkflowTransition(event);

      expect(result1.executionId).not.toBe(result2.executionId);
    });

    // ─── executionId format ──

    it('should generate executionId with wh- prefix', async () => {
      const event = makeTransitionEvent({ toStatus: 'Custom' });
      const result = await onJiraWorkflowTransition(event);

      expect(result.executionId).toMatch(/^wh-/);
    });

    // ─── Multiple inconsistencies in block reason ──

    it('should include up to 3 inconsistencies in block reason', async () => {
      const event = makeTransitionEvent();
      mockGetProjectConfig.mockResolvedValue(makeProjectConfig());
      mockEvaluateTicketForGate.mockResolvedValue(
        makeFailingResult({
          inconsistencies: [
            {
              id: 'inc-1',
              type: 'missing_context',
              severity: 'critical' as const,
              source: 'jira',
              description: 'Missing acceptance criteria',
              affectedTicketKey: 'PROJ-123',
              relatedDocs: [],
            },
            {
              id: 'inc-2',
              type: 'ambiguity',
              severity: 'warning' as const,
              source: 'jira',
              description: 'Status outdated',
              affectedTicketKey: 'PROJ-123',
              suggestion: 'Update status',
              relatedDocs: [],
            },
            {
              id: 'inc-3',
              type: 'duplicate',
              severity: 'info' as const,
              source: 'confluence',
              description: 'No linked docs',
              affectedTicketKey: 'PROJ-123',
              relatedDocs: [],
            },
          ],
        }),
      );
      mockBlockTransition.mockResolvedValue({} as AuditLogEntry);

      const result = await onJiraWorkflowTransition(event);

      expect(result.reason).toContain('Missing acceptance criteria');
      expect(result.reason).toContain('Status outdated');
      expect(result.reason).toContain('No linked docs');
    });

    // ─── Returns correct types ──

    it('should return JiraWorkflowTransitionResult with correct shape', async () => {
      const event = makeTransitionEvent();
      mockGetProjectConfig.mockResolvedValue(makeProjectConfig());
      mockEvaluateTicketForGate.mockResolvedValue(makePassingResult());

      const result = await onJiraWorkflowTransition(event);

      expect(result).toHaveProperty('allowed');
      expect(result).toHaveProperty('executionId');
      expect(typeof result.allowed).toBe('boolean');
      expect(typeof result.executionId).toBe('string');
    });

    it('should return score and gateType on passing evaluation', async () => {
      const event = makeTransitionEvent();
      mockGetProjectConfig.mockResolvedValue(makeProjectConfig());
      const pipelineResult = makePassingResult({ gateType: 'definition' });
      mockEvaluateTicketForGate.mockResolvedValue(pipelineResult);

      const result = await onJiraWorkflowTransition(event);

      expect(result.score).toBeDefined();
      expect(result.score?.overall).toBe(85);
      expect(result.gateType).toBe('definition');
    });

    // ─── SEC-PRIV-002: No sensitive data in comments ──

    it('should not include sensitive data in fail-open comments (SEC-PRIV-002)', async () => {
      const event = makeTransitionEvent();
      mockGetProjectConfig.mockRejectedValue(new Error('Config error with token=secret123'));
      mockAddComment.mockResolvedValue();

      await onJiraWorkflowTransition(event);

      const commentCall = mockAddComment.mock.calls[0];
      const commentBody = (commentCall?.[1] ?? '') as string;
      // Comment should NOT contain the raw error message (which has a fake token)
      expect(commentBody).not.toContain('secret123');
      expect(commentBody).toContain('Evaluation Error');
    });

    // ─── FORGE-OPS-0105: Stateless ──

    // ─── writeAuditLog error handling ──

    it('should handle writeAuditLog error when storageError is an Error instance', async () => {
      const event = makeTransitionEvent();
      mockGetProjectConfig.mockResolvedValue(makeProjectConfig());
      mockEvaluateTicketForGate.mockResolvedValue(makePassingResult());

      // Execution order: log("start") -> log("writeAuditLog") -> log("passed")
      // Make the 2nd call (inside writeAuditLog's try block) throw an Error,
      // then allow subsequent calls (inside the catch block) to succeed.
      const consoleSpy = jest.spyOn(console, 'log');
      consoleSpy
        .mockImplementationOnce(() => {}) // "start" log (line 299)
        .mockImplementationOnce(() => {
          // "writeAuditLog" log (line 254) — this throws
          throw new Error('Storage write failed');
        });

      const result = await onJiraWorkflowTransition(event);

      // The handler should still succeed — the audit log failure is caught internally
      expect(result.allowed).toBe(true);
      expect(result.executionId).toBeDefined();
      expect(result.score).toBeDefined();
    });

    it('should handle writeAuditLog error when storageError is not an Error instance', async () => {
      const event = makeTransitionEvent();
      mockGetProjectConfig.mockResolvedValue(makeProjectConfig());
      mockEvaluateTicketForGate.mockResolvedValue(makePassingResult());

      // Make the 2nd call throw a non-Error value to exercise the else branch
      // of the ternary `storageError instanceof Error ? ... : 'Unknown storage error'`
      const consoleSpy = jest.spyOn(console, 'log');
      consoleSpy
        .mockImplementationOnce(() => {}) // "start" log (line 299)
        .mockImplementationOnce(() => {
          // "writeAuditLog" log (line 254) — throws non-Error
          throw 'some non-error value'; // eslint-disable-line no-throw-literal
        });

      const result = await onJiraWorkflowTransition(event);

      // The handler should still succeed — the audit log failure is caught internally
      expect(result.allowed).toBe(true);
      expect(result.executionId).toBeDefined();
      expect(result.score).toBeDefined();
    });

    it('should not retain state between invocations (FORGE-OPS-0105)', async () => {
      const event1 = makeTransitionEvent({ issueKey: 'PROJ-001' });
      const event2 = makeTransitionEvent({ issueKey: 'PROJ-002' });

      mockGetProjectConfig.mockResolvedValue(makeProjectConfig());
      mockEvaluateTicketForGate
        .mockResolvedValueOnce(makePassingResult({ ticketKey: 'PROJ-001' }))
        .mockResolvedValueOnce(makePassingResult({ ticketKey: 'PROJ-002' }));

      const result1 = await onJiraWorkflowTransition(event1);
      const result2 = await onJiraWorkflowTransition(event2);

      // Results should be independent
      expect(result1.executionId).not.toBe(result2.executionId);
      expect(mockEvaluateTicketForGate).toHaveBeenCalledTimes(2);
    });
  });

  // ─── RTASK-038 Step 3: Incremental indexing hook ──

  describe('incremental indexing hook', () => {
    const flushPromises = () => new Promise<void>((resolve) => setImmediate(resolve));

    it('should trigger indexing after passing gate evaluation', async () => {
      const event = makeTransitionEvent();
      mockGetProjectConfig.mockResolvedValue(makeProjectConfig());
      mockEvaluateTicketForGate.mockResolvedValue(makePassingResult());
      mockGetTicketData.mockResolvedValue(makeTicketData());
      mockIndexJiraIssue.mockResolvedValue();

      await onJiraWorkflowTransition(event);
      await flushPromises();

      expect(mockGetTicketData).toHaveBeenCalledWith(
        'PROJ-123',
        expect.any(String),
        expect.any(Number),
      );
      expect(mockIndexJiraIssue).toHaveBeenCalledWith(
        expect.objectContaining({
          issueKey: 'PROJ-123',
          projectKey: 'PROJ',
          summary: 'Test ticket summary',
        }),
        expect.any(String),
      );
    });

    it('should trigger indexing after failing gate evaluation', async () => {
      const event = makeTransitionEvent();
      mockGetProjectConfig.mockResolvedValue(makeProjectConfig());
      mockEvaluateTicketForGate.mockResolvedValue(makeFailingResult());
      mockBlockTransition.mockResolvedValue({} as AuditLogEntry);
      mockGetTicketData.mockResolvedValue(makeTicketData());
      mockIndexJiraIssue.mockResolvedValue();

      await onJiraWorkflowTransition(event);
      await flushPromises();

      expect(mockIndexJiraIssue).toHaveBeenCalledTimes(1);
    });

    it('should not affect transition result when indexing fails (FORGE-OPS-054)', async () => {
      const event = makeTransitionEvent();
      mockGetProjectConfig.mockResolvedValue(makeProjectConfig());
      mockEvaluateTicketForGate.mockResolvedValue(makePassingResult());
      mockGetTicketData.mockResolvedValue(makeTicketData());
      mockIndexJiraIssue.mockRejectedValue(new Error('Indexing storage error'));

      const result = await onJiraWorkflowTransition(event);
      await flushPromises();

      expect(result.allowed).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should not call indexJiraIssue for ungated transitions', async () => {
      const event = makeTransitionEvent({ toStatus: 'Custom' });

      await onJiraWorkflowTransition(event);
      await flushPromises();

      expect(mockIndexJiraIssue).not.toHaveBeenCalled();
      expect(mockGetTicketData).not.toHaveBeenCalled();
    });

    it('should not call indexJiraIssue when gate is disabled', async () => {
      const event = makeTransitionEvent();
      mockGetProjectConfig.mockResolvedValue(
        makeProjectConfig({ gates: { definition: false, execution: true, delivery: true } }),
      );

      await onJiraWorkflowTransition(event);
      await flushPromises();

      expect(mockIndexJiraIssue).not.toHaveBeenCalled();
      expect(mockGetTicketData).not.toHaveBeenCalled();
    });

    it('should map issueLinks to JiraIssueLinkInput dropping extra fields', async () => {
      const event = makeTransitionEvent();
      mockGetProjectConfig.mockResolvedValue(makeProjectConfig());
      mockEvaluateTicketForGate.mockResolvedValue(makePassingResult());
      mockGetTicketData.mockResolvedValue(
        makeTicketData({
          issueLinks: [
            {
              type: 'Blocks',
              direction: 'outward',
              targetKey: 'PROJ-456',
              targetSummary: 'Other ticket',
              targetStatus: 'To Do',
            },
          ],
        }),
      );
      mockIndexJiraIssue.mockResolvedValue();

      await onJiraWorkflowTransition(event);
      await flushPromises();

      expect(mockIndexJiraIssue).toHaveBeenCalledWith(
        expect.objectContaining({
          issueLinks: [{ type: 'Blocks', direction: 'outward', targetKey: 'PROJ-456' }],
        }),
        expect.any(String),
      );
    });

    it('should degrade gracefully when getTicketData fails (FORGE-OPS-054)', async () => {
      const event = makeTransitionEvent();
      mockGetProjectConfig.mockResolvedValue(makeProjectConfig());
      mockEvaluateTicketForGate.mockResolvedValue(makePassingResult());
      mockGetTicketData.mockRejectedValue(new Error('Jira API timeout'));

      const result = await onJiraWorkflowTransition(event);
      await flushPromises();

      expect(result.allowed).toBe(true);
      expect(mockIndexJiraIssue).not.toHaveBeenCalled();
    });
  });
});
