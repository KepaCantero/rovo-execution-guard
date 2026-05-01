/**
 * ROVO ADAPTER — DEPRECATION STRATEGY [RTASK-036]
 *
 * This module uses two undocumented internal endpoints:
 *   - /gateway/api/rovo/search  (callRovoSearch)
 *   - /gateway/api/rovo/validate (callRovoValidation)
 *
 * These are NOT part of the public Rovo API and may change without notice.
 * The official integration path is now the rovo:agent + action Forge modules (RTASK-033/034).
 *
 * 3-LAYER RESILIENCE:
 *   Layer 1: rovo:agent + actions (official, GA) — NEW
 *   Layer 2: Internal endpoints + fallback (JQL + CQL + rules) — DEPRECATED
 *   Layer 3: Fail-open with score 100 + audit log — PERMANENT SAFETY NET
 */
// [ARCH-SOLID-058] Integration layer — wraps @forge/api for Rovo with graceful fallback
// [ARCH-SOLID-202] Zero any usage
// [ARCH-SOLID-053] Domain-specific error types for all failure paths
// [ARCH-SOLID-232] Named exports only, no export default
// [ROVO-INTEG-005] Rovo API calls timeout 5s, fallback 10s
// [FORGE-OPS-0105] Stateless functions, no module-level mutable state
// [ROVO-INTEG-0915] Rovo is enhancer, never a requirement for basic functionality

import {
  requestJira,
  requestConfluence,
  route,
  type APIResponse,
  type FetchOptions,
} from '@forge/api';
import { RovoApiError, TimeoutError } from '../../types/errors';
import type { RovoDocument, HistoricalDecision, RovoContext } from '../../types/rovo-context';
import type { JiraTicketData } from '../../types/jira-data';

// =====================================================================
// LOCAL TYPES
// =====================================================================

/** [ARCH-SOLID-203] Structured log entry interface */
interface StructuredLogEntry {
  readonly timestamp: string;
  readonly level: 'info' | 'warn' | 'error';
  readonly operation: string;
  readonly executionId?: string;
  readonly [key: string]: unknown;
}

/** [ARCH-SOLID-203] Retry configuration for rate-limited requests */
interface RetryConfig {
  readonly maxRetries: number;
  readonly baseDelayMs: number;
  readonly maxDelayMs: number;
}

/** [ARCH-SOLID-203] Quota state — passed as parameter per FORGE-OPS-0105 */
export interface QuotaState {
  readonly windowStartMs: number;
  readonly callCount: number;
  readonly maxCallsPerMinute: number;
}

/** [ARCH-SOLID-203] Quota check result */
export interface QuotaCheckResult {
  readonly allowed: boolean;
  readonly remainingCalls: number;
  readonly nextState: QuotaState;
}

/** [ARCH-SOLID-203] Consistency validation result */
export interface ConsistencyValidation {
  readonly isConsistent: boolean;
  readonly issues: readonly string[];
  readonly confidence: number;
  readonly source: 'rovo' | 'rule-based';
}

/** [ARCH-SOLID-203] Type alias for Forge request options */
type ForgeRequestOptions = FetchOptions;

/** Raw Rovo search response from the gateway API */
interface RawRovoSearchResponse {
  readonly documents?: readonly unknown[];
  readonly relatedTickets?: readonly unknown[];
  readonly decisions?: readonly unknown[];
}

/** Raw Jira search issue fields */
interface RawJiraSearchIssue {
  readonly key: string;
  readonly fields: {
    readonly summary: string;
    readonly labels?: readonly string[];
    readonly issuetype?: { readonly name: string };
    readonly status?: { readonly name: string };
  };
}

/** Raw Jira search response */
interface RawJiraSearchResponse {
  readonly issues?: readonly unknown[];
}

/** Raw Confluence search result page */
interface RawConfluencePage {
  readonly id: string;
  readonly title?: string;
  readonly space?: { readonly key: string };
  readonly body?: { readonly storage?: { readonly value?: string } };
  readonly version?: { readonly number?: number };
  readonly _links?: { readonly webui?: string };
  readonly metadata?: {
    readonly labels?: { readonly results?: readonly { readonly name?: string }[] };
  };
}

/** Raw Confluence search response */
interface RawConfluenceSearchResponse {
  readonly results?: readonly unknown[];
  readonly _links?: { readonly next?: string };
}

/** Raw Rovo validation response */
interface RawRovoValidationResponse {
  readonly isConsistent?: boolean;
  readonly issues?: readonly unknown[];
  readonly confidence?: number;
  readonly source?: string;
}

// =====================================================================
// CONSTANTS
// =====================================================================

/** [ROVO-INTEG-005] Rovo API calls timeout 5s max */
const DEFAULT_ROVO_TIMEOUT_MS = 5_000;

/** [FORGE-OPS-005] Jira/Confluence fallback timeout 10s */
const DEFAULT_FALLBACK_TIMEOUT_MS = 10_000;

/** [FORGE-OPS-005] Maximum timeout to never exceed 10s Forge limit */
const MAX_TIMEOUT_MS = 10_000;

/** [ROVO-INTEG-003] Confluence limit param max 250 */
const CONFLUENCE_MAX_LIMIT = 250;

/** Quota window duration in ms (1 minute) */
const QUOTA_WINDOW_MS = 60_000;

/** Rate-limit retry configuration */
const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 2,
  baseDelayMs: 500,
  maxDelayMs: 4_000,
};

/** HTTP status codes */
const HTTP_RATE_LIMITED = 429;

// =====================================================================
// STRUCTURED LOGGING
// =====================================================================

/**
 * Emits a structured JSON log entry. Forge-compatible (console.log).
 * [SEC-PRIV-002] Only logs operation metadata and executionId — never tokens or PII.
 * [AC-05] Includes executionId and fallback indicator in every entry.
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

// =====================================================================
// TIMEOUT HELPER
// =====================================================================

/**
 * Creates an AbortController with the given timeout.
 * [FORGE-OPS-005] Ensures no request exceeds the Forge function time limit.
 * [ARCH-SOLID-205] Explicit return type.
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

// =====================================================================
// HELPERS
// =====================================================================

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

/** [ARCH-SOLID-205] Cap limit to CONFLUENCE_MAX_LIMIT */
function capLimit(limit: number): number {
  return Math.min(limit, CONFLUENCE_MAX_LIMIT);
}

// =====================================================================
// TYPE GUARDS — SEC-PRIV-004, ROVO-INTEG-0775
// =====================================================================

/** Validates a raw response is a Rovo search result object */
function isRovoSearchResponse(data: unknown): data is RawRovoSearchResponse {
  if (typeof data !== 'object' || data === null) return false;
  const obj = data as Record<string, unknown>;
  if ('documents' in obj && !Array.isArray(obj['documents'])) return false;
  if ('relatedTickets' in obj && !Array.isArray(obj['relatedTickets'])) return false;
  if ('decisions' in obj && !Array.isArray(obj['decisions'])) return false;
  return true;
}

/** Validates a single RovoDocument from raw data */
function isValidRovoDocument(doc: unknown): doc is RovoDocument {
  if (typeof doc !== 'object' || doc === null) return false;
  const obj = doc as Record<string, unknown>;
  return (
    typeof obj['id'] === 'string' &&
    typeof obj['title'] === 'string' &&
    typeof obj['content'] === 'string' &&
    typeof obj['source'] === 'string' &&
    typeof obj['relevance'] === 'number'
  );
}

/** Validates a single HistoricalDecision from raw data */
function isValidHistoricalDecision(dec: unknown): dec is HistoricalDecision {
  if (typeof dec !== 'object' || dec === null) return false;
  const obj = dec as Record<string, unknown>;
  return (
    typeof obj['id'] === 'string' &&
    typeof obj['title'] === 'string' &&
    typeof obj['description'] === 'string' &&
    typeof obj['date'] === 'string' &&
    typeof obj['source'] === 'string'
  );
}

/** Validates a Jira search response */
function isJiraSearchResponse(data: unknown): data is RawJiraSearchResponse {
  if (typeof data !== 'object' || data === null) return false;
  const obj = data as Record<string, unknown>;
  return !('issues' in obj) || Array.isArray(obj['issues']);
}

/** Validates a single Jira search issue */
function isJiraSearchIssue(issue: unknown): issue is RawJiraSearchIssue {
  if (typeof issue !== 'object' || issue === null) return false;
  const obj = issue as Record<string, unknown>;
  return (
    typeof obj['key'] === 'string' &&
    typeof (obj as Record<string, unknown>)['fields'] === 'object' &&
    (obj as Record<string, unknown>)['fields'] !== null
  );
}

/** Validates a Confluence search response */
function isConfluenceSearchResponse(data: unknown): data is RawConfluenceSearchResponse {
  if (typeof data !== 'object' || data === null) return false;
  const obj = data as Record<string, unknown>;
  return !('results' in obj) || Array.isArray(obj['results']);
}

/** Validates a single Confluence page result */
function isConfluencePage(page: unknown): page is RawConfluencePage {
  if (typeof page !== 'object' || page === null) return false;
  const obj = page as Record<string, unknown>;
  return typeof obj['id'] === 'string';
}

/** Validates a Rovo validation response */
function isRovoValidationResponse(data: unknown): data is RawRovoValidationResponse {
  if (typeof data !== 'object' || data === null) return false;
  const obj = data as Record<string, unknown>;
  return (
    typeof obj['isConsistent'] === 'boolean' &&
    typeof obj['confidence'] === 'number' &&
    (typeof obj['source'] === 'string' || obj['source'] === undefined)
  );
}

// =====================================================================
// MAPPER FUNCTIONS — ARCH-SOLID-003, SEC-PRIV-008
// =====================================================================

/** Maps raw data to RovoDocument with defaults for missing fields */
function mapToRovoDocument(doc: unknown, fallbackSource: string = 'unknown'): RovoDocument {
  if (typeof doc !== 'object' || doc === null) {
    return { id: '', title: '', content: '', source: fallbackSource, relevance: 0 };
  }
  const obj = doc as Record<string, unknown>;
  return {
    id: typeof obj['id'] === 'string' ? obj['id'] : '',
    title: typeof obj['title'] === 'string' ? obj['title'] : '',
    content: typeof obj['content'] === 'string' ? obj['content'] : '',
    source: typeof obj['source'] === 'string' ? obj['source'] : fallbackSource,
    relevance: typeof obj['relevance'] === 'number' ? obj['relevance'] : 0,
  };
}

/** Maps raw data to HistoricalDecision with defaults */
function mapToHistoricalDecision(
  dec: unknown,
  fallbackSource: string = 'unknown',
): HistoricalDecision {
  if (typeof dec !== 'object' || dec === null) {
    return { id: '', title: '', description: '', date: '', source: fallbackSource };
  }
  const obj = dec as Record<string, unknown>;
  return {
    id: typeof obj['id'] === 'string' ? obj['id'] : '',
    title: typeof obj['title'] === 'string' ? obj['title'] : '',
    description: typeof obj['description'] === 'string' ? obj['description'] : '',
    date: typeof obj['date'] === 'string' ? obj['date'] : '',
    source: typeof obj['source'] === 'string' ? obj['source'] : fallbackSource,
  };
}

/** Maps a Confluence page to a RovoDocument */
function mapConfluencePageToDocument(page: RawConfluencePage): RovoDocument {
  return {
    id: page.id,
    title: page.title ?? '',
    content: page.body?.storage?.value ?? '',
    source: 'confluence',
    relevance: 0.5, // Default relevance for fallback results
  };
}

/** Maps a Confluence page to a HistoricalDecision */
function mapConfluencePageToDecision(page: RawConfluencePage): HistoricalDecision {
  return {
    id: page.id,
    title: page.title ?? '',
    description: page.body?.storage?.value ?? '',
    date: '',
    source: 'confluence',
  };
}

/** Extracts safe RovoDocuments from raw data */
function extractDocuments(raw: readonly unknown[]): RovoDocument[] {
  return raw.map((doc) => (isValidRovoDocument(doc) ? doc : mapToRovoDocument(doc, 'rovo')));
}

/** Extracts safe HistoricalDecisions from raw data */
function extractDecisions(raw: readonly unknown[]): HistoricalDecision[] {
  return raw.map((dec) =>
    isValidHistoricalDecision(dec) ? dec : mapToHistoricalDecision(dec, 'rovo'),
  );
}

/** Extracts safe ticket keys from raw data */
function extractTicketKeys(raw: readonly unknown[]): string[] {
  return raw.filter((item): item is string => typeof item === 'string');
}

// =====================================================================
// REQUEST EXECUTION HELPERS
// =====================================================================

/**
 * Executes a Rovo gateway API request with timeout and retry.
 * [ARCH-SOLID-052] Extracted helper, <20 lines of effective logic
 * [ARCH-SOLID-241] try/catch wrapping all async operations
 */
async function executeRovoRequest(
  operation: string,
  urlPath: string,
  options: ForgeRequestOptions,
  executionId: string | undefined,
  timeoutMs: number,
  retryConfig: RetryConfig = DEFAULT_RETRY_CONFIG,
): Promise<APIResponse> {
  const { signal, clear } = createAbortController(timeoutMs);
  const url = route`${urlPath}`;

  try {
    log('info', operation, executionId, { url: urlPath, method: options.method ?? 'GET' });
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
            'ROVO_TIMEOUT',
            executionId,
          );
        }
        throw new RovoApiError(
          `${operation} network error: ${extractMessage(err)}`,
          'ROVO_NETWORK_ERROR',
          executionId,
        );
      }
    }

    if (!lastResponse) {
      throw new RovoApiError(
        `${operation}: no response received after retries`,
        'ROVO_NO_RESPONSE',
        executionId,
      );
    }

    log('info', operation, executionId, { status: lastResponse.status });
    return lastResponse;
  } finally {
    clear();
  }
}

/**
 * Executes a Jira API request with timeout.
 * [ARCH-SOLID-052] Extracted helper, <20 lines of effective logic
 */
async function executeJiraRequest(
  operation: string,
  urlPath: string,
  options: ForgeRequestOptions,
  executionId: string | undefined,
  timeoutMs: number,
): Promise<APIResponse> {
  const { signal, clear } = createAbortController(timeoutMs);
  const url = route`${urlPath}`;

  try {
    log('info', operation, executionId, {
      url: urlPath,
      method: options.method ?? 'GET',
      fallback: true,
    });
    const response = await requestJira(url, { ...options, signal });
    log('info', operation, executionId, { status: response.status, fallback: true });
    return response;
  } catch (err: unknown) {
    if (isAbortError(err)) {
      throw new TimeoutError(
        `${operation} fallback timed out after ${timeoutMs}ms`,
        'ROVO_FALLBACK_TIMEOUT',
        executionId,
      );
    }
    throw new RovoApiError(
      `${operation} fallback network error: ${extractMessage(err)}`,
      'ROVO_FALLBACK_NETWORK_ERROR',
      executionId,
    );
  } finally {
    clear();
  }
}

/**
 * Executes a Confluence API request with timeout.
 * [ARCH-SOLID-052] Extracted helper, <20 lines of effective logic
 */
async function executeConfluenceRequest(
  operation: string,
  urlPath: string,
  options: ForgeRequestOptions,
  executionId: string | undefined,
  timeoutMs: number,
): Promise<APIResponse> {
  const { signal, clear } = createAbortController(timeoutMs);
  const url = route`${urlPath}`;

  try {
    log('info', operation, executionId, {
      url: urlPath,
      method: options.method ?? 'GET',
      fallback: true,
    });
    const response = await requestConfluence(url, { ...options, signal });
    log('info', operation, executionId, { status: response.status, fallback: true });
    return response;
  } catch (err: unknown) {
    if (isAbortError(err)) {
      throw new TimeoutError(
        `${operation} fallback timed out after ${timeoutMs}ms`,
        'ROVO_FALLBACK_TIMEOUT',
        executionId,
      );
    }
    throw new RovoApiError(
      `${operation} fallback network error: ${extractMessage(err)}`,
      'ROVO_FALLBACK_NETWORK_ERROR',
      executionId,
    );
  } finally {
    clear();
  }
}

// =====================================================================
// PRIMARY ROVO API CALL
// =====================================================================

/**
 * DEPRECATION NOTICE (RTASK-036):
 * This function uses the undocumented internal endpoint /gateway/api/rovo/search.
 * It will be replaced by the official rovo:agent + action module pattern
 * once the agent integration is fully validated in production.
 *
 * Migration path: Use the Consistency Guard agent's evaluate-issue action instead.
 * Timeline: Deprecation target Q3 2026. Fallback to JQL + CQL remains as permanent safety net.
 * @deprecated Use agent-action-handler via rovo:agent module instead.
 *
 * Calls Rovo search endpoint and returns parsed response.
 * [ROVO-INTEG-005] 5s timeout
 * [ROVO-INTEG-0915] Returns undefined on any failure (caller falls back)
 */
async function callRovoSearch(
  query: string,
  projectKey: string,
  executionId: string | undefined,
  timeoutMs: number,
): Promise<RawRovoSearchResponse | undefined> {
  const operation = 'callRovoSearch';
  const urlPath = `/gateway/api/rovo/search?q=${encodeURIComponent(query)}&project=${encodeURIComponent(projectKey)}&limit=10`;

  try {
    const response = await executeRovoRequest(
      operation,
      urlPath,
      { method: 'GET' },
      executionId,
      timeoutMs,
    );

    if (!response.ok) {
      log('warn', operation, executionId, {
        status: response.status,
        fallback: true,
        reason: 'rovo_unavailable',
      });
      return undefined;
    }

    const data: unknown = await response.json();

    if (!isRovoSearchResponse(data)) {
      log('warn', operation, executionId, {
        fallback: true,
        reason: 'invalid_rovo_response',
      });
      return undefined;
    }

    return data;
  } catch (err: unknown) {
    log('warn', operation, executionId, {
      fallback: true,
      reason: 'rovo_error',
      error: extractMessage(err),
    });
    return undefined;
  }
}

// =====================================================================
// FALLBACK FUNCTIONS
// =====================================================================

/**
 * Jira fallback: searches by keywords via JQL.
 * [ARCH-SOLID-052] <20 lines effective logic
 */
async function fallbackJiraSearch(
  query: string,
  projectKey: string,
  executionId: string | undefined,
  timeoutMs: number,
): Promise<readonly string[]> {
  const operation = 'fallbackJiraSearch';
  const keywords = extractKeywords(query);
  const jql = `project = ${projectKey} AND summary ~ "${keywords}" ORDER BY updated DESC`;

  try {
    const response = await executeJiraRequest(
      operation,
      `/rest/api/2/search?jql=${encodeURIComponent(jql)}&fields=summary,labels,issuetype,status&maxResults=20`,
      { method: 'GET' },
      executionId,
      timeoutMs,
    );

    if (!response.ok) return [];

    const data: unknown = await response.json();
    if (!isJiraSearchResponse(data)) return [];

    return data.issues?.filter(isJiraSearchIssue).map((issue) => issue.key) ?? [];
  } catch (err: unknown) {
    log('warn', operation, executionId, { error: extractMessage(err), fallback: true });
    return [];
  }
}

/**
 * Jira fallback for related tickets: searches by label overlap.
 * [ARCH-SOLID-052] <20 lines effective logic
 */
async function fallbackRelatedTicketsByLabels(
  labels: readonly string[],
  projectKey: string,
  excludeKey: string,
  executionId: string | undefined,
  timeoutMs: number,
): Promise<readonly string[]> {
  if (labels.length === 0) return [];

  const operation = 'fallbackRelatedTicketsByLabels';
  const labelList = labels.map((l) => `"${l}"`).join(', ');
  const jql = `project = ${projectKey} AND labels in (${labelList}) AND key != ${excludeKey} ORDER BY updated DESC`;

  try {
    const response = await executeJiraRequest(
      operation,
      `/rest/api/2/search?jql=${encodeURIComponent(jql)}&fields=summary&maxResults=20`,
      { method: 'GET' },
      executionId,
      timeoutMs,
    );

    if (!response.ok) return [];

    const data: unknown = await response.json();
    if (!isJiraSearchResponse(data)) return [];

    return data.issues?.filter(isJiraSearchIssue).map((issue) => issue.key) ?? [];
  } catch (err: unknown) {
    log('warn', operation, executionId, { error: extractMessage(err), fallback: true });
    return [];
  }
}

/**
 * Confluence fallback: CQL keyword search.
 * [ROVO-INTEG-001] Cursor-based pagination
 * [ROVO-INTEG-003] Limit capped at 250
 * [ARCH-SOLID-052] <20 lines effective logic
 */
async function fallbackConfluenceSearch(
  query: string,
  spaceKeys: readonly string[] | undefined,
  executionId: string | undefined,
  timeoutMs: number,
  limit: number = 50,
): Promise<readonly RovoDocument[]> {
  const operation = 'fallbackConfluenceSearch';
  const cappedLimit = capLimit(limit);
  const keywords = extractKeywords(query);

  let cql = `type = "page" AND title ~ "${keywords}"`;
  if (spaceKeys && spaceKeys.length > 0) {
    const spaceList = spaceKeys.map((s) => `"${s}"`).join(', ');
    cql += ` AND space in (${spaceList})`;
  }

  return collectConfluencePages(operation, cql, cappedLimit, executionId, timeoutMs);
}

/**
 * Collects Confluence pages with cursor-based pagination.
 * [ROVO-INTEG-001] Cursor-based pagination
 */
async function collectConfluencePages(
  operation: string,
  cql: string,
  limit: number,
  executionId: string | undefined,
  timeoutMs: number,
): Promise<RovoDocument[]> {
  const allDocuments: RovoDocument[] = [];
  let cursor: string | undefined;
  let remaining = limit;

  while (remaining > 0) {
    const batchLimit = Math.min(remaining, CONFLUENCE_MAX_LIMIT);
    const pageDocs = await fetchConfluencePage(
      operation,
      cql,
      batchLimit,
      cursor,
      executionId,
      timeoutMs,
    );

    allDocuments.push(...pageDocs.documents);
    cursor = pageDocs.nextCursor;

    remaining -= pageDocs.documents.length;
    if (!cursor || pageDocs.documents.length === 0) break;
  }

  return allDocuments;
}

/**
 * Fetches a single page of Confluence results.
 * [ARCH-SOLID-052] <20 lines effective logic
 */
async function fetchConfluencePage(
  operation: string,
  cql: string,
  limit: number,
  cursor: string | undefined,
  executionId: string | undefined,
  timeoutMs: number,
): Promise<{ readonly documents: readonly RovoDocument[]; readonly nextCursor?: string }> {
  let urlPath = `/wiki/rest/api/content/search?cql=${encodeURIComponent(cql)}&limit=${limit}&expand=body.storage,space,version`;
  if (cursor) {
    urlPath += `&cursor=${encodeURIComponent(cursor)}`;
  }

  try {
    const response = await executeConfluenceRequest(
      operation,
      urlPath,
      { method: 'GET' },
      executionId,
      timeoutMs,
    );

    if (!response.ok) return { documents: [] };

    const data: unknown = await response.json();
    if (!isConfluenceSearchResponse(data)) return { documents: [] };

    const documents = (data.results ?? [])
      .filter(isConfluencePage)
      .map(mapConfluencePageToDocument);

    const nextCursor = data._links?.next ? extractCursorFromUrl(data._links.next) : undefined;

    return { documents, nextCursor };
  } catch (err: unknown) {
    log('warn', operation, executionId, { error: extractMessage(err), fallback: true });
    return { documents: [] };
  }
}

/**
 * Extracts cursor parameter from a Confluence next URL.
 * [ROVO-INTEG-002] Use Link headers / URLs for navigation
 */
function extractCursorFromUrl(url: string): string | undefined {
  const match = url.match(/[?&]cursor=([^&]+)/);
  return match?.[1];
}

/**
 * Confluence fallback: search for ADR/decision-tagged pages.
 * [ARCH-SOLID-052] <20 lines effective logic
 */
async function fallbackDecisionSearch(
  projectKey: string,
  executionId: string | undefined,
  timeoutMs: number,
): Promise<readonly HistoricalDecision[]> {
  const operation = 'fallbackDecisionSearch';
  const cql = `type = "page" AND (label = "decision" OR label = "adr" OR title ~ "ADR")`;

  try {
    const response = await executeConfluenceRequest(
      operation,
      `/wiki/rest/api/content/search?cql=${encodeURIComponent(cql)}&limit=50&expand=body.storage,space,version,metadata.labels`,
      { method: 'GET' },
      executionId,
      timeoutMs,
    );

    if (!response.ok) return [];

    const data: unknown = await response.json();
    if (!isConfluenceSearchResponse(data)) return [];

    return (data.results ?? []).filter(isConfluencePage).map(mapConfluencePageToDecision);
  } catch (err: unknown) {
    log('warn', operation, executionId, { error: extractMessage(err), fallback: true });
    return [];
  }
}

/**
 * Fetches a Jira ticket's fields for label/summary extraction.
 * [ARCH-SOLID-052] <20 lines effective logic
 */
async function fetchTicketFields(
  issueKey: string,
  executionId: string | undefined,
  timeoutMs: number,
): Promise<{ readonly summary: string; readonly labels: readonly string[] } | undefined> {
  const operation = 'fetchTicketFields';

  try {
    const response = await executeJiraRequest(
      operation,
      `/rest/api/2/issue/${issueKey}?fields=summary,labels`,
      { method: 'GET' },
      executionId,
      timeoutMs,
    );

    if (!response.ok) return undefined;

    const data: unknown = await response.json();

    if (typeof data !== 'object' || data === null || !('fields' in data)) return undefined;
    const fields = (data as Record<string, unknown>)['fields'] as Record<string, unknown>;

    return {
      summary: typeof fields['summary'] === 'string' ? fields['summary'] : '',
      labels: Array.isArray(fields['labels']) ? (fields['labels'] as string[]) : [],
    };
  } catch (err: unknown) {
    log('warn', operation, executionId, { error: extractMessage(err), fallback: true });
    return undefined;
  }
}

// =====================================================================
// KEYWORD EXTRACTION
// =====================================================================

/**
 * Extracts searchable keywords from a query string.
 * [ARCH-SOLID-052] <20 lines effective logic
 */
function extractKeywords(query: string): string {
  return query
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 1)
    .slice(0, 5)
    .join(' ');
}

// =====================================================================
// RULE-BASED CONSISTENCY VALIDATION
// =====================================================================

/**
 * Performs rule-based consistency validation when Rovo is unavailable.
 * [ROVO-INTEG-0915] Rovo is enhancer, never a requirement
 * [ARCH-SOLID-052] <20 lines effective logic per sub-function
 */
function performRuleBasedValidation(
  ticketData: JiraTicketData,
  context: RovoContext,
): ConsistencyValidation {
  const issues: string[] = [];
  let matchScore = 0;
  let totalChecks = 0;

  // Check label overlap with context documents
  totalChecks++;
  const ticketLabels = ticketData.labels.map((l) => l.toLowerCase());
  const contextContent = context.documents
    .map((d) => `${d.title} ${d.content}`.toLowerCase())
    .join(' ');

  const labelMatches = ticketLabels.filter((label) => contextContent.includes(label));
  if (labelMatches.length > 0) {
    matchScore += labelMatches.length / Math.max(ticketLabels.length, 1);
  } else if (ticketLabels.length > 0) {
    issues.push('Ticket labels have no overlap with context documents');
  }

  // Check summary alignment with context
  totalChecks++;
  const summaryWords = ticketData.summary
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 3);
  const summaryMatches = summaryWords.filter((word) => contextContent.includes(word));
  if (summaryMatches.length > 0) {
    matchScore += summaryMatches.length / Math.max(summaryWords.length, 1);
  } else if (summaryWords.length > 0) {
    issues.push('Ticket summary has no keyword overlap with context documents');
  }

  // Check if ticket is in related tickets list
  if (context.relatedTickets.includes(ticketData.key)) {
    totalChecks++;
    matchScore += 1;
  }

  const confidence = totalChecks > 0 ? Math.min(matchScore / totalChecks, 1) : 0.5;
  const isConsistent = confidence >= 0.3 && issues.length === 0;

  return {
    isConsistent,
    issues,
    confidence: Math.round(confidence * 100) / 100,
    source: 'rule-based',
  };
}

// =====================================================================
// PUBLIC API — 6 Adapter Functions
// =====================================================================

/**
 * Retrieves contextual information for a given query within a project.
 *
 * AC refs: AC-01, AC-02, AC-04, AC-05
 * Rules: ROVO-INTEG-005, ROVO-INTEG-004, FORGE-OPS-005, ROVO-INTEG-0915
 *
 * @param query - Search query string
 * @param projectKey - Jira project key
 * @param executionId - Optional correlation ID for structured logging
 * @param timeoutMs - Optional timeout (default 5s for Rovo, 10s for fallback)
 * @returns Structured RovoContext with documents, related tickets, and decisions
 */
export async function getContext(
  query: string,
  projectKey: string,
  executionId?: string,
  timeoutMs: number = DEFAULT_ROVO_TIMEOUT_MS,
): Promise<RovoContext> {
  const operation = 'getContext';
  const fallbackTimeout = DEFAULT_FALLBACK_TIMEOUT_MS;

  log('info', operation, executionId, { query, projectKey });

  // Try Rovo primary path
  const rovoResult = await callRovoSearch(query, projectKey, executionId, timeoutMs);

  if (rovoResult) {
    const documents = extractDocuments(rovoResult.documents ?? []);
    const relatedTickets = extractTicketKeys(rovoResult.relatedTickets ?? []);
    const decisions = extractDecisions(rovoResult.decisions ?? []);

    return {
      documents,
      relatedTickets,
      decisions,
      query,
      timestamp: new Date().toISOString(),
    };
  }

  // Fallback: Jira JQL + Confluence CQL
  log('info', operation, executionId, { fallback: true, reason: 'rovo_unavailable' });

  const [jiraTickets, confluenceDocs] = await Promise.all([
    fallbackJiraSearch(query, projectKey, executionId, fallbackTimeout).catch(
      () => [] as readonly string[],
    ),
    fallbackConfluenceSearch(query, undefined, executionId, fallbackTimeout).catch(
      () => [] as readonly RovoDocument[],
    ),
  ]);

  return {
    documents: [...confluenceDocs],
    relatedTickets: [...jiraTickets],
    decisions: [],
    query,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Finds tickets related to the given issue based on Rovo intelligence.
 *
 * AC refs: AC-01, AC-02, AC-04, AC-05
 * Rules: ROVO-INTEG-005, ROVO-INTEG-0915
 *
 * @param issueKey - Jira issue key (e.g., "PROJ-123")
 * @param executionId - Optional correlation ID
 * @param timeoutMs - Optional timeout (default 5s for Rovo, 10s for fallback)
 * @returns Readonly array of related issue keys
 */
export async function getRelatedTickets(
  issueKey: string,
  executionId?: string,
  timeoutMs: number = DEFAULT_ROVO_TIMEOUT_MS,
): Promise<readonly string[]> {
  const operation = 'getRelatedTickets';
  const fallbackTimeout = DEFAULT_FALLBACK_TIMEOUT_MS;

  log('info', operation, executionId, { issueKey });

  // Fetch ticket fields for query construction
  const ticketFields = await fetchTicketFields(issueKey, executionId, fallbackTimeout);
  const summary = ticketFields?.summary ?? '';
  const labels = ticketFields?.labels ?? [];

  // Try Rovo primary path
  const projectKey = issueKey.split('-')[0] ?? '';
  const rovoResult = await callRovoSearch(summary, projectKey, executionId, timeoutMs);

  if (rovoResult && Array.isArray(rovoResult.relatedTickets)) {
    const tickets = extractTicketKeys(rovoResult.relatedTickets).filter((key) => key !== issueKey);
    return tickets;
  }

  // Fallback: label/title overlap via Jira
  log('info', operation, executionId, { fallback: true, reason: 'rovo_unavailable' });

  if (labels.length > 0) {
    return fallbackRelatedTicketsByLabels(
      labels,
      projectKey,
      issueKey,
      executionId,
      fallbackTimeout,
    );
  }

  // Last resort: summary-based JQL search
  return fallbackJiraSearch(summary, projectKey, executionId, fallbackTimeout);
}

/**
 * Searches Confluence documentation relevant to the query.
 *
 * AC refs: AC-01, AC-02, AC-04, AC-05
 * Rules: ROVO-INTEG-001, ROVO-INTEG-002, ROVO-INTEG-003, ROVO-INTEG-005
 *
 * @param query - Search query string
 * @param spaceKeys - Optional Confluence space keys to filter by
 * @param executionId - Optional correlation ID
 * @param timeoutMs - Optional timeout (default 5s for Rovo, 10s for fallback)
 * @returns Readonly array of RovoDocument
 */
export async function getDocumentation(
  query: string,
  spaceKeys?: readonly string[],
  executionId?: string,
  timeoutMs: number = DEFAULT_ROVO_TIMEOUT_MS,
): Promise<readonly RovoDocument[]> {
  const operation = 'getDocumentation';
  const fallbackTimeout = DEFAULT_FALLBACK_TIMEOUT_MS;

  log('info', operation, executionId, { query, spaceKeys: spaceKeys?.join(',') });

  // Try Rovo primary path
  const rovoResult = await callRovoSearch(query, '', executionId, timeoutMs);

  if (rovoResult && Array.isArray(rovoResult.documents)) {
    return extractDocuments(rovoResult.documents);
  }

  // Fallback: Confluence CQL with cursor-based pagination
  log('info', operation, executionId, { fallback: true, reason: 'rovo_unavailable' });

  return fallbackConfluenceSearch(query, spaceKeys, executionId, fallbackTimeout);
}

/**
 * Retrieves past architectural and technical decisions for the project.
 *
 * AC refs: AC-01, AC-02, AC-04, AC-05
 * Rules: ROVO-INTEG-001, ROVO-INTEG-002, ROVO-INTEG-003
 *
 * @param projectKey - Jira project key
 * @param executionId - Optional correlation ID
 * @param timeoutMs - Optional timeout (default 5s for Rovo, 10s for fallback)
 * @returns Readonly array of HistoricalDecision
 */
export async function getHistoricalDecisions(
  projectKey: string,
  executionId?: string,
  timeoutMs: number = DEFAULT_ROVO_TIMEOUT_MS,
): Promise<readonly HistoricalDecision[]> {
  const operation = 'getHistoricalDecisions';
  const fallbackTimeout = DEFAULT_FALLBACK_TIMEOUT_MS;

  log('info', operation, executionId, { projectKey });

  // Try Rovo primary path
  const rovoResult = await callRovoSearch(
    `decisions ${projectKey}`,
    projectKey,
    executionId,
    timeoutMs,
  );

  if (rovoResult && Array.isArray(rovoResult.decisions)) {
    return extractDecisions(rovoResult.decisions);
  }

  // Fallback: Confluence search for ADR/decision-tagged pages
  log('info', operation, executionId, { fallback: true, reason: 'rovo_unavailable' });

  return fallbackDecisionSearch(projectKey, executionId, fallbackTimeout);
}

/**
 * Uses Rovo to validate ticket data consistency with known context.
 *
 * AC refs: AC-01, AC-02, AC-05
 * Rules: ROVO-INTEG-004, ROVO-INTEG-055, ROVO-INTEG-060
 *
 * @param ticketData - Typed Jira ticket data
 * @param context - RovoContext to validate against
 * @param executionId - Optional correlation ID
 * @returns ConsistencyValidation result
 */
export async function validateConsistency(
  ticketData: JiraTicketData,
  context: RovoContext,
  executionId?: string,
): Promise<ConsistencyValidation> {
  const operation = 'validateConsistency';

  log('info', operation, executionId, { issueKey: ticketData.key });

  // Try Rovo validation endpoint
  const validation = await callRovoValidation(ticketData, context, executionId);
  if (validation) {
    return validation;
  }

  // Fallback: rule-based field comparison
  log('info', operation, executionId, { fallback: true, reason: 'rovo_unavailable' });

  return performRuleBasedValidation(ticketData, context);
}

/**
 * DEPRECATION NOTICE (RTASK-036):
 * This function uses the undocumented internal endpoint /gateway/api/rovo/validate.
 * It will be replaced by the official rovo:agent + action module pattern
 * once the agent integration is fully validated in production.
 *
 * Migration path: Use the Consistency Guard agent's evaluate-issue action instead.
 * Timeline: Deprecation target Q3 2026. Rule-based fallback remains as permanent safety net.
 * @deprecated Use agent-action-handler via rovo:agent module instead.
 *
 * Calls Rovo validation endpoint.
 * [ARCH-SOLID-052] <20 lines effective logic
 */
async function callRovoValidation(
  ticketData: JiraTicketData,
  context: RovoContext,
  executionId: string | undefined,
): Promise<ConsistencyValidation | undefined> {
  const operation = 'callRovoValidation';
  const urlPath = '/gateway/api/rovo/validate';

  try {
    const response = await executeRovoRequest(
      operation,
      urlPath,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticket: { key: ticketData.key, summary: ticketData.summary, labels: ticketData.labels },
          context,
        }),
      },
      executionId,
      DEFAULT_ROVO_TIMEOUT_MS,
    );

    if (!response.ok) return undefined;

    const data: unknown = await response.json();

    if (!isRovoValidationResponse(data)) return undefined;

    const issues = Array.isArray(data.issues)
      ? (data.issues as unknown[]).filter((item): item is string => typeof item === 'string')
      : [];

    return {
      isConsistent: data.isConsistent ?? true,
      issues,
      confidence: data.confidence ?? 0.5,
      source: 'rovo',
    };
  } catch (err: unknown) {
    log('warn', operation, executionId, { error: extractMessage(err), fallback: true });
    return undefined;
  }
}

/**
 * Checks if quota is available for a Rovo API call.
 * [FORGE-OPS-0105] Stateless — quota state passed as parameter.
 *
 * @param quotaState - Current quota state (window start, call count, max per minute)
 * @param executionId - Optional correlation ID
 * @returns QuotaCheckResult with allowed flag, remaining calls, and next state
 */
export function checkQuota(quotaState: QuotaState, executionId?: string): QuotaCheckResult {
  const operation = 'checkQuota';
  const now = Date.now();
  const windowElapsed = now - quotaState.windowStartMs;

  // Reset window if more than a minute has passed
  if (windowElapsed >= QUOTA_WINDOW_MS) {
    const nextState: QuotaState = {
      windowStartMs: now,
      callCount: 1,
      maxCallsPerMinute: quotaState.maxCallsPerMinute,
    };
    const remainingCalls = Math.max(0, quotaState.maxCallsPerMinute - 1);

    log('info', operation, executionId, {
      allowed: true,
      remainingCalls,
      windowReset: true,
    });

    return { allowed: true, remainingCalls, nextState };
  }

  // Check if quota is available within current window
  if (quotaState.callCount >= quotaState.maxCallsPerMinute) {
    const nextState: QuotaState = {
      windowStartMs: quotaState.windowStartMs,
      callCount: quotaState.callCount,
      maxCallsPerMinute: quotaState.maxCallsPerMinute,
    };

    log('warn', operation, executionId, {
      allowed: false,
      remainingCalls: 0,
      callCount: quotaState.callCount,
    });

    return { allowed: false, remainingCalls: 0, nextState };
  }

  // Allow call, increment count
  const newCount = quotaState.callCount + 1;
  const remainingCalls = Math.max(0, quotaState.maxCallsPerMinute - newCount);
  const nextState: QuotaState = {
    windowStartMs: quotaState.windowStartMs,
    callCount: newCount,
    maxCallsPerMinute: quotaState.maxCallsPerMinute,
  };

  log('info', operation, executionId, {
    allowed: true,
    remainingCalls,
    callCount: newCount,
  });

  return { allowed: true, remainingCalls, nextState };
}
