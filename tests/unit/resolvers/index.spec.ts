/**
 * Test suite for index.ts Custom UI resolvers
 *
 * Mirrors: src/backend/resolvers/index.ts
 * Tests: AC-01 through AC-08
 * Rules: SEC-PRIV-004, SEC-PRIV-010, FORGE-OPS-053, FORGE-OPS-054,
 *        FORGE-OPS-0105, ARCH-SOLID-006, ARCH-SOLID-058, TEST-QA-036-03
 */

import {
  registerResolvers,
  createRateLimiter,
  type ResolverResponse,
  type RateLimiterConfig,
} from '../../../src/backend/resolvers/index';

import type { ConsistencyScore } from '../../../src/backend/types/consistency-score';
import type { Inconsistency } from '../../../src/backend/types/inconsistency';
import type { QualityGateResult } from '../../../src/backend/types/quality-gate';
import type { ProjectConfig } from '../../../src/backend/types/project-config';

import { calculateScore } from '../../../src/backend/services/scoring/scoring-engine';
import { detectInconsistencies } from '../../../src/backend/services/scoring/inconsistency-detector';
import { evaluateGate } from '../../../src/backend/services/scoring/quality-gate-rules';
import { evaluateTicketForGate } from '../../../src/backend/services/evaluation/evaluation-pipeline';
import {
  getTicketData,
  getProjectConfig,
  saveProjectConfig,
} from '../../../src/backend/services/jira/jira-adapter';
import { getContext } from '../../../src/backend/services/rovo/rovo-adapter';
import {
  writeAuditEntry,
  readAuditEntries,
} from '../../../src/backend/services/audit/audit-service';

// ═══════════════════════════════════════════
// MOCKS
// ═══════════════════════════════════════════

/**
 * [CRITICAL FIX] Mock @forge/resolver as a class constructor — production uses `new Resolver()`.
 * The defineMock is shared between the class instances and our test assertions.
 */
const defineMock = jest.fn();
jest.mock('@forge/resolver', () => {
  // eslint-disable-next-line @typescript-eslint/no-extraneous-class
  class MockResolver {
    define = defineMock;
  }
  return { __esModule: true, default: MockResolver };
});

jest.mock('../../../src/backend/services/scoring/scoring-engine');
jest.mock('../../../src/backend/services/scoring/inconsistency-detector');
jest.mock('../../../src/backend/services/scoring/quality-gate-rules');
jest.mock('../../../src/backend/services/evaluation/evaluation-pipeline');
jest.mock('../../../src/backend/services/jira/jira-adapter');
jest.mock('../../../src/backend/services/rovo/rovo-adapter');
jest.mock('../../../src/backend/services/audit/audit-service');

const mockedCalculateScore = calculateScore as jest.MockedFunction<typeof calculateScore>;
const mockedDetectInconsistencies = detectInconsistencies as jest.MockedFunction<
  typeof detectInconsistencies
>;
const mockedEvaluateGate = evaluateGate as jest.MockedFunction<typeof evaluateGate>;
const mockedEvaluateTicketForGate = evaluateTicketForGate as jest.MockedFunction<
  typeof evaluateTicketForGate
>;
const mockedGetTicketData = getTicketData as jest.MockedFunction<typeof getTicketData>;
const mockedGetProjectConfig = getProjectConfig as jest.MockedFunction<typeof getProjectConfig>;
const mockedSaveProjectConfig = saveProjectConfig as jest.MockedFunction<typeof saveProjectConfig>;
const mockedGetContext = getContext as jest.MockedFunction<typeof getContext>;
const mockedWriteAuditEntry = writeAuditEntry as jest.MockedFunction<typeof writeAuditEntry>;
const mockedReadAuditEntries = readAuditEntries as jest.MockedFunction<typeof readAuditEntries>;

// Reference to the shared mock for assertions
const mockedResolverDefine = defineMock;

// ═══════════════════════════════════════════
// FIXTURES
// ═══════════════════════════════════════════

const MOCK_ACCOUNT_ID = 'user-12345';

const MOCK_CONTEXT = { accountId: MOCK_ACCOUNT_ID };

const MOCK_TICKET = {
  key: 'PROJ-123',
  summary: 'Test ticket summary',
  description: 'A test description with enough content for scoring.',
  status: 'To Do',
  assignee: 'John Doe',
  reporter: 'Jane Doe',
  priority: 'Medium',
  issueType: 'Task',
  labels: ['backend', 'bug'],
  projectKey: 'PROJ',
  created: '2025-01-01T00:00:00.000Z',
  updated: '2025-01-01T00:00:00.000Z',
};

const MOCK_SCORE: ConsistencyScore = {
  overall: 85,
  axes: { clarity: 80, consistency: 85, risk: 90, documentation: 75, technicalDebt: 88 },
  timestamp: '2025-01-01T00:00:00.000Z',
  executionId: 'test-exec-001',
};

const MOCK_CONFIG: ProjectConfig = {
  projectKey: 'PROJ',
  enabled: true,
  scoreThreshold: 80,
  gates: { definition: true, execution: true, delivery: true },
};

const MOCK_GATE_RESULT: QualityGateResult = {
  gate: 'definition',
  passed: true,
  score: MOCK_SCORE,
  inconsistencies: [],
  blockedTransitions: [],
  executionId: 'test-exec-001',
};

const MOCK_PIPELINE_RESULT = {
  executionId: 'test-exec-001',
  ticketKey: 'PROJ-123',
  gateType: 'definition' as const,
  score: MOCK_SCORE,
  inconsistencies: [],
  gateResult: MOCK_GATE_RESULT,
  enforcementActions: [],
  auditEntry: {
    id: 'audit-001',
    action: 'gate_evaluated' as const,
    timestamp: '2025-01-01T00:00:00.000Z',
    executionId: 'test-exec-001',
    projectKey: 'PROJ',
    details: { gateType: 'definition', passed: true },
  },
};

const MOCK_INCONSISTENCY: Inconsistency = {
  id: 'inc-001',
  type: 'ambiguity',
  severity: 'info',
  source: 'jira',
  description: 'Ambiguous language detected: "maybe"',
  affectedTicketKey: 'PROJ-123',
};

// ═══════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════

/** Handler request shape */
interface HandlerRequest {
  readonly payload: Record<string, unknown>;
  readonly context: Record<string, unknown>;
}

/** Handler function type — avoids implicit any */
type HandlerFn = (req: HandlerRequest) => Promise<ResolverResponse<unknown>>;

// ═══════════════════════════════════════════
// HELPER: extract registered handler by name
// ═══════════════════════════════════════════

const getHandler = (name: string): HandlerFn => {
  const calls = mockedResolverDefine.mock.calls as ReadonlyArray<readonly [string, HandlerFn]>;
  const match = calls.find((call: readonly [string, HandlerFn]) => call[0] === name);
  if (!match) throw new Error(`Resolver "${name}" not registered`);
  return match[1];
};

// ═══════════════════════════════════════════
// TEST SUITE
// ═══════════════════════════════════════════

describe('Custom UI Resolvers (index.ts)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedGetTicketData.mockResolvedValue(MOCK_TICKET);
    mockedGetProjectConfig.mockResolvedValue(MOCK_CONFIG);
    mockedCalculateScore.mockReturnValue(MOCK_SCORE);
    mockedDetectInconsistencies.mockReturnValue([MOCK_INCONSISTENCY]);
    mockedEvaluateGate.mockReturnValue(MOCK_GATE_RESULT);
    mockedEvaluateTicketForGate.mockResolvedValue(MOCK_PIPELINE_RESULT);
    mockedSaveProjectConfig.mockResolvedValue(undefined);
    // [CRITICAL FIX] Use `decisions` (matches RovoContext type), not `historicalDecisions`
    mockedGetContext.mockResolvedValue({
      documents: [],
      relatedTickets: [],
      decisions: [],
      query: '',
      timestamp: '',
    });
    mockedWriteAuditEntry.mockResolvedValue(undefined);
    mockedReadAuditEntries.mockResolvedValue([]);
  });

  // ─── AC-01, AC-02: Registration ────────────

  describe('registerResolvers()', () => {
    it('should register exactly 11 resolvers via resolver.define (AC-01, AC-02)', () => {
      registerResolvers();

      expect(mockedResolverDefine).toHaveBeenCalledTimes(11);

      const calls = mockedResolverDefine.mock.calls as ReadonlyArray<readonly [string, HandlerFn]>;
      const names = calls.map((call: readonly [string, HandlerFn]) => call[0]);
      expect(names).toEqual([
        'getConsistencyScore',
        'getInconsistencies',
        'getQualityGateStatus',
        'getProjectConfig',
        'updateProjectConfig',
        'getAuditLog',
        'enrichTicket',
        'revalidateTicket',
        'getGraphHealth',
        'bootstrapIndex',
        'checkRovoHealth',
      ]);
    });

    it('should register each resolver with a handler function', () => {
      registerResolvers();

      const calls = mockedResolverDefine.mock.calls as ReadonlyArray<readonly [string, HandlerFn]>;
      for (const call of calls) {
        expect(typeof call[1]).toBe('function');
      }
    });
  });

  // ─── getConsistencyScore ────────────────

  describe('getConsistencyScore', () => {
    it('should return score for valid issueKey (AC-01)', async () => {
      registerResolvers();
      const handler = getHandler('getConsistencyScore');

      const result = await handler({
        payload: { issueKey: 'PROJ-123' },
        context: MOCK_CONTEXT,
      });

      expect(result.success).toBe(true);
      const data = result.data as ConsistencyScore;
      expect(data.overall).toBe(85);
      expect(result.executionId).toBeTruthy();
      expect(mockedGetTicketData).toHaveBeenCalledWith('PROJ-123', expect.any(String), 8000);
      expect(mockedCalculateScore).toHaveBeenCalled();
    });

    it('should reject empty issueKey (AC-05, SEC-PRIV-004)', async () => {
      registerResolvers();
      const handler = getHandler('getConsistencyScore');

      const result = await handler({
        payload: { issueKey: '' },
        context: MOCK_CONTEXT,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('non-empty string');
    });

    it('should reject missing issueKey (SEC-PRIV-004)', async () => {
      registerResolvers();
      const handler = getHandler('getConsistencyScore');

      const result = await handler({
        payload: {},
        context: MOCK_CONTEXT,
      });

      expect(result.success).toBe(false);
    });

    it('should return error response on service failure (FORGE-OPS-053)', async () => {
      mockedGetTicketData.mockRejectedValue(new Error('Jira unavailable'));
      registerResolvers();
      const handler = getHandler('getConsistencyScore');

      const result = await handler({
        payload: { issueKey: 'PROJ-123' },
        context: MOCK_CONTEXT,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Jira unavailable');
    });
  });

  // ─── getInconsistencies ─────────────────

  describe('getInconsistencies', () => {
    it('should return inconsistencies for valid issueKey (AC-01)', async () => {
      registerResolvers();
      const handler = getHandler('getInconsistencies');

      const result = await handler({
        payload: { issueKey: 'PROJ-123' },
        context: MOCK_CONTEXT,
      });

      expect(result.success).toBe(true);
      const data = result.data as Inconsistency[];
      expect(data).toHaveLength(1);
      expect(data[0]?.type).toBe('ambiguity');
    });

    it('should reject empty issueKey (AC-05, SEC-PRIV-004)', async () => {
      registerResolvers();
      const handler = getHandler('getInconsistencies');

      const result = await handler({
        payload: { issueKey: '   ' },
        context: MOCK_CONTEXT,
      });

      expect(result.success).toBe(false);
    });
  });

  // ─── getQualityGateStatus ───────────────

  describe('getQualityGateStatus', () => {
    it('should return gate result for valid input (AC-01)', async () => {
      registerResolvers();
      const handler = getHandler('getQualityGateStatus');

      const result = await handler({
        payload: { issueKey: 'PROJ-123', gateType: 'definition' },
        context: MOCK_CONTEXT,
      });

      expect(result.success).toBe(true);
      const data = result.data as QualityGateResult;
      expect(data.passed).toBe(true);
      expect(data.gate).toBe('definition');
    });

    it('should reject invalid gateType (AC-05, SEC-PRIV-004)', async () => {
      registerResolvers();
      const handler = getHandler('getQualityGateStatus');

      const result = await handler({
        payload: { issueKey: 'PROJ-123', gateType: 'invalid' },
        context: MOCK_CONTEXT,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('gateType must be one of');
    });

    it('should reject missing gateType (SEC-PRIV-004)', async () => {
      registerResolvers();
      const handler = getHandler('getQualityGateStatus');

      const result = await handler({
        payload: { issueKey: 'PROJ-123' },
        context: MOCK_CONTEXT,
      });

      expect(result.success).toBe(false);
    });

    it('should handle issueKey without dash separator (line 340 fallback)', async () => {
      // Exercises the ?? '' fallback on line 340: issueKey.split('-')[0] ?? ''
      registerResolvers();
      const handler = getHandler('getQualityGateStatus');

      const result = await handler({
        payload: { issueKey: 'NOSEP', gateType: 'definition' },
        context: MOCK_CONTEXT,
      });

      expect(result.success).toBe(true);
      // The projectKey should be 'NOSEP' (split returns ['NOSEP'], [0] is 'NOSEP')
      // But this exercises the split branch for keys without '-'
      expect(mockedGetProjectConfig).toHaveBeenCalledWith('NOSEP', expect.any(String), 8000);
    });
  });

  // ─── getProjectConfig ───────────────────

  describe('getProjectConfig', () => {
    it('should return config for valid projectKey (AC-01)', async () => {
      registerResolvers();
      const handler = getHandler('getProjectConfig');

      const result = await handler({
        payload: { projectKey: 'PROJ' },
        context: MOCK_CONTEXT,
      });

      expect(result.success).toBe(true);
      const data = result.data as ProjectConfig;
      expect(data.projectKey).toBe('PROJ');
      expect(data.scoreThreshold).toBe(80);
    });

    it('should reject empty projectKey (AC-05)', async () => {
      registerResolvers();
      const handler = getHandler('getProjectConfig');

      const result = await handler({
        payload: { projectKey: '' },
        context: MOCK_CONTEXT,
      });

      expect(result.success).toBe(false);
    });
  });

  // ─── updateProjectConfig ────────────────

  describe('updateProjectConfig', () => {
    it('should save merged config for admin user (AC-01, SEC-PRIV-010)', async () => {
      registerResolvers();
      const handler = getHandler('updateProjectConfig');

      const result = await handler({
        payload: {
          projectKey: 'PROJ',
          config: { scoreThreshold: 90 },
        },
        context: MOCK_CONTEXT,
      });

      expect(result.success).toBe(true);
      // [CRITICAL FIX] saveProjectConfig signature is (config: ProjectConfig, executionId?, timeoutMs?)
      // The handler merges currentConfig with configUpdate, so the merged config has all fields
      const expectedMerged: ProjectConfig = {
        projectKey: 'PROJ',
        enabled: true,
        scoreThreshold: 90,
        gates: { definition: true, execution: true, delivery: true },
      };
      expect(mockedSaveProjectConfig).toHaveBeenCalledWith(
        expectedMerged,
        expect.any(String),
        8000,
      );
    });

    it('should reject anonymous users (AC-03)', async () => {
      registerResolvers();
      const handler = getHandler('updateProjectConfig');

      const result = await handler({
        payload: {
          projectKey: 'PROJ',
          config: { scoreThreshold: 90 },
        },
        context: { accountId: 'anonymous' },
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Authentication required');
    });

    it('should reject missing config object', async () => {
      registerResolvers();
      const handler = getHandler('updateProjectConfig');

      const result = await handler({
        payload: { projectKey: 'PROJ' },
        context: MOCK_CONTEXT,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('config must be an object');
    });

    it('should reject context without accountId (AC-03)', async () => {
      registerResolvers();
      const handler = getHandler('updateProjectConfig');

      const result = await handler({
        payload: { projectKey: 'PROJ', config: { scoreThreshold: 90 } },
        context: {},
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Authentication required');
    });

    it('should fall back to current enabled when configUpdate.enabled is not boolean (lines 419-420)', async () => {
      registerResolvers();
      const handler = getHandler('updateProjectConfig');

      const result = await handler({
        payload: {
          projectKey: 'PROJ',
          config: { enabled: 'not-a-boolean' },
        },
        context: MOCK_CONTEXT,
      });

      expect(result.success).toBe(true);
      const savedConfig = mockedSaveProjectConfig.mock.calls[0]?.[0] as ProjectConfig;
      // Falls back to currentConfig.enabled = true
      expect(savedConfig.enabled).toBe(true);
    });

    it('should use provided boolean enabled value (line 420 true branch)', async () => {
      registerResolvers();
      const handler = getHandler('updateProjectConfig');

      const result = await handler({
        payload: {
          projectKey: 'PROJ',
          config: { enabled: false },
        },
        context: MOCK_CONTEXT,
      });

      expect(result.success).toBe(true);
      const savedConfig = mockedSaveProjectConfig.mock.calls[0]?.[0] as ProjectConfig;
      // Uses the provided boolean value
      expect(savedConfig.enabled).toBe(false);
    });

    it('should fall back to current scoreThreshold when configUpdate.scoreThreshold is not a number (lines 423-424)', async () => {
      registerResolvers();
      const handler = getHandler('updateProjectConfig');

      const result = await handler({
        payload: {
          projectKey: 'PROJ',
          config: { scoreThreshold: 'not-a-number' },
        },
        context: MOCK_CONTEXT,
      });

      expect(result.success).toBe(true);
      const savedConfig = mockedSaveProjectConfig.mock.calls[0]?.[0] as ProjectConfig;
      // Falls back to currentConfig.scoreThreshold = 80
      expect(savedConfig.scoreThreshold).toBe(80);
    });

    it('should fall back to current gates when configUpdate.gates is null (lines 427-428)', async () => {
      registerResolvers();
      const handler = getHandler('updateProjectConfig');

      const result = await handler({
        payload: {
          projectKey: 'PROJ',
          config: { gates: null },
        },
        context: MOCK_CONTEXT,
      });

      expect(result.success).toBe(true);
      const savedConfig = mockedSaveProjectConfig.mock.calls[0]?.[0] as ProjectConfig;
      // Falls back to currentConfig.gates
      expect(savedConfig.gates).toEqual({ definition: true, execution: true, delivery: true });
    });

    it('should merge gates when configUpdate.gates is a valid object (lines 427-428)', async () => {
      registerResolvers();
      const handler = getHandler('updateProjectConfig');

      const result = await handler({
        payload: {
          projectKey: 'PROJ',
          config: { gates: { definition: false } },
        },
        context: MOCK_CONTEXT,
      });

      expect(result.success).toBe(true);
      const savedConfig = mockedSaveProjectConfig.mock.calls[0]?.[0] as ProjectConfig;
      // Merges: current gates + provided gates override
      expect(savedConfig.gates).toEqual({ definition: false, execution: true, delivery: true });
    });
  });

  // ─── getAuditLog ────────────────────────

  describe('getAuditLog', () => {
    it('should return empty entries when no audit log exists (AC-01)', async () => {
      registerResolvers();
      const handler = getHandler('getAuditLog');

      const result = await handler({
        payload: { projectKey: 'PROJ' },
        context: MOCK_CONTEXT,
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });

    it('should accept optional limit parameter (AC-01, SEC-PRIV-008)', async () => {
      registerResolvers();
      const handler = getHandler('getAuditLog');

      const result = await handler({
        payload: { projectKey: 'PROJ', limit: 10 },
        context: MOCK_CONTEXT,
      });

      expect(result.success).toBe(true);
    });

    it('should reject negative limit (SEC-PRIV-004)', async () => {
      registerResolvers();
      const handler = getHandler('getAuditLog');

      const result = await handler({
        payload: { projectKey: 'PROJ', limit: -5 },
        context: MOCK_CONTEXT,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('positive integer');
    });

    it('should reject zero limit (SEC-PRIV-004)', async () => {
      registerResolvers();
      const handler = getHandler('getAuditLog');

      const result = await handler({
        payload: { projectKey: 'PROJ', limit: 0 },
        context: MOCK_CONTEXT,
      });

      expect(result.success).toBe(false);
    });
  });

  // ─── enrichTicket ───────────────────────

  describe('enrichTicket', () => {
    it('should trigger enrichment for valid issueKey (AC-01)', async () => {
      registerResolvers();
      const handler = getHandler('enrichTicket');

      const result = await handler({
        payload: { issueKey: 'PROJ-123' },
        context: MOCK_CONTEXT,
      });

      expect(result.success).toBe(true);
      expect(mockedGetContext).toHaveBeenCalledWith('PROJ-123', 'PROJ', expect.any(String), 8000);
    });

    it('should succeed even when Rovo is unavailable (FORGE-OPS-054)', async () => {
      mockedGetContext.mockRejectedValue(new Error('Rovo API timeout'));
      registerResolvers();
      const handler = getHandler('enrichTicket');

      const result = await handler({
        payload: { issueKey: 'PROJ-123' },
        context: MOCK_CONTEXT,
      });

      expect(result.success).toBe(true);
    });

    it('should reject anonymous users (AC-03)', async () => {
      registerResolvers();
      const handler = getHandler('enrichTicket');

      const result = await handler({
        payload: { issueKey: 'PROJ-123' },
        context: {},
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Authentication required');
    });

    it('should handle issueKey without dash separator (line 499 fallback)', async () => {
      // Exercises the ?? '' fallback on line 499: issueKey.split('-')[0] ?? ''
      registerResolvers();
      const handler = getHandler('enrichTicket');

      const result = await handler({
        payload: { issueKey: 'NOSEP' },
        context: MOCK_CONTEXT,
      });

      expect(result.success).toBe(true);
      // projectKey should be 'NOSEP' since split('-') returns ['NOSEP']
      expect(mockedGetContext).toHaveBeenCalledWith('NOSEP', 'NOSEP', expect.any(String), 8000);
    });

    it('should handle non-Error thrown from Rovo gracefully (line 503-504 fallback)', async () => {
      // Exercises the ternary branch: rovoError instanceof Error ? ... : 'Rovo unavailable'
      mockedGetContext.mockRejectedValue('not-an-error-object');
      registerResolvers();
      const handler = getHandler('enrichTicket');

      const result = await handler({
        payload: { issueKey: 'PROJ-123' },
        context: MOCK_CONTEXT,
      });

      // Should still succeed (graceful degradation)
      expect(result.success).toBe(true);
    });
  });

  // ─── revalidateTicket ───────────────────

  describe('revalidateTicket', () => {
    it('should run evaluation pipeline and return score (AC-01)', async () => {
      registerResolvers();
      const handler = getHandler('revalidateTicket');

      const result = await handler({
        payload: { issueKey: 'PROJ-123' },
        context: MOCK_CONTEXT,
      });

      expect(result.success).toBe(true);
      const data = result.data as ConsistencyScore;
      expect(data.overall).toBe(85);
      expect(mockedEvaluateTicketForGate).toHaveBeenCalledWith(
        'PROJ-123',
        'To Do',
        MOCK_CONFIG,
        expect.any(String),
      );
    });

    it('should reject empty issueKey (AC-05)', async () => {
      registerResolvers();
      const handler = getHandler('revalidateTicket');

      const result = await handler({
        payload: { issueKey: '' },
        context: MOCK_CONTEXT,
      });

      expect(result.success).toBe(false);
    });

    it('should return error response on pipeline failure (FORGE-OPS-053)', async () => {
      mockedEvaluateTicketForGate.mockRejectedValue(new Error('Pipeline error'));
      registerResolvers();
      const handler = getHandler('revalidateTicket');

      const result = await handler({
        payload: { issueKey: 'PROJ-123' },
        context: MOCK_CONTEXT,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Pipeline error');
    });

    it('should handle issueKey without dash separator (line 549 fallback)', async () => {
      // Exercises the ?? '' fallback on line 549: issueKey.split('-')[0] ?? ''
      registerResolvers();
      const handler = getHandler('revalidateTicket');

      const result = await handler({
        payload: { issueKey: 'NOSEP' },
        context: MOCK_CONTEXT,
      });

      expect(result.success).toBe(true);
      // projectKey should be 'NOSEP' since split('-') returns ['NOSEP']
      expect(mockedGetProjectConfig).toHaveBeenCalledWith('NOSEP', expect.any(String), 8000);
    });
  });

  // ─── Rate Limiter (AC-04) ───────────────

  describe('Rate Limiter (AC-04)', () => {
    it('should block excessive requests from same user', () => {
      const config: RateLimiterConfig = { maxRequests: 2, windowMs: 60_000 };
      const check = createRateLimiter(config);

      expect(check('user-a')).toBe(true);
      expect(check('user-a')).toBe(true);
      expect(check('user-a')).toBe(false);
    });

    it('should allow requests from different users independently', () => {
      const config: RateLimiterConfig = { maxRequests: 1, windowMs: 60_000 };
      const check = createRateLimiter(config);

      expect(check('user-a')).toBe(true);
      expect(check('user-b')).toBe(true);
      expect(check('user-a')).toBe(false);
      expect(check('user-b')).toBe(false);
    });

    it('should reset window after expiry (FORGE-OPS-0105)', () => {
      const config: RateLimiterConfig = { maxRequests: 1, windowMs: 100 };
      const check = createRateLimiter(config);

      expect(check('user-a')).toBe(true);
      expect(check('user-a')).toBe(false);

      // Wait for window to expire
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          expect(check('user-a')).toBe(true);
          resolve();
        }, 150);
      });
    });

    it('should use default config when no config is provided', () => {
      // Exercises the default parameter branch on line 183
      const check = createRateLimiter();

      // DEFAULT_RATE_LIMIT is { maxRequests: 30, windowMs: 60_000 }
      for (let i = 0; i < 30; i++) {
        expect(check('user-default')).toBe(true);
      }
      // 31st request should be blocked
      expect(check('user-default')).toBe(false);
    });

    it('should integrate rate limiting in wrapped resolver handler', async () => {
      registerResolvers();
      const handler = getHandler('getConsistencyScore');

      // Make many rapid requests — some should be rate limited
      const results: ResolverResponse<unknown>[] = [];
      for (let i = 0; i < 35; i++) {
        results.push(
          await handler({
            payload: { issueKey: 'PROJ-123' },
            context: MOCK_CONTEXT,
          }),
        );
      }

      const rateLimited = results.filter((r) => r.error === 'Rate limit exceeded');
      expect(rateLimited.length).toBeGreaterThan(0);
    });
  });

  // ─── Input Sanitization (AC-05) ──────────

  describe('Input Sanitization (AC-05)', () => {
    it('should strip control characters from issueKey', async () => {
      registerResolvers();
      const handler = getHandler('getConsistencyScore');

      const result = await handler({
        payload: { issueKey: 'PROJ-123\x00\x01' },
        context: MOCK_CONTEXT,
      });

      expect(result.success).toBe(true);
      expect(mockedGetTicketData).toHaveBeenCalledWith('PROJ-123', expect.any(String), 8000);
    });

    it('should trim whitespace from issueKey', async () => {
      registerResolvers();
      const handler = getHandler('getConsistencyScore');

      const result = await handler({
        payload: { issueKey: '  PROJ-123  ' },
        context: MOCK_CONTEXT,
      });

      expect(result.success).toBe(true);
      expect(mockedGetTicketData).toHaveBeenCalledWith('PROJ-123', expect.any(String), 8000);
    });

    it('should reject non-string issueKey', async () => {
      registerResolvers();
      const handler = getHandler('getConsistencyScore');

      const result = await handler({
        payload: { issueKey: 12345 },
        context: MOCK_CONTEXT,
      });

      expect(result.success).toBe(false);
    });
  });

  // ─── Structured Logging (AC-06) ─────────

  describe('Structured Logging (AC-06)', () => {
    it('should include executionId in all resolver responses', async () => {
      registerResolvers();
      const handler = getHandler('getConsistencyScore');

      const result = await handler({
        payload: { issueKey: 'PROJ-123' },
        context: MOCK_CONTEXT,
      });

      expect(result.executionId).toMatch(/^res-/);
    });

    it('should include executionId even in error responses (TEST-QA-036-03)', async () => {
      registerResolvers();
      const handler = getHandler('getConsistencyScore');

      const result = await handler({
        payload: { issueKey: '' },
        context: MOCK_CONTEXT,
      });

      expect(result.executionId).toBeTruthy();
    });
  });

  // ─── ResolverResponse Structure (AC-02) ─

  describe('ResolverResponse Structure (AC-02)', () => {
    it('success response should have success=true, data, and executionId', async () => {
      registerResolvers();
      const handler = getHandler('getProjectConfig');

      const result = await handler({
        payload: { projectKey: 'PROJ' },
        context: MOCK_CONTEXT,
      });

      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('executionId');
      expect(result).not.toHaveProperty('error');
    });

    it('error response should have success=false, error, and executionId', async () => {
      mockedGetProjectConfig.mockRejectedValue(new Error('Config fetch failed'));
      registerResolvers();
      const handler = getHandler('getProjectConfig');

      const result = await handler({
        payload: { projectKey: 'PROJ' },
        context: MOCK_CONTEXT,
      });

      expect(result).toHaveProperty('success', false);
      expect(result).toHaveProperty('error');
      expect(result).toHaveProperty('executionId');
      expect(result).not.toHaveProperty('data');
    });
  });

  // ─── Permission Checks (AC-03) ──────────

  describe('Permission Checks (AC-03)', () => {
    it('read resolvers should reject unauthenticated users', async () => {
      registerResolvers();
      const handler = getHandler('getConsistencyScore');

      const result = await handler({
        payload: { issueKey: 'PROJ-123' },
        context: {},
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Authentication required');
    });

    it('write resolvers should reject unauthenticated users', async () => {
      registerResolvers();
      const handler = getHandler('revalidateTicket');

      const result = await handler({
        payload: { issueKey: 'PROJ-123' },
        context: {},
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Authentication required');
    });
  });

  // ─── Error Handling (FORGE-OPS-053) ─────

  describe('Error Handling (FORGE-OPS-053)', () => {
    it('should never throw — all errors converted to error responses', async () => {
      mockedGetTicketData.mockRejectedValue(new Error('Unexpected error'));
      registerResolvers();
      const handler = getHandler('getConsistencyScore');

      // Should NOT throw
      const result = await handler({
        payload: { issueKey: 'PROJ-123' },
        context: MOCK_CONTEXT,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unexpected error');
    });

    it('should handle non-Error thrown values gracefully', async () => {
      mockedGetTicketData.mockRejectedValue('string error');
      registerResolvers();
      const handler = getHandler('getConsistencyScore');

      const result = await handler({
        payload: { issueKey: 'PROJ-123' },
        context: MOCK_CONTEXT,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unknown error');
    });
  });
});
