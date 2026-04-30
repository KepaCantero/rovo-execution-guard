// [ARCH-SOLID-058] Integration layer — wraps @forge/api requestJira
// [ARCH-SOLID-202] Zero any usage
// [ARCH-SOLID-053] Domain-specific error types for all failure paths
// [ARCH-SOLID-232] Named exports only, no export default
// [FORGE-OPS-005] Timeout via AbortController (default 10s)
// [FORGE-OPS-0105] Stateless functions, no module-level mutable state

import { route, asUser, type APIResponse, type FetchOptions } from '@forge/api';
import type { JiraTicketData, JiraTransition } from '../../types/jira-data';
import type { ProjectConfig } from '../../types/project-config';
import {
  JiraApiError,
  TicketNotFoundError,
  PermissionDeniedError,
  TransitionBlockedError,
  TimeoutError,
} from '../../types/errors';

// ═══════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════

/** [ARCH-SOLID-203] Type alias for Forge request options (from @forge/api FetchOptions) */
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

/** [ARCH-SOLID-203] Interface for validated Jira issue fields */
interface JiraIssueFields {
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
}

/** [ARCH-SOLID-203] Interface for raw Jira issue API response */
interface JiraIssueResponse {
  readonly fields: JiraIssueFields;
  readonly key: string;
}

/** [ARCH-SOLID-203] Interface for raw Jira transition object */
interface JiraTransitionResponse {
  readonly id: string;
  readonly name: string;
  readonly to: { readonly name: string };
}

// ═══════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════

/** [FORGE-OPS-005] Default timeout 10s (8s target + 2s margin per FORGE-OPS-0101) */
const DEFAULT_TIMEOUT_MS = 10_000;

/** [FORGE-OPS-005] Maximum timeout to never exceed 10s Forge limit */
const MAX_TIMEOUT_MS = 10_000;

/** Rate-limit retry configuration [AC-04] */
const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelayMs: 500,
  maxDelayMs: 8_000,
};

/** HTTP status codes */
const HTTP_FORBIDDEN = 403;
const HTTP_NOT_FOUND = 404;
const HTTP_RATE_LIMITED = 429;

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
 * [ARCH-SOLID-205] Explicit return type
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
function handleJiraError(
  statusCode: number,
  operation: string,
  executionId: string | undefined,
  issueKey?: string,
): never {
  const context = issueKey ? ` (issue: ${issueKey})` : '';

  if (statusCode === HTTP_NOT_FOUND) {
    throw new TicketNotFoundError(
      `${operation} failed: resource not found${context}`,
      'JIRA_NOT_FOUND',
      executionId,
    );
  }

  if (statusCode === HTTP_FORBIDDEN) {
    throw new PermissionDeniedError(
      `${operation} failed: permission denied${context}`,
      'JIRA_PERMISSION_DENIED',
      executionId,
    );
  }

  throw new JiraApiError(
    `${operation} failed with status ${statusCode}${context}`,
    'JIRA_API_ERROR',
    executionId,
  );
}

// ═══════════════════════════════════════════
// REQUEST EXECUTION WITH RETRY
// ═══════════════════════════════════════════

/**
 * Executes a Jira API request with timeout and rate-limit retry.
 * [ARCH-SOLID-052] Extracted helper to keep public functions concise
 * [ARCH-SOLID-233] async/await, no .then/.catch chains
 * [ARCH-SOLID-241] try/catch wrapping all async operations
 * [SEC-PRIV-004] Validates response before processing
 * [AC-04] Exponential backoff on HTTP 429
 * [AC-05] AbortController timeout
 */
async function executeJiraRequest(
  operation: string,
  urlPath: ReturnType<typeof route>,
  options: ForgeRequestOptions,
  executionId: string | undefined,
  timeoutMs: number,
  retryConfig: RetryConfig = DEFAULT_RETRY_CONFIG,
): Promise<APIResponse> {
  const { signal, clear } = createAbortController(timeoutMs);

  try {
    log('info', operation, executionId, { url: urlPath.value, method: options.method ?? 'GET' });

    let lastResponse: APIResponse | undefined;

    for (let attempt = 0; attempt <= retryConfig.maxRetries; attempt++) {
      try {
        const response = await asUser().requestJira(urlPath, { ...options, signal });

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
            'JIRA_TIMEOUT',
            executionId,
          );
        }
        throw new JiraApiError(
          `${operation} network error: ${extractMessage(err)}`,
          'JIRA_NETWORK_ERROR',
          executionId,
        );
      }
    }

    // After the loop, lastResponse must be set — either a non-429 response was received,
    // or we exhausted retries on the last 429 and lastResponse was set before breaking.
    if (!lastResponse) {
      throw new JiraApiError(
        `${operation}: no response received after retries`,
        'JIRA_NO_RESPONSE',
        executionId,
      );
    }

    if (!lastResponse.ok) {
      handleJiraError(lastResponse.status, operation, executionId);
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
 * Validates a raw API response is a Jira issue object.
 * [SEC-PRIV-004] Validate external API responses before casting
 * [ARCH-SOLID-202] Zero any — unknown with type narrowing
 */
function isJiraIssueResponse(data: unknown): data is JiraIssueResponse {
  return (
    typeof data === 'object' &&
    data !== null &&
    'key' in data &&
    typeof (data as JiraIssueResponse).key === 'string' &&
    'fields' in data &&
    typeof (data as JiraIssueResponse).fields === 'object' &&
    (data as JiraIssueResponse).fields !== null
  );
}

/**
 * Maps a validated Jira issue response to JiraTicketData.
 * [ARCH-SOLID-003] Extract only needed fields, not full body
 * [SEC-PRIV-008] Data minimization
 */
function mapIssueToTicketData(issue: JiraIssueResponse): JiraTicketData {
  const fields = issue.fields;
  return {
    key: issue.key,
    summary: fields.summary,
    description: fields.description ?? '',
    status: fields.status.name,
    assignee: fields.assignee?.displayName,
    reporter: fields.reporter?.displayName,
    priority: fields.priority?.name,
    issueType: fields.issuetype.name,
    labels: [...fields.labels],
    projectKey: fields.project.key,
    created: fields.created,
    updated: fields.updated,
  };
}

/**
 * Maps raw transition data to domain JiraTransition.
 * [SEC-PRIV-008] Data minimization — only id, name, toStatus
 */
function mapTransitionResponse(t: JiraTransitionResponse): JiraTransition {
  return {
    id: t.id,
    name: t.name,
    toStatus: t.to.name,
  };
}

// ═══════════════════════════════════════════
// PUBLIC API — 7 Adapter Functions
// ═══════════════════════════════════════════

/**
 * Fetches complete ticket data for a given issue key.
 *
 * AC ref: AC-01 of .reqs.md
 * REGLA: [FORGE-OPS-005] - timeout, [SEC-PRIV-004] - response validation
 *
 * @param issueKey - Jira issue key (e.g., "PROJ-123")
 * @param executionId - Optional correlation ID for structured logging
 * @param timeoutMs - Optional timeout in milliseconds (default 10s)
 * @returns Typed ticket data with all fields populated
 * @throws {TicketNotFoundError} if issue not found (404)
 * @throws {PermissionDeniedError} if access denied (403)
 * @throws {TimeoutError} if request exceeds timeout
 */
export async function getTicketData(
  issueKey: string,
  executionId?: string,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<JiraTicketData> {
  const operation = 'getTicketData';
  const urlPath = route`/rest/api/2/issue/${issueKey}?fields=summary,description,status,assignee,reporter,priority,issuetype,labels,project,created,updated`;

  const response = await executeJiraRequest(
    operation,
    urlPath,
    { method: 'GET' },
    executionId,
    timeoutMs,
  );

  const data: unknown = await response.json();

  if (!isJiraIssueResponse(data)) {
    throw new JiraApiError(
      `${operation}: invalid response structure for issue ${issueKey}`,
      'JIRA_INVALID_RESPONSE',
      executionId,
    );
  }

  return mapIssueToTicketData(data);
}

/**
 * Retrieves project-level configuration for the execution guard.
 *
 * AC ref: AC-01 of .reqs.md
 * REGLA: [SEC-PRIV-004] - response validation
 *
 * @param projectKey - Jira project key
 * @param executionId - Optional correlation ID
 * @param timeoutMs - Optional timeout in milliseconds (default 10s)
 * @returns ProjectConfig (default config if none stored)
 * @throws {PermissionDeniedError} if access denied (403)
 * @throws {TimeoutError} if request exceeds timeout
 */
export async function getProjectConfig(
  projectKey: string,
  executionId?: string,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<ProjectConfig> {
  const operation = 'getProjectConfig';
  const urlPath = route`/rest/api/2/project/${projectKey}/properties/com.rovo.execution-guard.config`;

  try {
    const response = await executeJiraRequest(
      operation,
      urlPath,
      { method: 'GET' },
      executionId,
      timeoutMs,
    );

    const data: unknown = await response.json();
    return parseProjectConfig(data, projectKey, executionId);
  } catch (err: unknown) {
    if (err instanceof TicketNotFoundError) {
      log('info', operation, executionId, {
        projectKey,
        note: 'no stored config, returning defaults',
      });
      return createDefaultProjectConfig(projectKey);
    }
    throw err;
  }
}

/**
 * Persists project configuration via Jira entity properties.
 *
 * AC ref: AC-01 of .reqs.md
 * REGLA: [SEC-PRIV-004] - request validation
 *
 * @param config - Valid ProjectConfig to persist
 * @param executionId - Optional correlation ID
 * @param timeoutMs - Optional timeout in milliseconds (default 10s)
 * @throws {PermissionDeniedError} if access denied (403)
 * @throws {TimeoutError} if request exceeds timeout
 */
export async function saveProjectConfig(
  config: ProjectConfig,
  executionId?: string,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<void> {
  const operation = 'saveProjectConfig';
  const urlPath = route`/rest/api/2/project/${config.projectKey}/properties/com.rovo.execution-guard.config`;

  await executeJiraRequest(
    operation,
    urlPath,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    },
    executionId,
    timeoutMs,
  );
}

/**
 * Transitions an issue using the given transition ID.
 *
 * AC ref: AC-01 of .reqs.md
 * REGLA: [ARCH-SOLID-053] - TransitionBlockedError for disallowed transitions
 *
 * @param issueKey - Jira issue key
 * @param transitionId - Transition ID to execute
 * @param executionId - Optional correlation ID
 * @param timeoutMs - Optional timeout in milliseconds (default 10s)
 * @throws {TicketNotFoundError} if issue not found (404)
 * @throws {PermissionDeniedError} if access denied (403)
 * @throws {TransitionBlockedError} if transition is not allowed
 * @throws {TimeoutError} if request exceeds timeout
 */
export async function transitionIssue(
  issueKey: string,
  transitionId: string,
  executionId?: string,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<void> {
  const operation = 'transitionIssue';
  const urlPath = route`/rest/api/2/issue/${issueKey}/transitions`;

  const response = await executeJiraRequest(
    operation,
    urlPath,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transition: { id: transitionId } }),
    },
    executionId,
    timeoutMs,
  );

  await validateTransitionResponse(response, issueKey, executionId);
}

/**
 * Returns available transitions for the given issue.
 *
 * AC ref: AC-01 of .reqs.md
 * REGLA: [SEC-PRIV-004] - response validation
 *
 * @param issueKey - Jira issue key
 * @param executionId - Optional correlation ID
 * @param timeoutMs - Optional timeout in milliseconds (default 10s)
 * @returns Readonly array of available transitions
 * @throws {TicketNotFoundError} if issue not found (404)
 * @throws {PermissionDeniedError} if access denied (403)
 * @throws {TimeoutError} if request exceeds timeout
 */
export async function getTransitions(
  issueKey: string,
  executionId?: string,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<readonly JiraTransition[]> {
  const operation = 'getTransitions';
  const urlPath = route`/rest/api/2/issue/${issueKey}/transitions`;

  const response = await executeJiraRequest(
    operation,
    urlPath,
    { method: 'GET' },
    executionId,
    timeoutMs,
  );

  const data: unknown = await response.json();

  if (!isTransitionsResponse(data)) {
    throw new JiraApiError(
      `${operation}: invalid transitions response for issue ${issueKey}`,
      'JIRA_INVALID_RESPONSE',
      executionId,
    );
  }

  return data.transitions.map(mapTransitionResponse);
}

/**
 * Adds a comment to the specified issue.
 *
 * AC ref: AC-01 of .reqs.md
 * REGLA: [SEC-PRIV-002] - no sensitive data in comments
 *
 * @param issueKey - Jira issue key
 * @param body - Comment body (Markdown supported)
 * @param executionId - Optional correlation ID
 * @param timeoutMs - Optional timeout in milliseconds (default 10s)
 * @throws {TicketNotFoundError} if issue not found (404)
 * @throws {PermissionDeniedError} if access denied (403)
 * @throws {TimeoutError} if request exceeds timeout
 */
export async function addComment(
  issueKey: string,
  body: string,
  executionId?: string,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<void> {
  const operation = 'addComment';
  const urlPath = route`/rest/api/2/issue/${issueKey}/comment`;

  await executeJiraRequest(
    operation,
    urlPath,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body }),
    },
    executionId,
    timeoutMs,
  );
}

/**
 * Returns the current status name of the issue.
 *
 * AC ref: AC-01 of .reqs.md
 * REGLA: [ARCH-SOLID-003] - only request status field, not full body
 *
 * @param issueKey - Jira issue key
 * @param executionId - Optional correlation ID
 * @param timeoutMs - Optional timeout in milliseconds (default 10s)
 * @returns Status name as string
 * @throws {TicketNotFoundError} if issue not found (404)
 * @throws {PermissionDeniedError} if access denied (403)
 * @throws {TimeoutError} if request exceeds timeout
 */
export async function getIssueStatus(
  issueKey: string,
  executionId?: string,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<string> {
  const operation = 'getIssueStatus';
  const urlPath = route`/rest/api/2/issue/${issueKey}?fields=status`;

  const response = await executeJiraRequest(
    operation,
    urlPath,
    { method: 'GET' },
    executionId,
    timeoutMs,
  );

  const data: unknown = await response.json();

  if (!isJiraIssueResponse(data)) {
    throw new JiraApiError(
      `${operation}: invalid response for issue ${issueKey}`,
      'JIRA_INVALID_RESPONSE',
      executionId,
    );
  }

  return data.fields.status.name;
}

// ═══════════════════════════════════════════
// PRIVATE HELPERS — Validation & Parsing
// ═══════════════════════════════════════════

/**
 * Validates that a transition response doesn't indicate a blocked transition.
 * [ARCH-SOLID-053] TransitionBlockedError for disallowed transitions
 * [SEC-PRIV-004] Validate response
 */
async function validateTransitionResponse(
  response: APIResponse,
  issueKey: string,
  executionId: string | undefined,
): Promise<void> {
  const contentLength = response.headers.get('content-length');
  if (!contentLength || contentLength === '0') {
    return;
  }

  const text = await response.text();
  if (!text) {
    return;
  }

  try {
    const parsed: unknown = JSON.parse(text);
    if (isTransitionError(parsed)) {
      throw new TransitionBlockedError(
        `Transition rejected for issue ${issueKey}: ${parsed.errorMessages.join('; ')}`,
        'JIRA_TRANSITION_BLOCKED',
        executionId,
      );
    }
  } catch (err: unknown) {
    if (err instanceof TransitionBlockedError) {
      throw err;
    }
    // Non-JSON body after a 2xx is fine — transition succeeded
  }
}

/** [ARCH-SOLID-202] Type guard for Jira transition error response */
function isTransitionError(data: unknown): data is {
  errorMessages: readonly string[];
} {
  return (
    typeof data === 'object' &&
    data !== null &&
    'errorMessages' in data &&
    Array.isArray((data as { errorMessages: unknown }).errorMessages)
  );
}

/** [ARCH-SOLID-202] Type guard for transitions response */
function isTransitionsResponse(data: unknown): data is {
  transitions: readonly JiraTransitionResponse[];
} {
  return (
    typeof data === 'object' &&
    data !== null &&
    'transitions' in data &&
    Array.isArray((data as { transitions: unknown }).transitions)
  );
}

/**
 * Parses a raw entity property value into a ProjectConfig.
 * [SEC-PRIV-004] Validates structure before casting
 */
function parseProjectConfig(
  data: unknown,
  projectKey: string,
  executionId: string | undefined,
): ProjectConfig {
  if (typeof data !== 'object' || data === null || !('value' in data)) {
    throw new JiraApiError(
      `getProjectConfig: invalid config response for project ${projectKey}`,
      'JIRA_INVALID_RESPONSE',
      executionId,
    );
  }

  const value = (data as { value: unknown }).value;

  if (!isValidProjectConfig(value)) {
    throw new JiraApiError(
      `getProjectConfig: malformed config for project ${projectKey}`,
      'JIRA_INVALID_RESPONSE',
      executionId,
    );
  }

  return value;
}

/** [ARCH-SOLID-202] Type guard for ProjectConfig validation */
function isValidProjectConfig(value: unknown): value is ProjectConfig {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj['projectKey'] === 'string' &&
    typeof obj['enabled'] === 'boolean' &&
    typeof obj['scoreThreshold'] === 'number' &&
    typeof obj['gates'] === 'object' &&
    obj['gates'] !== null
  );
}

/** Creates a default ProjectConfig when none is stored */
function createDefaultProjectConfig(projectKey: string): ProjectConfig {
  return {
    projectKey,
    enabled: false,
    scoreThreshold: 80,
    gates: {
      definition: true,
      execution: true,
      delivery: true,
    },
  };
}
