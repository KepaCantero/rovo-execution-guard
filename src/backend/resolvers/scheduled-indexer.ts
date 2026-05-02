// [ARCH-SOLID-058] HANDLER layer — Forge scheduled trigger for graph health monitoring
// [ARCH-SOLID-006] Handler -> Service -> Repository pattern (HANDLER layer)
// [ARCH-SOLID-202] Zero any usage
// [ARCH-SOLID-232] Named exports only, no export default
// [ARCH-SOLID-235] One main export per file (handler)
// [FORGE-OPS-005] No invocation exceeds 10s (20s budget with guard)
// [FORGE-OPS-0105] Stateless functions, no module-level mutable state
// [FORGE-OPS-053] Failures must not leave system in inconsistent state
// [FORGE-OPS-054] Graceful degradation when services unavailable

import {
  generateHealthReport,
  type GraphHealthReport,
  type MaintenanceResult,
} from '../services/relationship-index/graph-maintenance';

// ═══════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════

/** [ARCH-SOLID-203] Scheduled trigger payload */
export interface ScheduledMaintenancePayload {
  readonly projectKey?: string;
}

/** [ARCH-SOLID-203] Forge scheduled trigger context */
interface ScheduledMaintenanceContext {
  readonly accountId?: string;
}

/** [ARCH-SOLID-203] Result of scheduled maintenance execution */
export interface ScheduledMaintenanceResult {
  readonly result: 'success' | 'error' | 'timeout';
  readonly executionId: string;
  readonly healthReport?: GraphHealthReport;
  readonly maintenanceResult?: MaintenanceResult;
  readonly error?: string;
  readonly errors: readonly string[];
}

/** [ARCH-SOLID-203] Structured log entry */
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

/** [FORGE-OPS-005] Timeout budget — 20s with 5s margin under Forge 25s limit */
const MAINTENANCE_TIMEOUT_MS = 20_000;

// ═══════════════════════════════════════════
// STRUCTURED LOGGING
// ═══════════════════════════════════════════

const log = (entry: StructuredLogEntry): void => {
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(entry));
};

// ═══════════════════════════════════════════
// EXECUTION ID
// ═══════════════════════════════════════════

const generateExecutionId = (): string => {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `smh-${timestamp}-${random}`;
};

// ═══════════════════════════════════════════
// TIMEOUT GUARD
// ═══════════════════════════════════════════

/**
 * Creates a timeout promise that rejects after MAINTENANCE_TIMEOUT_MS.
 * [FORGE-OPS-005] Ensures handler returns within Forge function limit.
 */
const createTimeoutGuard = (_executionId: string): Promise<never> =>
  new Promise((_resolve, reject) => {
    setTimeout(() => {
      reject(new Error(`Maintenance timed out after ${MAINTENANCE_TIMEOUT_MS}ms`));
    }, MAINTENANCE_TIMEOUT_MS);
  });

// ═══════════════════════════════════════════
// BUSINESS LOGIC
// ═══════════════════════════════════════════

/**
 * Executes scheduled maintenance for a project's relationship graph.
 * [ARCH-SOLID-006] Delegates to SERVICE layer (graph-maintenance).
 * [FORGE-OPS-054] Never throws — errors returned in result.
 */
export async function onScheduledMaintenance(
  payload: ScheduledMaintenancePayload,
  executionId: string,
): Promise<ScheduledMaintenanceResult> {
  const projectKey = payload.projectKey?.trim();

  if (!projectKey) {
    log({
      timestamp: new Date().toISOString(),
      level: 'warn',
      operation: 'onScheduledMaintenance.missingProjectKey',
      executionId,
    });
    return {
      result: 'error',
      executionId,
      error: 'projectKey is required for scheduled maintenance',
      errors: ['projectKey is required'],
    };
  }

  log({
    timestamp: new Date().toISOString(),
    level: 'info',
    operation: 'onScheduledMaintenance.start',
    executionId,
    projectKey,
  });

  try {
    const healthReport = await Promise.race([
      generateHealthReport(projectKey, executionId),
      createTimeoutGuard(executionId),
    ]);

    log({
      timestamp: new Date().toISOString(),
      level: 'info',
      operation: 'onScheduledMaintenance.complete',
      executionId,
      projectKey,
      status: healthReport.status,
      totalNodes: healthReport.totalNodes,
      totalEdges: healthReport.totalEdges,
    });

    return {
      result: 'success',
      executionId,
      healthReport,
      errors: [],
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Scheduled maintenance failed';
    log({
      timestamp: new Date().toISOString(),
      level: 'error',
      operation: 'onScheduledMaintenance.failed',
      executionId,
      projectKey,
      error: message,
    });

    const isTimeout = message.includes('timed out');
    return {
      result: isTimeout ? 'timeout' : 'error',
      executionId,
      error: message,
      errors: [message],
    };
  }
}

// ═══════════════════════════════════════════
// FORGE HANDLER EXPORT
// ═══════════════════════════════════════════

/**
 * Forge-compatible handler for scheduled maintenance trigger.
 * [FORGE-OPS-005] Scheduled trigger handler — invoked by Forge on schedule
 * [FORGE-OPS-053] Never throws — all errors in result
 * [ARCH-SOLID-235] Single export: handler
 */
export async function handler(
  payload: ScheduledMaintenancePayload,
  _context: ScheduledMaintenanceContext,
): Promise<ScheduledMaintenanceResult> {
  const executionId = generateExecutionId();
  return onScheduledMaintenance(payload, executionId);
}
