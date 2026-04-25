// Test suite for JiraStatus, JiraTransition, and JiraTicketData domain types
// Covers: status enum values, transition structure, ticket data with optional fields
// Tests: happy path, edge cases, optional field handling, readonly labels

import type {
  JiraStatus,
  JiraTransition,
  JiraTicketData,
} from '../../../src/backend/types/jira-data';

// ---------------------------------------------------------------------------
// JiraStatus
// ---------------------------------------------------------------------------

describe('JiraStatus', () => {
  it('should accept all four valid Jira statuses', () => {
    // Arrange
    const statuses: JiraStatus[] = ['TO DO', 'IN PROGRESS', 'IN REVIEW', 'DONE'];

    // Act & Assert
    expect(statuses).toHaveLength(4);
    expect(statuses).toContain('TO DO');
    expect(statuses).toContain('IN PROGRESS');
    expect(statuses).toContain('IN REVIEW');
    expect(statuses).toContain('DONE');
  });

  it('should assign individual status values', () => {
    // Arrange & Act
    const todo: JiraStatus = 'TO DO';
    const inProgress: JiraStatus = 'IN PROGRESS';
    const inReview: JiraStatus = 'IN REVIEW';
    const done: JiraStatus = 'DONE';

    // Assert
    expect(todo).toBe('TO DO');
    expect(inProgress).toBe('IN PROGRESS');
    expect(inReview).toBe('IN REVIEW');
    expect(done).toBe('DONE');
  });
});

// ---------------------------------------------------------------------------
// JiraTransition
// ---------------------------------------------------------------------------

describe('JiraTransition', () => {
  describe('happy path', () => {
    it('should accept a valid JiraTransition', () => {
      // Arrange & Act
      const transition: JiraTransition = {
        id: 'trans-1',
        name: 'Start Progress',
        toStatus: 'IN PROGRESS',
      };

      // Assert
      expect(transition.id).toBe('trans-1');
      expect(transition.name).toBe('Start Progress');
      expect(transition.toStatus).toBe('IN PROGRESS');
    });
  });

  describe('edge cases', () => {
    it('should accept empty strings for all fields', () => {
      // Arrange & Act
      const transition: JiraTransition = {
        id: '',
        name: '',
        toStatus: '',
      };

      // Assert
      expect(transition.id).toBe('');
      expect(transition.name).toBe('');
      expect(transition.toStatus).toBe('');
    });

    it('should accept arbitrary toStatus values (not constrained to JiraStatus)', () => {
      // Arrange & Act
      const transition: JiraTransition = {
        id: 'trans-custom',
        name: 'Move to Custom Status',
        toStatus: 'CUSTOM STATUS',
      };

      // Assert
      expect(transition.toStatus).toBe('CUSTOM STATUS');
    });
  });
});

// ---------------------------------------------------------------------------
// JiraTicketData
// ---------------------------------------------------------------------------

describe('JiraTicketData', () => {
  describe('happy path – minimal ticket', () => {
    it('should accept a minimal JiraTicketData without optional fields', () => {
      // Arrange & Act
      const ticket: JiraTicketData = {
        key: 'PROJ-100',
        summary: 'Implement scoring engine',
        description: 'Build the scoring engine for consistency checks',
        status: 'IN PROGRESS',
        issueType: 'Story',
        labels: ['scoring', 'backend'],
        projectKey: 'PROJ',
        created: '2026-01-01T00:00:00Z',
        updated: '2026-03-01T00:00:00Z',
      };

      // Assert
      expect(ticket.key).toBe('PROJ-100');
      expect(ticket.summary).toBe('Implement scoring engine');
      expect(ticket.description).toBe('Build the scoring engine for consistency checks');
      expect(ticket.status).toBe('IN PROGRESS');
      expect(ticket.issueType).toBe('Story');
      expect(ticket.labels).toEqual(['scoring', 'backend']);
      expect(ticket.projectKey).toBe('PROJ');
      expect(ticket.created).toBe('2026-01-01T00:00:00Z');
      expect(ticket.updated).toBe('2026-03-01T00:00:00Z');
      expect(ticket.assignee).toBeUndefined();
      expect(ticket.reporter).toBeUndefined();
      expect(ticket.priority).toBeUndefined();
    });
  });

  describe('happy path – full ticket with all optional fields', () => {
    it('should accept a full JiraTicketData with all optional fields', () => {
      // Arrange & Act
      const ticket: JiraTicketData = {
        key: 'PROJ-200',
        summary: 'Fix scoring bug',
        description: 'Scoring produces wrong results for edge cases',
        status: 'TO DO',
        assignee: 'user-123',
        reporter: 'user-456',
        priority: 'High',
        issueType: 'Bug',
        labels: ['bug', 'scoring'],
        projectKey: 'PROJ',
        created: '2026-02-01T00:00:00Z',
        updated: '2026-02-15T00:00:00Z',
      };

      // Assert
      expect(ticket.assignee).toBe('user-123');
      expect(ticket.reporter).toBe('user-456');
      expect(ticket.priority).toBe('High');
      expect(ticket.issueType).toBe('Bug');
    });
  });

  describe('edge cases', () => {
    it('should accept empty labels array', () => {
      // Arrange & Act
      const ticket: JiraTicketData = {
        key: 'PROJ-300',
        summary: 'No labels',
        description: 'desc',
        status: 'DONE',
        issueType: 'Task',
        labels: [],
        projectKey: 'PROJ',
        created: '2026-01-01T00:00:00Z',
        updated: '2026-01-01T00:00:00Z',
      };

      // Assert
      expect(ticket.labels).toEqual([]);
      expect(ticket.labels).toHaveLength(0);
    });

    it('should accept empty string for all text fields', () => {
      // Arrange & Act
      const ticket: JiraTicketData = {
        key: '',
        summary: '',
        description: '',
        status: '',
        issueType: '',
        labels: [],
        projectKey: '',
        created: '',
        updated: '',
      };

      // Assert
      expect(ticket.key).toBe('');
      expect(ticket.summary).toBe('');
      expect(ticket.description).toBe('');
      expect(ticket.status).toBe('');
    });

    it('should accept many labels', () => {
      // Arrange & Act
      const labels = Array.from({ length: 50 }, (_, i) => `label-${i}`);
      const ticket: JiraTicketData = {
        key: 'PROJ-MANY',
        summary: 'Many labels',
        description: 'desc',
        status: 'IN REVIEW',
        issueType: 'Story',
        labels,
        projectKey: 'PROJ',
        created: '2026-01-01T00:00:00Z',
        updated: '2026-01-01T00:00:00Z',
      };

      // Assert
      expect(ticket.labels).toHaveLength(50);
      expect(ticket.labels[0]).toBe('label-0');
      expect(ticket.labels[49]).toBe('label-49');
    });

    it('should accept arbitrary status string (not constrained to JiraStatus)', () => {
      // Arrange & Act
      const ticket: JiraTicketData = {
        key: 'PROJ-CUSTOM',
        summary: 'Custom status',
        description: 'desc',
        status: 'IN TESTING',
        issueType: 'Story',
        labels: [],
        projectKey: 'PROJ',
        created: '2026-01-01T00:00:00Z',
        updated: '2026-01-01T00:00:00Z',
      };

      // Assert – status is typed as string, not JiraStatus
      expect(ticket.status).toBe('IN TESTING');
    });

    it('should allow destructuring labels from ticket', () => {
      // Arrange
      const ticket: JiraTicketData = {
        key: 'PROJ-DESTRUCT',
        summary: 'Destructure test',
        description: 'desc',
        status: 'DONE',
        issueType: 'Story',
        labels: ['frontend', 'react', 'bug'],
        projectKey: 'PROJ',
        created: '2026-01-01T00:00:00Z',
        updated: '2026-01-01T00:00:00Z',
      };

      // Act
      const { labels } = ticket;
      const [first, ...rest] = labels;

      // Assert
      expect(first).toBe('frontend');
      expect(rest).toEqual(['react', 'bug']);
    });
  });
});
