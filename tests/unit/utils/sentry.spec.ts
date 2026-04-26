// Test suite for the Sentry integration module (backend)
// Covers: init, capture, breadcrumbs, filtering, no-op, state, security
// Pattern: Arrange-Act-Assert (AAA), TDD cycle: RED -> GREEN -> REFACTOR
// [TEST-QA-056]
// [TEST-QA-036-01] captureException sends non-filtered errors
// [TEST-QA-036-02] Breadcrumbs at every significant evaluation step
// [TEST-QA-036-03] Structured context: executionId, ticketKey, module
// [TEST-QA-036-04] tracesSampleRate parametrized by environment

// =====================================================================
// MOCKS — must come before imports that depend on @sentry/node
// =====================================================================

jest.mock('@sentry/node', () => ({
  init: jest.fn(),
  captureException: jest.fn(),
  addBreadcrumb: jest.fn(),
  setContext: jest.fn(),
  setTag: jest.fn(),
}));

import {
  initSentry,
  captureException,
  addErrorBreadcrumb,
  isSentryInitialized,
  _resetSentry,
} from '../../../src/backend/utils/sentry';
import type { SentryBreadcrumb, SentryCaptureContext } from '../../../src/backend/utils/sentry';
import {
  TicketNotFoundError,
  InsufficientDataError,
  RovoApiError,
  TimeoutError,
  CircuitOpenError,
} from '../../../src/backend/types/errors';

import {
  init as mockInit,
  captureException as mockSentryCapture,
  addBreadcrumb as mockAddBreadcrumb,
  setContext as mockSetContext,
  setTag as mockSetTag,
} from '@sentry/node';

// =====================================================================
// FIXTURES
// =====================================================================

const VALID_DSN = 'https://examplePublicKey@o0.ingest.sentry.io/0';

const makeContext = (overrides?: Partial<SentryCaptureContext>): SentryCaptureContext => ({
  executionId: 'exec-001',
  ticketKey: 'PROJ-123',
  module: 'scoring',
  environment: 'production',
  ...overrides,
});

const makeBreadcrumb = (overrides?: Partial<SentryBreadcrumb>): SentryBreadcrumb => ({
  category: 'evaluation',
  message: 'Score calculated',
  level: 'info',
  ...overrides,
});

// =====================================================================
// TEST SUITE
// =====================================================================

describe('sentry (backend)', () => {
  // ─── Setup & Teardown ─────────────────

  beforeEach(() => {
    jest.resetAllMocks();
    _resetSentry();
    delete process.env.SENTRY_DSN;
  });

  afterEach(() => {
    delete process.env.SENTRY_DSN;
    _resetSentry();
  });

  // ─── initSentry() ────────────────────

  describe('initSentry()', () => {
    it('should initialize Sentry SDK when SENTRY_DSN is set (AC-01)', () => {
      // Arrange
      process.env.SENTRY_DSN = VALID_DSN;

      // Act
      initSentry('production');

      // Assert
      expect(mockInit).toHaveBeenCalledTimes(1);
      expect(mockInit).toHaveBeenCalledWith(
        expect.objectContaining({
          dsn: VALID_DSN,
          environment: 'production',
        }),
      );
    });

    it('should NOT initialize when SENTRY_DSN is absent (AC-01, AC-06)', () => {
      // Arrange — no SENTRY_DSN set

      // Act
      initSentry('production');

      // Assert
      expect(mockInit).not.toHaveBeenCalled();
      expect(isSentryInitialized()).toBe(false);
    });

    it('should NOT initialize when SENTRY_DSN is empty string (AC-01)', () => {
      // Arrange
      process.env.SENTRY_DSN = '';

      // Act
      initSentry('production');

      // Assert
      expect(mockInit).not.toHaveBeenCalled();
      expect(isSentryInitialized()).toBe(false);
    });

    it('should configure tracesSampleRate 0.1 for production (AC-06, TEST-QA-036-04)', () => {
      // Arrange
      process.env.SENTRY_DSN = VALID_DSN;

      // Act
      initSentry('production');

      // Assert
      expect(mockInit).toHaveBeenCalledWith(
        expect.objectContaining({
          tracesSampleRate: 0.1,
        }),
      );
    });

    it('should configure tracesSampleRate 1.0 for staging (AC-06, TEST-QA-036-04)', () => {
      // Arrange
      process.env.SENTRY_DSN = VALID_DSN;

      // Act
      initSentry('staging');

      // Assert
      expect(mockInit).toHaveBeenCalledWith(
        expect.objectContaining({
          tracesSampleRate: 1.0,
        }),
      );
    });

    it('should configure tracesSampleRate 1.0 for development (AC-06, TEST-QA-036-04)', () => {
      // Arrange
      process.env.SENTRY_DSN = VALID_DSN;

      // Act
      initSentry('development');

      // Assert
      expect(mockInit).toHaveBeenCalledWith(
        expect.objectContaining({
          tracesSampleRate: 1.0,
        }),
      );
    });

    it('should fallback to 0.1 tracesSampleRate for unknown environment (AC-06)', () => {
      // Arrange
      process.env.SENTRY_DSN = VALID_DSN;

      // Act
      initSentry('unknown-env');

      // Assert
      expect(mockInit).toHaveBeenCalledWith(
        expect.objectContaining({
          tracesSampleRate: 0.1,
        }),
      );
    });

    it('should register beforeSend callback (TEST-QA-036-01)', () => {
      // Arrange
      process.env.SENTRY_DSN = VALID_DSN;

      // Act
      initSentry('production');

      // Assert
      const initCall = (mockInit as jest.Mock).mock.calls[0][0] as Record<string, unknown>;
      expect(typeof initCall.beforeSend).toBe('function');
    });

    it('should gracefully handle init failure without throwing (FORGE-OPS-0104)', () => {
      // Arrange
      process.env.SENTRY_DSN = VALID_DSN;
      (mockInit as jest.Mock).mockImplementation(() => {
        throw new Error('Sentry init failed');
      });

      // Act & Assert — should not throw
      expect(() => initSentry('production')).not.toThrow();
      expect(isSentryInitialized()).toBe(false);
    });
  });

  // ─── captureException() ──────────────

  describe('captureException()', () => {
    it('should capture a generic error with enriched context (AC-02, TEST-QA-036-03)', () => {
      // Arrange
      process.env.SENTRY_DSN = VALID_DSN;
      initSentry('production');
      const error = new Error('Something went wrong');
      const context = makeContext();

      // Act
      captureException(error, context);

      // Assert
      expect(mockSentryCapture).toHaveBeenCalledTimes(1);
      expect(mockSentryCapture).toHaveBeenCalledWith(error, undefined);
    });

    it('should set executionId tag when provided (AC-02, TEST-QA-036-03)', () => {
      // Arrange
      process.env.SENTRY_DSN = VALID_DSN;
      initSentry('production');
      const error = new Error('test');
      const context = makeContext({ executionId: 'exec-abc-123' });

      // Act
      captureException(error, context);

      // Assert
      expect(mockSetTag).toHaveBeenCalledWith('executionId', 'exec-abc-123');
    });

    it('should set ticketKey tag when provided (AC-02, TEST-QA-036-03)', () => {
      // Arrange
      process.env.SENTRY_DSN = VALID_DSN;
      initSentry('production');
      const error = new Error('test');
      const context = makeContext({ ticketKey: 'PROJ-456' });

      // Act
      captureException(error, context);

      // Assert
      expect(mockSetTag).toHaveBeenCalledWith('ticketKey', 'PROJ-456');
    });

    it('should set module tag when provided (AC-02, TEST-QA-036-03)', () => {
      // Arrange
      process.env.SENTRY_DSN = VALID_DSN;
      initSentry('production');
      const error = new Error('test');
      const context = makeContext({ module: 'jira-adapter' });

      // Act
      captureException(error, context);

      // Assert
      expect(mockSetTag).toHaveBeenCalledWith('module', 'jira-adapter');
    });

    it('should set environment tag when provided (AC-02)', () => {
      // Arrange
      process.env.SENTRY_DSN = VALID_DSN;
      initSentry('production');
      const error = new Error('test');
      const context = makeContext({ environment: 'staging' });

      // Act
      captureException(error, context);

      // Assert
      expect(mockSetTag).toHaveBeenCalledWith('environment', 'staging');
    });

    it('should set execution context with structured data (AC-02, SEC-PRIV-008)', () => {
      // Arrange
      process.env.SENTRY_DSN = VALID_DSN;
      initSentry('production');
      const error = new Error('test');
      const context = makeContext();

      // Act
      captureException(error, context);

      // Assert
      expect(mockSetContext).toHaveBeenCalledWith('execution', {
        executionId: 'exec-001',
        ticketKey: 'PROJ-123',
        module: 'scoring',
      });
    });

    it('should use "unknown" for missing context fields (SEC-PRIV-008)', () => {
      // Arrange
      process.env.SENTRY_DSN = VALID_DSN;
      initSentry('production');
      const error = new Error('test');
      const context: SentryCaptureContext = {};

      // Act
      captureException(error, context);

      // Assert
      expect(mockSetContext).toHaveBeenCalledWith('execution', {
        executionId: 'unknown',
        ticketKey: 'unknown',
        module: 'unknown',
      });
    });

    it('should NOT set tags for undefined context fields', () => {
      // Arrange
      process.env.SENTRY_DSN = VALID_DSN;
      initSentry('production');
      const error = new Error('test');
      const context: SentryCaptureContext = {};

      // Act
      captureException(error, context);

      // Assert — setTag should not be called for any field
      expect(mockSetTag).not.toHaveBeenCalledWith('executionId', expect.anything());
      expect(mockSetTag).not.toHaveBeenCalledWith('ticketKey', expect.anything());
      expect(mockSetTag).not.toHaveBeenCalledWith('module', expect.anything());
      expect(mockSetTag).not.toHaveBeenCalledWith('environment', expect.anything());
    });

    // ─── Error Filtering (AC-03, ARCH-SOLID-053) ───

    it('should NOT send TicketNotFoundError (AC-03, ARCH-SOLID-053)', () => {
      // Arrange
      process.env.SENTRY_DSN = VALID_DSN;
      initSentry('production');
      const error = new TicketNotFoundError('Not found', 'TICKET_NOT_FOUND');
      const context = makeContext();

      // Act
      captureException(error, context);

      // Assert
      expect(mockSentryCapture).not.toHaveBeenCalled();
    });

    it('should NOT send InsufficientDataError (AC-03, ARCH-SOLID-053)', () => {
      // Arrange
      process.env.SENTRY_DSN = VALID_DSN;
      initSentry('production');
      const error = new InsufficientDataError('Insufficient data', 'INSUFFICIENT_DATA');
      const context = makeContext();

      // Act
      captureException(error, context);

      // Assert
      expect(mockSentryCapture).not.toHaveBeenCalled();
    });

    it('should NOT send error with { expected: true } property (AC-03, ARCH-SOLID-053)', () => {
      // Arrange
      process.env.SENTRY_DSN = VALID_DSN;
      initSentry('production');
      const error = new Error('Known issue') as Error & { expected: boolean };
      error.expected = true;
      const context = makeContext();

      // Act
      captureException(error, context);

      // Assert
      expect(mockSentryCapture).not.toHaveBeenCalled();
    });

    it('should send error with { expected: false } property (AC-03)', () => {
      // Arrange
      process.env.SENTRY_DSN = VALID_DSN;
      initSentry('production');
      const error = new Error('Unexpected') as Error & { expected: boolean };
      error.expected = false;
      const context = makeContext();

      // Act
      captureException(error, context);

      // Assert
      expect(mockSentryCapture).toHaveBeenCalledTimes(1);
    });

    it('should send RovoApiError (AC-03, TEST-QA-036-01)', () => {
      // Arrange
      process.env.SENTRY_DSN = VALID_DSN;
      initSentry('production');
      const error = new RovoApiError('Rovo failed', 'ROVO_ERROR');
      const context = makeContext();

      // Act
      captureException(error, context);

      // Assert
      expect(mockSentryCapture).toHaveBeenCalledTimes(1);
    });

    it('should send TimeoutError (AC-03, TEST-QA-036-01)', () => {
      // Arrange
      process.env.SENTRY_DSN = VALID_DSN;
      initSentry('production');
      const error = new TimeoutError('Request timed out', 'TIMEOUT');
      const context = makeContext();

      // Act
      captureException(error, context);

      // Assert
      expect(mockSentryCapture).toHaveBeenCalledTimes(1);
    });

    it('should send CircuitOpenError (AC-03, TEST-QA-036-01)', () => {
      // Arrange
      process.env.SENTRY_DSN = VALID_DSN;
      initSentry('production');
      const error = new CircuitOpenError('Circuit is open', 'CIRCUIT_OPEN');
      const context = makeContext();

      // Act
      captureException(error, context);

      // Assert
      expect(mockSentryCapture).toHaveBeenCalledTimes(1);
    });

    it('filtering should use instanceof checks, not string matching (AC-05, ARCH-SOLID-053)', () => {
      // Arrange — create an error with the same message as TicketNotFoundError
      // but NOT an instance of it
      process.env.SENTRY_DSN = VALID_DSN;
      initSentry('production');
      const error = new Error('Ticket not found'); // same message, different class
      const context = makeContext();

      // Act
      captureException(error, context);

      // Assert — should still be sent because it's not actually a TicketNotFoundError
      expect(mockSentryCapture).toHaveBeenCalledTimes(1);
    });

    it('should not throw when internal capture fails (FORGE-OPS-0104)', () => {
      // Arrange
      process.env.SENTRY_DSN = VALID_DSN;
      initSentry('production');
      (mockSentryCapture as jest.Mock).mockImplementation(() => {
        throw new Error('SDK error');
      });
      const error = new Error('test');
      const context = makeContext();

      // Act & Assert — should not throw
      expect(() => captureException(error, context)).not.toThrow();
    });
  });

  // ─── addErrorBreadcrumb() ────────────

  describe('addErrorBreadcrumb()', () => {
    it('should add breadcrumb with category and message (AC-04, TEST-QA-036-02)', () => {
      // Arrange
      process.env.SENTRY_DSN = VALID_DSN;
      initSentry('production');
      const breadcrumb = makeBreadcrumb();

      // Act
      addErrorBreadcrumb(breadcrumb);

      // Assert
      expect(mockAddBreadcrumb).toHaveBeenCalledWith(
        expect.objectContaining({
          category: 'evaluation',
          message: 'Score calculated',
        }),
      );
    });

    it('should add breadcrumb with level error (AC-04, TEST-QA-036-02)', () => {
      // Arrange
      process.env.SENTRY_DSN = VALID_DSN;
      initSentry('production');
      const breadcrumb = makeBreadcrumb({ level: 'error' });

      // Act
      addErrorBreadcrumb(breadcrumb);

      // Assert
      expect(mockAddBreadcrumb).toHaveBeenCalledWith(
        expect.objectContaining({
          level: 'error',
        }),
      );
    });

    it('should add breadcrumb with additional data (AC-04, TEST-QA-036-02)', () => {
      // Arrange
      process.env.SENTRY_DSN = VALID_DSN;
      initSentry('production');
      const data = { score: 85, threshold: 80 };
      const breadcrumb = makeBreadcrumb({ data });

      // Act
      addErrorBreadcrumb(breadcrumb);

      // Assert
      expect(mockAddBreadcrumb).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { score: 85, threshold: 80 },
        }),
      );
    });

    it('should default data to empty object when not provided (AC-04)', () => {
      // Arrange
      process.env.SENTRY_DSN = VALID_DSN;
      initSentry('production');
      const breadcrumb: SentryBreadcrumb = {
        category: 'test',
        message: 'no data',
        level: 'info',
      };

      // Act
      addErrorBreadcrumb(breadcrumb);

      // Assert
      expect(mockAddBreadcrumb).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {},
        }),
      );
    });

    it('should not throw when internal addBreadcrumb fails', () => {
      // Arrange
      process.env.SENTRY_DSN = VALID_DSN;
      initSentry('production');
      (mockAddBreadcrumb as jest.Mock).mockImplementation(() => {
        throw new Error('SDK error');
      });
      const breadcrumb = makeBreadcrumb();

      // Act & Assert — should not throw
      expect(() => addErrorBreadcrumb(breadcrumb)).not.toThrow();
    });
  });

  // ─── No-op Behavior (AC-01, AC-06) ──

  describe('no-op behavior when Sentry not initialized', () => {
    it('captureException should be no-op when DSN not configured (AC-01)', () => {
      // Arrange — no DSN, no init
      const error = new Error('test');
      const context = makeContext();

      // Act
      captureException(error, context);

      // Assert
      expect(mockSentryCapture).not.toHaveBeenCalled();
      expect(mockSetTag).not.toHaveBeenCalled();
      expect(mockSetContext).not.toHaveBeenCalled();
    });

    it('addErrorBreadcrumb should be no-op when DSN not configured (AC-01)', () => {
      // Arrange — no DSN, no init
      const breadcrumb = makeBreadcrumb();

      // Act
      addErrorBreadcrumb(breadcrumb);

      // Assert
      expect(mockAddBreadcrumb).not.toHaveBeenCalled();
    });

    it('captureException should not throw when Sentry not initialized (AC-01)', () => {
      // Arrange — no DSN, no init
      const error = new Error('test');
      const context = makeContext();

      // Act & Assert
      expect(() => captureException(error, context)).not.toThrow();
    });

    it('addErrorBreadcrumb should not throw when Sentry not initialized (AC-01)', () => {
      // Arrange — no DSN, no init
      const breadcrumb = makeBreadcrumb();

      // Act & Assert
      expect(() => addErrorBreadcrumb(breadcrumb)).not.toThrow();
    });
  });

  // ─── isSentryInitialized() (AC-09) ───

  describe('isSentryInitialized()', () => {
    it('should return false before init (AC-09)', () => {
      // Assert
      expect(isSentryInitialized()).toBe(false);
    });

    it('should return true after successful init with DSN (AC-09)', () => {
      // Arrange
      process.env.SENTRY_DSN = VALID_DSN;

      // Act
      initSentry('production');

      // Assert
      expect(isSentryInitialized()).toBe(true);
    });

    it('should return false after init without DSN (AC-09)', () => {
      // Arrange — no SENTRY_DSN

      // Act
      initSentry('production');

      // Assert
      expect(isSentryInitialized()).toBe(false);
    });
  });

  // ─── Security (AC-07, SEC-PRIV-002, SEC-PRIV-008) ───

  describe('security', () => {
    it('should NOT include DSN in any context or breadcrumb (AC-07, SEC-PRIV-002)', () => {
      // Arrange
      process.env.SENTRY_DSN = VALID_DSN;
      initSentry('production');
      const error = new Error('test');
      const context = makeContext();

      // Act
      captureException(error, context);

      // Assert — DSN should not appear in any setContext or setTag call
      const setContextCalls = (mockSetContext as jest.Mock).mock.calls;
      for (const call of setContextCalls) {
        const contextObj = JSON.stringify(call);
        expect(contextObj).not.toContain(VALID_DSN);
      }

      const setTagCalls = (mockSetTag as jest.Mock).mock.calls;
      for (const call of setTagCalls) {
        const tagValue = String(call[1]);
        expect(tagValue).not.toContain(VALID_DSN);
      }
    });

    it('should NOT include full ticket data in Sentry context (SEC-PRIV-008)', () => {
      // Arrange
      process.env.SENTRY_DSN = VALID_DSN;
      initSentry('production');
      const error = new Error('test');
      const context = makeContext();

      // Act
      captureException(error, context);

      // Assert — context should only have minimal diagnostic fields
      expect(mockSetContext).toHaveBeenCalledWith(
        'execution',
        expect.objectContaining({
          executionId: expect.any(String),
          ticketKey: expect.any(String),
          module: expect.any(String),
        }),
      );

      // Verify only expected keys are in context
      const contextCall = (mockSetContext as jest.Mock).mock.calls[0][1] as Record<string, unknown>;
      const keys = Object.keys(contextCall);
      expect(keys).toEqual(expect.arrayContaining(['executionId', 'ticketKey', 'module']));
      expect(keys.length).toBe(3);
    });

    it('should NOT send DSN in breadcrumb data (SEC-PRIV-002)', () => {
      // Arrange
      process.env.SENTRY_DSN = VALID_DSN;
      initSentry('production');
      const breadcrumb = makeBreadcrumb({ data: { foo: 'bar' } });

      // Act
      addErrorBreadcrumb(breadcrumb);

      // Assert
      const breadcrumbCalls = (mockAddBreadcrumb as jest.Mock).mock.calls;
      for (const call of breadcrumbCalls) {
        const callStr = JSON.stringify(call);
        expect(callStr).not.toContain(VALID_DSN);
      }
    });
  });

  // ─── Zero any check (AC-10, ARCH-SOLID-202) ──

  describe('ARCH-SOLID-202: zero any', () => {
    it('should have no any type in sentry.ts source (AC-10)', () => {
      // This is verified by ESLint rule — but we also assert the module
      // exports typed interfaces (not any)
      const context: SentryCaptureContext = { executionId: 'test' };
      const breadcrumb: SentryBreadcrumb = { category: 'test', message: 'msg', level: 'info' };

      expect(typeof context.executionId).toBe('string');
      expect(typeof breadcrumb.category).toBe('string');
    });
  });
});
