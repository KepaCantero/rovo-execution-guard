import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@forge/bridge';
import type { ResolverResponse } from '../../../../backend/resolvers/index';
import type { GraphStats } from '../../../../backend/types/relationship-index';
import type { GraphHealthReport } from '../../../../backend/services/relationship-index/graph-maintenance';

interface RelationshipIndexState {
  readonly health: GraphHealthReport | null;
  readonly loading: boolean;
  readonly error: string | null;
  readonly refreshing: boolean;
  readonly refresh: () => void;
  readonly bootstrap: () => Promise<void>;
}

export function useRelationshipIndex(projectKey: string): RelationshipIndexState {
  const [health, setHealth] = useState<GraphHealthReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchHealth = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await invoke<ResolverResponse<GraphHealthReport>>('getGraphHealth', {
        projectKey,
      });
      if (response.success && response.data) {
        setHealth(response.data);
      } else {
        setError(response.error ?? 'Failed to fetch graph health');
        setHealth(null);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to fetch graph health';
      setError(message);
      setHealth(null);
    } finally {
      setLoading(false);
    }
  }, [projectKey]);

  useEffect(() => {
    let cancelled = false;
    void fetchHealth().then(() => {
      if (cancelled) return;
    });
    return () => {
      cancelled = true;
    };
  }, [fetchHealth]);

  const refresh = useCallback(() => {
    setRefreshing(true);
    void fetchHealth().finally(() => setRefreshing(false));
  }, [fetchHealth]);

  const bootstrap = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      const response = await invoke<ResolverResponse<GraphStats>>('bootstrapIndex', {
        projectKey,
      });
      if (!response.success) {
        setError(response.error ?? 'Bootstrap failed');
      }
      await fetchHealth();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Bootstrap failed';
      setError(message);
    } finally {
      setRefreshing(false);
    }
  }, [projectKey, fetchHealth]);

  return { health, loading, error, refreshing, refresh, bootstrap };
}
