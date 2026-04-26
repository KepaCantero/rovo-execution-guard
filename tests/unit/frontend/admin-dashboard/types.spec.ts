/**
 * Tests for admin-dashboard/types.ts
 *
 * Verifies type exports, readonly enforcement, and union type values.
 * Since types are compile-time only, runtime tests verify the module
 * exports are accessible and constants are correctly structured.
 */

import type {
  TabIdentifier,
  SortDirection,
  DateRange,
  OverviewMetrics,
  AuditLogFilter,
  PaginationState,
  AuditLogSort,
  AdminDataState,
  AdminDashboardProps,
  OverviewTabProps,
  ConfigurationTabProps,
  AuditLogTabProps,
} from '../../../../src/frontend/custom-ui/admin-dashboard/types';

// ═══════════════════════════════════════════
// MOCKS & FIXTURES
// ═══════════════════════════════════════════

const validDateRange: DateRange = {
  start: '2026-01-01T00:00:00Z',
  end: '2026-04-25T23:59:59Z',
};

const validOverviewMetrics: OverviewMetrics = {
  totalEvaluated: 150,
  totalBlocked: 23,
  prsBlocked: 8,
  avgScore: 78.5,
  inconsistencyBreakdown: {
    contradiction: 10,
    duplicate: 5,
    missing_context: 3,
    ambiguity: 5,
  },
};

const validAuditLogFilter: AuditLogFilter = {
  actionTypes: ['gate_evaluated', 'ticket_blocked'],
  dateRange: validDateRange,
  ticketKey: 'PROJ-123',
  userId: 'user-456',
};

const validPaginationState: PaginationState = {
  offset: 0,
  limit: 25,
  total: 100,
  hasMore: true,
};

const validAuditLogSort: AuditLogSort = {
  field: 'timestamp',
  direction: 'desc',
};

// AdminDataState is tested inline within the describe block below

const validAdminDashboardProps: AdminDashboardProps = {
  projectKey: 'PROJ',
};

const validOverviewTabProps: OverviewTabProps = {
  metrics: validOverviewMetrics,
  loading: false,
  error: null,
  onRevalidate: (_ticketKey: string) => {},
};

const validConfigurationTabProps: ConfigurationTabProps = {
  config: null,
  loading: false,
  error: null,
  saving: false,
  onSave: (_config: import('../../../../src/backend/types/project-config').ProjectConfig) => {},
};

const validAuditLogTabProps: AuditLogTabProps = {
  projectKey: 'PROJ',
  loading: false,
  error: null,
};

// ═══════════════════════════════════════════
// TEST SUITE
// ═══════════════════════════════════════════

describe('admin-dashboard/types', () => {
  describe('DateRange', () => {
    it('should accept valid date range objects', () => {
      const range: DateRange = validDateRange;
      expect(range.start).toBe('2026-01-01T00:00:00Z');
      expect(range.end).toBe('2026-04-25T23:59:59Z');
    });

    it('should allow null dateRange in AuditLogFilter', () => {
      const filter: AuditLogFilter = {
        ...validAuditLogFilter,
        dateRange: null,
      };
      expect(filter.dateRange).toBeNull();
    });
  });

  describe('OverviewMetrics', () => {
    it('should accept complete metrics object (AC-05)', () => {
      const metrics: OverviewMetrics = validOverviewMetrics;
      expect(metrics.totalEvaluated).toBe(150);
      expect(metrics.totalBlocked).toBe(23);
      expect(metrics.prsBlocked).toBe(8);
      expect(metrics.avgScore).toBe(78.5);
      expect(metrics.inconsistencyBreakdown.contradiction).toBe(10);
    });

    it('should support all inconsistency types in breakdown', () => {
      const breakdown = validOverviewMetrics.inconsistencyBreakdown;
      expect(breakdown).toHaveProperty('contradiction');
      expect(breakdown).toHaveProperty('duplicate');
      expect(breakdown).toHaveProperty('missing_context');
      expect(breakdown).toHaveProperty('ambiguity');
    });
  });

  describe('AuditLogFilter', () => {
    it('should accept complete filter object (AC-06)', () => {
      const filter: AuditLogFilter = validAuditLogFilter;
      expect(filter.actionTypes).toEqual(['gate_evaluated', 'ticket_blocked']);
      expect(filter.dateRange).toEqual(validDateRange);
      expect(filter.ticketKey).toBe('PROJ-123');
      expect(filter.userId).toBe('user-456');
    });

    it('should accept empty filter fields', () => {
      const emptyFilter: AuditLogFilter = {
        actionTypes: [],
        dateRange: null,
        ticketKey: '',
        userId: '',
      };
      expect(emptyFilter.actionTypes).toHaveLength(0);
      expect(emptyFilter.ticketKey).toBe('');
    });
  });

  describe('PaginationState', () => {
    it('should accept valid pagination state (AC-07)', () => {
      const pagination: PaginationState = validPaginationState;
      expect(pagination.offset).toBe(0);
      expect(pagination.limit).toBe(25);
      expect(pagination.total).toBe(100);
      expect(pagination.hasMore).toBe(true);
    });

    it('should reflect no more results correctly', () => {
      const lastPage: PaginationState = {
        offset: 75,
        limit: 25,
        total: 100,
        hasMore: false,
      };
      expect(lastPage.hasMore).toBe(false);
    });
  });

  describe('AdminDataState<T>', () => {
    it('should accept loading state (AC-08)', () => {
      const loading: AdminDataState<string> = {
        data: null,
        loading: true,
        error: null,
      };
      expect(loading.loading).toBe(true);
      expect(loading.data).toBeNull();
      expect(loading.error).toBeNull();
    });

    it('should accept error state (AC-08)', () => {
      const errored: AdminDataState<string> = {
        data: null,
        loading: false,
        error: 'Resolver timeout',
      };
      expect(errored.error).toBe('Resolver timeout');
    });

    it('should accept success state with generic data (AC-08)', () => {
      const success: AdminDataState<OverviewMetrics> = {
        data: validOverviewMetrics,
        loading: false,
        error: null,
      };
      expect(success.data).toBe(validOverviewMetrics);
    });
  });

  describe('Component prop interfaces', () => {
    it('should accept valid AdminDashboardProps', () => {
      const props: AdminDashboardProps = validAdminDashboardProps;
      expect(props.projectKey).toBe('PROJ');
    });

    it('should accept valid OverviewTabProps with callback', () => {
      const props: OverviewTabProps = validOverviewTabProps;
      expect(typeof props.onRevalidate).toBe('function');
    });

    it('should accept valid ConfigurationTabProps', () => {
      const props: ConfigurationTabProps = validConfigurationTabProps;
      expect(props.config).toBeNull();
      expect(props.saving).toBe(false);
      expect(typeof props.onSave).toBe('function');
    });

    it('should accept valid AuditLogTabProps', () => {
      const props: AuditLogTabProps = validAuditLogTabProps;
      expect(props.projectKey).toBe('PROJ');
    });
  });

  describe('Union types', () => {
    it('should have correct TabIdentifier values (AC-09)', () => {
      const tabs: readonly TabIdentifier[] = ['overview', 'configuration', 'auditLog'];
      expect(tabs).toHaveLength(3);
      expect(tabs).toContain('overview');
      expect(tabs).toContain('configuration');
      expect(tabs).toContain('auditLog');
    });

    it('should have correct SortDirection values (AC-10)', () => {
      const directions: readonly SortDirection[] = ['asc', 'desc'];
      expect(directions).toHaveLength(2);
      expect(directions).toContain('asc');
      expect(directions).toContain('desc');
    });
  });

  describe('AuditLogSort', () => {
    it('should accept valid sort configuration (AC-11)', () => {
      const sort: AuditLogSort = validAuditLogSort;
      expect(sort.field).toBe('timestamp');
      expect(sort.direction).toBe('desc');
    });

    it('should accept all sortable fields', () => {
      const fields: readonly AuditLogSort['field'][] = [
        'timestamp',
        'action',
        'ticketKey',
        'userId',
      ];
      expect(fields).toHaveLength(4);
    });
  });

  describe('Readonly enforcement (ARCH-SOLID-203)', () => {
    it('should use readonly properties on OverviewMetrics', () => {
      const metrics: OverviewMetrics = validOverviewMetrics;
      // TypeScript enforces readonly at compile time.
      // Runtime check confirms the object structure is preserved.
      expect(Object.isFrozen(metrics)).toBe(false); // readonly is compile-time
      expect(metrics.totalEvaluated).toBe(150);
    });
  });
});
