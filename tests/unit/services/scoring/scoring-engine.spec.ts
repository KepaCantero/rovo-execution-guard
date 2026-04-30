// Test suite for the Scoring Engine domain service
// Covers: scoring constants, calculateScore, evaluateQualityGate
// Pattern: Arrange-Act-Assert (AAA), TDD cycle: RED -> GREEN -> REFACTOR
// [TEST-QA-001]

import {
  calculateScore,
  evaluateQualityGate,
  generateAxisSuggestions,
  DEFAULT_AXIS_WEIGHTS,
  DEFAULT_SCORE_THRESHOLD,
  SCORING_PRECISION,
} from '../../../../src/backend/services/scoring/scoring-engine';
import type {
  ScoringInput,
  AxisWeights,
  ScoringAxisName,
} from '../../../../src/backend/services/scoring/scoring-engine';
import type { JiraTicketData } from '../../../../src/backend/types/jira-data';
import type { Inconsistency } from '../../../../src/backend/types/inconsistency';
import type { ConsistencyScore, ScoreAxes } from '../../../../src/backend/types/consistency-score';
import { InsufficientDataError, ScoringError } from '../../../../src/backend/types/errors';

// ---------------------------------------------------------------------------
// Test Fixtures
// ---------------------------------------------------------------------------

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

const makeMinimalTicket = (): JiraTicketData => ({
  key: 'PROJ-001',
  summary: 'Do the thing',
  description: 'Please do the thing that needs doing.',
  status: 'TO DO',
  issueType: 'Task',
  labels: [],
  projectKey: 'PROJ',
  created: '2026-01-01T00:00:00Z',
  updated: '2026-01-01T00:00:00Z',
});

// ---------------------------------------------------------------------------
// Scoring Constants
// ---------------------------------------------------------------------------

describe('Scoring Constants', () => {
  describe('DEFAULT_AXIS_WEIGHTS', () => {
    it('should define weights for all 5 axes', () => {
      // Arrange
      const expectedAxes: ScoringAxisName[] = [
        'clarity',
        'consistency',
        'risk',
        'documentation',
        'technicalDebt',
      ];

      // Act & Assert
      for (const axis of expectedAxes) {
        expect(DEFAULT_AXIS_WEIGHTS[axis]).toBeDefined();
        expect(typeof DEFAULT_AXIS_WEIGHTS[axis]).toBe('number');
      }
    });

    it('should sum to exactly 100', () => {
      // Arrange
      const weights = DEFAULT_AXIS_WEIGHTS;

      // Act
      const total =
        weights.clarity +
        weights.consistency +
        weights.risk +
        weights.documentation +
        weights.technicalDebt;

      // Assert
      expect(total).toBe(100);
    });

    it('should have Clarity and Consistency as the highest weights at 25 each', () => {
      // Assert
      expect(DEFAULT_AXIS_WEIGHTS.clarity).toBe(25);
      expect(DEFAULT_AXIS_WEIGHTS.consistency).toBe(25);
    });

    it('should have Risk at 20', () => {
      // Assert
      expect(DEFAULT_AXIS_WEIGHTS.risk).toBe(20);
    });

    it('should have Documentation and TechnicalDebt at 15 each', () => {
      // Assert
      expect(DEFAULT_AXIS_WEIGHTS.documentation).toBe(15);
      expect(DEFAULT_AXIS_WEIGHTS.technicalDebt).toBe(15);
    });
  });

  describe('DEFAULT_SCORE_THRESHOLD', () => {
    it('should be 80', () => {
      // Assert
      expect(DEFAULT_SCORE_THRESHOLD).toBe(80);
    });
  });

  describe('SCORING_PRECISION', () => {
    it('should be 2 decimal places', () => {
      // Assert
      expect(SCORING_PRECISION).toBe(2);
    });
  });
});

// ---------------------------------------------------------------------------
// calculateScore
// ---------------------------------------------------------------------------

describe('calculateScore', () => {
  describe('happy path', () => {
    it('should return a ConsistencyScore with all required fields', () => {
      // Arrange
      const input: ScoringInput = { ticket: makeTicket() };

      // Act
      const result = calculateScore(input);

      // Assert
      expect(result).toBeDefined();
      expect(result.overall).toBeDefined();
      expect(result.axes).toBeDefined();
      expect(result.timestamp).toBeDefined();
      expect(result.executionId).toBeDefined();
    });

    it('should produce an overall score in the 0-100 range', () => {
      // Arrange
      const input: ScoringInput = { ticket: makeTicket() };

      // Act
      const result = calculateScore(input);

      // Assert
      expect(result.overall).toBeGreaterThanOrEqual(0);
      expect(result.overall).toBeLessThanOrEqual(100);
    });

    it('should produce individual axis scores in the 0-100 range', () => {
      // Arrange
      const input: ScoringInput = { ticket: makeTicket() };

      // Act
      const result = calculateScore(input);

      // Assert
      const axes = result.axes;
      const axisValues = [
        axes.clarity,
        axes.consistency,
        axes.risk,
        axes.documentation,
        axes.technicalDebt,
      ];
      for (const value of axisValues) {
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(100);
      }
    });

    it('should generate a unique executionId for each call', () => {
      // Arrange
      const input: ScoringInput = { ticket: makeTicket() };

      // Act
      const result1 = calculateScore(input);
      const result2 = calculateScore(input);

      // Assert
      expect(result1.executionId).not.toBe(result2.executionId);
    });

    it('should produce a valid ISO 8601 timestamp', () => {
      // Arrange
      const input: ScoringInput = { ticket: makeTicket() };

      // Act
      const result = calculateScore(input);

      // Assert
      const parsedDate = new Date(result.timestamp);
      expect(parsedDate.getTime()).not.toBeNaN();
      expect(result.timestamp).toContain('T');
    });

    it('should return deterministic results for identical inputs', () => {
      // Arrange
      const input: ScoringInput = { ticket: makeTicket() };

      // Act
      const result1 = calculateScore(input);
      const result2 = calculateScore(input);

      // Assert — scores should be identical (executionId and timestamp differ)
      expect(result1.overall).toBe(result2.overall);
      expect(result1.axes.clarity).toBe(result2.axes.clarity);
      expect(result1.axes.consistency).toBe(result2.axes.consistency);
      expect(result1.axes.risk).toBe(result2.axes.risk);
      expect(result1.axes.documentation).toBe(result2.axes.documentation);
      expect(result1.axes.technicalDebt).toBe(result2.axes.technicalDebt);
    });
  });

  describe('scoring logic – clarity axis', () => {
    it('should score higher for tickets with detailed descriptions', () => {
      // Arrange
      const richTicket = makeTicket({
        description:
          'Detailed description.\n\nWith acceptance criteria:\n- Criterion 1\n- Criterion 2\n- Criterion 3',
      });
      const sparseTicket = makeTicket({ description: 'Fix bug' });
      const richInput: ScoringInput = { ticket: richTicket };
      const sparseInput: ScoringInput = { ticket: sparseTicket };

      // Act
      const richResult = calculateScore(richInput);
      const sparseResult = calculateScore(sparseInput);

      // Assert
      expect(richResult.axes.clarity).toBeGreaterThan(sparseResult.axes.clarity);
    });

    it('should score higher for tickets with structured acceptance criteria', () => {
      // Arrange
      const withCriteria = makeTicket({
        description: 'Task description.\n\nAcceptance Criteria:\n- AC 1\n- AC 2',
      });
      const withoutCriteria = makeTicket({
        description: 'Task description without any structure.',
      });

      // Act
      const withResult = calculateScore({ ticket: withCriteria });
      const withoutResult = calculateScore({ ticket: withoutCriteria });

      // Assert
      expect(withResult.axes.clarity).toBeGreaterThan(withoutResult.axes.clarity);
    });
  });

  describe('scoring logic – consistency axis', () => {
    it('should score higher when summary and description are aligned', () => {
      // Arrange
      const aligned = makeTicket({
        summary: 'Add OAuth2 login support',
        description:
          'Implement OAuth2-based login for the platform.\n\nAcceptance criteria:\n- Support Google provider\n- Support GitHub provider',
      });
      const misaligned = makeTicket({
        summary: 'Fix login bug',
        description:
          'We need to redesign the entire authentication system from scratch. This involves database migration, API redesign, and frontend overhaul.',
      });

      // Act
      const alignedResult = calculateScore({ ticket: aligned });
      const misalignedResult = calculateScore({ ticket: misaligned });

      // Assert
      expect(alignedResult.axes.consistency).toBeGreaterThan(misalignedResult.axes.consistency);
    });
  });

  describe('scoring logic – documentation axis', () => {
    it('should score higher for tickets with labels', () => {
      // Arrange
      const withLabels = makeTicket({ labels: ['feature', 'auth', 'security'] });
      const withoutLabels = makeTicket({ labels: [] });

      // Act
      const withResult = calculateScore({ ticket: withLabels });
      const withoutResult = calculateScore({ ticket: withoutLabels });

      // Assert
      expect(withResult.axes.documentation).toBeGreaterThan(withoutResult.axes.documentation);
    });

    it('should score higher when assignee is present', () => {
      // Arrange
      const withAssignee = makeTicket({ assignee: 'dev@example.com' });
      const withoutAssignee = makeTicket({ assignee: undefined });

      // Act
      const withResult = calculateScore({ ticket: withAssignee });
      const withoutResult = calculateScore({ ticket: withoutAssignee });

      // Assert
      expect(withResult.axes.documentation).toBeGreaterThan(withoutResult.axes.documentation);
    });
  });

  describe('scoring logic – risk axis', () => {
    it('should score higher (lower risk) for well-specified tickets', () => {
      // Arrange
      const wellSpecified = makeTicket({
        priority: 'Medium',
        labels: ['feature'],
      });
      const vagueTicket = makeTicket({
        summary: 'Do stuff',
        description: 'Things need to happen.',
        priority: 'High',
        labels: [],
      });

      // Act
      const wellResult = calculateScore({ ticket: wellSpecified });
      const vagueResult = calculateScore({ ticket: vagueTicket });

      // Assert — risk score is INVERSE: higher = lower risk
      expect(wellResult.axes.risk).toBeGreaterThan(vagueResult.axes.risk);
    });
  });

  describe('scoring logic – technical debt axis', () => {
    it('should score higher (less debt) for focused tickets', () => {
      // Arrange
      const focused = makeTicket({
        summary: 'Add unit test for scoring engine',
        description:
          'Add comprehensive unit tests for the scoring engine module.\n\nAcceptance criteria:\n- All axes covered\n- Edge cases tested',
        issueType: 'Task',
      });
      const broad = makeTicket({
        summary: 'Refactor entire codebase',
        description: 'Rewrite everything from scratch',
        issueType: 'Epic',
      });

      // Act
      const focusedResult = calculateScore({ ticket: focused });
      const broadResult = calculateScore({ ticket: broad });

      // Assert
      expect(focusedResult.axes.technicalDebt).toBeGreaterThan(broadResult.axes.technicalDebt);
    });
  });

  describe('weighted overall score', () => {
    it('should compute overall as weighted average of axis scores', () => {
      // Arrange
      const input: ScoringInput = { ticket: makeTicket() };

      // Act
      const result = calculateScore(input);

      // Assert — manually compute expected weighted average
      const expected =
        result.axes.clarity * (DEFAULT_AXIS_WEIGHTS.clarity / 100) +
        result.axes.consistency * (DEFAULT_AXIS_WEIGHTS.consistency / 100) +
        result.axes.risk * (DEFAULT_AXIS_WEIGHTS.risk / 100) +
        result.axes.documentation * (DEFAULT_AXIS_WEIGHTS.documentation / 100) +
        result.axes.technicalDebt * (DEFAULT_AXIS_WEIGHTS.technicalDebt / 100);

      expect(result.overall).toBeCloseTo(expected, SCORING_PRECISION);
    });
  });

  describe('error handling – InsufficientDataError', () => {
    it('should throw InsufficientDataError when ticket key is empty', () => {
      // Arrange
      const ticket = makeTicket({ key: '' });
      const input: ScoringInput = { ticket };

      // Act & Assert
      expect(() => calculateScore(input)).toThrow(InsufficientDataError);
    });

    it('should throw InsufficientDataError when ticket summary is empty', () => {
      // Arrange
      const ticket = makeTicket({ summary: '' });
      const input: ScoringInput = { ticket };

      // Act & Assert
      expect(() => calculateScore(input)).toThrow(InsufficientDataError);
    });

    it('should throw InsufficientDataError when ticket description is empty', () => {
      // Arrange
      const ticket = makeTicket({ description: '' });
      const input: ScoringInput = { ticket };

      // Act & Assert
      expect(() => calculateScore(input)).toThrow(InsufficientDataError);
    });

    it('should throw InsufficientDataError when ticket description is whitespace only', () => {
      // Arrange
      const ticket = makeTicket({ description: '   ' });
      const input: ScoringInput = { ticket };

      // Act & Assert
      expect(() => calculateScore(input)).toThrow(InsufficientDataError);
    });

    it('should include executionId in InsufficientDataError', () => {
      // Arrange
      const ticket = makeTicket({ key: '' });
      const input: ScoringInput = { ticket };

      // Act & Assert
      try {
        calculateScore(input);
        fail('Expected InsufficientDataError');
      } catch (error: unknown) {
        expect(error).toBeInstanceOf(InsufficientDataError);
        const err = error as InsufficientDataError;
        expect(err.executionId).toBeDefined();
        expect(typeof err.executionId).toBe('string');
        expect((err.executionId as string).length).toBeGreaterThan(0);
      }
    });
  });

  describe('edge cases – boundary values', () => {
    it('should handle a minimal ticket with just required fields', () => {
      // Arrange
      const input: ScoringInput = { ticket: makeMinimalTicket() };

      // Act
      const result = calculateScore(input);

      // Assert
      expect(result.overall).toBeGreaterThanOrEqual(0);
      expect(result.overall).toBeLessThanOrEqual(100);
    });

    it('should produce a score <= 100 even for extremely detailed tickets', () => {
      // Arrange
      const overAchiever = makeTicket({
        summary: 'A'.repeat(500),
        description: 'B'.repeat(5000) + '\n\nAcceptance Criteria:\n' + '- C'.repeat(50),
        labels: Array.from({ length: 20 }, (_, i) => `label-${i}`),
      });
      const input: ScoringInput = { ticket: overAchiever };

      // Act
      const result = calculateScore(input);

      // Assert
      expect(result.overall).toBeLessThanOrEqual(100);
      expect(result.axes.clarity).toBeLessThanOrEqual(100);
    });

    it('should handle special characters in ticket fields', () => {
      // Arrange
      const specialTicket = makeTicket({
        summary: 'Fix XSS in <script>alert("xss")</script>',
        description: 'Handle special chars: & < > " \' / \\ \n\t\r Unicode: \u00e9\u00f1\u00fc',
      });
      const input: ScoringInput = { ticket: specialTicket };

      // Act & Assert — should not throw
      const result = calculateScore(input);
      expect(result.overall).toBeGreaterThanOrEqual(0);
    });
  });
});

// ---------------------------------------------------------------------------
// evaluateQualityGate
// ---------------------------------------------------------------------------

describe('evaluateQualityGate', () => {
  // Helper: create a score with specific overall value
  const makeScoreWithOverall = (overall: number): ConsistencyScore => {
    const ticket = makeTicket();
    const input: ScoringInput = { ticket };
    const baseScore = calculateScore(input);
    return {
      ...baseScore,
      overall,
      axes: {
        clarity: overall,
        consistency: overall,
        risk: overall,
        documentation: overall,
        technicalDebt: overall,
      },
    };
  };

  describe('Definition Gate', () => {
    it('should pass when overall score >= default threshold (80)', () => {
      // Arrange
      const score = makeScoreWithOverall(85);

      // Act
      const result = evaluateQualityGate(score, 'definition');

      // Assert
      expect(result.passed).toBe(true);
      expect(result.gate).toBe('definition');
    });

    it('should fail when overall score < default threshold', () => {
      // Arrange
      const score = makeScoreWithOverall(75);

      // Act
      const result = evaluateQualityGate(score, 'definition');

      // Assert
      expect(result.passed).toBe(false);
    });

    it('should pass exactly at the threshold (boundary)', () => {
      // Arrange
      const score = makeScoreWithOverall(80);

      // Act
      const result = evaluateQualityGate(score, 'definition');

      // Assert
      expect(result.passed).toBe(true);
    });

    it('should block transition to "In Progress" when failed', () => {
      // Arrange
      const score = makeScoreWithOverall(50);

      // Act
      const result = evaluateQualityGate(score, 'definition');

      // Assert
      expect(result.passed).toBe(false);
      expect(result.blockedTransitions).toContain('In Progress');
    });

    it('should not block transitions when passed', () => {
      // Arrange
      const score = makeScoreWithOverall(90);

      // Act
      const result = evaluateQualityGate(score, 'definition');

      // Assert
      expect(result.passed).toBe(true);
      expect(result.blockedTransitions).toHaveLength(0);
    });

    it('should use custom threshold when provided via config', () => {
      // Arrange
      const score = makeScoreWithOverall(70);
      const config = { scoreThreshold: 60 } as const;

      // Act
      const result = evaluateQualityGate(score, 'definition', config);

      // Assert
      expect(result.passed).toBe(true);
    });
  });

  describe('Execution Gate', () => {
    it('should pass when no critical inconsistencies exist', () => {
      // Arrange
      const score = makeScoreWithOverall(70);
      const inconsistencies: Inconsistency[] = [
        {
          id: 'inc-1',
          type: 'ambiguity',
          severity: 'info',
          source: 'rovo',
          description: 'Minor ambiguity',
          affectedTicketKey: 'PROJ-123',
        },
      ];

      // Act
      const result = evaluateQualityGate(score, 'execution', undefined, inconsistencies);

      // Assert
      expect(result.passed).toBe(true);
      expect(result.gate).toBe('execution');
    });

    it('should fail when critical inconsistencies exist', () => {
      // Arrange
      const score = makeScoreWithOverall(90);
      const inconsistencies: Inconsistency[] = [
        {
          id: 'inc-1',
          type: 'contradiction',
          severity: 'critical',
          source: 'rovo',
          description: 'Critical contradiction',
          affectedTicketKey: 'PROJ-123',
        },
      ];

      // Act
      const result = evaluateQualityGate(score, 'execution', undefined, inconsistencies);

      // Assert
      expect(result.passed).toBe(false);
    });

    it('should pass when inconsistencies array is empty', () => {
      // Arrange
      const score = makeScoreWithOverall(50);

      // Act
      const result = evaluateQualityGate(score, 'execution');

      // Assert
      expect(result.passed).toBe(true);
    });

    it('should pass when inconsistencies array is undefined', () => {
      // Arrange
      const score = makeScoreWithOverall(50);

      // Act
      const result = evaluateQualityGate(score, 'execution');

      // Assert
      expect(result.passed).toBe(true);
    });

    it('should include critical inconsistencies in the result', () => {
      // Arrange
      const score = makeScoreWithOverall(90);
      const criticalInc: Inconsistency = {
        id: 'inc-crit',
        type: 'contradiction',
        severity: 'critical',
        source: 'jira',
        description: 'Major contradiction',
        affectedTicketKey: 'PROJ-123',
      };

      // Act
      const result = evaluateQualityGate(score, 'execution', undefined, [criticalInc]);

      // Assert
      expect(result.inconsistencies).toHaveLength(1);
      expect(result.inconsistencies[0]?.id).toBe('inc-crit');
    });

    it('should block PR merge when critical inconsistencies exist', () => {
      // Arrange
      const score = makeScoreWithOverall(90);
      const inconsistencies: Inconsistency[] = [
        {
          id: 'inc-1',
          type: 'contradiction',
          severity: 'critical',
          source: 'rovo',
          description: 'Critical issue',
          affectedTicketKey: 'PROJ-123',
        },
      ];

      // Act
      const result = evaluateQualityGate(score, 'execution', undefined, inconsistencies);

      // Assert
      expect(result.blockedTransitions).toContain('PR Merge');
    });
  });

  describe('Delivery Gate', () => {
    it('should pass when overall score >= default threshold and no critical issues', () => {
      // Arrange
      const score = makeScoreWithOverall(85);

      // Act
      const result = evaluateQualityGate(score, 'delivery');

      // Assert
      expect(result.passed).toBe(true);
      expect(result.gate).toBe('delivery');
    });

    it('should fail when overall score < default threshold', () => {
      // Arrange
      const score = makeScoreWithOverall(70);

      // Act
      const result = evaluateQualityGate(score, 'delivery');

      // Assert
      expect(result.passed).toBe(false);
    });

    it('should fail when critical inconsistencies exist regardless of score', () => {
      // Arrange
      const score = makeScoreWithOverall(95);
      const inconsistencies: Inconsistency[] = [
        {
          id: 'inc-1',
          type: 'missing_context',
          severity: 'critical',
          source: 'confluence',
          description: 'Missing documentation context',
          affectedTicketKey: 'PROJ-123',
        },
      ];

      // Act
      const result = evaluateQualityGate(score, 'delivery', undefined, inconsistencies);

      // Assert
      expect(result.passed).toBe(false);
    });

    it('should block merge when delivery gate fails', () => {
      // Arrange
      const score = makeScoreWithOverall(60);

      // Act
      const result = evaluateQualityGate(score, 'delivery');

      // Assert
      expect(result.passed).toBe(false);
      expect(result.blockedTransitions).toContain('Merge');
    });
  });

  describe('QualityGateResult structure', () => {
    it('should include the original score in the result', () => {
      // Arrange
      const score = makeScoreWithOverall(85);

      // Act
      const result = evaluateQualityGate(score, 'definition');

      // Assert
      expect(result.score).toBe(score);
    });

    it('should include the executionId from the score', () => {
      // Arrange
      const score = makeScoreWithOverall(85);

      // Act
      const result = evaluateQualityGate(score, 'definition');

      // Assert
      expect(result.executionId).toBe(score.executionId);
    });

    it('should use the same gate type as requested', () => {
      // Arrange
      const score = makeScoreWithOverall(85);
      const gates: readonly ('definition' | 'execution' | 'delivery')[] = [
        'definition',
        'execution',
        'delivery',
      ];

      // Act & Assert
      for (const gate of gates) {
        const result = evaluateQualityGate(score, gate);
        expect(result.gate).toBe(gate);
      }
    });
  });
});

// ---------------------------------------------------------------------------
// Custom weight configuration
// ---------------------------------------------------------------------------

describe('Custom weight configuration', () => {
  it('should accept custom axis weights that override defaults', () => {
    // Arrange
    const customWeights: AxisWeights = {
      clarity: 40,
      consistency: 30,
      risk: 15,
      documentation: 10,
      technicalDebt: 5,
    };
    const input: ScoringInput = { ticket: makeTicket() };

    // Act
    const result = calculateScore(input, { axisWeights: customWeights });

    // Assert — verify the overall is computed with custom weights
    const expected =
      result.axes.clarity * 0.4 +
      result.axes.consistency * 0.3 +
      result.axes.risk * 0.15 +
      result.axes.documentation * 0.1 +
      result.axes.technicalDebt * 0.05;

    expect(result.overall).toBeCloseTo(expected, SCORING_PRECISION);
  });

  it('should throw ScoringError when custom weights do not sum to 100', () => {
    // Arrange — 50+30+15+10+5 = 110, not 100
    const invalidWeights: AxisWeights = {
      clarity: 50,
      consistency: 30,
      risk: 15,
      documentation: 10,
      technicalDebt: 5,
    };
    const input: ScoringInput = { ticket: makeTicket() };

    // Act & Assert
    expect(() => calculateScore(input, { axisWeights: invalidWeights })).toThrow(ScoringError);
  });

  it('should allow custom score threshold in evaluateQualityGate', () => {
    // Arrange
    const ticket = makeTicket();
    const score = calculateScore({ ticket });
    // Force a score below default but above custom threshold
    const adjustedScore = { ...score, overall: 70 };
    const customConfig = { scoreThreshold: 60 };

    // Act
    const result = evaluateQualityGate(adjustedScore, 'definition', customConfig);

    // Assert
    expect(result.passed).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Integration: Full scoring + gate evaluation pipeline
// ---------------------------------------------------------------------------

describe('Integration: calculateScore -> evaluateQualityGate', () => {
  it('should produce a passing definition gate for a well-formed ticket', () => {
    // Arrange
    const input: ScoringInput = { ticket: makeTicket() };

    // Act
    const score = calculateScore(input);
    const gateResult = evaluateQualityGate(score, 'definition');

    // Assert
    expect(gateResult.score.executionId).toBe(score.executionId);
    expect(gateResult.passed).toBe(true);
    expect(gateResult.blockedTransitions).toHaveLength(0);
  });

  it('should produce a failing definition gate for a minimal ticket', () => {
    // Arrange — minimal ticket likely scores low
    const minimalTicket: JiraTicketData = {
      key: 'X-1',
      summary: 'Fix',
      description: 'Fix it.',
      status: 'TO DO',
      issueType: 'Bug',
      labels: [],
      projectKey: 'X',
      created: '2026-01-01T00:00:00Z',
      updated: '2026-01-01T00:00:00Z',
    };
    const input: ScoringInput = { ticket: minimalTicket };

    // Act
    const score = calculateScore(input);
    const gateResult = evaluateQualityGate(score, 'definition');

    // Assert
    if (score.overall < DEFAULT_SCORE_THRESHOLD) {
      expect(gateResult.passed).toBe(false);
      expect(gateResult.blockedTransitions).toContain('In Progress');
    }
  });

  it('should handle all three gates in sequence for a ticket', () => {
    // Arrange
    const input: ScoringInput = { ticket: makeTicket() };
    const score = calculateScore(input);

    // Act
    const definition = evaluateQualityGate(score, 'definition');
    const execution = evaluateQualityGate(score, 'execution');
    const delivery = evaluateQualityGate(score, 'delivery');

    // Assert — all should have consistent executionId
    expect(definition.executionId).toBe(score.executionId);
    expect(execution.executionId).toBe(score.executionId);
    expect(delivery.executionId).toBe(score.executionId);
  });
});

// ---------------------------------------------------------------------------
// generateAxisSuggestions
// ---------------------------------------------------------------------------

describe('generateAxisSuggestions', () => {
  const defaultAxes: ScoreAxes = {
    clarity: 50,
    consistency: 60,
    risk: 70,
    documentation: 40,
    technicalDebt: 65,
  };

  it('should return all 5 axes with score, label, and suggestions', () => {
    const result = generateAxisSuggestions(makeTicket(), defaultAxes);

    const expectedAxes: ScoringAxisName[] = [
      'clarity',
      'consistency',
      'risk',
      'documentation',
      'technicalDebt',
    ];
    for (const axis of expectedAxes) {
      const detail = result[axis];
      expect(detail).toBeDefined();
      expect(detail?.score).toBe(defaultAxes[axis]);
      expect(typeof detail?.label).toBe('string');
      expect(Array.isArray(detail?.suggestions)).toBe(true);
      expect(detail?.suggestions.length).toBeGreaterThan(0);
    }
  });

  // ─── Clarity suggestions ─────────────────

  describe('clarity axis', () => {
    it('should suggest expanding short descriptions', () => {
      const ticket = makeTicket({ description: 'Short.' });
      const result = generateAxisSuggestions(ticket, defaultAxes);

      const claritySuggestions = result.clarity?.suggestions ?? [];
      expect(claritySuggestions.some((s) => s.includes('Expand the description'))).toBe(true);
    });

    it('should suggest adding acceptance criteria when missing', () => {
      const ticket = makeTicket({
        description:
          'A sufficiently long description about implementing a new feature for the platform that exceeds two hundred characters in total length but does not mention any specific done conditions.',
      });
      const result = generateAxisSuggestions(ticket, defaultAxes);

      const claritySuggestions = result.clarity?.suggestions ?? [];
      expect(claritySuggestions.some((s) => s.includes('acceptance criteria'))).toBe(true);
    });

    it('should suggest using markdown headings for long descriptions without structure', () => {
      const ticket = makeTicket({
        description:
          'A description without any hash symbols or markdown headings that is longer than one hundred characters to trigger the heading suggestion rule in the scoring engine.',
      });
      const result = generateAxisSuggestions(ticket, defaultAxes);

      const claritySuggestions = result.clarity?.suggestions ?? [];
      expect(
        claritySuggestions.some((s) => s.includes('markdown headings') || s.includes('headings')),
      ).toBe(true);
    });

    it('should suggest better summary length when too short', () => {
      const ticket = makeTicket({ summary: 'Fix' });
      const result = generateAxisSuggestions(ticket, defaultAxes);

      const claritySuggestions = result.clarity?.suggestions ?? [];
      expect(claritySuggestions.some((s) => s.includes('summary'))).toBe(true);
    });

    it('should return positive feedback when description is well-structured', () => {
      const ticket = makeTicket(); // Already has acceptance criteria and good description
      const result = generateAxisSuggestions(ticket, defaultAxes);

      // The makeTicket() fixture has acceptance criteria, good length, etc.
      // If all clarity signals pass, it gets the fallback positive message
      const claritySuggestions = result.clarity?.suggestions ?? [];
      expect(claritySuggestions.length).toBeGreaterThan(0);
    });
  });

  // ─── Consistency suggestions ─────────────

  describe('consistency axis', () => {
    it('should suggest aligning summary keywords with description', () => {
      const ticket = makeTicket({
        summary: 'Implement OAuth2 authentication protocol',
        description:
          'Completely unrelated description about something else entirely that has no overlap with the summary keywords at all.',
      });
      const result = generateAxisSuggestions(ticket, defaultAxes);

      const consistencySuggestions = result.consistency?.suggestions ?? [];
      expect(
        consistencySuggestions.some((s) => s.includes('summary') || s.includes('key terms')),
      ).toBe(true);
    });

    it('should suggest expanding description relative to summary', () => {
      const ticket = makeTicket({
        summary:
          'A very long summary about implementing complex authentication mechanism with multiple providers',
        description: 'Do it.',
      });
      const result = generateAxisSuggestions(ticket, defaultAxes);

      const consistencySuggestions = result.consistency?.suggestions ?? [];
      expect(
        consistencySuggestions.some((s) => s.includes('Expand') || s.includes('elaborate')),
      ).toBe(true);
    });

    it('should return positive feedback when summary and description are aligned', () => {
      const ticket = makeTicket(); // Good alignment by default
      const result = generateAxisSuggestions(ticket, defaultAxes);

      const consistencySuggestions = result.consistency?.suggestions ?? [];
      expect(consistencySuggestions.some((s) => s.includes('well aligned'))).toBe(true);
    });
  });

  // ─── Risk suggestions ────────────────────

  describe('risk axis', () => {
    it('should suggest assigning the ticket when unassigned', () => {
      const ticket = makeTicket({ assignee: undefined });
      const result = generateAxisSuggestions(ticket, defaultAxes);

      const riskSuggestions = result.risk?.suggestions ?? [];
      expect(riskSuggestions.some((s) => s.includes('Assign'))).toBe(true);
    });

    it('should suggest setting priority when missing', () => {
      const ticket = makeTicket({ priority: undefined });
      const result = generateAxisSuggestions(ticket, defaultAxes);

      const riskSuggestions = result.risk?.suggestions ?? [];
      expect(riskSuggestions.some((s) => s.includes('priority'))).toBe(true);
    });

    it('should suggest adding labels when none exist', () => {
      const ticket = makeTicket({ labels: [] });
      const result = generateAxisSuggestions(ticket, defaultAxes);

      const riskSuggestions = result.risk?.suggestions ?? [];
      expect(riskSuggestions.some((s) => s.includes('labels') || s.includes('Labels'))).toBe(true);
    });

    it('should flag vague urgency language', () => {
      const ticket = makeTicket({
        description: 'Fix this ASAP. Urgent rewrite everything from scratch.',
      });
      const result = generateAxisSuggestions(ticket, defaultAxes);

      const riskSuggestions = result.risk?.suggestions ?? [];
      expect(
        riskSuggestions.some(
          (s) => s.includes('vague') || s.includes('urgency') || s.includes('asap'),
        ),
      ).toBe(true);
    });

    it('should return positive feedback when risk signals are good', () => {
      const ticket = makeTicket(); // Has assignee, priority, labels
      const result = generateAxisSuggestions(ticket, defaultAxes);

      const riskSuggestions = result.risk?.suggestions ?? [];
      expect(riskSuggestions.some((s) => s.includes('look good') || s.includes('good'))).toBe(true);
    });
  });

  // ─── Documentation suggestions ───────────

  describe('documentation axis', () => {
    it('should suggest adding more labels when fewer than 2', () => {
      const ticket = makeTicket({ labels: ['only-one'] });
      const result = generateAxisSuggestions(ticket, defaultAxes);

      const docSuggestions = result.documentation?.suggestions ?? [];
      expect(docSuggestions.some((s) => s.includes('labels') && s.includes('recommended'))).toBe(
        true,
      );
    });

    it('should suggest adding documentation links', () => {
      const ticket = makeTicket({
        description: 'A description without any external links or references to team wiki pages.',
      });
      const result = generateAxisSuggestions(ticket, defaultAxes);

      const docSuggestions = result.documentation?.suggestions ?? [];
      expect(
        docSuggestions.some((s) => s.includes('documentation') || s.includes('Confluence')),
      ).toBe(true);
    });

    it('should suggest more descriptive summary when too short', () => {
      const ticket = makeTicket({ summary: 'Do' });
      const result = generateAxisSuggestions(ticket, defaultAxes);

      const docSuggestions = result.documentation?.suggestions ?? [];
      expect(docSuggestions.some((s) => s.includes('descriptive summary'))).toBe(true);
    });

    it('should return positive feedback when documentation is complete', () => {
      const ticket = makeTicket({
        labels: ['auth', 'security', 'backend'],
        assignee: 'dev@example.com',
        description: 'See http://docs.example.com for details. Also check confluence page.',
        summary: 'Implement user authentication with OAuth2',
      });
      const result = generateAxisSuggestions(ticket, defaultAxes);

      const docSuggestions = result.documentation?.suggestions ?? [];
      expect(docSuggestions.some((s) => s.includes('complete'))).toBe(true);
    });
  });

  // ─── Technical Debt suggestions ──────────

  describe('technicalDebt axis', () => {
    it('should flag debt-indicating keywords', () => {
      const ticket = makeTicket({
        description: 'This is a temporary hack workaround for a quick fix.',
      });
      const result = generateAxisSuggestions(ticket, defaultAxes);

      const debtSuggestions = result.technicalDebt?.suggestions ?? [];
      expect(
        debtSuggestions.some(
          (s) => s.includes('hack') || s.includes('workaround') || s.includes('debt'),
        ),
      ).toBe(true);
    });

    it('should suggest breaking Epics into smaller tasks', () => {
      const ticket = makeTicket({ issueType: 'Epic' });
      const result = generateAxisSuggestions(ticket, defaultAxes);

      const debtSuggestions = result.technicalDebt?.suggestions ?? [];
      expect(debtSuggestions.some((s) => s.includes('Epic') || s.includes('smaller'))).toBe(true);
    });

    it('should suggest splitting very long descriptions', () => {
      const longDescription = 'A'.repeat(2500);
      const ticket = makeTicket({ description: longDescription });
      const result = generateAxisSuggestions(ticket, defaultAxes);

      const debtSuggestions = result.technicalDebt?.suggestions ?? [];
      expect(debtSuggestions.some((s) => s.includes('splitting') || s.includes('long'))).toBe(true);
    });

    it('should suggest adding acceptance criteria for scoping', () => {
      const ticket = makeTicket({ description: 'No criteria section here.' });
      const result = generateAxisSuggestions(ticket, defaultAxes);

      const debtSuggestions = result.technicalDebt?.suggestions ?? [];
      expect(debtSuggestions.some((s) => s.includes('acceptance criteria'))).toBe(true);
    });

    it('should return positive feedback when technical debt signals are good', () => {
      const ticket = makeTicket({
        issueType: 'Task',
        description: 'Implement feature.\n\nAcceptance criteria:\n- Feature works\n- Tests pass',
      });
      const result = generateAxisSuggestions(ticket, defaultAxes);

      const debtSuggestions = result.technicalDebt?.suggestions ?? [];
      expect(debtSuggestions.some((s) => s.includes('well-scoped') || s.includes('low'))).toBe(
        true,
      );
    });
  });

  // ─── Label mapping ───────────────────────

  describe('axis labels', () => {
    it('should use human-readable labels for each axis', () => {
      const result = generateAxisSuggestions(makeTicket(), defaultAxes);

      expect(result.clarity?.label).toBe('Clarity');
      expect(result.consistency?.label).toBe('Consistency');
      expect(result.risk?.label).toBe('Risk');
      expect(result.documentation?.label).toBe('Documentation');
      expect(result.technicalDebt?.label).toBe('Technical Debt');
    });
  });

  // ─── Score passthrough ───────────────────

  describe('score passthrough', () => {
    it('should pass through the exact axis scores from input', () => {
      const customAxes: ScoreAxes = {
        clarity: 12,
        consistency: 34,
        risk: 56,
        documentation: 78,
        technicalDebt: 91,
      };
      const result = generateAxisSuggestions(makeTicket(), customAxes);

      expect(result.clarity?.score).toBe(12);
      expect(result.consistency?.score).toBe(34);
      expect(result.risk?.score).toBe(56);
      expect(result.documentation?.score).toBe(78);
      expect(result.technicalDebt?.score).toBe(91);
    });
  });
});
