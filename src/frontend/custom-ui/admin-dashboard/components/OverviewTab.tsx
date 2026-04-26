// [ARCH-SOLID-004] Presentational component — all data via props, no business logic
// [ARCH-SOLID-232] Named export only — no default export
// [ARCH-SOLID-205] Explicit return type on exported component
// [UI-ADS-202] Presentational: data via props from parent container using useAdminData hook
// [FORGE-OPS-009] No charting library — inline SVG only
// [UI-ADS-001] All colors via @atlaskit/tokens design tokens
// [UI-ADS-205] useMemo for derived values, not useEffect

import { useMemo } from 'react';
import { token } from '@atlaskit/tokens';
import SectionMessage from '@atlaskit/section-message';
import Button from '@atlaskit/button';
import Spinner from '@atlaskit/spinner';

import type { OverviewTabProps } from '../types';
import { getScoreColorToken } from '../styles/theme';

// ═══════════════════════════════════════════
// CONSTANTS
// [ARCH-SOLID-231] UPPER_SNAKE_CASE for constants
// ═══════════════════════════════════════════

const CHART_BAR_HEIGHT = 24;
const CHART_BAR_GAP = 8;
const CHART_LABEL_WIDTH = 120;
const CHART_SVG_PADDING = 4;
const SCORE_DECIMALS = 1;
const PERCENTAGE_DECIMALS = 1;

const BREAKDOWN_LABELS: Readonly<Record<string, string>> = {
  contradiction: 'Contradiction',
  duplicate: 'Duplicate',
  missing_context: 'Missing Context',
  ambiguity: 'Ambiguity',
};

// ═══════════════════════════════════════════
// PRIVATE HELPERS
// ═══════════════════════════════════════════

/**
 * Formats a number as a fixed-decimal percentage string.
 * [UI-ADS-205] — pure function, no state
 */
function formatPercentage(value: number, decimals: number): string {
  return `${value.toFixed(decimals)}%`;
}

/**
 * Computes the blocked percentage from totals.
 * [UI-ADS-205] — derived value, computed via useMemo at call site
 */
function computeBlockedPercentage(totalBlocked: number, totalEvaluated: number): number {
  if (totalEvaluated <= 0) return 0;
  return (totalBlocked / totalEvaluated) * 100;
}

// ═══════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════

/**
 * OverviewTab — metrics dashboard with inline SVG chart.
 *
 * Displays ticket evaluation counts, block rates, PR blocking stats,
 * average quality score with color coding, and inconsistency type
 * breakdown as an inline SVG bar chart.
 *
 * AC ref: AC-02, AC-06, AC-07, AC-08 of RTASK-019
 * REGLA: UI-ADS-202 - presentational, data via props
 * REGLA: ARCH-SOLID-004 - no business logic
 */
export function OverviewTab(props: OverviewTabProps): React.ReactElement {
  const { metrics, loading, error, onRevalidate } = props;

  // [UI-ADS-205] useMemo for derived values — not useEffect
  const blockedPercentage = useMemo(
    () => computeBlockedPercentage(metrics?.totalBlocked ?? 0, metrics?.totalEvaluated ?? 0),
    [metrics?.totalBlocked, metrics?.totalEvaluated],
  );

  const scoreColorToken = useMemo(
    () => getScoreColorToken(metrics?.avgScore ?? 0),
    [metrics?.avgScore],
  );

  const scoreColor = useMemo(
    // theme.ts returns token name as `string`; cast to satisfy @atlaskit/tokens strict union type
    () => token(scoreColorToken as Parameters<typeof token>[0]),
    [scoreColorToken],
  );

  const breakdownEntries = useMemo(() => {
    if (!metrics?.inconsistencyBreakdown) return [];
    return Object.entries(metrics.inconsistencyBreakdown);
  }, [metrics?.inconsistencyBreakdown]);

  const maxBreakdownValue = useMemo(
    () => Math.max(...breakdownEntries.map(([, count]) => count), 1),
    [breakdownEntries],
  );

  // ─── Loading state [AC-01] ────────────
  if (loading) {
    return <Spinner testId="overview-loading" />;
  }

  // ─── Error state [AC-02] [SEC-PRIV-0792] ─
  if (error !== null) {
    return (
      <SectionMessage appearance="error" testId="overview-error">
        <p>{error}</p>
        <Button
          appearance="primary"
          onClick={() => onRevalidate('')}
          aria-label="Retry loading metrics"
          testId="overview-retry-button"
        >
          Retry
        </Button>
      </SectionMessage>
    );
  }

  // ─── Empty state [AC-04] ──────────────
  if (metrics === null) {
    return <p data-testid="overview-empty">No metrics data available.</p>;
  }

  // ─── Metrics display [AC-03] ──────────
  const chartWidth = CHART_LABEL_WIDTH + 200 + CHART_SVG_PADDING * 2;
  const chartHeight =
    breakdownEntries.length * (CHART_BAR_HEIGHT + CHART_BAR_GAP) + CHART_SVG_PADDING * 2;

  return (
    <section data-testid="overview-metrics" aria-label="Overview metrics dashboard">
      {/* Metric cards row */}
      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' as const }}>
        {/* Total Evaluated */}
        <div
          style={{
            flex: '1 1 150px',
            padding: '16px',
            border: `1px solid ${token('color.border')}`,
            borderRadius: '4px',
          }}
        >
          <div style={{ fontSize: '12px', color: token('color.text.subtlest') }}>
            Tickets Evaluated
          </div>
          <div style={{ fontSize: '24px', fontWeight: 600 }} data-testid="metric-total-evaluated">
            {metrics.totalEvaluated}
          </div>
        </div>

        {/* Total Blocked */}
        <div
          style={{
            flex: '1 1 150px',
            padding: '16px',
            border: `1px solid ${token('color.border')}`,
            borderRadius: '4px',
          }}
        >
          <div style={{ fontSize: '12px', color: token('color.text.subtlest') }}>
            Tickets Blocked
          </div>
          <div style={{ fontSize: '24px', fontWeight: 600 }} data-testid="metric-total-blocked">
            {metrics.totalBlocked}
            <span
              style={{ fontSize: '14px', marginLeft: '8px', color: token('color.text.subtlest') }}
              data-testid="metric-blocked-pct"
            >
              ({formatPercentage(blockedPercentage, PERCENTAGE_DECIMALS)})
            </span>
          </div>
        </div>

        {/* PRs Blocked */}
        <div
          style={{
            flex: '1 1 150px',
            padding: '16px',
            border: `1px solid ${token('color.border')}`,
            borderRadius: '4px',
          }}
        >
          <div style={{ fontSize: '12px', color: token('color.text.subtlest') }}>PRs Blocked</div>
          <div style={{ fontSize: '24px', fontWeight: 600 }} data-testid="metric-prs-blocked">
            {metrics.prsBlocked}
          </div>
        </div>

        {/* Average Score */}
        <div
          style={{
            flex: '1 1 150px',
            padding: '16px',
            border: `1px solid ${token('color.border')}`,
            borderRadius: '4px',
          }}
        >
          <div style={{ fontSize: '12px', color: token('color.text.subtlest') }}>
            Avg. Quality Score
          </div>
          <div
            style={{ fontSize: '24px', fontWeight: 600, color: scoreColor }}
            data-testid="metric-avg-score"
          >
            {metrics.avgScore.toFixed(SCORE_DECIMALS)}
          </div>
        </div>
      </div>

      {/* Inconsistency Breakdown — Inline SVG Bar Chart [AC-07] [FORGE-OPS-009] */}
      {breakdownEntries.length > 0 && (
        <div style={{ marginTop: '24px' }} data-testid="overview-breakdown">
          <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px' }}>
            Inconsistency Breakdown
          </h3>
          <svg
            width={chartWidth}
            height={chartHeight}
            viewBox={`0 0 ${chartWidth} ${chartHeight}`}
            role="img"
            aria-label="Inconsistency breakdown bar chart"
            data-testid="overview-svg-chart"
          >
            {breakdownEntries.map(([type, count], index) => {
              const barMaxWidth = 200;
              const barWidth = Math.max((count / maxBreakdownValue) * barMaxWidth, 0);
              const y = index * (CHART_BAR_HEIGHT + CHART_BAR_GAP) + CHART_SVG_PADDING;
              return (
                <g key={type} data-testid={`chart-bar-${type}`}>
                  <text
                    x={CHART_LABEL_WIDTH - 8}
                    y={y + CHART_BAR_HEIGHT / 2}
                    textAnchor="end"
                    dominantBaseline="central"
                    fill={token('color.text')}
                    fontSize="12"
                  >
                    {BREAKDOWN_LABELS[type] ?? type}
                  </text>
                  <rect
                    x={CHART_LABEL_WIDTH}
                    y={y}
                    width={barWidth}
                    height={CHART_BAR_HEIGHT}
                    fill={token('color.background.selected')}
                    rx="4"
                  />
                  <text
                    x={CHART_LABEL_WIDTH + barWidth + 8}
                    y={y + CHART_BAR_HEIGHT / 2}
                    dominantBaseline="central"
                    fill={token('color.text')}
                    fontSize="12"
                  >
                    {count}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      )}
    </section>
  );
}
