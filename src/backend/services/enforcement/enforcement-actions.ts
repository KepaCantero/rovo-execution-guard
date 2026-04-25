// [ARCH-SOLID-058] Service layer — enforcement action execution
// [ARCH-SOLID-006] Handler -> Service -> Repository pattern
// [ARCH-SOLID-202] Zero any usage
// [ARCH-SOLID-053] Domain-specific error types for all failure paths
// [ARCH-SOLID-232] Named exports only, no export default
// [FORGE-OPS-005] Timeout awareness (delegates 8s default to adapters)
// [FORGE-OPS-0105] Stateless functions, no module-level mutable state

import type { EnforcementAction } from '../../types/enforcement';
import type { Inconsistency, Severity } from '../../types/inconsistency';
import type { AuditLogEntry, AuditAction } from '../../types/audit-log';
import type { GitHubStatusCheck } from '../../types/github-data';
import { REGError } from '../../types/errors';

import { addComment as jiraAddComment } from '../jira/jira-adapter';
import { createStatusCheck, createPRComment } from '../github/github-adapter';

// ═══════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════

/** [ARCH-SOLID-203] Context required for executing enforcement actions */
interface EnforcementContext {
  readonly issueKey: string;
  readonly projectKey: string;
  readonly commitSha: string;
  readonly token: string;
  readonly repo: string;
  readonly prNumber: number;
  readonly executionId: string;
  readonly timeoutMs?: number;
}

/** [ARCH-SOLID-203] Structured log entry for enforcement operations */
interface StructuredLogEntry {
  readonly timestamp: string;
  readonly level: 'info' | 'warn' | 'error';
  readonly operation: string;
  readonly executionId?: string;
  readonly [key: string]: unknown;
}

// ═══════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════

/** [GH-INTEG-305] Status check context string */
const STATUS_CHECK_CONTEXT = 'rovo-execution-guard/consistency';

/** [FORGE-OPS-0101] Default timeout 8s (2s margin against 10s Forge limit) */
const DEFAULT_TIMEOUT_MS = 8_000;

/** Severity emoji mapping for GitHub comments */
const SEVERITY_EMOJI: Readonly<Record<Severity, string>> = {
  critical: ':rotating_light:',
  warning: ':warning:',
  info: ':information_source:',
};

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
// AUDIT LOG BUILDER
// ═══════════════════════════════════════════

/**
 * Creates a standardized AuditLogEntry for enforcement actions.
 * [SEC-PRIV-010] Records who, what, when, resource.
 * [SEC-PRIV-008] Data minimization — only metadata, no full bodies.
 */
function createAuditEntry(
  action: AuditAction,
  executionId: string,
  projectKey: string,
  details: Record<string, unknown>,
  ticketKey?: string,
  prNumber?: number,
): AuditLogEntry {
  return {
    id: `audit-${executionId}-${Date.now()}`,
    action,
    timestamp: new Date().toISOString(),
    executionId,
    projectKey,
    ticketKey,
    prNumber,
    details,
  };
}

// ═══════════════════════════════════════════
// COMMENT TEMPLATES
// ═══════════════════════════════════════════

/**
 * Builds a Markdown comment for GitHub PR blocking.
 * [AC-08] Includes status emojis, collapsible details, score breakdown.
 * [SEC-PRIV-002] No sensitive data in templates.
 */
function buildBlockPRComment(reason: string, details: Record<string, unknown>): string {
  const lines: string[] = [
    '## :x: PR Blocked by Rovo Execution Guard',
    '',
    `**Reason:** ${reason}`,
    '',
  ];

  if (Object.keys(details).length > 0) {
    lines.push('<details>');
    lines.push('<summary>Score Breakdown</summary>');
    lines.push('');
    lines.push('| Axis | Score | Status |');
    lines.push('|------|-------|--------|');

    const axes = ['clarity', 'consistency', 'risk', 'documentation', 'technicalDebt'] as const;
    const scoreData = details.scoreAxes as Record<string, number> | undefined;
    const threshold = typeof details.scoreThreshold === 'number' ? details.scoreThreshold : 80;

    for (const axis of axes) {
      const score = scoreData?.[axis];
      if (typeof score === 'number') {
        const status = score >= threshold ? ':white_check_mark:' : ':x:';
        lines.push(`| ${axis} | ${score} | ${status} |`);
      }
    }

    lines.push('');
    lines.push('</details>');
    lines.push('');
  }

  lines.push('---');
  lines.push('*Re-evaluate after addressing the issues above.*');
  return lines.join('\n');
}

/**
 * Builds a plain-text comment for Jira transition blocking.
 * [SEC-PRIV-002] No sensitive data in templates.
 */
function buildBlockTransitionComment(transitionId: string, reason: string): string {
  const lines: string[] = [
    '[Rovo Execution Guard] Transition Blocked',
    '',
    `The transition (${transitionId}) has been blocked.`,
    `Reason: ${reason}`,
    '',
    'Please resolve the inconsistencies and re-attempt the transition.',
  ];
  return lines.join('\n');
}

/**
 * Builds a Markdown comment for GitHub PR approval.
 * [AC-08] Includes status emojis, score table.
 */
function buildApprovePRComment(details: Record<string, unknown>): string {
  const lines: string[] = ['## :white_check_mark: PR Approved by Rovo Execution Guard', ''];

  const overall = typeof details.overallScore === 'number' ? details.overallScore : 'N/A';
  lines.push(`**Overall Score:** ${overall}/100`);
  lines.push('');

  lines.push('<details>');
  lines.push('<summary>Score Breakdown</summary>');
  lines.push('');
  lines.push('| Axis | Score | Status |');
  lines.push('|------|-------|--------|');

  const axes = ['clarity', 'consistency', 'risk', 'documentation', 'technicalDebt'] as const;
  const scoreData = details.scoreAxes as Record<string, number> | undefined;
  const threshold = typeof details.scoreThreshold === 'number' ? details.scoreThreshold : 80;

  for (const axis of axes) {
    const score = scoreData?.[axis];
    if (typeof score === 'number') {
      const status = score >= threshold ? ':white_check_mark:' : ':warning:';
      lines.push(`| ${axis} | ${score} | ${status} |`);
    }
  }

  lines.push('');
  lines.push('</details>');
  lines.push('');
  lines.push('---');
  lines.push('*All quality gates passed. Proceed with confidence.*');
  return lines.join('\n');
}

/**
 * Builds a comment for flagging inconsistencies on a Jira ticket.
 * [AC-08] Severity-colored indicator.
 */
function buildFlagInconsistencyComment(inconsistency: Inconsistency): string {
  const emoji = SEVERITY_EMOJI[inconsistency.severity];
  const lines: string[] = [
    `[Rovo Execution Guard] Inconsistency Flagged ${emoji}`,
    '',
    `**Type:** ${inconsistency.type}`,
    `**Severity:** ${inconsistency.severity}`,
    `**Source:** ${inconsistency.source}`,
    `**Description:** ${inconsistency.description}`,
  ];

  if (inconsistency.suggestion) {
    lines.push('');
    lines.push(`**Suggestion:** ${inconsistency.suggestion}`);
  }

  if (inconsistency.relatedDocs && inconsistency.relatedDocs.length > 0) {
    lines.push('');
    lines.push('**Related Documents:**');
    for (const doc of inconsistency.relatedDocs) {
      lines.push(`- ${doc}`);
    }
  }

  return lines.join('\n');
}

// ═══════════════════════════════════════════
// INPUT VALIDATION
// ═══════════════════════════════════════════

/**
 * Validates that a string is non-empty.
 * [SEC-PRIV-004] Input validation on all external-facing functions.
 */
function requireNonEmpty(value: string, fieldName: string): void {
  if (!value || value.trim().length === 0) {
    throw new REGError(
      `Validation failed: ${fieldName} must be a non-empty string`,
      'VALIDATION_ERROR',
    );
  }
}

/**
 * Validates that a number is positive.
 * [SEC-PRIV-004] Input validation.
 */
function requirePositive(value: number, fieldName: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new REGError(
      `Validation failed: ${fieldName} must be a positive number`,
      'VALIDATION_ERROR',
    );
  }
}

/**
 * Validates an Inconsistency object has required fields.
 * [SEC-PRIV-004] Input validation before processing.
 */
function validateInconsistency(inconsistency: Inconsistency): void {
  requireNonEmpty(inconsistency.id, 'inconsistency.id');
  requireNonEmpty(inconsistency.description, 'inconsistency.description');
  requireNonEmpty(inconsistency.affectedTicketKey, 'inconsistency.affectedTicketKey');
}

/**
 * Extracts project key from an issue key (e.g., "PROJ-123" -> "PROJ").
 * [ARCH-SOLID-052] Extracted helper for consistent project key extraction.
 */
function extractProjectKey(issueKey: string): string {
  const dashIndex = issueKey.indexOf('-');
  return dashIndex > 0 ? issueKey.substring(0, dashIndex) : issueKey;
}

/**
 * Extracts the repo owner from a repo string (e.g., "owner/repo" -> "owner").
 * [ARCH-SOLID-052] Extracted helper.
 */
function extractRepoOwner(repo: string): string {
  const slashIndex = repo.indexOf('/');
  return slashIndex > 0 ? repo.substring(0, slashIndex) : repo;
}

/**
 * Extracts the PR number from a GitHub identifier (e.g., "owner/repo#42" -> 42).
 * [ARCH-SOLID-052] Extracted helper.
 */
function extractPrNumber(identifier: string): number | undefined {
  const separatorIndex = identifier.indexOf('#');
  if (separatorIndex === -1) return undefined;
  const prNum = parseInt(identifier.substring(separatorIndex + 1), 10);
  return Number.isFinite(prNum) && prNum > 0 ? prNum : undefined;
}

/** [ARCH-SOLID-203] Parsed result of a GitHub identifier */
interface ParsedGitHubIdentifier {
  readonly repo: string;
  readonly prNumber: number;
}

/**
 * Parses a GitHub identifier string "owner/repo#prNumber" into its components.
 * [SEC-PRIV-004] Validates format before returning.
 * [ARCH-SOLID-052] Extracted to reduce addComment complexity.
 */
function parseGitHubIdentifier(identifier: string, executionId?: string): ParsedGitHubIdentifier {
  const separatorIndex = identifier.indexOf('#');
  if (separatorIndex === -1) {
    throw new REGError(
      'GitHub identifier must be in format "owner/repo#prNumber"',
      'VALIDATION_ERROR',
      executionId,
    );
  }

  const repo = identifier.substring(0, separatorIndex);
  const prNumber = parseInt(identifier.substring(separatorIndex + 1), 10);

  if (!repo || !Number.isFinite(prNumber) || prNumber <= 0) {
    throw new REGError('Invalid GitHub identifier format', 'VALIDATION_ERROR', executionId);
  }

  return { repo, prNumber };
}

// ═══════════════════════════════════════════
// PUBLIC API — 6 Functions
// ═══════════════════════════════════════════

/**
 * Blocks a Jira workflow transition by posting a blocking comment.
 * Does NOT call transitionIssue — the comment informs the user the transition was blocked.
 *
 * AC ref: AC-01 of .reqs.md
 * REGLA: [ARCH-SOLID-006], [SEC-PRIV-010], [SEC-PRIV-004]
 *
 * @param issueKey - Jira issue key (e.g., "PROJ-123")
 * @param transitionId - The transition ID that was blocked
 * @param reason - Human-readable reason for blocking
 * @param executionId - Optional correlation ID for structured logging
 * @param timeoutMs - Optional timeout in milliseconds (default 8s)
 * @returns AuditLogEntry recording the enforcement action
 * @throws {JiraApiError} if the Jira API call fails
 * @throws {REGError} if input validation fails
 */
export async function blockTransition(
  issueKey: string,
  transitionId: string,
  reason: string,
  executionId?: string,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<AuditLogEntry> {
  const operation = 'blockTransition';

  // [SEC-PRIV-004] Validate inputs
  requireNonEmpty(issueKey, 'issueKey');
  requireNonEmpty(transitionId, 'transitionId');
  requireNonEmpty(reason, 'reason');

  log('info', operation, executionId, { issueKey, transitionId });

  const commentBody = buildBlockTransitionComment(transitionId, reason);

  await jiraAddComment(issueKey, commentBody, executionId, timeoutMs);

  log('info', operation, executionId, { issueKey, status: 'completed' });

  return createAuditEntry(
    'ticket_blocked',
    executionId ?? 'unknown',
    extractProjectKey(issueKey),
    { transitionId, reason },
    issueKey,
  );
}

/**
 * Blocks a GitHub PR by creating a failure status check and posting a comment.
 *
 * AC ref: AC-02 of .reqs.md
 * REGLA: [GH-INTEG-305], [ARCH-SOLID-006], [SEC-PRIV-010]
 *
 * @param repo - Repository in owner/repo format
 * @param prNumber - PR number
 * @param commitSha - Commit SHA to attach the status check to
 * @param reason - Human-readable reason for blocking
 * @param token - GitHub API token
 * @param details - Additional details for the comment (scoreAxes, scoreThreshold, etc.)
 * @param executionId - Optional correlation ID for structured logging
 * @param timeoutMs - Optional timeout in milliseconds (default 8s)
 * @returns AuditLogEntry recording the enforcement action
 * @throws {GitHubApiError} if the GitHub API call fails
 * @throws {REGError} if input validation fails
 */
export async function blockPR(
  repo: string,
  prNumber: number,
  commitSha: string,
  reason: string,
  token: string,
  details: Record<string, unknown>,
  executionId?: string,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<AuditLogEntry> {
  const operation = 'blockPR';

  // [SEC-PRIV-004] Validate inputs
  requireNonEmpty(repo, 'repo');
  requirePositive(prNumber, 'prNumber');
  requireNonEmpty(commitSha, 'commitSha');
  requireNonEmpty(reason, 'reason');
  requireNonEmpty(token, 'token');

  log('info', operation, executionId, { repo, prNumber, commitSha });

  // [GH-INTEG-305] Create failure status check with specific context
  const statusCheck: GitHubStatusCheck = {
    state: 'failure',
    targetUrl: '',
    description: reason,
    context: STATUS_CHECK_CONTEXT,
  };

  await createStatusCheck(statusCheck, repo, commitSha, token, executionId, timeoutMs);

  // Post blocking comment with details
  const commentBody = buildBlockPRComment(reason, details);
  await createPRComment(repo, prNumber, commentBody, token, executionId, timeoutMs);

  log('info', operation, executionId, { repo, prNumber, status: 'completed' });

  return createAuditEntry(
    'pr_blocked',
    executionId ?? 'unknown',
    extractRepoOwner(repo),
    { commitSha, reason },
    undefined,
    prNumber,
  );
}

/**
 * Posts a generic comment to Jira or GitHub.
 *
 * AC ref: AC-03 of .reqs.md
 * REGLA: [ARCH-SOLID-006], [SEC-PRIV-010]
 *
 * @param target - 'jira' or 'github'
 * @param identifier - Issue key for Jira, or repo string for GitHub (requires token)
 * @param body - Comment body text
 * @param executionId - Optional correlation ID for structured logging
 * @param timeoutMs - Optional timeout in milliseconds (default 8s)
 * @param token - Required when target is 'github'
 * @returns AuditLogEntry recording the enforcement action
 * @throws {JiraApiError} or {GitHubApiError} depending on target
 * @throws {REGError} if input validation fails
 */
export async function addComment(
  target: 'jira' | 'github',
  identifier: string,
  body: string,
  executionId?: string,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
  token?: string,
): Promise<AuditLogEntry> {
  const operation = 'addComment';

  // [SEC-PRIV-004] Validate inputs
  requireNonEmpty(identifier, 'identifier');
  requireNonEmpty(body, 'body');

  log('info', operation, executionId, { target, identifier });

  if (target === 'jira') {
    await jiraAddComment(identifier, body, executionId, timeoutMs);
  } else {
    // GitHub target: identifier format is "owner/repo#prNumber"
    if (!token) {
      throw new REGError(
        'addComment: token is required for GitHub target',
        'VALIDATION_ERROR',
        executionId,
      );
    }

    const { repo, prNumber } = parseGitHubIdentifier(identifier, executionId);
    await createPRComment(repo, prNumber, body, token, executionId, timeoutMs);
  }

  log('info', operation, executionId, { target, identifier, status: 'completed' });

  return createAuditEntry(
    'enforcement_executed',
    executionId ?? 'unknown',
    target === 'jira'
      ? extractProjectKey(identifier)
      : extractRepoOwner(identifier.substring(0, identifier.indexOf('#'))),
    { target, identifier },
    target === 'jira' ? identifier : undefined,
    target === 'github' ? extractPrNumber(identifier) : undefined,
  );
}

/**
 * Flags an inconsistency by posting a severity-colored comment on the affected Jira ticket.
 *
 * AC ref: AC-04 of .reqs.md
 * REGLA: [SEC-PRIV-010], [SEC-PRIV-004]
 *
 * @param inconsistency - The inconsistency to flag
 * @param executionId - Optional correlation ID for structured logging
 * @param timeoutMs - Optional timeout in milliseconds (default 8s)
 * @returns AuditLogEntry recording the enforcement action
 * @throws {JiraApiError} if the Jira API call fails
 * @throws {REGError} if input validation fails
 */
export async function flagInconsistency(
  inconsistency: Inconsistency,
  executionId?: string,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<AuditLogEntry> {
  const operation = 'flagInconsistency';

  // [SEC-PRIV-004] Validate inconsistency object
  validateInconsistency(inconsistency);

  log('info', operation, executionId, {
    inconsistencyId: inconsistency.id,
    severity: inconsistency.severity,
    affectedTicketKey: inconsistency.affectedTicketKey,
  });

  const commentBody = buildFlagInconsistencyComment(inconsistency);
  await jiraAddComment(inconsistency.affectedTicketKey, commentBody, executionId, timeoutMs);

  log('info', operation, executionId, { inconsistencyId: inconsistency.id, status: 'completed' });

  return createAuditEntry(
    'inconsistency_flagged',
    executionId ?? 'unknown',
    extractProjectKey(inconsistency.affectedTicketKey),
    {
      inconsistencyId: inconsistency.id,
      type: inconsistency.type,
      severity: inconsistency.severity,
      source: inconsistency.source,
    },
    inconsistency.affectedTicketKey,
  );
}

/**
 * Approves a GitHub PR by creating a success status check and posting an approval comment.
 * Standalone function (approvePR is NOT in the EnforcementAction discriminated union).
 *
 * AC ref: AC-05 of .reqs.md
 * REGLA: [GH-INTEG-305], [ARCH-SOLID-006], [SEC-PRIV-010]
 *
 * @param repo - Repository in owner/repo format
 * @param prNumber - PR number
 * @param commitSha - Commit SHA to attach the status check to
 * @param token - GitHub API token
 * @param details - Additional details for the comment (overallScore, scoreAxes, etc.)
 * @param executionId - Optional correlation ID for structured logging
 * @param timeoutMs - Optional timeout in milliseconds (default 8s)
 * @returns AuditLogEntry recording the enforcement action
 * @throws {GitHubApiError} if the GitHub API call fails
 * @throws {REGError} if input validation fails
 */
export async function approvePR(
  repo: string,
  prNumber: number,
  commitSha: string,
  token: string,
  details: Record<string, unknown>,
  executionId?: string,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<AuditLogEntry> {
  const operation = 'approvePR';

  // [SEC-PRIV-004] Validate inputs
  requireNonEmpty(repo, 'repo');
  requirePositive(prNumber, 'prNumber');
  requireNonEmpty(commitSha, 'commitSha');
  requireNonEmpty(token, 'token');

  log('info', operation, executionId, { repo, prNumber, commitSha });

  // [GH-INTEG-305] Create success status check
  const statusCheck: GitHubStatusCheck = {
    state: 'success',
    targetUrl: '',
    description: 'All quality gates passed',
    context: STATUS_CHECK_CONTEXT,
  };

  await createStatusCheck(statusCheck, repo, commitSha, token, executionId, timeoutMs);

  // Post approval comment with score details
  const commentBody = buildApprovePRComment(details);
  await createPRComment(repo, prNumber, commentBody, token, executionId, timeoutMs);

  log('info', operation, executionId, { repo, prNumber, status: 'completed' });

  return createAuditEntry(
    'pr_approved',
    executionId ?? 'unknown',
    extractRepoOwner(repo),
    { commitSha, overallScore: details.overallScore },
    undefined,
    prNumber,
  );
}

/**
 * Dispatches an enforcement action based on its discriminated type.
 * Routes to the appropriate function based on action.type.
 *
 * AC ref: AC-06 of .reqs.md
 * REGLA: [ARCH-SOLID-006], [ARCH-SOLID-052]
 *
 * @param action - The enforcement action to execute (discriminated union)
 * @param context - Context providing issueKey, repo, token, etc.
 * @returns AuditLogEntry recording the enforcement action
 * @throws {REGError} for unknown action types
 * @throws Domain errors from the dispatched function
 */
export async function executeAction(
  action: EnforcementAction,
  context: EnforcementContext,
): Promise<AuditLogEntry> {
  const operation = 'executeAction';

  log('info', operation, context.executionId, { actionType: action.type });

  switch (action.type) {
    case 'block_transition':
      return blockTransition(
        context.issueKey,
        action.transitionId,
        action.reason,
        context.executionId,
        context.timeoutMs,
      );

    case 'block_pr':
      return blockPR(
        context.repo,
        action.prNumber,
        context.commitSha,
        action.reason,
        context.token,
        {},
        context.executionId,
        context.timeoutMs,
      );

    case 'add_comment':
      return addComment(
        action.target,
        action.target === 'jira' ? context.issueKey : `${context.repo}#${context.prNumber}`,
        action.body,
        context.executionId,
        context.timeoutMs,
        action.target === 'github' ? context.token : undefined,
      );

    case 'flag_inconsistency':
      return flagInconsistency(action.inconsistency, context.executionId, context.timeoutMs);

    default: {
      // [ARCH-SOLID-202] Exhaustiveness check — should never reach here with TypeScript
      const exhaustive: never = action;
      throw new REGError(
        `executeAction: unknown action type ${(exhaustive as { type: string }).type}`,
        'UNKNOWN_ACTION_TYPE',
        context.executionId,
      );
    }
  }
}

// ═══════════════════════════════════════════
// EXPORTS (also re-export EnforcementContext for consumers)
// ═══════════════════════════════════════════

export type { EnforcementContext };
