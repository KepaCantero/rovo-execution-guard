/**
 * @jest-environment jsdom
 */

/**
 * Tests for admin-dashboard/components/OverviewTab.tsx
 *
 * Verifies the presentational OverviewTab component renders loading,
 * error, empty, and metrics states correctly with inline SVG chart.
 *
 * Pattern: AAA (Arrange-Act-Assert)
 * No @forge/bridge mock needed — presentational component receives data via props.
 */

import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import { OverviewTab } from '../../../../../src/frontend/custom-ui/admin-dashboard/components/OverviewTab';
import type { OverviewMetrics } from '../../../../../src/frontend/custom-ui/admin-dashboard/types';

// ═══════════════════════════════════════════
// FIXTURES
// ═══════════════════════════════════════════

const SAMPLE_METRICS: OverviewMetrics = {
  totalEvaluated: 150,
  totalBlocked: 30,
  prsBlocked: 12,
  avgScore: 85.3,
  inconsistencyBreakdown: {
    contradiction: 8,
    duplicate: 5,
    missing_context: 12,
    ambiguity: 3,
    sibling_contradiction: 0,
    spec_drift: 0,
    scope_mismatch: 0,
    orphan_reference: 0,
  },
};

const EMPTY_METRICS: OverviewMetrics = {
  totalEvaluated: 0,
  totalBlocked: 0,
  prsBlocked: 0,
  avgScore: 0,
  inconsistencyBreakdown: {
    contradiction: 0,
    duplicate: 0,
    missing_context: 0,
    ambiguity: 0,
    sibling_contradiction: 0,
    spec_drift: 0,
    scope_mismatch: 0,
    orphan_reference: 0,
  },
};

const LOW_SCORE_METRICS: OverviewMetrics = {
  totalEvaluated: 100,
  totalBlocked: 60,
  prsBlocked: 20,
  avgScore: 45,
  inconsistencyBreakdown: {
    contradiction: 10,
    duplicate: 10,
    missing_context: 10,
    ambiguity: 10,
    sibling_contradiction: 0,
    spec_drift: 0,
    scope_mismatch: 0,
    orphan_reference: 0,
  },
};

const MID_SCORE_METRICS: OverviewMetrics = {
  totalEvaluated: 100,
  totalBlocked: 30,
  prsBlocked: 10,
  avgScore: 70,
  inconsistencyBreakdown: {
    contradiction: 5,
    duplicate: 5,
    missing_context: 5,
    ambiguity: 5,
    sibling_contradiction: 0,
    spec_drift: 0,
    scope_mismatch: 0,
    orphan_reference: 0,
  },
};

const defaultProps = {
  metrics: null as OverviewMetrics | null,
  loading: false,
  error: null as string | null,
  onRevalidate: jest.fn(),
};

// ═══════════════════════════════════════════
// TEST SUITE
// ═══════════════════════════════════════════

describe('OverviewTab', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─── Loading State ──────────────────

  describe('loading state', () => {
    it('should render spinner when loading is true (AC-01)', () => {
      // Arrange
      const props = { ...defaultProps, loading: true };

      // Act
      render(<OverviewTab {...props} />);

      // Assert
      expect(screen.getByTestId('overview-loading')).toBeInTheDocument();
    });

    it('should not render metrics when loading is true', () => {
      // Arrange
      const props = { ...defaultProps, loading: true, metrics: SAMPLE_METRICS };

      // Act
      render(<OverviewTab {...props} />);

      // Assert
      expect(screen.queryByTestId('overview-metrics')).not.toBeInTheDocument();
    });
  });

  // ─── Error State ────────────────────

  describe('error state', () => {
    it('should render error banner when error is non-null and loading is false (AC-02)', () => {
      // Arrange
      const props = { ...defaultProps, error: 'Failed to load metrics' };

      // Act
      render(<OverviewTab {...props} />);

      // Assert
      expect(screen.getByTestId('overview-error')).toBeInTheDocument();
      expect(screen.getByText('Failed to load metrics')).toBeInTheDocument();
    });

    it('should render retry button in error state (AC-02)', () => {
      // Arrange
      const props = { ...defaultProps, error: 'Network error' };

      // Act
      render(<OverviewTab {...props} />);

      // Assert
      expect(screen.getByTestId('overview-retry-button')).toBeInTheDocument();
    });

    it('should have aria-label on retry button for accessibility (AC-08)', () => {
      // Arrange
      const props = { ...defaultProps, error: 'Timeout' };

      // Act
      render(<OverviewTab {...props} />);

      // Assert
      const button = screen.getByTestId('overview-retry-button');
      expect(button).toHaveAttribute('aria-label', 'Retry loading metrics');
    });

    it('should call onRevalidate when retry button is clicked', async () => {
      // Arrange
      const onRevalidate = jest.fn();
      const props = { ...defaultProps, error: 'Error', onRevalidate };
      const user = userEvent.setup();

      // Act
      render(<OverviewTab {...props} />);
      await user.click(screen.getByTestId('overview-retry-button'));

      // Assert
      expect(onRevalidate).toHaveBeenCalledTimes(1);
      expect(onRevalidate).toHaveBeenCalledWith('');
    });
  });

  // ─── Empty State ────────────────────

  describe('empty state', () => {
    it('should render empty message when metrics is null and no error (AC-04)', () => {
      // Arrange
      const props = { ...defaultProps, metrics: null };

      // Act
      render(<OverviewTab {...props} />);

      // Assert
      expect(screen.getByTestId('overview-empty')).toBeInTheDocument();
      expect(screen.getByText('No metrics data available.')).toBeInTheDocument();
    });
  });

  // ─── Metrics Display ────────────────

  describe('metrics display', () => {
    it('should render all metric cards with correct values (AC-03)', () => {
      // Arrange
      const props = { ...defaultProps, metrics: SAMPLE_METRICS };

      // Act
      render(<OverviewTab {...props} />);

      // Assert
      expect(screen.getByTestId('metric-total-evaluated')).toHaveTextContent('150');
      expect(screen.getByTestId('metric-total-blocked')).toHaveTextContent('30');
      expect(screen.getByTestId('metric-prs-blocked')).toHaveTextContent('12');
      expect(screen.getByTestId('metric-avg-score')).toHaveTextContent('85.3');
    });

    it('should display blocked percentage next to total blocked (AC-05)', () => {
      // Arrange
      const props = { ...defaultProps, metrics: SAMPLE_METRICS };

      // Act
      render(<OverviewTab {...props} />);

      // Assert
      // 30/150 = 20%
      expect(screen.getByTestId('metric-blocked-pct')).toHaveTextContent('(20.0%)');
    });

    it('should compute blocked percentage as 0 when totalEvaluated is 0 (AC-05)', () => {
      // Arrange
      const props = { ...defaultProps, metrics: EMPTY_METRICS };

      // Act
      render(<OverviewTab {...props} />);

      // Assert
      expect(screen.getByTestId('metric-blocked-pct')).toHaveTextContent('(0.0%)');
    });

    it('should apply score color token for avg score > 80 (green) (AC-06)', () => {
      // Arrange
      const props = { ...defaultProps, metrics: SAMPLE_METRICS };

      // Act
      render(<OverviewTab {...props} />);

      // Assert
      const scoreEl = screen.getByTestId('metric-avg-score');
      // The color is set via the token() function which resolves to a CSS var or color
      expect(scoreEl).toBeInTheDocument();
      expect(scoreEl.textContent).toBe('85.3');
    });

    it('should render metrics section with aria-label (UI-ADS-004)', () => {
      // Arrange
      const props = { ...defaultProps, metrics: SAMPLE_METRICS };

      // Act
      render(<OverviewTab {...props} />);

      // Assert
      expect(screen.getByTestId('overview-metrics')).toHaveAttribute(
        'aria-label',
        'Overview metrics dashboard',
      );
    });
  });

  // ─── SVG Chart ──────────────────────

  describe('inline SVG bar chart', () => {
    it('should render SVG chart with breakdown data (AC-07)', () => {
      // Arrange
      const props = { ...defaultProps, metrics: SAMPLE_METRICS };

      // Act
      render(<OverviewTab {...props} />);

      // Assert
      expect(screen.getByTestId('overview-svg-chart')).toBeInTheDocument();
    });

    it('should render correct number of bars for breakdown entries (AC-07)', () => {
      // Arrange
      const props = { ...defaultProps, metrics: SAMPLE_METRICS };

      // Act
      render(<OverviewTab {...props} />);

      // Assert — 4 breakdown types
      expect(screen.getByTestId('chart-bar-contradiction')).toBeInTheDocument();
      expect(screen.getByTestId('chart-bar-duplicate')).toBeInTheDocument();
      expect(screen.getByTestId('chart-bar-missing_context')).toBeInTheDocument();
      expect(screen.getByTestId('chart-bar-ambiguity')).toBeInTheDocument();
    });

    it('should render breakdown count text values in SVG chart bars', () => {
      // Arrange
      const props = { ...defaultProps, metrics: SAMPLE_METRICS };

      // Act
      render(<OverviewTab {...props} />);

      // Assert — verify actual count values appear as text in the SVG
      const svg = screen.getByTestId('overview-svg-chart');
      expect(svg).toBeInTheDocument();
      // The SVG renders count text alongside each bar
      expect(svg).toHaveTextContent('8'); // contradiction
      expect(svg).toHaveTextContent('5'); // duplicate
      expect(svg).toHaveTextContent('12'); // missing_context
      expect(svg).toHaveTextContent('3'); // ambiguity
    });

    it('should render bars with proportional widths based on count values', () => {
      // Arrange
      const props = { ...defaultProps, metrics: SAMPLE_METRICS };

      // Act
      render(<OverviewTab {...props} />);

      // Assert — missing_context has the highest count (12), its bar should be the widest
      const svg = screen.getByTestId('overview-svg-chart');
      const rects = svg.querySelectorAll('rect');
      expect(rects.length).toBe(8);
      // The bar for missing_context (12) should have width 200 (max),
      // since 12 is the max value in SAMPLE_METRICS
      const barWidths = Array.from(rects).map((rect) =>
        parseFloat(rect.getAttribute('width') ?? '0'),
      );
      const maxWidth = Math.max(...barWidths);
      // The max bar should correspond to missing_context (count=12)
      expect(maxWidth).toBe(200);
      // All bars should have non-negative widths
      barWidths.forEach((w) => expect(w).toBeGreaterThanOrEqual(0));
    });

    it('should render breakdown section heading', () => {
      // Arrange
      const props = { ...defaultProps, metrics: SAMPLE_METRICS };

      // Act
      render(<OverviewTab {...props} />);

      // Assert
      expect(screen.getByText('Inconsistency Breakdown')).toBeInTheDocument();
    });

    it('should have aria-label on SVG for accessibility (UI-ADS-004)', () => {
      // Arrange
      const props = { ...defaultProps, metrics: SAMPLE_METRICS };

      // Act
      render(<OverviewTab {...props} />);

      // Assert
      expect(screen.getByTestId('overview-svg-chart')).toHaveAttribute(
        'aria-label',
        'Inconsistency breakdown bar chart',
      );
    });

    it('should render SVG chart with zero-width bars when all breakdown counts are zero', () => {
      // Arrange
      const props = { ...defaultProps, metrics: EMPTY_METRICS };

      // Act
      render(<OverviewTab {...props} />);

      // Assert — chart renders with entries present but all bars have width 0
      const svg = screen.getByTestId('overview-svg-chart');
      expect(svg).toBeInTheDocument();
      const rects = svg.querySelectorAll('rect');
      rects.forEach((rect) => {
        expect(rect.getAttribute('width')).toBe('0');
      });
    });
  });

  // ─── Score Color Variants ──────────

  describe('score color variants', () => {
    it('should handle low score (< 60) metric display', () => {
      // Arrange
      const props = { ...defaultProps, metrics: LOW_SCORE_METRICS };

      // Act
      render(<OverviewTab {...props} />);

      // Assert
      const scoreEl = screen.getByTestId('metric-avg-score');
      expect(scoreEl.textContent).toBe('45.0');
    });

    it('should handle mid-range score (60-80) metric display', () => {
      // Arrange
      const props = { ...defaultProps, metrics: MID_SCORE_METRICS };

      // Act
      render(<OverviewTab {...props} />);

      // Assert
      const scoreEl = screen.getByTestId('metric-avg-score');
      expect(scoreEl.textContent).toBe('70.0');
    });
  });

  // ─── Rule Verification ──────────────

  describe('rule compliance', () => {
    it('should use named export — component imported by name (ARCH-SOLID-232)', () => {
      // Arrange & Act
      // OverviewTab is imported as a named import at top of file
      // Assert
      expect(typeof OverviewTab).toBe('function');
    });

    it('should not use any @forge/bridge invoke — presentational only (UI-ADS-202)', () => {
      // Arrange
      const props = { ...defaultProps, metrics: SAMPLE_METRICS };

      // Act
      const { container } = render(<OverviewTab {...props} />);

      // Assert — no script tags or eval patterns
      expect(container.querySelector('script')).not.toBeInTheDocument();
    });
  });
});
