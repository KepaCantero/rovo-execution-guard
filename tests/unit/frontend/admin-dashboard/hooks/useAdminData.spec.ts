/**
 * @jest-environment jsdom
 */

/**
 * Tests for admin-dashboard/hooks/useAdminData.ts
 *
 * Verifies the hook fetches overview metrics, manages loading/error states,
 * and exposes a working refresh callback.
 *
 * Pattern: AAA (Arrange-Act-Assert)
 * External dep: @forge/bridge mocked at module level [TEST-QA-202 exception]
 */

import { renderHook, act } from '@testing-library/react';
import { useAdminData } from '../../../../../src/frontend/custom-ui/admin-dashboard/hooks/useAdminData';
import type { OverviewMetrics } from '../../../../../src/frontend/custom-ui/admin-dashboard/types';

// ═══════════════════════════════════════════
// MOCKS
// ═══════════════════════════════════════════

const mockInvoke = jest.fn();
jest.mock('@forge/bridge', () => ({
  invoke: (...args: unknown[]): unknown => mockInvoke(...args),
}));

// ═══════════════════════════════════════════
// FIXTURES
// ═══════════════════════════════════════════

const mockMetrics: OverviewMetrics = {
  totalEvaluated: 150,
  totalBlocked: 23,
  prsBlocked: 8,
  avgScore: 78.5,
  inconsistencyBreakdown: {
    contradiction: 10,
    duplicate: 5,
    missing_context: 3,
    ambiguity: 5,
    sibling_contradiction: 0,
    spec_drift: 0,
    scope_mismatch: 0,
    orphan_reference: 0,
  },
};

const successResponse = <T>(data: T): { success: boolean; data: T; executionId: string } => ({
  success: true,
  data,
  executionId: 'res-test-123',
});

const errorResponse = (
  error: string,
): { success: boolean; error: string; executionId: string } => ({
  success: false,
  error,
  executionId: 'res-test-456',
});

// ═══════════════════════════════════════════
// TEST SUITE
// ═══════════════════════════════════════════

describe('useAdminData', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─── AC-01,04: Initial state and loading ──

  describe('initial state', () => {
    it('should start with loading=true, data=null, error=null (AC-01, AC-04)', () => {
      mockInvoke.mockReturnValue(new Promise(() => undefined));
      const { result } = renderHook(() => useAdminData('PROJ'));

      expect(result.current.loading).toBe(true);
      expect(result.current.data).toBeNull();
      expect(result.current.error).toBeNull();
    });

    it('should expose a refresh function (AC-03)', () => {
      mockInvoke.mockReturnValue(new Promise(() => undefined));
      const { result } = renderHook(() => useAdminData('PROJ'));

      expect(typeof result.current.refresh).toBe('function');
    });
  });

  // ─── AC-02,06: Successful fetch ──────────

  describe('successful fetch', () => {
    it('should fetch data on mount via invoke (AC-02)', async () => {
      mockInvoke.mockResolvedValue(successResponse(mockMetrics));

      renderHook(() => useAdminData('PROJ'));

      await act(async () => {
        await Promise.resolve();
      });

      expect(mockInvoke).toHaveBeenCalledWith('getConsistencyScore', { projectKey: 'PROJ' });
    });

    it('should populate data and set loading=false on success (AC-06)', async () => {
      mockInvoke.mockResolvedValue(successResponse(mockMetrics));

      const { result } = renderHook(() => useAdminData('PROJ'));

      await act(async () => {
        await Promise.resolve();
      });

      expect(result.current.data).toEqual(mockMetrics);
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
    });
  });

  // ─── AC-03: Refresh callback ─────────────

  describe('refresh', () => {
    it('should re-trigger fetch when refresh is called (AC-03)', async () => {
      mockInvoke.mockResolvedValue(successResponse(mockMetrics));

      const { result } = renderHook(() => useAdminData('PROJ'));

      await act(async () => {
        await Promise.resolve();
      });

      expect(mockInvoke).toHaveBeenCalledTimes(1);

      mockInvoke.mockResolvedValue(successResponse({ ...mockMetrics, totalEvaluated: 200 }));

      await act(async () => {
        result.current.refresh();
        await Promise.resolve();
      });

      expect(mockInvoke).toHaveBeenCalledTimes(2);
      expect(result.current.data?.totalEvaluated).toBe(200);
    });
  });

  // ─── AC-05,07: Error handling ────────────

  describe('error handling', () => {
    it('should set error on resolver failure response (AC-05, AC-07)', async () => {
      mockInvoke.mockResolvedValue(errorResponse('Project not found'));

      const { result } = renderHook(() => useAdminData('PROJ'));

      await act(async () => {
        await Promise.resolve();
      });

      expect(result.current.error).toBe('Project not found');
      expect(result.current.data).toBeNull();
      expect(result.current.loading).toBe(false);
    });

    it('should set error on invoke exception (AC-05)', async () => {
      mockInvoke.mockRejectedValue(new Error('Network timeout'));

      const { result } = renderHook(() => useAdminData('PROJ'));

      await act(async () => {
        await Promise.resolve();
      });

      expect(result.current.error).toBe('Network timeout');
      expect(result.current.data).toBeNull();
      expect(result.current.loading).toBe(false);
    });

    it('should handle non-Error exceptions (AC-05)', async () => {
      mockInvoke.mockRejectedValue('string error');

      const { result } = renderHook(() => useAdminData('PROJ'));

      await act(async () => {
        await Promise.resolve();
      });

      expect(result.current.error).toBe('Failed to fetch admin data');
      expect(result.current.loading).toBe(false);
    });

    it('should use default error message when resolver error is undefined (AC-05)', async () => {
      mockInvoke.mockResolvedValue({ success: false, executionId: 'res-x' });

      const { result } = renderHook(() => useAdminData('PROJ'));

      await act(async () => {
        await Promise.resolve();
      });

      expect(result.current.error).toBe('Failed to fetch admin data');
    });
  });

  // ─── AC-08: Zero any ─────────────────────

  describe('compliance', () => {
    it('should be a named export (AC-09, ARCH-SOLID-232)', () => {
      expect(typeof useAdminData).toBe('function');
    });

    it('should pass projectKey to invoke (AC-02, UI-ADS-008)', async () => {
      mockInvoke.mockResolvedValue(successResponse(mockMetrics));

      renderHook(() => useAdminData('MYPROJ'));

      await act(async () => {
        await Promise.resolve();
      });

      expect(mockInvoke).toHaveBeenCalledWith('getConsistencyScore', { projectKey: 'MYPROJ' });
    });
  });

  // ─── REGLA: SEC-PRIV-0792 ────────────────

  describe('SEC-PRIV-0792: no silent errors', () => {
    it('should never leave error as null when fetch fails', async () => {
      mockInvoke.mockRejectedValue(new Error('fail'));

      const { result } = renderHook(() => useAdminData('PROJ'));

      await act(async () => {
        await Promise.resolve();
      });

      expect(result.current.error).not.toBeNull();
    });
  });

  // ─── REGLA: ARCH-SOLID-004 ───────────────

  describe('ARCH-SOLID-004: no business logic', () => {
    it('should not transform or modify data from resolver', async () => {
      mockInvoke.mockResolvedValue(successResponse(mockMetrics));

      const { result } = renderHook(() => useAdminData('PROJ'));

      await act(async () => {
        await Promise.resolve();
      });

      // Data should be exactly what the resolver returned
      expect(result.current.data).toEqual(mockMetrics);
    });
  });
});
