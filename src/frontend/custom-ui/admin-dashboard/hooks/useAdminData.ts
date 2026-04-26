// [ARCH-SOLID-058] Container hook for OverviewTab — fetches admin overview metrics via resolver
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
import type { AdminDataState, OverviewMetrics } from '../types';
import type { ResolverResponse } from '../../../../backend/resolvers/index';

// ═══════════════════════════════════════════
// RETURN TYPE
// ═══════════════════════════════════════════

/** [ARCH-SOLID-203] Return type for useAdminData hook */
interface UseAdminDataReturn extends AdminDataState<OverviewMetrics> {
  readonly refresh: () => void;
}

// ═══════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════

/** Default resolver name for overview metrics */
const RESOLVER_NAME = 'getConsistencyScore';

// ═══════════════════════════════════════════
// HOOK
// ═══════════════════════════════════════════

/**
 * Fetches overview metrics for the Admin Dashboard.
 * [UI-ADS-008] Uses invoke() exclusively.
 * [ARCH-SOLID-004] No business logic — delegates to resolver.
 *
 * AC ref: AC-01..AC-11 of useAdminData.reqs.md
 *
 * @param projectKey - The project key to fetch metrics for
 * @returns Data state, loading, error, and refresh callback
 */
export function useAdminData(projectKey: string): UseAdminDataReturn {
  const [data, setData] = useState<OverviewMetrics | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      const response = await invoke<ResolverResponse<OverviewMetrics>>(RESOLVER_NAME, {
        projectKey,
      });

      // [ARCH-SOLID-004] Check success before extracting data
      if (response.success && response.data) {
        setData(response.data);
      } else {
        // [SEC-PRIV-0792] Surface error, never swallow
        setError(response.error ?? 'Failed to fetch admin data');
        setData(null);
      }
    } catch (err: unknown) {
      // [FORGE-OPS-005] Handle resolver timeout/network errors
      const message = err instanceof Error ? err.message : 'Failed to fetch admin data';
      setError(message);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [projectKey]);

  // [UI-ADS-201] Hook at top level — fetch on mount with unmount safety
  useEffect(() => {
    let cancelled = false;

    const doFetch = async (): Promise<void> => {
      await fetchData();
      // Post-fetch: if unmounted during fetch, state is already updated
      // but React 18+ won't warn. The cancelled flag is kept for consistency
      // with useProjectConfig pattern.
      if (cancelled) return;
    };

    void doFetch();

    return (): void => {
      cancelled = true;
    };
  }, [fetchData]);

  return { data, loading, error, refresh: fetchData };
}
