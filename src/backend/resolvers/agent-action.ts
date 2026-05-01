// [ARCH-SOLID-058] HANDLER layer — Rovo Agent action handler
// [ARCH-SOLID-006] Handler -> Service -> Repository pattern (HANDLER layer)
// [ARCH-SOLID-202] Zero any usage
// [ARCH-SOLID-232] Named exports only, no export default
// [FORGE-OPS-0105] Stateless functions, no module-level mutable state
// [ROVO-INTEG-054] Communication contracts as versioned TypeScript interfaces
// RTASK-034 Step 1: Types, utilities, and handler stub

import { TicketNotFoundError, InsufficientDataError, TimeoutError } from '../types/errors';

// ═══════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════

/**
 * [ROVO-INTEG-004] Rovo context treated as untrusted — all fields readonly.
 * [ROVO-INTEG-060] jira context is optional (agent can be invoked from Confluence).
 */
export interface ActionContext {
  readonly cloudId: string;
  readonly moduleKey: string;
  readonly jira?: {
    readonly url: string;
    readonly resourceType: string;
    readonly issueKey: string;
    readonly issueId: number;
    readonly issueType: string;
    readonly projectKey: string;
    readonly projectId: number;
  };
}

/**
 * [ROVO-INTEG-060] Never assume complete information — all fields optional.
 * Sub-handlers must validate presence before use.
 */
export interface ActionInput {
  readonly issueKey?: string;
  readonly prUrl?: string;
  readonly focusAxis?: string;
}

/**
 * [ARCH-SOLID-203] Standard response wrapper following ResolverResponse<T> pattern.
 * Generic parameter avoids any usage per [ARCH-SOLID-202].
 */
export interface ActionResponse<T> {
  readonly success: boolean;
  readonly data?: T;
  readonly error?: string;
  readonly executionId: string;
}

/**
 * [ARCH-SOLID-049-03] Type alias for sub-handler function signatures.
 */
export type ActionHandler = (
  input: ActionInput,
  context: ActionContext,
) => Promise<ActionResponse<unknown>>;

/**
 * [SEC-PRIV-002] Structured log entry — only operation metadata, never tokens or PII.
 */
export interface ActionLogEntry {
  readonly timestamp: string;
  readonly level: 'info' | 'warn' | 'error';
  readonly actionKey: string;
  readonly executionId: string;
  readonly duration?: number;
  readonly success: boolean;
  readonly issueKey?: string;
  readonly prUrl?: string;
  readonly error?: string;
}

// ═══════════════════════════════════════════
// EXECUTION ID
// ═══════════════════════════════════════════

/**
 * Generate a unique execution ID for action invocations.
 * Uses `act-` prefix to distinguish from resolver `res-` prefix.
 * [FORGE-OPS-0105] Pure function, no side effects.
 */
export const generateActionExecutionId = (): string => {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `act-${timestamp}-${random}`;
};

// ═══════════════════════════════════════════
// ERROR FORMATTING
// ═══════════════════════════════════════════

/**
 * Maps domain errors to user-friendly messages.
 * [ARCH-SOLID-053] Domain-specific error types for all failure paths.
 * [FORGE-OPS-054] Graceful degradation when services unavailable.
 */
export const formatActionError = (error: unknown, issueKey?: string): string => {
  const target = issueKey ? ` ${issueKey}` : '';

  if (error instanceof TicketNotFoundError) {
    return `The issue${target} was not found`;
  }

  if (error instanceof InsufficientDataError) {
    return `Not enough data to evaluate${target}`;
  }

  if (error instanceof TimeoutError) {
    return `Evaluation timed out for${target}`;
  }

  return `An unexpected error occurred${target ? ' while evaluating' + target : ''}`;
};

// ═══════════════════════════════════════════
// STRUCTURED LOGGING
// ═══════════════════════════════════════════

/**
 * Emits a structured JSON log entry for action operations.
 * [SEC-PRIV-002] Only logs operation metadata — never tokens or PII.
 * [TEST-QA-036-03] Structured context with executionId and actionKey.
 */
export const logAction = (entry: ActionLogEntry): void => {
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(entry));
};

// ═══════════════════════════════════════════
// RESPONSE BUILDERS
// ═══════════════════════════════════════════

/** Build a success response. [ARCH-SOLID-203] */
export const actionSuccess = <T>(data: T, executionId: string): ActionResponse<T> => ({
  success: true,
  data,
  executionId,
});

/** Build a failure response. [ARCH-SOLID-203] */
export const actionFailure = (error: string, executionId: string): ActionResponse<never> => ({
  success: false,
  error,
  executionId,
});

// ═══════════════════════════════════════════
// HANDLER (stub — full routing in RTASK-034 subsequent steps)
// ═══════════════════════════════════════════

/**
 * Forge-compatible handler for Rovo Agent action invocations.
 * [FORGE-OPS-005] No invocation exceeds 10s.
 * Routing logic added in subsequent RTASK-034 steps.
 */
const handler = (
  _payload: { context?: ActionContext; issueKey?: string; prUrl?: string; focusAxis?: string },
  _context: { accountId: string },
): string => {
  const moduleKey = _payload.context?.moduleKey ?? '';
  return `Action "${moduleKey}" received. Handler implementation pending (RTASK-034). Issue: ${_payload.issueKey ?? 'N/A'}`;
};

export { handler };
