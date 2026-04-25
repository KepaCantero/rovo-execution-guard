// Test suite for AuditAction and AuditLogEntry domain types
// Covers: all 8 audit actions, optional fields, details Record type
// Tests: happy path, edge cases, discriminated union narrowing, Record flexibility

import type { AuditAction, AuditLogEntry } from '../../../src/backend/types/audit-log';

// ---------------------------------------------------------------------------
// AuditAction
// ---------------------------------------------------------------------------

describe('AuditAction', () => {
  it('should accept all 8 valid audit actions', () => {
    // Arrange
    const actions: AuditAction[] = [
      'gate_evaluated',
      'ticket_blocked',
      'ticket_approved',
      'pr_blocked',
      'pr_approved',
      'config_updated',
      'inconsistency_flagged',
      'enforcement_executed',
    ];

    // Act & Assert
    expect(actions).toHaveLength(8);
    expect(actions).toContain('gate_evaluated');
    expect(actions).toContain('ticket_blocked');
    expect(actions).toContain('ticket_approved');
    expect(actions).toContain('pr_blocked');
    expect(actions).toContain('pr_approved');
    expect(actions).toContain('config_updated');
    expect(actions).toContain('inconsistency_flagged');
    expect(actions).toContain('enforcement_executed');
  });

  it('should assign individual action values', () => {
    // Arrange & Act
    const gateEvaluated: AuditAction = 'gate_evaluated';
    const ticketBlocked: AuditAction = 'ticket_blocked';
    const enforcementExecuted: AuditAction = 'enforcement_executed';

    // Assert
    expect(gateEvaluated).toBe('gate_evaluated');
    expect(ticketBlocked).toBe('ticket_blocked');
    expect(enforcementExecuted).toBe('enforcement_executed');
  });
});

// ---------------------------------------------------------------------------
// AuditLogEntry
// ---------------------------------------------------------------------------

describe('AuditLogEntry', () => {
  describe('happy path – minimal entry', () => {
    it('should accept a minimal AuditLogEntry without optional fields', () => {
      // Arrange & Act
      const entry: AuditLogEntry = {
        id: 'audit-001',
        action: 'gate_evaluated',
        timestamp: '2026-04-05T10:00:00Z',
        executionId: 'exec-001',
        projectKey: 'PROJ',
        details: { gateType: 'definition', score: 0.85 },
      };

      // Assert
      expect(entry.id).toBe('audit-001');
      expect(entry.action).toBe('gate_evaluated');
      expect(entry.executionId).toBe('exec-001');
      expect(entry.projectKey).toBe('PROJ');
      expect(entry.ticketKey).toBeUndefined();
      expect(entry.prNumber).toBeUndefined();
      expect(entry.userId).toBeUndefined();
      expect(entry.details).toEqual({ gateType: 'definition', score: 0.85 });
    });
  });

  describe('happy path – full entry', () => {
    it('should accept a full AuditLogEntry with all optional fields', () => {
      // Arrange & Act
      const entry: AuditLogEntry = {
        id: 'audit-002',
        action: 'ticket_blocked',
        timestamp: '2026-04-05T11:00:00Z',
        executionId: 'exec-002',
        projectKey: 'PROJ',
        ticketKey: 'PROJ-100',
        prNumber: 42,
        userId: 'user-123',
        details: { reason: 'Score below threshold', score: 0.65, threshold: 0.8 },
      };

      // Assert
      expect(entry.ticketKey).toBe('PROJ-100');
      expect(entry.prNumber).toBe(42);
      expect(entry.userId).toBe('user-123');
      expect(entry.details).toEqual({
        reason: 'Score below threshold',
        score: 0.65,
        threshold: 0.8,
      });
    });
  });

  describe('edge cases', () => {
    it('should accept empty details object', () => {
      // Arrange & Act
      const entry: AuditLogEntry = {
        id: 'audit-empty',
        action: 'config_updated',
        timestamp: '2026-04-05T12:00:00Z',
        executionId: 'exec-003',
        projectKey: 'PROJ',
        details: {},
      };

      // Assert
      expect(entry.details).toEqual({});
    });

    it('should accept flexible details as Record<string, unknown>', () => {
      // Arrange & Act
      const entry: AuditLogEntry = {
        id: 'audit-flex',
        action: 'enforcement_executed',
        timestamp: '2026-04-05T12:00:00Z',
        executionId: 'exec-004',
        projectKey: 'PROJ',
        details: {
          actions: ['block_transition', 'add_comment'],
          inconsistencyCount: 3,
          metadata: { nested: true },
        },
      };

      // Assert – access details by key
      const details = entry.details;
      expect(details['actions']).toEqual(['block_transition', 'add_comment']);
      expect(details['inconsistencyCount']).toBe(3);
    });

    it('should accept empty strings for all text fields', () => {
      // Arrange & Act
      const entry: AuditLogEntry = {
        id: '',
        action: 'gate_evaluated',
        timestamp: '',
        executionId: '',
        projectKey: '',
        ticketKey: '',
        userId: '',
        details: {},
      };

      // Assert
      expect(entry.id).toBe('');
      expect(entry.timestamp).toBe('');
      expect(entry.executionId).toBe('');
      expect(entry.projectKey).toBe('');
      expect(entry.ticketKey).toBe('');
      expect(entry.userId).toBe('');
    });

    it('should accept prNumber of zero', () => {
      // Arrange & Act
      const entry: AuditLogEntry = {
        id: 'audit-pr0',
        action: 'pr_blocked',
        timestamp: '2026-01-01T00:00:00Z',
        executionId: 'exec-pr0',
        projectKey: 'PROJ',
        prNumber: 0,
        details: {},
      };

      // Assert
      expect(entry.prNumber).toBe(0);
    });

    it('should accept details with various value types', () => {
      // Arrange & Act
      const entry: AuditLogEntry = {
        id: 'audit-types',
        action: 'gate_evaluated',
        timestamp: '2026-04-05T00:00:00Z',
        executionId: 'exec-types',
        projectKey: 'PROJ',
        details: {
          stringValue: 'hello',
          numberValue: 42,
          booleanValue: true,
          nullValue: null,
          undefinedValue: undefined,
          arrayValue: [1, 2, 3],
          objectValue: { key: 'value' },
        },
      };

      // Assert
      expect(entry.details['stringValue']).toBe('hello');
      expect(entry.details['numberValue']).toBe(42);
      expect(entry.details['booleanValue']).toBe(true);
      expect(entry.details['nullValue']).toBeNull();
      expect(entry.details['arrayValue']).toEqual([1, 2, 3]);
    });
  });

  describe('discriminated union narrowing by action', () => {
    it('should narrow by action field in a conditional', () => {
      // Arrange
      const entry: AuditLogEntry = {
        id: 'audit-narrow',
        action: 'ticket_blocked',
        timestamp: '2026-04-05T00:00:00Z',
        executionId: 'exec-narrow',
        projectKey: 'PROJ',
        details: {},
      };

      // Act & Assert
      if (entry.action === 'ticket_blocked') {
        expect(entry.action).toBe('ticket_blocked');
      }
    });

    it('should filter an array of entries by action type', () => {
      // Arrange
      const entries: readonly AuditLogEntry[] = [
        {
          id: 'a1',
          action: 'gate_evaluated',
          timestamp: '2026-01-01T00:00:00Z',
          executionId: 'e1',
          projectKey: 'PROJ',
          details: {},
        },
        {
          id: 'a2',
          action: 'ticket_blocked',
          timestamp: '2026-01-01T00:00:00Z',
          executionId: 'e2',
          projectKey: 'PROJ',
          details: {},
        },
        {
          id: 'a3',
          action: 'gate_evaluated',
          timestamp: '2026-01-01T00:00:00Z',
          executionId: 'e3',
          projectKey: 'PROJ',
          details: {},
        },
        {
          id: 'a4',
          action: 'pr_approved',
          timestamp: '2026-01-01T00:00:00Z',
          executionId: 'e4',
          projectKey: 'PROJ',
          details: {},
        },
      ];

      // Act
      const gateEntries = entries.filter((e) => e.action === 'gate_evaluated');

      // Assert
      expect(gateEntries).toHaveLength(2);
    });

    it('should support switch exhaustiveness over action types', () => {
      // Arrange
      const entries: readonly AuditLogEntry[] = [
        {
          id: 's1',
          action: 'gate_evaluated',
          timestamp: '',
          executionId: '',
          projectKey: '',
          details: {},
        },
        {
          id: 's2',
          action: 'ticket_approved',
          timestamp: '',
          executionId: '',
          projectKey: '',
          details: {},
        },
        {
          id: 's3',
          action: 'inconsistency_flagged',
          timestamp: '',
          executionId: '',
          projectKey: '',
          details: {},
        },
      ];

      // Act
      const categories: string[] = [];
      for (const entry of entries) {
        switch (entry.action) {
          case 'gate_evaluated':
          case 'ticket_approved':
          case 'ticket_blocked':
            categories.push('ticket_lifecycle');
            break;
          case 'pr_blocked':
          case 'pr_approved':
            categories.push('pr_lifecycle');
            break;
          case 'config_updated':
          case 'inconsistency_flagged':
          case 'enforcement_executed':
            categories.push('system_event');
            break;
        }
      }

      // Assert
      expect(categories).toEqual(['ticket_lifecycle', 'ticket_lifecycle', 'system_event']);
    });
  });

  describe('integration – optional fields for different contexts', () => {
    it('should have ticketKey for ticket-related actions', () => {
      // Arrange & Act
      const entry: AuditLogEntry = {
        id: 'audit-ticket',
        action: 'ticket_blocked',
        timestamp: '2026-04-05T00:00:00Z',
        executionId: 'exec-ticket',
        projectKey: 'PROJ',
        ticketKey: 'PROJ-999',
        details: { reason: 'low score' },
      };

      // Assert
      expect(entry.ticketKey).toBe('PROJ-999');
      expect(entry.prNumber).toBeUndefined();
    });

    it('should have prNumber for PR-related actions', () => {
      // Arrange & Act
      const entry: AuditLogEntry = {
        id: 'audit-pr',
        action: 'pr_blocked',
        timestamp: '2026-04-05T00:00:00Z',
        executionId: 'exec-pr',
        projectKey: 'PROJ',
        prNumber: 42,
        details: { reason: 'inconsistencies' },
      };

      // Assert
      expect(entry.prNumber).toBe(42);
      expect(entry.ticketKey).toBeUndefined();
    });
  });
});
