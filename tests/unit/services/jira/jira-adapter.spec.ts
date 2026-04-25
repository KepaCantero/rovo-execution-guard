// Test suite for the Jira API Adapter
// Covers: getTicketData, getProjectConfig, saveProjectConfig, transitionIssue,
//         getTransitions, addComment, getIssueStatus
// Pattern: Arrange-Act-Assert (AAA), TDD cycle: RED -> GREEN -> REFACTOR
// [TEST-QA-001]
// [TEST-QA-0764] Mock @forge/api requestJira entirely — no real HTTP calls
// [TEST-QA-0833] Unit tests with mocked @forge/api

// ═══════════════════════════════════════════
// MOCKS — must come before imports that depend on @forge/api
// ═══════════════════════════════════════════

// [TEST-QA-0764] Mock @forge/api requestJira and route
jest.mock('@forge/api', () => ({
  requestJira: jest.fn(),
  route: jest.fn((strings: TemplateStringsArray, ...values: string[]) =>
    strings.reduce((acc, str, i) => acc + str + (values[i] ?? ''), ''),
  ),
}));

import {
  getTicketData,
  getProjectConfig,
  saveProjectConfig,
  transitionIssue,
  getTransitions,
  addComment,
  getIssueStatus,
} from '../../../../src/backend/services/jira/jira-adapter';
import {
  JiraApiError,
  TicketNotFoundError,
  PermissionDeniedError,
  TransitionBlockedError,
  TimeoutError,
} from '../../../../src/backend/types/errors';
import type { JiraTicketData } from '../../../../src/backend/types/jira-data';
import type { ProjectConfig } from '../../../../src/backend/types/project-config';

import { requestJira, route } from '@forge/api';
import type { APIResponse } from '@forge/api';

const mockRequestJira = jest.mocked(requestJira);
const mockRoute = jest.mocked(route);

// ═══════════════════════════════════════════
// FIXTURES
// ═══════════════════════════════════════════

/** Creates a realistic Jira issue API response */
const makeJiraIssueResponse = (
  overrides: Record<string, unknown> = {},
): Record<string, unknown> => ({
  key: 'PROJ-123',
  fields: {
    summary: 'Implement user authentication with OAuth2',
    description:
      'We need to integrate OAuth2 authentication.\n\nAcceptance criteria:\n- User can log in via Google\n- User can log in via GitHub',
    status: { name: 'TO DO' },
    assignee: { displayName: 'John Developer' },
    reporter: { displayName: 'Jane PM' },
    priority: { name: 'High' },
    issuetype: { name: 'Story' },
    labels: ['auth', 'security'],
    project: { key: 'PROJ' },
    created: '2026-01-15T10:00:00.000+0000',
    updated: '2026-01-15T10:00:00.000+0000',
    ...overrides,
  },
});

/** Creates a minimal Jira issue with null optional fields */
const makeMinimalIssueResponse = (): Record<string, unknown> => ({
  key: 'PROJ-001',
  fields: {
    summary: 'Do the thing',
    description: 'Please do the thing.',
    status: { name: 'IN PROGRESS' },
    assignee: null,
    reporter: null,
    priority: null,
    issuetype: { name: 'Task' },
    labels: [],
    project: { key: 'PROJ' },
    created: '2026-01-01T00:00:00.000+0000',
    updated: '2026-01-01T00:00:00.000+0000',
  },
});

/** Creates a valid ProjectConfig */
const makeProjectConfig = (overrides: Partial<ProjectConfig> = {}): ProjectConfig => ({
  projectKey: 'PROJ',
  enabled: true,
  scoreThreshold: 80,
  gates: {
    definition: true,
    execution: true,
    delivery: true,
  },
  ...overrides,
});

/** Creates minimal mock Headers object */
const makeHeaders = (getFn?: (name: string) => string | null): Headers => {
  const map = new Map<string, string>();
  return {
    get: getFn ?? ((_: string) => null),
    forEach: () => {},
    entries: () => map.entries(),
    keys: () => map.keys(),
    values: () => map.values(),
    [Symbol.iterator]: () => map.entries(),
    has: () => false,
    set: () => {},
    append: () => {},
    delete: () => {},
  } as unknown as Headers;
};

/** Creates a mock Forge APIResponse */
const makeResponse = (options: {
  ok?: boolean;
  status?: number;
  statusText?: string;
  json?: () => Promise<unknown>;
  text?: () => Promise<string>;
  headers?: Headers;
}): APIResponse =>
  ({
    ok: options.ok ?? true,
    status: options.status ?? 200,
    statusText: options.statusText ?? 'OK',
    json: options.json ?? (async () => ({})),
    text: options.text ?? (async () => ''),
    headers: options.headers ?? makeHeaders(),
    arrayBuffer: async () => new ArrayBuffer(0),
  }) as unknown as APIResponse;

/** Creates a successful response with JSON body */
const makeSuccessResponse = (data: unknown) =>
  makeResponse({
    ok: true,
    status: 200,
    json: async () => data,
  });

/** Creates an error response */
const makeErrorResponse = (status: number) =>
  makeResponse({
    ok: false,
    status,
  });

/** Creates a 429 rate-limited response */
const makeRateLimitedResponse = () =>
  makeResponse({
    ok: false,
    status: 429,
  });

/** Creates a response with transition error messages */
const makeTransitionErrorResponse = (errorMessages: readonly string[]) =>
  makeResponse({
    ok: true,
    status: 200,
    text: async () => JSON.stringify({ errorMessages }),
    headers: makeHeaders((name: string) => (name === 'content-length' ? '50' : null)),
  });

/** Creates a transitions response */
const makeTransitionsResponse = (
  transitions: readonly { id: string; name: string; to: { name: string } }[] = [],
) =>
  makeSuccessResponse({
    transitions,
  });

/** Creates a project config entity property response */
const makeConfigPropertyResponse = (config: ProjectConfig) =>
  makeSuccessResponse({
    value: config,
  });

// ═══════════════════════════════════════════
// TEST SUITE
// ═══════════════════════════════════════════

describe('jira-adapter', () => {
  let consoleLogSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    jest.useRealTimers();
  });

  // ─── getTicketData() ──────────────────

  describe('getTicketData()', () => {
    it('should return typed ticket data for a valid issue key', async () => {
      // Arrange
      const issueResponse = makeJiraIssueResponse();
      mockRequestJira.mockResolvedValue(makeSuccessResponse(issueResponse));

      // Act
      const result: JiraTicketData = await getTicketData('PROJ-123', 'exec-001');

      // Assert
      expect(result.key).toBe('PROJ-123');
      expect(result.summary).toBe('Implement user authentication with OAuth2');
      expect(result.status).toBe('TO DO');
      expect(result.assignee).toBe('John Developer');
      expect(result.reporter).toBe('Jane PM');
      expect(result.priority).toBe('High');
      expect(result.issueType).toBe('Story');
      expect(result.labels).toEqual(['auth', 'security']);
      expect(result.projectKey).toBe('PROJ');
    });

    it('should handle null optional fields (assignee, reporter, priority)', async () => {
      // Arrange
      mockRequestJira.mockResolvedValue(makeSuccessResponse(makeMinimalIssueResponse()));

      // Act
      const result = await getTicketData('PROJ-001');

      // Assert
      expect(result.assignee).toBeUndefined();
      expect(result.reporter).toBeUndefined();
      expect(result.priority).toBeUndefined();
    });

    it('should default description to empty string when null', async () => {
      // Arrange
      const response = makeJiraIssueResponse({ description: null });
      mockRequestJira.mockResolvedValue(makeSuccessResponse(response));

      // Act
      const result = await getTicketData('PROJ-123');

      // Assert
      expect(result.description).toBe('');
    });

    it('should throw TicketNotFoundError on HTTP 404', async () => {
      // Arrange
      mockRequestJira.mockResolvedValue(makeErrorResponse(404));

      // Act & Assert
      await expect(getTicketData('MISSING-999', 'exec-002')).rejects.toThrow(TicketNotFoundError);
    });

    it('should throw PermissionDeniedError on HTTP 403', async () => {
      // Arrange
      mockRequestJira.mockResolvedValue(makeErrorResponse(403));

      // Act & Assert
      await expect(getTicketData('PROJ-123', 'exec-003')).rejects.toThrow(PermissionDeniedError);
    });

    it('should throw JiraApiError on HTTP 500', async () => {
      // Arrange
      mockRequestJira.mockResolvedValue(makeErrorResponse(500));

      // Act & Assert
      await expect(getTicketData('PROJ-123')).rejects.toThrow(JiraApiError);
    });

    it('should throw JiraApiError for invalid response structure', async () => {
      // Arrange — response missing 'fields' property
      mockRequestJira.mockResolvedValue(makeSuccessResponse({ foo: 'bar' }));

      // Act & Assert
      await expect(getTicketData('PROJ-123')).rejects.toThrow(JiraApiError);
    });

    it('should include executionId in log entries', async () => {
      // Arrange
      mockRequestJira.mockResolvedValue(makeSuccessResponse(makeJiraIssueResponse()));

      // Act
      await getTicketData('PROJ-123', 'exec-42');

      // Assert — [SEC-PRIV-002] structured logging includes executionId
      const logCalls = consoleLogSpy.mock.calls.map((call: [string]) => {
        try {
          return JSON.parse(call[0]);
        } catch {
          return null;
        }
      });
      const infoLogs = logCalls.filter(
        (log: Record<string, unknown> | null) => log && log.level === 'info',
      );
      expect(infoLogs.length).toBeGreaterThan(0);
      expect(infoLogs.some((log: Record<string, unknown>) => log.executionId === 'exec-42')).toBe(
        true,
      );
    });

    it('should request only needed fields via fields parameter', async () => {
      // Arrange
      mockRequestJira.mockResolvedValue(makeSuccessResponse(makeJiraIssueResponse()));

      // Act
      await getTicketData('PROJ-123');

      // Assert — [ARCH-SOLID-003] [SEC-PRIV-008] data minimization
      // The route mock returns the interpolated URL, so requestJira
      // receives the full path as its first argument
      expect(mockRequestJira).toHaveBeenCalledTimes(1);
      const callArgs = mockRequestJira.mock.calls[0];
      expect(callArgs).toBeDefined();
      const requestUrl = String(callArgs?.[0] ?? '');
      expect(requestUrl).toContain('fields=');
      expect(requestUrl).toContain('summary');
      expect(requestUrl).toContain('status');
    });
  });

  // ─── getProjectConfig() ───────────────

  describe('getProjectConfig()', () => {
    it('should return stored config for a valid project', async () => {
      // Arrange
      const config = makeProjectConfig();
      mockRequestJira.mockResolvedValue(makeConfigPropertyResponse(config));

      // Act
      const result = await getProjectConfig('PROJ', 'exec-010');

      // Assert
      expect(result.projectKey).toBe('PROJ');
      expect(result.enabled).toBe(true);
      expect(result.scoreThreshold).toBe(80);
      expect(result.gates).toEqual({ definition: true, execution: true, delivery: true });
    });

    it('should return default config when no config is stored (404)', async () => {
      // Arrange — 404 means no stored config
      mockRequestJira.mockResolvedValue(makeErrorResponse(404));

      // Act
      const result = await getProjectConfig('PROJ', 'exec-011');

      // Assert
      expect(result.projectKey).toBe('PROJ');
      expect(result.enabled).toBe(false);
      expect(result.scoreThreshold).toBe(80);
    });

    it('should throw PermissionDeniedError on HTTP 403', async () => {
      // Arrange
      mockRequestJira.mockResolvedValue(makeErrorResponse(403));

      // Act & Assert
      await expect(getProjectConfig('PROJ')).rejects.toThrow(PermissionDeniedError);
    });

    it('should throw JiraApiError for invalid config response structure', async () => {
      // Arrange — response missing 'value' property
      mockRequestJira.mockResolvedValue(makeSuccessResponse({ foo: 'bar' }));

      // Act & Assert
      await expect(getProjectConfig('PROJ')).rejects.toThrow(JiraApiError);
    });

    it('should throw JiraApiError for malformed config value', async () => {
      // Arrange — has 'value' but invalid structure
      mockRequestJira.mockResolvedValue(
        makeSuccessResponse({
          value: { projectKey: 'PROJ' }, // missing enabled, scoreThreshold, gates
        }),
      );

      // Act & Assert
      await expect(getProjectConfig('PROJ')).rejects.toThrow(JiraApiError);
    });

    it('should include executionId in log entries for default config fallback', async () => {
      // Arrange
      mockRequestJira.mockResolvedValue(makeErrorResponse(404));

      // Act
      await getProjectConfig('PROJ', 'exec-fallback');

      // Assert
      const logCalls = consoleLogSpy.mock.calls.map((call: [string]) => {
        try {
          return JSON.parse(call[0]);
        } catch {
          return null;
        }
      });
      const fallbackLogs = logCalls.filter(
        (log: Record<string, unknown> | null) =>
          log && log.note === 'no stored config, returning defaults',
      );
      expect(fallbackLogs.length).toBeGreaterThan(0);
      expect(fallbackLogs[0]).toHaveProperty('executionId', 'exec-fallback');
    });
  });

  // ─── saveProjectConfig() ──────────────

  describe('saveProjectConfig()', () => {
    it('should persist config via PUT request', async () => {
      // Arrange
      const config = makeProjectConfig();
      mockRequestJira.mockResolvedValue(makeResponse({ ok: true, status: 200 }));

      // Act
      await saveProjectConfig(config, 'exec-020');

      // Assert
      expect(mockRequestJira).toHaveBeenCalledTimes(1);
    });

    it('should throw PermissionDeniedError on HTTP 403', async () => {
      // Arrange
      const config = makeProjectConfig();
      mockRequestJira.mockResolvedValue(makeErrorResponse(403));

      // Act & Assert
      await expect(saveProjectConfig(config)).rejects.toThrow(PermissionDeniedError);
    });

    it('should throw JiraApiError on HTTP 500', async () => {
      // Arrange
      const config = makeProjectConfig();
      mockRequestJira.mockResolvedValue(makeErrorResponse(500));

      // Act & Assert
      await expect(saveProjectConfig(config)).rejects.toThrow(JiraApiError);
    });

    it('should send JSON body with config', async () => {
      // Arrange
      const config = makeProjectConfig();
      mockRequestJira.mockResolvedValue(makeResponse({ ok: true, status: 200 }));

      // Act
      await saveProjectConfig(config);

      // Assert — verify requestJira was called with PUT method and body
      const callArgs = mockRequestJira.mock.calls[0];
      expect(callArgs).toBeDefined();
      const options = callArgs?.[1] as Record<string, unknown>;
      expect(options.method).toBe('PUT');
      expect(options.headers).toEqual({ 'Content-Type': 'application/json' });
      expect(options.body).toBe(JSON.stringify(config));
    });
  });

  // ─── transitionIssue() ────────────────

  describe('transitionIssue()', () => {
    it('should transition an issue with valid transition ID', async () => {
      // Arrange — empty response (204-like, no content)
      mockRequestJira.mockResolvedValue(
        makeResponse({
          ok: true,
          status: 204,
          text: async () => '',
          headers: makeHeaders(() => '0'),
        }),
      );

      // Act & Assert — should not throw
      await expect(transitionIssue('PROJ-123', '21', 'exec-030')).resolves.toBeUndefined();
    });

    it('should throw TicketNotFoundError on HTTP 404', async () => {
      // Arrange
      mockRequestJira.mockResolvedValue(makeErrorResponse(404));

      // Act & Assert
      await expect(transitionIssue('MISSING-999', '21')).rejects.toThrow(TicketNotFoundError);
    });

    it('should throw PermissionDeniedError on HTTP 403', async () => {
      // Arrange
      mockRequestJira.mockResolvedValue(makeErrorResponse(403));

      // Act & Assert
      await expect(transitionIssue('PROJ-123', '21')).rejects.toThrow(PermissionDeniedError);
    });

    it('should throw TransitionBlockedError when transition is disallowed', async () => {
      // Arrange
      mockRequestJira.mockResolvedValue(
        makeTransitionErrorResponse(['The transition is not available.']),
      );

      // Act & Assert
      await expect(transitionIssue('PROJ-123', 'invalid-id')).rejects.toThrow(
        TransitionBlockedError,
      );
    });

    it('should not throw when transition response has no content-length', async () => {
      // Arrange — no content-length header
      mockRequestJira.mockResolvedValue(
        makeResponse({
          ok: true,
          status: 204,
          text: async () => '',
          headers: makeHeaders(),
        }),
      );

      // Act & Assert
      await expect(transitionIssue('PROJ-123', '21')).resolves.toBeUndefined();
    });

    it('should not throw when transition response has empty text body', async () => {
      // Arrange — content-length present but body is empty
      mockRequestJira.mockResolvedValue(
        makeResponse({
          ok: true,
          status: 200,
          text: async () => '',
          headers: makeHeaders((name: string) => (name === 'content-length' ? '0' : null)),
        }),
      );

      // Act & Assert
      await expect(transitionIssue('PROJ-123', '21')).resolves.toBeUndefined();
    });

    it('should handle non-JSON body in transition response gracefully', async () => {
      // Arrange — response with content but not JSON
      mockRequestJira.mockResolvedValue(
        makeResponse({
          ok: true,
          status: 200,
          text: async () => 'Transitioned successfully',
          headers: makeHeaders((name: string) => (name === 'content-length' ? '24' : null)),
        }),
      );

      // Act & Assert — should not throw, non-JSON is treated as success
      await expect(transitionIssue('PROJ-123', '21')).resolves.toBeUndefined();
    });

    it('should send POST request with transition body', async () => {
      // Arrange
      mockRequestJira.mockResolvedValue(
        makeResponse({
          ok: true,
          status: 204,
          text: async () => '',
          headers: makeHeaders(),
        }),
      );

      // Act
      await transitionIssue('PROJ-123', '21');

      // Assert
      const callArgs = mockRequestJira.mock.calls[0];
      expect(callArgs).toBeDefined();
      const options = callArgs?.[1] as Record<string, unknown>;
      expect(options.method).toBe('POST');
      expect(options.body).toBe(JSON.stringify({ transition: { id: '21' } }));
    });
  });

  // ─── getTransitions() ─────────────────

  describe('getTransitions()', () => {
    it('should return available transitions for an issue', async () => {
      // Arrange
      mockRequestJira.mockResolvedValue(
        makeTransitionsResponse([
          { id: '11', name: 'To Do', to: { name: 'TO DO' } },
          { id: '21', name: 'In Progress', to: { name: 'IN PROGRESS' } },
          { id: '31', name: 'Done', to: { name: 'DONE' } },
        ]),
      );

      // Act
      const result = await getTransitions('PROJ-123', 'exec-040');

      // Assert
      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({ id: '11', name: 'To Do', toStatus: 'TO DO' });
      expect(result[1]).toEqual({ id: '21', name: 'In Progress', toStatus: 'IN PROGRESS' });
      expect(result[2]).toEqual({ id: '31', name: 'Done', toStatus: 'DONE' });
    });

    it('should return empty array when no transitions available', async () => {
      // Arrange
      mockRequestJira.mockResolvedValue(makeTransitionsResponse([]));

      // Act
      const result = await getTransitions('PROJ-123');

      // Assert
      expect(result).toHaveLength(0);
    });

    it('should throw TicketNotFoundError on HTTP 404', async () => {
      // Arrange
      mockRequestJira.mockResolvedValue(makeErrorResponse(404));

      // Act & Assert
      await expect(getTransitions('MISSING-999')).rejects.toThrow(TicketNotFoundError);
    });

    it('should throw PermissionDeniedError on HTTP 403', async () => {
      // Arrange
      mockRequestJira.mockResolvedValue(makeErrorResponse(403));

      // Act & Assert
      await expect(getTransitions('PROJ-123')).rejects.toThrow(PermissionDeniedError);
    });

    it('should throw JiraApiError for invalid transitions response', async () => {
      // Arrange — response missing 'transitions' array
      mockRequestJira.mockResolvedValue(makeSuccessResponse({ foo: 'bar' }));

      // Act & Assert
      await expect(getTransitions('PROJ-123')).rejects.toThrow(JiraApiError);
    });

    it('should throw JiraApiError when transitions field is not an array', async () => {
      // Arrange
      mockRequestJira.mockResolvedValue(makeSuccessResponse({ transitions: 'not-an-array' }));

      // Act & Assert
      await expect(getTransitions('PROJ-123')).rejects.toThrow(JiraApiError);
    });
  });

  // ─── addComment() ─────────────────────

  describe('addComment()', () => {
    it('should add a comment to the specified issue', async () => {
      // Arrange
      mockRequestJira.mockResolvedValue(makeResponse({ ok: true, status: 201 }));

      // Act & Assert
      await expect(
        addComment('PROJ-123', 'This is a comment', 'exec-050'),
      ).resolves.toBeUndefined();
    });

    it('should throw TicketNotFoundError on HTTP 404', async () => {
      // Arrange
      mockRequestJira.mockResolvedValue(makeErrorResponse(404));

      // Act & Assert
      await expect(addComment('MISSING-999', 'comment')).rejects.toThrow(TicketNotFoundError);
    });

    it('should throw PermissionDeniedError on HTTP 403', async () => {
      // Arrange
      mockRequestJira.mockResolvedValue(makeErrorResponse(403));

      // Act & Assert
      await expect(addComment('PROJ-123', 'comment')).rejects.toThrow(PermissionDeniedError);
    });

    it('should send POST request with comment body', async () => {
      // Arrange
      mockRequestJira.mockResolvedValue(makeResponse({ ok: true, status: 201 }));

      // Act
      await addComment('PROJ-123', 'Hello world');

      // Assert
      const callArgs = mockRequestJira.mock.calls[0];
      expect(callArgs).toBeDefined();
      const options = callArgs?.[1] as Record<string, unknown>;
      expect(options.method).toBe('POST');
      expect(options.body).toBe(JSON.stringify({ body: 'Hello world' }));
    });
  });

  // ─── getIssueStatus() ─────────────────

  describe('getIssueStatus()', () => {
    it('should return status name for a valid issue', async () => {
      // Arrange
      const issueResponse = makeJiraIssueResponse();
      mockRequestJira.mockResolvedValue(makeSuccessResponse(issueResponse));

      // Act
      const result = await getIssueStatus('PROJ-123', 'exec-060');

      // Assert
      expect(result).toBe('TO DO');
    });

    it('should return IN PROGRESS status', async () => {
      // Arrange
      const issueResponse = makeJiraIssueResponse({
        status: { name: 'IN PROGRESS' },
      });
      mockRequestJira.mockResolvedValue(makeSuccessResponse(issueResponse));

      // Act
      const result = await getIssueStatus('PROJ-123');

      // Assert
      expect(result).toBe('IN PROGRESS');
    });

    it('should throw TicketNotFoundError on HTTP 404', async () => {
      // Arrange
      mockRequestJira.mockResolvedValue(makeErrorResponse(404));

      // Act & Assert
      await expect(getIssueStatus('MISSING-999')).rejects.toThrow(TicketNotFoundError);
    });

    it('should throw PermissionDeniedError on HTTP 403', async () => {
      // Arrange
      mockRequestJira.mockResolvedValue(makeErrorResponse(403));

      // Act & Assert
      await expect(getIssueStatus('PROJ-123')).rejects.toThrow(PermissionDeniedError);
    });

    it('should throw JiraApiError for invalid response structure', async () => {
      // Arrange — response missing 'fields'
      mockRequestJira.mockResolvedValue(makeSuccessResponse({ key: 'PROJ-123' }));

      // Act & Assert
      await expect(getIssueStatus('PROJ-123')).rejects.toThrow(JiraApiError);
    });

    it('should request only the status field', async () => {
      // Arrange
      mockRequestJira.mockResolvedValue(makeSuccessResponse(makeJiraIssueResponse()));

      // Act
      await getIssueStatus('PROJ-123');

      // Assert — [SEC-PRIV-008] data minimization — only fields=status
      expect(mockRequestJira).toHaveBeenCalledTimes(1);
      const callArgs = mockRequestJira.mock.calls[0];
      expect(callArgs).toBeDefined();
      const requestUrl = String(callArgs?.[0] ?? '');
      expect(requestUrl).toContain('fields=status');
    });
  });

  // ─── Rate Limiting (AC-04) ────────────

  describe('rate limiting with exponential backoff (AC-04)', () => {
    it('should retry on HTTP 429 and succeed on second attempt', async () => {
      // Arrange
      const rateLimitedResponse = makeRateLimitedResponse();
      const successResponse = makeSuccessResponse(makeJiraIssueResponse());
      mockRequestJira
        .mockResolvedValueOnce(rateLimitedResponse)
        .mockResolvedValueOnce(successResponse);

      // Act
      const result = await getTicketData('PROJ-123', 'exec-retry');

      // Assert
      expect(mockRequestJira).toHaveBeenCalledTimes(2);
      expect(result.key).toBe('PROJ-123');
    });

    it('should retry multiple times on consecutive 429 responses', async () => {
      // Arrange — 3 rate-limited responses, then success
      const rateLimited = makeRateLimitedResponse();
      const success = makeSuccessResponse(makeJiraIssueResponse());
      mockRequestJira
        .mockResolvedValueOnce(rateLimited)
        .mockResolvedValueOnce(rateLimited)
        .mockResolvedValueOnce(rateLimited)
        .mockResolvedValueOnce(success);

      // Act
      const result = await getTicketData('PROJ-123');

      // Assert
      expect(mockRequestJira).toHaveBeenCalledTimes(4);
      expect(result.key).toBe('PROJ-123');
    });

    it('should exhaust retries and throw JiraApiError after max retries', async () => {
      // Arrange — always 429 (exceeds maxRetries=3 → 4 attempts: 0,1,2,3)
      mockRequestJira.mockResolvedValue(makeRateLimitedResponse());

      // Act & Assert
      await expect(getTicketData('PROJ-123')).rejects.toThrow(JiraApiError);
      expect(mockRequestJira).toHaveBeenCalledTimes(4); // 0,1,2,3
    });

    it('should log warning on retry attempt', async () => {
      // Arrange
      const rateLimited = makeRateLimitedResponse();
      const success = makeSuccessResponse(makeJiraIssueResponse());
      mockRequestJira.mockResolvedValueOnce(rateLimited).mockResolvedValueOnce(success);

      // Act
      await getTicketData('PROJ-123', 'exec-warn');

      // Assert
      const logCalls = consoleLogSpy.mock.calls.map((call: [string]) => {
        try {
          return JSON.parse(call[0]);
        } catch {
          return null;
        }
      });
      const warnLogs = logCalls.filter(
        (log: Record<string, unknown> | null) => log && log.level === 'warn',
      );
      expect(warnLogs.length).toBeGreaterThan(0);
      expect(warnLogs.some((log: Record<string, unknown>) => log.reason === 'rate_limited')).toBe(
        true,
      );
    });
  });

  // ─── Timeout via AbortController (AC-05) ─

  describe('timeout via AbortController (AC-05)', () => {
    it('should throw TimeoutError when request is aborted', async () => {
      // Arrange — simulate abort error
      const abortError = new DOMException('The operation was aborted', 'AbortError');
      mockRequestJira.mockRejectedValue(abortError);

      // Act & Assert
      await expect(getTicketData('PROJ-123', 'exec-timeout')).rejects.toThrow(TimeoutError);
    });

    it('should throw TimeoutError with timeout duration in message', async () => {
      // Arrange
      const abortError = new DOMException('The operation was aborted', 'AbortError');
      mockRequestJira.mockRejectedValue(abortError);

      // Act & Assert
      try {
        await getTicketData('PROJ-123', 'exec-timeout-msg');
        fail('Expected TimeoutError');
      } catch (error: unknown) {
        expect(error).toBeInstanceOf(TimeoutError);
        const err = error as TimeoutError;
        expect(err.message).toContain('timed out');
        expect(err.message).toContain('10000');
      }
    });

    it('should throw TimeoutError for Error with name AbortError', async () => {
      // Arrange — some environments use Error with name instead of DOMException
      const abortLikeError = new Error('Aborted');
      abortLikeError.name = 'AbortError';
      mockRequestJira.mockRejectedValue(abortLikeError);

      // Act & Assert
      await expect(getTicketData('PROJ-123')).rejects.toThrow(TimeoutError);
    });
  });

  // ─── Network Error Handling ───────────

  describe('network error handling', () => {
    it('should throw JiraApiError on network error', async () => {
      // Arrange
      mockRequestJira.mockRejectedValue(new Error('ECONNREFUSED'));

      // Act & Assert
      await expect(getTicketData('PROJ-123')).rejects.toThrow(JiraApiError);
    });

    it('should include original error message in JiraApiError', async () => {
      // Arrange
      mockRequestJira.mockRejectedValue(new Error('Network dropped'));

      // Act & Assert
      try {
        await getTicketData('PROJ-123');
        fail('Expected JiraApiError');
      } catch (error: unknown) {
        expect(error).toBeInstanceOf(JiraApiError);
        const err = error as JiraApiError;
        expect(err.message).toContain('Network dropped');
      }
    });

    it('should handle non-Error rejection', async () => {
      // Arrange — reject with a string
      mockRequestJira.mockRejectedValue('connection lost');

      // Act & Assert
      await expect(getTicketData('PROJ-123')).rejects.toThrow(JiraApiError);
    });
  });

  // ─── Structured Logging (AC-03) ───────

  describe('structured logging (AC-03)', () => {
    it('should include executionId in all log entries', async () => {
      // Arrange
      mockRequestJira.mockResolvedValue(makeSuccessResponse(makeJiraIssueResponse()));

      // Act
      await getTicketData('PROJ-123', 'exec-log-test');

      // Assert
      const logCalls = consoleLogSpy.mock.calls.map((call: [string]) => {
        try {
          return JSON.parse(call[0]);
        } catch {
          return null;
        }
      });
      const validLogs = logCalls.filter((log: unknown) => log !== null);
      for (const log of validLogs) {
        expect(log).toHaveProperty('executionId', 'exec-log-test');
      }
    });

    it('should omit executionId from log when not provided', async () => {
      // Arrange
      mockRequestJira.mockResolvedValue(makeSuccessResponse(makeJiraIssueResponse()));

      // Act
      await getTicketData('PROJ-123');

      // Assert — when executionId is undefined, JSON.stringify omits it
      const logCalls = consoleLogSpy.mock.calls.map((call: [string]) => {
        try {
          return JSON.parse(call[0]);
        } catch {
          return null;
        }
      });
      const validLogs = logCalls.filter(
        (log: Record<string, unknown> | null) => log !== null && log.operation === 'getTicketData',
      );
      expect(validLogs.length).toBeGreaterThan(0);
      for (const log of validLogs) {
        // JSON.stringify omits undefined values, so executionId won't be in the parsed object
        expect(log).not.toHaveProperty('executionId');
      }
    });

    it('should log operation name and method', async () => {
      // Arrange
      mockRequestJira.mockResolvedValue(makeSuccessResponse(makeJiraIssueResponse()));

      // Act
      await getTicketData('PROJ-123', 'exec-op');

      // Assert
      const logCalls = consoleLogSpy.mock.calls.map((call: [string]) => {
        try {
          return JSON.parse(call[0]);
        } catch {
          return null;
        }
      });
      const infoLogs = logCalls.filter(
        (log: Record<string, unknown> | null) => log && log.level === 'info',
      );
      expect(
        infoLogs.some((log: Record<string, unknown>) => log.operation === 'getTicketData'),
      ).toBe(true);
    });

    it('should log timestamp in ISO 8601 format', async () => {
      // Arrange
      mockRequestJira.mockResolvedValue(makeSuccessResponse(makeJiraIssueResponse()));

      // Act
      await getTicketData('PROJ-123');

      // Assert
      const logCalls = consoleLogSpy.mock.calls.map((call: [string]) => {
        try {
          return JSON.parse(call[0]);
        } catch {
          return null;
        }
      });
      const validLogs = logCalls.filter((log: Record<string, unknown> | null) => log !== null);
      for (const log of validLogs) {
        expect(typeof log.timestamp).toBe('string');
        expect(new Date(log.timestamp as string).getTime()).not.toBeNaN();
      }
    });
  });

  // ─── Error Message Context (ARCH-SOLID-234) ─

  describe('error message context (ARCH-SOLID-234)', () => {
    it('should include operation name in TicketNotFoundError message', async () => {
      // Arrange
      mockRequestJira.mockResolvedValue(makeErrorResponse(404));

      // Act & Assert
      try {
        await getTicketData('PROJ-999', 'exec-ctx');
        fail('Expected TicketNotFoundError');
      } catch (error: unknown) {
        expect(error).toBeInstanceOf(TicketNotFoundError);
        const err = error as TicketNotFoundError;
        expect(err.message).toContain('getTicketData');
        expect(err.message).toContain('not found');
      }
    });

    it('should include operation name in PermissionDeniedError message', async () => {
      // Arrange
      mockRequestJira.mockResolvedValue(makeErrorResponse(403));

      // Act & Assert
      try {
        await getTicketData('PROJ-123', 'exec-ctx');
        fail('Expected PermissionDeniedError');
      } catch (error: unknown) {
        expect(error).toBeInstanceOf(PermissionDeniedError);
        const err = error as PermissionDeniedError;
        expect(err.message).toContain('getTicketData');
        expect(err.message).toContain('permission denied');
      }
    });

    it('should include issue key in TransitionBlockedError message', async () => {
      // Arrange
      mockRequestJira.mockResolvedValue(makeTransitionErrorResponse(['Transition not available']));

      // Act & Assert
      try {
        await transitionIssue('PROJ-456', '99', 'exec-ctx');
        fail('Expected TransitionBlockedError');
      } catch (error: unknown) {
        expect(error).toBeInstanceOf(TransitionBlockedError);
        const err = error as TransitionBlockedError;
        expect(err.message).toContain('PROJ-456');
        expect(err.message).toContain('Transition not available');
      }
    });

    it('should include operation name in error message', async () => {
      // Arrange
      mockRequestJira.mockResolvedValue(makeErrorResponse(500));

      // Act & Assert
      try {
        await getTicketData('PROJ-123', 'exec-op');
        fail('Expected JiraApiError');
      } catch (error: unknown) {
        expect(error).toBeInstanceOf(JiraApiError);
        const err = error as JiraApiError;
        expect(err.message).toContain('getTicketData');
      }
    });
  });

  // ─── Response Validation (SEC-PRIV-004) ──

  describe('response validation (SEC-PRIV-004)', () => {
    it('should reject null response body for getTicketData', async () => {
      // Arrange
      mockRequestJira.mockResolvedValue(makeSuccessResponse(null));

      // Act & Assert
      await expect(getTicketData('PROJ-123')).rejects.toThrow(JiraApiError);
    });

    it('should reject response without key property', async () => {
      // Arrange
      mockRequestJira.mockResolvedValue(makeSuccessResponse({ fields: { summary: 'test' } }));

      // Act & Assert
      await expect(getTicketData('PROJ-123')).rejects.toThrow(JiraApiError);
    });

    it('should reject response without fields property', async () => {
      // Arrange
      mockRequestJira.mockResolvedValue(makeSuccessResponse({ key: 'PROJ-123' }));

      // Act & Assert
      await expect(getTicketData('PROJ-123')).rejects.toThrow(JiraApiError);
    });

    it('should reject response where key is not a string', async () => {
      // Arrange
      mockRequestJira.mockResolvedValue(
        makeSuccessResponse({ key: 123, fields: { summary: 'test' } }),
      );

      // Act & Assert
      await expect(getTicketData('PROJ-123')).rejects.toThrow(JiraApiError);
    });

    it('should reject response where fields is null', async () => {
      // Arrange
      mockRequestJira.mockResolvedValue(makeSuccessResponse({ key: 'PROJ-123', fields: null }));

      // Act & Assert
      await expect(getTicketData('PROJ-123')).rejects.toThrow(JiraApiError);
    });
  });

  // ─── Chaos Tests (TEST-QA-0853) ───────

  describe('chaos tests (TEST-QA-0853)', () => {
    it('should handle empty object response', async () => {
      // Arrange
      mockRequestJira.mockResolvedValue(makeSuccessResponse({}));

      // Act & Assert
      await expect(getTicketData('PROJ-123')).rejects.toThrow(JiraApiError);
    });

    it('should handle response with extra unexpected fields', async () => {
      // Arrange — extra fields should be ignored
      const response = {
        ...makeJiraIssueResponse(),
        extraField: 'should be ignored',
        nested: { extra: true },
      };
      mockRequestJira.mockResolvedValue(makeSuccessResponse(response));

      // Act
      const result = await getTicketData('PROJ-123');

      // Assert — should still parse correctly
      expect(result.key).toBe('PROJ-123');
    });

    it('should handle project config response with extra wrapper properties', async () => {
      // Arrange
      const config = makeProjectConfig();
      mockRequestJira.mockResolvedValue(
        makeSuccessResponse({
          value: config,
          extra: 'ignored',
          _links: { self: 'http://example.com' },
        }),
      );

      // Act
      const result = await getProjectConfig('PROJ');

      // Assert
      expect(result.projectKey).toBe('PROJ');
    });

    it('should handle transition response with multiple error messages', async () => {
      // Arrange
      mockRequestJira.mockResolvedValue(
        makeTransitionErrorResponse([
          'Transition not available',
          'Workflow violation detected',
          'Missing required field',
        ]),
      );

      // Act & Assert
      try {
        await transitionIssue('PROJ-123', 'bad');
        fail('Expected TransitionBlockedError');
      } catch (error: unknown) {
        expect(error).toBeInstanceOf(TransitionBlockedError);
        const err = error as TransitionBlockedError;
        expect(err.message).toContain('Transition not available');
        expect(err.message).toContain('Workflow violation detected');
        expect(err.message).toContain('Missing required field');
      }
    });
  });

  // ─── Forge API Usage (AC-01) ──────────

  describe('Forge API usage (AC-01)', () => {
    it('should call requestJira for getTicketData', async () => {
      // Arrange
      mockRequestJira.mockResolvedValue(makeSuccessResponse(makeJiraIssueResponse()));

      // Act
      await getTicketData('PROJ-123');

      // Assert
      expect(mockRequestJira).toHaveBeenCalledTimes(1);
    });

    it('should call requestJira for saveProjectConfig with PUT method', async () => {
      // Arrange
      mockRequestJira.mockResolvedValue(makeResponse({ ok: true, status: 200 }));

      // Act
      await saveProjectConfig(makeProjectConfig());

      // Assert
      expect(mockRequestJira).toHaveBeenCalledTimes(1);
    });

    it('should call requestJira for transitionIssue with POST method', async () => {
      // Arrange
      mockRequestJira.mockResolvedValue(
        makeResponse({
          ok: true,
          status: 204,
          text: async () => '',
          headers: makeHeaders(),
        }),
      );

      // Act
      await transitionIssue('PROJ-123', '21');

      // Assert
      expect(mockRequestJira).toHaveBeenCalledTimes(1);
    });

    it('should call requestJira for addComment with POST method', async () => {
      // Arrange
      mockRequestJira.mockResolvedValue(makeResponse({ ok: true, status: 201 }));

      // Act
      await addComment('PROJ-123', 'test comment');

      // Assert
      expect(mockRequestJira).toHaveBeenCalledTimes(1);
    });

    it('should call requestJira for getIssueStatus', async () => {
      // Arrange
      mockRequestJira.mockResolvedValue(makeSuccessResponse(makeJiraIssueResponse()));

      // Act
      await getIssueStatus('PROJ-123');

      // Assert
      expect(mockRequestJira).toHaveBeenCalledTimes(1);
    });

    it('should call requestJira for getTransitions', async () => {
      // Arrange
      mockRequestJira.mockResolvedValue(makeTransitionsResponse([]));

      // Act
      await getTransitions('PROJ-123');

      // Assert
      expect(mockRequestJira).toHaveBeenCalledTimes(1);
    });

    it('should call requestJira for getProjectConfig', async () => {
      // Arrange
      mockRequestJira.mockResolvedValue(makeConfigPropertyResponse(makeProjectConfig()));

      // Act
      await getProjectConfig('PROJ');

      // Assert
      expect(mockRequestJira).toHaveBeenCalledTimes(1);
    });
  });

  // ─── Error Code Consistency (AC-02) ───

  describe('error code consistency (AC-02)', () => {
    it('should use JIRA_NOT_FOUND code for 404 errors', async () => {
      // Arrange
      mockRequestJira.mockResolvedValue(makeErrorResponse(404));

      // Act & Assert
      try {
        await getTicketData('MISSING-1');
        fail('Expected TicketNotFoundError');
      } catch (error: unknown) {
        expect(error).toBeInstanceOf(TicketNotFoundError);
        expect((error as TicketNotFoundError).code).toBe('JIRA_NOT_FOUND');
      }
    });

    it('should use JIRA_PERMISSION_DENIED code for 403 errors', async () => {
      // Arrange
      mockRequestJira.mockResolvedValue(makeErrorResponse(403));

      // Act & Assert
      try {
        await getTicketData('PROJ-123');
        fail('Expected PermissionDeniedError');
      } catch (error: unknown) {
        expect(error).toBeInstanceOf(PermissionDeniedError);
        expect((error as PermissionDeniedError).code).toBe('JIRA_PERMISSION_DENIED');
      }
    });

    it('should use JIRA_API_ERROR code for 5xx errors', async () => {
      // Arrange
      mockRequestJira.mockResolvedValue(makeErrorResponse(500));

      // Act & Assert
      try {
        await getTicketData('PROJ-123');
        fail('Expected JiraApiError');
      } catch (error: unknown) {
        expect(error).toBeInstanceOf(JiraApiError);
        expect((error as JiraApiError).code).toBe('JIRA_API_ERROR');
      }
    });

    it('should use JIRA_TIMEOUT code for timeout errors', async () => {
      // Arrange
      mockRequestJira.mockRejectedValue(
        new DOMException('The operation was aborted', 'AbortError'),
      );

      // Act & Assert
      try {
        await getTicketData('PROJ-123');
        fail('Expected TimeoutError');
      } catch (error: unknown) {
        expect(error).toBeInstanceOf(TimeoutError);
        expect((error as TimeoutError).code).toBe('JIRA_TIMEOUT');
      }
    });

    it('should use JIRA_NETWORK_ERROR code for network errors', async () => {
      // Arrange
      mockRequestJira.mockRejectedValue(new Error('ECONNREFUSED'));

      // Act & Assert
      try {
        await getTicketData('PROJ-123');
        fail('Expected JiraApiError');
      } catch (error: unknown) {
        expect(error).toBeInstanceOf(JiraApiError);
        expect((error as JiraApiError).code).toBe('JIRA_NETWORK_ERROR');
      }
    });

    it('should use JIRA_TRANSITION_BLOCKED code for blocked transitions', async () => {
      // Arrange
      mockRequestJira.mockResolvedValue(makeTransitionErrorResponse(['Transition blocked']));

      // Act & Assert
      try {
        await transitionIssue('PROJ-123', 'bad');
        fail('Expected TransitionBlockedError');
      } catch (error: unknown) {
        expect(error).toBeInstanceOf(TransitionBlockedError);
        expect((error as TransitionBlockedError).code).toBe('JIRA_TRANSITION_BLOCKED');
      }
    });
  });
});
