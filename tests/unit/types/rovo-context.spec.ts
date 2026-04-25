// Test suite for RovoContext, RovoDocument, and HistoricalDecision domain types
// Covers: all interfaces, readonly arrays, edge cases, empty collections
// Tests: happy path, boundary values, nested structure access

import type {
  RovoDocument,
  HistoricalDecision,
  RovoContext,
} from '../../../src/backend/types/rovo-context';

// ---------------------------------------------------------------------------
// RovoDocument
// ---------------------------------------------------------------------------

describe('RovoDocument', () => {
  describe('happy path', () => {
    it('should accept a valid RovoDocument with all fields', () => {
      // Arrange & Act
      const doc: RovoDocument = {
        id: 'doc-001',
        title: 'Architecture Decision Record',
        content: 'We decided to use microservices...',
        source: 'confluence',
        relevance: 0.92,
      };

      // Assert
      expect(doc.id).toBe('doc-001');
      expect(doc.title).toBe('Architecture Decision Record');
      expect(doc.content).toContain('microservices');
      expect(doc.source).toBe('confluence');
      expect(doc.relevance).toBe(0.92);
    });
  });

  describe('edge cases', () => {
    it('should accept relevance of 0', () => {
      // Arrange & Act
      const doc: RovoDocument = {
        id: 'doc-low',
        title: 'Irrelevant Doc',
        content: 'Not relevant',
        source: 'jira',
        relevance: 0,
      };

      // Assert
      expect(doc.relevance).toBe(0);
    });

    it('should accept relevance of 1', () => {
      // Arrange & Act
      const doc: RovoDocument = {
        id: 'doc-high',
        title: 'Critical Doc',
        content: 'Very relevant',
        source: 'confluence',
        relevance: 1,
      };

      // Assert
      expect(doc.relevance).toBe(1);
    });

    it('should accept negative relevance (no runtime constraint)', () => {
      // Arrange & Act
      const doc: RovoDocument = {
        id: 'doc-neg',
        title: 'Negative Relevance',
        content: 'test',
        source: 'github',
        relevance: -0.5,
      };

      // Assert
      expect(doc.relevance).toBe(-0.5);
    });

    it('should accept relevance greater than 1 (no runtime constraint)', () => {
      // Arrange & Act
      const doc: RovoDocument = {
        id: 'doc-over',
        title: 'Over-Relevant',
        content: 'test',
        source: 'rovo',
        relevance: 2.5,
      };

      // Assert
      expect(doc.relevance).toBe(2.5);
    });

    it('should accept empty strings for all text fields', () => {
      // Arrange & Act
      const doc: RovoDocument = {
        id: '',
        title: '',
        content: '',
        source: '',
        relevance: 0,
      };

      // Assert
      expect(doc.id).toBe('');
      expect(doc.title).toBe('');
      expect(doc.content).toBe('');
      expect(doc.source).toBe('');
    });
  });
});

// ---------------------------------------------------------------------------
// HistoricalDecision
// ---------------------------------------------------------------------------

describe('HistoricalDecision', () => {
  describe('happy path', () => {
    it('should accept a valid HistoricalDecision', () => {
      // Arrange & Act
      const decision: HistoricalDecision = {
        id: 'dec-001',
        title: 'Use PostgreSQL for persistence',
        description: 'Team decided to use PostgreSQL over MongoDB',
        date: '2026-01-15',
        source: 'confluence',
      };

      // Assert
      expect(decision.id).toBe('dec-001');
      expect(decision.title).toBe('Use PostgreSQL for persistence');
      expect(decision.description).toContain('PostgreSQL');
      expect(decision.date).toBe('2026-01-15');
      expect(decision.source).toBe('confluence');
    });
  });

  describe('edge cases', () => {
    it('should accept empty strings for all text fields', () => {
      // Arrange & Act
      const decision: HistoricalDecision = {
        id: '',
        title: '',
        description: '',
        date: '',
        source: '',
      };

      // Assert
      expect(decision.id).toBe('');
      expect(decision.title).toBe('');
      expect(decision.description).toBe('');
      expect(decision.date).toBe('');
      expect(decision.source).toBe('');
    });

    it('should accept ISO timestamp as date string', () => {
      // Arrange & Act
      const decision: HistoricalDecision = {
        id: 'dec-ts',
        title: 'Decision with timestamp',
        description: 'desc',
        date: '2026-03-20T14:30:00Z',
        source: 'jira',
      };

      // Assert
      expect(decision.date).toBe('2026-03-20T14:30:00Z');
    });
  });
});

// ---------------------------------------------------------------------------
// RovoContext
// ---------------------------------------------------------------------------

describe('RovoContext', () => {
  describe('happy path – full context', () => {
    it('should accept a valid RovoContext with all fields populated', () => {
      // Arrange
      const doc: RovoDocument = {
        id: 'doc-001',
        title: 'Test Doc',
        content: 'Content',
        source: 'confluence',
        relevance: 0.8,
      };
      const decision: HistoricalDecision = {
        id: 'dec-001',
        title: 'Decision',
        description: 'A decision was made',
        date: '2026-03-01',
        source: 'jira',
      };

      // Act
      const context: RovoContext = {
        documents: [doc],
        relatedTickets: ['PROJ-100', 'PROJ-200'],
        decisions: [decision],
        query: 'find architecture decisions for authentication',
        timestamp: '2026-04-05T10:00:00Z',
      };

      // Assert
      expect(context.documents).toHaveLength(1);
      expect(context.documents[0]?.id).toBe('doc-001');
      expect(context.relatedTickets).toEqual(['PROJ-100', 'PROJ-200']);
      expect(context.decisions).toHaveLength(1);
      expect(context.decisions[0]?.title).toBe('Decision');
      expect(context.query).toBe('find architecture decisions for authentication');
      expect(context.timestamp).toBe('2026-04-05T10:00:00Z');
    });
  });

  describe('happy path – empty context', () => {
    it('should accept an empty RovoContext with no documents or decisions', () => {
      // Arrange & Act
      const context: RovoContext = {
        documents: [],
        relatedTickets: [],
        decisions: [],
        query: '',
        timestamp: '2026-04-05T00:00:00Z',
      };

      // Assert
      expect(context.documents).toHaveLength(0);
      expect(context.relatedTickets).toHaveLength(0);
      expect(context.decisions).toHaveLength(0);
      expect(context.query).toBe('');
    });
  });

  describe('edge cases', () => {
    it('should accept many documents in the context', () => {
      // Arrange
      const docs: readonly RovoDocument[] = Array.from({ length: 100 }, (_, i) => ({
        id: `doc-${i}`,
        title: `Document ${i}`,
        content: `Content ${i}`,
        source: 'confluence',
        relevance: Math.random(),
      }));

      // Act
      const context: RovoContext = {
        documents: docs,
        relatedTickets: [],
        decisions: [],
        query: 'bulk test',
        timestamp: '2026-04-05T00:00:00Z',
      };

      // Assert
      expect(context.documents).toHaveLength(100);
      expect(context.documents[0]?.id).toBe('doc-0');
      expect(context.documents[99]?.id).toBe('doc-99');
    });

    it('should accept a context with only query and timestamp', () => {
      // Arrange & Act
      const context: RovoContext = {
        documents: [],
        relatedTickets: [],
        decisions: [],
        query: 'simple search',
        timestamp: '2026-01-01T00:00:00Z',
      };

      // Assert
      expect(context.query).toBe('simple search');
      expect(context.documents).toEqual([]);
      expect(context.relatedTickets).toEqual([]);
      expect(context.decisions).toEqual([]);
    });

    it('should allow destructuring of readonly array fields', () => {
      // Arrange
      const context: RovoContext = {
        documents: [
          { id: 'd1', title: 'Doc1', content: 'c1', source: 'confluence', relevance: 0.5 },
        ],
        relatedTickets: ['PROJ-1'],
        decisions: [
          { id: 'dec1', title: 'Dec1', description: 'd1', date: '2026-01-01', source: 'jira' },
        ],
        query: 'test',
        timestamp: '2026-04-05T00:00:00Z',
      };

      // Act
      const { documents, relatedTickets, decisions } = context;
      const [firstDoc] = documents;
      const [firstTicket] = relatedTickets;
      const [firstDecision] = decisions;

      // Assert
      expect(firstDoc?.id).toBe('d1');
      expect(firstTicket).toBe('PROJ-1');
      expect(firstDecision?.title).toBe('Dec1');
    });
  });
});
