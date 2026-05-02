import React from 'react';
import { createRoot } from 'react-dom/client';
import { invoke, view, rovo } from '@forge/bridge';
import { token } from '@atlaskit/tokens';
import { getScoreColorToken, SCORE_COLOR_TOKENS } from '../admin-dashboard/styles/theme';
import { ErrorBoundaryWrapper } from '../../components/ErrorBoundary';
import { captureException, addErrorBreadcrumb } from '../../utils/sentry';

// [ARCH-SOLID-202] Discriminated union for severity — zero any
export type PromptSeverity = 'critical' | 'improvable' | 'optimal';

// [ARCH-SOLID-231] UPPER_SNAKE_CASE for constants
// [ARCH-SOLID-232] Named exports only
export const AGENT_KEY = 'consistency-guard';
export const AGENT_NAME = 'Consistency Guard';

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

// [ARCH-SOLID-232] Named export for testing
// [ROVO-INTEG-005] Timeout + graceful fallback via try-catch
export const RovoButton = ({
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

  // [ARCH-SOLID-205] Explicit return type via buildRovoPrompt
  const { prompt, severity } = React.useMemo(
    () => buildRovoPrompt(axisKey, detail, axes, ticketContext),
    [axisKey, detail, axes, ticketContext],
  );

  const handleAskRovo = async (): Promise<void> => {
    setRovoStatus('opening');
    try {
      // [TEST-QA-036-02] Breadcrumb before rovo.open
      // [SEC-PRIV-002] No PII in breadcrumbs — only axis key
      addErrorBreadcrumb({
        category: 'rovo',
        message: `Opening agent for axis ${axisKey}`,
        level: 'info',
      });
      // [ROVO-INTEG-001] AC-02: Open Consistency Guard agent via Forge Bridge
      await rovo.open({ type: 'forge', agentKey: AGENT_KEY, agentName: AGENT_NAME, prompt });
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      // [SEC-PRIV-002] No PII in breadcrumbs — only axis key
      addErrorBreadcrumb({
        category: 'rovo',
        message: `Failed to open agent for axis ${axisKey}`,
        level: 'error',
      });
      // [TEST-QA-036-01] Capture exception with context
      captureException(error, { issueKey: ticketContext.issueKey });
      setRovoStatus('error');
    }
  };

  const isOpening = rovoStatus === 'opening';

  // [UI-ADS-001] AC-03: Severity-based color via design tokens
  const colorToken =
    severity === 'critical'
      ? SCORE_COLOR_TOKENS.RED
      : severity === 'improvable'
        ? SCORE_COLOR_TOKENS.YELLOW
        : SCORE_COLOR_TOKENS.GREEN;
  const color = token(colorToken as Parameters<typeof token>[0]);

  return (
    <>
      <button
        onClick={handleAskRovo}
        disabled={isOpening}
        aria-label={`${SEVERITY_LABELS[severity]}: Ask agent about ${detail.label}`}
        style={{
          marginTop: '8px',
          padding: '4px 12px',
          fontSize: '12px',
          border: `1px solid ${color}`,
          borderRadius: '3px',
          background: 'transparent',
          color,
          cursor: isOpening ? 'wait' : 'pointer',
          opacity: isOpening ? 0.6 : 1,
        }}
      >
        {isOpening ? 'Opening...' : SEVERITY_LABELS[severity]}
      </button>
      {rovoStatus === 'error' && (
        <div
          style={{
            marginTop: '4px',
            fontSize: '12px',
            color: token(SCORE_COLOR_TOKENS.RED as Parameters<typeof token>[0]),
          }}
        >
          Could not open Rovo. Make sure Rovo is enabled for your site.
        </div>
      )}
    </>
  );
};

// [ARCH-SOLID-232] Named export for testing
// [ROVO-INTEG-005] Timeout + graceful fallback via try-catch
export const ReindexButton = ({
  projectKey,
}: {
  readonly projectKey: string;
}): React.ReactElement => {
  const [status, setStatus] = React.useState<'idle' | 'indexing' | 'done' | 'error'>('idle');

  const handleReindex = async (): Promise<void> => {
    setStatus('indexing');
    try {
      const response = await invoke<ResolverResponse<unknown>>('bootstrapIndex', { projectKey });
      if (response.success) {
        setStatus('done');
      } else {
        setStatus('error');
      }
    } catch {
      setStatus('error');
    }
  };

  if (status === 'done') {
    return (
      <button
        disabled
        style={{
          marginTop: '12px',
          marginRight: '8px',
          padding: '8px 16px',
          fontSize: '14px',
          border: '1px solid #36B37E',
          borderRadius: '3px',
          background: 'transparent',
          color: '#36B37E',
          cursor: 'default',
        }}
      >
        Indexed
      </button>
    );
  }

  const isIndexing = status === 'indexing';

  return (
    <>
      <button
        onClick={handleReindex}
        disabled={isIndexing}
        aria-label="Re-index relationship data for this project"
        style={{
          marginTop: '12px',
          marginRight: '8px',
          padding: '8px 16px',
          fontSize: '14px',
          border: '1px solid #0052CC',
          borderRadius: '3px',
          background: isIndexing ? '#0052CC' : 'transparent',
          color: isIndexing ? 'white' : '#0052CC',
          cursor: isIndexing ? 'wait' : 'pointer',
          opacity: isIndexing ? 0.7 : 1,
        }}
      >
        {isIndexing ? 'Indexing...' : 'Re-index'}
      </button>
      {status === 'error' && (
        <div style={{ marginTop: '4px', fontSize: '12px', color: '#FF5630' }}>
          Indexing failed. Try again.
        </div>
      )}
    </>
  );
};

export const FullAnalysisButton = ({
  score,
  rovoEnabled,
}: {
  readonly score: ConsistencyScore;
  readonly rovoEnabled: boolean;
}): React.ReactElement | null => {
  const [analysisStatus, setAnalysisStatus] = React.useState<'idle' | 'opening' | 'error'>('idle');
  const ticketContext = score.ticketContext;

  // [UI-ADS-201] Hooks at top level — early return AFTER useState
  if (!ticketContext) return null;

  const handleFullAnalysis = async (): Promise<void> => {
    setAnalysisStatus('opening');
    try {
      const overallPct = Math.round(score.overall);
      const prompt = [
        `Perform a full consistency evaluation for ${ticketContext.issueKey}: ${ticketContext.summary}`,
        `Current overall score: ${overallPct}%`,
        `Provide a comprehensive analysis with specific improvement recommendations.`,
      ].join('\n');

      addErrorBreadcrumb({
        category: 'rovo',
        message: 'Opening agent for full analysis',
        level: 'info',
      });
      await rovo.open({ type: 'forge', agentKey: AGENT_KEY, agentName: AGENT_NAME, prompt });
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      addErrorBreadcrumb({
        category: 'rovo',
        message: 'Failed to open agent for full analysis',
        level: 'error',
      });
      captureException(error, { issueKey: ticketContext.issueKey });
      setAnalysisStatus('error');
    }
  };

  if (!rovoEnabled) {
    return (
      <div style={{ marginTop: '12px', fontSize: '13px', color: '#6B778C' }}>
        Full Analysis — Rovo is not available in this environment
      </div>
    );
  }

  const isOpening = analysisStatus === 'opening';

  return (
    <button
      onClick={handleFullAnalysis}
      disabled={isOpening}
      aria-label="Run full consistency analysis with Rovo"
      style={{
        marginTop: '12px',
        padding: '8px 16px',
        fontSize: '14px',
        border: '1px solid #DFE1E6',
        borderRadius: '3px',
        background: 'transparent',
        cursor: isOpening ? 'wait' : 'pointer',
        opacity: isOpening ? 0.6 : 1,
      }}
    >
      {isOpening ? 'Analyzing...' : 'Full Analysis'}
    </button>
  );
};

export const AxisRow = ({
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
  // [UI-ADS-001] Design token for score color — replaces hex scoreColor function
  const color = token(getScoreColorToken(pct) as Parameters<typeof token>[0]);

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

export const IssuePanel = (): React.ReactElement => {
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
  // [UI-ADS-001] Design token for overall score color — replaces hex
  const color = token(getScoreColorToken(percentage) as Parameters<typeof token>[0]);
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
      <div style={{ display: 'flex', alignItems: 'center' }}>
        {score.ticketContext && <ReindexButton projectKey={score.ticketContext.projectKey} />}
        <FullAnalysisButton score={score} rovoEnabled={rovoEnabled} />
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

// [AC-06] [FORGE-OPS-0104] Wrap with ErrorBoundary for graceful degradation
const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(
    <ErrorBoundaryWrapper>
      <IssuePanel />
    </ErrorBoundaryWrapper>,
  );
}
