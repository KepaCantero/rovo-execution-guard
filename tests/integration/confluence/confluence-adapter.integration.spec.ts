/**
 * Confluence Adapter Integration Tests
 *
 * Tests the Confluence adapter's public contract using mocked @forge/api.
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
const mockRequestConfluence = jest.fn();
jest.mock('@forge/api', () => ({
  requestJira: jest.fn(),
  requestConfluence: mockRequestConfluence,
  fetch: jest.fn(),
  route: jest.fn((template: TemplateStringsArray, ...values: readonly string[]) => ({
    value: template.reduce(
      (acc: string, str: string, i: number) => acc + str + (values[i] ?? ''),
      '',
    ),
  })),
}));

// Import after mock setup
import { okResponse, notFoundResponse, rateLimitedResponse } from '../../mocks/forge-api';
import {
  searchPages,
  getPageContent,
  getPageMetadata,
  getSpacePages,
} from '../../../src/backend/services/confluence/confluence-adapter';
import {
  ConfluenceApiError,
  PageNotFoundError,
  SpaceNotFoundError,
  TimeoutError,
} from '../../../src/backend/types/errors';
import type {
  ConfluencePageData,
  ConfluencePageMetadata,
} from '../../../src/backend/types/confluence-data';

// ═══════════════════════════════════════════
// FIXTURE LOADING
// ═══════════════════════════════════════════

const fixturesDir = path.resolve(__dirname, '..', 'fixtures');

function loadFixture<T>(filename: string): T {
  const filePath = path.join(fixturesDir, filename);
  const raw = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(raw) as T;
}

interface FixtureConfluenceResult {
  readonly id: string;
  readonly title: string;
  readonly space: { readonly key: string };
  readonly _links: { readonly webui: string };
  readonly version: { readonly when: string };
}

interface FixtureConfluenceSearchResponse {
  readonly results: readonly FixtureConfluenceResult[];
}

const confluencePagesFixture: FixtureConfluenceSearchResponse =
  loadFixture<FixtureConfluenceSearchResponse>('confluence-pages.json');

// ═══════════════════════════════════════════
// TEST SUITE
// ═══════════════════════════════════════════

describe('Confluence Adapter Integration', () => {
  // [TEST-QA-204] Mandatory cleanup
  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─── searchPages() ─────────────────────

  describe('searchPages()', () => {
    // AC-01: Returns mapped ConfluencePageData[] from CQL search

    it('should return mapped pages from search results (AC-01)', async () => {
      // Arrange
      mockRequestConfluence.mockResolvedValueOnce(okResponse(confluencePagesFixture));

      // Act
      const results: ConfluencePageData[] = await searchPages('authentication');

      // Assert
      expect(results.length).toBe(4);
      const first: ConfluencePageData = results[0] as ConfluencePageData;
      expect(first.id).toBe('1234567890');
      expect(first.title).toBe('Authentication Architecture Decision Record');
      expect(first.spaceKey).toBe('ENG');
      expect(first.url).toBe('/display/ENG/Authentication+Architecture+Decision+Record');
      expect(first.lastUpdated).toBe('2024-11-20T10:15:00.000+0000');
      // searchPages returns content as '' (not expanded in search)
      expect(first.content).toBe('');
    });

    // AC-02: No results returns empty array

    it('should return empty array when no pages match (AC-02)', async () => {
      // Arrange
      mockRequestConfluence.mockResolvedValueOnce(okResponse({ results: [] }));

      // Act
      const results: ConfluencePageData[] = await searchPages('nonexistent');

      // Assert
      expect(results).toEqual([]);
    });

    // AC-03: Invalid response throws ConfluenceApiError [TEST-QA-0853]

    it('should throw ConfluenceApiError for invalid response [TEST-QA-0853]', async () => {
      // Arrange
      mockRequestConfluence.mockResolvedValueOnce(okResponse({ foo: 'bar' }));

      // Act
      const error = await searchPages('test').catch((err: unknown) => err as Error);

      // Assert
      expect(error).toBeInstanceOf(ConfluenceApiError);
      expect((error as ConfluenceApiError).code).toBe('CONFLUENCE_INVALID_RESPONSE');
    });

    // AC-04: Rate limiting (429) retries and succeeds [TEST-QA-0853]

    it('should retry on 429 and succeed on second attempt (AC-04)', async () => {
      // Arrange
      mockRequestConfluence
        .mockResolvedValueOnce(rateLimitedResponse(1))
        .mockResolvedValueOnce(okResponse(confluencePagesFixture));

      jest.useFakeTimers();

      // Act
      const promise = searchPages('auth');
      await jest.advanceTimersByTimeAsync(1000);
      const result = await promise;

      // Assert
      expect(result.length).toBe(4);
      expect(mockRequestConfluence).toHaveBeenCalledTimes(2);

      jest.useRealTimers();
    });
  });

  // ─── getPageContent() ──────────────────

  describe('getPageContent()', () => {
    // AC-05: Returns plain text extracted from HTML storage format

    it('should return plain text from storage format HTML (AC-05)', async () => {
      // Arrange
      const pageResponse = {
        id: '1234567890',
        title: 'Auth Page',
        body: {
          storage: {
            value: '<p>This is the <strong>page</strong> content.</p>',
          },
        },
      };
      mockRequestConfluence.mockResolvedValueOnce(okResponse(pageResponse));

      // Act
      const content: string = await getPageContent('1234567890');

      // Assert — HTML tags stripped, plain text returned
      expect(content).toContain('page content');
      expect(content).not.toContain('<strong>');
    });

    // AC-06: 404 throws PageNotFoundError [ARCH-SOLID-053]

    it('should throw PageNotFoundError for 404 response (AC-06)', async () => {
      // Arrange
      mockRequestConfluence.mockResolvedValueOnce(notFoundResponse('Page not found'));

      // Act
      const error = await getPageContent('99999').catch((err: unknown) => err as Error);

      // Assert
      expect(error).toBeInstanceOf(PageNotFoundError);
      expect((error as PageNotFoundError).code).toBe('CONFLUENCE_PAGE_NOT_FOUND');
    });

    // AC-07: Timeout throws TimeoutError [TEST-QA-0853]

    it('should throw TimeoutError when request is aborted (AC-07)', async () => {
      // Arrange
      const abortError = new Error('The operation was aborted');
      abortError.name = 'AbortError';
      mockRequestConfluence.mockRejectedValueOnce(abortError);

      // Act
      const error = await getPageContent('1234567890').catch((err: unknown) => err as Error);

      // Assert
      expect(error).toBeInstanceOf(TimeoutError);
      expect((error as TimeoutError).code).toBe('CONFLUENCE_TIMEOUT');
    });
  });

  // ─── getPageMetadata() ─────────────────

  describe('getPageMetadata()', () => {
    // AC-08: Returns labels, version, space from metadata

    it('should return metadata with labels, version, space (AC-08)', async () => {
      // Arrange
      const metadataResponse = {
        id: '1234567890',
        title: 'Auth Page',
        space: { key: 'ENG' },
        metadata: {
          labels: {
            results: [{ name: 'security' }, { name: 'oauth' }],
          },
        },
        version: { number: 5, when: '2025-01-10T08:00:00.000+0000' },
      };
      mockRequestConfluence.mockResolvedValueOnce(okResponse(metadataResponse));

      // Act
      const meta: ConfluencePageMetadata = await getPageMetadata('1234567890');

      // Assert
      expect(meta.id).toBe('1234567890');
      expect(meta.title).toBe('Auth Page');
      expect(meta.spaceKey).toBe('ENG');
      expect(meta.labels).toEqual(['security', 'oauth']);
      expect(meta.version).toBe(5);
      expect(meta.lastUpdated).toBe('2025-01-10T08:00:00.000+0000');
    });

    // AC-09: 404 throws PageNotFoundError

    it('should throw PageNotFoundError for 404 response (AC-09)', async () => {
      // Arrange
      mockRequestConfluence.mockResolvedValueOnce(notFoundResponse());

      // Act
      const error = await getPageMetadata('99999').catch((err: unknown) => err as Error);

      // Assert
      expect(error).toBeInstanceOf(PageNotFoundError);
    });

    // AC-10: Invalid response throws ConfluenceApiError

    it('should throw ConfluenceApiError for invalid metadata response (AC-10)', async () => {
      // Arrange
      mockRequestConfluence.mockResolvedValueOnce(okResponse({ foo: 'bar' }));

      // Act
      const error = await getPageMetadata('1234567890').catch((err: unknown) => err as Error);

      // Assert
      expect(error).toBeInstanceOf(ConfluenceApiError);
      expect((error as ConfluenceApiError).code).toBe('CONFLUENCE_INVALID_RESPONSE');
    });
  });

  // ─── getSpacePages() ───────────────────

  describe('getSpacePages()', () => {
    // AC-11: Returns pages from a space

    it('should return pages from space listing (AC-11)', async () => {
      // Arrange — same fixture works for content listing too
      mockRequestConfluence.mockResolvedValueOnce(okResponse(confluencePagesFixture));

      // Act
      const results: ConfluencePageData[] = await getSpacePages('ENG');

      // Assert
      expect(results.length).toBe(4);
      expect(results[0]?.spaceKey).toBe('ENG');
    });

    // AC-12: 404 throws SpaceNotFoundError [ARCH-SOLID-053]

    it('should throw SpaceNotFoundError for 404 response (AC-12)', async () => {
      // Arrange
      mockRequestConfluence.mockResolvedValueOnce(notFoundResponse('Space not found'));

      // Act
      const error = await getSpacePages('NONEXISTENT').catch((err: unknown) => err as Error);

      // Assert
      expect(error).toBeInstanceOf(SpaceNotFoundError);
      expect((error as SpaceNotFoundError).code).toBe('CONFLUENCE_SPACE_NOT_FOUND');
    });

    // AC-13: Limit is clamped to 1-100 range

    it('should request with clamped limit (AC-13)', async () => {
      // Arrange
      mockRequestConfluence.mockResolvedValueOnce(okResponse({ results: [] }));

      // Act — pass limit=0, should be clamped to 1
      await getSpacePages('ENG', 0);

      // Assert — verify URL contains limit=1
      const callUrl = (mockRequestConfluence.mock.calls[0]?.[0] as { value: string })?.value ?? '';
      expect(callUrl).toContain('limit=1');
    });
  });
});
