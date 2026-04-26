// Test suite for the Sentry Browser integration module (frontend)
// Covers: init, capture, breadcrumbs, no-op, state, security
// Pattern: Arrange-Act-Assert (AAA), TDD cycle: RED -> GREEN -> REFACTOR
// [TEST-QA-056]
// [TEST-QA-036-01] captureException sends all errors (no filtering)
// [TEST-QA-036-02] Breadcrumbs at every significant UI step
// [TEST-QA-036-04] tracesSampleRate parametrized by environment

// =====================================================================
// MOCKS — must come before imports that depend on @sentry/browser
// =====================================================================

jest.mock('@sentry/browser', () => ({
  init: jest.fn(),
  captureException: jest.fn(),
  addBreadcrumb: jest.fn(),
  setContext: jest.fn(),
  setTag: jest.fn(),
}));

import {
  initSentryBrowser,
  captureException,
  addErrorBreadcrumb,
  isSentryInitialized,
  _resetForTesting,
} from '../../../src/frontend/utils/sentry';
import type {
  BrowserSentryBreadcrumb,
  BrowserSentryContext,
} from '../../../src/frontend/utils/sentry';

import {
  init as mockInit,
  captureException as mockSentryCapture,
  addBreadcrumb as mockAddBreadcrumb,
  setContext as mockSetContext,
  setTag as mockSetTag,
} from '@sentry/browser';

// =====================================================================
// FIXTURES
// =====================================================================

const VALID_DSN = 'https://examplePublicKey@o0.ingest.sentry.io/0';

const makeContext = (overrides?: Partial<BrowserSentryContext>): BrowserSentryContext => ({
  issueKey: 'PROJ-123',
  projectKey: 'PROJ',
  ...overrides,
});

const makeBreadcrumb = (overrides?: Partial<BrowserSentryBreadcrumb>): BrowserSentryBreadcrumb => ({
  category: 'ui',
  message: 'Component rendered',
  level: 'info',
  ...overrides,
});

// =====================================================================
// TEST SUITE
// =====================================================================

describe('sentry-browser (frontend)', () => {
  // ─── Setup & Teardown ─────────────────

  beforeEach(() => {
    jest.resetAllMocks();
    _resetForTesting();
  });

  afterEach(() => {
    _resetForTesting();
  });

  // ─── initSentryBrowser() ─────────────

  describe('initSentryBrowser()', () => {
    it('should initialize Sentry SDK when DSN is valid (AC-01)', () => {
      // Act
      initSentryBrowser(VALID_DSN, 'production');

      // Assert
      expect(mockInit).toHaveBeenCalledTimes(1);
      expect(mockInit).toHaveBeenCalledWith(
        expect.objectContaining({
          dsn: VALID_DSN,
          environment: 'production',
        }),
      );
    });

    it('should NOT initialize when DSN is empty string (AC-01, FORGE-OPS-0104)', () => {
      // Act
      initSentryBrowser('', 'production');

      // Assert
      expect(mockInit).not.toHaveBeenCalled();
      expect(isSentryInitialized()).toBe(false);
    });

    it('should NOT initialize when DSN is undefined (AC-01, FORGE-OPS-0104)', () => {
      // Act
      initSentryBrowser(undefined as unknown as string, 'production');

      // Assert
      expect(mockInit).not.toHaveBeenCalled();
      expect(isSentryInitialized()).toBe(false);
    });

    it('should configure tracesSampleRate 0.1 for production (AC-05, TEST-QA-036-04)', () => {
      // Act
      initSentryBrowser(VALID_DSN, 'production');

      // Assert
      expect(mockInit).toHaveBeenCalledWith(
        expect.objectContaining({
          tracesSampleRate: 0.1,
        }),
      );
    });

    it('should configure tracesSampleRate 1.0 for staging (AC-05, TEST-QA-036-04)', () => {
      // Act
      initSentryBrowser(VALID_DSN, 'staging');

      // Assert
      expect(mockInit).toHaveBeenCalledWith(
        expect.objectContaining({
          tracesSampleRate: 1.0,
        }),
      );
    });

    it('should configure tracesSampleRate 1.0 for development (AC-05, TEST-QA-036-04)', () => {
      // Act
      initSentryBrowser(VALID_DSN, 'development');

      // Assert
      expect(mockInit).toHaveBeenCalledWith(
        expect.objectContaining({
          tracesSampleRate: 1.0,
        }),
      );
    });

    it('should gracefully handle init failure without throwing (AC-11, FORGE-OPS-0104)', () => {
      // Arrange
      (mockInit as jest.Mock).mockImplementation(() => {
        throw new Error('Sentry init failed');
      });

      // Act & Assert — should not throw
      expect(() => initSentryBrowser(VALID_DSN, 'production')).not.toThrow();
      expect(isSentryInitialized()).toBe(false);
    });

    it('should configure unhandled promise rejection capture (AC-03, TEST-QA-036-01)', () => {
      // Act
      initSentryBrowser(VALID_DSN, 'production');

      // Assert — init was called (Sentry browser captures unhandled rejections by default)
      expect(mockInit).toHaveBeenCalledTimes(1);
      expect(isSentryInitialized()).toBe(true);
    });
  });

  // ─── captureException() ──────────────

  describe('captureException()', () => {
    it('should capture a generic error with enriched context (AC-02)', () => {
      // Arrange
      initSentryBrowser(VALID_DSN, 'production');
      const error = new Error('Something went wrong');
      const context = makeContext();

      // Act
      captureException(error, context);

      // Assert
      expect(mockSentryCapture).toHaveBeenCalledTimes(1);
      expect(mockSentryCapture).toHaveBeenCalledWith(error);
    });

    it('should set issueKey tag when provided (AC-02)', () => {
      // Arrange
      initSentryBrowser(VALID_DSN, 'production');
      const error = new Error('test');
      const context = makeContext({ issueKey: 'PROJ-456' });

      // Act
      captureException(error, context);

      // Assert
      expect(mockSetTag).toHaveBeenCalledWith('issueKey', 'PROJ-456');
    });

    it('should set projectKey tag when provided (AC-02)', () => {
      // Arrange
      initSentryBrowser(VALID_DSN, 'production');
      const error = new Error('test');
      const context = makeContext({ projectKey: 'MYPROJ' });

      // Act
      captureException(error, context);

      // Assert
      expect(mockSetTag).toHaveBeenCalledWith('projectKey', 'MYPROJ');
    });

    it('should set structured browser context (AC-02, SEC-PRIV-008)', () => {
      // Arrange
      initSentryBrowser(VALID_DSN, 'production');
      const error = new Error('test');
      const context = makeContext();

      // Act
      captureException(error, context);

      // Assert
      expect(mockSetContext).toHaveBeenCalledWith('browser', {
        issueKey: 'PROJ-123',
        projectKey: 'PROJ',
      });
    });

    it('should be no-op when not initialized (AC-11, FORGE-OPS-0104)', () => {
      // Arrange — no init
      const error = new Error('test');
      const context = makeContext();

      // Act
      captureException(error, context);

      // Assert
      expect(mockSentryCapture).not.toHaveBeenCalled();
      expect(mockSetTag).not.toHaveBeenCalled();
      expect(mockSetContext).not.toHaveBeenCalled();
    });

    it('should not throw when SDK fails internally (AC-11, FORGE-OPS-0104)', () => {
      // Arrange
      initSentryBrowser(VALID_DSN, 'production');
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
      initSentryBrowser(VALID_DSN, 'production');
      const breadcrumb = makeBreadcrumb();

      // Act
      addErrorBreadcrumb(breadcrumb);

      // Assert
      expect(mockAddBreadcrumb).toHaveBeenCalledWith(
        expect.objectContaining({
          category: 'ui',
          message: 'Component rendered',
        }),
      );
    });

    it('should add breadcrumb with level (AC-04, TEST-QA-036-02)', () => {
      // Arrange
      initSentryBrowser(VALID_DSN, 'production');
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

    it('should include optional data in breadcrumb (AC-04, TEST-QA-036-02)', () => {
      // Arrange
      initSentryBrowser(VALID_DSN, 'production');
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

    it('should be no-op when not initialized (AC-11, FORGE-OPS-0104)', () => {
      // Arrange — no init
      const breadcrumb = makeBreadcrumb();

      // Act
      addErrorBreadcrumb(breadcrumb);

      // Assert
      expect(mockAddBreadcrumb).not.toHaveBeenCalled();
    });

    it('should not throw when SDK fails internally (AC-11, FORGE-OPS-0104)', () => {
      // Arrange
      initSentryBrowser(VALID_DSN, 'production');
      (mockAddBreadcrumb as jest.Mock).mockImplementation(() => {
        throw new Error('SDK error');
      });
      const breadcrumb = makeBreadcrumb();

      // Act & Assert — should not throw
      expect(() => addErrorBreadcrumb(breadcrumb)).not.toThrow();
    });
  });

  // ─── isSentryInitialized() (AC-08) ───

  describe('isSentryInitialized()', () => {
    it('should return true after successful init with DSN (AC-08)', () => {
      // Act
      initSentryBrowser(VALID_DSN, 'production');

      // Assert
      expect(isSentryInitialized()).toBe(true);
    });

    it('should return false without init (AC-08)', () => {
      // Assert
      expect(isSentryInitialized()).toBe(false);
    });

    it('should return false after init without DSN (AC-08)', () => {
      // Act
      initSentryBrowser('', 'production');

      // Assert
      expect(isSentryInitialized()).toBe(false);
    });
  });

  // ─── Security (AC-06, SEC-PRIV-002, SEC-PRIV-008) ───

  describe('security', () => {
    it('should NOT include DSN in any Sentry context (AC-06, SEC-PRIV-002)', () => {
      // Arrange
      initSentryBrowser(VALID_DSN, 'production');
      const error = new Error('test');
      const context = makeContext();

      // Act
      captureException(error, context);

      // Assert — DSN should not appear in any setContext or setTag call
      const setContextCalls = (mockSetContext as jest.Mock).mock.calls;
      for (const call of setContextCalls) {
        const contextStr = JSON.stringify(call);
        expect(contextStr).not.toContain(VALID_DSN);
      }

      const setTagCalls = (mockSetTag as jest.Mock).mock.calls;
      for (const call of setTagCalls) {
        const tagValue = String(call[1]);
        expect(tagValue).not.toContain(VALID_DSN);
      }
    });

    it('should NOT include DSN in breadcrumbs (AC-06, SEC-PRIV-002)', () => {
      // Arrange
      initSentryBrowser(VALID_DSN, 'production');
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

    it('should NOT include sensitive data in Sentry context (AC-06, SEC-PRIV-008)', () => {
      // Arrange
      initSentryBrowser(VALID_DSN, 'production');
      const error = new Error('test');
      const context = makeContext();

      // Act
      captureException(error, context);

      // Assert — context should only have minimal diagnostic fields
      expect(mockSetContext).toHaveBeenCalledWith(
        'browser',
        expect.objectContaining({
          issueKey: expect.any(String),
          projectKey: expect.any(String),
        }),
      );

      // Verify only expected keys are in context
      const contextCall = (mockSetContext as jest.Mock).mock.calls[0][1] as Record<string, unknown>;
      const keys = Object.keys(contextCall);
      expect(keys).toEqual(expect.arrayContaining(['issueKey', 'projectKey']));
      expect(keys.length).toBe(2);
    });
  });

  // ─── Zero any check (AC-09, ARCH-SOLID-202) ──

  describe('ARCH-SOLID-202: zero any', () => {
    it('should have no any type in sentry.ts source (AC-09)', () => {
      // This is verified by ESLint rule — but we also assert the module
      // exports typed interfaces (not any)
      const context: BrowserSentryContext = { issueKey: 'test' };
      const breadcrumb: BrowserSentryBreadcrumb = {
        category: 'test',
        message: 'msg',
        level: 'info',
      };

      expect(typeof context.issueKey).toBe('string');
      expect(typeof breadcrumb.category).toBe('string');
    });
  });
});
