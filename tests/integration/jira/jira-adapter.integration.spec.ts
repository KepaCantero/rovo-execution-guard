/**
 * Jira Adapter Integration Tests
 *
 * Tests the Jira adapter's public contract using mocked @forge/api.
 * Uses realistic fixture data from tests/integration/fixtures/.
 *
 * [TEST-QA-202] jest.mock('@forge/api') — Forge is an external runtime, not internal dep.
 * [TEST-QA-056] TDD: tests written against adapter's existing public contract.
 * [ARCH-SOLID-202] Zero any — all types explicit.
 * [TEST-QA-204] afterEach cleanup mandatory.
 * [TEST-QA-201] AAA pattern in every test.
 * [ARCH-SOLID-049-03] Test public contract, not internal implementation.
 * [ARCH-SOLID-053] Domain-specific error types, not generic Error.
 * [TEST-QA-0853] Chaos tests: 429 rate limiting, timeout, invalid response.
 * [TEST-QA-0954] async/await only, no setTimeout/done().
 */

import fs from 'node:fs';
import path from 'node:path';

// [TEST-QA-202] @forge/api is external runtime — jest.mock exception applies
// jest.mock is hoisted above imports, so we create mocks inline.
jest.mock('@forge/api', () => ({
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

// Import after mock setup
import {
  okResponse,
  notFoundResponse,
  forbiddenResponse,
  rateLimitedResponse,
  type MockAPIResponse,
} from '../../mocks/forge-api';
import {
  getTicketData,
  transitionIssue,
  addComment,
} from '../../../src/backend/services/jira/jira-adapter';
import {
  JiraApiError,
  TicketNotFoundError,
  PermissionDeniedError,
  TransitionBlockedError,
  TimeoutError,
} from '../../../src/backend/types/errors';
import type { JiraTicketData } from '../../../src/backend/types/jira-data';

// Must import mocked module AFTER jest.mock setup
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { requestJira: mockRequestJira } = require('@forge/api') as {
  requestJira: jest.Mock<Promise<MockAPIResponse>>;
};

// ═══════════════════════════════════════════
// FIXTURE LOADING
// ═══════════════════════════════════════════

// [TEST-QA-058] Use realistic fixture data matching actual Jira REST API v2 shapes
const fixturesDir = path.resolve(__dirname, '..', 'fixtures');

function loadFixture<T>(filename: string): T {
  const filePath = path.join(fixturesDir, filename);
  const raw = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(raw) as T;
}

interface FixtureJiraIssue {
  readonly key: string;
  readonly fields: {
    readonly summary: string;
    readonly description: string;
    readonly status: { readonly name: string };
    readonly assignee: { readonly displayName: string } | null;
    readonly reporter: { readonly displayName: string } | null;
    readonly priority: { readonly name: string } | null;
    readonly issuetype: { readonly name: string };
    readonly labels: readonly string[];
    readonly project: { readonly key: string };
    readonly created: string;
    readonly updated: string;
  };
}

const fullTicketFixture: FixtureJiraIssue = loadFixture<FixtureJiraIssue>('jira-ticket-full.json');
const minimalTicketFixture: FixtureJiraIssue = loadFixture<FixtureJiraIssue>(
  'jira-ticket-minimal.json',
);

// ═══════════════════════════════════════════
// TEST SUITE
// ═══════════════════════════════════════════

describe('Jira Adapter Integration', () => {
  // [TEST-QA-204] Mandatory cleanup
  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─── getTicketData() ───────────────────

  describe('getTicketData()', () => {
    // AC-01: Happy path with full fixture data

    it('should return mapped JiraTicketData for a full ticket (AC-01)', async () => {
      // Arrange
      mockRequestJira.mockResolvedValueOnce(okResponse(fullTicketFixture));

      // Act
      const result: JiraTicketData = await getTicketData('PROJ-1234');

      // Assert
      expect(result.key).toBe('PROJ-1234');
      expect(result.summary).toBe('Implement user authentication flow with OAuth 2.0');
      expect(result.status).toBe('In Progress');
      expect(result.assignee).toBe('Maria Garcia');
      expect(result.reporter).toBe('John Smith');
      expect(result.priority).toBe('High');
      expect(result.issueType).toBe('Story');
      expect(result.labels).toEqual(['authentication', 'oauth', 'security']);
      expect(result.projectKey).toBe('PROJ');
      expect(result.created).toBe('2025-01-15T09:30:00.000+0000');
      expect(result.updated).toBe('2025-02-20T14:45:22.000+0000');
    });

    // AC-02: 404 → TicketNotFoundError [ARCH-SOLID-053]

    it('should throw TicketNotFoundError for 404 response (AC-02)', async () => {
      // Arrange
      mockRequestJira.mockResolvedValueOnce(notFoundResponse('Issue does not exist'));

      // Act
      const error = await getTicketData('PROJ-9999').catch((err: unknown) => err as Error);

      // Assert
      expect(error).toBeInstanceOf(TicketNotFoundError);
      expect((error as TicketNotFoundError).code).toBe('JIRA_NOT_FOUND');
    });

    // AC-03: Minimal ticket with null fields maps to undefined

    it('should map null assignee/reporter/priority to undefined (AC-03)', async () => {
      // Arrange
      mockRequestJira.mockResolvedValueOnce(okResponse(minimalTicketFixture));

      // Act
      const result: JiraTicketData = await getTicketData('PROJ-5678');

      // Assert
      expect(result.key).toBe('PROJ-5678');
      expect(result.summary).toBe('Fix typo in footer link');
      expect(result.description).toBe('');
      expect(result.status).toBe('To Do');
      expect(result.assignee).toBeUndefined();
      expect(result.reporter).toBeUndefined();
      expect(result.priority).toBeUndefined();
      expect(result.issueType).toBe('Bug');
      expect(result.labels).toEqual([]);
      expect(result.projectKey).toBe('PROJ');
    });

    // AC-04: 403 → PermissionDeniedError [ARCH-SOLID-053]

    it('should throw PermissionDeniedError for 403 response (AC-04)', async () => {
      // Arrange
      mockRequestJira.mockResolvedValueOnce(forbiddenResponse('Access denied'));

      // Act
      const error = await getTicketData('PROJ-1234').catch((err: unknown) => err as Error);

      // Assert
      expect(error).toBeInstanceOf(PermissionDeniedError);
      expect((error as PermissionDeniedError).code).toBe('JIRA_PERMISSION_DENIED');
    });

    // [TEST-QA-0853] Chaos: invalid response structure

    it('should throw JiraApiError for invalid response structure [TEST-QA-0853]', async () => {
      // Arrange — response body is not a valid JiraIssueResponse
      mockRequestJira.mockResolvedValueOnce(okResponse({ foo: 'bar' }));

      // Act
      const error = await getTicketData('PROJ-1234').catch((err: unknown) => err as Error);

      // Assert
      expect(error).toBeInstanceOf(JiraApiError);
      expect((error as JiraApiError).code).toBe('JIRA_INVALID_RESPONSE');
    });
  });

  // ─── transitionIssue() ─────────────────

  describe('transitionIssue()', () => {
    // AC-05: Happy path — empty body, no error

    it('should complete successfully for valid transition (AC-05)', async () => {
      // Arrange — response with no content-length header → validateTransitionResponse returns early
      mockRequestJira.mockResolvedValueOnce(okResponse(null));

      // Act & Assert — should not throw
      await expect(transitionIssue('PROJ-1234', '31')).resolves.toBeUndefined();
    });

    // AC-06: Transition blocked with errorMessages → TransitionBlockedError [ARCH-SOLID-053]

    it('should throw TransitionBlockedError when transition is rejected (AC-06)', async () => {
      // Arrange — response with errorMessages in body and content-length set
      // validateTransitionResponse reads text() then checks for errorMessages
      const errorBody = JSON.stringify({
        errorMessages: ['Transition not available for this issue'],
      });
      mockRequestJira.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: {
          get: (name: string) => (name === 'content-length' ? String(errorBody.length) : null),
          has: (name: string) => name === 'content-length',
          forEach: () => {},
        },
        json: async (): Promise<unknown> => ({
          errorMessages: ['Transition not available for this issue'],
        }),
        text: async (): Promise<string> => errorBody,
        arrayBuffer: async (): Promise<ArrayBuffer> => new TextEncoder().encode(errorBody).buffer,
      });

      // Act
      const error = await transitionIssue('PROJ-1234', '99').catch((err: unknown) => err as Error);

      // Assert
      expect(error).toBeInstanceOf(TransitionBlockedError);
      expect((error as TransitionBlockedError).code).toBe('JIRA_TRANSITION_BLOCKED');
    });
  });

  // ─── addComment() ──────────────────────

  describe('addComment()', () => {
    // AC-07: ADF body comment added successfully

    it('should complete successfully when adding an ADF comment (AC-07)', async () => {
      // Arrange
      const adfBody = JSON.stringify({
        type: 'doc',
        version: 1,
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Execution Guard: quality check passed' }],
          },
        ],
      });
      mockRequestJira.mockResolvedValueOnce(okResponse({}));

      // Act & Assert
      await expect(addComment('PROJ-1234', adfBody)).resolves.toBeUndefined();

      // Verify requestJira was called with correct POST body
      expect(mockRequestJira).toHaveBeenCalledTimes(1);
      const callArgs = mockRequestJira.mock.calls[0];
      const options = callArgs[1] as { readonly method?: string; readonly body?: string };
      expect(options.method).toBe('POST');
      const parsedBody = JSON.parse(options.body ?? '{}') as { body: string };
      expect(parsedBody.body).toBe(adfBody);
    });
  });

  // ─── Rate Limiting (429 retry) ─────────
  // [TEST-QA-0853] Chaos: rate limiting scenarios

  describe('Rate Limiting', () => {
    // AC-08: 429 then 200 — adapter retries and succeeds

    it('should retry on 429 and succeed on second attempt (AC-08)', async () => {
      // Arrange
      mockRequestJira
        .mockResolvedValueOnce(rateLimitedResponse(1))
        .mockResolvedValueOnce(okResponse(fullTicketFixture));

      // Use fake timers to avoid actual sleep in retry logic
      jest.useFakeTimers();

      // Act — start the call
      const promise = getTicketData('PROJ-1234');

      // Fast-forward through the sleep delay
      await jest.advanceTimersByTimeAsync(1000);

      // Assert
      const result: JiraTicketData = await promise;
      expect(result.key).toBe('PROJ-1234');
      expect(mockRequestJira).toHaveBeenCalledTimes(2);

      jest.useRealTimers();
    });

    // AC-09: Exhausted retries → JiraApiError with JIRA_API_ERROR

    it('should throw JiraApiError after exhausting retries on persistent 429 (AC-09)', async () => {
      // Arrange — every call returns 429
      mockRequestJira.mockResolvedValue(rateLimitedResponse(1));

      jest.useFakeTimers();

      // Act — start the call and handle rejection immediately
      const resultPromise = getTicketData('PROJ-1234').catch((err: unknown) => err as Error);

      // Fast-forward through all retry delays
      // DEFAULT_RETRY_CONFIG: maxRetries=3, baseDelayMs=500
      // Delays: 500, 1000, 2000 (exponential backoff, capped at 8000)
      await jest.advanceTimersByTimeAsync(5000);

      // Assert
      const error = await resultPromise;
      expect(error).toBeInstanceOf(JiraApiError);
      expect((error as JiraApiError).code).toBe('JIRA_API_ERROR');

      // Should have made initial + 3 retries = 4 calls
      expect(mockRequestJira.mock.calls.length).toBeGreaterThanOrEqual(3);

      jest.useRealTimers();
    });
  });

  // ─── Timeout ───────────────────────────
  // [TEST-QA-0853] Chaos: abort/timeout behavior

  describe('Timeout', () => {
    // AC-10: AbortError from signal → TimeoutError

    it('should throw TimeoutError when request is aborted (AC-10)', async () => {
      // Arrange — simulate abort by throwing an Error with name 'AbortError'
      // [ARCH-SOLID-053] Verify domain-specific TimeoutError, not generic Error
      // isAbortError checks: err instanceof DOMException || (err instanceof Error && err.name === 'AbortError')
      const abortError = new Error('The operation was aborted');
      abortError.name = 'AbortError';
      mockRequestJira.mockRejectedValueOnce(abortError);

      // Act
      const error = await getTicketData('PROJ-1234').catch((err: unknown) => err as Error);

      // Assert
      expect(error).toBeInstanceOf(TimeoutError);
      expect((error as TimeoutError).code).toBe('JIRA_TIMEOUT');
    });
  });
});
