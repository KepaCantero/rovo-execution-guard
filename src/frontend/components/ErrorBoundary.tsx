// [ARCH-SOLID-058] No direct @sentry/browser imports — uses sentry.ts abstraction
// [ARCH-SOLID-202] Zero any — uses unknown, typed interfaces
// [ARCH-SOLID-232] Named export ErrorBoundaryWrapper — follows project convention
// [ARCH-SOLID-203] Readonly properties on all interfaces
// [ARCH-SOLID-205] Explicit return types on all methods
// [FORGE-OPS-009] No heavy UI library in fallback — plain React only
// [FORGE-OPS-0104] Graceful degradation — fallback renders even without Sentry

import { Component } from 'react';
import type { ReactNode, ErrorInfo } from 'react';

import { captureException, addErrorBreadcrumb } from '../utils/sentry';
import type { BrowserSentryContext, BrowserSentryBreadcrumb } from '../utils/sentry';

// ═══════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════

// [ARCH-SOLID-203] Readonly properties
interface ErrorBoundaryProps {
  readonly children: ReactNode;
  readonly issueKey?: string;
  readonly projectKey?: string;
  readonly fallback?: ReactNode;
}

// [ARCH-SOLID-203] Readonly properties
interface ErrorBoundaryState {
  readonly hasError: boolean;
  readonly error: Error | null;
}

// ═══════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════

const DEFAULT_FALLBACK_MESSAGE = 'Something went wrong';

// ═══════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════

/**
 * React Error Boundary that captures errors from the child component tree
 * and sends them to Sentry with component stack information.
 *
 * AC ref: AC-01 to AC-11 from ErrorBoundary.reqs.md
 * REGLA: [FORGE-OPS-0104] — graceful degradation, fallback always renders
 * REGLA: [UI-ADS-0955] — class component required (React API constraint)
 */
export class ErrorBoundaryWrapper extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  // [ARCH-SOLID-205] Explicit state type
  public readonly state: ErrorBoundaryState = {
    hasError: false,
    error: null,
  };

  // [TEST-QA-036-01] getDerivedStateFromError updates state
  public static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  // [TEST-QA-036-01] componentDidCatch sends to Sentry
  // [ARCH-SOLID-205] Explicit return type
  public componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // [SEC-PRIV-008] Minimal context — only issueKey, projectKey, componentStack
    // [TEST-QA-036-03] componentStack in BrowserSentryContext via index signature
    const context: BrowserSentryContext = {
      issueKey: this.props.issueKey,
      projectKey: this.props.projectKey,
      componentStack: errorInfo.componentStack,
    };

    // [AC-01] captureException with context — no-op if Sentry not initialized
    captureException(error, context);

    // [AC-02] [TEST-QA-036-02] Breadcrumb with category error-boundary
    const breadcrumb: BrowserSentryBreadcrumb = {
      category: 'error-boundary',
      message: `Error caught by boundary: ${error.message}`,
      level: 'error',
      data: {
        componentStack: errorInfo.componentStack,
      },
    };
    addErrorBreadcrumb(breadcrumb);
  }

  // [ARCH-SOLID-205] Explicit return type
  // [FORGE-OPS-0104] Fallback UI always renders
  public render(): ReactNode {
    if (this.state.hasError) {
      // [AC-04] Custom fallback or default
      if (this.props.fallback !== undefined) {
        return this.props.fallback;
      }
      return <div>{DEFAULT_FALLBACK_MESSAGE}</div>;
    }

    return this.props.children;
  }
}
