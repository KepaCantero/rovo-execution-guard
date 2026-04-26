import React from 'react';
import { createRoot } from 'react-dom/client';
import { invoke } from '@forge/bridge';

// Matches ConsistencyScore from src/backend/types/consistency-score.ts
interface ConsistencyScore {
  readonly overall: number;
  readonly axes: {
    readonly clarity: number;
    readonly consistency: number;
    readonly risk: number;
    readonly documentation: number;
    readonly technicalDebt: number;
  };
  readonly timestamp: string;
  readonly executionId: string;
}

interface ResolverResponse<T> {
  readonly success: boolean;
  readonly data?: T;
  readonly error?: string;
  readonly executionId: string;
}

const IssuePanel = (): React.ReactElement => {
  const [score, setScore] = React.useState<ConsistencyScore | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const fetchScore = async (): Promise<void> => {
      try {
        // The issue panel context provides issueKey via Forge bridge
        const context = await invoke<{ issueKey?: string }>('getContext');
        if (!context?.issueKey) {
          setError('Unable to determine issue key');
          return;
        }

        const response = await invoke<ResolverResponse<ConsistencyScore>>('getConsistencyScore', {
          issueKey: context.issueKey,
        });

        if (response.success && response.data) {
          setScore(response.data);
        } else {
          setError(response.error ?? 'Failed to fetch consistency score');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load score');
      } finally {
        setLoading(false);
      }
    };
    void fetchScore();
  }, []);

  if (loading) {
    return <div style={{ padding: '16px', textAlign: 'center' }}>Loading...</div>;
  }

  if (error) {
    return <div style={{ padding: '16px', color: 'red' }}>Error: {error}</div>;
  }

  if (!score) {
    return <div style={{ padding: '16px' }}>No consistency data available.</div>;
  }

  const percentage = Math.round(score.overall);
  const color = percentage >= 80 ? '#36B37E' : percentage >= 60 ? '#FF991F' : '#FF5630';

  const axisEntries = Object.entries(score.axes);

  return (
    <div
      style={{
        padding: '16px',
        fontFamily: '-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif',
      }}
    >
      <h3 style={{ marginBottom: '12px' }}>Consistency Score</h3>
      <div style={{ textAlign: 'center', marginBottom: '16px' }}>
        <div style={{ fontSize: '48px', fontWeight: 'bold', color }}>{percentage}%</div>
        <div style={{ color: '#6B778C', fontSize: '14px' }}>Overall Consistency</div>
      </div>
      {axisEntries.length > 0 && (
        <div>
          {axisEntries.map(([key, value]) => {
            const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase());
            const pct = Math.round(value);
            return (
              <div key={key} style={{ marginBottom: '8px' }}>
                <div
                  style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}
                >
                  <span>{label}</span>
                  <span>{pct}%</span>
                </div>
                <div style={{ background: '#DFE1E6', borderRadius: '3px', height: '6px' }}>
                  <div
                    style={{
                      background: color,
                      borderRadius: '3px',
                      height: '6px',
                      width: `${pct}%`,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<IssuePanel />);
}
