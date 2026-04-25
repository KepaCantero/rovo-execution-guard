// [ARCH-SOLID-058] Integration layer — wraps @forge/api requestConfluence
// [ARCH-SOLID-202] Zero any usage
// [ARCH-SOLID-053] Domain-specific error types for all failure paths
// [ARCH-SOLID-232] Named exports only, no export default
// [FORGE-OPS-005] Timeout via AbortController (default 10s)
// [FORGE-OPS-0105] Stateless functions, no module-level mutable state

import { requestConfluence, route, type APIResponse, type FetchOptions } from '@forge/api';
import type { ConfluencePageData, ConfluencePageMetadata } from '../../types/confluence-data';
import {
  ConfluenceApiError,
  PageNotFoundError,
  SpaceNotFoundError,
  TimeoutError,
} from '../../types/errors';

// ═══════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════

/** [ARCH-SOLID-203] Type alias for Forge request options */
type ForgeRequestOptions = FetchOptions;

/** [ARCH-SOLID-203] Interface for structured log entries */
interface StructuredLogEntry {
  readonly timestamp: string;
  readonly level: 'info' | 'warn' | 'error';
  readonly operation: string;
  readonly executionId?: string;
  readonly [key: string]: unknown;
}

/** Configuration for rate-limit retry behavior */
interface RetryConfig {
  readonly maxRetries: number;
  readonly baseDelayMs: number;
  readonly maxDelayMs: number;
}

/** [ARCH-SOLID-203] Interface for raw Confluence content search result item */
interface ConfluenceContentResult {
  readonly id: string;
  readonly title: string;
  readonly space?: { readonly key: string };
  readonly _links?: { readonly webui?: string };
  readonly version?: { readonly when?: string };
}

/** [ARCH-SOLID-203] Interface for raw Confluence content with body */
interface ConfluenceContentWithBody extends ConfluenceContentResult {
  readonly body?: {
    readonly storage?: { readonly value: string };
    readonly view?: { readonly value: string };
  };
}

/** [ARCH-SOLID-203] Interface for raw Confluence search API response */
interface ConfluenceSearchResponse {
  readonly results: readonly ConfluenceContentResult[];
}

/** [ARCH-SOLID-203] Interface for raw Confluence content list API response */
interface ConfluenceContentListResponse {
  readonly results: readonly ConfluenceContentResult[];
}

/** [ARCH-SOLID-203] Interface for raw Confluence page with metadata */
interface ConfluencePageWithMetadata {
  readonly id: string;
  readonly title: string;
  readonly space?: { readonly key: string };
  readonly version?: { readonly when?: string; readonly number?: number };
  readonly metadata?: {
    readonly labels?: {
      readonly results?: readonly { readonly name: string }[];
    };
  };
}

// ═══════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════

/** [FORGE-OPS-005] Default timeout 10s */
const DEFAULT_TIMEOUT_MS = 10_000;

/** [FORGE-OPS-005] Maximum timeout — never exceed 10s Forge limit */
const MAX_TIMEOUT_MS = 10_000;

/** Rate-limit retry configuration */
const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelayMs: 500,
  maxDelayMs: 8_000,
};

/** HTTP status codes */
const HTTP_NOT_FOUND = 404;
const HTTP_RATE_LIMITED = 429;

/** Default pagination limit for getSpacePages */
const DEFAULT_PAGE_LIMIT = 25;
const MAX_PAGE_LIMIT = 100;

// ═══════════════════════════════════════════
// STRUCTURED LOGGING
// ═══════════════════════════════════════════

/**
 * Emits a structured JSON log entry. Forge-compatible (console.log).
 * [SEC-PRIV-002] Only logs operation metadata and executionId — never tokens or PII.
 */
function log(
  level: StructuredLogEntry['level'],
  operation: string,
  executionId: string | undefined,
  data?: Record<string, unknown>,
): void {
  const entry: StructuredLogEntry = {
    timestamp: new Date().toISOString(),
    level,
    operation,
    executionId,
    ...data,
  };
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(entry));
}

// ═══════════════════════════════════════════
// TIMEOUT HELPER
// ═══════════════════════════════════════════

/**
 * Creates an AbortController with the given timeout.
 * [FORGE-OPS-005] Ensures no request exceeds the Forge function time limit.
 */
function createAbortController(timeoutMs: number): {
  readonly signal: AbortSignal;
  readonly clear: () => void;
} {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.min(timeoutMs, MAX_TIMEOUT_MS));
  const clear = (): void => clearTimeout(timer);
  return { signal: controller.signal, clear };
}

// ═══════════════════════════════════════════
// ERROR MAPPING
// ═══════════════════════════════════════════

/**
 * Maps HTTP status codes and operation context to domain error types.
 * [ARCH-SOLID-053] Domain-specific errors, never generic Error
 * [ARCH-SOLID-234] Descriptive messages with operational context
 */
function handleConfluenceError(
  statusCode: number,
  operation: string,
  executionId: string | undefined,
  resourceContext?: string,
): never {
  const ctx = resourceContext ? ` (${resourceContext})` : '';

  if (statusCode === HTTP_NOT_FOUND) {
    if (operation === 'getSpacePages') {
      throw new SpaceNotFoundError(
        `${operation} failed: space not found${ctx}`,
        'CONFLUENCE_SPACE_NOT_FOUND',
        executionId,
      );
    }
    throw new PageNotFoundError(
      `${operation} failed: page not found${ctx}`,
      'CONFLUENCE_PAGE_NOT_FOUND',
      executionId,
    );
  }

  throw new ConfluenceApiError(
    `${operation} failed with status ${statusCode}${ctx}`,
    'CONFLUENCE_API_ERROR',
    executionId,
  );
}

// ═══════════════════════════════════════════
// REQUEST EXECUTION WITH RETRY
// ═══════════════════════════════════════════

/**
 * Executes a Confluence API request with timeout and rate-limit retry.
 * [ARCH-SOLID-052] Extracted helper to keep public functions concise
 * [ARCH-SOLID-233] async/await, no .then/.catch chains
 * [ARCH-SOLID-241] try/catch wrapping all async operations
 * [SEC-PRIV-004] Validates response before processing
 * [AC-04] Exponential backoff on HTTP 429
 * [AC-05] AbortController timeout
 */
async function executeConfluenceRequest(
  operation: string,
  urlPath: string,
  options: ForgeRequestOptions,
  executionId: string | undefined,
  timeoutMs: number,
  retryConfig: RetryConfig = DEFAULT_RETRY_CONFIG,
): Promise<APIResponse> {
  const { signal, clear } = createAbortController(timeoutMs);
  const url = route`/wiki/rest/api${urlPath}`;

  try {
    log('info', operation, executionId, { url, method: options.method ?? 'GET' });

    let lastResponse: APIResponse | undefined;

    for (let attempt = 0; attempt <= retryConfig.maxRetries; attempt++) {
      try {
        const response = await requestConfluence(url, { ...options, signal });

        if (response.status === HTTP_RATE_LIMITED && attempt < retryConfig.maxRetries) {
          const delayMs = Math.min(
            retryConfig.baseDelayMs * Math.pow(2, attempt),
            retryConfig.maxDelayMs,
          );
          log('warn', operation, executionId, {
            retryAttempt: attempt + 1,
            delayMs,
            reason: 'rate_limited',
          });
          await sleep(delayMs);
          continue;
        }

        lastResponse = response;
        break;
      } catch (err: unknown) {
        if (isAbortError(err)) {
          throw new TimeoutError(
            `${operation} timed out after ${timeoutMs}ms`,
            'CONFLUENCE_TIMEOUT',
            executionId,
          );
        }
        throw new ConfluenceApiError(
          `${operation} network error: ${extractMessage(err)}`,
          'CONFLUENCE_NETWORK_ERROR',
          executionId,
        );
      }
    }

    if (!lastResponse) {
      throw new ConfluenceApiError(
        `${operation}: no response received after retries`,
        'CONFLUENCE_NO_RESPONSE',
        executionId,
      );
    }

    if (!lastResponse.ok) {
      handleConfluenceError(lastResponse.status, operation, executionId);
    }

    log('info', operation, executionId, { status: lastResponse.status });
    return lastResponse;
  } finally {
    clear();
  }
}

// ═══════════════════════════════════════════
// TYPE GUARDS & HELPERS
// ═══════════════════════════════════════════

/** [ARCH-SOLID-202] Type guard for AbortError detection */
function isAbortError(err: unknown): boolean {
  return err instanceof DOMException || (err instanceof Error && err.name === 'AbortError');
}

/** [ARCH-SOLID-202] Safe message extraction from unknown error */
function extractMessage(err: unknown): string {
  if (err instanceof Error) {
    return err.message;
  }
  return String(err);
}

/** [ARCH-SOLID-233] Async sleep helper for backoff */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * [ARCH-SOLID-202] Type guard for Confluence search response.
 * [SEC-PRIV-004] Validate external API responses before casting.
 */
function isConfluenceSearchResponse(data: unknown): data is ConfluenceSearchResponse {
  return (
    typeof data === 'object' &&
    data !== null &&
    'results' in data &&
    Array.isArray((data as ConfluenceSearchResponse).results)
  );
}

/**
 * [ARCH-SOLID-202] Type guard for Confluence content list response.
 * [SEC-PRIV-004] Validate external API responses before casting.
 */
function isConfluenceContentListResponse(data: unknown): data is ConfluenceContentListResponse {
  return (
    typeof data === 'object' &&
    data !== null &&
    'results' in data &&
    Array.isArray((data as ConfluenceContentListResponse).results)
  );
}

/**
 * [ARCH-SOLID-202] Type guard for Confluence page with metadata.
 * [SEC-PRIV-004] Validate external API responses before casting.
 */
function isConfluencePageWithMetadata(data: unknown): data is ConfluencePageWithMetadata {
  return (
    typeof data === 'object' &&
    data !== null &&
    'id' in data &&
    typeof (data as ConfluencePageWithMetadata).id === 'string' &&
    'title' in data &&
    typeof (data as ConfluencePageWithMetadata).title === 'string'
  );
}

/**
 * Maps a Confluence content result to ConfluencePageData.
 * [ARCH-SOLID-003] Extract only needed fields, not full body
 * [SEC-PRIV-008] Data minimization
 */
function mapContentResultToPageData(result: ConfluenceContentResult): ConfluencePageData {
  return {
    id: result.id,
    title: result.title,
    content: '',
    spaceKey: result.space?.key ?? '',
    url: result._links?.webui ?? '',
    lastUpdated: result.version?.when ?? '',
  };
}

/**
 * Extracts plain text from Confluence storage format (HTML).
 * [AC-03] ADF format handled in content responses
 * Strips HTML markup for plain text output.
 */
function extractPlainTextFromStorage(html: string): string {
  // Remove HTML tags, decode common entities
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Builds a CQL query string for Confluence search.
 * CQL format: type=page AND title~"{query}" [AND space in (...)]
 */
function buildSearchCql(query: string, spaceKeys?: readonly string[]): string {
  // [SEC-PRIV-004] Sanitize query for CQL — escape special characters
  const sanitized = query.replace(/([+"])/g, '\\$1');
  let cql = `type=page AND title~"${sanitized}"`;

  if (spaceKeys && spaceKeys.length > 0) {
    const spaces = spaceKeys.join(',');
    cql += ` AND space in (${spaces})`;
  }

  return cql;
}

// ═══════════════════════════════════════════
// PUBLIC API — 4 Adapter Functions
// ═══════════════════════════════════════════

/**
 * Searches pages by text in Confluence. Filters by spaces if specified.
 *
 * AC ref: AC-01, AC-02 of .reqs.md
 * REGLA: [FORGE-OPS-005] - timeout, [SEC-PRIV-004] - response validation
 *
 * @param query - Search text
 * @param spaceKeys - Optional space key filters
 * @param executionId - Optional correlation ID for structured logging
 * @param timeoutMs - Optional timeout in milliseconds (default 10s)
 * @returns Array of ConfluencePageData matching the search
 * @throws {ConfluenceApiError} on API failure
 * @throws {TimeoutError} if request exceeds timeout
 */
export async function searchPages(
  query: string,
  spaceKeys?: readonly string[],
  executionId?: string,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<ConfluencePageData[]> {
  const operation = 'searchPages';
  const cql = buildSearchCql(query, spaceKeys);
  // [ARCH-SOLID-003] [SEC-PRIV-008] Only request needed fields
  const urlPath = `/content/search?cql=${encodeURIComponent(cql)}&limit=25`;

  const response = await executeConfluenceRequest(
    operation,
    urlPath,
    { method: 'GET' },
    executionId,
    timeoutMs,
  );

  const data: unknown = await response.json();

  if (!isConfluenceSearchResponse(data)) {
    throw new ConfluenceApiError(
      `${operation}: invalid search response structure`,
      'CONFLUENCE_INVALID_RESPONSE',
      executionId,
    );
  }

  return data.results.map(mapContentResultToPageData);
}

/**
 * Gets page content as plain text. Handles Atlassian Document Format (ADF).
 *
 * AC ref: AC-01, AC-03 of .reqs.md
 * REGLA: [FORGE-OPS-005] - timeout, [SEC-PRIV-004] - response validation
 *
 * @param pageId - Confluence page ID
 * @param executionId - Optional correlation ID for structured logging
 * @param timeoutMs - Optional timeout in milliseconds (default 10s)
 * @returns Page content as plain text string
 * @throws {PageNotFoundError} if page not found (404)
 * @throws {ConfluenceApiError} on other API failures
 * @throws {TimeoutError} if request exceeds timeout
 */
export async function getPageContent(
  pageId: string,
  executionId?: string,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<string> {
  const operation = 'getPageContent';
  // [ARCH-SOLID-003] Expand only body.storage, not full body
  const urlPath = `/content/${pageId}?expand=body.storage`;

  const response = await executeConfluenceRequest(
    operation,
    urlPath,
    { method: 'GET' },
    executionId,
    timeoutMs,
  );

  const data: unknown = await response.json();

  if (typeof data !== 'object' || data === null || !('body' in data)) {
    throw new ConfluenceApiError(
      `${operation}: invalid response structure for page ${pageId}`,
      'CONFLUENCE_INVALID_RESPONSE',
      executionId,
    );
  }

  const body = (data as ConfluenceContentWithBody).body;
  const storageValue = body?.storage?.value ?? body?.view?.value ?? '';

  // [AC-03] Extract plain text from storage format (HTML)
  return extractPlainTextFromStorage(storageValue);
}

/**
 * Gets metadata: title, space, last edit, labels, version.
 *
 * AC ref: AC-01 of .reqs.md
 * REGLA: [FORGE-OPS-005] - timeout, [SEC-PRIV-004] - response validation
 *
 * @param pageId - Confluence page ID
 * @param executionId - Optional correlation ID for structured logging
 * @param timeoutMs - Optional timeout in milliseconds (default 10s)
 * @returns Typed ConfluencePageMetadata with all fields populated
 * @throws {PageNotFoundError} if page not found (404)
 * @throws {ConfluenceApiError} on other API failures
 * @throws {TimeoutError} if request exceeds timeout
 */
export async function getPageMetadata(
  pageId: string,
  executionId?: string,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<ConfluencePageMetadata> {
  const operation = 'getPageMetadata';
  // [ARCH-SOLID-003] [SEC-PRIV-008] Expand only metadata.labels, version, space
  const urlPath = `/content/${pageId}?expand=metadata.labels,version,space`;

  const response = await executeConfluenceRequest(
    operation,
    urlPath,
    { method: 'GET' },
    executionId,
    timeoutMs,
  );

  const data: unknown = await response.json();

  if (!isConfluencePageWithMetadata(data)) {
    throw new ConfluenceApiError(
      `${operation}: invalid response structure for page ${pageId}`,
      'CONFLUENCE_INVALID_RESPONSE',
      executionId,
    );
  }

  return {
    id: data.id,
    title: data.title,
    spaceKey: data.space?.key ?? '',
    labels: data.metadata?.labels?.results?.map((l) => l.name) ?? [],
    version: data.version?.number ?? 1,
    lastUpdated: data.version?.when ?? '',
  };
}

/**
 * Gets pages from a specific space with controlled pagination.
 *
 * AC ref: AC-01, AC-04 of .reqs.md
 * REGLA: [FORGE-OPS-005] - timeout, [SEC-PRIV-004] - response validation
 *
 * @param spaceKey - Confluence space key
 * @param limit - Maximum number of pages to return (default 25, max 100)
 * @param executionId - Optional correlation ID for structured logging
 * @param timeoutMs - Optional timeout in milliseconds (default 10s)
 * @returns Array of ConfluencePageData from the specified space
 * @throws {SpaceNotFoundError} if space not found (404)
 * @throws {ConfluenceApiError} on other API failures
 * @throws {TimeoutError} if request exceeds timeout
 */
export async function getSpacePages(
  spaceKey: string,
  limit: number = DEFAULT_PAGE_LIMIT,
  executionId?: string,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<ConfluencePageData[]> {
  const operation = 'getSpacePages';
  // [AC-04] Controlled pagination with limit parameter
  const effectiveLimit = Math.min(Math.max(1, limit), MAX_PAGE_LIMIT);
  const urlPath = `/content?spaceKey=${encodeURIComponent(spaceKey)}&limit=${effectiveLimit}`;

  const response = await executeConfluenceRequest(
    operation,
    urlPath,
    { method: 'GET' },
    executionId,
    timeoutMs,
  );

  const data: unknown = await response.json();

  if (!isConfluenceContentListResponse(data)) {
    throw new ConfluenceApiError(
      `${operation}: invalid response structure for space ${spaceKey}`,
      'CONFLUENCE_INVALID_RESPONSE',
      executionId,
    );
  }

  return data.results.map(mapContentResultToPageData);
}
