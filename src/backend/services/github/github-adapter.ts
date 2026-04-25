// [ARCH-SOLID-058] Integration layer — wraps GitHub REST API v3 via @forge/api fetch
// [ARCH-SOLID-202] Zero any usage
// [ARCH-SOLID-053] Domain-specific error types for all failure paths
// [ARCH-SOLID-232] Named exports only, no export default
// [FORGE-OPS-005] Timeout via AbortController (default 8s)
// [FORGE-OPS-0105] Stateless functions, no module-level mutable state
// [FORGE-OPS-0101] Complete critical work in max 8s, 2s margin against 10s hard limit

import { fetch as forgeFetch, type APIResponse } from '@forge/api';
import type { PRFile, GitHubPRData, GitHubStatusCheck } from '../../types/github-data';
import { GitHubApiError, TokenExpiredError, TimeoutError } from '../../types/errors';

// ═══════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════

/** [ARCH-SOLID-203] Interface for structured log entries */
interface StructuredLogEntry {
  readonly timestamp: string;
  readonly level: 'info' | 'warn' | 'error';
  readonly operation: string;
  readonly executionId?: string;
  readonly [key: string]: unknown;
}

/** Configuration for retry behavior [GH-INTEG-309] */
interface RetryConfig {
  readonly maxRetries: number;
  readonly baseDelayMs: number;
  readonly maxDelayMs: number;
}

/** [ARCH-SOLID-203] Interface for raw GitHub PR API response */
interface GitHubPRResponse {
  readonly number: number;
  readonly title: string;
  readonly body: string | null;
  readonly state: string;
  readonly head: { readonly ref: string };
  readonly base: { readonly ref: string };
  readonly html_url: string;
}

/** [ARCH-SOLID-203] Interface for raw GitHub PR file API response */
interface GitHubPRFileResponse {
  readonly filename: string;
  readonly status: string;
  readonly additions: number;
  readonly deletions: number;
}

/** [ARCH-SOLID-203] Interface for parsed Link header page info */
interface ParsedLinkHeader {
  readonly next?: string;
}

// ═══════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════

/** [FORGE-OPS-005] [FORGE-OPS-0101] Default timeout 8s (2s margin against 10s Forge limit) */
const DEFAULT_TIMEOUT_MS = 8_000;

/** [FORGE-OPS-005] Maximum timeout — never exceed 10s Forge hard limit */
const MAX_TIMEOUT_MS = 10_000;

/** GitHub API base URL */
const GITHUB_API_BASE = 'https://api.github.com';

/** [GH-INTEG-301] Default per_page for pagination */
const PER_PAGE = 100;

/** [GH-INTEG-309] Retry configuration — max 3 retries, exponential backoff 1s/4s/16s */
const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelayMs: 1_000,
  maxDelayMs: 16_000,
};

/** HTTP status codes */
const HTTP_UNAUTHORIZED = 401;
const HTTP_FORBIDDEN = 403;
const HTTP_NOT_FOUND = 404;
const HTTP_UNPROCESSABLE = 422;
const HTTP_RATE_LIMITED = 429;

/** Jira key regex pattern [AC-03] */
const JIRA_KEY_PATTERN = /[A-Z]+-\d+/g;

/** Status check context [GH-INTEG-305] */
const STATUS_CHECK_CONTEXT = 'rovo-execution-guard/consistency';

// ═══════════════════════════════════════════
// STRUCTURED LOGGING
// ═══════════════════════════════════════════

/**
 * Emits a structured JSON log entry. Forge-compatible (console.log).
 * [SEC-PRIV-002] Only logs operation metadata and executionId — never tokens or PII.
 * [SEC-PRIV-0792] No silent error swallowing; every catch logs with context.
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
 * [FORGE-OPS-0101] Default 8s to keep 2s margin.
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
 * [GH-INTEG-304] Error classification by status code
 * [GH-INTEG-310] Error capture: auth -> surface immediately, 404 -> skip+log
 * [ARCH-SOLID-234] Descriptive messages with operational context
 */
function handleGitHubError(
  statusCode: number,
  operation: string,
  executionId: string | undefined,
  resource?: string,
): never {
  const context = resource ? ` (${resource})` : '';

  if (statusCode === HTTP_UNAUTHORIZED) {
    throw new TokenExpiredError(
      `${operation} failed: token expired or invalid${context}`,
      'GITHUB_TOKEN_EXPIRED',
      executionId,
    );
  }

  if (statusCode === HTTP_NOT_FOUND) {
    throw new GitHubApiError(
      `${operation} failed: resource not found${context}`,
      'GITHUB_NOT_FOUND',
      executionId,
    );
  }

  if (statusCode === HTTP_FORBIDDEN) {
    throw new GitHubApiError(
      `${operation} failed: permission denied${context}`,
      'GITHUB_PERMISSION_DENIED',
      executionId,
    );
  }

  if (statusCode === HTTP_UNPROCESSABLE) {
    throw new GitHubApiError(
      `${operation} failed: validation error (422)${context}`,
      'GITHUB_VALIDATION_ERROR',
      executionId,
    );
  }

  throw new GitHubApiError(
    `${operation} failed with status ${statusCode}${context}`,
    'GITHUB_API_ERROR',
    executionId,
  );
}

// ═══════════════════════════════════════════
// HELPERS
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
 * Builds the full GitHub API URL for a given path.
 * [GH-INTEG-305] Status checks endpoint: POST /repos/{owner}/{repo}/statuses/{sha}
 */
function buildUrl(path: string): string {
  return `${GITHUB_API_BASE}${path}`;
}

/**
 * Parses the Link header to find the next page URL.
 * [GH-INTEG-301] Pagination via Link header
 */
function parseLinkHeader(linkHeader: string | null): ParsedLinkHeader {
  if (!linkHeader) return {};

  const nextMatch = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
  if (nextMatch?.[1]) {
    return { next: nextMatch[1] };
  }
  return {};
}

/**
 * Gets the token from Forge secure storage for the current request.
 * [SEC-PRIV-003] Fresh token per operation, never cache >1hr
 * [SEC-PRIV-001] Least privilege: scopes repo:status, pull_requests:read
 *
 * NOTE: In the Forge runtime, tokens are obtained via the GitHub App installation.
 * For now we accept the token as a parameter. The caller is responsible for
 * obtaining a fresh installation token from Forge Storage.
 */
function buildAuthHeaders(token: string): Record<string, string> {
  return {
    Authorization: `token ${token}`,
    Accept: 'application/vnd.github.v3+json',
    'Content-Type': 'application/json',
  };
}

// ═══════════════════════════════════════════
// REQUEST EXECUTION WITH RETRY
// ═══════════════════════════════════════════

/**
 * Checks rate limit headers and warns if quota is low.
 * [GH-INTEG-302] Rate limiting: read X-RateLimit-* headers
 */
function checkRateLimitQuota(
  response: APIResponse,
  operation: string,
  executionId: string | undefined,
): void {
  const rateLimitRemaining = response.headers.get('X-RateLimit-Remaining');
  const rateLimitLimit = response.headers.get('X-RateLimit-Limit');

  if (rateLimitRemaining && rateLimitLimit) {
    const remaining = parseInt(rateLimitRemaining, 10);
    const limit = parseInt(rateLimitLimit, 10);
    if (remaining < limit * 0.1) {
      log('warn', operation, executionId, {
        rateLimitRemaining: remaining,
        rateLimitLimit: limit,
        note: 'rate_limit_quota_low',
      });
    }
  }
}

/**
 * Determines if the response should be retried and sleeps if so.
 * [GH-INTEG-309] Retry on 429 and 5xx with exponential backoff
 * @returns true if the request should be retried, false otherwise
 */
async function shouldRetry(
  response: APIResponse,
  attempt: number,
  retryConfig: RetryConfig,
  operation: string,
  executionId: string | undefined,
): Promise<boolean> {
  const isRetryableStatus = response.status === HTTP_RATE_LIMITED || response.status >= 500;
  if (!isRetryableStatus || attempt >= retryConfig.maxRetries) {
    return false;
  }

  const delayMs = Math.min(retryConfig.baseDelayMs * Math.pow(4, attempt), retryConfig.maxDelayMs);
  const reason = response.status === HTTP_RATE_LIMITED ? 'rate_limited' : 'server_error';
  log('warn', operation, executionId, {
    retryAttempt: attempt + 1,
    delayMs,
    reason,
    statusCode: response.status,
  });
  await sleep(delayMs);
  return true;
}

/**
 * Executes a GitHub API request with timeout and rate-limit retry.
 * [ARCH-SOLID-052] Extracted helper to keep public functions concise
 * [ARCH-SOLID-233] async/await, no .then/.catch chains
 * [ARCH-SOLID-241] try/catch wrapping all async operations
 * [SEC-PRIV-004] Validates response before processing
 * [GH-INTEG-309] Retry: max 3, exponential backoff 1s/4s/16s
 * [GH-INTEG-302] Rate limiting: read X-RateLimit-* headers
 * [AC-05] AbortController timeout
 * [SEC-PRIV-010] Audit log of every token usage
 */
async function executeGitHubRequest(
  operation: string,
  url: string,
  token: string,
  options: {
    readonly method?: string;
    readonly body?: string;
    readonly headers?: Record<string, string>;
  },
  executionId: string | undefined,
  timeoutMs: number,
  retryConfig: RetryConfig = DEFAULT_RETRY_CONFIG,
): Promise<APIResponse> {
  const { signal, clear } = createAbortController(timeoutMs);

  try {
    log('info', operation, executionId, {
      url,
      method: options.method ?? 'GET',
      audit: 'token_used',
    });

    let lastResponse: APIResponse | undefined;

    for (let attempt = 0; attempt <= retryConfig.maxRetries; attempt++) {
      try {
        const headers = {
          ...buildAuthHeaders(token),
          ...options.headers,
        };

        const fetchOptions: Record<string, unknown> = {
          method: options.method ?? 'GET',
          headers,
          signal,
        };
        if (options.body !== undefined) {
          fetchOptions.body = options.body;
        }

        // [ARCH-SOLID-202] Cast to unknown then to satisfy node-fetch RequestInit type mismatch
        const response = await forgeFetch(
          url,
          fetchOptions as unknown as Parameters<typeof forgeFetch>[1],
        );

        // [GH-INTEG-302] Read rate limit headers
        checkRateLimitQuota(response, operation, executionId);

        // [GH-INTEG-309] Retry on 429/5xx with exponential backoff
        if (await shouldRetry(response, attempt, retryConfig, operation, executionId)) {
          continue;
        }

        lastResponse = response;
        break;
      } catch (err: unknown) {
        if (isAbortError(err)) {
          throw new TimeoutError(
            `${operation} timed out after ${timeoutMs}ms`,
            'GITHUB_TIMEOUT',
            executionId,
          );
        }
        throw new GitHubApiError(
          `${operation} network error: ${extractMessage(err)}`,
          'GITHUB_NETWORK_ERROR',
          executionId,
        );
      }
    }

    if (!lastResponse) {
      throw new GitHubApiError(
        `${operation}: no response received after retries`,
        'GITHUB_NO_RESPONSE',
        executionId,
      );
    }

    if (!lastResponse.ok) {
      // [GH-INTEG-304] Error classification
      handleGitHubError(lastResponse.status, operation, executionId, url);
    }

    log('info', operation, executionId, { status: lastResponse.status });
    return lastResponse;
  } finally {
    clear();
  }
}

// ═══════════════════════════════════════════
// TYPE GUARDS & VALIDATION
// ═══════════════════════════════════════════

/**
 * Type guard helper: checks if value is a non-null object with a string property.
 * [ARCH-SOLID-052] Extracted to reduce isGitHubPRResponse complexity
 */
function hasStringProp(data: object, prop: string): boolean {
  return prop in data && typeof (data as Record<string, unknown>)[prop] === 'string';
}

/**
 * Type guard helper: checks if value is a non-null object with a number property.
 * [ARCH-SOLID-052] Extracted to reduce isGitHubPRResponse complexity
 */
function hasNumberProp(data: object, prop: string): boolean {
  return prop in data && typeof (data as Record<string, unknown>)[prop] === 'number';
}

/**
 * Type guard helper: checks if value is a non-null object with a nested object property.
 * [ARCH-SOLID-052] Extracted to reduce isGitHubPRResponse complexity
 */
function hasObjectProp(data: object, prop: string): boolean {
  const value = (data as Record<string, unknown>)[prop];
  return prop in data && typeof value === 'object' && value !== null;
}

/**
 * Validates a raw API response is a GitHub PR object.
 * [SEC-PRIV-004] Validate external API responses before casting
 * [SEC-PRIV-051] Validate and sanitize all external input
 * [ARCH-SOLID-202] Zero any — unknown with type narrowing
 */
function isGitHubPRResponse(data: unknown): data is GitHubPRResponse {
  if (typeof data !== 'object' || data === null) return false;
  return (
    hasNumberProp(data, 'number') &&
    hasStringProp(data, 'title') &&
    hasObjectProp(data, 'head') &&
    hasObjectProp(data, 'base') &&
    hasStringProp(data, 'html_url')
  );
}

/**
 * Validates a raw API response item is a GitHub PR file object.
 * [SEC-PRIV-004] Validate external API responses before casting
 */
function isGitHubPRFileResponse(data: unknown): data is GitHubPRFileResponse {
  return (
    typeof data === 'object' &&
    data !== null &&
    'filename' in data &&
    typeof (data as GitHubPRFileResponse).filename === 'string' &&
    'status' in data &&
    typeof (data as GitHubPRFileResponse).status === 'string' &&
    'additions' in data &&
    typeof (data as GitHubPRFileResponse).additions === 'number' &&
    'deletions' in data &&
    typeof (data as GitHubPRFileResponse).deletions === 'number'
  );
}

/**
 * Maps a validated GitHub PR response to GitHubPRData domain type.
 * [SEC-PRIV-008] Data minimization
 */
function mapPRResponseToDomain(pr: GitHubPRResponse, files: readonly PRFile[]): GitHubPRData {
  const state = pr.state === 'closed' ? 'closed' : 'open';
  return {
    number: pr.number,
    title: pr.title,
    body: pr.body ?? '',
    state,
    branch: pr.head.ref,
    baseBranch: pr.base.ref,
    files,
    url: pr.html_url,
  };
}

/**
 * Maps a validated GitHub PR file response to PRFile domain type.
 * [SEC-PRIV-008] Data minimization
 */
function mapPRFileResponseToDomain(file: GitHubPRFileResponse): PRFile {
  const validStatuses = ['added', 'modified', 'removed'] as const;
  const status = validStatuses.includes(file.status as (typeof validStatuses)[number])
    ? (file.status as 'added' | 'modified' | 'removed')
    : 'modified';

  return {
    filename: file.filename,
    status,
    additions: file.additions,
    deletions: file.deletions,
  };
}

// ═══════════════════════════════════════════
// PUBLIC API — 6 Adapter Functions
// ═══════════════════════════════════════════

/**
 * Creates a status check on a PR commit.
 * [GH-INTEG-305] POST /repos/{owner}/{repo}/statuses/{sha}
 *
 * AC ref: AC-01 of .reqs.md
 * REGLA: [GH-INTEG-305], [SEC-PRIV-002], [FORGE-OPS-005]
 *
 * @param params - Status check parameters
 * @param repo - Repository in owner/repo format
 * @param sha - Commit SHA to attach the status check to
 * @param token - GitHub API token
 * @param executionId - Optional correlation ID for structured logging
 * @param timeoutMs - Optional timeout in milliseconds (default 8s)
 * @throws {TokenExpiredError} if token is expired (401)
 * @throws {GitHubApiError} on API failure
 * @throws {TimeoutError} if request exceeds timeout
 */
export async function createStatusCheck(
  params: GitHubStatusCheck,
  repo: string,
  sha: string,
  token: string,
  executionId?: string,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<void> {
  const operation = 'createStatusCheck';
  const url = buildUrl(`/repos/${repo}/statuses/${sha}`);

  // [GH-INTEG-305] Use specific context string
  const body = {
    state: params.state,
    target_url: params.targetUrl,
    description: params.description,
    context: params.context || STATUS_CHECK_CONTEXT,
  };

  await executeGitHubRequest(
    operation,
    url,
    token,
    { method: 'POST', body: JSON.stringify(body) },
    executionId,
    timeoutMs,
  );
}

/**
 * Publishes a Markdown comment on the PR.
 * [SEC-PRIV-002] No sensitive data in comments
 *
 * AC ref: AC-02 of .reqs.md
 * REGLA: [SEC-PRIV-002], [FORGE-OPS-005]
 *
 * @param repo - Repository in owner/repo format
 * @param prNumber - PR number
 * @param body - Comment body in Markdown
 * @param token - GitHub API token
 * @param executionId - Optional correlation ID for structured logging
 * @param timeoutMs - Optional timeout in milliseconds (default 8s)
 * @throws {TokenExpiredError} if token is expired (401)
 * @throws {GitHubApiError} on API failure
 * @throws {TimeoutError} if request exceeds timeout
 */
export async function createPRComment(
  repo: string,
  prNumber: number,
  body: string,
  token: string,
  executionId?: string,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<void> {
  const operation = 'createPRComment';
  const url = buildUrl(`/repos/${repo}/issues/${prNumber}/comments`);

  await executeGitHubRequest(
    operation,
    url,
    token,
    {
      method: 'POST',
      body: JSON.stringify({ body }),
    },
    executionId,
    timeoutMs,
  );
}

/**
 * Fetches PR data: title, description, branch, and files changed.
 * [GH-INTEG-301] Paginated file listing
 *
 * AC ref: AC-03 (partial), part of the data extraction pipeline
 * REGLA: [SEC-PRIV-004], [GH-INTEG-301], [FORGE-OPS-005]
 *
 * @param repo - Repository in owner/repo format
 * @param prNumber - PR number
 * @param token - GitHub API token
 * @param executionId - Optional correlation ID for structured logging
 * @param timeoutMs - Optional timeout in milliseconds (default 8s)
 * @returns Typed PR data with all fields populated
 * @throws {TokenExpiredError} if token is expired (401)
 * @throws {GitHubApiError} on API failure (404 for not found)
 * @throws {TimeoutError} if request exceeds timeout
 */
export async function getPRData(
  repo: string,
  prNumber: number,
  token: string,
  executionId?: string,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<GitHubPRData> {
  const operation = 'getPRData';
  const prUrl = buildUrl(`/repos/${repo}/pulls/${prNumber}`);

  // Fetch PR metadata
  const prResponse = await executeGitHubRequest(
    operation,
    prUrl,
    token,
    { method: 'GET' },
    executionId,
    timeoutMs,
  );

  const prData: unknown = await prResponse.json();

  if (!isGitHubPRResponse(prData)) {
    throw new GitHubApiError(
      `${operation}: invalid PR response structure for ${repo}#${prNumber}`,
      'GITHUB_INVALID_RESPONSE',
      executionId,
    );
  }

  // Fetch PR files (paginated) [GH-INTEG-301]
  const files = await listPRFiles(repo, prNumber, token, executionId, timeoutMs);

  return mapPRResponseToDomain(prData, files);
}

/**
 * Extracts Jira ticket IDs from PR title and body via regex.
 * Pure function — no API call.
 *
 * AC ref: AC-03 of .reqs.md
 * REGLA: [AC-03] — regex [A-Z]+-\d+
 *
 * @param pr - PR data to search for Jira keys
 * @returns Array of unique Jira ticket key strings
 */
export function extractJiraKeysFromPR(pr: GitHubPRData): string[] {
  const text = `${pr.title} ${pr.body}`;

  // Reset lastIndex for global regex
  JIRA_KEY_PATTERN.lastIndex = 0;
  const matches = text.match(JIRA_KEY_PATTERN);

  if (!matches) {
    return [];
  }

  // Deduplicate while preserving order
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const match of matches) {
    if (!seen.has(match)) {
      seen.add(match);
      unique.push(match);
    }
  }
  return unique;
}

/**
 * Updates an existing status check (for re-evaluation).
 *
 * AC ref: AC-01 of .reqs.md (update variant)
 * REGLA: [GH-INTEG-305], [FORGE-OPS-005]
 *
 * @param checkId - The ID of the existing status check
 * @param params - Partial status check fields to update
 * @param repo - Repository in owner/repo format (needed for endpoint)
 * @param sha - Commit SHA the check is attached to
 * @param token - GitHub API token
 * @param executionId - Optional correlation ID for structured logging
 * @param timeoutMs - Optional timeout in milliseconds (default 8s)
 * @throws {TokenExpiredError} if token is expired (401)
 * @throws {GitHubApiError} on API failure
 * @throws {TimeoutError} if request exceeds timeout
 */
export async function updateStatusCheck(
  checkId: string,
  params: Partial<GitHubStatusCheck>,
  repo: string,
  sha: string,
  token: string,
  executionId?: string,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<void> {
  const operation = 'updateStatusCheck';
  // GitHub REST API v3 uses POST to the same endpoint to create/update
  // The context field serves as the identifier for the check
  const url = buildUrl(`/repos/${repo}/statuses/${sha}`);

  const body: Record<string, unknown> = {};
  if (params.state !== undefined) body.state = params.state;
  if (params.targetUrl !== undefined) body.target_url = params.targetUrl;
  if (params.description !== undefined) body.description = params.description;
  if (params.context !== undefined) body.context = params.context;

  log('info', operation, executionId, { checkId, repo, sha });

  await executeGitHubRequest(
    operation,
    url,
    token,
    { method: 'POST', body: JSON.stringify(body) },
    executionId,
    timeoutMs,
  );
}

/**
 * Lists modified files in the PR for context analysis.
 * [GH-INTEG-301] Paginated via Link header, per_page=100
 *
 * AC ref: part of getPRData pipeline
 * REGLA: [GH-INTEG-301], [SEC-PRIV-004], [FORGE-OPS-005]
 *
 * @param repo - Repository in owner/repo format
 * @param prNumber - PR number
 * @param token - GitHub API token
 * @param executionId - Optional correlation ID for structured logging
 * @param timeoutMs - Optional timeout in milliseconds (default 8s)
 * @returns Array of PRFile with all files from all pages
 * @throws {TokenExpiredError} if token is expired (401)
 * @throws {GitHubApiError} on API failure
 * @throws {TimeoutError} if request exceeds timeout
 */
export async function listPRFiles(
  repo: string,
  prNumber: number,
  token: string,
  executionId?: string,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<PRFile[]> {
  const operation = 'listPRFiles';
  const allFiles: PRFile[] = [];
  let url: string | undefined = buildUrl(
    `/repos/${repo}/pulls/${prNumber}/files?per_page=${PER_PAGE}`,
  );

  while (url) {
    const response = await executeGitHubRequest(
      operation,
      url,
      token,
      { method: 'GET' },
      executionId,
      timeoutMs,
    );

    const data: unknown = await response.json();

    if (!Array.isArray(data)) {
      throw new GitHubApiError(
        `${operation}: expected array response for ${repo}#${prNumber}`,
        'GITHUB_INVALID_RESPONSE',
        executionId,
      );
    }

    for (const item of data) {
      if (!isGitHubPRFileResponse(item)) {
        log('warn', operation, executionId, { note: 'skipping_invalid_file_entry' });
        continue;
      }
      allFiles.push(mapPRFileResponseToDomain(item));
    }

    // [GH-INTEG-301] Follow Link header for pagination
    const linkHeader = response.headers.get('Link');
    const parsed = parseLinkHeader(linkHeader);
    url = parsed.next;
  }

  return allFiles;
}
