// Test suite for QualityGateResult and GateType domain types
// Covers: GateType enum, QualityGateResult interface, cross-type integration
// Tests: happy path, failing gate, edge cases, discriminated union narrowing

import type { GateType, QualityGateResult } from '../../../src/backend/types/quality-gate';
import type { ConsistencyScore } from '../../../src/backend/types/consistency-score';
import type { Inconsistency } from '../../../src/backend/types/inconsistency';

// Helper factory for creating valid ConsistencyScore objects
function createTestScore(overrides?: Partial<ConsistencyScore>): ConsistencyScore {
  return {
    overall: 0.85,
    axes: {
      clarity: 0.9,
      consistency: 0.8,
      risk: 0.85,
      documentation: 0.9,
      technicalDebt: 0.7,
    },
    timestamp: '2026-04-05T10:00:00Z',
    executionId: 'exec-gate-test',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// GateType
// ---------------------------------------------------------------------------

describe('GateType', () => {
  it('should accept all three valid gate types', () => {
    // Arrange
    const gateTypes: GateType[] = ['definition', 'execution', 'delivery'];

    // Act & Assert
    expect(gateTypes).toHaveLength(3);
    expect(gateTypes).toContain('definition');
    expect(gateTypes).toContain('execution');
    expect(gateTypes).toContain('delivery');
  });

  it('should assign individual gate type values', () => {
    // Arrange & Act
    const definition: GateType = 'definition';
    const execution: GateType = 'execution';
    const delivery: GateType = 'delivery';

    // Assert
    expect(definition).toBe('definition');
    expect(execution).toBe('execution');
    expect(delivery).toBe('delivery');
  });
});

// ---------------------------------------------------------------------------
// QualityGateResult
// ---------------------------------------------------------------------------

describe('QualityGateResult', () => {
  describe('happy path – passing gate', () => {
    it('should accept a passing definition gate result with no inconsistencies', () => {
      // Arrange
      const score = createTestScore();

      // Act
      const result: QualityGateResult = {
        gate: 'definition',
        passed: true,
        score,
        inconsistencies: [],
        blockedTransitions: [],
        executionId: 'exec-gate-001',
      };

      // Assert
      expect(result.gate).toBe('definition');
      expect(result.passed).toBe(true);
      expect(result.score.overall).toBe(0.85);
      expect(result.inconsistencies).toHaveLength(0);
      expect(result.blockedTransitions).toHaveLength(0);
      expect(result.executionId).toBe('exec-gate-001');
    });

    it('should accept a passing execution gate result', () => {
      // Arrange
      const score = createTestScore({ overall: 0.95 });

      // Act
      const result: QualityGateResult = {
        gate: 'execution',
        passed: true,
        score,
        inconsistencies: [],
        blockedTransitions: [],
        executionId: 'exec-gate-002',
      };

      // Assert
      expect(result.gate).toBe('execution');
      expect(result.passed).toBe(true);
    });
  });

  describe('failing gate with inconsistencies', () => {
    it('should accept a failing gate result with inconsistencies and blocked transitions', () => {
      // Arrange
      const score = createTestScore({ overall: 0.45 });
      const inconsistencies: readonly Inconsistency[] = [
        {
          id: 'inc-001',
          type: 'contradiction',
          severity: 'warning',
          source: 'jira',
          description: 'Minor contradiction in description',
          affectedTicketKey: 'PROJ-100',
        },
      ];

      // Act
      const result: QualityGateResult = {
        gate: 'execution',
        passed: false,
        score,
        inconsistencies,
        blockedTransitions: ['transition-1', 'transition-2'],
        executionId: 'exec-gate-003',
      };

      // Assert
      expect(result.passed).toBe(false);
      expect(result.score.overall).toBe(0.45);
      expect(result.inconsistencies).toHaveLength(1);
      expect(result.inconsistencies[0]?.type).toBe('contradiction');
      expect(result.blockedTransitions).toEqual(['transition-1', 'transition-2']);
    });

    it('should accept a failing gate with multiple inconsistencies', () => {
      // Arrange
      const inconsistencies: readonly Inconsistency[] = [
        {
          id: 'inc-a',
          type: 'contradiction',
          severity: 'critical',
          source: 'jira',
          description: 'A',
          affectedTicketKey: 'P-1',
        },
        {
          id: 'inc-b',
          type: 'duplicate',
          severity: 'warning',
          source: 'github',
          description: 'B',
          affectedTicketKey: 'P-2',
        },
        {
          id: 'inc-c',
          type: 'missing_context',
          severity: 'info',
          source: 'confluence',
          description: 'C',
          affectedTicketKey: 'P-3',
        },
      ];

      // Act
      const result: QualityGateResult = {
        gate: 'delivery',
        passed: false,
        score: createTestScore({ overall: 0.3 }),
        inconsistencies,
        blockedTransitions: ['deploy'],
        executionId: 'exec-gate-multi',
      };

      // Assert
      expect(result.inconsistencies).toHaveLength(3);
      expect(result.blockedTransitions).toEqual(['deploy']);
    });
  });

  describe('edge cases', () => {
    it('should accept a result with empty inconsistencies but failed status', () => {
      // Arrange & Act
      const result: QualityGateResult = {
        gate: 'definition',
        passed: false,
        score: createTestScore({ overall: 0.5 }),
        inconsistencies: [],
        blockedTransitions: [],
        executionId: 'exec-fail-empty',
      };

      // Assert – a gate can fail even without inconsistencies (e.g. score too low)
      expect(result.passed).toBe(false);
      expect(result.inconsistencies).toHaveLength(0);
    });

    it('should accept a result with inconsistencies but passed status', () => {
      // Arrange & Act
      const result: QualityGateResult = {
        gate: 'execution',
        passed: true,
        score: createTestScore(),
        inconsistencies: [
          {
            id: 'inc-info',
            type: 'ambiguity',
            severity: 'info',
            source: 'rovo',
            description: 'minor',
            affectedTicketKey: 'P-1',
          },
        ],
        blockedTransitions: [],
        executionId: 'exec-pass-with-info',
      };

      // Assert – a gate can pass with info-level inconsistencies
      expect(result.passed).toBe(true);
      expect(result.inconsistencies).toHaveLength(1);
    });

    it('should accept empty string executionId', () => {
      // Arrange & Act
      const result: QualityGateResult = {
        gate: 'delivery',
        passed: true,
        score: createTestScore(),
        inconsistencies: [],
        blockedTransitions: [],
        executionId: '',
      };

      // Assert
      expect(result.executionId).toBe('');
    });
  });

  describe('discriminated union narrowing by gate type', () => {
    it('should narrow by gate field in a conditional', () => {
      // Arrange
      const result: QualityGateResult = {
        gate: 'delivery',
        passed: true,
        score: createTestScore(),
        inconsistencies: [],
        blockedTransitions: [],
        executionId: 'exec-narrow',
      };

      // Act & Assert
      if (result.gate === 'delivery') {
        expect(result.gate).toBe('delivery');
      } else {
        fail('Expected gate narrowing to match delivery');
      }
    });

    it('should support filtering an array of results by gate type', () => {
      // Arrange
      const results: readonly QualityGateResult[] = [
        {
          gate: 'definition',
          passed: true,
          score: createTestScore(),
          inconsistencies: [],
          blockedTransitions: [],
          executionId: 'e1',
        },
        {
          gate: 'execution',
          passed: false,
          score: createTestScore(),
          inconsistencies: [],
          blockedTransitions: ['t1'],
          executionId: 'e2',
        },
        {
          gate: 'definition',
          passed: false,
          score: createTestScore(),
          inconsistencies: [],
          blockedTransitions: [],
          executionId: 'e3',
        },
      ];

      // Act
      const definitionResults = results.filter((r) => r.gate === 'definition');

      // Assert
      expect(definitionResults).toHaveLength(2);
    });
  });

  describe('integration – cross-module dependencies', () => {
    it('should embed ConsistencyScore and Inconsistency correctly', () => {
      // Arrange
      const score: ConsistencyScore = createTestScore();
      const inconsistency: Inconsistency = {
        id: 'inc-cross',
        type: 'contradiction',
        severity: 'critical',
        source: 'jira',
        description: 'Cross-module test',
        affectedTicketKey: 'PROJ-CROSS',
        relatedDocs: ['doc-1'],
        suggestion: 'Fix the contradiction',
      };

      // Act
      const result: QualityGateResult = {
        gate: 'execution',
        passed: false,
        score,
        inconsistencies: [inconsistency],
        blockedTransitions: ['transition-cross'],
        executionId: 'exec-cross',
      };

      // Assert
      expect(result.score.axes.clarity).toBe(0.9);
      expect(result.inconsistencies[0]?.suggestion).toBe('Fix the contradiction');
      expect(result.inconsistencies[0]?.relatedDocs).toEqual(['doc-1']);
    });
  });
});
