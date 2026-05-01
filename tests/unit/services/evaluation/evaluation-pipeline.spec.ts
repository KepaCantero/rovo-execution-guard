// Test suite for the Evaluation Pipeline service
// Covers: evaluateTicketForGate (full pipeline orchestration)
// Pattern: Arrange-Act-Assert (AAA), TDD cycle: RED -> GREEN -> REFACTOR
// [TEST-QA-001]

import { evaluateTicketForGate } from '../../../../src/backend/services/evaluation/evaluation-pipeline';
import type { EvaluationPipelineResult } from '../../../../src/backend/services/evaluation/evaluation-pipeline';
import type { JiraTicketData } from '../../../../src/backend/types/jira-data';
import type { ProjectConfig } from '../../../../src/backend/types/project-config';
import type { ConsistencyScore } from '../../../../src/backend/types/consistency-score';
import type { QualityGateResult } from '../../../../src/backend/types/quality-gate';
import type { Inconsistency } from '../../../../src/backend/types/inconsistency';
import type { RovoContext } from '../../../../src/backend/types/rovo-context';
import { JiraApiError } from '../../../../src/backend/types/errors';

// ═══════════════════════════════════════════
// MOCKS
// ═══════════════════════════════════════════

jest.mock('../../../../src/backend/services/jira/jira-adapter', () => ({
  getTicketData: jest.fn(),
}));

jest.mock('../../../../src/backend/services/rovo/rovo-adapter', () => ({
  getContext: jest.fn(),
}));

jest.mock('../../../../src/backend/services/scoring/inconsistency-detector', () => ({
  detectInconsistencies: jest.fn(),
}));

jest.mock('../../../../src/backend/services/scoring/scoring-engine', () => ({
  calculateScore: jest.fn(),
}));

jest.mock('../../../../src/backend/services/scoring/quality-gate-rules', () => ({
  evaluateGate: jest.fn(),
  determineEnforcementActions: jest.fn(),
}));

jest.mock('../../../../src/backend/services/relationship-index/relationship-storage', () => ({
  buildRelationshipContext: jest.fn(),
}));

import { getTicketData } from '../../../../src/backend/services/jira/jira-adapter';
import { getContext } from '../../../../src/backend/services/rovo/rovo-adapter';
import { detectInconsistencies } from '../../../../src/backend/services/scoring/inconsistency-detector';
import { calculateScore } from '../../../../src/backend/services/scoring/scoring-engine';
import {
  evaluateGate,
  determineEnforcementActions,
} from '../../../../src/backend/services/scoring/quality-gate-rules';
import { buildRelationshipContext } from '../../../../src/backend/services/relationship-index/relationship-storage';

const mockedGetTicketData = getTicketData as jest.MockedFunction<typeof getTicketData>;
const mockedGetContext = getContext as jest.MockedFunction<typeof getContext>;
const mockedDetectInconsistencies = detectInconsistencies as jest.MockedFunction<
  typeof detectInconsistencies
>;
const mockedCalculateScore = calculateScore as jest.MockedFunction<typeof calculateScore>;
const mockedEvaluateGate = evaluateGate as jest.MockedFunction<typeof evaluateGate>;
const mockedDetermineEnforcementActions = determineEnforcementActions as jest.MockedFunction<
  typeof determineEnforcementActions
>;
const mockedBuildRelationshipContext = buildRelationshipContext as jest.MockedFunction<
  typeof buildRelationshipContext
>;

// ═══════════════════════════════════════════
// FIXTURES
// ═══════════════════════════════════════════

const makeTicket = (overrides: Partial<JiraTicketData> = {}): JiraTicketData => ({
  key: 'PROJ-123',
  summary: 'Implement user authentication with OAuth2',
  description:
    'We need to integrate OAuth2 authentication for our platform.\n\nAcceptance criteria:\n- User can log in via Google\n- User can log in via GitHub\n- Session tokens are refreshed automatically\n- Failed login attempts are rate-limited',
  status: 'TO DO',
  assignee: 'developer@example.com',
  reporter: 'pm@example.com',
  priority: 'High',
  issueType: 'Story',
  labels: ['auth', 'security'],
  projectKey: 'PROJ',
  created: '2026-01-15T10:00:00Z',
  updated: '2026-01-15T10:00:00Z',
  ...overrides,
});

const makeProjectConfig = (overrides: Partial<ProjectConfig> = {}): ProjectConfig => ({
  projectKey: 'PROJ',
  enabled: true,
  scoreThreshold: 80,
  gates: { definition: true, execution: true, delivery: true },
  ...overrides,
});

const makeScore = (overrides: Partial<ConsistencyScore> = {}): ConsistencyScore => ({
  overall: 85,
  axes: { clarity: 90, consistency: 80, risk: 85, documentation: 88, technicalDebt: 82 },
  timestamp: '2026-01-15T10:00:00Z',
  executionId: 'test-exec-001',
  ...overrides,
});

const makeGateResult = (overrides: Partial<QualityGateResult> = {}): QualityGateResult => ({
  gate: 'definition',
  passed: true,
  score: makeScore(),
  inconsistencies: [],
  blockedTransitions: [],
  executionId: 'test-exec-001',
  ...overrides,
});

const makeRovoContext = (): RovoContext => ({
  documents: [],
  relatedTickets: [],
  decisions: [],
  query: 'PROJ-123',
  timestamp: '2026-01-15T10:00:00Z',
});

const makeRelationshipContext = (
  overrides: Record<string, unknown> = {},
): Record<string, unknown> => ({
  siblings: [],
  documentation: [],
  pullRequests: [],
  topics: [],
  crossReferences: [],
  rankedItems: [],
  assembledAt: '2026-01-15T10:00:00Z',
  ...overrides,
});

const makeInconsistency = (overrides: Partial<Inconsistency> = {}): Inconsistency => ({
  id: 'inc-test-001',
  type: 'ambiguity',
  severity: 'info',
  source: 'jira',
  description: 'Ambiguous language detected',
  affectedTicketKey: 'PROJ-123',
  ...overrides,
});

// ═══════════════════════════════════════════
// TEST SUITE
// ═══════════════════════════════════════════

describe('EvaluationPipeline', () => {
  let consoleLogSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

    // Default happy-path mock setup
    mockedGetTicketData.mockResolvedValue(makeTicket());
    mockedGetContext.mockResolvedValue(makeRovoContext());
    mockedDetectInconsistencies.mockReturnValue([]);
    mockedCalculateScore.mockReturnValue(makeScore());
    mockedEvaluateGate.mockReturnValue(makeGateResult());
    mockedDetermineEnforcementActions.mockReturnValue([]);
    mockedBuildRelationshipContext.mockResolvedValue(makeRelationshipContext());
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  // ─── evaluateTicketForGate() ──────────

  describe('evaluateTicketForGate()', () => {
    // ─── AC-EP-01: Full pipeline orchestration ──────────

    it('should orchestrate full pipeline: fetch -> context -> detect -> score -> gate -> enforce (AC-EP-01)', async () => {
      // Arrange
      const ticket = makeTicket();
      const config = makeProjectConfig();
      const score = makeScore();
      const gateResult = makeGateResult({ passed: true });

      mockedGetTicketData.mockResolvedValue(ticket);
      mockedDetectInconsistencies.mockReturnValue([]);
      mockedCalculateScore.mockReturnValue(score);
      mockedEvaluateGate.mockReturnValue(gateResult);
      mockedDetermineEnforcementActions.mockReturnValue([]);

      // Act
      const result = await evaluateTicketForGate('PROJ-123', 'In Progress', config);

      // Assert — verify full pipeline chain
      expect(mockedGetTicketData).toHaveBeenCalledWith('PROJ-123', expect.any(String));
      expect(mockedGetContext).toHaveBeenCalledWith(
        'PROJ-123',
        'PROJ',
        expect.any(String),
        expect.any(Number),
      );
      expect(mockedDetectInconsistencies).toHaveBeenCalledWith(
        ticket,
        expect.any(Object),
        undefined,
        expect.any(Object),
      );
      expect(mockedCalculateScore).toHaveBeenCalled();
      expect(mockedEvaluateGate).toHaveBeenCalledWith('definition', expect.any(Object));
      expect(mockedDetermineEnforcementActions).toHaveBeenCalledWith(
        gateResult,
        undefined,
        'PROJ-123',
      );
      expect(result.gateResult.passed).toBe(true);
    });

    // ─── AC-EP-01: Score below threshold fails gate ──────────

    it('should fail gate when score is below threshold (AC-EP-01)', async () => {
      // Arrange
      const lowScore = makeScore({ overall: 50 });
      const failedGate = makeGateResult({ passed: false, score: lowScore });

      mockedCalculateScore.mockReturnValue(lowScore);
      mockedEvaluateGate.mockReturnValue(failedGate);
      mockedDetermineEnforcementActions.mockReturnValue([]);

      // Act
      const result = await evaluateTicketForGate('PROJ-123', 'In Progress', makeProjectConfig());

      // Assert
      expect(result.gateResult.passed).toBe(false);
      expect(result.score.overall).toBe(50);
    });

    // ─── AC-EP-01: Critical inconsistencies block execution gate ──────────

    it('should detect critical inconsistencies that block execution gate (AC-EP-01)', async () => {
      // Arrange
      const criticalInc = makeInconsistency({ severity: 'critical', type: 'contradiction' });
      const failedGate = makeGateResult({
        gate: 'execution',
        passed: false,
        inconsistencies: [criticalInc],
      });

      mockedDetectInconsistencies.mockReturnValue([criticalInc]);
      mockedEvaluateGate.mockReturnValue(failedGate);

      // Act
      const result = await evaluateTicketForGate('PROJ-123', 'In Review', makeProjectConfig());

      // Assert
      expect(result.gateResult.passed).toBe(false);
      expect(result.inconsistencies).toHaveLength(1);
      expect(result.inconsistencies[0]?.severity).toBe('critical');
    });

    // ─── AC-EP-02: Returns EvaluationPipelineResult ──────────

    it('should return complete EvaluationPipelineResult with all required fields (AC-EP-02)', async () => {
      // Arrange
      const score = makeScore();
      const gateResult = makeGateResult({ passed: true, score });

      mockedCalculateScore.mockReturnValue(score);
      mockedEvaluateGate.mockReturnValue(gateResult);

      // Act
      const result: EvaluationPipelineResult = await evaluateTicketForGate(
        'PROJ-123',
        'In Progress',
        makeProjectConfig(),
      );

      // Assert — all fields present
      expect(result).toHaveProperty('executionId');
      expect(result).toHaveProperty('ticketKey', 'PROJ-123');
      expect(result).toHaveProperty('gateType', 'definition');
      expect(result).toHaveProperty('score');
      expect(result).toHaveProperty('inconsistencies');
      expect(result).toHaveProperty('gateResult');
      expect(result).toHaveProperty('enforcementActions');
      expect(result).toHaveProperty('auditEntry');
      expect(typeof result.executionId).toBe('string');
      expect(result.executionId.length).toBeGreaterThan(0);
    });

    // ─── AC-EP-03: Fail-open on Jira adapter error ──────────

    it('should fail-open when jira-adapter throws (AC-EP-03)', async () => {
      // Arrange
      mockedGetTicketData.mockRejectedValue(new JiraApiError('Jira API error', 'JIRA_API_ERROR'));

      // Act
      const result = await evaluateTicketForGate('PROJ-123', 'In Progress', makeProjectConfig());

      // Assert — fail-open means passed=true and error recorded
      expect(result.gateResult.passed).toBe(true);
      expect(result.error).toBeDefined();
      expect(result.error).toContain('Jira API error');
      expect(result.inconsistencies).toEqual([]);
      expect(result.enforcementActions).toEqual([]);
    });

    // ─── AC-EP-03: Fail-open on scoring error ──────────

    it('should fail-open when scoring-engine throws (AC-EP-03)', async () => {
      // Arrange
      mockedCalculateScore.mockImplementation(() => {
        throw new Error('Scoring failed');
      });

      // Act
      const result = await evaluateTicketForGate('PROJ-123', 'In Progress', makeProjectConfig());

      // Assert
      expect(result.gateResult.passed).toBe(true);
      expect(result.error).toContain('Scoring failed');
    });

    // ─── AC-EP-04: Timeout aborts and fail-opens ──────────

    it('should timeout and fail-open when pipeline exceeds 5s (AC-EP-04)', async () => {
      // Arrange — simulate a slow Jira call that never resolves
      mockedGetTicketData.mockImplementation(
        () =>
          new Promise((_resolve) => {
            /* never resolves */
          }),
      );

      // Act
      const result = await evaluateTicketForGate('PROJ-123', 'In Progress', makeProjectConfig());

      // Assert — fail-open due to timeout
      expect(result.gateResult.passed).toBe(true);
      expect(result.error).toContain('timed out');
    }, 10_000);

    // ─── AC-EP-05: Maps target status to correct gate type ──────────

    it('should map "In Progress" target to definition gate (AC-EP-05)', async () => {
      // Act
      await evaluateTicketForGate('PROJ-123', 'In Progress', makeProjectConfig());

      // Assert
      expect(mockedEvaluateGate).toHaveBeenCalledWith('definition', expect.any(Object));
    });

    it('should map "In Review" target to execution gate (AC-EP-05)', async () => {
      // Act
      await evaluateTicketForGate('PROJ-123', 'In Review', makeProjectConfig());

      // Assert
      expect(mockedEvaluateGate).toHaveBeenCalledWith('execution', expect.any(Object));
    });

    it('should map "Done" target to delivery gate (AC-EP-05)', async () => {
      // Act
      await evaluateTicketForGate('PROJ-123', 'Done', makeProjectConfig());

      // Assert
      expect(mockedEvaluateGate).toHaveBeenCalledWith('delivery', expect.any(Object));
    });

    it('should map "Merge" target to delivery gate (AC-EP-05)', async () => {
      // Act
      await evaluateTicketForGate('PROJ-123', 'Merge', makeProjectConfig());

      // Assert
      expect(mockedEvaluateGate).toHaveBeenCalledWith('delivery', expect.any(Object));
    });

    // ─── AC-EP-05: Disabled gate auto-passes ──────────

    it('should auto-pass when the gate is disabled in project config (AC-EP-05)', async () => {
      // Arrange
      const config = makeProjectConfig({
        gates: { definition: false, execution: false, delivery: false },
      });
      const gateResult = makeGateResult({ passed: true, inconsistencies: [] });
      mockedEvaluateGate.mockReturnValue(gateResult);

      // Act
      const result = await evaluateTicketForGate('PROJ-123', 'In Progress', config);

      // Assert — disabled gate auto-passes
      expect(result.gateResult.passed).toBe(true);
    });

    // ─── AC-EP-06: Rovo context is optional (graceful degradation) ──────────

    it('should continue without Rovo context when adapter throws (AC-EP-06)', async () => {
      // Arrange
      mockedGetContext.mockRejectedValue(new Error('Rovo unavailable'));

      // Act
      const result = await evaluateTicketForGate('PROJ-123', 'In Progress', makeProjectConfig());

      // Assert — pipeline succeeds without Rovo
      expect(result.gateResult).toBeDefined();
      expect(result.error).toBeUndefined();
      expect(mockedDetectInconsistencies).toHaveBeenCalledWith(
        expect.any(Object),
        undefined,
        undefined,
        expect.any(Object),
      );
    });

    it('should continue without Rovo context when it returns undefined (AC-EP-06)', async () => {
      // Arrange
      mockedGetContext.mockResolvedValue(undefined as never);

      // Act
      const result = await evaluateTicketForGate('PROJ-123', 'In Progress', makeProjectConfig());

      // Assert
      expect(result.error).toBeUndefined();
      expect(result.gateResult).toBeDefined();
    });

    // ─── AC-EP-07: Generates unique executionId ──────────

    it('should generate unique executionId for each evaluation (AC-EP-07)', async () => {
      // Act
      const result1 = await evaluateTicketForGate('PROJ-123', 'In Progress', makeProjectConfig());
      const result2 = await evaluateTicketForGate('PROJ-456', 'In Review', makeProjectConfig());

      // Assert — unique IDs
      expect(result1.executionId).not.toBe(result2.executionId);
      expect(result1.executionId).toMatch(/^ep-/);
      expect(result2.executionId).toMatch(/^ep-/);
    });

    it('should use provided executionId when given (AC-EP-07)', async () => {
      // Act
      const result = await evaluateTicketForGate(
        'PROJ-123',
        'In Progress',
        makeProjectConfig(),
        'my-custom-exec-id',
      );

      // Assert
      expect(result.executionId).toBe('my-custom-exec-id');
    });

    // ─── AC-EP-08: Structured logging with executionId ──────────

    it('should log structured entries with executionId at each pipeline step (AC-EP-08)', async () => {
      // Act
      await evaluateTicketForGate('PROJ-123', 'In Progress', makeProjectConfig());

      // Assert — structured JSON logs emitted
      const logCalls = consoleLogSpy.mock.calls
        .map((call: [string]) => {
          try {
            return JSON.parse(call[0]);
          } catch {
            return null;
          }
        })
        .filter(Boolean);

      const loggedOps = logCalls.map((entry: { operation?: string }) => entry.operation);
      expect(loggedOps).toContain('evaluateTicketForGate.start');
      expect(loggedOps).toContain('fetchTicketData');
      expect(loggedOps).toContain('evaluateQualityGate');
      expect(loggedOps).toContain('evaluateTicketForGate.complete');

      // All logs have executionId
      for (const entry of logCalls) {
        if (entry && typeof entry === 'object' && 'executionId' in entry) {
          expect(entry.executionId).toBeDefined();
          expect(typeof entry.executionId).toBe('string');
        }
      }
    });

    // ─── AC-EP-09: Zero any ──────────

    it('should return typed result with no any usage (AC-EP-09)', async () => {
      // Act
      const result = await evaluateTicketForGate('PROJ-123', 'In Progress', makeProjectConfig());

      // Assert — type guard: result has correct shape at runtime
      expect(typeof result.executionId).toBe('string');
      expect(typeof result.ticketKey).toBe('string');
      expect(['definition', 'execution', 'delivery']).toContain(result.gateType);
      expect(typeof result.score.overall).toBe('number');
      expect(Array.isArray(result.inconsistencies)).toBe(true);
      expect(Array.isArray(result.enforcementActions)).toBe(true);
    });

    // ─── AC-EP-11: Audit log entry generated ──────────

    it('should generate audit log entry with gate_evaluated action (AC-EP-11)', async () => {
      // Act
      const result = await evaluateTicketForGate('PROJ-123', 'In Progress', makeProjectConfig());

      // Assert
      const audit = result.auditEntry;
      expect(audit.action).toBe('gate_evaluated');
      expect(audit.executionId).toBe(result.executionId);
      expect(audit.ticketKey).toBe('PROJ-123');
      expect(audit.projectKey).toBe('PROJ');
      expect(audit.timestamp).toBeDefined();
      expect(audit.id).toBeDefined();
      expect(audit.details).toHaveProperty('gateType', 'definition');
      expect(audit.details).toHaveProperty('passed', true);
    });

    it('should generate audit entry with passed=false when gate fails (AC-EP-11)', async () => {
      // Arrange
      const failedGate = makeGateResult({ passed: false });
      mockedEvaluateGate.mockReturnValue(failedGate);

      // Act
      const result = await evaluateTicketForGate('PROJ-123', 'In Progress', makeProjectConfig());

      // Assert
      expect(result.auditEntry.details).toHaveProperty('passed', false);
    });

    // ─── SEC-PRIV-004: Input validation ──────────

    it('should return fail-open for empty ticketKey (SEC-PRIV-004)', async () => {
      // Act
      const result = await evaluateTicketForGate('', 'In Progress', makeProjectConfig());

      // Assert — validation fails gracefully (fail-open)
      expect(result.gateResult.passed).toBe(true);
      expect(result.error).toContain('ticketKey');
    });

    it('should return fail-open for whitespace-only ticketKey (SEC-PRIV-004)', async () => {
      // Act
      const result = await evaluateTicketForGate('   ', 'In Progress', makeProjectConfig());

      // Assert
      expect(result.gateResult.passed).toBe(true);
      expect(result.error).toContain('ticketKey');
    });

    it('should return fail-open for empty targetStatus (SEC-PRIV-004)', async () => {
      // Act
      const result = await evaluateTicketForGate('PROJ-123', '', makeProjectConfig());

      // Assert
      expect(result.gateResult.passed).toBe(true);
      expect(result.error).toContain('targetStatus');
    });

    // ─── FORGE-OPS-054: Graceful degradation ──────────

    it('should fail-open gracefully on any unexpected error (FORGE-OPS-054)', async () => {
      // Arrange
      mockedDetectInconsistencies.mockImplementation(() => {
        throw new Error('Unexpected error in detection');
      });

      // Act
      const result = await evaluateTicketForGate('PROJ-123', 'In Progress', makeProjectConfig());

      // Assert
      expect(result.gateResult.passed).toBe(true);
      expect(result.error).toContain('Unexpected error');
    });

    // ─── ROVO-INTEG-005: Rovo timeout fallback ──────────

    it('should continue when Rovo context fetch fails with timeout (ROVO-INTEG-005)', async () => {
      // Arrange
      mockedGetContext.mockRejectedValue(new Error('Rovo timeout 5000ms'));

      // Act
      const result = await evaluateTicketForGate('PROJ-123', 'In Progress', makeProjectConfig());

      // Assert — graceful fallback
      expect(result.error).toBeUndefined();
      expect(result.gateResult).toBeDefined();
      expect(mockedDetectInconsistencies).toHaveBeenCalledWith(
        expect.any(Object),
        undefined,
        undefined,
        expect.any(Object),
      );
    });

    // ─── ROVO-INTEG-0915: Rovo is enhancer not requirement ──────────

    it('should produce valid result even when Rovo is completely unavailable (ROVO-INTEG-0915)', async () => {
      // Arrange
      mockedGetContext.mockRejectedValue(new Error('Service unavailable'));

      // Act
      const result = await evaluateTicketForGate('PROJ-456', 'Done', makeProjectConfig());

      // Assert
      expect(result.gateType).toBe('delivery');
      expect(result.ticketKey).toBe('PROJ-456');
      expect(result.gateResult).toBeDefined();
      expect(result.auditEntry).toBeDefined();
    });

    // ─── ARCH-SOLID-006: Handler -> Service -> Repository ──────────

    it('should delegate to adapters (repository layer) not make direct API calls (ARCH-SOLID-006)', async () => {
      // Act
      await evaluateTicketForGate('PROJ-123', 'In Progress', makeProjectConfig());

      // Assert — uses adapters, not direct HTTP
      expect(mockedGetTicketData).toHaveBeenCalledTimes(1);
      expect(mockedGetContext).toHaveBeenCalledTimes(1);
      // Scoring services called (domain layer)
      expect(mockedDetectInconsistencies).toHaveBeenCalledTimes(1);
      expect(mockedCalculateScore).toHaveBeenCalledTimes(1);
      expect(mockedEvaluateGate).toHaveBeenCalledTimes(1);
      expect(mockedDetermineEnforcementActions).toHaveBeenCalledTimes(1);
    });

    // ─── SEC-PRIV-010: Audit log completeness ──────────

    it('should include who/what/when/resource in audit entry even on fail-open (SEC-PRIV-010)', async () => {
      // Arrange — force fail-open
      mockedGetTicketData.mockRejectedValue(new Error('API down'));

      // Act
      const result = await evaluateTicketForGate('PROJ-999', 'In Progress', makeProjectConfig());

      // Assert — audit entry still present with required fields
      expect(result.auditEntry).toBeDefined();
      expect(result.auditEntry.action).toBe('gate_evaluated');
      expect(result.auditEntry.timestamp).toBeDefined();
      expect(result.auditEntry.executionId).toBeDefined();
      expect(result.auditEntry.projectKey).toBe('PROJ');
      expect(result.auditEntry.ticketKey).toBe('PROJ-999');
    });

    // ─── SEC-PRIV-008: Data minimization in audit ──────────

    it('should not include full ticket data or large payloads in audit details (SEC-PRIV-008)', async () => {
      // Act
      const result = await evaluateTicketForGate('PROJ-123', 'In Progress', makeProjectConfig());

      // Assert — audit details only metadata
      const details = result.auditEntry.details;
      expect(Object.keys(details)).toEqual(['gateType', 'passed']);
      expect(details).not.toHaveProperty('description');
      expect(details).not.toHaveProperty('summary');
      expect(details).not.toHaveProperty('inconsistencies');
    });

    // ─── FORGE-OPS-0105: Stateless ──────────

    it('should produce independent results for consecutive calls (FORGE-OPS-0105)', async () => {
      // Arrange
      const ticket1 = makeTicket({ key: 'PROJ-001', summary: 'First ticket' });
      const ticket2 = makeTicket({ key: 'PROJ-002', summary: 'Second ticket' });

      mockedGetTicketData.mockResolvedValueOnce(ticket1).mockResolvedValueOnce(ticket2);

      // Act
      const result1 = await evaluateTicketForGate('PROJ-001', 'In Progress', makeProjectConfig());
      const result2 = await evaluateTicketForGate('PROJ-002', 'In Review', makeProjectConfig());

      // Assert — independent results
      expect(result1.ticketKey).toBe('PROJ-001');
      expect(result2.ticketKey).toBe('PROJ-002');
      expect(result1.executionId).not.toBe(result2.executionId);
    });

    // ─── Edge case: Unknown target status defaults to definition gate ──────────

    it('should default to definition gate for unmapped target status', async () => {
      // Act
      const result = await evaluateTicketForGate('PROJ-123', 'Unknown Status', makeProjectConfig());

      // Assert — defaults to definition
      expect(result.gateType).toBe('definition');
    });

    // ─── Enforcement actions included in result ──────────

    it('should include enforcement actions from determineEnforcementActions in result', async () => {
      // Arrange
      const failedGate = makeGateResult({ passed: false });
      const enforcementAction = {
        type: 'block_transition' as const,
        transitionId: 'In Progress',
        reason: 'Transition blocked',
      };

      mockedEvaluateGate.mockReturnValue(failedGate);
      mockedDetermineEnforcementActions.mockReturnValue([enforcementAction]);

      // Act
      const result = await evaluateTicketForGate('PROJ-123', 'In Progress', makeProjectConfig());

      // Assert
      expect(result.enforcementActions).toHaveLength(1);
      expect(result.enforcementActions[0]?.type).toBe('block_transition');
    });

    // ─── Non-Error fallback: Rovo context throws non-Error ──────────

    it('should gracefully handle non-Error thrown by Rovo context fetch (line 156 else branch)', async () => {
      // Arrange — getContext rejects with a non-Error primitive
      mockedGetContext.mockRejectedValue('Rovo service crashed');

      // Act
      const result = await evaluateTicketForGate('PROJ-123', 'In Progress', makeProjectConfig());

      // Assert — pipeline continues without Rovo (graceful degradation)
      expect(result.error).toBeUndefined();
      expect(result.gateResult).toBeDefined();
      expect(mockedDetectInconsistencies).toHaveBeenCalledWith(
        expect.any(Object),
        undefined,
        undefined,
        expect.any(Object),
      );

      // Verify the fallback log entry was emitted with 'Unknown Rovo error'
      const logCalls = consoleLogSpy.mock.calls
        .map((call: [string]) => {
          try {
            return JSON.parse(call[0]);
          } catch {
            return null;
          }
        })
        .filter(Boolean);
      const fallbackLog = logCalls.find(
        (entry: { operation?: string }) => entry.operation === 'fetchRovoContextFallback',
      );
      expect(fallbackLog).toBeDefined();
      expect(fallbackLog.error).toBe('Unknown Rovo error');
    });

    // ─── Non-Error fallback: Pipeline throws non-Error ──────────

    it('should fail-open with generic message when pipeline throws non-Error (line 399 else branch)', async () => {
      // Arrange — getTicketData rejects with a non-Error primitive
      mockedGetTicketData.mockRejectedValue('something went terribly wrong');

      // Act
      const result = await evaluateTicketForGate('PROJ-123', 'In Progress', makeProjectConfig());

      // Assert — fail-open with generic message
      expect(result.gateResult.passed).toBe(true);
      expect(result.error).toBe('Pipeline error');
      expect(result.inconsistencies).toEqual([]);
      expect(result.enforcementActions).toEqual([]);

      // Verify the fail-open log entry was emitted
      const logCalls = consoleLogSpy.mock.calls
        .map((call: [string]) => {
          try {
            return JSON.parse(call[0]);
          } catch {
            return null;
          }
        })
        .filter(Boolean);
      const failOpenLog = logCalls.find(
        (entry: { operation?: string }) => entry.operation === 'evaluateTicketForGate.failOpen',
      );
      expect(failOpenLog).toBeDefined();
      expect(failOpenLog.error).toBe('Pipeline error');
    });

    // ─── Non-Error fallback: Validation throws non-Error ──────────

    it('should fail-open with generic message when validation throws non-Error (line 370 else branch)', async () => {
      // Arrange — isolate modules to override REGError so it throws a non-Error
      // when the VALIDATION_ERROR code is used
      let isolatedEvaluate: typeof evaluateTicketForGate = evaluateTicketForGate;

      jest.isolateModules(() => {
        // Re-mock the errors module with a REGError that throws a string for VALIDATION_ERROR
        jest.doMock('../../../../src/backend/types/errors', () => {
          const actual = jest.requireActual('../../../../src/backend/types/errors');
          const OriginalREGError = actual.REGError;
          return {
            ...actual,
            REGError: class extends OriginalREGError {
              constructor(message: string, code: string, executionId?: string) {
                if (code === 'VALIDATION_ERROR') {
                  throw 42; // non-Error primitive
                }
                super(message, code, executionId);
              }
            },
          };
        });

        // Re-mock all adapter modules to prevent real imports
        jest.doMock('../../../../src/backend/services/jira/jira-adapter', () => ({
          getTicketData: jest.fn().mockResolvedValue(makeTicket()),
        }));
        jest.doMock('../../../../src/backend/services/rovo/rovo-adapter', () => ({
          getContext: jest.fn().mockResolvedValue(makeRovoContext()),
        }));
        jest.doMock('../../../../src/backend/services/scoring/inconsistency-detector', () => ({
          detectInconsistencies: jest.fn().mockReturnValue([]),
        }));
        jest.doMock('../../../../src/backend/services/scoring/scoring-engine', () => ({
          calculateScore: jest.fn().mockReturnValue(makeScore()),
        }));
        jest.doMock('../../../../src/backend/services/scoring/quality-gate-rules', () => ({
          evaluateGate: jest.fn().mockReturnValue(makeGateResult()),
          determineEnforcementActions: jest.fn().mockReturnValue([]),
        }));
        jest.doMock(
          '../../../../src/backend/services/relationship-index/relationship-storage',
          () => ({
            buildRelationshipContext: jest.fn().mockResolvedValue(makeRelationshipContext()),
          }),
        );

        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const mod = require('../../../../src/backend/services/evaluation/evaluation-pipeline');
        isolatedEvaluate = mod.evaluateTicketForGate;
      });

      // Act — empty ticketKey triggers requireNonEmpty -> REGError constructor
      // which throws 42 (a number, not an Error)
      const result = await isolatedEvaluate('', 'In Progress', makeProjectConfig());

      // Assert — the non-Error is caught and generic 'Validation error' message is used
      expect(result.gateResult.passed).toBe(true);
      expect(result.error).toBe('Validation error');
      expect(result.inconsistencies).toEqual([]);
      expect(result.enforcementActions).toEqual([]);
    });

    // ─── AC-EP-12: Pipeline fetches RelationshipContext with graceful degradation ──────────

    it('should fetch relationship context and pass to detection (AC-EP-12, AC-06)', async () => {
      // Arrange
      const relCtx = makeRelationshipContext();
      mockedBuildRelationshipContext.mockResolvedValue(relCtx);

      // Act
      const result = await evaluateTicketForGate('PROJ-123', 'In Progress', makeProjectConfig());

      // Assert — buildRelationshipContext called with correct args
      expect(mockedBuildRelationshipContext).toHaveBeenCalledWith(
        'PROJ',
        'jira:PROJ-123',
        expect.any(String),
      );
      // detectInconsistencies called with relationshipContext as 4th arg
      expect(mockedDetectInconsistencies).toHaveBeenCalledWith(
        expect.any(Object),
        expect.any(Object),
        undefined,
        relCtx,
      );
      expect(result.error).toBeUndefined();
    });

    it('should pass relationship context to scoring engine (AC-EP-12)', async () => {
      // Arrange
      const relCtx = makeRelationshipContext();
      mockedBuildRelationshipContext.mockResolvedValue(relCtx);

      // Act
      await evaluateTicketForGate('PROJ-123', 'In Progress', makeProjectConfig());

      // Assert — calculateScore called with ScoringInput containing relationshipContext
      expect(mockedCalculateScore).toHaveBeenCalledWith(
        expect.objectContaining({
          ticket: expect.any(Object),
          relationshipContext: relCtx,
        }),
      );
    });

    // ─── AC-EP-14: documentationRefs populated from RelationshipContext ──────────

    it('should populate documentationRefs from relationship context for delivery gate (AC-EP-14, AC-10)', async () => {
      // Arrange — relationship context with documentation
      const relCtx = makeRelationshipContext({
        documentation: [{ id: 'confluence:12345' }, { id: 'confluence:67890' }],
      });
      mockedBuildRelationshipContext.mockResolvedValue(relCtx);

      // Act
      await evaluateTicketForGate('PROJ-123', 'Done', makeProjectConfig());

      // Assert — evaluateGate called with GateEvaluationInput containing documentationRefs
      expect(mockedEvaluateGate).toHaveBeenCalledWith(
        'delivery',
        expect.objectContaining({
          documentationRefs: ['confluence:12345', 'confluence:67890'],
        }),
      );
    });

    // ─── FORGE-OPS-054: Graceful degradation when relationship context fetch fails ──────────

    it('should continue without relationship context when fetch fails (AC-EP-12, FORGE-OPS-054)', async () => {
      // Arrange
      mockedBuildRelationshipContext.mockRejectedValue(new Error('Storage unavailable'));

      // Act
      const result = await evaluateTicketForGate('PROJ-123', 'In Progress', makeProjectConfig());

      // Assert — pipeline succeeds, no relationship context passed
      expect(result.error).toBeUndefined();
      expect(result.gateResult).toBeDefined();
      expect(mockedDetectInconsistencies).toHaveBeenCalledWith(
        expect.any(Object),
        expect.any(Object),
        undefined,
        undefined,
      );
    });

    // ─── AC-EP-15: Delivery gate documentation check functional ──────────

    it('should not regress existing pipeline behavior when relationship context is empty (AC-EP-15)', async () => {
      // Arrange — empty relationship context (no documentation)
      mockedBuildRelationshipContext.mockResolvedValue(makeRelationshipContext());

      // Act
      const result = await evaluateTicketForGate('PROJ-123', 'In Progress', makeProjectConfig());

      // Assert — same as before: gate evaluates, no documentationRefs
      expect(result.gateResult).toBeDefined();
      expect(result.error).toBeUndefined();
      expect(mockedEvaluateGate).toHaveBeenCalledWith(
        'definition',
        expect.objectContaining({
          documentationRefs: undefined,
        }),
      );
    });

    it('should fetch relationship context and log the operation (AC-EP-12)', async () => {
      // Arrange
      mockedBuildRelationshipContext.mockResolvedValue(makeRelationshipContext());

      // Act
      await evaluateTicketForGate('PROJ-123', 'In Progress', makeProjectConfig());

      // Assert — verify log includes fetchRelationshipContext operation
      const logCalls = consoleLogSpy.mock.calls
        .map((call: [string]) => {
          try {
            return JSON.parse(call[0]);
          } catch {
            return null;
          }
        })
        .filter(Boolean);
      const loggedOps = logCalls.map((entry: { operation?: string }) => entry.operation);
      expect(loggedOps).toContain('fetchRelationshipContext');
    });
  });
});
