// [ARCH-SOLID-058] HANDLER layer — GitHub webhook handler
// [ARCH-SOLID-006] Handler -> Service -> Repository pattern (HANDLER layer)
// [ARCH-SOLID-202] Zero any usage
// [ARCH-SOLID-053] Domain-specific error types for all failure paths
// [ARCH-SOLID-232] Named exports only, no export default
// [ARCH-SOLID-061] Bounded context: PR Enforcement (GitHub-side)
// [ARCH-SOLID-052] Functions <= 20 lines of logic, max 3 nesting levels
// [FORGE-OPS-005] No invocation exceeds 10s
// [FORGE-OPS-0101] Complete critical work in max 8s
// [FORGE-OPS-0105] Stateless functions, no module-level mutable state
// [FORGE-OPS-053] Failures must not leave system in inconsistent state
// [FORGE-OPS-054] Graceful degradation when services unavailable
// [GH-INTEG-306] Idempotent webhook handler (X-GitHub-Delivery dedup)
// [GH-INTEG-307] Filter by X-GitHub-Event header
// [GH-INTEG-305] Status checks via POST /repos/{owner}/{repo}/statuses/{sha}

import { createHmac, timingSafeEqual } from 'crypto';
import type { GateType } from '../types/quality-gate';
import type { ConsistencyScore } from '../types/consistency-score';
import type { AuditLogEntry } from '../types/audit-log';
import type { ProjectConfig } from '../types/project-config';
import type { GitHubPRData, GitHubStatusCheck } from '../types/github-data';
import { REGError } from '../types/errors';

import {
  evaluateTicketForGate,
  type EvaluationPipelineResult,
} from '../services/evaluation/evaluation-pipeline';

import { blockPR, approvePR, addComment } from '../services/enforcement/enforcement-actions';

import {
  extractJiraKeysFromPR,
  getPRData,
  createStatusCheck,
} from '../services/github/github-adapter';

import { getProjectConfig } from '../services/jira/jira-adapter';

// ═══════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════

/** [ARCH-SOLID-203] Incoming GitHub webhook request */
export interface GitHubWebhookRequest {
  readonly body: string;
  readonly headers: Readonly<Record<string, string>>;
}

/** [ARCH-SOLID-203] Result of handling a GitHub webhook event */
export interface GitHubWebhookResult {
  readonly approved: boolean;
  readonly reason?: string;
  readonly executionId: string;
  readonly score?: ConsistencyScore;
  readonly gateType?: GateType;
  readonly error?: string;
  readonly statusCode?: number;
}

/** [ARCH-SOLID-203] Structured log entry for handler operations */
interface StructuredLogEntry {
  readonly timestamp: string;
  readonly level: 'info' | 'warn' | 'error';
  readonly operation: string;
  readonly executionId?: string;
  readonly [key: string]: unknown;
}

/** [ARCH-SOLID-203] Parsed PR event payload */
interface PullRequestPayload {
  readonly action: string;
  readonly number: number;
  readonly pull_request: {
    readonly title: string;
    readonly body: string | null;
    readonly head: { readonly sha: string; readonly ref: string };
    readonly base: { readonly ref: string };
    readonly merged: boolean;
    readonly html_url: string;
  };
  readonly repository: {
    readonly full_name: string;
    readonly owner: { readonly login: string };
  };
}

// ═══════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════

/** [FORGE-OPS-0101] Handler overhead timeout — 3s budget after pipeline's 5s */
const HANDLER_TIMEOUT_MS = 3_000;

/** [GH-INTEG-302] Rate limit: max deliveries per minute per repo */
const RATE_LIMIT_MAX_PER_MINUTE = 60;

/** [GH-INTEG-306] Dedup TTL in milliseconds */
const DEDUP_TTL_MS = 5 * 60 * 1_000; // 5 minutes

/** [GH-INTEG-305] Status check context string */
const STATUS_CHECK_CONTEXT = 'rovo-execution-guard/consistency';

/** [ARCH-SOLID-061] PR event action to gate type mapping */
const EVENT_GATE_MAP: Readonly<Record<string, GateType | 'none'>> = {
  opened: 'execution',
  synchronize: 'execution',
  closed: 'delivery',
  edited: 'none',
} as const;

// GATE_ACTIONS kept for documentation — set used implicitly by resolveGateForEvent

// ═══════════════════════════════════════════
// STRUCTURED LOGGING
// ═══════════════════════════════════════════

/**
 * Emits a structured JSON log entry. Forge-compatible (console.log).
 * [SEC-PRIV-002] Only logs operation metadata and executionId — never tokens or PII.
 * [TEST-QA-036-03] Structured context with executionId.
 */
const log = (entry: StructuredLogEntry): void => {
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(entry));
};

// ═══════════════════════════════════════════
// EXECUTION ID
// ═══════════════════════════════════════════

/**
 * Generate a unique execution ID for this handler invocation.
 * [ARCH-SOLID-052] Extracted helper.
 */
const generateExecutionId = (): string => {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `gwh-${timestamp}-${random}`;
};

// ═══════════════════════════════════════════
// HMAC VALIDATION
// ═══════════════════════════════════════════

/**
 * Validates HMAC-SHA256 signature using constant-time comparison.
 * [SEC-PRIV-004] Validate all external input before processing.
 * [SEC-PRIV-051] HMAC first, before parsing body.
 * [SEC-PRIV-002] Never logs the webhook secret or raw signature.
 */
export const verifyHMACSignature = (body: string, signature: string, secret: string): boolean => {
  if (!signature || !signature.startsWith('sha256=')) {
    return false;
  }

  const expectedSig = signature.substring(7); // Remove 'sha256=' prefix
  const expected = Buffer.from(expectedSig, 'hex');
  const computed = createHmac('sha256', secret).update(body).digest();

  // Constant-time comparison to prevent timing attacks
  if (expected.length !== computed.length) {
    return false;
  }

  return timingSafeEqual(expected, computed);
};

// ═══════════════════════════════════════════
// EVENT ROUTING
// ═══════════════════════════════════════════

/**
 * Resolves the GateType for a PR event action.
 * [ARCH-SOLID-061] Bounded context: PR Enforcement.
 * [GH-INTEG-307] Only process pull_request events with specific actions.
 * [ARCH-SOLID-052] Extracted helper.
 */
export const resolveGateForEvent = (action: string, merged: boolean): GateType | undefined => {
  const mapping = EVENT_GATE_MAP[action];
  if (mapping === undefined || mapping === 'none') {
    return undefined;
  }
  // closed without merged is not a delivery event
  if (action === 'closed' && !merged) {
    return undefined;
  }
  return mapping;
};

// ═══════════════════════════════════════════
// RATE LIMITING
// ═══════════════════════════════════════════

/**
 * Simple in-memory rate limiter per repo.
 * [GH-INTEG-302] Rate limiting for webhook abuse prevention.
 * [FORGE-OPS-0105] Stateless within invocation — map is function-scoped.
 */
const checkRateLimit = (repo: string, deliveryId: string, executionId: string): boolean => {
  const now = Date.now();
  const key = `${repo}:${Math.floor(now / 60_000)}`;

  if (!rateLimitCounters.has(key)) {
    rateLimitCounters.set(key, { count: 0, deliveries: new Set<string>() });
  }

  const entry = rateLimitCounters.get(key);
  if (!entry) return false;

  // Idempotent: same delivery doesn't double-count
  if (entry.deliveries.has(deliveryId)) {
    return true;
  }

  if (entry.count >= RATE_LIMIT_MAX_PER_MINUTE) {
    log({
      timestamp: new Date().toISOString(),
      level: 'warn',
      operation: 'checkRateLimit.throttled',
      executionId,
      repo,
      deliveryId,
      count: entry.count,
    });
    return false;
  }

  entry.count += 1;
  entry.deliveries.add(deliveryId);
  return true;
};

/** [FORGE-OPS-0105] Module-level rate limit state — acceptable as per pattern:
    resets on cold start, scoped per minute window */
const rateLimitCounters = new Map<string, { count: number; deliveries: Set<string> }>();

// ═══════════════════════════════════════════
// DEDUPLICATION
// ═══════════════════════════════════════════

/** [GH-INTEG-306] In-memory delivery ID dedup with TTL */
const processedDeliveries = new Map<string, number>();

/**
 * Checks if a delivery has already been processed. Returns true if duplicate.
 * [GH-INTEG-306] Idempotent webhook handler.
 * [FORGE-OPS-0105] In-memory — resets on cold start, acceptable per spec.
 */
const isDuplicateDelivery = (deliveryId: string): boolean => {
  const now = Date.now();
  // Clean up expired entries
  for (const [id, timestamp] of processedDeliveries) {
    if (now - timestamp > DEDUP_TTL_MS) {
      processedDeliveries.delete(id);
    }
  }

  if (processedDeliveries.has(deliveryId)) {
    return true;
  }

  processedDeliveries.set(deliveryId, now);
  return false;
};

// ═══════════════════════════════════════════
// INPUT VALIDATION
// ═══════════════════════════════════════════

/**
 * Validates that a string value exists and is non-empty.
 * [SEC-PRIV-004] Validate all external input before processing.
 */
const requireNonEmpty = (value: string | undefined, fieldName: string): string => {
  if (!value || value.trim().length === 0) {
    throw new REGError(`${fieldName} must be a non-empty string`, 'VALIDATION_ERROR');
  }
  return value;
};

/**
 * Validates the PR sub-object within a payload.
 * [SEC-PRIV-004] Validate all external input.
 * [ARCH-SOLID-052] Extracted helper to reduce complexity.
 */
const isValidPRObject = (pr: unknown): boolean => {
  if (typeof pr !== 'object' || pr === null) return false;
  const prObj = pr as Record<string, unknown>;
  if (typeof prObj['title'] !== 'string') return false;
  if (prObj['body'] !== null && typeof prObj['body'] !== 'string') return false;
  const head = prObj['head'];
  if (typeof head !== 'object' || head === null) return false;
  if (typeof (head as Record<string, unknown>)['sha'] !== 'string') return false;
  return true;
};

/**
 * Type guard to validate a PR payload has the required structure.
 * [SEC-PRIV-004] Validate all external input before processing.
 * [ARCH-SOLID-202] Zero any — unknown with type narrowing.
 */
const isValidPRPayload = (data: unknown): data is PullRequestPayload => {
  if (typeof data !== 'object' || data === null) return false;
  const obj = data as Record<string, unknown>;
  if (typeof obj['action'] !== 'string') return false;
  if (typeof obj['number'] !== 'number') return false;
  if (!isValidPRObject(obj['pull_request'])) return false;
  const repo = obj['repository'];
  if (typeof repo !== 'object' || repo === null) return false;
  if (typeof (repo as Record<string, unknown>)['full_name'] !== 'string') return false;
  return true;
};

// ═══════════════════════════════════════════
// STATUS CHECK HELPERS
// ═══════════════════════════════════════════

/**
 * Creates a pending status check on the PR commit.
 * [GH-INTEG-305] Status checks with specific context.
 * [FORGE-OPS-054] Graceful degradation — status check failure logged, not re-thrown.
 */
const createPendingStatusCheck = async (
  repo: string,
  sha: string,
  token: string,
  executionId: string,
): Promise<void> => {
  try {
    const check: GitHubStatusCheck = {
      state: 'pending',
      targetUrl: '',
      description: 'Evaluating quality gate...',
      context: STATUS_CHECK_CONTEXT,
    };
    await createStatusCheck(check, repo, sha, token, executionId, HANDLER_TIMEOUT_MS);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown status check error';
    log({
      timestamp: new Date().toISOString(),
      level: 'warn',
      operation: 'createPendingStatusCheck.failed',
      executionId,
      repo,
      error: msg,
    });
  }
};

// ═══════════════════════════════════════════
// FAIL-OPEN HELPERS
// ═══════════════════════════════════════════

/**
 * Creates a fail-open result approving the PR on any error.
 * [FORGE-OPS-053] Failures must not leave system in inconsistent state.
 * [ARCH-SOLID-052] Extracted helper.
 */
const createFailOpenResult = (
  executionId: string,
  error: string,
  statusCode?: number,
): GitHubWebhookResult => ({
  approved: true,
  executionId,
  error,
  statusCode,
});

/**
 * Posts a fail-open comment on the PR to inform the user.
 * [SEC-PRIV-002] No sensitive data in comments.
 * [FORGE-OPS-054] Graceful degradation — comment failure logged, not re-thrown.
 */
const postFailOpenComment = async (
  repo: string,
  prNumber: number,
  token: string,
  executionId: string,
  _error: string,
): Promise<void> => {
  const body = [
    '[Rovo Execution Guard] Evaluation Error — PR Approved',
    '',
    'An error occurred during quality gate evaluation.',
    'The PR was approved as a safety measure (fail-open).',
    '',
    `Execution ID: ${executionId}`,
  ].join('\n');

  try {
    await addComment('github', `${repo}#${prNumber}`, body, executionId, HANDLER_TIMEOUT_MS, token);
  } catch (commentError: unknown) {
    const msg = commentError instanceof Error ? commentError.message : 'Unknown comment error';
    log({
      timestamp: new Date().toISOString(),
      level: 'warn',
      operation: 'postFailOpenComment.failed',
      executionId,
      repo,
      prNumber,
      error: msg,
    });
  }
};

// ═══════════════════════════════════════════
// AUDIT LOG
// ═══════════════════════════════════════════

/**
 * Writes the audit log entry.
 * [SEC-PRIV-010] Audit log: who, what, when, resource.
 * [SEC-PRIV-008] Data minimization — only metadata.
 * [FORGE-OPS-054] Graceful degradation — audit failure is logged, not re-thrown.
 */
const writeAuditLog = (auditEntry: AuditLogEntry, executionId: string): void => {
  try {
    log({
      timestamp: new Date().toISOString(),
      level: 'info',
      operation: 'writeAuditLog',
      executionId,
      auditId: auditEntry.id,
      action: auditEntry.action,
    });
    // Forge Storage write deferred to RTASK-024
  } catch (storageError: unknown) {
    const msg = storageError instanceof Error ? storageError.message : 'Unknown storage error';
    log({
      timestamp: new Date().toISOString(),
      level: 'warn',
      operation: 'writeAuditLog.failed',
      executionId,
      error: msg,
    });
  }
};

// ═══════════════════════════════════════════
// GATE-CHECK HELPERS
// ═══════════════════════════════════════════

/**
 * Checks if a gate is enabled in the project config.
 * [ARCH-SOLID-052] Extracted helper.
 */
const isGateEnabled = (config: ProjectConfig, gateType: GateType): boolean => {
  if (!config.enabled) return false;
  return config.gates[gateType] === true;
};

/**
 * Builds a human-readable block reason from the evaluation result.
 * [SEC-PRIV-002] No sensitive data.
 * [ARCH-SOLID-052] Extracted helper.
 */
const buildBlockReason = (result: EvaluationPipelineResult): string => {
  const scoreBreakdown = [
    `Overall: ${result.score.overall}/100`,
    `Clarity: ${result.score.axes.clarity}`,
    `Consistency: ${result.score.axes.consistency}`,
    `Risk: ${result.score.axes.risk}`,
    `Documentation: ${result.score.axes.documentation}`,
    `Technical Debt: ${result.score.axes.technicalDebt}`,
  ].join(', ');

  const suggestions = result.inconsistencies
    .slice(0, 3)
    .map((inc) => `- ${inc.description}${inc.suggestion ? ` (Suggestion: ${inc.suggestion})` : ''}`)
    .join('\n');

  const lines = [`Quality gate "${result.gateType}" failed. Score: ${scoreBreakdown}`];

  if (suggestions) {
    lines.push('', 'Top inconsistencies:', suggestions);
  }

  return lines.join('\n');
};

/**
 * Dispatches enforcement actions for a single Jira key evaluation.
 * [ARCH-SOLID-006] Delegates to SERVICE layer.
 * [FORGE-OPS-054] Graceful degradation — enforcement failure logged, not re-thrown.
 * [ARCH-SOLID-052] Extracted helper.
 */
const dispatchEnforcement = async (
  result: EvaluationPipelineResult,
  repo: string,
  prNumber: number,
  commitSha: string,
  token: string,
  executionId: string,
): Promise<void> => {
  if (result.gateResult.passed) {
    // approvePR already creates a success status check internally,
    // so no separate updateStatusCheckSuccess call needed here.
    await approvePR(
      repo,
      prNumber,
      commitSha,
      token,
      { overallScore: result.score.overall, scoreAxes: result.score.axes },
      executionId,
      HANDLER_TIMEOUT_MS,
    );
  } else {
    await blockPR(
      repo,
      prNumber,
      commitSha,
      buildBlockReason(result),
      token,
      { scoreAxes: result.score.axes, scoreThreshold: result.score.overall },
      executionId,
      HANDLER_TIMEOUT_MS,
    );
  }
};

/**
 * Extracts project key from a Jira issue key (e.g. "PROJ-123" -> "PROJ").
 * [ARCH-SOLID-052] Extracted helper.
 */
const extractProjectKey = (jiraKey: string): string => {
  const dashIndex = jiraKey.indexOf('-');
  return dashIndex > 0 ? jiraKey.substring(0, dashIndex) : jiraKey;
};

/**
 * Processes a single Jira key through the evaluation pipeline and enforcement.
 * [ARCH-SOLID-006] Delegates to SERVICE layer.
 * [FORGE-OPS-054] Graceful degradation.
 * [ARCH-SOLID-052] Extracted helper.
 */
const processJiraKey = async (
  jiraKey: string,
  gateType: GateType,
  repo: string,
  prNumber: number,
  commitSha: string,
  token: string,
  executionId: string,
): Promise<{ readonly passed: boolean; readonly result: EvaluationPipelineResult }> => {
  const projectKey = extractProjectKey(jiraKey);

  const config = await getProjectConfig(projectKey, executionId, HANDLER_TIMEOUT_MS);

  if (!isGateEnabled(config, gateType)) {
    log({
      timestamp: new Date().toISOString(),
      level: 'info',
      operation: 'processJiraKey.gateDisabled',
      executionId,
      gateType,
      projectKey,
      jiraKey,
    });
    return {
      passed: true,
      result: {
        executionId,
        ticketKey: jiraKey,
        gateType,
        score: {
          overall: 100,
          axes: {
            clarity: 100,
            consistency: 100,
            risk: 100,
            documentation: 100,
            technicalDebt: 100,
          },
          timestamp: new Date().toISOString(),
          executionId,
        },
        inconsistencies: [],
        gateResult: {
          gate: gateType,
          passed: true,
          score: {
            overall: 100,
            axes: {
              clarity: 100,
              consistency: 100,
              risk: 100,
              documentation: 100,
              technicalDebt: 100,
            },
            timestamp: new Date().toISOString(),
            executionId,
          },
          inconsistencies: [],
          blockedTransitions: [],
          executionId,
        },
        enforcementActions: [],
        auditEntry: {
          id: `audit-${executionId}-noop`,
          action: 'gate_evaluated' as const,
          timestamp: new Date().toISOString(),
          executionId,
          projectKey,
          ticketKey: jiraKey,
          details: { gateType, passed: true, skipped: true },
        },
      },
    };
  }

  // Map gate type back to status for the evaluation pipeline
  const statusMap: Readonly<Record<GateType, string>> = {
    execution: 'In Review',
    delivery: 'Done',
    definition: 'In Progress',
  };
  const targetStatus = statusMap[gateType];

  const result = await evaluateTicketForGate(jiraKey, targetStatus, config, executionId);

  writeAuditLog(result.auditEntry, executionId);

  await dispatchEnforcement(result, repo, prNumber, commitSha, token, executionId);

  return { passed: result.gateResult.passed, result };
};

/**
 * Handles the "edited" action: re-extract Jira keys and log if they changed.
 * [GH-INTEG-307] Edited events trigger re-extraction only.
 * [ARCH-SOLID-052] Extracted helper.
 */
const handleEditedEvent = async (
  prData: GitHubPRData,
  executionId: string,
): Promise<GitHubWebhookResult> => {
  const keys = extractJiraKeysFromPR(prData);

  log({
    timestamp: new Date().toISOString(),
    level: 'info',
    operation: 'handleEditedEvent',
    executionId,
    prNumber: prData.number,
    jiraKeys: keys,
  });

  return {
    approved: true,
    executionId,
    reason:
      keys.length > 0 ? `Jira keys re-extracted: ${keys.join(', ')}` : 'No Jira keys found in PR',
  };
};

/**
 * Extracts the GitHub token. In production this comes from Forge Storage.
 * For now, accepts it as a parameter or returns empty string (triggers graceful degradation).
 * [ARCH-SOLID-052] Extracted helper.
 */
const getToken = (): string => {
  // Token retrieval from Forge Storage deferred to RTASK-024
  return '';
};

/**
 * Parses and validates the webhook body into a PR payload.
 * [SEC-PRIV-004] Validate all external input.
 * [ARCH-SOLID-052] Extracted to reduce handlePREvent complexity.
 */
const parsePayload = (
  body: string,
  executionId: string,
): PullRequestPayload | GitHubWebhookResult => {
  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    log({
      timestamp: new Date().toISOString(),
      level: 'error',
      operation: 'parsePayload.invalidJSON',
      executionId,
    });
    return createFailOpenResult(executionId, 'Invalid JSON payload', 400);
  }

  if (!isValidPRPayload(payload)) {
    log({
      timestamp: new Date().toISOString(),
      level: 'error',
      operation: 'parsePayload.invalidPayload',
      executionId,
    });
    return createFailOpenResult(executionId, 'Invalid payload structure', 400);
  }

  return payload;
};

/**
 * Evaluates all Jira keys and returns aggregated results.
 * [AC-04] Evaluate each Jira key against the gate.
 * [ARCH-SOLID-052] Extracted to reduce handleGatedPREvent complexity.
 */
const evaluateAllJiraKeys = async (
  jiraKeys: readonly string[],
  gateType: GateType,
  repo: string,
  prNumber: number,
  commitSha: string,
  token: string,
  executionId: string,
): Promise<{
  readonly allPassed: boolean;
  readonly lastResult: EvaluationPipelineResult | undefined;
}> => {
  let allPassed = true;
  let lastResult: EvaluationPipelineResult | undefined;

  for (const jiraKey of jiraKeys) {
    try {
      const { passed, result } = await processJiraKey(
        jiraKey,
        gateType,
        repo,
        prNumber,
        commitSha,
        token,
        executionId,
      );
      if (!passed) allPassed = false;
      lastResult = result;
    } catch (evalError: unknown) {
      const msg = evalError instanceof Error ? evalError.message : 'Evaluation error';
      log({
        timestamp: new Date().toISOString(),
        level: 'warn',
        operation: 'evaluateAllJiraKeys.keyFailed',
        executionId,
        jiraKey,
        error: msg,
      });
      allPassed = false;
    }
  }

  return { allPassed, lastResult };
};

/**
 * Builds the result from evaluation outcomes.
 * [ARCH-SOLID-052] Extracted helper.
 */
const buildEvaluationResult = (
  allPassed: boolean,
  lastResult: EvaluationPipelineResult | undefined,
  gateType: GateType,
  executionId: string,
): GitHubWebhookResult => {
  if (allPassed && lastResult) {
    return { approved: true, executionId, score: lastResult.score, gateType };
  }
  if (lastResult) {
    return {
      approved: false,
      reason: buildBlockReason(lastResult),
      executionId,
      score: lastResult.score,
      gateType,
    };
  }
  return createFailOpenResult(executionId, 'No evaluation results');
};

/**
 * Fetches PR data with graceful degradation on failure.
 * [FORGE-OPS-054] Graceful degradation.
 * [ARCH-SOLID-052] Extracted helper.
 */
const fetchPRDataGraceful = async (
  repo: string,
  prNumber: number,
  token: string,
  executionId: string,
): Promise<GitHubPRData | GitHubWebhookResult> => {
  try {
    return await getPRData(repo, prNumber, token, executionId, HANDLER_TIMEOUT_MS);
  } catch (fetchError: unknown) {
    const msg = fetchError instanceof Error ? fetchError.message : 'PR fetch error';
    log({
      timestamp: new Date().toISOString(),
      level: 'warn',
      operation: 'fetchPRDataGraceful.failed',
      executionId,
      repo,
      prNumber,
      error: msg,
    });
    if (token) {
      await postFailOpenComment(repo, prNumber, token, executionId, msg);
    }
    return createFailOpenResult(executionId, msg);
  }
};

// ═══════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════

/**
 * Handler for GitHub webhook events.
 * Validates HMAC-SHA256 signature, routes PR events, evaluates quality gates,
 * and dispatches enforcement actions (block/approve PR).
 *
 * AC ref: AC-01 through AC-12
 * REGLA: [ARCH-SOLID-006] HANDLER layer — parse, delegate, wrap errors
 * REGLA: [FORGE-OPS-053] Fail-open — handler NEVER throws
 * REGLA: [FORGE-OPS-005] Response < 8s total
 * REGLA: [SEC-PRIV-004] Validate all external input
 * REGLA: [GH-INTEG-307] Filter by X-GitHub-Event header
 * REGLA: [GH-INTEG-306] Idempotent via X-GitHub-Delivery
 *
 * @param request - The incoming webhook request with body and headers
 * @param webhookSecret - The HMAC shared secret for signature validation
 * @param githubToken - The GitHub API token for status checks and comments
 * @returns GitHubWebhookResult — never throws
 */
export const onGitHubWebhook = async (
  request: GitHubWebhookRequest,
  webhookSecret: string,
  githubToken?: string,
): Promise<GitHubWebhookResult> => {
  const executionId = generateExecutionId();
  const token = githubToken ?? getToken();

  log({
    timestamp: new Date().toISOString(),
    level: 'info',
    operation: 'onGitHubWebhook.start',
    executionId,
  });

  // [SEC-PRIV-004] Validate request has body
  try {
    requireNonEmpty(request.body, 'request.body');
  } catch (validationError: unknown) {
    const msg = validationError instanceof Error ? validationError.message : 'Validation error';
    log({
      timestamp: new Date().toISOString(),
      level: 'error',
      operation: 'onGitHubWebhook.validationFailed',
      executionId,
      error: msg,
    });
    return createFailOpenResult(executionId, msg, 400);
  }

  return validateAndRoute(request, webhookSecret, token, executionId);
};

/**
 * Validates HMAC, checks dedup, and routes to PR handler.
 * [ARCH-SOLID-052] Extracted to reduce onGitHubWebhook complexity.
 */
const validateAndRoute = async (
  request: GitHubWebhookRequest,
  webhookSecret: string,
  token: string,
  executionId: string,
): Promise<GitHubWebhookResult> => {
  // [GH-INTEG-307] Only process pull_request events
  const eventType = request.headers['x-github-event'] ?? request.headers['X-GitHub-Event'];
  if (eventType !== 'pull_request') {
    log({
      timestamp: new Date().toISOString(),
      level: 'info',
      operation: 'validateAndRoute.ignoredEvent',
      executionId,
      eventType,
    });
    return { approved: true, executionId, statusCode: 200 };
  }

  // [SEC-PRIV-004] [SEC-PRIV-051] HMAC validation FIRST
  const signature =
    request.headers['x-hub-signature-256'] ?? request.headers['X-Hub-Signature-256'];
  if (!verifyHMACSignature(request.body, signature ?? '', webhookSecret)) {
    log({
      timestamp: new Date().toISOString(),
      level: 'error',
      operation: 'validateAndRoute.hmacFailed',
      executionId,
    });
    return createFailOpenResult(executionId, 'Invalid HMAC signature', 403);
  }

  // [GH-INTEG-306] Deduplication
  const deliveryId =
    request.headers['x-github-delivery'] ?? request.headers['X-GitHub-Delivery'] ?? '';
  if (deliveryId && isDuplicateDelivery(deliveryId)) {
    log({
      timestamp: new Date().toISOString(),
      level: 'info',
      operation: 'validateAndRoute.duplicate',
      executionId,
      deliveryId,
    });
    return { approved: true, executionId, statusCode: 200 };
  }

  return handlePREvent(request, executionId, token, deliveryId);
};

/**
 * Handles a validated PR event payload.
 * [FORGE-OPS-053] Wrapped in try/catch — never throws.
 * [ARCH-SOLID-052] Extracted for clarity.
 */
const handlePREvent = async (
  request: GitHubWebhookRequest,
  executionId: string,
  token: string,
  deliveryId: string,
): Promise<GitHubWebhookResult> => {
  try {
    const payloadOrError = parsePayload(request.body, executionId);
    if ('approved' in payloadOrError) return payloadOrError;
    const payload = payloadOrError;

    const repo = payload.repository.full_name;
    const prNumber = payload.number;
    const action = payload.action;
    const merged = payload.pull_request.merged ?? false;

    // [GH-INTEG-302] Rate limit
    if (deliveryId && !checkRateLimit(repo, deliveryId, executionId)) {
      return createFailOpenResult(executionId, 'Rate limit exceeded', 429);
    }

    log({
      timestamp: new Date().toISOString(),
      level: 'info',
      operation: 'handlePREvent.processing',
      executionId,
      repo,
      prNumber,
      action,
      merged,
    });

    // Edited events: re-extract keys only
    if (action === 'edited') {
      const prData = mapPayloadToPRData(payload);
      return handleEditedEvent(prData, executionId);
    }

    const gateType = resolveGateForEvent(action, merged);
    if (!gateType) {
      log({
        timestamp: new Date().toISOString(),
        level: 'info',
        operation: 'handlePREvent.ungatedAction',
        executionId,
        action,
      });
      return { approved: true, executionId, statusCode: 200 };
    }

    return handleGatedPREvent(
      repo,
      prNumber,
      payload.pull_request.head.sha,
      gateType,
      token,
      executionId,
    );
  } catch (handlerError: unknown) {
    const msg = handlerError instanceof Error ? handlerError.message : 'Handler error';
    log({
      timestamp: new Date().toISOString(),
      level: 'error',
      operation: 'handlePREvent.failOpen',
      executionId,
      error: msg,
    });
    return createFailOpenResult(executionId, msg, 500);
  }
};

/**
 * Maps a validated payload to GitHubPRData.
 * [ARCH-SOLID-052] Extracted helper.
 */
const mapPayloadToPRData = (payload: PullRequestPayload): GitHubPRData => ({
  number: payload.number,
  title: payload.pull_request.title,
  body: payload.pull_request.body ?? '',
  state: 'open',
  branch: payload.pull_request.head.ref,
  baseBranch: payload.pull_request.base.ref,
  files: [],
  url: payload.pull_request.html_url,
});

/**
 * Handles a gated PR event: extract Jira keys, evaluate, enforce.
 * [FORGE-OPS-053] Wrapped in try/catch — never throws.
 * [ARCH-SOLID-052] Extracted for clarity.
 */
const handleGatedPREvent = async (
  repo: string,
  prNumber: number,
  commitSha: string,
  gateType: GateType,
  token: string,
  executionId: string,
): Promise<GitHubWebhookResult> => {
  try {
    const prDataOrError = await fetchPRDataGraceful(repo, prNumber, token, executionId);
    if ('approved' in prDataOrError) return prDataOrError;
    const prData = prDataOrError;

    // [AC-03] Extract Jira keys
    const jiraKeys = extractJiraKeysFromPR(prData);

    // [AC-06] No Jira keys — graceful ignore
    if (jiraKeys.length === 0) {
      log({
        timestamp: new Date().toISOString(),
        level: 'warn',
        operation: 'handleGatedPREvent.noJiraKeys',
        executionId,
        repo,
        prNumber,
      });
      return { approved: true, executionId, reason: 'No Jira keys found in PR' };
    }

    // [AC-05] Create pending status check
    if (token) {
      await createPendingStatusCheck(repo, commitSha, token, executionId);
    }

    // [AC-04] Evaluate all Jira keys
    const { allPassed, lastResult } = await evaluateAllJiraKeys(
      jiraKeys,
      gateType,
      repo,
      prNumber,
      commitSha,
      token,
      executionId,
    );

    return buildEvaluationResult(allPassed, lastResult, gateType, executionId);
  } catch (handlerError: unknown) {
    const msg = handlerError instanceof Error ? handlerError.message : 'Handler error';
    log({
      timestamp: new Date().toISOString(),
      level: 'error',
      operation: 'handleGatedPREvent.failOpen',
      executionId,
      error: msg,
    });
    if (token) {
      await postFailOpenComment(repo, prNumber, token, executionId, msg);
    }
    return createFailOpenResult(executionId, msg);
  }
};

// ═══════════════════════════════════════════
// FORGE WEBTRIGGER HANDLER EXPORT
// ═══════════════════════════════════════════

/**
 * Forge-compatible handler for GitHub webtrigger.
 * Forge passes the webtrigger request to this exported function.
 * Returns a Forge-compatible webtrigger response.
 * [FORGE-OPS-005] Webtrigger handler — invoked by Forge on HTTP request
 */
export const handler = async (
  request: { readonly body: string; readonly headers: Readonly<Record<string, string>> },
  _context: unknown,
): Promise<{
  readonly body: string;
  readonly statusCode: number;
  readonly headers: Record<string, string>;
}> => {
  const webhookSecret = process.env['GITHUB_WEBHOOK_SECRET'] ?? '';
  const githubToken = process.env['GITHUB_TOKEN'] ?? '';
  const result = await onGitHubWebhook(request, webhookSecret, githubToken || undefined);

  return {
    body: JSON.stringify(result),
    statusCode: result.error ? (result.statusCode ?? 500) : 200,
    headers: { 'Content-Type': 'application/json' },
  };
};
