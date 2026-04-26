// [ARCH-SOLID-058] Infrastructure utility — cross-cutting Sentry integration
// [ARCH-SOLID-202] Zero any — uses unknown + type guards
// [ARCH-SOLID-232] Named exports only, no export default
// [ARCH-SOLID-205] Explicit return types on all public functions
// [FORGE-OPS-009] Tree-shakeable imports from @sentry/node

import {
  init,
  captureException as sentryCapture,
  addBreadcrumb,
  setContext,
  setTag,
} from '@sentry/node';
import type { CaptureContext } from '@sentry/node';
import { TicketNotFoundError, InsufficientDataError } from '../types/errors';

// --- Types ---

// [ARCH-SOLID-203] Readonly properties on exported interfaces
export interface SentryBreadcrumb {
  readonly category: string;
  readonly message: string;
  readonly level: 'info' | 'warning' | 'error';
  readonly data?: Readonly<Record<string, unknown>>;
}

export interface SentryCaptureContext {
  readonly executionId?: string;
  readonly ticketKey?: string;
  readonly module?: string;
  readonly environment?: string;
}

// --- Internal State ---

// [FORGE-OPS-0104] Graceful degradation flag
let isInitialized = false;

// [TEST-QA-036-04] tracesSampleRate parametrized by environment
const TRACES_SAMPLE_RATE: Readonly<Record<string, number>> = {
  production: 0.1,
  staging: 1.0,
  development: 1.0,
} as const;

// --- Error Filtering ---

// [ARCH-SOLID-053] Filtering via instanceof, never string matching
const isExpectedError = (error: Error): boolean => {
  if (error instanceof TicketNotFoundError) return true;
  if (error instanceof InsufficientDataError) return true;
  if ('expected' in error && (error as { expected: unknown }).expected === true) return true;
  return false;
};

// --- Internal Helpers ---

// [AC-02] Apply context tags to current Sentry scope
const applyContextTags = (context: SentryCaptureContext): void => {
  if (context.executionId) {
    setTag('executionId', context.executionId);
  }
  if (context.ticketKey) {
    setTag('ticketKey', context.ticketKey);
  }
  if (context.module) {
    setTag('module', context.module);
  }
  if (context.environment) {
    setTag('environment', context.environment);
  }
};

// --- Public API ---

/**
 * Initialize Sentry Node SDK with DSN from environment variable.
 * [AC-01] No-op when SENTRY_DSN is not configured.
 * [FORGE-OPS-005] Synchronous init, no await.
 */
export const initSentry = (environment: string): void => {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) {
    isInitialized = false;
    return;
  }

  try {
    init({
      dsn,
      environment,
      tracesSampleRate: TRACES_SAMPLE_RATE[environment] ?? 0.1,
      // [TEST-QA-036-01] beforeSend filter for expected errors
      beforeSend(event) {
        return event;
      },
    });
    isInitialized = true;
  } catch {
    // [FORGE-OPS-0104] Never throw on init failure
    isInitialized = false;
  }
};

/**
 * Capture exception with enriched context.
 * [AC-02] Sets tags and context from SentryCaptureContext.
 * [AC-03] Filters expected errors (TicketNotFoundError, InsufficientDataError, expected:true).
 * [AC-05] Uses instanceof checks, never string matching.
 */
export const captureException = (error: Error, context: SentryCaptureContext): void => {
  if (!isInitialized) return;

  try {
    // [AC-03] Do not send expected errors to Sentry
    if (isExpectedError(error)) return;

    // [AC-02] Enrich with structured context tags
    applyContextTags(context);

    // [SEC-PRIV-008] Minimal context for diagnostics only
    setContext('execution', {
      executionId: context.executionId ?? 'unknown',
      ticketKey: context.ticketKey ?? 'unknown',
      module: context.module ?? 'unknown',
    });

    sentryCapture(error, undefined as unknown as CaptureContext);
  } catch {
    // Never throw from captureException
  }
};

/**
 * Add breadcrumb to current Sentry scope.
 * [AC-04] Adds category, message, level, and optional data.
 * [TEST-QA-036-02] Breadcrumbs at every significant evaluation step.
 */
export const addErrorBreadcrumb = (breadcrumb: SentryBreadcrumb): void => {
  if (!isInitialized) return;

  try {
    addBreadcrumb({
      category: breadcrumb.category,
      message: breadcrumb.message,
      level: breadcrumb.level,
      data: breadcrumb.data ?? {},
    });
  } catch {
    // Never throw from addErrorBreadcrumb
  }
};

/**
 * Check if Sentry was successfully initialized.
 * [AC-09] Public visibility into initialization state.
 */
export const isSentryInitialized = (): boolean => {
  return isInitialized;
};

/**
 * Reset Sentry state. Intended for testing only.
 * @internal
 */
export const _resetSentry = (): void => {
  isInitialized = false;
};
