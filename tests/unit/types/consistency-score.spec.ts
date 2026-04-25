// Test suite for ScoreAxes and ConsistencyScore domain types
// Covers: valid construction, boundary values, nested structure, readonly enforcement

import type { ScoreAxes, ConsistencyScore } from '../../../src/backend/types/consistency-score';

// ---------------------------------------------------------------------------
// ScoreAxes
// ---------------------------------------------------------------------------

describe('ScoreAxes', () => {
  describe('happy path – valid construction', () => {
    it('should accept a valid ScoreAxes object with all five axes', () => {
      // Arrange & Act
      const axes: ScoreAxes = {
        clarity: 0.8,
        consistency: 0.9,
        risk: 0.3,
        documentation: 0.7,
        technicalDebt: 0.4,
      };

      // Assert
      expect(axes.clarity).toBe(0.8);
      expect(axes.consistency).toBe(0.9);
      expect(axes.risk).toBe(0.3);
      expect(axes.documentation).toBe(0.7);
      expect(axes.technicalDebt).toBe(0.4);
    });

    it('should allow fractional values for all axes', () => {
      // Arrange & Act
      const axes: ScoreAxes = {
        clarity: 0.123,
        consistency: 0.456,
        risk: 0.789,
        documentation: 0.999,
        technicalDebt: 0.001,
      };

      // Assert
      expect(axes.clarity).toBeCloseTo(0.123);
      expect(axes.consistency).toBeCloseTo(0.456);
      expect(axes.risk).toBeCloseTo(0.789);
      expect(axes.documentation).toBeCloseTo(0.999);
      expect(axes.technicalDebt).toBeCloseTo(0.001);
    });
  });

  describe('edge cases – boundary values', () => {
    it('should allow zero values for all axes', () => {
      // Arrange & Act
      const axes: ScoreAxes = {
        clarity: 0,
        consistency: 0,
        risk: 0,
        documentation: 0,
        technicalDebt: 0,
      };

      // Assert
      expect(axes.clarity).toBe(0);
      expect(axes.consistency).toBe(0);
      expect(axes.risk).toBe(0);
      expect(axes.documentation).toBe(0);
      expect(axes.technicalDebt).toBe(0);
    });

    it('should allow value of 1 for all axes', () => {
      // Arrange & Act
      const axes: ScoreAxes = {
        clarity: 1,
        consistency: 1,
        risk: 1,
        documentation: 1,
        technicalDebt: 1,
      };

      // Assert
      expect(axes.clarity).toBe(1);
      expect(axes.consistency).toBe(1);
      expect(axes.risk).toBe(1);
      expect(axes.documentation).toBe(1);
      expect(axes.technicalDebt).toBe(1);
    });

    it('should allow negative values (no runtime constraint)', () => {
      // Arrange & Act
      const axes: ScoreAxes = {
        clarity: -0.5,
        consistency: -1,
        risk: -0.1,
        documentation: -0.999,
        technicalDebt: -1,
      };

      // Assert
      expect(axes.clarity).toBe(-0.5);
      expect(axes.consistency).toBe(-1);
    });

    it('should allow values greater than 1 (no runtime constraint)', () => {
      // Arrange & Act
      const axes: ScoreAxes = {
        clarity: 1.5,
        consistency: 2,
        risk: 100,
        documentation: 3.14,
        technicalDebt: 42,
      };

      // Assert
      expect(axes.clarity).toBe(1.5);
      expect(axes.consistency).toBe(2);
      expect(axes.risk).toBe(100);
    });
  });

  describe('readonly properties', () => {
    it('should have all properties defined after construction', () => {
      // Arrange
      const axes: ScoreAxes = {
        clarity: 0.5,
        consistency: 0.6,
        risk: 0.7,
        documentation: 0.8,
        technicalDebt: 0.9,
      };

      // Act
      const keys = Object.keys(axes);

      // Assert
      expect(keys).toEqual(['clarity', 'consistency', 'risk', 'documentation', 'technicalDebt']);
    });
  });
});

// ---------------------------------------------------------------------------
// ConsistencyScore
// ---------------------------------------------------------------------------

describe('ConsistencyScore', () => {
  describe('happy path – valid construction', () => {
    it('should accept a valid ConsistencyScore object with all fields', () => {
      // Arrange
      const axes: ScoreAxes = {
        clarity: 0.8,
        consistency: 0.9,
        risk: 0.7,
        documentation: 0.85,
        technicalDebt: 0.6,
      };

      // Act
      const score: ConsistencyScore = {
        overall: 0.82,
        axes,
        timestamp: '2026-04-05T10:00:00Z',
        executionId: 'exec-001',
      };

      // Assert
      expect(score.overall).toBe(0.82);
      expect(score.axes.clarity).toBe(0.8);
      expect(score.axes.consistency).toBe(0.9);
      expect(score.axes.risk).toBe(0.7);
      expect(score.axes.documentation).toBe(0.85);
      expect(score.axes.technicalDebt).toBe(0.6);
      expect(score.timestamp).toBe('2026-04-05T10:00:00Z');
      expect(score.executionId).toBe('exec-001');
    });

    it('should allow inline axes definition', () => {
      // Arrange & Act
      const score: ConsistencyScore = {
        overall: 0.5,
        axes: {
          clarity: 0.5,
          consistency: 0.5,
          risk: 0.5,
          documentation: 0.5,
          technicalDebt: 0.5,
        },
        timestamp: '2026-01-01T00:00:00Z',
        executionId: 'exec-readonly',
      };

      // Assert
      expect(score.overall).toBe(0.5);
      expect(score.axes).toEqual({
        clarity: 0.5,
        consistency: 0.5,
        risk: 0.5,
        documentation: 0.5,
        technicalDebt: 0.5,
      });
    });
  });

  describe('edge cases', () => {
    it('should accept zero overall score', () => {
      // Arrange & Act
      const score: ConsistencyScore = {
        overall: 0,
        axes: {
          clarity: 0,
          consistency: 0,
          risk: 0,
          documentation: 0,
          technicalDebt: 0,
        },
        timestamp: '2026-01-01T00:00:00Z',
        executionId: 'exec-zero',
      };

      // Assert
      expect(score.overall).toBe(0);
    });

    it('should accept perfect score of 1', () => {
      // Arrange & Act
      const score: ConsistencyScore = {
        overall: 1,
        axes: {
          clarity: 1,
          consistency: 1,
          risk: 1,
          documentation: 1,
          technicalDebt: 1,
        },
        timestamp: '2026-06-15T12:00:00Z',
        executionId: 'exec-perfect',
      };

      // Assert
      expect(score.overall).toBe(1);
    });

    it('should accept empty string executionId', () => {
      // Arrange & Act
      const score: ConsistencyScore = {
        overall: 0.5,
        axes: {
          clarity: 0.5,
          consistency: 0.5,
          risk: 0.5,
          documentation: 0.5,
          technicalDebt: 0.5,
        },
        timestamp: '',
        executionId: '',
      };

      // Assert
      expect(score.executionId).toBe('');
      expect(score.timestamp).toBe('');
    });

    it('should support deep property access on nested axes', () => {
      // Arrange
      const score: ConsistencyScore = {
        overall: 0.75,
        axes: {
          clarity: 0.6,
          consistency: 0.8,
          risk: 0.9,
          documentation: 0.7,
          technicalDebt: 0.5,
        },
        timestamp: '2026-03-20T08:30:00Z',
        executionId: 'exec-deep',
      };

      // Act
      const { clarity, consistency, risk, documentation, technicalDebt } = score.axes;

      // Assert
      expect(clarity).toBe(0.6);
      expect(consistency).toBe(0.8);
      expect(risk).toBe(0.9);
      expect(documentation).toBe(0.7);
      expect(technicalDebt).toBe(0.5);
    });
  });

  describe('integration – composing with other types', () => {
    it('should be usable as a property value in a larger object', () => {
      // Arrange
      const score: ConsistencyScore = {
        overall: 0.88,
        axes: {
          clarity: 0.9,
          consistency: 0.85,
          risk: 0.7,
          documentation: 0.95,
          technicalDebt: 0.6,
        },
        timestamp: '2026-04-05T10:00:00Z',
        executionId: 'exec-composite',
      };

      // Act – embed into a composite structure
      const composite: { score: ConsistencyScore; label: string } = {
        score,
        label: 'high-quality',
      };

      // Assert
      expect(composite.score.overall).toBe(0.88);
      expect(composite.label).toBe('high-quality');
      expect(composite.score.axes.documentation).toBe(0.95);
    });
  });
});
