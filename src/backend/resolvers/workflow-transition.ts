// [ARCH-SOLID-058] HANDLER layer — Jira workflow trigger handler
// [ARCH-SOLID-006] Handler -> Service -> Repository pattern (HANDLER layer)
// [ARCH-SOLID-202] Zero any usage
// [ARCH-SOLID-053] Domain-specific error types for all failure paths
// [ARCH-SOLID-232] Named exports only, no export default
// [ARCH-SOLID-061] Bounded context: Ticket Validation (Jira-side)
// [ARCH-SOLID-052] Functions <= 20 lines of logic, max 3 nesting levels
// [FORGE-OPS-005] No invocation exceeds 10s
// [FORGE-OPS-0101] Complete critical work in max 8s
// [FORGE-OPS-0105] Stateless functions, no module-level mutable state
// [FORGE-OPS-053] Failures must not leave system in inconsistent state
// [FORGE-OPS-054] Graceful degradation when services unavailable

import type { GateType } from '../types/quality-gate';
import type { ConsistencyScore } from '../types/consistency-score';
import type { AuditLogEntry } from '../types/audit-log';
import type { ProjectConfig } from '../types/project-config';
import type { EnforcementAction } from '../types/enforcement';
import { REGError } from '../types/errors';

import {
  evaluateTicketForGate,
  type EvaluationPipelineResult,
} from '../services/evaluation/evaluation-pipeline';

import { blockTransition } from '../services/enforcement/enforcement-actions';

import { getProjectConfig, addComment, getTicketData } from '../services/jira/jira-adapter';

import { writeAuditEntry } from '../services/audit/audit-service';

import { indexJiraIssue } from '../services/relationship-index/jira-indexer';
import type { JiraIndexInput } from '../services/relationship-index/jira-indexer';

import type { JiraTicketData } from '../types/jira-data';

// ═══════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════

/** [ARCH-SOLID-203] Incoming Jira workflow transition event */
export interface JiraWorkflowTransitionEvent {
  readonly issueKey: string;
  readonly transitionId: string;
  readonly fromStatus: string;
  readonly toStatus: string;
  readonly projectKey: string;
}

/** [ARCH-SOLID-203] Result of handling a Jira workflow transition */
export interface JiraWorkflowTransitionResult {
  readonly allowed: boolean;
  readonly reason?: string;
  readonly executionId: string;
  readonly score?: ConsistencyScore;
  readonly gateType?: GateType;
  readonly error?: string;
}

/** [ARCH-SOLID-203] Structured log entry for handler operations */
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

/** [FORGE-OPS-0101] Handler overhead timeout — 3s budget after pipeline's 5s */
const HANDLER_TIMEOUT_MS = 3_000;

/** [ARCH-SOLID-061] Status transitions that trigger gate evaluation */
const GATED_TRANSITIONS: Readonly<Record<string, GateType>> = {
  'In Progress': 'definition',
  'In Review': 'execution',
  Done: 'delivery',
} as const;

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
// INPUT VALIDATION
// ═══════════════════════════════════════════

/**
 * Validates that a string is non-empty.
 * [SEC-PRIV-004] Input validation on all external-facing functions.
 */
const requireNonEmpty = (value: string, fieldName: string): void => {
  if (!value || value.trim().length === 0) {
    throw new REGError(`${fieldName} must be a non-empty string`, 'VALIDATION_ERROR');
  }
};

/**
 * Validates the incoming transition event has all required fields.
 * [SEC-PRIV-004] Validate all external input before processing.
 * [ARCH-SOLID-052] Extracted helper.
 */
const validateEvent = (event: JiraWorkflowTransitionEvent): void => {
  requireNonEmpty(event.issueKey, 'issueKey');
  requireNonEmpty(event.transitionId, 'transitionId');
  requireNonEmpty(event.fromStatus, 'fromStatus');
  requireNonEmpty(event.toStatus, 'toStatus');
  requireNonEmpty(event.projectKey, 'projectKey');
};

/**
 * Resolves the GateType for a target status.
 * [ARCH-SOLID-061] Bounded context mapping.
 * [ARCH-SOLID-052] Extracted helper.
 */
const resolveGateType = (toStatus: string): GateType | undefined => {
  return GATED_TRANSITIONS[toStatus];
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
  return `wh-${timestamp}-${random}`;
};

// ═══════════════════════════════════════════
// FAIL-OPEN HELPERS
// ═══════════════════════════════════════════

/**
 * Creates a fail-open result allowing the transition on any error.
 * [FORGE-OPS-053] Failures must not leave system in inconsistent state.
 * [ARCH-SOLID-052] Extracted helper.
 */
const createFailOpenResult = (
  executionId: string,
  error: string,
): JiraWorkflowTransitionResult => ({
  allowed: true,
  executionId,
  error,
});

/**
 * Posts a fail-open comment on the ticket to inform the user that
 * the guard encountered an error and allowed the transition.
 * [SEC-PRIV-002] No sensitive data in comments.
 * [FORGE-OPS-054] Graceful degradation — comment failure is logged, not re-thrown.
 */
const postFailOpenComment = async (
  issueKey: string,
  executionId: string,
  _error: string,
): Promise<void> => {
  const body = [
    '[Rovo Execution Guard] Evaluation Error — Transition Allowed',
    '',
    'An error occurred during quality gate evaluation.',
    'The transition was allowed as a safety measure (fail-open).',
    '',
    `Execution ID: ${executionId}`,
  ].join('\n');

  try {
    await addComment(issueKey, body, executionId, HANDLER_TIMEOUT_MS);
  } catch (commentError: unknown) {
    const msg = commentError instanceof Error ? commentError.message : 'Unknown error';
    log({
      timestamp: new Date().toISOString(),
      level: 'warn',
      operation: 'postFailOpenComment.failed',
      executionId,
      issueKey,
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
 * Dispatches enforcement actions when the gate fails.
 * [ARCH-SOLID-006] Delegates to SERVICE layer.
 * [FORGE-OPS-054] Graceful degradation — action failure is logged, not re-thrown.
 * [ARCH-SOLID-052] Extracted helper.
 */
const dispatchEnforcement = async (
  result: EvaluationPipelineResult,
  event: JiraWorkflowTransitionEvent,
): Promise<void> => {
  if (result.gateResult.passed) return;

  const blockAction: EnforcementAction | undefined = result.enforcementActions.find(
    (a) => a.type === 'block_transition',
  );

  if (blockAction && blockAction.type === 'block_transition') {
    try {
      await blockTransition(
        event.issueKey,
        event.transitionId,
        blockAction.reason,
        result.executionId,
        HANDLER_TIMEOUT_MS,
      );
    } catch (blockError: unknown) {
      const msg = blockError instanceof Error ? blockError.message : 'Unknown enforcement error';
      log({
        timestamp: new Date().toISOString(),
        level: 'warn',
        operation: 'dispatchEnforcement.blockFailed',
        executionId: result.executionId,
        issueKey: event.issueKey,
        error: msg,
      });
    }
  }
};

/**
 * Writes the audit log entry to Forge Storage via audit-service.
 * [SEC-PRIV-010] Audit log: who, what, when, resource.
 * [SEC-PRIV-008] Data minimization — only metadata.
 * [FORGE-OPS-054] Graceful degradation — audit failure is logged, not re-thrown.
 * [ARCH-SOLID-052] Extracted helper.
 */
const writeAuditLog = async (auditEntry: AuditLogEntry, executionId: string): Promise<void> => {
  try {
    log({
      timestamp: new Date().toISOString(),
      level: 'info',
      operation: 'writeAuditLog',
      executionId,
      auditId: auditEntry.id,
      action: auditEntry.action,
    });
    await writeAuditEntry(auditEntry);
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
// INCREMENTAL INDEXING
// ═══════════════════════════════════════════

/**
 * Maps JiraTicketData to JiraIndexInput for the relationship indexer.
 * [ARCH-SOLID-052] Extracted helper to keep handleGatedTransition clean.
 */
const buildIndexInputFromTicket = (ticket: JiraTicketData): JiraIndexInput => ({
  issueKey: ticket.key,
  projectKey: ticket.projectKey,
  summary: ticket.summary,
  description: ticket.description,
  issueType: ticket.issueType,
  status: ticket.status,
  labels: ticket.labels,
  epicKey: ticket.epicKey,
  issueLinks: ticket.issueLinks?.map((link) => ({
    type: link.type,
    direction: link.direction,
    targetKey: link.targetKey,
  })),
});

/**
 * Fetches ticket data and triggers incremental relationship indexing.
 * [ARCH-SOLID-006] Handler -> Service (jira-indexer) -> Repository (relationship-storage).
 * [FORGE-OPS-054] Errors caught at call site — never propagates to caller.
 */
const triggerIncrementalIndex = async (
  issueKey: string,
  projectKey: string,
  executionId: string,
): Promise<void> => {
  const ticket = await getTicketData(issueKey, executionId, HANDLER_TIMEOUT_MS);
  const input = buildIndexInputFromTicket(ticket);
  await indexJiraIssue(input, executionId);
};

// ═══════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════

/**
 * Handler for Jira workflow transition triggers.
 * Intercepts transitions, evaluates quality gates, and blocks/allows the change.
 *
 * AC ref: AC-01, AC-02, AC-03, AC-04, AC-05, AC-06, AC-07
 * REGLA: [ARCH-SOLID-006] HANDLER layer — parse, delegate, wrap errors
 * REGLA: [FORGE-OPS-053] Fail-open — handler NEVER throws
 * REGLA: [FORGE-OPS-005] Response < 5s + handler overhead < 3s
 * REGLA: [SEC-PRIV-004] Validate all external input
 *
 * @param event - The Jira workflow transition event
 * @returns JiraWorkflowTransitionResult — never throws
 */
export const onJiraWorkflowTransition = async (
  event: JiraWorkflowTransitionEvent,
): Promise<JiraWorkflowTransitionResult> => {
  const executionId = generateExecutionId();

  log({
    timestamp: new Date().toISOString(),
    level: 'info',
    operation: 'onJiraWorkflowTransition.start',
    executionId,
    issueKey: event.issueKey,
    fromStatus: event.fromStatus,
    toStatus: event.toStatus,
    projectKey: event.projectKey,
  });

  // [SEC-PRIV-004] Validate event
  try {
    validateEvent(event);
  } catch (validationError: unknown) {
    const msg = validationError instanceof Error ? validationError.message : 'Validation error';
    log({
      timestamp: new Date().toISOString(),
      level: 'error',
      operation: 'onJiraWorkflowTransition.validationFailed',
      executionId,
      error: msg,
    });
    await postFailOpenComment(event.issueKey, executionId, msg);
    return createFailOpenResult(executionId, msg);
  }

  // [ARCH-SOLID-061] Resolve gate type from target status
  const gateType = resolveGateType(event.toStatus);
  if (!gateType) {
    log({
      timestamp: new Date().toISOString(),
      level: 'info',
      operation: 'onJiraWorkflowTransition.ungatedTransition',
      executionId,
      toStatus: event.toStatus,
    });
    return { allowed: true, executionId };
  }

  // Execute the rest of the handler with full fail-open protection
  return handleGatedTransition(event, executionId, gateType);
};

/**
 * Handles a gated transition: fetch config, evaluate, enforce, audit.
 * [FORGE-OPS-053] Wrapped in try/catch — never throws.
 * [ARCH-SOLID-052] Extracted for clarity.
 */
const handleGatedTransition = async (
  event: JiraWorkflowTransitionEvent,
  executionId: string,
  gateType: GateType,
): Promise<JiraWorkflowTransitionResult> => {
  try {
    // Step 1: Fetch project config
    const config = await getProjectConfig(event.projectKey, executionId, HANDLER_TIMEOUT_MS);

    // Step 2: Check if gate is enabled [AC-07]
    if (!isGateEnabled(config, gateType)) {
      log({
        timestamp: new Date().toISOString(),
        level: 'info',
        operation: 'onJiraWorkflowTransition.gateDisabled',
        executionId,
        gateType,
        projectKey: event.projectKey,
      });
      return { allowed: true, executionId, gateType };
    }

    // Step 3: Evaluate ticket against the gate
    const result = await evaluateTicketForGate(event.issueKey, event.toStatus, config, executionId);

    // Step 4: Write audit log [AC-06]
    await writeAuditLog(result.auditEntry, executionId);

    // [FORGE-OPS-054] [FORGE-OPS-0104] Non-blocking relationship indexing — failure MUST NOT affect transition [ARCH-SOLID-058]
    void triggerIncrementalIndex(event.issueKey, event.projectKey, executionId).catch(() => {
      log({
        timestamp: new Date().toISOString(),
        level: 'warn',
        operation: 'incrementalIndex.failed',
        executionId,
        issueKey: event.issueKey,
      });
    });

    // Step 5: Handle gate result
    if (result.gateResult.passed) {
      log({
        timestamp: new Date().toISOString(),
        level: 'info',
        operation: 'onJiraWorkflowTransition.passed',
        executionId,
        gateType,
        overallScore: result.score.overall,
      });
      return {
        allowed: true,
        executionId,
        score: result.score,
        gateType: result.gateType,
      };
    }

    // Step 6: Gate failed — dispatch enforcement [AC-02, AC-03]
    await dispatchEnforcement(result, event);

    log({
      timestamp: new Date().toISOString(),
      level: 'info',
      operation: 'onJiraWorkflowTransition.blocked',
      executionId,
      gateType,
      overallScore: result.score.overall,
    });

    return {
      allowed: false,
      reason: buildBlockReason(result),
      executionId,
      score: result.score,
      gateType: result.gateType,
    };
  } catch (handlerError: unknown) {
    const msg = handlerError instanceof Error ? handlerError.message : 'Handler error';
    log({
      timestamp: new Date().toISOString(),
      level: 'error',
      operation: 'onJiraWorkflowTransition.failOpen',
      executionId,
      error: msg,
    });
    await postFailOpenComment(event.issueKey, executionId, msg);
    return createFailOpenResult(executionId, msg);
  }
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

// ═══════════════════════════════════════════
// FORGE TRIGGER HANDLER EXPORT
// ═══════════════════════════════════════════

/**
 * Adapts the Forge `avi:jira/updated:issue` event payload to
 * the internal JiraWorkflowTransitionEvent interface.
 * Forge event body: { issue: { id, key }, changelog: { items: [{ field, from, fromString, to, toString }] } }
 */
const adaptForgeEvent = (event: Record<string, unknown>): JiraWorkflowTransitionEvent | null => {
  const body = event['body'] as Record<string, unknown> | undefined;
  if (!body) return null;

  const issue = body['issue'] as Record<string, string> | undefined;
  if (!issue?.['key']) return null;

  const changelog = body['changelog'] as Record<string, unknown> | undefined;
  const items = changelog?.['items'] as Array<Record<string, string>> | undefined;

  // Find the status change in the changelog
  const statusChange = items?.find((item) => item['field'] === 'status');
  if (!statusChange) return null; // Not a status transition — ignore

  const projectKey = issue['key'].split('-')[0] ?? '';

  return {
    issueKey: issue['key'],
    transitionId: statusChange['to'] ?? '',
    fromStatus: statusChange['fromString'] ?? '',
    toStatus: statusChange['toString'] ?? '',
    projectKey,
  };
};

/**
 * Forge-compatible handler for Jira workflow transition triggers.
 * Forge passes the avi:jira/updated:issue event payload.
 * Filters for status changes only; ignores other field updates.
 * [FORGE-OPS-005] Trigger handler — invoked by Forge on jira event
 */
export const handler = async (
  event: unknown,
): Promise<JiraWorkflowTransitionResult | undefined> => {
  const adapted = adaptForgeEvent(event as Record<string, unknown>);
  if (!adapted) {
    // Not a status transition — allow silently
    return;
  }
  return onJiraWorkflowTransition(adapted);
};
