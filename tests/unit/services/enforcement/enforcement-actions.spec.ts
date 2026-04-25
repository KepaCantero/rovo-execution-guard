// Test suite for enforcement actions module
// Covers: blockTransition, blockPR, addComment, flagInconsistency, approvePR, executeAction
// Pattern: Arrange-Act-Assert (AAA), TDD cycle: RED -> GREEN -> REFACTOR
// [TEST-QA-001]

import {
  blockTransition,
  blockPR,
  addComment,
  flagInconsistency,
  approvePR,
  executeAction,
} from '../../../../src/backend/services/enforcement/enforcement-actions';

import type { EnforcementContext } from '../../../../src/backend/services/enforcement/enforcement-actions';

import type { EnforcementAction } from '../../../../src/backend/types/enforcement';

import type { Inconsistency } from '../../../../src/backend/types/inconsistency';

import type { AuditLogEntry } from '../../../../src/backend/types/audit-log';

import type { GitHubStatusCheck } from '../../../../src/backend/types/github-data';

import {
  REGError,
  JiraApiError,
  GitHubApiError,
  TimeoutError,
} from '../../../../src/backend/types/errors';

// ═══════════════════════════════════════════
// MOCKS — [ARCH-SOLID-006] Mock adapters (repository layer), never internal service helpers
// ═══════════════════════════════════════════

jest.mock('../../../../src/backend/services/jira/jira-adapter', () => ({
  addComment: jest.fn(),
}));

jest.mock('../../../../src/backend/services/github/github-adapter', () => ({
  createStatusCheck: jest.fn(),
  createPRComment: jest.fn(),
}));

import { addComment as jiraAddComment } from '../../../../src/backend/services/jira/jira-adapter';
import {
  createStatusCheck,
  createPRComment,
} from '../../../../src/backend/services/github/github-adapter';

const mockedJiraAddComment = jiraAddComment as jest.MockedFunction<typeof jiraAddComment>;
const mockedCreateStatusCheck = createStatusCheck as jest.MockedFunction<typeof createStatusCheck>;
const mockedCreatePRComment = createPRComment as jest.MockedFunction<typeof createPRComment>;

// ═══════════════════════════════════════════
// FIXTURES — [ARCH-SOLID-203] Readonly properties, typed fixtures
// ═══════════════════════════════════════════

const EXECUTION_ID = 'exec-test-001' as const;
const ISSUE_KEY = 'PROJ-123' as const;
const TRANSITION_ID = 'trans-51' as const;
const REPO = 'my-org/my-repo' as const;
const PR_NUMBER = 42;
const COMMIT_SHA = 'abc123def456' as const;
const TOKEN = 'ghp_testtoken123' as const;

const makeInconsistency = (overrides: Partial<Readonly<Inconsistency>> = {}): Inconsistency => ({
  id: 'inc-001',
  type: 'contradiction',
  severity: 'critical',
  source: 'rovo',
  description: 'Description contradicts summary',
  affectedTicketKey: 'PROJ-123',
  relatedDocs: ['doc-1', 'doc-2'],
  suggestion: 'Align description with summary',
  ...overrides,
});

const makeEnforcementContext = (
  overrides: Partial<Readonly<EnforcementContext>> = {},
): EnforcementContext => ({
  issueKey: ISSUE_KEY,
  projectKey: 'PROJ',
  commitSha: COMMIT_SHA,
  token: TOKEN,
  repo: REPO,
  prNumber: PR_NUMBER,
  executionId: EXECUTION_ID,
  ...overrides,
});

const SCORE_DETAILS: Readonly<Record<string, unknown>> = {
  scoreAxes: {
    clarity: 90,
    consistency: 75,
    risk: 85,
    documentation: 60,
    technicalDebt: 70,
  },
  scoreThreshold: 80,
  overallScore: 76,
};

// ═══════════════════════════════════════════
// TEST SUITE
// ═══════════════════════════════════════════

describe('enforcement-actions', () => {
  let consoleSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleSpy = jest.spyOn(console, 'log').mockImplementation();
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  // ─── blockTransition() ────────────────────

  describe('blockTransition()', () => {
    // ─── AC-01: blockTransition prevents transition and comments reason

    it('should call jira-adapter addComment with correct issue key and comment body (AC-01)', async () => {
      // Arrange
      mockedJiraAddComment.mockResolvedValueOnce(undefined);

      // Act
      const result = await blockTransition(
        ISSUE_KEY,
        TRANSITION_ID,
        'Quality gate failed',
        EXECUTION_ID,
      );

      // Assert
      expect(mockedJiraAddComment).toHaveBeenCalledTimes(1);
      expect(mockedJiraAddComment).toHaveBeenCalledWith(
        ISSUE_KEY,
        expect.stringContaining(TRANSITION_ID),
        EXECUTION_ID,
        8000,
      );
      expect(result).toBeDefined();
    });

    it('should return an AuditLogEntry with action ticket_blocked (AC-01, SEC-PRIV-010)', async () => {
      // Arrange
      mockedJiraAddComment.mockResolvedValueOnce(undefined);

      // Act
      const result: AuditLogEntry = await blockTransition(
        ISSUE_KEY,
        TRANSITION_ID,
        'Quality gate failed',
        EXECUTION_ID,
      );

      // Assert
      expect(result.action).toBe('ticket_blocked');
      expect(result.executionId).toBe(EXECUTION_ID);
      expect(result.projectKey).toBe('PROJ');
      expect(result.ticketKey).toBe(ISSUE_KEY);
      expect(result.id).toMatch(/^audit-/);
      expect(result.timestamp).toBeDefined();
      expect(result.details).toEqual({
        transitionId: TRANSITION_ID,
        reason: 'Quality gate failed',
      });
    });

    it('should include structured log with executionId (AC-07, TEST-QA-036-03)', async () => {
      // Arrange
      mockedJiraAddComment.mockResolvedValueOnce(undefined);

      // Act
      await blockTransition(ISSUE_KEY, TRANSITION_ID, 'Reason', EXECUTION_ID);

      // Assert
      expect(consoleSpy).toHaveBeenCalledTimes(2);
      const logCalls = consoleSpy.mock.calls.map(
        (call: [string]) => JSON.parse(call[0]) as Record<string, unknown>,
      );
      expect(logCalls[0]?.operation).toBe('blockTransition');
      expect(logCalls[0]?.executionId).toBe(EXECUTION_ID);
      expect(logCalls[1]?.operation).toBe('blockTransition');
    });

    it('should propagate JiraApiError when adapter fails (ARCH-SOLID-053)', async () => {
      // Arrange
      const error = new JiraApiError('API failed', 'JIRA_ERROR', EXECUTION_ID);
      mockedJiraAddComment.mockRejectedValueOnce(error);

      // Act & Assert
      await expect(
        blockTransition(ISSUE_KEY, TRANSITION_ID, 'Reason', EXECUTION_ID),
      ).rejects.toThrow(JiraApiError);
    });

    it('should propagate TimeoutError when adapter times out (ARCH-SOLID-053)', async () => {
      // Arrange
      const error = new TimeoutError('Timed out', 'TIMEOUT', EXECUTION_ID);
      mockedJiraAddComment.mockRejectedValueOnce(error);

      // Act & Assert
      await expect(
        blockTransition(ISSUE_KEY, TRANSITION_ID, 'Reason', EXECUTION_ID),
      ).rejects.toThrow(TimeoutError);
    });

    // ─── Validation (SEC-PRIV-004)

    it('should throw REGError VALIDATION_ERROR for empty issueKey (SEC-PRIV-004)', async () => {
      // Act & Assert
      await expect(blockTransition('', TRANSITION_ID, 'Reason')).rejects.toThrow(REGError);
      await expect(blockTransition('', TRANSITION_ID, 'Reason')).rejects.toMatchObject({
        code: 'VALIDATION_ERROR',
      });
    });

    it('should throw REGError VALIDATION_ERROR for whitespace-only issueKey (SEC-PRIV-004)', async () => {
      // Act & Assert
      await expect(blockTransition('   ', TRANSITION_ID, 'Reason')).rejects.toThrow(REGError);
    });

    it('should throw REGError VALIDATION_ERROR for empty transitionId (SEC-PRIV-004)', async () => {
      // Act & Assert
      await expect(blockTransition(ISSUE_KEY, '', 'Reason')).rejects.toMatchObject({
        code: 'VALIDATION_ERROR',
      });
    });

    it('should throw REGError VALIDATION_ERROR for empty reason (SEC-PRIV-004)', async () => {
      // Act & Assert
      await expect(blockTransition(ISSUE_KEY, TRANSITION_ID, '')).rejects.toMatchObject({
        code: 'VALIDATION_ERROR',
      });
    });

    it('should use default executionId "unknown" when not provided', async () => {
      // Arrange
      mockedJiraAddComment.mockResolvedValueOnce(undefined);

      // Act
      const result = await blockTransition(ISSUE_KEY, TRANSITION_ID, 'Reason');

      // Assert
      expect(result.executionId).toBe('unknown');
    });
  });

  // ─── blockPR() ────────────────────────────

  describe('blockPR()', () => {
    // ─── AC-02: blockPR creates failure status check and comment

    it('should create a failure status check with correct context (AC-02, GH-INTEG-305)', async () => {
      // Arrange
      mockedCreateStatusCheck.mockResolvedValueOnce(undefined);
      mockedCreatePRComment.mockResolvedValueOnce(undefined);

      // Act
      await blockPR(REPO, PR_NUMBER, COMMIT_SHA, 'Low score', TOKEN, SCORE_DETAILS, EXECUTION_ID);

      // Assert
      expect(mockedCreateStatusCheck).toHaveBeenCalledTimes(1);
      const statusArg = mockedCreateStatusCheck.mock.calls[0]?.[0] as GitHubStatusCheck;
      expect(statusArg.state).toBe('failure');
      expect(statusArg.context).toBe('rovo-execution-guard/consistency');
      expect(statusArg.description).toBe('Low score');
    });

    it('should post a PR comment with block template (AC-02)', async () => {
      // Arrange
      mockedCreateStatusCheck.mockResolvedValueOnce(undefined);
      mockedCreatePRComment.mockResolvedValueOnce(undefined);

      // Act
      await blockPR(REPO, PR_NUMBER, COMMIT_SHA, 'Low score', TOKEN, SCORE_DETAILS, EXECUTION_ID);

      // Assert
      expect(mockedCreatePRComment).toHaveBeenCalledTimes(1);
      expect(mockedCreatePRComment).toHaveBeenCalledWith(
        REPO,
        PR_NUMBER,
        expect.stringContaining('PR Blocked'),
        TOKEN,
        EXECUTION_ID,
        8000,
      );
    });

    it('should return AuditLogEntry with action pr_blocked (SEC-PRIV-010)', async () => {
      // Arrange
      mockedCreateStatusCheck.mockResolvedValueOnce(undefined);
      mockedCreatePRComment.mockResolvedValueOnce(undefined);

      // Act
      const result = await blockPR(
        REPO,
        PR_NUMBER,
        COMMIT_SHA,
        'Low score',
        TOKEN,
        SCORE_DETAILS,
        EXECUTION_ID,
      );

      // Assert
      expect(result.action).toBe('pr_blocked');
      expect(result.executionId).toBe(EXECUTION_ID);
      expect(result.prNumber).toBe(PR_NUMBER);
      expect(result.projectKey).toBe('my-org');
    });

    it('should propagate GitHubApiError when status check fails (ARCH-SOLID-053)', async () => {
      // Arrange
      const error = new GitHubApiError('API failed', 'GH_ERROR', EXECUTION_ID);
      mockedCreateStatusCheck.mockRejectedValueOnce(error);

      // Act & Assert
      await expect(
        blockPR(REPO, PR_NUMBER, COMMIT_SHA, 'Reason', TOKEN, SCORE_DETAILS, EXECUTION_ID),
      ).rejects.toThrow(GitHubApiError);
    });

    it('should propagate GitHubApiError when PR comment fails (ARCH-SOLID-053)', async () => {
      // Arrange
      mockedCreateStatusCheck.mockResolvedValueOnce(undefined);
      const error = new GitHubApiError('Comment failed', 'GH_ERROR', EXECUTION_ID);
      mockedCreatePRComment.mockRejectedValueOnce(error);

      // Act & Assert
      await expect(
        blockPR(REPO, PR_NUMBER, COMMIT_SHA, 'Reason', TOKEN, SCORE_DETAILS, EXECUTION_ID),
      ).rejects.toThrow(GitHubApiError);
    });

    // ─── Validation (SEC-PRIV-004)

    it('should throw REGError VALIDATION_ERROR for empty repo', async () => {
      await expect(
        blockPR('', PR_NUMBER, COMMIT_SHA, 'Reason', TOKEN, {}, EXECUTION_ID),
      ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    });

    it('should throw REGError VALIDATION_ERROR for non-positive prNumber', async () => {
      await expect(
        blockPR(REPO, 0, COMMIT_SHA, 'Reason', TOKEN, {}, EXECUTION_ID),
      ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    });

    it('should throw REGError VALIDATION_ERROR for negative prNumber', async () => {
      await expect(
        blockPR(REPO, -1, COMMIT_SHA, 'Reason', TOKEN, {}, EXECUTION_ID),
      ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    });

    it('should throw REGError VALIDATION_ERROR for empty commitSha', async () => {
      await expect(
        blockPR(REPO, PR_NUMBER, '', 'Reason', TOKEN, {}, EXECUTION_ID),
      ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    });

    it('should throw REGError VALIDATION_ERROR for empty token', async () => {
      await expect(
        blockPR(REPO, PR_NUMBER, COMMIT_SHA, 'Reason', '', {}, EXECUTION_ID),
      ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    });

    it('should throw REGError VALIDATION_ERROR for empty reason', async () => {
      await expect(
        blockPR(REPO, PR_NUMBER, COMMIT_SHA, '', TOKEN, {}, EXECUTION_ID),
      ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    });

    it('should handle empty details object without score breakdown section', async () => {
      // Arrange
      mockedCreateStatusCheck.mockResolvedValueOnce(undefined);
      mockedCreatePRComment.mockResolvedValueOnce(undefined);

      // Act
      await blockPR(REPO, PR_NUMBER, COMMIT_SHA, 'Reason', TOKEN, {}, EXECUTION_ID);

      // Assert
      const commentBody = mockedCreatePRComment.mock.calls[0]?.[2] as string;
      expect(commentBody).not.toContain('<details>');
      expect(commentBody).toContain('PR Blocked');
    });
  });

  // ─── addComment() ─────────────────────────

  describe('addComment()', () => {
    // ─── AC-03: addComment delegates to correct adapter based on target

    it('should call jira-adapter when target is jira (AC-03, ARCH-SOLID-006)', async () => {
      // Arrange
      mockedJiraAddComment.mockResolvedValueOnce(undefined);

      // Act
      const result = await addComment('jira', ISSUE_KEY, 'Hello Jira', EXECUTION_ID);

      // Assert
      expect(mockedJiraAddComment).toHaveBeenCalledWith(
        ISSUE_KEY,
        'Hello Jira',
        EXECUTION_ID,
        8000,
      );
      expect(mockedCreatePRComment).not.toHaveBeenCalled();
      expect(result.action).toBe('enforcement_executed');
      expect(result.ticketKey).toBe(ISSUE_KEY);
    });

    it('should call github-adapter when target is github (AC-03, ARCH-SOLID-006)', async () => {
      // Arrange
      mockedCreatePRComment.mockResolvedValueOnce(undefined);
      const identifier = `${REPO}#${PR_NUMBER}`;

      // Act
      const result = await addComment(
        'github',
        identifier,
        'Hello GitHub',
        EXECUTION_ID,
        8000,
        TOKEN,
      );

      // Assert
      expect(mockedCreatePRComment).toHaveBeenCalledWith(
        REPO,
        PR_NUMBER,
        'Hello GitHub',
        TOKEN,
        EXECUTION_ID,
        8000,
      );
      expect(mockedJiraAddComment).not.toHaveBeenCalled();
      expect(result.action).toBe('enforcement_executed');
      expect(result.prNumber).toBe(PR_NUMBER);
    });

    it('should throw REGError when target is github and no token provided (SEC-PRIV-004)', async () => {
      // Act & Assert
      await expect(
        addComment('github', `${REPO}#${PR_NUMBER}`, 'Body', EXECUTION_ID, 8000),
      ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    });

    it('should throw REGError for invalid GitHub identifier format (SEC-PRIV-004)', async () => {
      // Act & Assert
      await expect(
        addComment('github', 'invalid-no-hash', 'Body', EXECUTION_ID, 8000, TOKEN),
      ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    });

    it('should throw REGError VALIDATION_ERROR for empty identifier (SEC-PRIV-004)', async () => {
      // Act & Assert
      await expect(addComment('jira', '', 'Body')).rejects.toMatchObject({
        code: 'VALIDATION_ERROR',
      });
    });

    it('should throw REGError VALIDATION_ERROR for empty body (SEC-PRIV-004)', async () => {
      // Act & Assert
      await expect(addComment('jira', ISSUE_KEY, '')).rejects.toMatchObject({
        code: 'VALIDATION_ERROR',
      });
    });

    it('should return AuditLogEntry with enforcement_executed action (SEC-PRIV-010)', async () => {
      // Arrange
      mockedJiraAddComment.mockResolvedValueOnce(undefined);

      // Act
      const result = await addComment('jira', ISSUE_KEY, 'Test body', EXECUTION_ID);

      // Assert
      expect(result.action).toBe('enforcement_executed');
      expect(result.executionId).toBe(EXECUTION_ID);
      expect(result.projectKey).toBe('PROJ');
    });

    it('should propagate JiraApiError from jira-adapter (ARCH-SOLID-053)', async () => {
      // Arrange
      mockedJiraAddComment.mockRejectedValueOnce(
        new JiraApiError('Jira error', 'JIRA_ERR', EXECUTION_ID),
      );

      // Act & Assert
      await expect(addComment('jira', ISSUE_KEY, 'Body', EXECUTION_ID)).rejects.toThrow(
        JiraApiError,
      );
    });

    it('should propagate GitHubApiError from github-adapter (ARCH-SOLID-053)', async () => {
      // Arrange
      mockedCreatePRComment.mockRejectedValueOnce(
        new GitHubApiError('GH error', 'GH_ERR', EXECUTION_ID),
      );

      // Act & Assert
      await expect(
        addComment('github', `${REPO}#${PR_NUMBER}`, 'Body', EXECUTION_ID, 8000, TOKEN),
      ).rejects.toThrow(GitHubApiError);
    });
  });

  // ─── flagInconsistency() ──────────────────

  describe('flagInconsistency()', () => {
    // ─── AC-04: flagInconsistency registers and notifies

    it('should post a severity-colored comment on the affected ticket (AC-04)', async () => {
      // Arrange
      mockedJiraAddComment.mockResolvedValueOnce(undefined);
      const inconsistency = makeInconsistency({ severity: 'critical' });

      // Act
      const result = await flagInconsistency(inconsistency, EXECUTION_ID);

      // Assert
      expect(mockedJiraAddComment).toHaveBeenCalledWith(
        inconsistency.affectedTicketKey,
        expect.stringContaining(':rotating_light:'),
        EXECUTION_ID,
        8000,
      );
      expect(result.action).toBe('inconsistency_flagged');
    });

    it('should include correct severity emoji for warning level', async () => {
      // Arrange
      mockedJiraAddComment.mockResolvedValueOnce(undefined);
      const inconsistency = makeInconsistency({ severity: 'warning' });

      // Act
      await flagInconsistency(inconsistency, EXECUTION_ID);

      // Assert
      const commentBody = mockedJiraAddComment.mock.calls[0]?.[1] as string;
      expect(commentBody).toContain(':warning:');
    });

    it('should include correct severity emoji for info level', async () => {
      // Arrange
      mockedJiraAddComment.mockResolvedValueOnce(undefined);
      const inconsistency = makeInconsistency({ severity: 'info' });

      // Act
      await flagInconsistency(inconsistency, EXECUTION_ID);

      // Assert
      const commentBody = mockedJiraAddComment.mock.calls[0]?.[1] as string;
      expect(commentBody).toContain(':information_source:');
    });

    it('should include suggestion when present (AC-08)', async () => {
      // Arrange
      mockedJiraAddComment.mockResolvedValueOnce(undefined);
      const inconsistency = makeInconsistency({ suggestion: 'Fix this now' });

      // Act
      await flagInconsistency(inconsistency, EXECUTION_ID);

      // Assert
      const commentBody = mockedJiraAddComment.mock.calls[0]?.[1] as string;
      expect(commentBody).toContain('Fix this now');
    });

    it('should not include suggestion line when absent', async () => {
      // Arrange
      mockedJiraAddComment.mockResolvedValueOnce(undefined);
      const inconsistency = makeInconsistency({ suggestion: undefined });

      // Act
      await flagInconsistency(inconsistency, EXECUTION_ID);

      // Assert
      const commentBody = mockedJiraAddComment.mock.calls[0]?.[1] as string;
      expect(commentBody).not.toContain('**Suggestion:**');
    });

    it('should include related docs when present (AC-08)', async () => {
      // Arrange
      mockedJiraAddComment.mockResolvedValueOnce(undefined);
      const inconsistency = makeInconsistency({ relatedDocs: ['doc-a', 'doc-b'] });

      // Act
      await flagInconsistency(inconsistency, EXECUTION_ID);

      // Assert
      const commentBody = mockedJiraAddComment.mock.calls[0]?.[1] as string;
      expect(commentBody).toContain('doc-a');
      expect(commentBody).toContain('doc-b');
      expect(commentBody).toContain('**Related Documents:**');
    });

    it('should not include related docs section when empty', async () => {
      // Arrange
      mockedJiraAddComment.mockResolvedValueOnce(undefined);
      const inconsistency = makeInconsistency({ relatedDocs: [] });

      // Act
      await flagInconsistency(inconsistency, EXECUTION_ID);

      // Assert
      const commentBody = mockedJiraAddComment.mock.calls[0]?.[1] as string;
      expect(commentBody).not.toContain('**Related Documents:**');
    });

    it('should return AuditLogEntry with inconsistency details (SEC-PRIV-010)', async () => {
      // Arrange
      mockedJiraAddComment.mockResolvedValueOnce(undefined);
      const inconsistency = makeInconsistency();

      // Act
      const result = await flagInconsistency(inconsistency, EXECUTION_ID);

      // Assert
      expect(result.action).toBe('inconsistency_flagged');
      expect(result.executionId).toBe(EXECUTION_ID);
      expect(result.projectKey).toBe('PROJ');
      expect(result.ticketKey).toBe('PROJ-123');
      expect(result.details.inconsistencyId).toBe('inc-001');
      expect(result.details.severity).toBe('critical');
    });

    it('should throw REGError VALIDATION_ERROR for empty inconsistency id (SEC-PRIV-004)', async () => {
      // Arrange
      const inconsistency = makeInconsistency({ id: '' });

      // Act & Assert
      await expect(flagInconsistency(inconsistency)).rejects.toMatchObject({
        code: 'VALIDATION_ERROR',
      });
    });

    it('should throw REGError VALIDATION_ERROR for empty description (SEC-PRIV-004)', async () => {
      // Arrange
      const inconsistency = makeInconsistency({ description: '' });

      // Act & Assert
      await expect(flagInconsistency(inconsistency)).rejects.toMatchObject({
        code: 'VALIDATION_ERROR',
      });
    });

    it('should throw REGError VALIDATION_ERROR for empty affectedTicketKey (SEC-PRIV-004)', async () => {
      // Arrange
      const inconsistency = makeInconsistency({ affectedTicketKey: '' });

      // Act & Assert
      await expect(flagInconsistency(inconsistency)).rejects.toMatchObject({
        code: 'VALIDATION_ERROR',
      });
    });

    it('should propagate JiraApiError when adapter fails (ARCH-SOLID-053)', async () => {
      // Arrange
      mockedJiraAddComment.mockRejectedValueOnce(
        new JiraApiError('Failed', 'JIRA_ERR', EXECUTION_ID),
      );
      const inconsistency = makeInconsistency();

      // Act & Assert
      await expect(flagInconsistency(inconsistency, EXECUTION_ID)).rejects.toThrow(JiraApiError);
    });
  });

  // ─── approvePR() ──────────────────────────

  describe('approvePR()', () => {
    // ─── AC-05: approvePR creates success status check and comment

    it('should create a success status check with correct context (AC-05, GH-INTEG-305)', async () => {
      // Arrange
      mockedCreateStatusCheck.mockResolvedValueOnce(undefined);
      mockedCreatePRComment.mockResolvedValueOnce(undefined);

      // Act
      await approvePR(REPO, PR_NUMBER, COMMIT_SHA, TOKEN, SCORE_DETAILS, EXECUTION_ID);

      // Assert
      expect(mockedCreateStatusCheck).toHaveBeenCalledTimes(1);
      const statusArg = mockedCreateStatusCheck.mock.calls[0]?.[0] as GitHubStatusCheck;
      expect(statusArg.state).toBe('success');
      expect(statusArg.context).toBe('rovo-execution-guard/consistency');
    });

    it('should post an approval comment with score details (AC-05)', async () => {
      // Arrange
      mockedCreateStatusCheck.mockResolvedValueOnce(undefined);
      mockedCreatePRComment.mockResolvedValueOnce(undefined);

      // Act
      await approvePR(REPO, PR_NUMBER, COMMIT_SHA, TOKEN, SCORE_DETAILS, EXECUTION_ID);

      // Assert
      expect(mockedCreatePRComment).toHaveBeenCalledWith(
        REPO,
        PR_NUMBER,
        expect.stringContaining('PR Approved'),
        TOKEN,
        EXECUTION_ID,
        8000,
      );
      const commentBody = mockedCreatePRComment.mock.calls[0]?.[2] as string;
      expect(commentBody).toContain('76/100');
    });

    it('should return AuditLogEntry with action pr_approved (SEC-PRIV-010)', async () => {
      // Arrange
      mockedCreateStatusCheck.mockResolvedValueOnce(undefined);
      mockedCreatePRComment.mockResolvedValueOnce(undefined);

      // Act
      const result = await approvePR(
        REPO,
        PR_NUMBER,
        COMMIT_SHA,
        TOKEN,
        SCORE_DETAILS,
        EXECUTION_ID,
      );

      // Assert
      expect(result.action).toBe('pr_approved');
      expect(result.executionId).toBe(EXECUTION_ID);
      expect(result.prNumber).toBe(PR_NUMBER);
      expect(result.projectKey).toBe('my-org');
    });

    // ─── Validation (SEC-PRIV-004)

    it('should throw REGError VALIDATION_ERROR for empty repo', async () => {
      await expect(
        approvePR('', PR_NUMBER, COMMIT_SHA, TOKEN, {}, EXECUTION_ID),
      ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    });

    it('should throw REGError VALIDATION_ERROR for non-positive prNumber', async () => {
      await expect(approvePR(REPO, -5, COMMIT_SHA, TOKEN, {}, EXECUTION_ID)).rejects.toMatchObject({
        code: 'VALIDATION_ERROR',
      });
    });

    it('should throw REGError VALIDATION_ERROR for empty commitSha', async () => {
      await expect(approvePR(REPO, PR_NUMBER, '', TOKEN, {}, EXECUTION_ID)).rejects.toMatchObject({
        code: 'VALIDATION_ERROR',
      });
    });

    it('should throw REGError VALIDATION_ERROR for empty token', async () => {
      await expect(
        approvePR(REPO, PR_NUMBER, COMMIT_SHA, '', {}, EXECUTION_ID),
      ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    });

    it('should propagate GitHubApiError when status check fails (ARCH-SOLID-053)', async () => {
      // Arrange
      mockedCreateStatusCheck.mockRejectedValueOnce(
        new GitHubApiError('Failed', 'GH_ERR', EXECUTION_ID),
      );

      // Act & Assert
      await expect(
        approvePR(REPO, PR_NUMBER, COMMIT_SHA, TOKEN, SCORE_DETAILS, EXECUTION_ID),
      ).rejects.toThrow(GitHubApiError);
    });

    it('should handle details without overallScore gracefully', async () => {
      // Arrange
      mockedCreateStatusCheck.mockResolvedValueOnce(undefined);
      mockedCreatePRComment.mockResolvedValueOnce(undefined);

      // Act
      await approvePR(REPO, PR_NUMBER, COMMIT_SHA, TOKEN, { scoreThreshold: 80 }, EXECUTION_ID);

      // Assert
      const commentBody = mockedCreatePRComment.mock.calls[0]?.[2] as string;
      expect(commentBody).toContain('N/A');
    });
  });

  // ─── executeAction() ──────────────────────

  describe('executeAction()', () => {
    // ─── AC-06: executeAction dispatches based on action type

    it('should dispatch block_transition correctly (AC-06)', async () => {
      // Arrange
      mockedJiraAddComment.mockResolvedValueOnce(undefined);
      const action: EnforcementAction = {
        type: 'block_transition',
        transitionId: TRANSITION_ID,
        reason: 'Quality gate failed',
      };
      const context = makeEnforcementContext();

      // Act
      const result = await executeAction(action, context);

      // Assert
      expect(mockedJiraAddComment).toHaveBeenCalledTimes(1);
      expect(result.action).toBe('ticket_blocked');
    });

    it('should dispatch block_pr correctly (AC-06)', async () => {
      // Arrange
      mockedCreateStatusCheck.mockResolvedValueOnce(undefined);
      mockedCreatePRComment.mockResolvedValueOnce(undefined);
      const action: EnforcementAction = {
        type: 'block_pr',
        prNumber: PR_NUMBER,
        repo: REPO,
        reason: 'Low quality score',
      };
      const context = makeEnforcementContext();

      // Act
      const result = await executeAction(action, context);

      // Assert
      expect(mockedCreateStatusCheck).toHaveBeenCalledTimes(1);
      expect(result.action).toBe('pr_blocked');
    });

    it('should dispatch add_comment for jira target correctly (AC-06)', async () => {
      // Arrange
      mockedJiraAddComment.mockResolvedValueOnce(undefined);
      const action: EnforcementAction = {
        type: 'add_comment',
        target: 'jira',
        body: 'Test comment',
      };
      const context = makeEnforcementContext();

      // Act
      const result = await executeAction(action, context);

      // Assert
      expect(mockedJiraAddComment).toHaveBeenCalledTimes(1);
      expect(result.action).toBe('enforcement_executed');
    });

    it('should dispatch add_comment for github target correctly (AC-06)', async () => {
      // Arrange
      mockedCreatePRComment.mockResolvedValueOnce(undefined);
      const action: EnforcementAction = {
        type: 'add_comment',
        target: 'github',
        body: 'PR feedback',
      };
      const context = makeEnforcementContext();

      // Act
      const result = await executeAction(action, context);

      // Assert
      expect(mockedCreatePRComment).toHaveBeenCalledTimes(1);
      expect(result.action).toBe('enforcement_executed');
    });

    it('should dispatch flag_inconsistency correctly (AC-06)', async () => {
      // Arrange
      mockedJiraAddComment.mockResolvedValueOnce(undefined);
      const action: EnforcementAction = {
        type: 'flag_inconsistency',
        inconsistency: makeInconsistency(),
      };
      const context = makeEnforcementContext();

      // Act
      const result = await executeAction(action, context);

      // Assert
      expect(mockedJiraAddComment).toHaveBeenCalledTimes(1);
      expect(result.action).toBe('inconsistency_flagged');
    });

    it('should log action type in structured log (AC-07)', async () => {
      // Arrange
      mockedJiraAddComment.mockResolvedValueOnce(undefined);
      const action: EnforcementAction = {
        type: 'block_transition',
        transitionId: TRANSITION_ID,
        reason: 'Reason',
      };
      const context = makeEnforcementContext();

      // Act
      await executeAction(action, context);

      // Assert
      const logCalls = consoleSpy.mock.calls.map(
        (call: [string]) => JSON.parse(call[0]) as Record<string, unknown>,
      );
      expect(logCalls[0]?.operation).toBe('executeAction');
      expect(logCalls[0]?.actionType).toBe('block_transition');
    });

    it('should throw REGError for unknown action type (ARCH-SOLID-202)', async () => {
      // Arrange — bypass TypeScript with a runtime-only invalid type
      const invalidAction = {
        type: 'unknown_action',
      } as unknown as EnforcementAction;
      const context = makeEnforcementContext();

      // Act & Assert
      await expect(executeAction(invalidAction, context)).rejects.toThrow(REGError);
      await expect(executeAction(invalidAction, context)).rejects.toMatchObject({
        code: 'UNKNOWN_ACTION_TYPE',
      });
    });
  });

  // ─── Comment Templates (AC-08) ────────────

  describe('Comment Templates (AC-08)', () => {
    it('blockPR comment should include score breakdown table with collapsible details', async () => {
      // Arrange
      mockedCreateStatusCheck.mockResolvedValueOnce(undefined);
      mockedCreatePRComment.mockResolvedValueOnce(undefined);

      // Act
      await blockPR(REPO, PR_NUMBER, COMMIT_SHA, 'Low score', TOKEN, SCORE_DETAILS, EXECUTION_ID);

      // Assert
      const commentBody = mockedCreatePRComment.mock.calls[0]?.[2] as string;
      expect(commentBody).toContain('<details>');
      expect(commentBody).toContain('</details>');
      expect(commentBody).toContain('<summary>Score Breakdown</summary>');
      expect(commentBody).toContain('| Axis | Score | Status |');
      expect(commentBody).toContain('| clarity | 90 |');
      expect(commentBody).toContain(':white_check_mark:');
      expect(commentBody).toContain(':x:');
    });

    it('blockPR comment should use default threshold 80 when not specified', async () => {
      // Arrange
      mockedCreateStatusCheck.mockResolvedValueOnce(undefined);
      mockedCreatePRComment.mockResolvedValueOnce(undefined);
      const detailsWithoutThreshold: Readonly<Record<string, unknown>> = {
        scoreAxes: { clarity: 75 },
      };

      // Act
      await blockPR(
        REPO,
        PR_NUMBER,
        COMMIT_SHA,
        'Reason',
        TOKEN,
        detailsWithoutThreshold,
        EXECUTION_ID,
      );

      // Assert
      const commentBody = mockedCreatePRComment.mock.calls[0]?.[2] as string;
      // 75 < 80 threshold, so should show :x:
      expect(commentBody).toContain(':x:');
    });

    it('approvePR comment should include overall score and breakdown table', async () => {
      // Arrange
      mockedCreateStatusCheck.mockResolvedValueOnce(undefined);
      mockedCreatePRComment.mockResolvedValueOnce(undefined);

      // Act
      await approvePR(REPO, PR_NUMBER, COMMIT_SHA, TOKEN, SCORE_DETAILS, EXECUTION_ID);

      // Assert
      const commentBody = mockedCreatePRComment.mock.calls[0]?.[2] as string;
      expect(commentBody).toContain('76/100');
      expect(commentBody).toContain('<details>');
      expect(commentBody).toContain('| Axis | Score | Status |');
      expect(commentBody).toContain(':white_check_mark:');
    });

    it('blockTransition comment should include transition ID and reason', async () => {
      // Arrange
      mockedJiraAddComment.mockResolvedValueOnce(undefined);

      // Act
      await blockTransition(ISSUE_KEY, TRANSITION_ID, 'Gate failed', EXECUTION_ID);

      // Assert
      const commentBody = mockedJiraAddComment.mock.calls[0]?.[1] as string;
      expect(commentBody).toContain(TRANSITION_ID);
      expect(commentBody).toContain('Gate failed');
      expect(commentBody).toContain('Transition Blocked');
    });

    it('flagInconsistency comment should include type, severity, source, and description', async () => {
      // Arrange
      mockedJiraAddComment.mockResolvedValueOnce(undefined);
      const inconsistency = makeInconsistency({
        type: 'contradiction',
        severity: 'critical',
        source: 'rovo',
        description: 'Summary says X but description says Y',
      });

      // Act
      await flagInconsistency(inconsistency, EXECUTION_ID);

      // Assert
      const commentBody = mockedJiraAddComment.mock.calls[0]?.[1] as string;
      expect(commentBody).toContain('**Type:** contradiction');
      expect(commentBody).toContain('**Severity:** critical');
      expect(commentBody).toContain('**Source:** rovo');
      expect(commentBody).toContain('**Description:** Summary says X but description says Y');
    });
  });

  // ─── Structured Logging (AC-07, TEST-QA-036-03) ────────────

  describe('Structured Logging (AC-07)', () => {
    it('should emit structured JSON logs for blockTransition', async () => {
      // Arrange
      mockedJiraAddComment.mockResolvedValueOnce(undefined);

      // Act
      await blockTransition(ISSUE_KEY, TRANSITION_ID, 'Reason', EXECUTION_ID);

      // Assert
      expect(consoleSpy).toHaveBeenCalled();
      for (const call of consoleSpy.mock.calls) {
        const parsed = JSON.parse(call[0] as string) as Record<string, unknown>;
        expect(parsed).toHaveProperty('timestamp');
        expect(parsed).toHaveProperty('level');
        expect(parsed).toHaveProperty('operation');
        expect(parsed).toHaveProperty('executionId');
      }
    });

    it('should emit structured JSON logs for blockPR', async () => {
      // Arrange
      mockedCreateStatusCheck.mockResolvedValueOnce(undefined);
      mockedCreatePRComment.mockResolvedValueOnce(undefined);

      // Act
      await blockPR(REPO, PR_NUMBER, COMMIT_SHA, 'Reason', TOKEN, SCORE_DETAILS, EXECUTION_ID);

      // Assert
      expect(consoleSpy).toHaveBeenCalled();
      for (const call of consoleSpy.mock.calls) {
        const parsed = JSON.parse(call[0] as string) as Record<string, unknown>;
        expect(parsed).toHaveProperty('timestamp');
        expect(parsed).toHaveProperty('executionId');
      }
    });

    // SEC-PRIV-002: No sensitive data in logs
    it('should not include tokens in log output (SEC-PRIV-002)', async () => {
      // Arrange
      mockedCreateStatusCheck.mockResolvedValueOnce(undefined);
      mockedCreatePRComment.mockResolvedValueOnce(undefined);

      // Act
      await blockPR(REPO, PR_NUMBER, COMMIT_SHA, 'Reason', TOKEN, SCORE_DETAILS, EXECUTION_ID);

      // Assert
      for (const call of consoleSpy.mock.calls) {
        const logStr = call[0] as string;
        expect(logStr).not.toContain(TOKEN);
      }
    });

    it('should not include tokens in approvePR log output (SEC-PRIV-002)', async () => {
      // Arrange
      mockedCreateStatusCheck.mockResolvedValueOnce(undefined);
      mockedCreatePRComment.mockResolvedValueOnce(undefined);

      // Act
      await approvePR(REPO, PR_NUMBER, COMMIT_SHA, TOKEN, SCORE_DETAILS, EXECUTION_ID);

      // Assert
      for (const call of consoleSpy.mock.calls) {
        const logStr = call[0] as string;
        expect(logStr).not.toContain(TOKEN);
      }
    });
  });

  // ─── Audit Log Structure (SEC-PRIV-008, SEC-PRIV-010) ────

  describe('Audit Log Structure (SEC-PRIV-010, SEC-PRIV-008)', () => {
    it('every enforcement function should return AuditLogEntry with required fields', async () => {
      // Arrange — blockTransition
      mockedJiraAddComment.mockResolvedValueOnce(undefined);

      // Act
      const result = await blockTransition(ISSUE_KEY, TRANSITION_ID, 'Reason', EXECUTION_ID);

      // Assert — verify all required AuditLogEntry fields
      expect(result).toMatchObject({
        id: expect.stringMatching(/^audit-/),
        action: 'ticket_blocked',
        timestamp: expect.stringContaining('T'),
        executionId: EXECUTION_ID,
        projectKey: 'PROJ',
        ticketKey: ISSUE_KEY,
        details: expect.objectContaining({
          transitionId: TRANSITION_ID,
        }),
      });
    });

    it('audit details should contain only metadata, not full bodies (SEC-PRIV-008)', async () => {
      // Arrange
      mockedCreateStatusCheck.mockResolvedValueOnce(undefined);
      mockedCreatePRComment.mockResolvedValueOnce(undefined);
      const largeDetails: Record<string, unknown> = {
        bigData: 'x'.repeat(1000),
      };

      // Act
      const result = await blockPR(
        REPO,
        PR_NUMBER,
        COMMIT_SHA,
        'Reason',
        TOKEN,
        largeDetails,
        EXECUTION_ID,
      );

      // Assert — details should have metadata keys, not the full body
      expect(result.details).toHaveProperty('commitSha');
      expect(result.details).toHaveProperty('reason');
      // The large details object should not be directly included in the audit log
      expect(result.details).not.toHaveProperty('bigData');
    });
  });

  // ─── Timeout Configuration (FORGE-OPS-005, FORGE-OPS-0101) ──

  describe('Timeout Configuration (FORGE-OPS-0101)', () => {
    it('should pass custom timeoutMs to jira-adapter in blockTransition', async () => {
      // Arrange
      mockedJiraAddComment.mockResolvedValueOnce(undefined);
      const customTimeout = 5000;

      // Act
      await blockTransition(ISSUE_KEY, TRANSITION_ID, 'Reason', EXECUTION_ID, customTimeout);

      // Assert
      expect(mockedJiraAddComment).toHaveBeenCalledWith(
        ISSUE_KEY,
        expect.any(String),
        EXECUTION_ID,
        customTimeout,
      );
    });

    it('should pass custom timeoutMs to github-adapter in blockPR', async () => {
      // Arrange
      mockedCreateStatusCheck.mockResolvedValueOnce(undefined);
      mockedCreatePRComment.mockResolvedValueOnce(undefined);
      const customTimeout = 3000;

      // Act
      await blockPR(
        REPO,
        PR_NUMBER,
        COMMIT_SHA,
        'Reason',
        TOKEN,
        SCORE_DETAILS,
        EXECUTION_ID,
        customTimeout,
      );

      // Assert
      expect(mockedCreateStatusCheck).toHaveBeenCalledWith(
        expect.any(Object),
        REPO,
        COMMIT_SHA,
        TOKEN,
        EXECUTION_ID,
        customTimeout,
      );
      expect(mockedCreatePRComment).toHaveBeenCalledWith(
        REPO,
        PR_NUMBER,
        expect.any(String),
        TOKEN,
        EXECUTION_ID,
        customTimeout,
      );
    });
  });
});
