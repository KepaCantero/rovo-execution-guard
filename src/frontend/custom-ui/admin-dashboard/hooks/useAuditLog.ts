// [ARCH-SOLID-058] Container hook for AuditLogTab — fetches audit log with server-side pagination
// [UI-ADS-008] All data via invoke() from @forge/bridge — no direct HTTP
// [UI-ADS-201] Hooks at top level only — no conditional/loop hooks
// [UI-ADS-202] Container layer — separate from presentational components
// [UI-ADS-204] Stabilize callbacks with useCallback
// [ARCH-SOLID-004] No business logic — state management + invoke only
// [ARCH-SOLID-202] Zero any usage
// [ARCH-SOLID-232] Named exports only
// [ARCH-SOLID-205] Explicit return types

import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@forge/bridge';
import type { AuditLogEntry } from '../../../../backend/types/audit-log';
import type { PaginationState } from '../types';
import type { ResolverResponse } from '../../../../backend/resolvers/index';

// ═══════════════════════════════════════════
// RETURN TYPE
// ═══════════════════════════════════════════

/** [ARCH-SOLID-203] Return type for useAuditLog hook */
interface UseAuditLogReturn {
  readonly data: readonly AuditLogEntry[];
  readonly loading: boolean;
  readonly error: string | null;
  readonly pagination: PaginationState;
  readonly loadMore: () => void;
}

// ═══════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════

/** Default page size for audit log pagination [FORGE-OPS-005] */
const DEFAULT_PAGE_SIZE = 20;

// ═══════════════════════════════════════════
// HOOK
// ═══════════════════════════════════════════

/**
 * Fetches audit log entries with server-side pagination.
 * [UI-ADS-008] Uses invoke() exclusively.
 * [FORGE-OPS-005] Server-side pagination via limit parameter.
 * [ARCH-SOLID-004] No business logic — state management + invoke only.
 *
 * AC ref: AC-01..AC-13 of useAuditLog.reqs.md
 *
 * @param projectKey - The project key to query audit logs for
 * @param pageSize - Number of entries per page (default 20)
 * @returns Entries, loading, error, pagination state, and loadMore callback
 */
export function useAuditLog(
  projectKey: string,
  pageSize: number = DEFAULT_PAGE_SIZE,
): UseAuditLogReturn {
  const [data, setData] = useState<readonly AuditLogEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<PaginationState>({
    offset: 0,
    limit: pageSize,
    total: 0,
    hasMore: false,
  });

  const fetchPage = useCallback(
    async (offset: number, cancelled: () => boolean): Promise<void> => {
      setLoading(true);
      setError(null);

      try {
        const response = await invoke<ResolverResponse<AuditLogEntry[]>>('getAuditLog', {
          projectKey,
          limit: pageSize,
          offset,
        });

        if (cancelled()) return;

        // [ARCH-SOLID-004] Check success before extracting data
        if (response.success && response.data) {
          const entries = response.data;
          // [AC-04] Append results, don't replace
          setData((prev) => (offset === 0 ? entries : [...prev, ...entries]));
          setPagination({
            offset,
            limit: pageSize,
            // Track accumulated total since backend does not return a server-side count
            total: offset + entries.length,
            // [AC-05] hasMore based on whether we got a full page
            hasMore: entries.length >= pageSize,
          });
        } else {
          // [SEC-PRIV-0792] Surface error, never swallow
          setError(response.error ?? 'Failed to fetch audit log');
        }
      } catch (err: unknown) {
        if (cancelled()) return;
        // [FORGE-OPS-005] Handle resolver timeout/network errors
        const message = err instanceof Error ? err.message : 'Failed to fetch audit log';
        setError(message);
      } finally {
        if (!cancelled()) {
          setLoading(false);
        }
      }
    },
    [projectKey, pageSize],
  );

  // [UI-ADS-201] Hook at top level — fetch on mount
  useEffect(() => {
    let cancelled = false;
    const isCancelled = (): boolean => cancelled;

    void fetchPage(0, isCancelled);

    return (): void => {
      cancelled = true;
    };
  }, [fetchPage]);

  /** [UI-ADS-204] Stable loadMore callback */
  const loadMore = useCallback((): void => {
    if (!pagination.hasMore && data.length > 0) return;
    void fetchPage(data.length, (): boolean => false);
  }, [fetchPage, pagination.hasMore, data.length]);

  return { data, loading, error, pagination, loadMore };
}
