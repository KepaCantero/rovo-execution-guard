// Test suite for the GitHub API Adapter
// Covers: createStatusCheck, createPRComment, getPRData, extractJiraKeysFromPR,
//         updateStatusCheck, listPRFiles
// Pattern: Arrange-Act-Assert (AAA), TDD cycle: RED -> GREEN -> REFACTOR
// [TEST-QA-001]
// [TEST-QA-0764] Mock @forge/api fetch entirely — no real HTTP calls
// [TEST-QA-0833] Unit tests with mocked @forge/api

// ═══════════════════════════════════════════
// MOCKS — must come before imports that depend on @forge/api
// ═══════════════════════════════════════════

// [TEST-QA-0764] Mock @forge/api fetch
jest.mock('@forge/api', () => ({
  fetch: jest.fn(),
}));

import {
  createStatusCheck,
  createPRComment,
  getPRData,
  extractJiraKeysFromPR,
  updateStatusCheck,
  listPRFiles,
} from '../../../../src/backend/services/github/github-adapter';
import {
  GitHubApiError,
  TokenExpiredError,
  TimeoutError,
} from '../../../../src/backend/types/errors';
import type {
  GitHubPRData,
  GitHubStatusCheck,
  PRFile,
} from '../../../../src/backend/types/github-data';

import { fetch as forgeFetch, type APIResponse } from '@forge/api';

const mockFetch = jest.mocked(forgeFetch);

/** Helper to get the URL and options from the first mock call */
const getCallArgs = (callIndex = 0): [string, RequestInit] => {
  const call = mockFetch.mock.calls[callIndex];
  if (!call) throw new Error(`No call at index ${callIndex}`);
  return call as [string, RequestInit];
};

/**
 * Resolves a promise that uses fake timers by advancing time in small increments.
 * This avoids the deadlock where the test awaits a promise that's waiting on a fake timer.
 */
const flushWithFakeTimers = async (promise: Promise<unknown>): Promise<void> => {
  let settled = false;
  promise.then(
    () => {
      settled = true;
    },
    () => {
      settled = true;
    },
  );
  // Advance timers in small increments until the promise settles
  for (let i = 0; i < 100 && !settled; i++) {
    jest.advanceTimersByTime(500);
    // Give the microtask queue a chance to process
    await Promise.resolve();
  }
};

// ═══════════════════════════════════════════
// FIXTURES
// ═══════════════════════════════════════════

const TEST_TOKEN = 'ghs_test-token-value';
const TEST_REPO = 'acme/my-project';
const TEST_SHA = 'abc123def456';
const TEST_EXECUTION_ID = 'exec-001';

/** Creates a mock Headers object */
const makeHeaders = (headers: Record<string, string> = {}): Headers => {
  const map = new Map<string, string>(Object.entries(headers));
  return {
    get: (name: string) => map.get(name) ?? null,
    forEach: () => {},
    entries: () => map.entries(),
    keys: () => map.keys(),
    values: () => map.values(),
    [Symbol.iterator]: () => map.entries(),
    has: (name: string) => map.has(name),
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
  }) as unknown as APIResponse;

/** Creates a successful response with JSON body */
const makeSuccessResponse = (data: unknown, headers?: Headers) =>
  makeResponse({
    ok: true,
    status: 200,
    json: async () => data,
    headers: headers ?? makeHeaders(),
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

/** Creates a realistic GitHub PR API response */
const makeGitHubPRResponse = (
  overrides: Record<string, unknown> = {},
): Record<string, unknown> => ({
  number: 42,
  title: 'feat: add OAuth2 authentication PROJ-123',
  body: 'Implements OAuth2 login.\n\nRelated: PROJ-456',
  state: 'open',
  head: { ref: 'feature/oauth2' },
  base: { ref: 'main' },
  html_url: 'https://github.com/acme/my-project/pull/42',
  ...overrides,
});

/** Creates a realistic GitHub PR file response */
const makeGitHubPRFileResponse = (
  overrides: Record<string, unknown> = {},
): Record<string, unknown> => ({
  filename: 'src/auth/oauth2.ts',
  status: 'added',
  additions: 150,
  deletions: 0,
  ...overrides,
});

/** Creates a GitHubStatusCheck fixture */
const makeStatusCheck = (overrides: Partial<GitHubStatusCheck> = {}): GitHubStatusCheck => ({
  state: 'success',
  targetUrl: 'https://acme.atlassian.net/projects/PROJ/panels/1',
  description: 'All consistency checks passed (score: 95)',
  context: 'rovo-execution-guard/consistency',
  ...overrides,
});

/** Creates a GitHubPRData fixture for extractJiraKeysFromPR tests */
const makePRData = (overrides: Partial<GitHubPRData> = {}): GitHubPRData => ({
  number: 42,
  title: 'feat: add OAuth2 PROJ-123',
  body: 'Related: PROJ-456',
  state: 'open',
  branch: 'feature/oauth2',
  baseBranch: 'main',
  files: [],
  url: 'https://github.com/acme/my-project/pull/42',
  ...overrides,
});

/** Creates paginated Link header string */
const makeLinkHeader = (nextUrl: string | null): string | undefined => {
  if (!nextUrl) return undefined;
  return `<${nextUrl}>; rel="next"`;
};

// ═══════════════════════════════════════════
// TEST SUITE
// ═══════════════════════════════════════════

describe('github-adapter', () => {
  let consoleLogSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    jest.useRealTimers();
  });

  // ─── createStatusCheck() ─────────────

  describe('createStatusCheck()', () => {
    it('should create status check with correct endpoint and body (AC-01)', async () => {
      // Arrange
      const params = makeStatusCheck();
      mockFetch.mockResolvedValue(makeSuccessResponse({}));

      // Act
      await createStatusCheck(params, TEST_REPO, TEST_SHA, TEST_TOKEN, TEST_EXECUTION_ID);

      // Assert
      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, options] = getCallArgs();
      expect(url).toBe('https://api.github.com/repos/acme/my-project/statuses/abc123def456');
      const reqOptions = options as Record<string, unknown>;
      expect(reqOptions.method).toBe('POST');
      const body = JSON.parse(reqOptions.body as string);
      expect(body.state).toBe('success');
      expect(body.context).toBe('rovo-execution-guard/consistency');
      expect(body.target_url).toBe(params.targetUrl);
    });

    it('should use default context when none provided (GH-INTEG-305)', async () => {
      // Arrange
      const params = makeStatusCheck({ context: '' });
      mockFetch.mockResolvedValue(makeSuccessResponse({}));

      // Act
      await createStatusCheck(params, TEST_REPO, TEST_SHA, TEST_TOKEN);

      // Assert
      const [, options] = getCallArgs();
      const body = JSON.parse((options as Record<string, unknown>).body as string);
      expect(body.context).toBe('rovo-execution-guard/consistency');
    });

    it('should throw TokenExpiredError on 401 (AC-07)', async () => {
      // Arrange
      mockFetch.mockResolvedValue(makeErrorResponse(401));

      // Act & Assert
      await expect(
        createStatusCheck(makeStatusCheck(), TEST_REPO, TEST_SHA, TEST_TOKEN),
      ).rejects.toThrow(TokenExpiredError);
    });

    it('should throw GitHubApiError on 404 (AC-07)', async () => {
      // Arrange
      mockFetch.mockResolvedValue(makeErrorResponse(404));

      // Act & Assert
      await expect(
        createStatusCheck(makeStatusCheck(), TEST_REPO, TEST_SHA, TEST_TOKEN),
      ).rejects.toThrow(GitHubApiError);
    });

    it('should throw GitHubApiError on 500 (AC-07)', async () => {
      // Arrange — 500 triggers retries, use fake timers to avoid real delays
      jest.useFakeTimers();
      mockFetch.mockResolvedValue(makeErrorResponse(500));

      // Act
      const promise = createStatusCheck(makeStatusCheck(), TEST_REPO, TEST_SHA, TEST_TOKEN);
      await flushWithFakeTimers(promise);

      // Assert
      await expect(promise).rejects.toThrow(GitHubApiError);
      jest.useRealTimers();
    });

    it('should include Authorization header with token (SEC-PRIV-001)', async () => {
      // Arrange
      mockFetch.mockResolvedValue(makeSuccessResponse({}));

      // Act
      await createStatusCheck(makeStatusCheck(), TEST_REPO, TEST_SHA, TEST_TOKEN);

      // Assert
      const [, opts] = getCallArgs();
      const headers = (opts as Record<string, unknown>).headers as Record<string, string>;
      expect(headers.Authorization).toBe(`token ${TEST_TOKEN}`);
    });
  });

  // ─── createPRComment() ───────────────

  describe('createPRComment()', () => {
    it('should publish PR comment with valid context (AC-02)', async () => {
      // Arrange
      mockFetch.mockResolvedValue(makeSuccessResponse({ id: 1 }));

      // Act
      await createPRComment(
        TEST_REPO,
        42,
        '## Quality Score: 95\nAll checks passed.',
        TEST_TOKEN,
        TEST_EXECUTION_ID,
      );

      // Assert
      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, options] = getCallArgs();
      expect(url).toBe('https://api.github.com/repos/acme/my-project/issues/42/comments');
      const reqOptions = options as Record<string, unknown>;
      expect(reqOptions.method).toBe('POST');
      const body = JSON.parse(reqOptions.body as string);
      expect(body.body).toContain('Quality Score: 95');
    });

    it('should throw TokenExpiredError on 401', async () => {
      // Arrange
      mockFetch.mockResolvedValue(makeErrorResponse(401));

      // Act & Assert
      await expect(createPRComment(TEST_REPO, 42, 'comment', TEST_TOKEN)).rejects.toThrow(
        TokenExpiredError,
      );
    });

    it('should throw GitHubApiError on 404', async () => {
      // Arrange
      mockFetch.mockResolvedValue(makeErrorResponse(404));

      // Act & Assert
      await expect(createPRComment(TEST_REPO, 42, 'comment', TEST_TOKEN)).rejects.toThrow(
        GitHubApiError,
      );
    });
  });

  // ─── getPRData() ─────────────────────

  describe('getPRData()', () => {
    it('should return typed PR data for valid response', async () => {
      // Arrange
      const prResponse = makeGitHubPRResponse();
      const filesResponse = [makeGitHubPRFileResponse()];
      mockFetch
        .mockResolvedValueOnce(makeSuccessResponse(prResponse))
        .mockResolvedValueOnce(makeSuccessResponse(filesResponse, makeHeaders()));

      // Act
      const result = await getPRData(TEST_REPO, 42, TEST_TOKEN, TEST_EXECUTION_ID);

      // Assert
      expect(result.number).toBe(42);
      expect(result.title).toBe('feat: add OAuth2 authentication PROJ-123');
      expect(result.state).toBe('open');
      expect(result.branch).toBe('feature/oauth2');
      expect(result.baseBranch).toBe('main');
      expect(result.url).toBe('https://github.com/acme/my-project/pull/42');
    });

    it('should handle null body by defaulting to empty string', async () => {
      // Arrange
      const prResponse = makeGitHubPRResponse({ body: null });
      mockFetch
        .mockResolvedValueOnce(makeSuccessResponse(prResponse))
        .mockResolvedValueOnce(makeSuccessResponse([]));

      // Act
      const result = await getPRData(TEST_REPO, 42, TEST_TOKEN);

      // Assert
      expect(result.body).toBe('');
    });

    it('should throw GitHubApiError for invalid PR response structure (SEC-PRIV-004)', async () => {
      // Arrange — missing required fields
      mockFetch.mockResolvedValueOnce(makeSuccessResponse({ foo: 'bar' }));

      // Act & Assert
      await expect(getPRData(TEST_REPO, 42, TEST_TOKEN)).rejects.toThrow(GitHubApiError);
    });

    it('should throw TokenExpiredError on 401', async () => {
      // Arrange
      mockFetch.mockResolvedValue(makeErrorResponse(401));

      // Act & Assert
      await expect(getPRData(TEST_REPO, 42, TEST_TOKEN)).rejects.toThrow(TokenExpiredError);
    });

    it('should throw GitHubApiError on 404', async () => {
      // Arrange
      mockFetch.mockResolvedValue(makeErrorResponse(404));

      // Act & Assert
      await expect(getPRData(TEST_REPO, 42, TEST_TOKEN)).rejects.toThrow(GitHubApiError);
    });

    it('should throw GitHubApiError on 422', async () => {
      // Arrange
      mockFetch.mockResolvedValue(makeErrorResponse(422));

      // Act & Assert
      await expect(getPRData(TEST_REPO, 42, TEST_TOKEN)).rejects.toThrow(GitHubApiError);
    });
  });

  // ─── extractJiraKeysFromPR() ─────────

  describe('extractJiraKeysFromPR()', () => {
    it('should extract single Jira key from PR title (AC-03)', () => {
      // Arrange
      const pr = makePRData({ title: 'PROJ-123: add OAuth2', body: '' });

      // Act
      const keys = extractJiraKeysFromPR(pr);

      // Assert
      expect(keys).toEqual(['PROJ-123']);
    });

    it('should extract multiple Jira keys from title and body (AC-03)', () => {
      // Arrange
      const pr = makePRData({
        title: 'PROJ-123: add OAuth2',
        body: 'Also relates to PROJ-456 and PROJ-789',
      });

      // Act
      const keys = extractJiraKeysFromPR(pr);

      // Assert
      expect(keys).toEqual(['PROJ-123', 'PROJ-456', 'PROJ-789']);
    });

    it('should return empty array when no Jira keys found (AC-03)', () => {
      // Arrange
      const pr = makePRData({ title: 'Update readme', body: 'Minor changes' });

      // Act
      const keys = extractJiraKeysFromPR(pr);

      // Assert
      expect(keys).toEqual([]);
    });

    it('should deduplicate keys while preserving order', () => {
      // Arrange
      const pr = makePRData({
        title: 'PROJ-123 fix',
        body: 'PROJ-123 also PROJ-456 and PROJ-123 again',
      });

      // Act
      const keys = extractJiraKeysFromPR(pr);

      // Assert
      expect(keys).toEqual(['PROJ-123', 'PROJ-456']);
    });

    it('should handle mixed project keys', () => {
      // Arrange
      const pr = makePRData({
        title: 'ABC-100 and XYZ-200',
        body: '',
      });

      // Act
      const keys = extractJiraKeysFromPR(pr);

      // Assert
      expect(keys).toEqual(['ABC-100', 'XYZ-200']);
    });

    it('should not match lowercase project keys', () => {
      // Arrange
      const pr = makePRData({
        title: 'proj-123 is not a valid key',
        body: '',
      });

      // Act
      const keys = extractJiraKeysFromPR(pr);

      // Assert
      expect(keys).toEqual([]);
    });

    it('should handle empty title and body', () => {
      // Arrange
      const pr = makePRData({ title: '', body: '' });

      // Act
      const keys = extractJiraKeysFromPR(pr);

      // Assert
      expect(keys).toEqual([]);
    });
  });

  // ─── updateStatusCheck() ─────────────

  describe('updateStatusCheck()', () => {
    it('should update status check with partial params', async () => {
      // Arrange
      mockFetch.mockResolvedValue(makeSuccessResponse({}));

      // Act
      await updateStatusCheck(
        'check-123',
        { state: 'failure', description: 'Score below threshold' },
        TEST_REPO,
        TEST_SHA,
        TEST_TOKEN,
        TEST_EXECUTION_ID,
      );

      // Assert
      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, options] = getCallArgs();
      expect(url).toBe('https://api.github.com/repos/acme/my-project/statuses/abc123def456');
      const body = JSON.parse((options as Record<string, unknown>).body as string);
      expect(body.state).toBe('failure');
      expect(body.description).toBe('Score below threshold');
    });

    it('should only send provided fields in update body', async () => {
      // Arrange
      mockFetch.mockResolvedValue(makeSuccessResponse({}));

      // Act
      await updateStatusCheck('check-123', { state: 'pending' }, TEST_REPO, TEST_SHA, TEST_TOKEN);

      // Assert
      const [, opts] = getCallArgs();
      const body = JSON.parse((opts as Record<string, unknown>).body as string);
      expect(body.state).toBe('pending');
      expect(body).not.toHaveProperty('target_url');
      expect(body).not.toHaveProperty('description');
    });

    it('should throw TokenExpiredError on 401', async () => {
      // Arrange
      mockFetch.mockResolvedValue(makeErrorResponse(401));

      // Act & Assert
      await expect(
        updateStatusCheck('check-123', { state: 'success' }, TEST_REPO, TEST_SHA, TEST_TOKEN),
      ).rejects.toThrow(TokenExpiredError);
    });
  });

  // ─── listPRFiles() ───────────────────

  describe('listPRFiles()', () => {
    it('should return files for a valid PR', async () => {
      // Arrange
      const filesResponse = [
        makeGitHubPRFileResponse({
          filename: 'src/a.ts',
          status: 'added',
          additions: 10,
          deletions: 0,
        }),
        makeGitHubPRFileResponse({
          filename: 'src/b.ts',
          status: 'modified',
          additions: 5,
          deletions: 3,
        }),
      ];
      mockFetch.mockResolvedValue(makeSuccessResponse(filesResponse, makeHeaders()));

      // Act
      const files = await listPRFiles(TEST_REPO, 42, TEST_TOKEN, TEST_EXECUTION_ID);

      // Assert
      expect(files).toHaveLength(2);
      expect(files[0]).toEqual({
        filename: 'src/a.ts',
        status: 'added',
        additions: 10,
        deletions: 0,
      });
      expect(files[1]).toEqual({
        filename: 'src/b.ts',
        status: 'modified',
        additions: 5,
        deletions: 3,
      });
    });

    it('should paginate via Link header (GH-INTEG-301)', async () => {
      // Arrange — page 1 has Link header pointing to page 2
      const page1Files = [makeGitHubPRFileResponse({ filename: 'src/a.ts' })];
      const page2Files = [makeGitHubPRFileResponse({ filename: 'src/b.ts' })];
      const linkHeaderValue = makeLinkHeader(
        'https://api.github.com/repos/acme/my-project/pulls/42/files?per_page=100&page=2',
      );

      const page1Headers = makeHeaders(linkHeaderValue ? { Link: linkHeaderValue } : {});
      const page2Headers = makeHeaders();

      mockFetch
        .mockResolvedValueOnce(makeSuccessResponse(page1Files, page1Headers))
        .mockResolvedValueOnce(makeSuccessResponse(page2Files, page2Headers));

      // Act
      const files = await listPRFiles(TEST_REPO, 42, TEST_TOKEN);

      // Assert
      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(files).toHaveLength(2);
      expect(files[0]!.filename).toBe('src/a.ts');
      expect(files[1]!.filename).toBe('src/b.ts');
    });

    it('should return empty array when no files', async () => {
      // Arrange
      mockFetch.mockResolvedValue(makeSuccessResponse([], makeHeaders()));

      // Act
      const files = await listPRFiles(TEST_REPO, 42, TEST_TOKEN);

      // Assert
      expect(files).toEqual([]);
    });

    it('should throw GitHubApiError for non-array response (SEC-PRIV-004)', async () => {
      // Arrange
      mockFetch.mockResolvedValue(makeSuccessResponse({ not: 'array' }));

      // Act & Assert
      await expect(listPRFiles(TEST_REPO, 42, TEST_TOKEN)).rejects.toThrow(GitHubApiError);
    });

    it('should skip invalid file entries with warning log', async () => {
      // Arrange
      const filesResponse = [
        makeGitHubPRFileResponse({ filename: 'src/valid.ts' }),
        { not_filename: 'bad' }, // invalid entry
        makeGitHubPRFileResponse({ filename: 'src/also-valid.ts' }),
      ];
      mockFetch.mockResolvedValue(makeSuccessResponse(filesResponse, makeHeaders()));

      // Act
      const files = await listPRFiles(TEST_REPO, 42, TEST_TOKEN);

      // Assert
      expect(files).toHaveLength(2);
      expect(files[0]!.filename).toBe('src/valid.ts');
      expect(files[1]!.filename).toBe('src/also-valid.ts');

      // Verify warning was logged
      const logCalls = consoleLogSpy.mock.calls.map((call: [string]) => {
        try {
          return JSON.parse(call[0]);
        } catch {
          return null;
        }
      });
      const warnLogs = logCalls.filter(
        (l: Record<string, unknown> | null) =>
          l && l.level === 'warn' && l.note === 'skipping_invalid_file_entry',
      );
      expect(warnLogs.length).toBeGreaterThan(0);
    });

    it('should default unknown file status to "modified"', async () => {
      // Arrange
      const filesResponse = [
        makeGitHubPRFileResponse({
          filename: 'src/renamed.ts',
          status: 'renamed',
          additions: 0,
          deletions: 0,
        }),
      ];
      mockFetch.mockResolvedValue(makeSuccessResponse(filesResponse, makeHeaders()));

      // Act
      const files = await listPRFiles(TEST_REPO, 42, TEST_TOKEN);

      // Assert
      expect(files[0]!.status).toBe('modified');
    });

    it('should throw TokenExpiredError on 401', async () => {
      // Arrange
      mockFetch.mockResolvedValue(makeErrorResponse(401));

      // Act & Assert
      await expect(listPRFiles(TEST_REPO, 42, TEST_TOKEN)).rejects.toThrow(TokenExpiredError);
    });
  });

  // ─── Rate Limiting (GH-INTEG-302, GH-INTEG-309) ──

  describe('rate limiting with exponential backoff (GH-INTEG-309)', () => {
    it('should retry on HTTP 429 and succeed on second attempt', async () => {
      // Arrange
      jest.useFakeTimers();
      const rateLimitedResponse = makeRateLimitedResponse();
      const successResponse = makeSuccessResponse({});
      mockFetch.mockResolvedValueOnce(rateLimitedResponse).mockResolvedValueOnce(successResponse);

      // Act
      const promise = createStatusCheck(
        makeStatusCheck(),
        TEST_REPO,
        TEST_SHA,
        TEST_TOKEN,
        TEST_EXECUTION_ID,
      );
      await flushWithFakeTimers(promise);
      await promise;

      // Assert
      expect(mockFetch).toHaveBeenCalledTimes(2);
      jest.useRealTimers();
    });

    it('should retry on HTTP 500 and succeed on second attempt', async () => {
      // Arrange
      jest.useFakeTimers();
      const serverErrorResponse = makeErrorResponse(500);
      const successResponse = makeSuccessResponse({});
      mockFetch.mockResolvedValueOnce(serverErrorResponse).mockResolvedValueOnce(successResponse);

      // Act
      const promise = createStatusCheck(makeStatusCheck(), TEST_REPO, TEST_SHA, TEST_TOKEN);
      await flushWithFakeTimers(promise);
      await promise;

      // Assert
      expect(mockFetch).toHaveBeenCalledTimes(2);
      jest.useRealTimers();
    });

    it('should not retry on 4xx client errors (GH-INTEG-309)', async () => {
      // Arrange
      mockFetch.mockResolvedValue(makeErrorResponse(400));

      // Act & Assert
      await expect(
        createStatusCheck(makeStatusCheck(), TEST_REPO, TEST_SHA, TEST_TOKEN),
      ).rejects.toThrow(GitHubApiError);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should not retry on 403', async () => {
      // Arrange
      mockFetch.mockResolvedValue(makeErrorResponse(403));

      // Act & Assert
      await expect(
        createStatusCheck(makeStatusCheck(), TEST_REPO, TEST_SHA, TEST_TOKEN),
      ).rejects.toThrow(GitHubApiError);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should not retry on 422', async () => {
      // Arrange
      mockFetch.mockResolvedValue(makeErrorResponse(422));

      // Act & Assert
      await expect(
        createStatusCheck(makeStatusCheck(), TEST_REPO, TEST_SHA, TEST_TOKEN),
      ).rejects.toThrow(GitHubApiError);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should exhaust retries and throw GitHubApiError after max retries', async () => {
      // Arrange — always 429
      jest.useFakeTimers();
      mockFetch.mockResolvedValue(makeRateLimitedResponse());

      // Act
      const promise = createStatusCheck(makeStatusCheck(), TEST_REPO, TEST_SHA, TEST_TOKEN);
      await flushWithFakeTimers(promise);

      // Assert
      await expect(promise).rejects.toThrow(GitHubApiError);
      // 4 attempts: 0,1,2,3 (maxRetries=3)
      expect(mockFetch).toHaveBeenCalledTimes(4);
      jest.useRealTimers();
    });

    it('should log warning on retry attempt', async () => {
      // Arrange
      jest.useFakeTimers();
      mockFetch
        .mockResolvedValueOnce(makeRateLimitedResponse())
        .mockResolvedValueOnce(makeSuccessResponse({}));

      // Act
      const promise = createStatusCheck(
        makeStatusCheck(),
        TEST_REPO,
        TEST_SHA,
        TEST_TOKEN,
        'exec-retry-warn',
      );
      await flushWithFakeTimers(promise);
      await promise;

      // Assert
      const logCalls = consoleLogSpy.mock.calls.map((call: [string]) => {
        try {
          return JSON.parse(call[0]);
        } catch {
          return null;
        }
      });
      const warnLogs = logCalls.filter(
        (l: Record<string, unknown> | null) =>
          l && l.level === 'warn' && l.reason === 'rate_limited',
      );
      expect(warnLogs.length).toBeGreaterThan(0);
      jest.useRealTimers();
    });
  });

  // ─── Rate Limit Headers (GH-INTEG-302) ──

  describe('rate limit header monitoring (GH-INTEG-302)', () => {
    it('should warn when rate limit remaining is low', async () => {
      // Arrange — 50 remaining out of 5000
      mockFetch.mockResolvedValue(
        makeSuccessResponse(
          {},
          makeHeaders({
            'X-RateLimit-Remaining': '50',
            'X-RateLimit-Limit': '5000',
          }),
        ),
      );

      // Act
      await createStatusCheck(
        makeStatusCheck(),
        TEST_REPO,
        TEST_SHA,
        TEST_TOKEN,
        TEST_EXECUTION_ID,
      );

      // Assert
      const logCalls = consoleLogSpy.mock.calls.map((call: [string]) => {
        try {
          return JSON.parse(call[0]);
        } catch {
          return null;
        }
      });
      const warnLogs = logCalls.filter(
        (l: Record<string, unknown> | null) => l && l.note === 'rate_limit_quota_low',
      );
      expect(warnLogs.length).toBeGreaterThan(0);
    });

    it('should not warn when rate limit remaining is healthy', async () => {
      // Arrange — 4000 remaining out of 5000
      mockFetch.mockResolvedValue(
        makeSuccessResponse(
          {},
          makeHeaders({
            'X-RateLimit-Remaining': '4000',
            'X-RateLimit-Limit': '5000',
          }),
        ),
      );

      // Act
      await createStatusCheck(makeStatusCheck(), TEST_REPO, TEST_SHA, TEST_TOKEN);

      // Assert
      const logCalls = consoleLogSpy.mock.calls.map((call: [string]) => {
        try {
          return JSON.parse(call[0]);
        } catch {
          return null;
        }
      });
      const warnLogs = logCalls.filter(
        (l: Record<string, unknown> | null) => l && l.note === 'rate_limit_quota_low',
      );
      expect(warnLogs.length).toBe(0);
    });
  });

  // ─── Timeout via AbortController (AC-05) ──

  describe('timeout via AbortController (AC-05, FORGE-OPS-005)', () => {
    it('should throw TimeoutError when request is aborted', async () => {
      // Arrange
      const abortError = new DOMException('The operation was aborted', 'AbortError');
      mockFetch.mockRejectedValue(abortError);

      // Act & Assert
      await expect(
        createStatusCheck(makeStatusCheck(), TEST_REPO, TEST_SHA, TEST_TOKEN, TEST_EXECUTION_ID),
      ).rejects.toThrow(TimeoutError);
    });

    it('should throw TimeoutError with timeout duration in message', async () => {
      // Arrange
      const abortError = new DOMException('The operation was aborted', 'AbortError');
      mockFetch.mockRejectedValue(abortError);

      // Act & Assert
      try {
        await createStatusCheck(makeStatusCheck(), TEST_REPO, TEST_SHA, TEST_TOKEN);
        fail('Expected TimeoutError');
      } catch (error: unknown) {
        expect(error).toBeInstanceOf(TimeoutError);
        const err = error as TimeoutError;
        expect(err.message).toContain('timed out');
        expect(err.message).toContain('8000');
      }
    });

    it('should throw TimeoutError for Error with name AbortError', async () => {
      // Arrange
      const abortLikeError = new Error('Aborted');
      abortLikeError.name = 'AbortError';
      mockFetch.mockRejectedValue(abortLikeError);

      // Act & Assert
      await expect(
        createStatusCheck(makeStatusCheck(), TEST_REPO, TEST_SHA, TEST_TOKEN),
      ).rejects.toThrow(TimeoutError);
    });
  });

  // ─── Network Error Handling ──────────

  describe('network error handling', () => {
    it('should throw GitHubApiError on network error', async () => {
      // Arrange
      mockFetch.mockRejectedValue(new Error('ECONNREFUSED'));

      // Act & Assert
      await expect(
        createStatusCheck(makeStatusCheck(), TEST_REPO, TEST_SHA, TEST_TOKEN),
      ).rejects.toThrow(GitHubApiError);
    });

    it('should include original error message in GitHubApiError', async () => {
      // Arrange
      mockFetch.mockRejectedValue(new Error('Network dropped'));

      // Act & Assert
      try {
        await createStatusCheck(makeStatusCheck(), TEST_REPO, TEST_SHA, TEST_TOKEN);
        fail('Expected GitHubApiError');
      } catch (error: unknown) {
        expect(error).toBeInstanceOf(GitHubApiError);
        const err = error as GitHubApiError;
        expect(err.message).toContain('Network dropped');
      }
    });

    it('should handle non-Error rejection', async () => {
      // Arrange
      mockFetch.mockRejectedValue('connection lost');

      // Act & Assert
      await expect(
        createStatusCheck(makeStatusCheck(), TEST_REPO, TEST_SHA, TEST_TOKEN),
      ).rejects.toThrow(GitHubApiError);
    });
  });

  // ─── Structured Logging (AC-06) ──────

  describe('structured logging (AC-06)', () => {
    it('should include executionId in all log entries', async () => {
      // Arrange
      mockFetch.mockResolvedValue(makeSuccessResponse({}));

      // Act
      await createStatusCheck(makeStatusCheck(), TEST_REPO, TEST_SHA, TEST_TOKEN, 'exec-log-test');

      // Assert
      const logCalls = consoleLogSpy.mock.calls.map((call: [string]) => {
        try {
          return JSON.parse(call[0]);
        } catch {
          return null;
        }
      });
      const validLogs = logCalls.filter((l: unknown) => l !== null);
      for (const log of validLogs) {
        expect(log).toHaveProperty('executionId', 'exec-log-test');
      }
    });

    it('should omit executionId from log when not provided', async () => {
      // Arrange
      mockFetch.mockResolvedValue(makeSuccessResponse({}));

      // Act
      await createStatusCheck(makeStatusCheck(), TEST_REPO, TEST_SHA, TEST_TOKEN);

      // Assert
      const logCalls = consoleLogSpy.mock.calls.map((call: [string]) => {
        try {
          return JSON.parse(call[0]);
        } catch {
          return null;
        }
      });
      const infoLogs = logCalls.filter(
        (l: Record<string, unknown> | null) =>
          l && l.level === 'info' && l.operation === 'createStatusCheck',
      );
      expect(infoLogs.length).toBeGreaterThan(0);
      for (const log of infoLogs) {
        expect(log).not.toHaveProperty('executionId');
      }
    });

    it('should log timestamp in ISO 8601 format', async () => {
      // Arrange
      mockFetch.mockResolvedValue(makeSuccessResponse({}));

      // Act
      await createStatusCheck(makeStatusCheck(), TEST_REPO, TEST_SHA, TEST_TOKEN);

      // Assert
      const logCalls = consoleLogSpy.mock.calls.map((call: [string]) => {
        try {
          return JSON.parse(call[0]);
        } catch {
          return null;
        }
      });
      const validLogs = logCalls.filter((l: Record<string, unknown> | null) => l !== null);
      for (const log of validLogs) {
        expect(typeof log.timestamp).toBe('string');
        expect(new Date(log.timestamp as string).getTime()).not.toBeNaN();
      }
    });

    it('should include operation name and method', async () => {
      // Arrange
      mockFetch.mockResolvedValue(makeSuccessResponse({}));

      // Act
      await createStatusCheck(makeStatusCheck(), TEST_REPO, TEST_SHA, TEST_TOKEN, 'exec-op');

      // Assert
      const logCalls = consoleLogSpy.mock.calls.map((call: [string]) => {
        try {
          return JSON.parse(call[0]);
        } catch {
          return null;
        }
      });
      const infoLogs = logCalls.filter(
        (l: Record<string, unknown> | null) => l && l.level === 'info',
      );
      expect(
        infoLogs.some((l: Record<string, unknown>) => l.operation === 'createStatusCheck'),
      ).toBe(true);
    });

    it('should log audit event for token usage (SEC-PRIV-010)', async () => {
      // Arrange
      mockFetch.mockResolvedValue(makeSuccessResponse({}));

      // Act
      await createStatusCheck(
        makeStatusCheck(),
        TEST_REPO,
        TEST_SHA,
        TEST_TOKEN,
        TEST_EXECUTION_ID,
      );

      // Assert
      const logCalls = consoleLogSpy.mock.calls.map((call: [string]) => {
        try {
          return JSON.parse(call[0]);
        } catch {
          return null;
        }
      });
      const auditLogs = logCalls.filter(
        (l: Record<string, unknown> | null) => l && l.audit === 'token_used',
      );
      expect(auditLogs.length).toBeGreaterThan(0);
    });
  });

  // ─── Error Classification (GH-INTEG-304) ──

  describe('error classification (GH-INTEG-304)', () => {
    it('should classify 401 as TokenExpiredError', async () => {
      // Arrange
      mockFetch.mockResolvedValue(makeErrorResponse(401));

      // Act & Assert
      try {
        await createStatusCheck(makeStatusCheck(), TEST_REPO, TEST_SHA, TEST_TOKEN);
        fail('Expected TokenExpiredError');
      } catch (error: unknown) {
        expect(error).toBeInstanceOf(TokenExpiredError);
        const err = error as TokenExpiredError;
        expect(err.code).toBe('GITHUB_TOKEN_EXPIRED');
      }
    });

    it('should classify 403 as GitHubApiError with permission code', async () => {
      // Arrange
      mockFetch.mockResolvedValue(makeErrorResponse(403));

      // Act & Assert
      try {
        await createStatusCheck(makeStatusCheck(), TEST_REPO, TEST_SHA, TEST_TOKEN);
        fail('Expected GitHubApiError');
      } catch (error: unknown) {
        expect(error).toBeInstanceOf(GitHubApiError);
        const err = error as GitHubApiError;
        expect(err.code).toBe('GITHUB_PERMISSION_DENIED');
      }
    });

    it('should classify 404 as GitHubApiError with not found code', async () => {
      // Arrange
      mockFetch.mockResolvedValue(makeErrorResponse(404));

      // Act & Assert
      try {
        await createStatusCheck(makeStatusCheck(), TEST_REPO, TEST_SHA, TEST_TOKEN);
        fail('Expected GitHubApiError');
      } catch (error: unknown) {
        expect(error).toBeInstanceOf(GitHubApiError);
        const err = error as GitHubApiError;
        expect(err.code).toBe('GITHUB_NOT_FOUND');
      }
    });

    it('should classify 422 as GitHubApiError with validation code', async () => {
      // Arrange
      mockFetch.mockResolvedValue(makeErrorResponse(422));

      // Act & Assert
      try {
        await createStatusCheck(makeStatusCheck(), TEST_REPO, TEST_SHA, TEST_TOKEN);
        fail('Expected GitHubApiError');
      } catch (error: unknown) {
        expect(error).toBeInstanceOf(GitHubApiError);
        const err = error as GitHubApiError;
        expect(err.code).toBe('GITHUB_VALIDATION_ERROR');
      }
    });

    it('should classify 500 as GitHubApiError with generic code', async () => {
      // Arrange — 500 triggers retries, use fake timers
      jest.useFakeTimers();
      mockFetch.mockResolvedValue(makeErrorResponse(500));

      // Act
      const promise = createStatusCheck(makeStatusCheck(), TEST_REPO, TEST_SHA, TEST_TOKEN);
      await flushWithFakeTimers(promise);

      // Assert
      try {
        await promise;
        fail('Expected GitHubApiError');
      } catch (error: unknown) {
        expect(error).toBeInstanceOf(GitHubApiError);
        const err = error as GitHubApiError;
        expect(err.code).toBe('GITHUB_API_ERROR');
        expect(err.message).toContain('500');
      } finally {
        jest.useRealTimers();
      }
    });

    it('should use GITHUB_TIMEOUT code for timeout errors', async () => {
      // Arrange
      mockFetch.mockRejectedValue(new DOMException('Aborted', 'AbortError'));

      // Act & Assert
      try {
        await createStatusCheck(makeStatusCheck(), TEST_REPO, TEST_SHA, TEST_TOKEN);
        fail('Expected TimeoutError');
      } catch (error: unknown) {
        expect(error).toBeInstanceOf(TimeoutError);
        expect((error as TimeoutError).code).toBe('GITHUB_TIMEOUT');
      }
    });

    it('should use GITHUB_NETWORK_ERROR code for network errors', async () => {
      // Arrange
      mockFetch.mockRejectedValue(new Error('ECONNREFUSED'));

      // Act & Assert
      try {
        await createStatusCheck(makeStatusCheck(), TEST_REPO, TEST_SHA, TEST_TOKEN);
        fail('Expected GitHubApiError');
      } catch (error: unknown) {
        expect(error).toBeInstanceOf(GitHubApiError);
        expect((error as GitHubApiError).code).toBe('GITHUB_NETWORK_ERROR');
      }
    });
  });

  // ─── Error Message Context (ARCH-SOLID-234) ──

  describe('error message context (ARCH-SOLID-234)', () => {
    it('should include operation name in error message', async () => {
      // Arrange
      mockFetch.mockResolvedValue(makeErrorResponse(404));

      // Act & Assert
      try {
        await createStatusCheck(makeStatusCheck(), TEST_REPO, TEST_SHA, TEST_TOKEN);
        fail('Expected GitHubApiError');
      } catch (error: unknown) {
        expect(error).toBeInstanceOf(GitHubApiError);
        expect((error as GitHubApiError).message).toContain('createStatusCheck');
      }
    });

    it('should include not found in 404 error message', async () => {
      // Arrange
      mockFetch.mockResolvedValue(makeErrorResponse(404));

      // Act & Assert
      try {
        await createStatusCheck(makeStatusCheck(), TEST_REPO, TEST_SHA, TEST_TOKEN);
        fail('Expected GitHubApiError');
      } catch (error: unknown) {
        expect(error).toBeInstanceOf(GitHubApiError);
        expect((error as GitHubApiError).message).toContain('not found');
      }
    });

    it('should include token expired in 401 error message', async () => {
      // Arrange
      mockFetch.mockResolvedValue(makeErrorResponse(401));

      // Act & Assert
      try {
        await createStatusCheck(makeStatusCheck(), TEST_REPO, TEST_SHA, TEST_TOKEN);
        fail('Expected TokenExpiredError');
      } catch (error: unknown) {
        expect(error).toBeInstanceOf(TokenExpiredError);
        expect((error as TokenExpiredError).message).toContain('token expired');
      }
    });
  });

  // ─── Response Validation (SEC-PRIV-004) ──

  describe('response validation (SEC-PRIV-004)', () => {
    it('should reject null response body for getPRData', async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce(makeSuccessResponse(null));

      // Act & Assert
      await expect(getPRData(TEST_REPO, 42, TEST_TOKEN)).rejects.toThrow(GitHubApiError);
    });

    it('should reject response without number property', async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce(
        makeSuccessResponse({
          title: 'test',
          head: { ref: 'x' },
          base: { ref: 'y' },
          html_url: 'http://x',
        }),
      );

      // Act & Assert
      await expect(getPRData(TEST_REPO, 42, TEST_TOKEN)).rejects.toThrow(GitHubApiError);
    });

    it('should reject response without head property', async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce(
        makeSuccessResponse({ number: 1, title: 'test', base: { ref: 'y' }, html_url: 'http://x' }),
      );

      // Act & Assert
      await expect(getPRData(TEST_REPO, 42, TEST_TOKEN)).rejects.toThrow(GitHubApiError);
    });

    it('should reject response without html_url property', async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce(
        makeSuccessResponse({ number: 1, title: 'test', head: { ref: 'x' }, base: { ref: 'y' } }),
      );

      // Act & Assert
      await expect(getPRData(TEST_REPO, 42, TEST_TOKEN)).rejects.toThrow(GitHubApiError);
    });
  });
});
