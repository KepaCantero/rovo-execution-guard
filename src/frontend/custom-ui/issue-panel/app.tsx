import React from 'react';
import { createRoot } from 'react-dom/client';
import { invoke, view, rovo } from '@forge/bridge';

// [ARCH-SOLID-202] Discriminated union for severity — zero any
export type PromptSeverity = 'critical' | 'improvable' | 'optimal';

// [ARCH-SOLID-231] UPPER_SNAKE_CASE for constants
// [ARCH-SOLID-232] Named exports only
export const AGENT_KEY = 'consistency-guard';

export const SEVERITY_LABELS: Record<PromptSeverity, string> = {
  critical: 'Fix now',
  improvable: 'Improve',
  optimal: 'Optimize',
} as const;

export interface ScoreAxes {
  readonly clarity: number;
  readonly consistency: number;
  readonly risk: number;
  readonly documentation: number;
  readonly technicalDebt: number;
}

export interface AxisDetail {
  readonly score: number;
  readonly label: string;
  readonly suggestions: readonly string[];
}

export interface TicketContext {
  readonly issueKey: string;
  readonly summary: string;
  readonly description: string;
  readonly projectKey: string;
  readonly scoreThreshold: number;
  readonly gates: {
    readonly definition: boolean;
    readonly execution: boolean;
    readonly delivery: boolean;
  };
}

interface ConsistencyScore {
  readonly overall: number;
  readonly axes: ScoreAxes;
  readonly axisDetails?: Record<string, AxisDetail>;
  readonly ticketContext?: TicketContext;
  readonly timestamp: string;
  readonly executionId: string;
}

interface ResolverResponse<T> {
  readonly success: boolean;
  readonly data?: T;
  readonly error?: string;
  readonly executionId: string;
}

const AXIS_KEYS = ['clarity', 'consistency', 'risk', 'documentation', 'technicalDebt'] as const;

// [ARCH-SOLID-205] Explicit return type
// [ARCH-SOLID-232] Named export for testing
export const buildRovoPrompt = (
  axisKey: string,
  detail: AxisDetail,
  axes: ScoreAxes,
  ticketContext: TicketContext,
): { prompt: string; severity: PromptSeverity } => {
  const pct = Math.round(detail.score);
  const threshold = ticketContext.scoreThreshold;

  // [ROVO-INTEG-060] CRITICAL (< 40%): Urgent prompt demanding immediate fixes
  if (pct < 40) {
    return {
      severity: 'critical',
      prompt: [
        `URGENT: The "${detail.label}" score for ${ticketContext.issueKey} is critically low at ${pct}%.`,
        `This is blocking workflow transitions. The project threshold is ${threshold}%.`,
        `Current suggestions: ${detail.suggestions.join('; ')}`,
        `Provide 3-5 IMMEDIATE fixes to raise this score above ${threshold}%.`,
        `Issue summary: ${ticketContext.summary}`,
      ].join('\n'),
    };
  }

  // [ROVO-INTEG-060] IMPROVABLE (40% to threshold): Targeted improvement prompt
  if (pct < threshold) {
    return {
      severity: 'improvable',
      prompt: [
        `The "${detail.label}" score for ${ticketContext.issueKey} is ${pct}%, below the ${threshold}% threshold.`,
        `Current suggestions: ${detail.suggestions.join('; ')}`,
        `Suggest specific improvements to reach ${threshold}%.`,
        `Issue summary: ${ticketContext.summary}`,
      ].join('\n'),
    };
  }

  // [ROVO-INTEG-060] OPTIMAL (>= threshold): Optimization prompt
  return {
    severity: 'optimal',
    prompt: [
      `The "${detail.label}" score for ${ticketContext.issueKey} is ${pct}% (above ${threshold}% threshold).`,
      `Are there further optimizations to push this score higher?`,
      `Issue summary: ${ticketContext.summary}`,
    ].join('\n'),
  };
};

const RovoButton = ({
  axisKey,
  detail,
  axes,
  ticketContext,
}: {
  axisKey: string;
  detail: AxisDetail;
  axes: ScoreAxes;
  ticketContext: TicketContext;
}): React.ReactElement => {
  const [rovoStatus, setRovoStatus] = React.useState<'idle' | 'opening' | 'error'>('idle');

  const handleAskRovo = async (): Promise<void> => {
    setRovoStatus('opening');
    try {
      const { prompt } = buildRovoPrompt(axisKey, detail, axes, ticketContext);
      await rovo.open({ type: 'default', prompt });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[REG-Rovo] Failed to open Rovo:', err);
      setRovoStatus('error');
    }
  };

  const isOpening = rovoStatus === 'opening';
  return (
    <>
      <button
        onClick={handleAskRovo}
        disabled={isOpening}
        style={{
          marginTop: '8px',
          padding: '4px 12px',
          fontSize: '12px',
          border: '1px solid #0052CC',
          borderRadius: '3px',
          background: 'transparent',
          color: '#0052CC',
          cursor: isOpening ? 'wait' : 'pointer',
          opacity: isOpening ? 0.6 : 1,
        }}
      >
        {isOpening ? 'Opening Rovo...' : 'Ask Rovo for suggestions'}
      </button>
      {rovoStatus === 'error' && (
        <div style={{ marginTop: '4px', fontSize: '12px', color: '#FF5630' }}>
          Could not open Rovo. Make sure Rovo is enabled for your site.
        </div>
      )}
    </>
  );
};

const scoreColor = (pct: number): string =>
  pct >= 80 ? '#36B37E' : pct >= 60 ? '#FF991F' : '#FF5630';

const AxisRow = ({
  axisKey,
  detail,
  axes,
  ticketContext,
  rovoEnabled,
}: {
  axisKey: string;
  detail: AxisDetail;
  axes: ScoreAxes;
  ticketContext?: TicketContext;
  rovoEnabled: boolean;
}): React.ReactElement => {
  const [expanded, setExpanded] = React.useState(false);
  const pct = Math.round(detail.score);
  const color = scoreColor(pct);

  return (
    <div style={{ marginBottom: '4px' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '4px',
          cursor: 'pointer',
          padding: '4px 0',
        }}
        onClick={() => setExpanded(!expanded)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span
            style={{
              fontSize: '10px',
              color: '#6B778C',
              transition: 'transform 0.15s',
              transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
            }}
          >
            &#9654;
          </span>
          <span style={{ fontWeight: expanded ? 600 : 400 }}>{detail.label}</span>
        </div>
        <span style={{ color, fontWeight: 600 }}>{pct}%</span>
      </div>
      <div style={{ background: '#DFE1E6', borderRadius: '3px', height: '4px' }}>
        <div
          style={{
            background: color,
            borderRadius: '3px',
            height: '4px',
            width: `${pct}%`,
            transition: 'width 0.3s',
          }}
        />
      </div>
      {expanded && (
        <div style={{ marginTop: '8px', paddingLeft: '16px', fontSize: '13px' }}>
          {detail.suggestions.map((s, i) => (
            <div key={i} style={{ marginBottom: '4px', color: '#172B4D' }}>
              &bull; {s}
            </div>
          ))}
          {rovoEnabled && ticketContext && (
            <RovoButton
              axisKey={axisKey}
              detail={detail}
              axes={axes}
              ticketContext={ticketContext}
            />
          )}
        </div>
      )}
    </div>
  );
};

const IssuePanel = (): React.ReactElement => {
  const [score, setScore] = React.useState<ConsistencyScore | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [rovoEnabled, setRovoEnabled] = React.useState(false);

  React.useEffect(() => {
    const init = async (): Promise<void> => {
      try {
        const enabled = await rovo.isEnabled();
        setRovoEnabled(enabled);
      } catch {
        setRovoEnabled(false);
      }
    };
    void init();
  }, []);

  React.useEffect(() => {
    const fetchScore = async (): Promise<void> => {
      try {
        const ctx = await view.getContext();
        const issueKey =
          (ctx.extension as { issue?: { key?: string } })?.issue?.key ??
          (ctx.extension as { issueKey?: string })?.issueKey;

        if (!issueKey) {
          setError('Unable to determine issue key');
          return;
        }

        const response = await invoke<ResolverResponse<ConsistencyScore>>('getConsistencyScore', {
          issueKey,
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
    return <div style={{ padding: '16px', textAlign: 'center', color: '#6B778C' }}>Loading...</div>;
  }

  if (error) {
    return <div style={{ padding: '16px', color: '#FF5630' }}>Error: {error}</div>;
  }

  if (!score) {
    return <div style={{ padding: '16px', color: '#6B778C' }}>No consistency data available.</div>;
  }

  const percentage = Math.round(score.overall);
  const color = percentage >= 80 ? '#36B37E' : percentage >= 60 ? '#FF991F' : '#FF5630';
  const details = score.axisDetails;

  return (
    <div
      style={{
        padding: '16px',
        fontFamily: '-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif',
        fontSize: '14px',
      }}
    >
      <h3 style={{ marginBottom: '12px', fontSize: '16px' }}>Consistency Score</h3>
      <div style={{ textAlign: 'center', marginBottom: '16px' }}>
        <div style={{ fontSize: '48px', fontWeight: 'bold', color }}>{percentage}%</div>
        <div style={{ color: '#6B778C', fontSize: '13px' }}>Overall Consistency</div>
      </div>
      {details &&
        AXIS_KEYS.map((key) => {
          const detail = details[key];
          if (!detail) return null;
          return (
            <AxisRow
              key={key}
              axisKey={key}
              detail={detail}
              axes={score.axes}
              ticketContext={score.ticketContext}
              rovoEnabled={rovoEnabled}
            />
          );
        })}
    </div>
  );
};

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<IssuePanel />);
}
