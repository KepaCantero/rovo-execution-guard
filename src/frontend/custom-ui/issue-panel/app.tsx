import React from 'react';
import { createRoot } from 'react-dom/client';
import { invoke, view, rovo } from '@forge/bridge';

interface ScoreAxes {
  readonly clarity: number;
  readonly consistency: number;
  readonly risk: number;
  readonly documentation: number;
  readonly technicalDebt: number;
}

interface AxisDetail {
  readonly score: number;
  readonly label: string;
  readonly suggestions: readonly string[];
}

interface TicketContext {
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

const AXIS_DESCRIPTIONS: Record<string, string> = {
  clarity: 'How clear and unambiguous the ticket description is',
  consistency: 'Alignment between summary and description',
  risk: 'Risk exposure from missing fields or vague language',
  documentation: 'Completeness of documentation and references',
  technicalDebt: 'Scoping quality and absence of debt indicators',
};

const buildRovoPrompt = (
  axisKey: string,
  detail: AxisDetail,
  axes: ScoreAxes,
  ticketContext: TicketContext,
): string => {
  const pct = Math.round(detail.score);
  const descPreview = ticketContext.description.slice(0, 500);
  return [
    `You are a quality advisor for Jira tickets in the Rovo Execution Guard app.`,
    `Analyze this Jira issue and suggest specific improvements for the "${detail.label}" axis.`,
    '',
    `What ${detail.label} measures: ${AXIS_DESCRIPTIONS[axisKey]}`,
    '',
    `Current ${detail.label} score: ${pct}%`,
    `Project quality threshold: ${ticketContext.scoreThreshold}%`,
    `Quality gates enabled: definition=${ticketContext.gates.definition}, execution=${ticketContext.gates.execution}, delivery=${ticketContext.gates.delivery}`,
    '',
    `Issue: ${ticketContext.issueKey}`,
    `Summary: ${ticketContext.summary}`,
    `Description: ${descPreview}${ticketContext.description.length > 500 ? '...' : ''}`,
    '',
    `All axis scores: clarity=${Math.round(axes.clarity)}%, consistency=${Math.round(axes.consistency)}%, risk=${Math.round(axes.risk)}%, documentation=${Math.round(axes.documentation)}%, technicalDebt=${Math.round(axes.technicalDebt)}%`,
    '',
    "Provide 3-5 specific, actionable suggestions to improve this ticket's " +
      detail.label +
      ' score. Be concrete and reference the actual ticket content.',
  ].join('\n');
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
      const prompt = buildRovoPrompt(axisKey, detail, axes, ticketContext);
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
