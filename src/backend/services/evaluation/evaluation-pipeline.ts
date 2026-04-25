// [ARCH-SOLID-058] Evaluation Pipeline — zero framework dependencies
// [ARCH-SOLID-006] Handler -> Service -> Repository pattern (SERVICE layer)
// [ARCH-SOLID-202] Zero any usage
// [ARCH-SOLID-053] Domain-specific error types for all failure paths
// [ARCH-SOLID-232] Named exports only, no export default
// [ARCH-SOLID-061] Bounded context: Ticket Validation
// [FORGE-OPS-005] No invocation exceeds 10s
// [FORGE-OPS-0101] Complete critical work in max 8s (2s margin)
// [FORGE-OPS-0105] Stateless functions, no module-level mutable state
// [FORGE-OPS-053] Failures must not leave system in inconsistent state
// [FORGE-OPS-054] Graceful degradation when Rovo/GitHub unavailable

import type { JiraTicketData } from '../../types/jira-data';
import type { GateType, QualityGateResult } from '../../types/quality-gate';
import type { ConsistencyScore } from '../../types/consistency-score';
import type { Inconsistency } from '../../types/inconsistency';
import type { EnforcementAction } from '../../types/enforcement';
import type { AuditLogEntry } from '../../types/audit-log';
import type { ProjectConfig } from '../../types/project-config';
import type { RovoContext } from '../../types/rovo-context';
import { REGError } from '../../types/errors';

import { getTicketData } from '../jira/jira-adapter';
import { getContext } from '../rovo/rovo-adapter';
import { detectInconsistencies } from '../scoring/inconsistency-detector';
import { calculateScore, type ScoringInput } from '../scoring/scoring-engine';
import {
  evaluateGate,
  determineEnforcementActions,
  type GateEvaluationInput,
} from '../scoring/quality-gate-rules';

// ═══════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════

/** [ARCH-SOLID-203] Complete result of an evaluation pipeline run */
export interface EvaluationPipelineResult {
  readonly executionId: string;
  readonly ticketKey: string;
  readonly gateType: GateType;
  readonly score: ConsistencyScore;
  readonly inconsistencies: readonly Inconsistency[];
  readonly gateResult: QualityGateResult;
  readonly enforcementActions: readonly EnforcementAction[];
  readonly auditEntry: AuditLogEntry;
  readonly error?: string;
}

/** [ARCH-SOLID-203] Structured log entry for pipeline operations */
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

/** [FORGE-OPS-0101] Total pipeline timeout 5s (well within 8s limit) */
const PIPELINE_TIMEOUT_MS = 5_000;

/** [ROVO-INTEG-005] Rovo API timeout max 3s (within pipeline budget) */
const ROVO_TIMEOUT_MS = 3_000;

/** [ARCH-SOLID-061] Status-to-gate mapping for transition evaluation */
const STATUS_GATE_MAP: Readonly<Record<string, GateType>> = {
  'In Progress': 'definition',
  'In Review': 'execution',
  Done: 'delivery',
  Merge: 'delivery',
} as const;

// ═══════════════════════════════════════════
// INTERNAL HELPERS
// ═══════════════════════════════════════════

/**
 * Generate a unique execution ID (timestamp + random suffix).
 * REGLA: [ARCH-SOLID-052] Extracted helper
 */
const generateExecutionId = (): string => {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `ep-${timestamp}-${random}`;
};

/**
 * [SEC-PRIV-004] Validate that external input strings are non-empty.
 */
const requireNonEmpty = (value: string, fieldName: string, executionId: string): void => {
  if (!value || value.trim().length === 0) {
    throw new REGError(`${fieldName} must be a non-empty string`, 'VALIDATION_ERROR', executionId);
  }
};

/**
 * [TEST-QA-036-03] Structured logging with executionId context.
 */
const log = (entry: StructuredLogEntry): void => {
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(entry));
};

/**
 * Resolve the GateType for a given target status.
 * REGLA: [ARCH-SOLID-061] Bounded context mapping
 * REGLA: [ARCH-SOLID-052] Extracted helper
 */
const resolveGateType = (targetStatus: string): GateType => {
  const gate = STATUS_GATE_MAP[targetStatus];
  return gate ?? 'definition';
};

/**
 * Fetch ticket data from Jira adapter.
 * REGLA: [ARCH-SOLID-006] Delegates to REPOSITORY layer
 */
const fetchTicketData = async (ticketKey: string, executionId: string): Promise<JiraTicketData> => {
  log({
    timestamp: new Date().toISOString(),
    level: 'info',
    operation: 'fetchTicketData',
    executionId,
    ticketKey,
  });

  return getTicketData(ticketKey, executionId);
};

/**
 * Fetch Rovo context with graceful degradation.
 * REGLA: [ROVO-INTEG-0915] Rovo is enhancer, never requirement
 * REGLA: [ROVO-INTEG-005] Rovo timeout max 5s with graceful fallback
 * REGLA: [FORGE-OPS-054] Graceful degradation when Rovo unavailable
 */
const fetchRovoContext = async (
  ticketKey: string,
  projectKey: string,
  executionId: string,
): Promise<RovoContext | undefined> => {
  try {
    log({
      timestamp: new Date().toISOString(),
      level: 'info',
      operation: 'fetchRovoContext',
      executionId,
      ticketKey,
      projectKey,
    });

    return await getContext(ticketKey, projectKey, executionId, ROVO_TIMEOUT_MS);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown Rovo error';
    log({
      timestamp: new Date().toISOString(),
      level: 'warn',
      operation: 'fetchRovoContextFallback',
      executionId,
      ticketKey,
      error: message,
    });
    return undefined;
  }
};

/**
 * Detect inconsistencies from ticket data and optional Rovo context.
 * REGLA: [ARCH-SOLID-006] Delegates to DOMAIN layer
 */
const detectIssues = (
  ticket: JiraTicketData,
  context: RovoContext | undefined,
  executionId: string,
): readonly Inconsistency[] => {
  log({
    timestamp: new Date().toISOString(),
    level: 'info',
    operation: 'detectInconsistencies',
    executionId,
    ticketKey: ticket.key,
    hasContext: context !== undefined,
  });

  return detectInconsistencies(ticket, context);
};

/**
 * Calculate consistency score from ticket and inconsistencies.
 * REGLA: [ARCH-SOLID-006] Delegates to DOMAIN layer
 */
const computeScore = (
  ticket: JiraTicketData,
  inconsistencies: readonly Inconsistency[],
  executionId: string,
): ConsistencyScore => {
  log({
    timestamp: new Date().toISOString(),
    level: 'info',
    operation: 'calculateScore',
    executionId,
    ticketKey: ticket.key,
    inconsistencyCount: inconsistencies.length,
  });

  const input: ScoringInput = {
    ticket,
    inconsistencies,
  };

  return calculateScore(input);
};

/**
 * Evaluate the quality gate and determine enforcement actions.
 * REGLA: [ARCH-SOLID-006] Delegates to DOMAIN layer
 */
const evaluateQualityGate = (
  gateType: GateType,
  score: ConsistencyScore,
  inconsistencies: readonly Inconsistency[],
  config: ProjectConfig,
  ticketKey: string,
  executionId: string,
): { readonly gateResult: QualityGateResult; readonly actions: readonly EnforcementAction[] } => {
  log({
    timestamp: new Date().toISOString(),
    level: 'info',
    operation: 'evaluateQualityGate',
    executionId,
    ticketKey,
    gateType,
    overallScore: score.overall,
  });

  const gateInput: GateEvaluationInput = {
    score,
    inconsistencies,
    config,
    ticketKey,
  };

  const gateResult = evaluateGate(gateType, gateInput);
  const actions = determineEnforcementActions(gateResult, undefined, ticketKey);

  return { gateResult, actions };
};

/**
 * Build audit log entry for the evaluation.
 * REGLA: [SEC-PRIV-010] Audit log: who, what, when, resource
 * REGLA: [SEC-PRIV-008] Data minimization — only metadata
 */
const buildAuditEntry = (
  executionId: string,
  ticketKey: string,
  gateType: GateType,
  passed: boolean,
  projectKey: string,
): AuditLogEntry => ({
  id: `audit-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 8)}`,
  action: 'gate_evaluated',
  timestamp: new Date().toISOString(),
  executionId,
  projectKey,
  ticketKey,
  details: {
    gateType,
    passed,
  },
});

/**
 * Create a fail-open result when the pipeline encounters an error.
 * REGLA: [FORGE-OPS-053] Failures must not leave system in inconsistent state
 * REGLA: [FORGE-OPS-054] Graceful degradation
 */
const createFailOpenResult = (
  ticketKey: string,
  gateType: GateType,
  executionId: string,
  projectKey: string,
  error: string,
): EvaluationPipelineResult => {
  const now = new Date().toISOString();

  const defaultScore: ConsistencyScore = {
    overall: 100,
    axes: { clarity: 100, consistency: 100, risk: 100, documentation: 100, technicalDebt: 100 },
    timestamp: now,
    executionId,
  };

  const gateResult: QualityGateResult = {
    gate: gateType,
    passed: true,
    score: defaultScore,
    inconsistencies: [],
    blockedTransitions: [],
    executionId,
  };

  return {
    executionId,
    ticketKey,
    gateType,
    score: defaultScore,
    inconsistencies: [],
    gateResult,
    enforcementActions: [],
    auditEntry: buildAuditEntry(executionId, ticketKey, gateType, true, projectKey),
    error,
  };
};

/**
 * Race a promise against a timeout.
 * REGLA: [FORGE-OPS-005] No invocation exceeds 10s
 * REGLA: [FORGE-OPS-0101] Complete critical work in max 8s
 */
const withTimeout = <T>(promise: Promise<T>, ms: number, executionId: string): Promise<T> => {
  let timer: ReturnType<typeof setTimeout>;
  const timeoutPromise = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      reject(new REGError(`Pipeline timed out after ${ms}ms`, 'PIPELINE_TIMEOUT', executionId));
    }, ms);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    clearTimeout(timer);
  });
};

// ═══════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════

/**
 * Orchestrate the full evaluation pipeline for a ticket against a quality gate.
 *
 * AC ref: AC-EP-01, AC-EP-02, AC-EP-03, AC-EP-04, AC-EP-05, AC-EP-06, AC-EP-07,
 *         AC-EP-08, AC-EP-11
 * REGLA: [ARCH-SOLID-058] Zero framework dependencies
 * REGLA: [ARCH-SOLID-006] Handler -> Service -> Repository pattern
 * REGLA: [FORGE-OPS-0105] Stateless function
 * REGLA: [SEC-PRIV-004] Validate all external input before processing
 *
 * @param ticketKey - Jira ticket key (e.g. "PROJ-123")
 * @param targetStatus - Target Jira status for the transition
 * @param projectConfig - Project configuration with gates and threshold
 * @param executionId - Optional execution ID (generated if omitted)
 * @returns EvaluationPipelineResult — never throws, fail-open on error
 */
export const evaluateTicketForGate = async (
  ticketKey: string,
  targetStatus: string,
  projectConfig: ProjectConfig,
  executionId?: string,
): Promise<EvaluationPipelineResult> => {
  const execId = executionId ?? generateExecutionId();
  const gateType = resolveGateType(targetStatus);

  // [SEC-PRIV-004] Validate external input
  try {
    requireNonEmpty(ticketKey, 'ticketKey', execId);
    requireNonEmpty(targetStatus, 'targetStatus', execId);
  } catch (validationError: unknown) {
    const message = validationError instanceof Error ? validationError.message : 'Validation error';
    log({
      timestamp: new Date().toISOString(),
      level: 'error',
      operation: 'evaluateTicketForGate.validation',
      executionId: execId,
      error: message,
    });
    return createFailOpenResult(ticketKey, gateType, execId, projectConfig.projectKey, message);
  }

  log({
    timestamp: new Date().toISOString(),
    level: 'info',
    operation: 'evaluateTicketForGate.start',
    executionId: execId,
    ticketKey,
    targetStatus,
    gateType,
  });

  try {
    const result = await withTimeout(
      runPipeline(ticketKey, targetStatus, projectConfig, execId, gateType),
      PIPELINE_TIMEOUT_MS,
      execId,
    );
    return result;
  } catch (pipelineError: unknown) {
    const message = pipelineError instanceof Error ? pipelineError.message : 'Pipeline error';
    log({
      timestamp: new Date().toISOString(),
      level: 'error',
      operation: 'evaluateTicketForGate.failOpen',
      executionId: execId,
      ticketKey,
      error: message,
    });
    return createFailOpenResult(ticketKey, gateType, execId, projectConfig.projectKey, message);
  }
};

/**
 * Execute the core pipeline steps.
 * REGLA: [ARCH-SOLID-052] Extracted for clarity
 */
const runPipeline = async (
  ticketKey: string,
  _targetStatus: string,
  projectConfig: ProjectConfig,
  executionId: string,
  gateType: GateType,
): Promise<EvaluationPipelineResult> => {
  // Step 1: Fetch ticket data
  const ticket = await fetchTicketData(ticketKey, executionId);

  // Step 2: Fetch Rovo context (optional, graceful degradation)
  const rovoContext = await fetchRovoContext(ticketKey, projectConfig.projectKey, executionId);

  // Step 3: Detect inconsistencies
  const inconsistencies = detectIssues(ticket, rovoContext, executionId);

  // Step 4: Calculate score
  const score = computeScore(ticket, inconsistencies, executionId);

  // Step 5: Evaluate gate and determine enforcement
  const { gateResult, actions } = evaluateQualityGate(
    gateType,
    score,
    inconsistencies,
    projectConfig,
    ticketKey,
    executionId,
  );

  // Step 6: Build audit entry
  const auditEntry = buildAuditEntry(
    executionId,
    ticketKey,
    gateType,
    gateResult.passed,
    projectConfig.projectKey,
  );

  log({
    timestamp: new Date().toISOString(),
    level: 'info',
    operation: 'evaluateTicketForGate.complete',
    executionId,
    ticketKey,
    gateType,
    passed: gateResult.passed,
    overallScore: score.overall,
    inconsistencyCount: inconsistencies.length,
    actionCount: actions.length,
  });

  return {
    executionId,
    ticketKey,
    gateType,
    score,
    inconsistencies,
    gateResult,
    enforcementActions: actions,
    auditEntry,
  };
};
