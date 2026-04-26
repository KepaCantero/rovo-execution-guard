// [ARCH-SOLID-058] Infrastructure utility — cross-cutting Sentry Browser integration
// [ARCH-SOLID-202] Zero any — uses unknown + type guards
// [ARCH-SOLID-232] Named exports only, no export default
// [ARCH-SOLID-205] Explicit return types on all public functions
// [FORGE-OPS-009] Tree-shakeable imports from @sentry/browser

import {
  init,
  captureException as sentryCapture,
  addBreadcrumb,
  setContext,
  setTag,
  Severity,
} from '@sentry/browser';

// --- Types ---

// [ARCH-SOLID-203] Readonly properties on exported interfaces
export interface BrowserSentryBreadcrumb {
  readonly category: string;
  readonly message: string;
  readonly level: 'info' | 'warning' | 'error';
  readonly data?: Readonly<Record<string, unknown>>;
}

export interface BrowserSentryContext {
  readonly issueKey?: string;
  readonly projectKey?: string;
  readonly [key: string]: unknown;
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

// --- Public API ---

/**
 * Initialize Sentry Browser SDK with explicit DSN and environment.
 * [AC-01] No-op when DSN is empty or undefined.
 * [AC-03] Configures unhandled promise rejection capture.
 */
export const initSentryBrowser = (dsn: string, environment: string): void => {
  if (!dsn) {
    isInitialized = false;
    return;
  }

  try {
    init({
      dsn,
      environment,
      tracesSampleRate: TRACES_SAMPLE_RATE[environment] ?? 0.1,
    });
    isInitialized = true;
  } catch {
    // [FORGE-OPS-0104] Never throw on init failure
    isInitialized = false;
  }
};

/**
 * Capture exception with enriched context.
 * [AC-02] Sets tags issueKey, projectKey and structured context.
 * No error filtering — all frontend errors are unexpected.
 */
export const captureException = (error: Error, context: BrowserSentryContext): void => {
  if (!isInitialized) return;

  try {
    // [AC-02] Enrich with issue/project tags
    if (context.issueKey) {
      setTag('issueKey', context.issueKey);
    }
    if (context.projectKey) {
      setTag('projectKey', context.projectKey);
    }

    // [SEC-PRIV-008] Minimal context for diagnostics only
    setContext('browser', {
      issueKey: context.issueKey ?? 'unknown',
      projectKey: context.projectKey ?? 'unknown',
    });

    sentryCapture(error);
  } catch {
    // [FORGE-OPS-0104] Never throw from captureException
  }
};

/**
 * Add breadcrumb to current Sentry scope.
 * [AC-04] Adds category, message, level, and optional data.
 * [TEST-QA-036-02] Breadcrumbs at every significant UI step.
 */
export const addErrorBreadcrumb = (breadcrumb: BrowserSentryBreadcrumb): void => {
  if (!isInitialized) return;

  try {
    addBreadcrumb({
      category: breadcrumb.category,
      message: breadcrumb.message,
      level: breadcrumb.level as Severity,
      data: breadcrumb.data ?? {},
    });
  } catch {
    // [FORGE-OPS-0104] Never throw from addErrorBreadcrumb
  }
};

/**
 * Check if Sentry was successfully initialized.
 * [AC-08] Public visibility into initialization state.
 */
export const isSentryInitialized = (): boolean => {
  return isInitialized;
};

/**
 * Reset Sentry state. Intended for testing only.
 * @internal
 */
export const _resetForTesting = (): void => {
  isInitialized = false;
};
