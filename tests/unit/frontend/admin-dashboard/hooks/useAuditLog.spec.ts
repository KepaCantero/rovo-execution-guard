/**
 * @jest-environment jsdom
 */

/**
 * Tests for admin-dashboard/hooks/useAuditLog.ts
 *
 * Verifies the hook fetches audit log entries with server-side pagination,
 * accumulates results on loadMore, and manages loading/error states.
 *
 * Pattern: AAA (Arrange-Act-Assert)
 * External dep: @forge/bridge mocked at module level [TEST-QA-202 exception]
 */

import { renderHook, act } from '@testing-library/react';
import { useAuditLog } from '../../../../../src/frontend/custom-ui/admin-dashboard/hooks/useAuditLog';
import type { AuditLogEntry } from '../../../../../src/backend/types/audit-log';

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

const createEntry = (id: string): AuditLogEntry => ({
  id,
  action: 'gate_evaluated',
  timestamp: '2026-04-25T10:00:00Z',
  executionId: `exec-${id}`,
  projectKey: 'PROJ',
  ticketKey: 'PROJ-123',
  details: { score: 85 },
});

const createEntries = (count: number, startId: number = 0): AuditLogEntry[] =>
  Array.from({ length: count }, (_, i) => createEntry(`entry-${startId + i}`));

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

describe('useAuditLog', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─── AC-01,06,13: Initial state ──────────

  describe('initial state', () => {
    it('should start with loading=true, data=[], error=null (AC-01, AC-06, AC-13)', () => {
      mockInvoke.mockReturnValue(new Promise(() => undefined));
      const { result } = renderHook(() => useAuditLog('PROJ'));

      expect(result.current.loading).toBe(true);
      expect(result.current.data).toEqual([]);
      expect(result.current.error).toBeNull();
    });

    it('should start with pagination at offset 0 (AC-05)', () => {
      mockInvoke.mockReturnValue(new Promise(() => undefined));
      const { result } = renderHook(() => useAuditLog('PROJ'));

      expect(result.current.pagination.offset).toBe(0);
      expect(result.current.pagination.limit).toBe(20);
      expect(result.current.pagination.hasMore).toBe(false);
    });

    it('should respect custom pageSize parameter', () => {
      mockInvoke.mockReturnValue(new Promise(() => undefined));
      const { result } = renderHook(() => useAuditLog('PROJ', 50));

      expect(result.current.pagination.limit).toBe(50);
    });

    it('should expose a loadMore function (AC-04)', () => {
      mockInvoke.mockReturnValue(new Promise(() => undefined));
      const { result } = renderHook(() => useAuditLog('PROJ'));

      expect(typeof result.current.loadMore).toBe('function');
    });
  });

  // ─── AC-02,03: Fetch on mount ────────────

  describe('fetch on mount', () => {
    it('should fetch audit log via invoke on mount (AC-02, UI-ADS-008)', async () => {
      const entries = createEntries(10);
      mockInvoke.mockResolvedValue(successResponse(entries));

      const { result } = renderHook(() => useAuditLog('PROJ'));

      await act(async () => {
        await Promise.resolve();
      });

      expect(mockInvoke).toHaveBeenCalledWith('getAuditLog', {
        projectKey: 'PROJ',
        limit: 20,
        offset: 0,
      });
      expect(result.current.data).toEqual(entries);
      expect(result.current.loading).toBe(false);
    });

    it('should pass limit parameter for server-side pagination (AC-03, FORGE-OPS-005)', async () => {
      mockInvoke.mockResolvedValue(successResponse(createEntries(5)));

      renderHook(() => useAuditLog('PROJ', 50));

      await act(async () => {
        await Promise.resolve();
      });

      expect(mockInvoke).toHaveBeenCalledWith('getAuditLog', {
        projectKey: 'PROJ',
        limit: 50,
        offset: 0,
      });
    });
  });

  // ─── AC-04,05,13: Pagination ─────────────

  describe('pagination', () => {
    it('should set hasMore=true when entries fill the page (AC-05)', async () => {
      const entries = createEntries(20);
      mockInvoke.mockResolvedValue(successResponse(entries));

      const { result } = renderHook(() => useAuditLog('PROJ', 20));

      await act(async () => {
        await Promise.resolve();
      });

      expect(result.current.pagination.hasMore).toBe(true);
      expect(result.current.pagination.total).toBe(20); // offset(0) + entries.length(20)
    });

    it('should set hasMore=false when entries do not fill the page (AC-05)', async () => {
      const entries = createEntries(5);
      mockInvoke.mockResolvedValue(successResponse(entries));

      const { result } = renderHook(() => useAuditLog('PROJ', 20));

      await act(async () => {
        await Promise.resolve();
      });

      expect(result.current.pagination.hasMore).toBe(false);
    });

    it('should loadMore and append results (AC-04, AC-13)', async () => {
      const firstPage = createEntries(20, 0);
      const secondPage = createEntries(10, 20);

      mockInvoke.mockResolvedValueOnce(successResponse(firstPage));

      const { result } = renderHook(() => useAuditLog('PROJ', 20));

      await act(async () => {
        await Promise.resolve();
      });

      expect(result.current.data).toEqual(firstPage);
      expect(result.current.data).toHaveLength(20);

      mockInvoke.mockResolvedValueOnce(successResponse(secondPage));

      await act(async () => {
        result.current.loadMore();
        await Promise.resolve();
      });

      // Should have passed offset=20 (data.length) to invoke
      expect(mockInvoke).toHaveBeenLastCalledWith('getAuditLog', {
        projectKey: 'PROJ',
        limit: 20,
        offset: 20,
      });

      // Should have accumulated entries
      expect(result.current.data).toHaveLength(30);
      expect(result.current.data.slice(0, 20)).toEqual(firstPage);
      expect(result.current.data.slice(20)).toEqual(secondPage);
    });

    it('should not loadMore when hasMore is false (AC-05)', async () => {
      const entries = createEntries(5);
      mockInvoke.mockResolvedValueOnce(successResponse(entries));

      const { result } = renderHook(() => useAuditLog('PROJ', 20));

      await act(async () => {
        await Promise.resolve();
      });

      expect(result.current.pagination.hasMore).toBe(false);

      await act(async () => {
        result.current.loadMore();
      });

      // Should not have made another call
      expect(mockInvoke).toHaveBeenCalledTimes(1);
    });

    it('should track accumulated total across pages (AC-05)', async () => {
      const firstPage = createEntries(20, 0);
      const secondPage = createEntries(10, 20);

      mockInvoke.mockResolvedValueOnce(successResponse(firstPage));

      const { result } = renderHook(() => useAuditLog('PROJ', 20));

      await act(async () => {
        await Promise.resolve();
      });

      expect(result.current.pagination.total).toBe(20); // 0 + 20

      mockInvoke.mockResolvedValueOnce(successResponse(secondPage));

      await act(async () => {
        result.current.loadMore();
        await Promise.resolve();
      });

      expect(result.current.pagination.total).toBe(30); // 20 + 10
      expect(result.current.pagination.offset).toBe(20);
    });
  });

  // ─── AC-07,08: Error handling ────────────

  describe('error handling', () => {
    it('should set error on resolver failure response (AC-07, AC-08)', async () => {
      mockInvoke.mockResolvedValue(errorResponse('Access denied'));

      const { result } = renderHook(() => useAuditLog('PROJ'));

      await act(async () => {
        await Promise.resolve();
      });

      expect(result.current.error).toBe('Access denied');
      expect(result.current.loading).toBe(false);
    });

    it('should set error on invoke exception (AC-07)', async () => {
      mockInvoke.mockRejectedValue(new Error('Network timeout'));

      const { result } = renderHook(() => useAuditLog('PROJ'));

      await act(async () => {
        await Promise.resolve();
      });

      expect(result.current.error).toBe('Network timeout');
      expect(result.current.loading).toBe(false);
    });

    it('should handle non-Error exceptions (AC-07)', async () => {
      mockInvoke.mockRejectedValue('string error');

      const { result } = renderHook(() => useAuditLog('PROJ'));

      await act(async () => {
        await Promise.resolve();
      });

      expect(result.current.error).toBe('Failed to fetch audit log');
    });

    it('should use default error message when resolver error is undefined', async () => {
      mockInvoke.mockResolvedValue({ success: false, executionId: 'res-x' });

      const { result } = renderHook(() => useAuditLog('PROJ'));

      await act(async () => {
        await Promise.resolve();
      });

      expect(result.current.error).toBe('Failed to fetch audit log');
    });
  });

  // ─── AC-10: Compliance ───────────────────

  describe('compliance', () => {
    it('should be a named export (AC-10, ARCH-SOLID-232)', () => {
      expect(typeof useAuditLog).toBe('function');
    });
  });

  // ─── REGLA: SEC-PRIV-0792 ────────────────

  describe('SEC-PRIV-0792: no silent errors', () => {
    it('should never leave error as null when fetch fails', async () => {
      mockInvoke.mockRejectedValue(new Error('fail'));

      const { result } = renderHook(() => useAuditLog('PROJ'));

      await act(async () => {
        await Promise.resolve();
      });

      expect(result.current.error).not.toBeNull();
    });
  });

  // ─── REGLA: ARCH-SOLID-004 ───────────────

  describe('ARCH-SOLID-004: no business logic', () => {
    it('should not transform entries from resolver', async () => {
      const entries = createEntries(3);
      mockInvoke.mockResolvedValue(successResponse(entries));

      const { result } = renderHook(() => useAuditLog('PROJ'));

      await act(async () => {
        await Promise.resolve();
      });

      expect(result.current.data).toEqual(entries);
    });
  });

  // ─── Empty response ──────────────────────

  describe('empty response', () => {
    it('should handle empty array from resolver', async () => {
      mockInvoke.mockResolvedValue(successResponse([]));

      const { result } = renderHook(() => useAuditLog('PROJ'));

      await act(async () => {
        await Promise.resolve();
      });

      expect(result.current.data).toEqual([]);
      expect(result.current.pagination.hasMore).toBe(false);
      expect(result.current.loading).toBe(false);
    });
  });
});
