// [ARCH-SOLID-058] HANDLER layer — Rovo Agent action handler
// [ARCH-SOLID-006] Handler -> Service -> Repository pattern (HANDLER layer)
// [ARCH-SOLID-202] Zero any usage
// [ARCH-SOLID-232] Named exports only, no export default
// [FORGE-OPS-0105] Stateless functions, no module-level mutable state
// [ROVO-INTEG-054] Communication contracts as versioned TypeScript interfaces
// RTASK-034: Types, utilities, handler routing, and 5 sub-handlers

import { getTicketData, getProjectConfig } from '../services/jira/jira-adapter';
import { calculateScore, generateAxisSuggestions } from '../services/scoring/scoring-engine';
import { detectInconsistencies } from '../services/scoring/inconsistency-detector';
import { evaluateGate } from '../services/scoring/quality-gate-rules';
import { getPRData } from '../services/github/github-adapter';
import { getContext, getDocumentation } from '../services/rovo/rovo-adapter';
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
// PR URL PARSER
// ═══════════════════════════════════════════

/** Parse a GitHub PR URL into owner, repo, and prNumber. [ARCH-SOLID-052] */
const parsePrUrl = (
  prUrl: string,
): { readonly owner: string; readonly repo: string; readonly prNumber: number } | null => {
  const match = prUrl.match(/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/);
  if (!match?.[1] || !match[2] || !match[3]) {
    return null;
  }
  return {
    owner: match[1],
    repo: match[2],
    prNumber: parseInt(match[3], 10),
  };
};

// ═══════════════════════════════════════════
// SUB-HANDLERS
// ═══════════════════════════════════════════

/**
 * AC-04: evaluate-issue — full score + inconsistencies + gate status.
 * [FORGE-OPS-005] No invocation exceeds 10s.
 */
const handleEvaluateIssue: ActionHandler = async (input, context) => {
  const executionId = generateActionExecutionId();
  const issueKey = input.issueKey ?? context.jira?.issueKey;
  const projectKey = context.jira?.projectKey;

  if (!issueKey) {
    return actionFailure('issueKey is required for evaluate-issue', executionId);
  }

  const ticket = await getTicketData(issueKey, executionId);
  const config = projectKey ? await getProjectConfig(projectKey, executionId) : undefined;

  const inconsistencies = detectInconsistencies(ticket);
  const score = calculateScore({ ticket, inconsistencies }, config);

  const gateResult = config
    ? evaluateGate('definition', {
        score,
        inconsistencies,
        config,
        ticketKey: issueKey,
      })
    : undefined;

  return actionSuccess(
    {
      score: score.overall,
      axes: score.axes,
      axisDetails: score.axisDetails,
      inconsistencies,
      gateResults: gateResult ? { passed: gateResult.passed, gate: gateResult.gate } : undefined,
      threshold: config?.scoreThreshold,
    },
    executionId,
  );
};

/**
 * AC-05: check-pr-consistency — PR-issue alignment analysis.
 * [GH-INTEG-001] GitHub adapter for PR data.
 */
const handleCheckPRConsistency: ActionHandler = async (input, context) => {
  const executionId = generateActionExecutionId();
  const issueKey = input.issueKey ?? context.jira?.issueKey;
  const prUrl = input.prUrl;

  if (!prUrl) {
    return actionFailure('prUrl is required for check-pr-consistency', executionId);
  }
  if (!issueKey) {
    return actionFailure('issueKey is required for check-pr-consistency', executionId);
  }

  const parsed = parsePrUrl(prUrl);
  if (!parsed) {
    return actionFailure(
      `Invalid PR URL format: ${prUrl}. Expected https://github.com/owner/repo/pull/123`,
      executionId,
    );
  }

  const ticket = await getTicketData(issueKey, executionId);
  // [FORGE-OPS-054] Token not available in agent context — empty string triggers graceful degradation
  const prData = await getPRData(
    `${parsed.owner}/${parsed.repo}`,
    parsed.prNumber,
    '',
    executionId,
  );

  // Simple alignment heuristic: check if issue key appears in PR title/body
  const issueKeyInPrTitle = prData.title.toUpperCase().includes(issueKey.toUpperCase());
  const issueKeyInPrBody = prData.body.toUpperCase().includes(issueKey.toUpperCase());
  const titleWords = ticket.summary.toLowerCase().split(/\s+/);
  const prTitleWords = prData.title.toLowerCase().split(/\s+/);
  const overlapCount = titleWords.filter((w) => w.length > 3 && prTitleWords.includes(w)).length;
  const titleSimilarity = titleWords.length > 0 ? overlapCount / titleWords.length : 0;

  const gaps: string[] = [];
  let alignment: 'aligned' | 'partial' | 'misaligned';

  if (issueKeyInPrTitle || issueKeyInPrBody) {
    alignment = 'aligned';
  } else if (titleSimilarity > 0.3) {
    alignment = 'partial';
    gaps.push('PR does not explicitly reference the Jira issue key');
  } else {
    alignment = 'misaligned';
    gaps.push('PR title has low similarity to issue summary');
    gaps.push('PR does not reference the Jira issue key');
  }

  if (prData.files.length === 0) {
    gaps.push('PR has no file changes listed');
  }

  return actionSuccess(
    {
      alignment,
      prSummary: { title: prData.title, state: prData.state, fileCount: prData.files.length },
      issueSummary: { key: ticket.key, summary: ticket.summary, status: ticket.status },
      gaps,
    },
    executionId,
  );
};

/**
 * AC-06: validate-spec-alignment — spec alignment report.
 * [ROVO-INTEG-002] Rovo context for documentation cross-reference.
 */
const handleValidateSpecAlignment: ActionHandler = async (input, context) => {
  const executionId = generateActionExecutionId();
  const issueKey = input.issueKey ?? context.jira?.issueKey;
  const projectKey = context.jira?.projectKey;

  if (!issueKey) {
    return actionFailure('issueKey is required for validate-spec-alignment', executionId);
  }

  const ticket = await getTicketData(issueKey, executionId);

  // [ROVO-INTEG-004] Graceful degradation if Rovo context unavailable
  const rovoContext = projectKey
    ? await getContext(ticket.summary, projectKey, executionId).catch(() => undefined)
    : undefined;

  const docs = await getDocumentation(ticket.summary, undefined, executionId).catch(
    () =>
      [] as readonly {
        readonly id: string;
        readonly title: string;
        readonly content: string;
        readonly source: string;
        readonly relevance: number;
      }[],
  );

  const inconsistencies = detectInconsistencies(ticket, rovoContext);

  const alignedSpecs = docs
    .filter((d) => d.relevance > 0.5)
    .map((d) => ({ id: d.id, title: d.title, relevance: d.relevance }));

  const misalignedSpecs = inconsistencies
    .filter((i) => i.source === 'confluence')
    .map((i) => ({ id: i.id, description: i.description, severity: i.severity }));

  const suggestions = inconsistencies.filter((i) => i.suggestion).map((i) => i.suggestion);

  return actionSuccess({ alignedSpecs, misalignedSpecs, suggestions }, executionId);
};

/**
 * AC-07: explain-score — per-axis breakdown with signals.
 */
const handleExplainScore: ActionHandler = async (input, context) => {
  const executionId = generateActionExecutionId();
  const issueKey = input.issueKey ?? context.jira?.issueKey;
  const projectKey = context.jira?.projectKey;

  if (!issueKey) {
    return actionFailure('issueKey is required for explain-score', executionId);
  }

  const ticket = await getTicketData(issueKey, executionId);
  const config = projectKey ? await getProjectConfig(projectKey, executionId) : undefined;

  const score = calculateScore({ ticket }, config);
  const axisSuggestions = generateAxisSuggestions(ticket, score.axes);

  const axes = Object.entries(score.axes).map(([name, value]) => {
    const detail = axisSuggestions[name];
    return {
      name,
      score: value,
      description: detail?.label ?? name,
      signals: detail?.suggestions ?? [],
      suggestions: detail?.suggestions ?? [],
    };
  });

  return actionSuccess(
    {
      overallScore: score.overall,
      threshold: config?.scoreThreshold,
      axes,
    },
    executionId,
  );
};

/**
 * AC-08: get-improvement-tips — prioritized suggestions by axis.
 */
const handleGetImprovementTips: ActionHandler = async (input, context) => {
  const executionId = generateActionExecutionId();
  const issueKey = input.issueKey ?? context.jira?.issueKey;
  const projectKey = context.jira?.projectKey;

  if (!issueKey) {
    return actionFailure('issueKey is required for get-improvement-tips', executionId);
  }

  const ticket = await getTicketData(issueKey, executionId);
  const config = projectKey ? await getProjectConfig(projectKey, executionId) : undefined;

  const inconsistencies = detectInconsistencies(ticket);
  const score = calculateScore({ ticket, inconsistencies }, config);
  const axisSuggestions = generateAxisSuggestions(ticket, score.axes);

  const allAxes = Object.entries(score.axes)
    .map(([name, value]) => ({
      axis: name,
      currentScore: value,
      targetScore: config?.scoreThreshold ?? 80,
      tips: axisSuggestions[name]?.suggestions ?? [],
    }))
    .filter((a) => {
      // If focusAxis provided, filter to that axis only
      if (input.focusAxis) {
        return a.axis === input.focusAxis;
      }
      return true;
    })
    // Sort by lowest-scoring axes first (highest impact)
    .sort((a, b) => a.currentScore - b.currentScore);

  return actionSuccess(
    {
      overallScore: score.overall,
      threshold: config?.scoreThreshold,
      prioritizedTips: allAxes,
    },
    executionId,
  );
};

// ═══════════════════════════════════════════
// ACTION ROUTER
// ═══════════════════════════════════════════

/**
 * Maps manifest action keys to sub-handler implementations.
 * [ARCH-SOLID-049-03] Record for O(1) dispatch.
 */
const ACTION_HANDLERS: Readonly<Record<string, ActionHandler>> = {
  'evaluate-issue': handleEvaluateIssue,
  'check-pr-consistency': handleCheckPRConsistency,
  'validate-spec-alignment': handleValidateSpecAlignment,
  'explain-score': handleExplainScore,
  'get-improvement-tips': handleGetImprovementTips,
};

// ═══════════════════════════════════════════
// HANDLER (Forge entry point)
// ═══════════════════════════════════════════

/**
 * Forge-compatible handler for Rovo Agent action invocations.
 * [FORGE-OPS-005] No invocation exceeds 10s.
 * [AC-09] All errors caught as structured ActionResponse — never throws.
 * [AC-10] Structured logging with executionId, actionKey, duration, success.
 */
const handler = async (
  payload: { context?: ActionContext; issueKey?: string; prUrl?: string; focusAxis?: string },
  _forgeContext: { accountId: string },
): Promise<ActionResponse<unknown>> => {
  const executionId = generateActionExecutionId();
  const startTime = Date.now();
  const actionKey = payload.context?.moduleKey ?? '';
  const issueKey = payload.issueKey ?? payload.context?.jira?.issueKey;

  const actionHandler = ACTION_HANDLERS[actionKey];
  if (!actionHandler) {
    logAction({
      timestamp: new Date().toISOString(),
      level: 'error',
      actionKey,
      executionId,
      duration: Date.now() - startTime,
      success: false,
      issueKey,
      error: `Unknown action key: ${actionKey}`,
    });
    return actionFailure(`Unknown action: ${actionKey}`, executionId);
  }

  try {
    const result = await actionHandler(
      {
        issueKey: payload.issueKey,
        prUrl: payload.prUrl,
        focusAxis: payload.focusAxis,
      },
      payload.context ?? { cloudId: '', moduleKey: actionKey },
    );

    logAction({
      timestamp: new Date().toISOString(),
      level: result.success ? 'info' : 'warn',
      actionKey,
      executionId: result.executionId,
      duration: Date.now() - startTime,
      success: result.success,
      issueKey,
      prUrl: payload.prUrl,
      error: result.success ? undefined : result.error,
    });

    return result;
  } catch (error: unknown) {
    const errorMessage = formatActionError(error, issueKey);
    logAction({
      timestamp: new Date().toISOString(),
      level: 'error',
      actionKey,
      executionId,
      duration: Date.now() - startTime,
      success: false,
      issueKey,
      prUrl: payload.prUrl,
      error: errorMessage,
    });
    return actionFailure(errorMessage, executionId);
  }
};

export { handler };
