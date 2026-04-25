// Test suite for the Quality Gate Rules Engine domain service
// Covers: evaluateGate, determineEnforcementActions, canTransition
// Pattern: Arrange-Act-Assert (AAA), TDD cycle: RED -> GREEN -> REFACTOR
// [TEST-QA-056] TDD cycle: RED -> GREEN -> REFACTOR
// [TEST-QA-201] Arrange-Act-Assert structure

import {
  evaluateGate,
  determineEnforcementActions,
  canTransition,
} from '../../../../src/backend/services/scoring/quality-gate-rules';
import type {
  GateEvaluationInput,
  QualityGateRulesConfig,
} from '../../../../src/backend/services/scoring/quality-gate-rules';
import type { ConsistencyScore } from '../../../../src/backend/types/consistency-score';
import type { Inconsistency } from '../../../../src/backend/types/inconsistency';
import type { ProjectConfig, GateConfig } from '../../../../src/backend/types/project-config';
import type { QualityGateResult } from '../../../../src/backend/types/quality-gate';
import type { EnforcementAction } from '../../../../src/backend/types/enforcement';

// ---------------------------------------------------------------------------
// Test Fixtures
// ---------------------------------------------------------------------------

const makeScore = (overall: number): ConsistencyScore => ({
  overall,
  axes: {
    clarity: overall,
    consistency: overall,
    risk: overall,
    documentation: overall,
    technicalDebt: overall,
  },
  timestamp: '2026-04-15T10:00:00Z',
  executionId: 'exec-test-001',
});

const makeConfig = (overrides: Partial<ProjectConfig> = {}): ProjectConfig => ({
  projectKey: 'PROJ',
  enabled: true,
  scoreThreshold: 80,
  gates: { definition: true, execution: true, delivery: true },
  ...overrides,
});

const makeGateConfig = (overrides: Partial<GateConfig> = {}): GateConfig => ({
  definition: true,
  execution: true,
  delivery: true,
  ...overrides,
});

const makeInconsistency = (
  severity: Inconsistency['severity'] = 'warning',
  overrides: Partial<Inconsistency> = {},
): Inconsistency => ({
  id: 'inc-test-001',
  type: 'contradiction',
  severity,
  source: 'jira',
  description: 'Test inconsistency',
  affectedTicketKey: 'PROJ-123',
  ...overrides,
});

const makeInput = (overrides: Partial<GateEvaluationInput> = {}): GateEvaluationInput => ({
  score: makeScore(85),
  inconsistencies: [],
  config: makeConfig(),
  ticketKey: 'PROJ-123',
  ...overrides,
});

// ---------------------------------------------------------------------------
// evaluateGate
// ---------------------------------------------------------------------------

describe('evaluateGate', () => {
  describe('Definition Gate (Gate 1)', () => {
    it('should pass Definition gate when score >= threshold (AC-01, AC-05)', () => {
      // Arrange
      const input = makeInput({ score: makeScore(85) });

      // Act
      const result = evaluateGate('definition', input);

      // Assert
      expect(result.passed).toBe(true);
      expect(result.gate).toBe('definition');
    });

    it('should fail Definition gate when score < threshold (AC-01, AC-05)', () => {
      // Arrange
      const input = makeInput({ score: makeScore(75) });

      // Act
      const result = evaluateGate('definition', input);

      // Assert
      expect(result.passed).toBe(false);
    });

    it('should handle score exactly at threshold (boundary) (AC-05, TEST-QA-057)', () => {
      // Arrange
      const input = makeInput({ score: makeScore(80) });

      // Act
      const result = evaluateGate('definition', input);

      // Assert
      expect(result.passed).toBe(true);
    });

    it('should block transition to "In Progress" when Definition gate fails (AC-05)', () => {
      // Arrange
      const input = makeInput({ score: makeScore(50) });

      // Act
      const result = evaluateGate('definition', input);

      // Assert
      expect(result.passed).toBe(false);
      expect(result.blockedTransitions).toContain('In Progress');
    });

    it('should use ProjectConfig.scoreThreshold (AC-04, ARCH-SOLID-049-05)', () => {
      // Arrange
      const config = makeConfig({ scoreThreshold: 60 });
      const input = makeInput({ score: makeScore(65), config });

      // Act
      const result = evaluateGate('definition', input);

      // Assert
      expect(result.passed).toBe(true);
    });
  });

  describe('Execution Gate (Gate 2)', () => {
    it('should pass Execution gate with no critical inconsistencies (AC-01, AC-06)', () => {
      // Arrange
      const inconsistencies: readonly Inconsistency[] = [
        makeInconsistency('warning'),
        makeInconsistency('info'),
      ];
      const input = makeInput({ inconsistencies });

      // Act
      const result = evaluateGate('execution', input);

      // Assert
      expect(result.passed).toBe(true);
      expect(result.gate).toBe('execution');
    });

    it('should fail Execution gate when critical inconsistencies exist (AC-01, AC-06)', () => {
      // Arrange
      const inconsistencies: readonly Inconsistency[] = [
        makeInconsistency('critical', { id: 'inc-crit-1' }),
      ];
      const input = makeInput({ inconsistencies });

      // Act
      const result = evaluateGate('execution', input);

      // Assert
      expect(result.passed).toBe(false);
    });

    it('should pass Execution gate with critical when blockOnCritical=false (AC-06, AC-12, ARCH-SOLID-049-05)', () => {
      // Arrange
      const inconsistencies: readonly Inconsistency[] = [makeInconsistency('critical')];
      const input = makeInput({ inconsistencies });
      const rulesConfig: QualityGateRulesConfig = { blockOnCritical: false };

      // Act
      const result = evaluateGate('execution', input, rulesConfig);

      // Assert
      expect(result.passed).toBe(true);
    });

    it('should handle empty inconsistencies list (AC-01, TEST-QA-057)', () => {
      // Arrange
      const input = makeInput({ inconsistencies: [] });

      // Act
      const result = evaluateGate('execution', input);

      // Assert
      expect(result.passed).toBe(true);
    });

    it('should default blockOnCritical to true (AC-12)', () => {
      // Arrange
      const inconsistencies: readonly Inconsistency[] = [makeInconsistency('critical')];
      const input = makeInput({ inconsistencies });

      // Act — no rulesConfig provided, should default blockOnCritical=true
      const result = evaluateGate('execution', input);

      // Assert
      expect(result.passed).toBe(false);
    });
  });

  describe('Delivery Gate (Gate 3)', () => {
    it('should pass Delivery gate when all conditions met (AC-01, AC-07)', () => {
      // Arrange — documentation refs needed for delivery gate with requireDocumentation=true
      const input = makeInput({
        score: makeScore(85),
        documentationRefs: ['doc-001'],
      });

      // Act
      const result = evaluateGate('delivery', input);

      // Assert
      expect(result.passed).toBe(true);
      expect(result.gate).toBe('delivery');
    });

    it('should fail Delivery gate when score below threshold (AC-01, AC-07)', () => {
      // Arrange
      const input = makeInput({ score: makeScore(70) });

      // Act
      const result = evaluateGate('delivery', input);

      // Assert
      expect(result.passed).toBe(false);
    });

    it('should skip documentation check when requireDocumentation=false (AC-07, AC-12, ARCH-SOLID-049-05)', () => {
      // Arrange — no documentation refs, but requireDocumentation=false
      const input = makeInput({ score: makeScore(85), documentationRefs: undefined });
      const rulesConfig: QualityGateRulesConfig = { requireDocumentation: false };

      // Act
      const result = evaluateGate('delivery', input, rulesConfig);

      // Assert
      expect(result.passed).toBe(true);
    });

    it('should fail Delivery gate when documentation refs are missing and requireDocumentation=true (AC-07, AC-12)', () => {
      // Arrange
      const input = makeInput({ score: makeScore(85), documentationRefs: undefined });

      // Act — default requireDocumentation=true
      const result = evaluateGate('delivery', input);

      // Assert
      expect(result.passed).toBe(false);
    });

    it('should pass Delivery gate with documentation refs present and requireDocumentation=true (AC-07)', () => {
      // Arrange
      const input = makeInput({
        score: makeScore(85),
        documentationRefs: ['doc-001', 'doc-002'],
      });

      // Act
      const result = evaluateGate('delivery', input);

      // Assert
      expect(result.passed).toBe(true);
    });

    it('should default requireDocumentation to true (AC-12)', () => {
      // Arrange — no rulesConfig, so requireDocumentation defaults to true
      const input = makeInput({ score: makeScore(85), documentationRefs: undefined });

      // Act
      const result = evaluateGate('delivery', input);

      // Assert — fails because no docs and requireDocumentation defaults to true
      expect(result.passed).toBe(false);
    });
  });

  describe('Disabled Gates', () => {
    it('should skip disabled gates and return passed (AC-13)', () => {
      // Arrange — definition gate disabled, score would fail
      const config = makeConfig({ gates: makeGateConfig({ definition: false }) });
      const input = makeInput({ score: makeScore(50), config });

      // Act
      const result = evaluateGate('definition', input);

      // Assert
      expect(result.passed).toBe(true);
      expect(result.blockedTransitions).toHaveLength(0);
    });

    it('should handle all gates disabled (AC-13, TEST-QA-057)', () => {
      // Arrange
      const config = makeConfig({
        gates: { definition: false, execution: false, delivery: false },
      });
      const input = makeInput({ score: makeScore(10), config });

      // Act & Assert
      expect(evaluateGate('definition', input).passed).toBe(true);
      expect(evaluateGate('execution', input).passed).toBe(true);
      expect(evaluateGate('delivery', input).passed).toBe(true);
    });

    it('should respect GateConfig boolean flags (AC-04, AC-13)', () => {
      // Arrange — only execution enabled
      const config = makeConfig({
        gates: { definition: false, execution: true, delivery: false },
      });
      const input = makeInput({ score: makeScore(50), config });

      // Act & Assert
      expect(evaluateGate('definition', input).passed).toBe(true); // disabled
      expect(evaluateGate('execution', input).passed).toBe(true); // no critical inc
      expect(evaluateGate('delivery', input).passed).toBe(true); // disabled
    });
  });

  describe('Determinism', () => {
    it('should be deterministic for same input (AC-10, ARCH-SOLID-0912)', () => {
      // Arrange
      const input = makeInput({ score: makeScore(75) });

      // Act
      const result1 = evaluateGate('definition', input);
      const result2 = evaluateGate('definition', input);

      // Assert
      expect(result1.passed).toBe(result2.passed);
      expect(result1.blockedTransitions).toEqual(result2.blockedTransitions);
      expect(result1.inconsistencies).toEqual(result2.inconsistencies);
    });
  });

  describe('QualityGateResult structure', () => {
    it('should include the original score in the result (AC-02)', () => {
      // Arrange
      const score = makeScore(85);
      const input = makeInput({ score });

      // Act
      const result = evaluateGate('definition', input);

      // Assert
      expect(result.score).toBe(score);
    });

    it('should include the executionId from the score (AC-02)', () => {
      // Arrange
      const score = makeScore(85);
      const input = makeInput({ score });

      // Act
      const result = evaluateGate('definition', input);

      // Assert
      expect(result.executionId).toBe('exec-test-001');
    });
  });
});

// ---------------------------------------------------------------------------
// determineEnforcementActions
// ---------------------------------------------------------------------------

describe('determineEnforcementActions', () => {
  const makeGateResult = (overrides: Partial<QualityGateResult> = {}): QualityGateResult => ({
    gate: 'definition',
    passed: false,
    score: makeScore(50),
    inconsistencies: [],
    blockedTransitions: ['In Progress'],
    executionId: 'exec-test-001',
    ...overrides,
  });

  describe('Definition gate failures', () => {
    it('should return BlockTransitionAction for Definition fail (AC-03, AC-05, ARCH-SOLID-0861)', () => {
      // Arrange
      const result = makeGateResult({
        gate: 'definition',
        passed: false,
        blockedTransitions: ['In Progress'],
      });

      // Act
      const actions = determineEnforcementActions(result, undefined, 'PROJ-123');

      // Assert
      expect(actions.some((a) => a.type === 'block_transition')).toBe(true);
      const blockAction = actions.find((a) => a.type === 'block_transition')!;
      expect(blockAction).toBeDefined();
      if (blockAction.type === 'block_transition') {
        expect(blockAction.transitionId).toContain('In Progress');
        expect(blockAction.reason).toContain('PROJ-123');
        expect(blockAction.reason).not.toContain('exec-test-001');
      }
    });

    it('should return AddCommentAction for Definition fail (AC-03)', () => {
      // Arrange
      const result = makeGateResult({
        gate: 'definition',
        passed: false,
      });

      // Act
      const actions = determineEnforcementActions(result, undefined, 'PROJ-456');

      // Assert
      expect(actions.some((a) => a.type === 'add_comment')).toBe(true);
      const commentAction = actions.find((a) => a.type === 'add_comment')!;
      if (commentAction.type === 'add_comment') {
        expect(commentAction.body).toContain('PROJ-456');
        expect(commentAction.body).not.toContain('exec-test-001');
      }
    });
  });

  describe('Execution gate failures', () => {
    it('should return BlockPRAction for Execution fail (AC-03, AC-06, GH-INTEG-001)', () => {
      // Arrange
      const criticalInc = makeInconsistency('critical', { id: 'inc-crit-1' });
      const result = makeGateResult({
        gate: 'execution',
        passed: false,
        inconsistencies: [criticalInc],
        blockedTransitions: ['PR Merge'],
      });

      // Act
      const actions = determineEnforcementActions(
        result,
        {
          prNumber: 42,
          repo: 'org/repo',
        },
        'PROJ-789',
      );

      // Assert
      expect(actions.some((a) => a.type === 'block_pr')).toBe(true);
      const blockPR = actions.find((a) => a.type === 'block_pr')!;
      if (blockPR.type === 'block_pr') {
        expect(blockPR.prNumber).toBe(42);
        expect(blockPR.repo).toBe('org/repo');
        expect(blockPR.reason).toContain('PROJ-789');
        expect(blockPR.reason).not.toContain('exec-test-001');
      }
    });

    it('should return FlagInconsistencyAction for each critical inc (AC-03, ARCH-SOLID-0861)', () => {
      // Arrange
      const criticalInc1 = makeInconsistency('critical', { id: 'inc-crit-1' });
      const criticalInc2 = makeInconsistency('critical', { id: 'inc-crit-2' });
      const result = makeGateResult({
        gate: 'execution',
        passed: false,
        inconsistencies: [criticalInc1, criticalInc2],
      });

      // Act
      const actions = determineEnforcementActions(result);

      // Assert
      const flagActions = actions.filter((a) => a.type === 'flag_inconsistency');
      expect(flagActions).toHaveLength(2);
    });
  });

  describe('Delivery gate failures', () => {
    it('should return BlockTransitionAction for Delivery fail (AC-03, AC-07)', () => {
      // Arrange
      const result = makeGateResult({
        gate: 'delivery',
        passed: false,
        blockedTransitions: ['Merge'],
      });

      // Act
      const actions = determineEnforcementActions(result, undefined, 'PROJ-999');

      // Assert
      expect(actions.some((a) => a.type === 'block_transition')).toBe(true);
      const blockAction = actions.find((a) => a.type === 'block_transition')!;
      if (blockAction.type === 'block_transition') {
        expect(blockAction.transitionId).toContain('Merge');
        expect(blockAction.reason).toContain('PROJ-999');
        expect(blockAction.reason).not.toContain('exec-test-001');
      }
    });

    it('should return AddCommentAction for Delivery fail (AC-03)', () => {
      // Arrange
      const result = makeGateResult({
        gate: 'delivery',
        passed: false,
      });

      // Act
      const actions = determineEnforcementActions(result, undefined, 'PROJ-999');

      // Assert
      expect(actions.some((a) => a.type === 'add_comment')).toBe(true);
      const commentAction = actions.find((a) => a.type === 'add_comment')!;
      if (commentAction.type === 'add_comment') {
        expect(commentAction.body).toContain('PROJ-999');
        expect(commentAction.body).not.toContain('exec-test-001');
      }
    });
  });

  describe('Passed gates', () => {
    it('should return empty actions for passed gate (AC-03)', () => {
      // Arrange
      const result = makeGateResult({ passed: true, blockedTransitions: [] });

      // Act
      const actions = determineEnforcementActions(result);

      // Assert
      expect(actions).toHaveLength(0);
    });
  });
});

// ---------------------------------------------------------------------------
// canTransition
// ---------------------------------------------------------------------------

describe('canTransition', () => {
  it('should allow transition when applicable gate passes (AC-11)', () => {
    // Arrange
    const input = makeInput({ score: makeScore(85) });

    // Act
    const result = canTransition('PROJ-123', 'In Progress', input);

    // Assert
    expect(result).toBe(true);
  });

  it('should block transition when applicable gate fails (AC-11)', () => {
    // Arrange
    const input = makeInput({ score: makeScore(50) });

    // Act
    const result = canTransition('PROJ-123', 'In Progress', input);

    // Assert
    expect(result).toBe(false);
  });

  it('should allow transition when target status does not map to a gate (AC-11)', () => {
    // Arrange — "Closed" does not map to any gate
    const input = makeInput({ score: makeScore(10) });

    // Act
    const result = canTransition('PROJ-123', 'Closed', input);

    // Assert
    expect(result).toBe(true);
  });

  it('should use rulesConfig defaults when not provided (AC-11)', () => {
    // Arrange — score is high enough for definition gate
    const input = makeInput({ score: makeScore(90) });

    // Act
    const result = canTransition('PROJ-123', 'In Progress', input);

    // Assert
    expect(result).toBe(true);
  });

  it('should pass rulesConfig to evaluateGate (AC-11, AC-12)', () => {
    // Arrange — critical inconsistency but blockOnCritical=false
    const inconsistencies: readonly Inconsistency[] = [makeInconsistency('critical')];
    const input = makeInput({ inconsistencies });
    const rulesConfig: QualityGateRulesConfig = { blockOnCritical: false };

    // Act — "In Review" maps to execution gate
    const result = canTransition('PROJ-123', 'In Review', input, rulesConfig);

    // Assert
    expect(result).toBe(true);
  });
});
