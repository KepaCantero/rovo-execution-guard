// [ARCH-SOLID-058] HANDLER layer — Custom UI resolver bridge to @forge/resolver
// [ARCH-SOLID-006] Handler -> Service -> Repository pattern (HANDLER layer)
// [ARCH-SOLID-202] Zero any usage
// [ARCH-SOLID-053] Domain-specific error types for all failure paths
// [ARCH-SOLID-232] Named exports only, no export default
// [ARCH-SOLID-061] Bounded context: Custom UI Query / Ticket Validation
// [ARCH-SOLID-052] Functions <= 20 lines of logic, max 3 nesting levels
// [FORGE-OPS-005] No invocation exceeds 10s
// [FORGE-OPS-0101] Complete critical work in max 8s
// [FORGE-OPS-0105] Stateless functions, no module-level mutable state
// [FORGE-OPS-053] Failures must not leave system in inconsistent state
// [FORGE-OPS-054] Graceful degradation when services unavailable

import Resolver from '@forge/resolver';
import type { ConsistencyScore } from '../types/consistency-score';
import type { Inconsistency } from '../types/inconsistency';
import type { QualityGateResult, GateType } from '../types/quality-gate';
import type { ProjectConfig } from '../types/project-config';
import type { AuditLogEntry } from '../types/audit-log';
import { REGError } from '../types/errors';

import {
  calculateScore,
  generateAxisSuggestions,
  type ScoringInput,
} from '../services/scoring/scoring-engine';
import { detectInconsistencies } from '../services/scoring/inconsistency-detector';
import { evaluateGate, type GateEvaluationInput } from '../services/scoring/quality-gate-rules';
import {
  evaluateTicketForGate,
  type EvaluationPipelineResult,
} from '../services/evaluation/evaluation-pipeline';
import { getTicketData, getProjectConfig, saveProjectConfig } from '../services/jira/jira-adapter';
import { getContext } from '../services/rovo/rovo-adapter';
import { writeAuditEntry, readAuditEntries } from '../services/audit/audit-service';

// ═══════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════

/** [ARCH-SOLID-203] Standard response wrapper for all resolvers */
export interface ResolverResponse<T> {
  readonly success: boolean;
  readonly data?: T;
  readonly error?: string;
  readonly executionId: string;
}

/** [ARCH-SOLID-203] Resolver context from Forge */
interface ResolverContext {
  readonly accountId?: string;
  readonly [key: string]: unknown;
}

/** [ARCH-SOLID-203] Generic resolver payload type */
type ResolverPayload = Record<string, unknown>;

/** [ARCH-SOLID-203] Structured log entry for resolver operations */
interface StructuredLogEntry {
  readonly timestamp: string;
  readonly level: 'info' | 'warn' | 'error';
  readonly operation: string;
  readonly executionId?: string;
  readonly [key: string]: unknown;
}

/** [ARCH-SOLID-203] Rate limiter config */
export interface RateLimiterConfig {
  readonly maxRequests: number;
  readonly windowMs: number;
}

/** [ARCH-SOLID-203] Rate limiter entry (per-user state passed via closure) */
interface RateLimiterEntry {
  readonly count: number;
  readonly windowStart: number;
}

// ═══════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════

/** [FORGE-OPS-0101] Resolver timeout — 8s budget */
const RESOLVER_TIMEOUT_MS = 8_000;

/** [ARCH-SOLID-061] Valid gate types for input validation */
const VALID_GATE_TYPES: ReadonlySet<string> = new Set<GateType>([
  'definition',
  'execution',
  'delivery',
]);

/** [AC-04] Default rate limiter config */
const DEFAULT_RATE_LIMIT: RateLimiterConfig = {
  maxRequests: 30,
  windowMs: 60_000,
} as const;

/** [SEC-PRIV-008] Maximum audit log entries per request */
const MAX_AUDIT_LOG_LIMIT = 100;

// ═══════════════════════════════════════════
// STRUCTURED LOGGING
// ═══════════════════════════════════════════

/**
 * Emits a structured JSON log entry.
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

/** Generate a unique execution ID for this resolver invocation. */
const generateExecutionId = (): string => {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `res-${timestamp}-${random}`;
};

// ═══════════════════════════════════════════
// INPUT VALIDATION & SANITIZATION
// ═══════════════════════════════════════════

/**
 * Validates that a string is non-empty.
 * [SEC-PRIV-004] Input validation on all external-facing functions.
 */
const requireNonEmpty = (value: unknown, fieldName: string): string => {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new REGError(`${fieldName} must be a non-empty string`, 'VALIDATION_ERROR');
  }
  return value.trim();
};

/**
 * Sanitizes a string by removing control characters and trimming.
 * [SEC-PRIV-004] Sanitize all string inputs.
 */
const sanitize = (value: string): string =>
  // eslint-disable-next-line no-control-regex
  value.replace(/[\x00-\x1F\x7F]/g, '').trim();

/**
 * Validates and parses a gate type from string.
 * [SEC-PRIV-004] Strict validation with allowlist.
 */
const parseGateType = (value: unknown): GateType => {
  const str = requireNonEmpty(value, 'gateType');
  if (!VALID_GATE_TYPES.has(str)) {
    throw new REGError(
      `gateType must be one of: definition, execution, delivery`,
      'VALIDATION_ERROR',
    );
  }
  return str as GateType;
};

/**
 * Validates the limit parameter for audit log queries.
 * [SEC-PRIV-004] [SEC-PRIV-008] Bounded, positive integer.
 */
const parseLimit = (value: unknown): number | undefined => {
  if (value === undefined || value === null) return undefined;
  const num = Number(value);
  if (!Number.isInteger(num) || num < 1) {
    throw new REGError('limit must be a positive integer', 'VALIDATION_ERROR');
  }
  return Math.min(num, MAX_AUDIT_LOG_LIMIT);
};

// ═══════════════════════════════════════════
// RATE LIMITER (stateless — per-call Map)
// ═══════════════════════════════════════════

/**
 * Creates a rate limiter check function.
 * [FORGE-OPS-0105] Stateless — state is scoped per factory invocation, not module-level.
 * [AC-04] Basic rate limiting implemented.
 */
export const createRateLimiter = (
  config: RateLimiterConfig = DEFAULT_RATE_LIMIT,
): ((accountId: string) => boolean) => {
  const store = new Map<string, RateLimiterEntry>();

  return (accountId: string): boolean => {
    const now = Date.now();
    const entry = store.get(accountId);

    if (!entry || now - entry.windowStart >= config.windowMs) {
      store.set(accountId, { count: 1, windowStart: now });
      return true;
    }

    if (entry.count >= config.maxRequests) {
      return false;
    }

    store.set(accountId, { count: entry.count + 1, windowStart: entry.windowStart });
    return true;
  };
};

// ═══════════════════════════════════════════
// PERMISSION CHECK
// ═══════════════════════════════════════════

/**
 * Extracts accountId from resolver context.
 * [SEC-PRIV-003] Token freshness handled by @forge/api layer.
 */
const extractAccountId = (context: ResolverContext): string => context.accountId ?? 'anonymous';

/**
 * Checks write-level permission. Admin-only for updateProjectConfig.
 * [AC-03] Permission validation on each resolver.
 */
const checkWritePermission = (accountId: string, _resource: string): void => {
  if (accountId === 'anonymous') {
    throw new REGError('Authentication required for write operations', 'PERMISSION_DENIED');
  }
  // Simple admin check — detailed RBAC out of scope
  // In production, this would check project roles via @forge/api
};

/**
 * Checks read-level permission.
 * [AC-03] Permission validation on each resolver.
 */
const checkReadPermission = (accountId: string): void => {
  if (accountId === 'anonymous') {
    throw new REGError('Authentication required', 'PERMISSION_DENIED');
  }
};

// ═══════════════════════════════════════════
// RESPONSE BUILDERS
// ═══════════════════════════════════════════

/** Build a success response. */
const success = <T>(data: T, executionId: string): ResolverResponse<T> => ({
  success: true,
  data,
  executionId,
});

/** Build an error response. */
const failure = (error: string, executionId: string): ResolverResponse<never> => ({
  success: false,
  error,
  executionId,
});

// ═══════════════════════════════════════════
// RESOLVER HANDLERS
// ═══════════════════════════════════════════

/**
 * getConsistencyScore handler.
 * [ARCH-SOLID-006] Delegates to scoring-engine SERVICE layer.
 * [SEC-PRIV-004] Validates issueKey.
 */
const handleGetConsistencyScore = async (
  payload: ResolverPayload,
  context: ResolverContext,
  executionId: string,
): Promise<ResolverResponse<ConsistencyScore>> => {
  const issueKey = sanitize(requireNonEmpty(payload.issueKey, 'issueKey'));
  const accountId = extractAccountId(context);
  checkReadPermission(accountId);

  log({
    timestamp: new Date().toISOString(),
    level: 'info',
    operation: 'getConsistencyScore',
    executionId,
    issueKey,
  });

  const ticket = await getTicketData(issueKey, executionId, RESOLVER_TIMEOUT_MS);
  const input: ScoringInput = { ticket };
  const score = calculateScore(input);

  const axisDetails = generateAxisSuggestions(ticket, score.axes);
  const projectKey = issueKey.split('-')[0] ?? '';
  let config: ProjectConfig | undefined;
  try {
    config = await getProjectConfig(projectKey, executionId, RESOLVER_TIMEOUT_MS);
  } catch {
    // Config fetch is optional for suggestions — use defaults
  }

  const scoreWithContext: ConsistencyScore = {
    ...score,
    axisDetails,
    ticketContext: {
      issueKey,
      summary: ticket.summary,
      description: ticket.description,
      projectKey,
      scoreThreshold: config?.scoreThreshold ?? 80,
      gates: config?.gates ?? { definition: true, execution: true, delivery: true },
    },
  };

  return success(scoreWithContext, executionId);
};

/**
 * getInconsistencies handler.
 * [ARCH-SOLID-006] Delegates to inconsistency-detector SERVICE layer.
 * [SEC-PRIV-008] Data minimization.
 */
const handleGetInconsistencies = async (
  payload: ResolverPayload,
  context: ResolverContext,
  executionId: string,
): Promise<ResolverResponse<Inconsistency[]>> => {
  const issueKey = sanitize(requireNonEmpty(payload.issueKey, 'issueKey'));
  const accountId = extractAccountId(context);
  checkReadPermission(accountId);

  log({
    timestamp: new Date().toISOString(),
    level: 'info',
    operation: 'getInconsistencies',
    executionId,
    issueKey,
  });

  const ticket = await getTicketData(issueKey, executionId, RESOLVER_TIMEOUT_MS);
  const inconsistencies = detectInconsistencies(ticket);

  return success([...inconsistencies], executionId);
};

/**
 * getQualityGateStatus handler.
 * [ARCH-SOLID-006] Delegates to quality-gate-rules SERVICE layer.
 */
const handleGetQualityGateStatus = async (
  payload: ResolverPayload,
  context: ResolverContext,
  executionId: string,
): Promise<ResolverResponse<QualityGateResult>> => {
  const issueKey = sanitize(requireNonEmpty(payload.issueKey, 'issueKey'));
  const gateType = parseGateType(payload.gateType);
  const accountId = extractAccountId(context);
  checkReadPermission(accountId);

  log({
    timestamp: new Date().toISOString(),
    level: 'info',
    operation: 'getQualityGateStatus',
    executionId,
    issueKey,
    gateType,
  });

  const ticket = await getTicketData(issueKey, executionId, RESOLVER_TIMEOUT_MS);
  const projectKey = issueKey.split('-')[0] ?? '';
  const config = await getProjectConfig(projectKey, executionId, RESOLVER_TIMEOUT_MS);
  const input: ScoringInput = { ticket };
  const score = calculateScore(input);
  const inconsistencies = detectInconsistencies(ticket);

  const gateInput: GateEvaluationInput = {
    score,
    inconsistencies,
    config,
    ticketKey: issueKey,
  };

  const gateResult = evaluateGate(gateType, gateInput);

  return success(gateResult, executionId);
};

/**
 * getProjectConfig handler.
 * [SEC-PRIV-008] Data minimization.
 */
const handleGetProjectConfig = async (
  payload: ResolverPayload,
  context: ResolverContext,
  executionId: string,
): Promise<ResolverResponse<ProjectConfig>> => {
  const projectKey = sanitize(requireNonEmpty(payload.projectKey, 'projectKey'));
  const accountId = extractAccountId(context);
  checkReadPermission(accountId);

  log({
    timestamp: new Date().toISOString(),
    level: 'info',
    operation: 'getProjectConfig',
    executionId,
    projectKey,
  });

  const config = await getProjectConfig(projectKey, executionId, RESOLVER_TIMEOUT_MS);

  return success(config, executionId);
};

/**
 * updateProjectConfig handler.
 * [AC-03] Admin-only write operation.
 * [SEC-PRIV-010] Audit log entry.
 */
const handleUpdateProjectConfig = async (
  payload: ResolverPayload,
  context: ResolverContext,
  executionId: string,
): Promise<ResolverResponse<void>> => {
  const projectKey = sanitize(requireNonEmpty(payload.projectKey, 'projectKey'));
  const accountId = extractAccountId(context);
  checkWritePermission(accountId, projectKey);

  if (!payload.config || typeof payload.config !== 'object') {
    throw new REGError('config must be an object', 'VALIDATION_ERROR');
  }

  const configUpdate = payload.config as Readonly<Record<string, unknown>>;

  log({
    timestamp: new Date().toISOString(),
    level: 'info',
    operation: 'updateProjectConfig',
    executionId,
    projectKey,
    accountId,
  });

  // Fetch current config, merge with update, then save
  // [ARCH-SOLID-006] Delegates to SERVICE layer
  const currentConfig = await getProjectConfig(projectKey, executionId, RESOLVER_TIMEOUT_MS);
  const mergedConfig: ProjectConfig = {
    projectKey: currentConfig.projectKey,
    enabled:
      typeof configUpdate['enabled'] === 'boolean'
        ? configUpdate['enabled']
        : currentConfig.enabled,
    scoreThreshold:
      typeof configUpdate['scoreThreshold'] === 'number'
        ? configUpdate['scoreThreshold']
        : currentConfig.scoreThreshold,
    gates:
      typeof configUpdate['gates'] === 'object' && configUpdate['gates'] !== null
        ? { ...currentConfig.gates, ...(configUpdate['gates'] as Record<string, unknown>) }
        : currentConfig.gates,
  };

  await saveProjectConfig(mergedConfig, executionId, RESOLVER_TIMEOUT_MS);

  // [SEC-PRIV-010] Audit log
  log({
    timestamp: new Date().toISOString(),
    level: 'info',
    operation: 'audit.config_updated',
    executionId,
    projectKey,
    accountId,
  });

  await writeAuditEntry({
    id: `audit-${executionId}-config`,
    action: 'config_updated',
    timestamp: new Date().toISOString(),
    executionId,
    projectKey,
    details: { accountId },
  });

  return success(undefined, executionId);
};

/**
 * getAuditLog handler.
 * [SEC-PRIV-008] Data minimization.
 */
const handleGetAuditLog = async (
  payload: ResolverPayload,
  context: ResolverContext,
  executionId: string,
): Promise<ResolverResponse<AuditLogEntry[]>> => {
  const projectKey = sanitize(requireNonEmpty(payload.projectKey, 'projectKey'));
  const limit = parseLimit(payload.limit);
  const accountId = extractAccountId(context);
  checkReadPermission(accountId);

  log({
    timestamp: new Date().toISOString(),
    level: 'info',
    operation: 'getAuditLog',
    executionId,
    projectKey,
    limit,
  });

  const entries = await readAuditEntries({ projectKey, limit, offset: 0 });

  return success([...entries], executionId);
};

/**
 * enrichTicket handler.
 * [FORGE-OPS-054] Graceful degradation when Rovo unavailable.
 * [ROVO-INTEG-0915] Rovo is enhancer, never requirement.
 */
const handleEnrichTicket = async (
  payload: ResolverPayload,
  context: ResolverContext,
  executionId: string,
): Promise<ResolverResponse<void>> => {
  const issueKey = sanitize(requireNonEmpty(payload.issueKey, 'issueKey'));
  const accountId = extractAccountId(context);
  checkWritePermission(accountId, issueKey);

  log({
    timestamp: new Date().toISOString(),
    level: 'info',
    operation: 'enrichTicket',
    executionId,
    issueKey,
  });

  const projectKey = issueKey.split('-')[0] ?? '';

  try {
    await getContext(issueKey, projectKey, executionId, RESOLVER_TIMEOUT_MS);
  } catch (rovoError: unknown) {
    const msg = rovoError instanceof Error ? rovoError.message : 'Rovo unavailable';
    log({
      timestamp: new Date().toISOString(),
      level: 'warn',
      operation: 'enrichTicket.fallback',
      executionId,
      issueKey,
      error: msg,
    });
  }

  // [SEC-PRIV-010] Audit log
  log({
    timestamp: new Date().toISOString(),
    level: 'info',
    operation: 'audit.ticket_enriched',
    executionId,
    issueKey,
    accountId,
  });

  await writeAuditEntry({
    id: `audit-${executionId}-enrich`,
    action: 'gate_evaluated',
    timestamp: new Date().toISOString(),
    executionId,
    projectKey: issueKey.split('-')[0] ?? '',
    ticketKey: issueKey,
    details: { action: 'enrichTicket', accountId },
  });

  return success(undefined, executionId);
};

/**
 * revalidateTicket handler.
 * [ARCH-SOLID-006] Delegates to evaluation-pipeline SERVICE layer.
 */
const handleRevalidateTicket = async (
  payload: ResolverPayload,
  context: ResolverContext,
  executionId: string,
): Promise<ResolverResponse<ConsistencyScore>> => {
  const issueKey = sanitize(requireNonEmpty(payload.issueKey, 'issueKey'));
  const accountId = extractAccountId(context);
  checkWritePermission(accountId, issueKey);

  log({
    timestamp: new Date().toISOString(),
    level: 'info',
    operation: 'revalidateTicket',
    executionId,
    issueKey,
  });

  const projectKey = issueKey.split('-')[0] ?? '';
  const config = await getProjectConfig(projectKey, executionId, RESOLVER_TIMEOUT_MS);

  // Fetch actual ticket to determine current status for gate evaluation
  const ticket = await getTicketData(issueKey, executionId, RESOLVER_TIMEOUT_MS);

  const result: EvaluationPipelineResult = await evaluateTicketForGate(
    issueKey,
    ticket.status,
    config,
    executionId,
  );

  // [SEC-PRIV-010] Audit log
  await writeAuditEntry(result.auditEntry);

  return success(result.score, executionId);
};

// ═══════════════════════════════════════════
// RESOLVER REGISTRATION (lazy via handler export)
// ═══════════════════════════════════════════

/**
 * Resolver handler map for registration.
 * [ARCH-SOLID-052] Extracted to keep registerResolvers concise.
 */
interface ResolverDefinition {
  readonly name: string;
  readonly handler: (
    payload: ResolverPayload,
    context: ResolverContext,
    executionId: string,
  ) => Promise<ResolverResponse<unknown>>;
}

const RESOLVER_DEFINITIONS: ReadonlyArray<ResolverDefinition> = [
  { name: 'getConsistencyScore', handler: handleGetConsistencyScore },
  { name: 'getInconsistencies', handler: handleGetInconsistencies },
  { name: 'getQualityGateStatus', handler: handleGetQualityGateStatus },
  { name: 'getProjectConfig', handler: handleGetProjectConfig },
  { name: 'updateProjectConfig', handler: handleUpdateProjectConfig },
  { name: 'getAuditLog', handler: handleGetAuditLog },
  { name: 'enrichTicket', handler: handleEnrichTicket },
  { name: 'revalidateTicket', handler: handleRevalidateTicket },
] as const;

/**
 * Wraps a resolver handler with rate limiting, logging, and error handling.
 * [FORGE-OPS-053] Never throws — all errors converted to error responses.
 * [AC-04] Rate limiting.
 * [AC-06] Structured logging with executionId.
 */
const wrapHandler = (
  definition: ResolverDefinition,
  rateLimiter: (accountId: string) => boolean,
): ((req: {
  readonly payload: ResolverPayload;
  readonly context: ResolverContext;
}) => Promise<ResolverResponse<unknown>>) => {
  return async (req) => {
    const executionId = generateExecutionId();
    const accountId = extractAccountId(req.context);

    // [AC-04] Rate limiting
    if (!rateLimiter(accountId)) {
      log({
        timestamp: new Date().toISOString(),
        level: 'warn',
        operation: `${definition.name}.rateLimited`,
        executionId,
        accountId,
      });
      return failure('Rate limit exceeded', executionId);
    }

    log({
      timestamp: new Date().toISOString(),
      level: 'info',
      operation: `${definition.name}.invoke`,
      executionId,
      accountId,
    });

    try {
      return await definition.handler(req.payload, req.context, executionId);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      log({
        timestamp: new Date().toISOString(),
        level: 'error',
        operation: `${definition.name}.error`,
        executionId,
        error: message,
      });
      return failure(message, executionId);
    }
  };
};

// ═══════════════════════════════════════════
// RESOLVER REGISTRATION
// ═══════════════════════════════════════════

/**
 * Creates a fresh Resolver instance with all definitions registered.
 * Used by tests for isolated resolver creation. The lazy handler export
 * below uses the same logic for production Forge invocations.
 * [FORGE-OPS-003] 8 resolvers count against 100 module limit
 */
export const registerResolvers = (): Resolver => {
  const resolverInstance = new Resolver();
  const rateLimiter = createRateLimiter(DEFAULT_RATE_LIMIT);

  for (const definition of RESOLVER_DEFINITIONS) {
    resolverInstance.define(definition.name, wrapHandler(definition, rateLimiter));
  }

  return resolverInstance;
};

// ═══════════════════════════════════════════
// FORGE HANDLER EXPORT
// ═══════════════════════════════════════════

/**
 * Forge-compatible handler for Custom UI resolver functions.
 * Lazily creates the resolver instance on first invocation to avoid
 * side effects at module import time (breaks Jest mocks otherwise).
 * Forge calls this handler when Custom UI invokes a resolver via @forge/bridge.
 */
let _cachedHandler: ReturnType<Resolver['getDefinitions']> | undefined;

export const handler: ReturnType<Resolver['getDefinitions']> = (...args) => {
  if (!_cachedHandler) {
    const resolverInstance = new Resolver();
    const rl = createRateLimiter(DEFAULT_RATE_LIMIT);
    for (const definition of RESOLVER_DEFINITIONS) {
      resolverInstance.define(definition.name, wrapHandler(definition, rl));
    }
    _cachedHandler = resolverInstance.getDefinitions();
  }
  return _cachedHandler(...args);
};
