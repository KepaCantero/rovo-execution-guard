// Test suite for the Confluence API Adapter
// Covers: searchPages, getPageContent, getPageMetadata, getSpacePages
// Pattern: Arrange-Act-Assert (AAA), TDD cycle: RED -> GREEN -> REFACTOR
// [TEST-QA-001]
// [TEST-QA-0764] Mock @forge/api requestConfluence entirely — no real HTTP calls
// [TEST-QA-0833] Unit tests with mocked @forge/api

// ═══════════════════════════════════════════
// MOCKS — must come before imports that depend on @forge/api
// ═══════════════════════════════════════════

jest.mock('@forge/api', () => ({
  requestConfluence: jest.fn(),
  route: jest.fn((strings: TemplateStringsArray, ...values: string[]) =>
    strings.reduce((acc: string, str: string, i: number) => acc + str + (values[i] ?? ''), ''),
  ),
}));

import {
  searchPages,
  getPageContent,
  getPageMetadata,
  getSpacePages,
} from '../../../../src/backend/services/confluence/confluence-adapter';
import {
  ConfluenceApiError,
  PageNotFoundError,
  SpaceNotFoundError,
  TimeoutError,
} from '../../../../src/backend/types/errors';
import type {
  ConfluencePageData,
  ConfluencePageMetadata,
} from '../../../../src/backend/types/confluence-data';

import { requestConfluence } from '@forge/api';
import type { APIResponse } from '@forge/api';

const mockRequestConfluence = jest.mocked(requestConfluence);

// ═══════════════════════════════════════════
// FIXTURES
// ═══════════════════════════════════════════

/** Creates a mock Forge APIResponse for Confluence */
const makeResponse = (options: {
  ok?: boolean;
  status?: number;
  statusText?: string;
  json?: () => Promise<unknown>;
  text?: () => Promise<string>;
  headers?: Record<string, string>;
}): APIResponse =>
  ({
    ok: options.ok ?? true,
    status: options.status ?? 200,
    statusText: options.statusText ?? 'OK',
    json: options.json ?? (async () => ({})),
    text: options.text ?? (async () => ''),
    headers: {
      get: (name: string) => options.headers?.[name] ?? null,
    },
    arrayBuffer: async () => new ArrayBuffer(0),
  }) as unknown as APIResponse;

/** Creates a successful response with JSON body */
const makeSuccessResponse = (data: unknown): APIResponse =>
  makeResponse({
    ok: true,
    status: 200,
    json: async () => data,
  });

/** Creates an error response */
const makeErrorResponse = (status: number): APIResponse =>
  makeResponse({
    ok: false,
    status,
  });

/** Creates a 429 rate-limited response */
const makeRateLimitedResponse = (): APIResponse =>
  makeResponse({
    ok: false,
    status: 429,
  });

/** Creates a Confluence content search result */
const makeContentResult = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  id: '12345',
  title: 'Test Page',
  space: { key: 'ENG' },
  _links: { webui: '/spaces/ENG/pages/12345' },
  version: { when: '2026-04-01T10:00:00.000Z' },
  ...overrides,
});

/** Creates a Confluence page with body.storage content */
const makePageWithBody = (
  bodyValue: string,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> => ({
  id: '12345',
  title: 'Documentation Page',
  space: { key: 'ENG' },
  body: {
    storage: { value: bodyValue },
  },
  ...overrides,
});

/** Creates a Confluence page with metadata */
const makePageWithMetadata = (
  overrides: Record<string, unknown> = {},
): Record<string, unknown> => ({
  id: '67890',
  title: 'Architecture Decision Record',
  space: { key: 'ARCH' },
  version: { when: '2026-03-15T08:30:00.000Z', number: 5 },
  metadata: {
    labels: {
      results: [{ name: 'architecture' }, { name: 'decision' }],
    },
  },
  ...overrides,
});

// ═══════════════════════════════════════════
// TEST SUITE
// ═══════════════════════════════════════════

describe('confluence-adapter', () => {
  let consoleLogSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    jest.useRealTimers();
  });

  // ─── searchPages() ──────────────────────

  describe('searchPages()', () => {
    it('should search pages with valid query', async () => {
      // Arrange
      const searchResult = makeContentResult();
      mockRequestConfluence.mockResolvedValue(makeSuccessResponse({ results: [searchResult] }));

      // Act
      const result: ConfluencePageData[] = await searchPages(
        'authentication',
        undefined,
        'exec-001',
      );

      // Assert
      expect(result).toHaveLength(1);
      const first = result[0] as ConfluencePageData;
      expect(first.id).toBe('12345');
      expect(first.title).toBe('Test Page');
      expect(first.spaceKey).toBe('ENG');
    });

    it('should search pages filtered by space keys', async () => {
      // Arrange
      mockRequestConfluence.mockResolvedValue(makeSuccessResponse({ results: [] }));

      // Act
      await searchPages('oauth', ['ENG', 'ARCH'], 'exec-002');

      // Assert — verify URL contains CQL with space filter
      expect(mockRequestConfluence).toHaveBeenCalledTimes(1);
      const [callArgs] = mockRequestConfluence.mock.calls;
      const callUrl = String(callArgs?.[0] ?? '');
      expect(callUrl).toContain('space%20in%20(ENG%2CARCH)');
    });

    it('should handle empty search results', async () => {
      // Arrange
      mockRequestConfluence.mockResolvedValue(makeSuccessResponse({ results: [] }));

      // Act
      const result = await searchPages('nonexistent-topic');

      // Assert
      expect(result).toHaveLength(0);
    });

    it('should throw ConfluenceApiError on HTTP 500', async () => {
      // Arrange
      mockRequestConfluence.mockResolvedValue(makeErrorResponse(500));

      // Act & Assert
      await expect(searchPages('test', undefined, 'exec-003')).rejects.toThrow(ConfluenceApiError);
    });

    it('should include executionId in log entries', async () => {
      // Arrange
      mockRequestConfluence.mockResolvedValue(makeSuccessResponse({ results: [] }));

      // Act
      await searchPages('test', undefined, 'exec-log');

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
      expect(infoLogs.length).toBeGreaterThan(0);
      expect(infoLogs.some((log: Record<string, unknown>) => log.executionId === 'exec-log')).toBe(
        true,
      );
    });

    it('should throw ConfluenceApiError for invalid response structure', async () => {
      // Arrange — response missing 'results' array
      mockRequestConfluence.mockResolvedValue(makeSuccessResponse({ foo: 'bar' }));

      // Act & Assert
      await expect(searchPages('test')).rejects.toThrow(ConfluenceApiError);
    });

    it('should use requestConfluence for API calls', async () => {
      // Arrange
      mockRequestConfluence.mockResolvedValue(makeSuccessResponse({ results: [] }));

      // Act
      await searchPages('test');

      // Assert
      expect(mockRequestConfluence).toHaveBeenCalledTimes(1);
    });
  });

  // ─── getPageContent() ───────────────────

  describe('getPageContent()', () => {
    it('should extract plain text from HTML storage format', async () => {
      // Arrange
      const htmlContent = '<p>This is a <strong>test</strong> page.</p><p>Second paragraph.</p>';
      mockRequestConfluence.mockResolvedValue(makeSuccessResponse(makePageWithBody(htmlContent)));

      // Act
      const result = await getPageContent('12345', 'exec-010');

      // Assert
      expect(result).toContain('This is a test page.');
      expect(result).toContain('Second paragraph.');
      expect(result).not.toContain('<p>');
      expect(result).not.toContain('<strong>');
    });

    it('should handle BR tags as newlines', async () => {
      // Arrange
      const htmlContent = 'Line one<br/>Line two<br />Line three';
      mockRequestConfluence.mockResolvedValue(makeSuccessResponse(makePageWithBody(htmlContent)));

      // Act
      const result = await getPageContent('12345');

      // Assert
      expect(result).toContain('Line one\nLine two\nLine three');
    });

    it('should decode HTML entities', async () => {
      // Arrange
      const htmlContent = '<p>Use &amp; for ampersand &amp; &lt; for less than</p>';
      mockRequestConfluence.mockResolvedValue(makeSuccessResponse(makePageWithBody(htmlContent)));

      // Act
      const result = await getPageContent('12345');

      // Assert
      expect(result).toContain('Use & for ampersand & < for less than');
    });

    it('should throw PageNotFoundError on HTTP 404', async () => {
      // Arrange
      mockRequestConfluence.mockResolvedValue(makeErrorResponse(404));

      // Act & Assert
      await expect(getPageContent('missing-page', 'exec-011')).rejects.toThrow(PageNotFoundError);
    });

    it('should throw ConfluenceApiError on HTTP 500', async () => {
      // Arrange
      mockRequestConfluence.mockResolvedValue(makeErrorResponse(500));

      // Act & Assert
      await expect(getPageContent('12345')).rejects.toThrow(ConfluenceApiError);
    });

    it('should throw ConfluenceApiError for invalid response structure', async () => {
      // Arrange — response missing 'body'
      mockRequestConfluence.mockResolvedValue(makeSuccessResponse({ id: '12345', title: 'Test' }));

      // Act & Assert
      await expect(getPageContent('12345')).rejects.toThrow(ConfluenceApiError);
    });

    it('should return empty string when body has no storage value', async () => {
      // Arrange — body exists but storage.value is missing
      mockRequestConfluence.mockResolvedValue(
        makeSuccessResponse({ id: '12345', title: 'Test', body: {} }),
      );

      // Act
      const result = await getPageContent('12345');

      // Assert
      expect(result).toBe('');
    });

    it('should fall back to view value when storage is not available', async () => {
      // Arrange — body has view but not storage
      mockRequestConfluence.mockResolvedValue(
        makeSuccessResponse({
          id: '12345',
          title: 'Test',
          body: { view: { value: '<p>Fallback content</p>' } },
        }),
      );

      // Act
      const result = await getPageContent('12345');

      // Assert
      expect(result).toContain('Fallback content');
    });

    it('should include executionId in log entries', async () => {
      // Arrange
      mockRequestConfluence.mockResolvedValue(
        makeSuccessResponse(makePageWithBody('<p>Content</p>')),
      );

      // Act
      await getPageContent('12345', 'exec-content-log');

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
      expect(infoLogs.length).toBeGreaterThan(0);
      expect(
        infoLogs.some((log: Record<string, unknown>) => log.executionId === 'exec-content-log'),
      ).toBe(true);
    });
  });

  // ─── getPageMetadata() ──────────────────

  describe('getPageMetadata()', () => {
    it('should return page metadata for valid page ID', async () => {
      // Arrange
      mockRequestConfluence.mockResolvedValue(makeSuccessResponse(makePageWithMetadata()));

      // Act
      const result: ConfluencePageMetadata = await getPageMetadata('67890', 'exec-020');

      // Assert
      expect(result.id).toBe('67890');
      expect(result.title).toBe('Architecture Decision Record');
      expect(result.spaceKey).toBe('ARCH');
      expect(result.labels).toEqual(['architecture', 'decision']);
      expect(result.version).toBe(5);
      expect(result.lastUpdated).toBe('2026-03-15T08:30:00.000Z');
    });

    it('should handle page with no labels', async () => {
      // Arrange
      mockRequestConfluence.mockResolvedValue(
        makeSuccessResponse({
          id: '11111',
          title: 'No Labels Page',
          space: { key: 'DEV' },
          version: { when: '2026-02-01T00:00:00.000Z', number: 1 },
          metadata: {},
        }),
      );

      // Act
      const result = await getPageMetadata('11111');

      // Assert
      expect(result.labels).toEqual([]);
    });

    it('should handle page with no space', async () => {
      // Arrange
      mockRequestConfluence.mockResolvedValue(
        makeSuccessResponse({
          id: '22222',
          title: 'Orphan Page',
          version: { when: '2026-01-01T00:00:00.000Z', number: 2 },
        }),
      );

      // Act
      const result = await getPageMetadata('22222');

      // Assert
      expect(result.spaceKey).toBe('');
    });

    it('should handle page with no version info', async () => {
      // Arrange
      mockRequestConfluence.mockResolvedValue(
        makeSuccessResponse({
          id: '33333',
          title: 'No Version Page',
          space: { key: 'TEST' },
        }),
      );

      // Act
      const result = await getPageMetadata('33333');

      // Assert
      expect(result.version).toBe(1);
      expect(result.lastUpdated).toBe('');
    });

    it('should throw PageNotFoundError on HTTP 404', async () => {
      // Arrange
      mockRequestConfluence.mockResolvedValue(makeErrorResponse(404));

      // Act & Assert
      await expect(getPageMetadata('missing-page', 'exec-021')).rejects.toThrow(PageNotFoundError);
    });

    it('should throw ConfluenceApiError on HTTP 500', async () => {
      // Arrange
      mockRequestConfluence.mockResolvedValue(makeErrorResponse(500));

      // Act & Assert
      await expect(getPageMetadata('67890')).rejects.toThrow(ConfluenceApiError);
    });

    it('should throw ConfluenceApiError for invalid response structure', async () => {
      // Arrange — response missing 'title'
      mockRequestConfluence.mockResolvedValue(makeSuccessResponse({ id: 123 }));

      // Act & Assert
      await expect(getPageMetadata('67890')).rejects.toThrow(ConfluenceApiError);
    });

    it('should request only metadata expand fields', async () => {
      // Arrange
      mockRequestConfluence.mockResolvedValue(makeSuccessResponse(makePageWithMetadata()));

      // Act
      await getPageMetadata('67890');

      // Assert — [ARCH-SOLID-003] [SEC-PRIV-008] data minimization
      expect(mockRequestConfluence).toHaveBeenCalledTimes(1);
      const callUrl = String(mockRequestConfluence.mock.calls[0]?.[0] ?? '');
      expect(callUrl).toContain('expand=metadata.labels,version,space');
    });

    it('should include executionId in log entries', async () => {
      // Arrange
      mockRequestConfluence.mockResolvedValue(makeSuccessResponse(makePageWithMetadata()));

      // Act
      await getPageMetadata('67890', 'exec-meta-log');

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
      expect(infoLogs.length).toBeGreaterThan(0);
      expect(
        infoLogs.some((log: Record<string, unknown>) => log.executionId === 'exec-meta-log'),
      ).toBe(true);
    });
  });

  // ─── getSpacePages() ────────────────────

  describe('getSpacePages()', () => {
    it('should return pages from a specific space', async () => {
      // Arrange
      const page1 = makeContentResult({ id: '1', title: 'Page 1' });
      const page2 = makeContentResult({ id: '2', title: 'Page 2' });
      mockRequestConfluence.mockResolvedValue(makeSuccessResponse({ results: [page1, page2] }));

      // Act
      const result: ConfluencePageData[] = await getSpacePages('ENG', 25, 'exec-030');

      // Assert
      expect(result).toHaveLength(2);
      const first = result[0] as ConfluencePageData;
      const second = result[1] as ConfluencePageData;
      expect(first.id).toBe('1');
      expect(second.id).toBe('2');
    });

    it('should throw SpaceNotFoundError on HTTP 404', async () => {
      // Arrange
      mockRequestConfluence.mockResolvedValue(makeErrorResponse(404));

      // Act & Assert
      await expect(getSpacePages('MISSING', 25, 'exec-031')).rejects.toThrow(SpaceNotFoundError);
    });

    it('should throw ConfluenceApiError on HTTP 500', async () => {
      // Arrange
      mockRequestConfluence.mockResolvedValue(makeErrorResponse(500));

      // Act & Assert
      await expect(getSpacePages('ENG')).rejects.toThrow(ConfluenceApiError);
    });

    it('should cap limit at MAX_PAGE_LIMIT (100)', async () => {
      // Arrange
      mockRequestConfluence.mockResolvedValue(makeSuccessResponse({ results: [] }));

      // Act
      await getSpacePages('ENG', 200);

      // Assert
      expect(mockRequestConfluence).toHaveBeenCalledTimes(1);
      const callUrl = String(mockRequestConfluence.mock.calls[0]?.[0] ?? '');
      expect(callUrl).toContain('limit=100');
    });

    it('should enforce minimum limit of 1', async () => {
      // Arrange
      mockRequestConfluence.mockResolvedValue(makeSuccessResponse({ results: [] }));

      // Act
      await getSpacePages('ENG', 0);

      // Assert
      expect(mockRequestConfluence).toHaveBeenCalledTimes(1);
      const callUrl = String(mockRequestConfluence.mock.calls[0]?.[0] ?? '');
      expect(callUrl).toContain('limit=1');
    });

    it('should use default limit of 25 when not specified', async () => {
      // Arrange
      mockRequestConfluence.mockResolvedValue(makeSuccessResponse({ results: [] }));

      // Act
      await getSpacePages('ENG');

      // Assert
      expect(mockRequestConfluence).toHaveBeenCalledTimes(1);
      const callUrl = String(mockRequestConfluence.mock.calls[0]?.[0] ?? '');
      expect(callUrl).toContain('limit=25');
    });

    it('should throw ConfluenceApiError for invalid response structure', async () => {
      // Arrange — response missing 'results'
      mockRequestConfluence.mockResolvedValue(makeSuccessResponse({ pages: [] }));

      // Act & Assert
      await expect(getSpacePages('ENG')).rejects.toThrow(ConfluenceApiError);
    });

    it('should encode space key in URL', async () => {
      // Arrange
      mockRequestConfluence.mockResolvedValue(makeSuccessResponse({ results: [] }));

      // Act
      await getSpacePages('MY SPACE');

      // Assert
      expect(mockRequestConfluence).toHaveBeenCalledTimes(1);
      const callUrl = String(mockRequestConfluence.mock.calls[0]?.[0] ?? '');
      expect(callUrl).toContain('spaceKey=MY%20SPACE');
    });

    it('should include executionId in log entries', async () => {
      // Arrange
      mockRequestConfluence.mockResolvedValue(makeSuccessResponse({ results: [] }));

      // Act
      await getSpacePages('ENG', 25, 'exec-space-log');

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
      expect(infoLogs.length).toBeGreaterThan(0);
      expect(
        infoLogs.some((log: Record<string, unknown>) => log.executionId === 'exec-space-log'),
      ).toBe(true);
    });
  });

  // ─── Rate Limiting (AC-04) ────────────

  describe('rate limiting with exponential backoff (AC-04)', () => {
    it('should retry on HTTP 429 and succeed on second attempt', async () => {
      // Arrange
      const rateLimitedResponse = makeRateLimitedResponse();
      const successResponse = makeSuccessResponse({ results: [] });
      mockRequestConfluence
        .mockResolvedValueOnce(rateLimitedResponse)
        .mockResolvedValueOnce(successResponse);

      // Act
      const result = await searchPages('test', undefined, 'exec-retry');

      // Assert
      expect(mockRequestConfluence).toHaveBeenCalledTimes(2);
      expect(result).toHaveLength(0);
    });

    it('should retry multiple times on consecutive 429 responses', async () => {
      // Arrange — 3 rate-limited responses, then success
      const rateLimited = makeRateLimitedResponse();
      const success = makeSuccessResponse({ results: [] });
      mockRequestConfluence
        .mockResolvedValueOnce(rateLimited)
        .mockResolvedValueOnce(rateLimited)
        .mockResolvedValueOnce(rateLimited)
        .mockResolvedValueOnce(success);

      // Act
      await searchPages('test');

      // Assert
      expect(mockRequestConfluence).toHaveBeenCalledTimes(4);
    });

    it('should exhaust retries and throw ConfluenceApiError after max retries', async () => {
      // Arrange — always 429
      mockRequestConfluence.mockResolvedValue(makeRateLimitedResponse());

      // Act & Assert
      await expect(searchPages('test')).rejects.toThrow(ConfluenceApiError);
      expect(mockRequestConfluence).toHaveBeenCalledTimes(4); // 0,1,2,3
    });

    it('should log warning on retry attempt', async () => {
      // Arrange
      const rateLimited = makeRateLimitedResponse();
      const success = makeSuccessResponse({ results: [] });
      mockRequestConfluence.mockResolvedValueOnce(rateLimited).mockResolvedValueOnce(success);

      // Act
      await searchPages('test', undefined, 'exec-warn');

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
      // Arrange
      const abortError = new DOMException('The operation was aborted', 'AbortError');
      mockRequestConfluence.mockRejectedValue(abortError);

      // Act & Assert
      await expect(searchPages('test', undefined, 'exec-timeout')).rejects.toThrow(TimeoutError);
    });

    it('should throw TimeoutError with timeout duration in message', async () => {
      // Arrange
      const abortError = new DOMException('The operation was aborted', 'AbortError');
      mockRequestConfluence.mockRejectedValue(abortError);

      // Act & Assert
      try {
        await searchPages('test', undefined, 'exec-timeout-msg');
        fail('Expected TimeoutError');
      } catch (error: unknown) {
        expect(error).toBeInstanceOf(TimeoutError);
        const err = error as TimeoutError;
        expect(err.message).toContain('timed out');
        expect(err.message).toContain('10000');
      }
    });

    it('should throw TimeoutError for Error with name AbortError', async () => {
      // Arrange
      const abortLikeError = new Error('Aborted');
      abortLikeError.name = 'AbortError';
      mockRequestConfluence.mockRejectedValue(abortLikeError);

      // Act & Assert
      await expect(searchPages('test')).rejects.toThrow(TimeoutError);
    });
  });

  // ─── Network Error Handling ───────────

  describe('network error handling', () => {
    it('should throw ConfluenceApiError on network error', async () => {
      // Arrange
      mockRequestConfluence.mockRejectedValue(new Error('ECONNREFUSED'));

      // Act & Assert
      await expect(searchPages('test')).rejects.toThrow(ConfluenceApiError);
    });

    it('should include original error message in ConfluenceApiError', async () => {
      // Arrange
      mockRequestConfluence.mockRejectedValue(new Error('Network dropped'));

      // Act & Assert
      try {
        await searchPages('test');
        fail('Expected ConfluenceApiError');
      } catch (error: unknown) {
        expect(error).toBeInstanceOf(ConfluenceApiError);
        const err = error as ConfluenceApiError;
        expect(err.message).toContain('Network dropped');
      }
    });

    it('should handle non-Error rejection', async () => {
      // Arrange — reject with a string
      mockRequestConfluence.mockRejectedValue('connection lost');

      // Act & Assert
      await expect(searchPages('test')).rejects.toThrow(ConfluenceApiError);
    });
  });

  // ─── Structured Logging (AC-06) ───────

  describe('structured logging (AC-06)', () => {
    it('should include executionId in all log entries when provided', async () => {
      // Arrange
      mockRequestConfluence.mockResolvedValue(makeSuccessResponse({ results: [] }));

      // Act
      await searchPages('test', undefined, 'exec-log-test');

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
      mockRequestConfluence.mockResolvedValue(makeSuccessResponse({ results: [] }));

      // Act
      await searchPages('test');

      // Assert — when executionId is undefined, JSON.stringify omits it
      const logCalls = consoleLogSpy.mock.calls.map((call: [string]) => {
        try {
          return JSON.parse(call[0]);
        } catch {
          return null;
        }
      });
      const validLogs = logCalls.filter(
        (log: Record<string, unknown> | null) => log !== null && log.operation === 'searchPages',
      );
      expect(validLogs.length).toBeGreaterThan(0);
      for (const log of validLogs) {
        expect(log).not.toHaveProperty('executionId');
      }
    });

    it('should log operation name and method', async () => {
      // Arrange
      mockRequestConfluence.mockResolvedValue(makeSuccessResponse({ results: [] }));

      // Act
      await searchPages('test', undefined, 'exec-op');

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
      expect(infoLogs.some((log: Record<string, unknown>) => log.operation === 'searchPages')).toBe(
        true,
      );
    });

    it('should log timestamp in ISO 8601 format', async () => {
      // Arrange
      mockRequestConfluence.mockResolvedValue(makeSuccessResponse({ results: [] }));

      // Act
      await searchPages('test');

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

  // ─── Error Code Consistency ────────────

  describe('error code consistency', () => {
    it('should use CONFLUENCE_PAGE_NOT_FOUND code for 404 on getPageContent', async () => {
      // Arrange
      mockRequestConfluence.mockResolvedValue(makeErrorResponse(404));

      // Act & Assert
      try {
        await getPageContent('missing');
        fail('Expected PageNotFoundError');
      } catch (error: unknown) {
        expect(error).toBeInstanceOf(PageNotFoundError);
        expect((error as PageNotFoundError).code).toBe('CONFLUENCE_PAGE_NOT_FOUND');
      }
    });

    it('should use CONFLUENCE_PAGE_NOT_FOUND code for 404 on getPageMetadata', async () => {
      // Arrange
      mockRequestConfluence.mockResolvedValue(makeErrorResponse(404));

      // Act & Assert
      try {
        await getPageMetadata('missing');
        fail('Expected PageNotFoundError');
      } catch (error: unknown) {
        expect(error).toBeInstanceOf(PageNotFoundError);
        expect((error as PageNotFoundError).code).toBe('CONFLUENCE_PAGE_NOT_FOUND');
      }
    });

    it('should use CONFLUENCE_SPACE_NOT_FOUND code for 404 on getSpacePages', async () => {
      // Arrange
      mockRequestConfluence.mockResolvedValue(makeErrorResponse(404));

      // Act & Assert
      try {
        await getSpacePages('MISSING');
        fail('Expected SpaceNotFoundError');
      } catch (error: unknown) {
        expect(error).toBeInstanceOf(SpaceNotFoundError);
        expect((error as SpaceNotFoundError).code).toBe('CONFLUENCE_SPACE_NOT_FOUND');
      }
    });

    it('should use CONFLUENCE_API_ERROR code for 5xx errors', async () => {
      // Arrange
      mockRequestConfluence.mockResolvedValue(makeErrorResponse(500));

      // Act & Assert
      try {
        await searchPages('test');
        fail('Expected ConfluenceApiError');
      } catch (error: unknown) {
        expect(error).toBeInstanceOf(ConfluenceApiError);
        expect((error as ConfluenceApiError).code).toBe('CONFLUENCE_API_ERROR');
      }
    });

    it('should use CONFLUENCE_TIMEOUT code for timeout errors', async () => {
      // Arrange
      mockRequestConfluence.mockRejectedValue(
        new DOMException('The operation was aborted', 'AbortError'),
      );

      // Act & Assert
      try {
        await searchPages('test');
        fail('Expected TimeoutError');
      } catch (error: unknown) {
        expect(error).toBeInstanceOf(TimeoutError);
        expect((error as TimeoutError).code).toBe('CONFLUENCE_TIMEOUT');
      }
    });

    it('should use CONFLUENCE_NETWORK_ERROR code for network errors', async () => {
      // Arrange
      mockRequestConfluence.mockRejectedValue(new Error('ECONNREFUSED'));

      // Act & Assert
      try {
        await searchPages('test');
        fail('Expected ConfluenceApiError');
      } catch (error: unknown) {
        expect(error).toBeInstanceOf(ConfluenceApiError);
        expect((error as ConfluenceApiError).code).toBe('CONFLUENCE_NETWORK_ERROR');
      }
    });
  });

  // ─── Response Validation (SEC-PRIV-004) ──

  describe('response validation (SEC-PRIV-004)', () => {
    it('should reject null response body for searchPages', async () => {
      // Arrange
      mockRequestConfluence.mockResolvedValue(makeSuccessResponse(null));

      // Act & Assert
      await expect(searchPages('test')).rejects.toThrow(ConfluenceApiError);
    });

    it('should reject response where results is not an array', async () => {
      // Arrange
      mockRequestConfluence.mockResolvedValue(makeSuccessResponse({ results: 'not-an-array' }));

      // Act & Assert
      await expect(searchPages('test')).rejects.toThrow(ConfluenceApiError);
    });

    it('should reject metadata response without id', async () => {
      // Arrange
      mockRequestConfluence.mockResolvedValue(makeSuccessResponse({ title: 'No ID' }));

      // Act & Assert
      await expect(getPageMetadata('123')).rejects.toThrow(ConfluenceApiError);
    });

    it('should reject metadata response where id is not a string', async () => {
      // Arrange
      mockRequestConfluence.mockResolvedValue(makeSuccessResponse({ id: 12345, title: 'Test' }));

      // Act & Assert
      await expect(getPageMetadata('123')).rejects.toThrow(ConfluenceApiError);
    });
  });

  // ─── Chaos Tests ───────────────────────

  describe('chaos tests', () => {
    it('should handle empty object response for search', async () => {
      // Arrange
      mockRequestConfluence.mockResolvedValue(makeSuccessResponse({}));

      // Act & Assert
      await expect(searchPages('test')).rejects.toThrow(ConfluenceApiError);
    });

    it('should handle response with extra unexpected fields in search', async () => {
      // Arrange
      const result = makeContentResult();
      mockRequestConfluence.mockResolvedValue(
        makeSuccessResponse({
          results: [result],
          extraField: 'should be ignored',
          _links: { next: '/rest/api/content?start=25' },
        }),
      );

      // Act
      const results = await searchPages('test');

      // Assert — should still parse correctly
      expect(results).toHaveLength(1);
      expect((results[0] as ConfluencePageData).id).toBe('12345');
    });

    it('should handle content result with missing space', async () => {
      // Arrange
      mockRequestConfluence.mockResolvedValue(
        makeSuccessResponse({
          results: [
            { id: '99', title: 'Orphan Page', version: { when: '2026-01-01T00:00:00.000Z' } },
          ],
        }),
      );

      // Act
      const results = await searchPages('test');

      // Assert
      expect((results[0] as ConfluencePageData).spaceKey).toBe('');
      expect((results[0] as ConfluencePageData).url).toBe('');
    });

    it('should handle content result with missing version', async () => {
      // Arrange
      mockRequestConfluence.mockResolvedValue(
        makeSuccessResponse({
          results: [{ id: '99', title: 'No Version Page', space: { key: 'TEST' } }],
        }),
      );

      // Act
      const results = await searchPages('test');

      // Assert
      expect((results[0] as ConfluencePageData).lastUpdated).toBe('');
    });
  });

  // ─── Error Hierarchy (ARCH-SOLID-053) ──

  describe('error hierarchy (ARCH-SOLID-053)', () => {
    it('PageNotFoundError should be instanceof ConfluenceApiError', async () => {
      // Arrange
      mockRequestConfluence.mockResolvedValue(makeErrorResponse(404));

      // Act & Assert
      try {
        await getPageContent('missing');
        fail('Expected PageNotFoundError');
      } catch (error: unknown) {
        expect(error).toBeInstanceOf(PageNotFoundError);
        expect(error).toBeInstanceOf(ConfluenceApiError);
      }
    });

    it('SpaceNotFoundError should be instanceof ConfluenceApiError', async () => {
      // Arrange
      mockRequestConfluence.mockResolvedValue(makeErrorResponse(404));

      // Act & Assert
      try {
        await getSpacePages('MISSING');
        fail('Expected SpaceNotFoundError');
      } catch (error: unknown) {
        expect(error).toBeInstanceOf(SpaceNotFoundError);
        expect(error).toBeInstanceOf(ConfluenceApiError);
      }
    });

    it('ConfluenceApiError should be catchable with instanceof', async () => {
      // Arrange
      mockRequestConfluence.mockResolvedValue(makeErrorResponse(500));

      // Act & Assert
      try {
        await searchPages('test');
        fail('Expected ConfluenceApiError');
      } catch (error: unknown) {
        if (error instanceof PageNotFoundError) {
          fail('Should not be PageNotFoundError');
        }
        if (error instanceof SpaceNotFoundError) {
          fail('Should not be SpaceNotFoundError');
        }
        expect(error).toBeInstanceOf(ConfluenceApiError);
      }
    });
  });

  // ─── CQL Construction (AC-02) ──────────

  describe('CQL construction', () => {
    it('should build CQL with title fuzzy match', async () => {
      // Arrange
      mockRequestConfluence.mockResolvedValue(makeSuccessResponse({ results: [] }));

      // Act
      await searchPages('oauth');

      // Assert
      const callUrl = String(mockRequestConfluence.mock.calls[0]?.[0] ?? '');
      expect(callUrl).toContain('title~');
      expect(callUrl).toContain('oauth');
    });

    it('should include type=page in CQL', async () => {
      // Arrange
      mockRequestConfluence.mockResolvedValue(makeSuccessResponse({ results: [] }));

      // Act
      await searchPages('test');

      // Assert
      const callUrl = String(mockRequestConfluence.mock.calls[0]?.[0] ?? '');
      expect(callUrl).toContain('type%3Dpage');
    });

    it('should URL-encode the CQL query', async () => {
      // Arrange
      mockRequestConfluence.mockResolvedValue(makeSuccessResponse({ results: [] }));

      // Act
      await searchPages('test query');

      // Assert
      const callUrl = String(mockRequestConfluence.mock.calls[0]?.[0] ?? '');
      // The entire CQL should be URL-encoded as a query parameter
      expect(callUrl).toContain('cql=');
    });
  });
});
