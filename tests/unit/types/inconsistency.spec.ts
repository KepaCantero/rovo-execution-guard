// Test suite for Inconsistency domain types
// Covers: InconsistencyType, Severity, InconsistencySource, Inconsistency interface
// Tests: happy path, all enum values, optional fields, discriminated type narrowing

import type {
  InconsistencyType,
  Severity,
  InconsistencySource,
  Inconsistency,
} from '../../../src/backend/types/inconsistency';

// ---------------------------------------------------------------------------
// InconsistencyType
// ---------------------------------------------------------------------------

describe('InconsistencyType', () => {
  it('should accept all four valid inconsistency types', () => {
    // Arrange
    const types: InconsistencyType[] = [
      'contradiction',
      'duplicate',
      'missing_context',
      'ambiguity',
    ];

    // Act & Assert
    expect(types).toHaveLength(4);
    expect(types).toContain('contradiction');
    expect(types).toContain('duplicate');
    expect(types).toContain('missing_context');
    expect(types).toContain('ambiguity');
  });

  it('should assign a single valid value to a typed variable', () => {
    // Arrange & Act
    const t1: InconsistencyType = 'contradiction';
    const t2: InconsistencyType = 'duplicate';
    const t3: InconsistencyType = 'missing_context';
    const t4: InconsistencyType = 'ambiguity';

    // Assert
    expect(t1).toBe('contradiction');
    expect(t2).toBe('duplicate');
    expect(t3).toBe('missing_context');
    expect(t4).toBe('ambiguity');
  });
});

// ---------------------------------------------------------------------------
// Severity
// ---------------------------------------------------------------------------

describe('Severity', () => {
  it('should accept all three severity levels', () => {
    // Arrange
    const severities: Severity[] = ['critical', 'warning', 'info'];

    // Act & Assert
    expect(severities).toHaveLength(3);
    expect(severities).toContain('critical');
    expect(severities).toContain('warning');
    expect(severities).toContain('info');
  });

  it('should order from most to least severe for documentation purposes', () => {
    // Arrange
    const severityOrder: Record<Severity, number> = {
      critical: 3,
      warning: 2,
      info: 1,
    };

    // Act & Assert
    expect(severityOrder['critical']).toBeGreaterThan(severityOrder['warning']);
    expect(severityOrder['warning']).toBeGreaterThan(severityOrder['info']);
  });
});

// ---------------------------------------------------------------------------
// InconsistencySource
// ---------------------------------------------------------------------------

describe('InconsistencySource', () => {
  it('should accept all four valid sources', () => {
    // Arrange
    const sources: InconsistencySource[] = ['rovo', 'jira', 'confluence', 'github'];

    // Act & Assert
    expect(sources).toHaveLength(4);
    expect(sources).toContain('rovo');
    expect(sources).toContain('jira');
    expect(sources).toContain('confluence');
    expect(sources).toContain('github');
  });
});

// ---------------------------------------------------------------------------
// Inconsistency
// ---------------------------------------------------------------------------

describe('Inconsistency', () => {
  describe('happy path – minimal object', () => {
    it('should accept a valid Inconsistency without optional fields', () => {
      // Arrange
      const inconsistency: Inconsistency = {
        id: 'inc-001',
        type: 'contradiction',
        severity: 'critical',
        source: 'jira',
        description: 'Summary contradicts acceptance criteria',
        affectedTicketKey: 'PROJ-123',
      };

      // Assert
      expect(inconsistency.id).toBe('inc-001');
      expect(inconsistency.type).toBe('contradiction');
      expect(inconsistency.severity).toBe('critical');
      expect(inconsistency.source).toBe('jira');
      expect(inconsistency.description).toBe('Summary contradicts acceptance criteria');
      expect(inconsistency.affectedTicketKey).toBe('PROJ-123');
      expect(inconsistency.relatedDocs).toBeUndefined();
      expect(inconsistency.suggestion).toBeUndefined();
    });
  });

  describe('happy path – full object with optional fields', () => {
    it('should accept a full Inconsistency with all optional fields', () => {
      // Arrange & Act
      const inconsistency: Inconsistency = {
        id: 'inc-002',
        type: 'missing_context',
        severity: 'warning',
        source: 'confluence',
        description: 'No documentation found for this feature',
        affectedTicketKey: 'PROJ-456',
        relatedDocs: ['doc-1', 'doc-2'],
        suggestion: 'Add a Confluence page describing the feature',
      };

      // Assert
      expect(inconsistency.relatedDocs).toEqual(['doc-1', 'doc-2']);
      expect(inconsistency.suggestion).toBe('Add a Confluence page describing the feature');
    });
  });

  describe('edge cases', () => {
    it('should accept empty description string', () => {
      // Arrange & Act
      const inconsistency: Inconsistency = {
        id: 'inc-empty',
        type: 'ambiguity',
        severity: 'info',
        source: 'rovo',
        description: '',
        affectedTicketKey: 'PROJ-000',
      };

      // Assert
      expect(inconsistency.description).toBe('');
    });

    it('should accept empty relatedDocs array', () => {
      // Arrange & Act
      const inconsistency: Inconsistency = {
        id: 'inc-nodocs',
        type: 'duplicate',
        severity: 'warning',
        source: 'github',
        description: 'Duplicate ticket found',
        affectedTicketKey: 'PROJ-111',
        relatedDocs: [],
      };

      // Assert
      expect(inconsistency.relatedDocs).toEqual([]);
    });

    it('should accept empty suggestion string', () => {
      // Arrange & Act
      const inconsistency: Inconsistency = {
        id: 'inc-nosuggestion',
        type: 'contradiction',
        severity: 'critical',
        source: 'jira',
        description: 'Contradiction',
        affectedTicketKey: 'PROJ-222',
        suggestion: '',
      };

      // Assert
      expect(inconsistency.suggestion).toBe('');
    });

    it('should accept all combinations of type, severity, and source', () => {
      // Arrange
      const combinations: Array<{
        type: InconsistencyType;
        severity: Severity;
        source: InconsistencySource;
      }> = [
        { type: 'contradiction', severity: 'critical', source: 'jira' },
        { type: 'duplicate', severity: 'warning', source: 'confluence' },
        { type: 'missing_context', severity: 'info', source: 'rovo' },
        { type: 'ambiguity', severity: 'critical', source: 'github' },
      ];

      // Act & Assert
      expect(combinations).toHaveLength(4);
      for (const c of combinations) {
        expect(c.type).toBeDefined();
        expect(c.severity).toBeDefined();
        expect(c.source).toBeDefined();
      }
    });
  });

  describe('discriminated type narrowing', () => {
    it('should narrow by type field in a conditional', () => {
      // Arrange
      const inconsistency: Inconsistency = {
        id: 'inc-narrow',
        type: 'ambiguity',
        severity: 'info',
        source: 'rovo',
        description: 'Ambiguous description',
        affectedTicketKey: 'PROJ-789',
      };

      // Act & Assert
      if (inconsistency.type === 'ambiguity') {
        expect(inconsistency.type).toBe('ambiguity');
      } else {
        fail('Expected type narrowing to match ambiguity');
      }
    });

    it('should support filtering an array by type', () => {
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
          type: 'contradiction',
          severity: 'info',
          source: 'confluence',
          description: 'C',
          affectedTicketKey: 'P-3',
        },
      ];

      // Act
      const contradictions = inconsistencies.filter((i) => i.type === 'contradiction');

      // Assert
      expect(contradictions).toHaveLength(2);
      expect(contradictions.every((i) => i.type === 'contradiction')).toBe(true);
    });
  });
});
