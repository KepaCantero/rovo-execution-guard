/**
 * GitHub Adapter Integration Tests
 *
 * Tests the GitHub adapter's public contract using mocked @forge/api.
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
// GitHub adapter uses `import { fetch as forgeFetch } from '@forge/api'`
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
  rateLimitedResponse,
  type MockAPIResponse,
} from '../../mocks/forge-api';
import {
  createStatusCheck,
  createPRComment,
  getPRData,
  updateStatusCheck,
  listPRFiles,
  extractJiraKeysFromPR,
} from '../../../src/backend/services/github/github-adapter';
import { GitHubApiError, TokenExpiredError, TimeoutError } from '../../../src/backend/types/errors';
import type {
  GitHubPRData,
  GitHubStatusCheck,
  PRFile,
} from '../../../src/backend/types/github-data';

// Must import mocked module AFTER jest.mock setup
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { fetch: mockFetch } = require('@forge/api') as {
  fetch: jest.Mock<Promise<MockAPIResponse>>;
};

// ═══════════════════════════════════════════
// FIXTURE LOADING
// ═══════════════════════════════════════════

// [TEST-QA-058] Use realistic fixture data matching actual GitHub REST API v3 shapes
const fixturesDir = path.resolve(__dirname, '..', 'fixtures');

function loadFixture<T>(filename: string): T {
  const filePath = path.join(fixturesDir, filename);
  const raw = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(raw) as T;
}

interface FixtureGitHubPR {
  readonly number: number;
  readonly title: string;
  readonly body: string;
  readonly state: string;
  readonly head: { readonly ref: string };
  readonly base: { readonly ref: string };
  readonly html_url: string;
}

interface FixtureGitHubPRFile {
  readonly filename: string;
  readonly status: string;
  readonly additions: number;
  readonly deletions: number;
}

interface FixtureGitHubPRFull {
  readonly number: number;
  readonly title: string;
  readonly body: string;
  readonly state: string;
  readonly head: { readonly ref: string };
  readonly base: { readonly ref: string };
  readonly html_url: string;
  readonly files: readonly FixtureGitHubPRFile[];
}

const prFullFixture: FixtureGitHubPRFull = loadFixture<FixtureGitHubPRFull>('github-pr-full.json');

// Extract PR metadata part (without files) for getPRData mock responses
const prMetadata: FixtureGitHubPR = {
  number: prFullFixture.number,
  title: prFullFixture.title,
  body: prFullFixture.body,
  state: prFullFixture.state,
  head: prFullFixture.head,
  base: prFullFixture.base,
  html_url: prFullFixture.html_url,
};

const prFiles: readonly FixtureGitHubPRFile[] = prFullFixture.files;

// ═══════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════

/** GitHub adapter constants — mirrored from source for assertions */
const GITHUB_API_BASE = 'https://api.github.com';

/** Creates a mock response with Link header for pagination. */
function paginatedResponse(body: unknown, linkHeader: string | null): MockAPIResponse {
  return okResponse(body, linkHeader ? { Link: linkHeader } : {});
}

/** Creates a 401 Unauthorized response. */
function unauthorizedResponse(message = 'Bad credentials'): MockAPIResponse {
  return {
    json: async (): Promise<unknown> => ({ message }),
    text: async (): Promise<string> => JSON.stringify({ message }),
    arrayBuffer: async (): Promise<ArrayBuffer> =>
      new TextEncoder().encode(JSON.stringify({ message })).buffer,
    ok: false,
    status: 401,
    statusText: 'Unauthorized',
    headers: {
      get: (_name: string): string | null => null,
      has: (_name: string): boolean => false,
      forEach: () => {},
    },
  };
}

/** Creates a minimal GitHubPRData for extractJiraKeysFromPR tests. */
function makePRData(overrides: Partial<GitHubPRData> = {}): GitHubPRData {
  return {
    number: 42,
    title: 'feat: implement OAuth 2.0 PKCE authentication flow',
    body: '## Summary\nImplements the OAuth 2.0 authorization code flow with PKCE.\n\nRelated: PROJ-1234',
    state: 'open',
    branch: 'feature/oauth2-pkce',
    baseBranch: 'main',
    files: [],
    url: 'https://github.com/acme-org/rovo-execution-guard/pull/42',
    ...overrides,
  };
}

// ═══════════════════════════════════════════
// TEST SUITE
// ═══════════════════════════════════════════

describe('GitHub Adapter Integration', () => {
  // [TEST-QA-204] Mandatory cleanup
  afterEach(() => {
    jest.resetAllMocks();
  });

  // ─── createStatusCheck() ──────────────

  describe('createStatusCheck()', () => {
    // AC-01: Happy path — POST to correct URL with body

    it('should create status check with POST to correct URL (AC-01)', async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce(okResponse({ id: 1 }));
      const params: GitHubStatusCheck = {
        state: 'success',
        targetUrl: 'https://rovo.example.com/check/123',
        description: 'All quality checks passed',
        context: 'rovo-execution-guard/consistency',
      };

      // Act
      await createStatusCheck(params, 'acme/repo', 'abc123', 'ghp_token');

      // Assert
      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, options] = mockFetch.mock.calls[0] as [string, Record<string, unknown>];
      expect(url).toBe(`${GITHUB_API_BASE}/repos/acme/repo/statuses/abc123`);
      expect(options.method).toBe('POST');
      const parsedBody = JSON.parse(options.body as string) as Record<string, unknown>;
      expect(parsedBody.state).toBe('success');
      expect(parsedBody.target_url).toBe('https://rovo.example.com/check/123');
      expect(parsedBody.description).toBe('All quality checks passed');
      expect(parsedBody.context).toBe('rovo-execution-guard/consistency');
    });

    // AC-02: Default context when not provided [GH-INTEG-305]

    it('should use default context when not provided (AC-02)', async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce(okResponse({ id: 2 }));
      const params: GitHubStatusCheck = {
        state: 'pending',
        targetUrl: 'https://rovo.example.com/check/456',
        description: 'Checking...',
        context: '', // empty string is falsy → adapter uses default
      };

      // Act
      await createStatusCheck(params, 'acme/repo', 'def456', 'ghp_token');

      // Assert
      const [, options] = mockFetch.mock.calls[0] as [string, Record<string, unknown>];
      const parsedBody = JSON.parse(options.body as string) as Record<string, unknown>;
      // [GH-INTEG-305] Default context is 'rovo-execution-guard/consistency'
      expect(parsedBody.context).toBe('rovo-execution-guard/consistency');
    });
  });

  // ─── createPRComment() ────────────────

  describe('createPRComment()', () => {
    // AC-03: Happy path — POST body contains comment text

    it('should create PR comment with POST body containing comment (AC-03)', async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce(okResponse({ id: 100 }));
      const commentBody = '**Quality Gate**: All checks passed. Score: 92/100';

      // Act
      await createPRComment('acme/repo', 42, commentBody, 'ghp_token');

      // Assert
      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, options] = mockFetch.mock.calls[0] as [string, Record<string, unknown>];
      expect(url).toBe(`${GITHUB_API_BASE}/repos/acme/repo/issues/42/comments`);
      expect(options.method).toBe('POST');
      const parsedBody = JSON.parse(options.body as string) as { body: string };
      expect(parsedBody.body).toBe(commentBody);
    });
  });

  // ─── getPRData() ──────────────────────

  describe('getPRData()', () => {
    // AC-04: Full happy path — returns mapped GitHubPRData with files

    it('should return mapped GitHubPRData with files from fixture (AC-04)', async () => {
      // Arrange — getPRData makes two calls: 1) GET PR metadata, 2) GET PR files (via listPRFiles)
      mockFetch
        .mockResolvedValueOnce(okResponse(prMetadata))
        .mockResolvedValueOnce(paginatedResponse(prFiles, null)); // files, no pagination

      // Act
      const result: GitHubPRData = await getPRData('acme/repo', 42, 'ghp_token');

      // Assert
      expect(result.number).toBe(42);
      expect(result.title).toBe('feat: implement OAuth 2.0 PKCE authentication flow');
      expect(result.state).toBe('open');
      expect(result.branch).toBe('feature/oauth2-pkce');
      expect(result.baseBranch).toBe('main');
      expect(result.url).toBe('https://github.com/acme-org/rovo-execution-guard/pull/42');
      expect(result.files.length).toBe(5);
      // Verify first file mapped correctly
      const firstFile: PRFile | undefined = result.files[0];
      expect(firstFile?.filename).toBe('src/backend/services/auth/oauth-client.ts');
      expect(firstFile?.status).toBe('added');
      expect(firstFile?.additions).toBe(145);
      expect(firstFile?.deletions).toBe(0);
    });

    // AC-05: 404 not found error [GH-INTEG-304] [ARCH-SOLID-053]

    it('should throw GitHubApiError (GITHUB_NOT_FOUND) on 404 response (AC-05)', async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce(notFoundResponse('PR Not Found'));

      // Act
      const error = await getPRData('acme/repo', 999, 'ghp_token').catch(
        (err: unknown) => err as Error,
      );

      // Assert
      expect(error).toBeInstanceOf(GitHubApiError);
      expect((error as GitHubApiError).code).toBe('GITHUB_NOT_FOUND');
    });
  });

  // ─── updateStatusCheck() ──────────────

  describe('updateStatusCheck()', () => {
    // AC-11: Partial update sends only provided fields

    it('should send only provided fields in partial update (AC-11)', async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce(okResponse({ id: 3 }));

      // Act — only updating state, no other fields
      await updateStatusCheck(
        'check-123',
        { state: 'success' },
        'acme/repo',
        'abc123',
        'ghp_token',
      );

      // Assert
      const [url, options] = mockFetch.mock.calls[0] as [string, Record<string, unknown>];
      expect(url).toBe(`${GITHUB_API_BASE}/repos/acme/repo/statuses/abc123`);
      expect(options.method).toBe('POST');
      const parsedBody = JSON.parse(options.body as string) as Record<string, unknown>;
      expect(parsedBody.state).toBe('success');
      expect(parsedBody).not.toHaveProperty('target_url');
      expect(parsedBody).not.toHaveProperty('description');
      expect(parsedBody).not.toHaveProperty('context');
    });
  });

  // ─── listPRFiles() ────────────────────

  describe('listPRFiles()', () => {
    // AC-12: Follows Link header pagination [GH-INTEG-301]

    it('should follow Link header pagination to collect all files (AC-12)', async () => {
      // Arrange — page 1 with Link header, page 2 without
      const page1: FixtureGitHubPRFile[] = prFiles.slice(0, 3);
      const page2: FixtureGitHubPRFile[] = prFiles.slice(3);
      const nextUrl = `${GITHUB_API_BASE}/repos/acme/repo/pulls/42/files?page=2&per_page=3`;

      mockFetch
        .mockResolvedValueOnce(paginatedResponse(page1, `<${nextUrl}>; rel="next"`))
        .mockResolvedValueOnce(paginatedResponse(page2, null));

      // Act
      const result: PRFile[] = await listPRFiles('acme/repo', 42, 'ghp_token');

      // Assert
      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(result.length).toBe(5);
      expect(result[0]?.filename).toBe('src/backend/services/auth/oauth-client.ts');
      expect(result[3]?.filename).toBe('src/backend/types/auth.ts');
    });
  });

  // ─── extractJiraKeysFromPR() ───────────

  describe('extractJiraKeysFromPR()', () => {
    // AC-06: Extracts keys from title and body

    it('should extract Jira keys from PR title and body (AC-06)', () => {
      // Arrange
      const pr: GitHubPRData = makePRData({
        title: 'feat: PROJ-100 implement auth for PROJ-200',
        body: 'Related to PROJ-300 and PROJ-100 again',
      });

      // Act
      const keys: string[] = extractJiraKeysFromPR(pr);

      // Assert
      expect(keys).toContain('PROJ-100');
      expect(keys).toContain('PROJ-200');
      expect(keys).toContain('PROJ-300');
    });

    // AC-07: Deduplicates and preserves order

    it('should deduplicate keys while preserving first occurrence order (AC-07)', () => {
      // Arrange
      const pr: GitHubPRData = makePRData({
        title: 'PROJ-100 PROJ-200 PROJ-100',
        body: 'PROJ-300 PROJ-200',
      });

      // Act
      const keys: string[] = extractJiraKeysFromPR(pr);

      // Assert
      expect(keys).toEqual(['PROJ-100', 'PROJ-200', 'PROJ-300']);
    });

    // Edge case: no keys found

    it('should return empty array when no Jira keys found', () => {
      // Arrange
      const pr: GitHubPRData = makePRData({
        title: 'feat: no ticket reference here',
        body: 'Just a regular PR description',
      });

      // Act
      const keys: string[] = extractJiraKeysFromPR(pr);

      // Assert
      expect(keys).toEqual([]);
    });
  });

  // ─── Error Classification ─────────────
  // [GH-INTEG-304] Error classification by status code
  // [ARCH-SOLID-053] Domain-specific error types

  describe('Error Classification', () => {
    // AC-08: 401 → TokenExpiredError (GITHUB_TOKEN_EXPIRED)

    it('should throw TokenExpiredError on 401 response (AC-08)', async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce(unauthorizedResponse());

      // Act
      const error = await createStatusCheck(
        { state: 'success', targetUrl: '', description: '', context: '' },
        'acme/repo',
        'abc123',
        'expired_token',
      ).catch((err: unknown) => err as Error);

      // Assert
      expect(error).toBeInstanceOf(TokenExpiredError);
      expect((error as TokenExpiredError).code).toBe('GITHUB_TOKEN_EXPIRED');
    });
  });

  // ─── Rate Limiting (429 retry) ─────────
  // [TEST-QA-0853] Chaos: rate limiting scenarios

  describe('Rate Limiting', () => {
    // AC-09: 429 then 200 — adapter retries and succeeds

    it('should retry on 429 and succeed on second attempt (AC-09)', async () => {
      // Arrange
      mockFetch
        .mockResolvedValueOnce(rateLimitedResponse(1))
        .mockResolvedValueOnce(okResponse({ id: 10 }));

      // Use fake timers to avoid actual sleep in retry logic
      jest.useFakeTimers();

      // Act — start the call
      const promise = createStatusCheck(
        { state: 'success', targetUrl: '', description: '', context: '' },
        'acme/repo',
        'abc123',
        'ghp_token',
      );

      // Fast-forward through the sleep delay
      // DEFAULT_RETRY_CONFIG: baseDelayMs=1000, delay = min(1000 * 4^0, 16000) = 1000
      await jest.advanceTimersByTimeAsync(2000);

      // Assert
      await promise;
      expect(mockFetch).toHaveBeenCalledTimes(2);

      jest.useRealTimers();
    });
  });

  // ─── Timeout ───────────────────────────
  // [TEST-QA-0853] Chaos: abort/timeout behavior

  describe('Timeout', () => {
    // AC-10: AbortError → TimeoutError (GITHUB_TIMEOUT) [ARCH-SOLID-053]

    it('should throw TimeoutError when request is aborted (AC-10)', async () => {
      // Arrange — simulate abort by throwing an Error with name 'AbortError'
      const abortError = new Error('The operation was aborted');
      abortError.name = 'AbortError';
      mockFetch.mockRejectedValueOnce(abortError);

      // Act
      const error = await createStatusCheck(
        { state: 'success', targetUrl: '', description: '', context: '' },
        'acme/repo',
        'abc123',
        'ghp_token',
      ).catch((err: unknown) => err as Error);

      // Assert
      expect(error).toBeInstanceOf(TimeoutError);
      expect((error as TimeoutError).code).toBe('GITHUB_TIMEOUT');
    });
  });
});
