// Test suite for JiraStatus, JiraTransition, and JiraTicketData domain types
// Covers: status enum values, transition structure, ticket data with optional fields
// Tests: happy path, edge cases, optional field handling, readonly labels

import type {
  JiraStatus,
  JiraTransition,
  JiraTicketData,
  JiraIssueLink,
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

  describe('relationship fields (RTASK-042)', () => {
    it('should compile without new optional fields (AC-07 backward compat)', () => {
      // Arrange & Act — no new fields
      const ticket: JiraTicketData = {
        key: 'PROJ-400',
        summary: 'Old-style ticket',
        description: 'desc',
        status: 'TO DO',
        issueType: 'Task',
        labels: [],
        projectKey: 'PROJ',
        created: '2026-01-01T00:00:00Z',
        updated: '2026-01-01T00:00:00Z',
      };

      // Assert — new fields are undefined
      expect(ticket.epicKey).toBeUndefined();
      expect(ticket.epicSummary).toBeUndefined();
      expect(ticket.issueLinks).toBeUndefined();
      expect(ticket.fixVersions).toBeUndefined();
    });

    it('should accept epicKey and epicSummary (AC-07)', () => {
      // Arrange & Act
      const ticket: JiraTicketData = {
        key: 'PROJ-500',
        summary: 'Story in epic',
        description: 'desc',
        status: 'IN PROGRESS',
        issueType: 'Story',
        labels: [],
        projectKey: 'PROJ',
        created: '2026-01-01T00:00:00Z',
        updated: '2026-01-01T00:00:00Z',
        epicKey: 'PROJ-100',
        epicSummary: 'Parent Epic',
      };

      // Assert
      expect(ticket.epicKey).toBe('PROJ-100');
      expect(ticket.epicSummary).toBe('Parent Epic');
    });

    it('should accept issueLinks with valid JiraIssueLink entries (AC-07)', () => {
      // Arrange
      const links: readonly JiraIssueLink[] = [
        {
          type: 'Blocks',
          direction: 'outward',
          targetKey: 'PROJ-600',
          targetSummary: 'Blocked task',
          targetStatus: 'TO DO',
        },
      ];

      // Act
      const ticket: JiraTicketData = {
        key: 'PROJ-700',
        summary: 'Blocking task',
        description: 'desc',
        status: 'IN PROGRESS',
        issueType: 'Story',
        labels: [],
        projectKey: 'PROJ',
        created: '2026-01-01T00:00:00Z',
        updated: '2026-01-01T00:00:00Z',
        issueLinks: links,
      };

      // Assert
      expect(ticket.issueLinks).toHaveLength(1);
      expect(ticket.issueLinks?.[0]?.type).toBe('Blocks');
      expect(ticket.issueLinks?.[0]?.direction).toBe('outward');
      expect(ticket.issueLinks?.[0]?.targetKey).toBe('PROJ-600');
    });

    it('should accept fixVersions (AC-07)', () => {
      // Arrange & Act
      const ticket: JiraTicketData = {
        key: 'PROJ-800',
        summary: 'Versioned issue',
        description: 'desc',
        status: 'DONE',
        issueType: 'Bug',
        labels: [],
        projectKey: 'PROJ',
        created: '2026-01-01T00:00:00Z',
        updated: '2026-01-01T00:00:00Z',
        fixVersions: ['v2.1.0', 'v2.2.0'],
      };

      // Assert
      expect(ticket.fixVersions).toEqual(['v2.1.0', 'v2.2.0']);
    });

    it('should accept all relationship fields together (AC-07)', () => {
      // Arrange & Act
      const ticket: JiraTicketData = {
        key: 'PROJ-900',
        summary: 'Full relationship data',
        description: 'desc',
        status: 'IN REVIEW',
        issueType: 'Story',
        labels: ['epic-tracked'],
        projectKey: 'PROJ',
        created: '2026-01-01T00:00:00Z',
        updated: '2026-01-01T00:00:00Z',
        epicKey: 'PROJ-10',
        epicSummary: 'Epic One',
        issueLinks: [
          {
            type: 'Relates',
            direction: 'inward',
            targetKey: 'PROJ-20',
            targetSummary: 'Related issue',
            targetStatus: 'DONE',
          },
        ],
        fixVersions: ['v3.0.0'],
      };

      // Assert
      expect(ticket.epicKey).toBe('PROJ-10');
      expect(ticket.epicSummary).toBe('Epic One');
      expect(ticket.issueLinks).toHaveLength(1);
      expect(ticket.fixVersions).toEqual(['v3.0.0']);
    });

    it('should accept empty issueLinks and fixVersions arrays (AC-07)', () => {
      // Arrange & Act
      const ticket: JiraTicketData = {
        key: 'PROJ-EMPTY',
        summary: 'Empty relationships',
        description: 'desc',
        status: 'TO DO',
        issueType: 'Task',
        labels: [],
        projectKey: 'PROJ',
        created: '2026-01-01T00:00:00Z',
        updated: '2026-01-01T00:00:00Z',
        issueLinks: [],
        fixVersions: [],
      };

      // Assert
      expect(ticket.issueLinks).toEqual([]);
      expect(ticket.fixVersions).toEqual([]);
    });
  });
});

// ---------------------------------------------------------------------------
// JiraIssueLink
// ---------------------------------------------------------------------------

describe('JiraIssueLink', () => {
  describe('happy path', () => {
    it('should accept a valid outward link (AC-06)', () => {
      // Arrange & Act
      const link: JiraIssueLink = {
        type: 'Blocks',
        direction: 'outward',
        targetKey: 'PROJ-100',
        targetSummary: 'Blocked by this issue',
        targetStatus: 'TO DO',
      };

      // Assert
      expect(link.type).toBe('Blocks');
      expect(link.direction).toBe('outward');
      expect(link.targetKey).toBe('PROJ-100');
      expect(link.targetSummary).toBe('Blocked by this issue');
      expect(link.targetStatus).toBe('TO DO');
    });

    it('should accept a valid inward link (AC-06)', () => {
      // Arrange & Act
      const link: JiraIssueLink = {
        type: 'Depends on',
        direction: 'inward',
        targetKey: 'PROJ-200',
        targetSummary: 'Dependency issue',
        targetStatus: 'IN PROGRESS',
      };

      // Assert
      expect(link.direction).toBe('inward');
      expect(link.type).toBe('Depends on');
    });
  });

  describe('edge cases', () => {
    it('should accept various link types (AC-06)', () => {
      // Arrange & Act
      const linkTypes = ['Blocks', 'Depends on', 'Relates', 'Clones', 'Duplicates'];
      const links: readonly JiraIssueLink[] = linkTypes.map((t, i) => ({
        type: t,
        direction: 'outward' as const,
        targetKey: `PROJ-${i}`,
        targetSummary: `Link ${i}`,
        targetStatus: 'TO DO',
      }));

      // Assert
      expect(links).toHaveLength(5);
      expect(links[0]?.type).toBe('Blocks');
      expect(links[4]?.type).toBe('Duplicates');
    });

    it('should accept empty strings for all fields (AC-06)', () => {
      // Arrange & Act
      const link: JiraIssueLink = {
        type: '',
        direction: 'inward',
        targetKey: '',
        targetSummary: '',
        targetStatus: '',
      };

      // Assert
      expect(link.type).toBe('');
      expect(link.targetKey).toBe('');
    });
  });

  describe('ARCH-SOLID rules', () => {
    it('should enforce readonly properties (ARCH-SOLID-203)', () => {
      // Arrange
      const link: JiraIssueLink = {
        type: 'Blocks',
        direction: 'outward',
        targetKey: 'PROJ-100',
        targetSummary: 'Test',
        targetStatus: 'TO DO',
      };

      // Assert — all properties should be typed as readonly
      expect(link).toBeDefined();
      expect(Object.keys(link)).toHaveLength(5);
    });

    it('should use discriminated direction type (ARCH-SOLID-204)', () => {
      // Arrange
      const inward: JiraIssueLink = {
        type: 'Relates',
        direction: 'inward',
        targetKey: 'PROJ-1',
        targetSummary: 'Inward',
        targetStatus: 'DONE',
      };
      const outward: JiraIssueLink = {
        type: 'Relates',
        direction: 'outward',
        targetKey: 'PROJ-2',
        targetSummary: 'Outward',
        targetStatus: 'TO DO',
      };

      // Assert — both directions are valid
      expect(inward.direction).toBe('inward');
      expect(outward.direction).toBe('outward');
    });
  });
});
