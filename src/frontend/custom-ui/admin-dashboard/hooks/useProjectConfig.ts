// [ARCH-SOLID-058] Container hook for ConfigurationTab — manages project config CRUD via resolvers
// [UI-ADS-008] All data via invoke() from @forge/bridge — no direct HTTP
// [UI-ADS-201] Hooks at top level only — no conditional/loop hooks
// [UI-ADS-202] Container layer — separate from presentational components
// [ARCH-SOLID-004] No business logic — state management + invoke only
// [SEC-PRIV-004] Input validation on saveConfig — security boundary check, not business logic
// [ARCH-SOLID-202] Zero any usage
// [ARCH-SOLID-232] Named exports only
// [ARCH-SOLID-205] Explicit return types

import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@forge/bridge';
import type { ProjectConfig } from '../../../../backend/types/project-config';
import type { ResolverResponse } from '../../../../backend/resolvers/index';

// ═══════════════════════════════════════════
// RETURN TYPE
// ═══════════════════════════════════════════

/** [ARCH-SOLID-203] Return type for useProjectConfig hook */
interface UseProjectConfigReturn {
  readonly data: ProjectConfig | null;
  readonly loading: boolean;
  readonly error: string | null;
  readonly saving: boolean;
  readonly saveConfig: (config: ProjectConfig) => Promise<void>;
}

// ═══════════════════════════════════════════
// VALIDATION [SEC-PRIV-004]
// ═══════════════════════════════════════════

/** [SEC-PRIV-004] Validates ProjectConfig before sending to resolver */
function validateConfig(config: ProjectConfig): string | null {
  if (!config.projectKey || config.projectKey.trim().length === 0) {
    return 'Project key is required';
  }
  if (
    typeof config.scoreThreshold !== 'number' ||
    config.scoreThreshold < 0 ||
    config.scoreThreshold > 100
  ) {
    return 'Score threshold must be between 0 and 100';
  }
  if (!config.gates || typeof config.gates !== 'object') {
    return 'Gate configuration is required';
  }
  return null;
}

// ═══════════════════════════════════════════
// HOOK
// ═══════════════════════════════════════════

/**
 * Fetches and persists project configuration for the Admin Dashboard.
 * [UI-ADS-008] Uses invoke() exclusively.
 * [SEC-PRIV-004] Validates config before invoking resolver.
 *
 * AC ref: AC-01..AC-13 of useProjectConfig.reqs.md
 *
 * @param projectKey - The project key to fetch/save config for
 * @returns Config state, loading, error, saving, and saveConfig callback
 */
export function useProjectConfig(projectKey: string): UseProjectConfigReturn {
  const [data, setData] = useState<ProjectConfig | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<boolean>(false);

  // [UI-ADS-201] Hook at top level — fetch config on mount
  useEffect(() => {
    let cancelled = false;

    const fetchConfig = async (): Promise<void> => {
      setLoading(true);
      setError(null);

      try {
        const response = await invoke<ResolverResponse<ProjectConfig>>('getProjectConfig', {
          projectKey,
        });

        if (cancelled) return;

        // [ARCH-SOLID-004] Check success before extracting data
        if (response.success && response.data) {
          setData(response.data);
        } else {
          // [SEC-PRIV-0792] Surface error, never swallow
          setError(response.error ?? 'Failed to fetch project config');
          setData(null);
        }
      } catch (err: unknown) {
        if (cancelled) return;
        // [FORGE-OPS-005] Handle resolver timeout/network errors
        const message = err instanceof Error ? err.message : 'Failed to fetch project config';
        setError(message);
        setData(null);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void fetchConfig();

    return (): void => {
      cancelled = true;
    };
  }, [projectKey]);

  /**
   * Saves project configuration via resolver.
   * [SEC-PRIV-004] Validates config before sending to resolver.
   */
  const saveConfig = useCallback(
    async (config: ProjectConfig): Promise<void> => {
      // [SEC-PRIV-004] Validate external input before processing
      const validationError = validateConfig(config);
      if (validationError) {
        setError(validationError);
        return;
      }

      setSaving(true);
      setError(null);

      try {
        const response = await invoke<ResolverResponse<void>>('updateProjectConfig', {
          projectKey,
          config,
        });

        // [ARCH-SOLID-004] Check success
        if (response.success) {
          setData(config);
        } else {
          // [SEC-PRIV-0792] Surface error, never swallow
          setError(response.error ?? 'Failed to save project config');
        }
      } catch (err: unknown) {
        // [FORGE-OPS-005] Handle resolver timeout/network errors
        const message = err instanceof Error ? err.message : 'Failed to save project config';
        setError(message);
      } finally {
        setSaving(false);
      }
    },
    [projectKey],
  );

  return { data, loading, error, saving, saveConfig };
}
