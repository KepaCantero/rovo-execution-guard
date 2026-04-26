/**
 * @jest-environment jsdom
 */

/**
 * Tests for admin-dashboard/hooks/useProjectConfig.ts
 *
 * Verifies the hook fetches project config on mount, exposes saveConfig,
 * and manages independent loading/saving states.
 *
 * Pattern: AAA (Arrange-Act-Assert)
 * External dep: @forge/bridge mocked at module level [TEST-QA-202 exception]
 */

import { renderHook, act } from '@testing-library/react';
import { useProjectConfig } from '../../../../../src/frontend/custom-ui/admin-dashboard/hooks/useProjectConfig';
import type { ProjectConfig } from '../../../../../src/backend/types/project-config';

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

const mockConfig: ProjectConfig = {
  projectKey: 'PROJ',
  enabled: true,
  scoreThreshold: 80,
  gates: { definition: true, execution: true, delivery: false },
};

const updatedConfig: ProjectConfig = {
  projectKey: 'PROJ',
  enabled: true,
  scoreThreshold: 90,
  gates: { definition: true, execution: true, delivery: true },
};

const successResponse = <T>(data: T): { success: boolean; data: T; executionId: string } => ({
  success: true,
  data,
  executionId: 'res-test-123',
});

const voidSuccessResponse = (): { success: boolean; executionId: string } => ({
  success: true,
  executionId: 'res-test-789',
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

describe('useProjectConfig', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─── AC-01,05: Initial state and loading ──

  describe('initial state', () => {
    it('should start with loading=true, data=null, error=null, saving=false (AC-01, AC-05)', () => {
      mockInvoke.mockReturnValue(new Promise(() => undefined));
      const { result } = renderHook(() => useProjectConfig('PROJ'));

      expect(result.current.loading).toBe(true);
      expect(result.current.data).toBeNull();
      expect(result.current.error).toBeNull();
      expect(result.current.saving).toBe(false);
    });

    it('should expose a saveConfig function (AC-03)', () => {
      mockInvoke.mockReturnValue(new Promise(() => undefined));
      const { result } = renderHook(() => useProjectConfig('PROJ'));

      expect(typeof result.current.saveConfig).toBe('function');
    });
  });

  // ─── AC-02: Fetch config on mount ────────

  describe('fetch on mount', () => {
    it('should fetch config via invoke on mount (AC-02, UI-ADS-008)', async () => {
      mockInvoke.mockResolvedValue(successResponse(mockConfig));

      const { result } = renderHook(() => useProjectConfig('PROJ'));

      await act(async () => {
        await Promise.resolve();
      });

      expect(mockInvoke).toHaveBeenCalledWith('getProjectConfig', { projectKey: 'PROJ' });
      expect(result.current.data).toEqual(mockConfig);
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
    });
  });

  // ─── AC-03,13: Save config ───────────────

  describe('saveConfig', () => {
    it('should call updateProjectConfig resolver with config (AC-03, AC-13)', async () => {
      mockInvoke.mockResolvedValueOnce(successResponse(mockConfig));
      mockInvoke.mockResolvedValueOnce(voidSuccessResponse());

      const { result } = renderHook(() => useProjectConfig('PROJ'));

      await act(async () => {
        await Promise.resolve();
      });

      await act(async () => {
        await result.current.saveConfig(updatedConfig);
      });

      expect(mockInvoke).toHaveBeenCalledWith('updateProjectConfig', {
        projectKey: 'PROJ',
        config: updatedConfig,
      });
    });

    it('should update local data on successful save', async () => {
      mockInvoke.mockResolvedValueOnce(successResponse(mockConfig));
      mockInvoke.mockResolvedValueOnce(voidSuccessResponse());

      const { result } = renderHook(() => useProjectConfig('PROJ'));

      await act(async () => {
        await Promise.resolve();
      });

      await act(async () => {
        await result.current.saveConfig(updatedConfig);
      });

      expect(result.current.data).toEqual(updatedConfig);
    });

    it('should accept valid config with edge-case values (AC-12, SEC-PRIV-004)', async () => {
      const edgeConfig: ProjectConfig = {
        projectKey: 'PROJ',
        enabled: false,
        scoreThreshold: 0,
        gates: { definition: false, execution: false, delivery: false },
      };

      mockInvoke.mockResolvedValueOnce(successResponse(mockConfig));
      mockInvoke.mockResolvedValueOnce(voidSuccessResponse());

      const { result } = renderHook(() => useProjectConfig('PROJ'));

      await act(async () => {
        await Promise.resolve();
      });

      await act(async () => {
        await result.current.saveConfig(edgeConfig);
      });

      expect(mockInvoke).toHaveBeenCalledWith('updateProjectConfig', {
        projectKey: 'PROJ',
        config: edgeConfig,
      });
    });
  });

  // ─── AC-04,06: Independent loading/saving states ──

  describe('loading and saving states', () => {
    it('should track saving state independently from loading (AC-04, AC-06)', async () => {
      mockInvoke.mockResolvedValueOnce(successResponse(mockConfig));

      const { result } = renderHook(() => useProjectConfig('PROJ'));

      await act(async () => {
        await Promise.resolve();
      });

      // Loading done, saving false
      expect(result.current.loading).toBe(false);
      expect(result.current.saving).toBe(false);

      // Start save — saving becomes true
      let savePromise: Promise<void> = Promise.resolve();
      mockInvoke.mockReturnValueOnce(new Promise(() => undefined));

      await act(async () => {
        savePromise = result.current.saveConfig(updatedConfig);
      });

      // saving should be true during save
      expect(result.current.saving).toBe(true);
      expect(result.current.loading).toBe(false);

      // suppress unused — savePromise tracks in-flight save
      void savePromise;
    });
  });

  // ─── AC-07,08: Error handling ────────────

  describe('error handling', () => {
    it('should set error on fetch failure response (AC-07, AC-08)', async () => {
      mockInvoke.mockResolvedValue(errorResponse('Config not found'));

      const { result } = renderHook(() => useProjectConfig('PROJ'));

      await act(async () => {
        await Promise.resolve();
      });

      expect(result.current.error).toBe('Config not found');
      expect(result.current.data).toBeNull();
      expect(result.current.loading).toBe(false);
    });

    it('should set error on fetch invoke exception (AC-07)', async () => {
      mockInvoke.mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useProjectConfig('PROJ'));

      await act(async () => {
        await Promise.resolve();
      });

      expect(result.current.error).toBe('Network error');
      expect(result.current.loading).toBe(false);
    });

    it('should set error on save failure response (AC-07)', async () => {
      mockInvoke.mockResolvedValueOnce(successResponse(mockConfig));
      mockInvoke.mockResolvedValueOnce(errorResponse('Save failed'));

      const { result } = renderHook(() => useProjectConfig('PROJ'));

      await act(async () => {
        await Promise.resolve();
      });

      await act(async () => {
        await result.current.saveConfig(updatedConfig);
      });

      expect(result.current.error).toBe('Save failed');
      expect(result.current.saving).toBe(false);
    });

    it('should set error on save invoke exception (AC-07)', async () => {
      mockInvoke.mockResolvedValueOnce(successResponse(mockConfig));
      mockInvoke.mockRejectedValueOnce(new Error('Save timeout'));

      const { result } = renderHook(() => useProjectConfig('PROJ'));

      await act(async () => {
        await Promise.resolve();
      });

      await act(async () => {
        await result.current.saveConfig(updatedConfig);
      });

      expect(result.current.error).toBe('Save timeout');
      expect(result.current.saving).toBe(false);
    });

    it('should handle non-Error exceptions during fetch', async () => {
      mockInvoke.mockRejectedValue('string error');

      const { result } = renderHook(() => useProjectConfig('PROJ'));

      await act(async () => {
        await Promise.resolve();
      });

      expect(result.current.error).toBe('Failed to fetch project config');
    });

    it('should handle non-Error exceptions during save', async () => {
      mockInvoke.mockResolvedValueOnce(successResponse(mockConfig));
      mockInvoke.mockRejectedValueOnce(42);

      const { result } = renderHook(() => useProjectConfig('PROJ'));

      await act(async () => {
        await Promise.resolve();
      });

      await act(async () => {
        await result.current.saveConfig(updatedConfig);
      });

      expect(result.current.error).toBe('Failed to save project config');
    });

    it('should use default error message when resolver error is undefined', async () => {
      mockInvoke.mockResolvedValue({ success: false, executionId: 'res-x' });

      const { result } = renderHook(() => useProjectConfig('PROJ'));

      await act(async () => {
        await Promise.resolve();
      });

      expect(result.current.error).toBe('Failed to fetch project config');
    });
  });

  // ─── AC-09,10: Compliance ────────────────

  describe('compliance', () => {
    it('should be a named export (AC-10, ARCH-SOLID-232)', () => {
      expect(typeof useProjectConfig).toBe('function');
    });
  });

  // ─── SEC-PRIV-004: Input validation ───────

  describe('SEC-PRIV-004: input validation', () => {
    it('should reject config with empty projectKey', async () => {
      mockInvoke.mockResolvedValueOnce(successResponse(mockConfig));

      const { result } = renderHook(() => useProjectConfig('PROJ'));

      await act(async () => {
        await Promise.resolve();
      });

      const invalidConfig: ProjectConfig = {
        ...mockConfig,
        projectKey: '',
      };

      await act(async () => {
        await result.current.saveConfig(invalidConfig);
      });

      expect(result.current.error).toBe('Project key is required');
      expect(mockInvoke).toHaveBeenCalledTimes(1); // only the initial fetch
    });

    it('should reject config with whitespace-only projectKey', async () => {
      mockInvoke.mockResolvedValueOnce(successResponse(mockConfig));

      const { result } = renderHook(() => useProjectConfig('PROJ'));

      await act(async () => {
        await Promise.resolve();
      });

      const invalidConfig: ProjectConfig = {
        ...mockConfig,
        projectKey: '   ',
      };

      await act(async () => {
        await result.current.saveConfig(invalidConfig);
      });

      expect(result.current.error).toBe('Project key is required');
    });

    it('should reject config with scoreThreshold below 0', async () => {
      mockInvoke.mockResolvedValueOnce(successResponse(mockConfig));

      const { result } = renderHook(() => useProjectConfig('PROJ'));

      await act(async () => {
        await Promise.resolve();
      });

      const invalidConfig: ProjectConfig = {
        ...mockConfig,
        scoreThreshold: -1,
      };

      await act(async () => {
        await result.current.saveConfig(invalidConfig);
      });

      expect(result.current.error).toBe('Score threshold must be between 0 and 100');
    });

    it('should reject config with scoreThreshold above 100', async () => {
      mockInvoke.mockResolvedValueOnce(successResponse(mockConfig));

      const { result } = renderHook(() => useProjectConfig('PROJ'));

      await act(async () => {
        await Promise.resolve();
      });

      const invalidConfig: ProjectConfig = {
        ...mockConfig,
        scoreThreshold: 101,
      };

      await act(async () => {
        await result.current.saveConfig(invalidConfig);
      });

      expect(result.current.error).toBe('Score threshold must be between 0 and 100');
    });

    it('should accept config with scoreThreshold at boundaries (0 and 100)', async () => {
      mockInvoke.mockResolvedValueOnce(successResponse(mockConfig));
      mockInvoke.mockResolvedValueOnce(voidSuccessResponse());

      const { result } = renderHook(() => useProjectConfig('PROJ'));

      await act(async () => {
        await Promise.resolve();
      });

      const boundaryConfig: ProjectConfig = {
        ...mockConfig,
        scoreThreshold: 100,
      };

      await act(async () => {
        await result.current.saveConfig(boundaryConfig);
      });

      expect(result.current.error).toBeNull();
      expect(mockInvoke).toHaveBeenCalledTimes(2);
    });
  });

  // ─── REGLA: SEC-PRIV-0792 ────────────────

  describe('SEC-PRIV-0792: no silent errors', () => {
    it('should never leave error as null when fetch fails', async () => {
      mockInvoke.mockRejectedValue(new Error('fail'));

      const { result } = renderHook(() => useProjectConfig('PROJ'));

      await act(async () => {
        await Promise.resolve();
      });

      expect(result.current.error).not.toBeNull();
    });
  });

  // ─── REGLA: ARCH-SOLID-004 ───────────────

  describe('ARCH-SOLID-004: no business logic', () => {
    it('should not transform config data from resolver', async () => {
      mockInvoke.mockResolvedValue(successResponse(mockConfig));

      const { result } = renderHook(() => useProjectConfig('PROJ'));

      await act(async () => {
        await Promise.resolve();
      });

      expect(result.current.data).toEqual(mockConfig);
    });
  });
});
