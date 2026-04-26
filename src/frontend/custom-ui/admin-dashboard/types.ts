// [ARCH-SOLID-058] Admin Dashboard local types — component props, filter/pagination, hook states
// [ARCH-SOLID-203] Interface for data structures, type for unions only
// [ARCH-SOLID-232] Named exports only, no default export

import type { AuditAction } from '../../../backend/types/audit-log';
import type { InconsistencyType } from '../../../backend/types/inconsistency';

// ═══════════════════════════════════════════
// UNION TYPES (ARCH-SOLID-203: type keyword for unions)
// ═══════════════════════════════════════════

/** Identifies the active tab in AdminDashboardApp [ARCH-SOLID-203] */
export type TabIdentifier = 'overview' | 'configuration' | 'auditLog';

/** Sort direction for audit log columns [ARCH-SOLID-203] */
export type SortDirection = 'asc' | 'desc';

// ═══════════════════════════════════════════
// INTERFACES (ARCH-SOLID-203: interface for data structures)
// All properties readonly [ARCH-SOLID-203]
// ═══════════════════════════════════════════

/** Date range filter for audit log queries */
export interface DateRange {
  readonly start: string;
  readonly end: string;
}

/** Metrics displayed in the Overview tab */
export interface OverviewMetrics {
  readonly totalEvaluated: number;
  readonly totalBlocked: number;
  readonly prsBlocked: number;
  readonly avgScore: number;
  readonly inconsistencyBreakdown: Readonly<Record<InconsistencyType, number>>;
}

/** Filter parameters for audit log queries */
export interface AuditLogFilter {
  readonly actionTypes: readonly AuditAction[];
  readonly dateRange: DateRange | null;
  readonly ticketKey: string;
  readonly userId: string;
}

/** Pagination state for server-side pagination */
export interface PaginationState {
  readonly offset: number;
  readonly limit: number;
  readonly total: number;
  readonly hasMore: boolean;
}

/** Sort configuration for audit log table */
export interface AuditLogSort {
  readonly field: 'timestamp' | 'action' | 'ticketKey' | 'userId';
  readonly direction: SortDirection;
}

/** Generic data fetching state used by hooks [UI-ADS-202] */
export interface AdminDataState<T> {
  readonly data: T | null;
  readonly loading: boolean;
  readonly error: string | null;
}

/** Props for AdminDashboardApp root component */
export interface AdminDashboardProps {
  readonly projectKey: string;
}

/** Props for OverviewTab presentational component */
export interface OverviewTabProps {
  readonly metrics: OverviewMetrics | null;
  readonly loading: boolean;
  readonly error: string | null;
  readonly onRevalidate: (ticketKey: string) => void;
}

/** Props for ConfigurationTab presentational component */
export interface ConfigurationTabProps {
  readonly config: import('../../../backend/types/project-config').ProjectConfig | null;
  readonly loading: boolean;
  readonly error: string | null;
  readonly saving: boolean;
  readonly onSave: (config: import('../../../backend/types/project-config').ProjectConfig) => void;
}

/** Props for AuditLogTab presentational component */
export interface AuditLogTabProps {
  readonly projectKey: string;
  readonly loading: boolean;
  readonly error: string | null;
}
