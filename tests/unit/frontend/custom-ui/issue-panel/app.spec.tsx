/**
 * @jest-environment jsdom
 */

/**
 * Tests for issue-panel/app.tsx — buildRovoPrompt severity differentiation
 *
 * Scope: AC-01 (PromptSeverity, SEVERITY_LABELS, AGENT_KEY, buildRovoPrompt)
 * Pattern: AAA (Arrange-Act-Assert)
 * REGLA: TEST-QA-056 TDD cycle, ARCH-SOLID-202 zero any
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

import {
  buildRovoPrompt,
  SEVERITY_LABELS,
  AGENT_KEY,
  AGENT_NAME,
} from '../../../../../src/frontend/custom-ui/issue-panel/app';
import type { PromptSeverity } from '../../../../../src/frontend/custom-ui/issue-panel/app';
import type {
  AxisDetail,
  ScoreAxes,
  TicketContext,
} from '../../../../../src/frontend/custom-ui/issue-panel/app';

// Mock @forge/bridge — required by app.tsx
jest.mock('@forge/bridge', () => ({
  invoke: jest.fn(),
  view: { getContext: jest.fn() },
  rovo: { open: jest.fn(), isEnabled: jest.fn() },
}));

// Mock @atlaskit/tokens — returns valid CSS colors so JSDOM doesn't strip styles
jest.mock('@atlaskit/tokens', () => ({
  token: jest.fn((name: string) => {
    const colorMap: Record<string, string> = {
      'color.text.success': 'rgb(54, 179, 126)',
      'color.text.warning': 'rgb(255, 153, 31)',
      'color.text.error': 'rgb(255, 86, 48)',
      'color.text.subtlest': 'rgb(107, 119, 140)',
    };
    return colorMap[name] ?? name;
  }),
}));

// Mock sentry — no-op in tests, spies verify calls [TEST-QA-036-01]
jest.mock('../../../../../src/frontend/utils/sentry', () => ({
  captureException: jest.fn(),
  addErrorBreadcrumb: jest.fn(),
}));

// ═══════════════════════════════════════════
// FIXTURES
// ═══════════════════════════════════════════

const BASE_AXES: ScoreAxes = {
  clarity: 75,
  consistency: 80,
  risk: 60,
  documentation: 70,
  technicalDebt: 65,
};

const BASE_TICKET_CONTEXT: TicketContext = {
  issueKey: 'PROJ-123',
  summary: 'Fix login bug',
  description: 'Users cannot log in when using SSO.',
  projectKey: 'PROJ',
  scoreThreshold: 70,
  gates: { definition: true, execution: true, delivery: true },
};

const makeDetail = (score: number): AxisDetail => ({
  score,
  label: 'Clarity',
  suggestions: ['Add more detail', 'Include acceptance criteria'],
});

// ═══════════════════════════════════════════
// TEST SUITE
// ═══════════════════════════════════════════

describe('buildRovoPrompt — severity differentiation (AC-01)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─── Constants ────────────────────────

  describe('constants', () => {
    it('AGENT_KEY should be consistency-guard', () => {
      expect(AGENT_KEY).toBe('consistency-guard');
    });

    it('SEVERITY_LABELS should map all severity levels', () => {
      expect(SEVERITY_LABELS.critical).toBe('Fix now');
      expect(SEVERITY_LABELS.improvable).toBe('Improve');
      expect(SEVERITY_LABELS.optimal).toBe('Optimize');
    });

    it('SEVERITY_LABELS keys match PromptSeverity values', () => {
      const keys = Object.keys(SEVERITY_LABELS);
      expect(keys).toContain('critical');
      expect(keys).toContain('improvable');
      expect(keys).toContain('optimal');
      expect(keys).toHaveLength(3);
    });
  });

  // ─── Critical severity (< 40%) ─────────

  describe('critical severity (score < 40)', () => {
    it('returns severity "critical" for score 0', () => {
      const result = buildRovoPrompt('clarity', makeDetail(0), BASE_AXES, BASE_TICKET_CONTEXT);
      expect(result.severity).toBe<PromptSeverity>('critical');
    });

    it('returns severity "critical" for score 39', () => {
      const result = buildRovoPrompt('clarity', makeDetail(39), BASE_AXES, BASE_TICKET_CONTEXT);
      expect(result.severity).toBe<PromptSeverity>('critical');
    });

    it('critical prompt contains "URGENT" prefix', () => {
      const result = buildRovoPrompt('clarity', makeDetail(25), BASE_AXES, BASE_TICKET_CONTEXT);
      expect(result.prompt).toContain('URGENT');
    });

    it('critical prompt includes issue key', () => {
      const result = buildRovoPrompt('clarity', makeDetail(25), BASE_AXES, BASE_TICKET_CONTEXT);
      expect(result.prompt).toContain('PROJ-123');
    });

    it('critical prompt includes score percentage', () => {
      const result = buildRovoPrompt('clarity', makeDetail(25), BASE_AXES, BASE_TICKET_CONTEXT);
      expect(result.prompt).toContain('25%');
    });

    it('critical prompt includes suggestions', () => {
      const result = buildRovoPrompt('clarity', makeDetail(25), BASE_AXES, BASE_TICKET_CONTEXT);
      expect(result.prompt).toContain('Add more detail');
      expect(result.prompt).toContain('Include acceptance criteria');
    });

    it('critical prompt mentions threshold', () => {
      const result = buildRovoPrompt('clarity', makeDetail(25), BASE_AXES, BASE_TICKET_CONTEXT);
      expect(result.prompt).toContain('70%');
    });
  });

  // ─── Improvable severity (40% to threshold-1) ─────

  describe('improvable severity (40% <= score < threshold)', () => {
    it('returns severity "improvable" for score 40', () => {
      const result = buildRovoPrompt('clarity', makeDetail(40), BASE_AXES, BASE_TICKET_CONTEXT);
      expect(result.severity).toBe<PromptSeverity>('improvable');
    });

    it('returns severity "improvable" for score just below threshold', () => {
      const result = buildRovoPrompt('clarity', makeDetail(69), BASE_AXES, BASE_TICKET_CONTEXT);
      expect(result.severity).toBe<PromptSeverity>('improvable');
    });

    it('improvable prompt includes issue key', () => {
      const result = buildRovoPrompt('clarity', makeDetail(50), BASE_AXES, BASE_TICKET_CONTEXT);
      expect(result.prompt).toContain('PROJ-123');
    });

    it('improvable prompt includes score percentage', () => {
      const result = buildRovoPrompt('clarity', makeDetail(50), BASE_AXES, BASE_TICKET_CONTEXT);
      expect(result.prompt).toContain('50%');
    });

    it('improvable prompt includes suggestions', () => {
      const result = buildRovoPrompt('clarity', makeDetail(50), BASE_AXES, BASE_TICKET_CONTEXT);
      expect(result.prompt).toContain('Add more detail');
    });

    it('improvable prompt mentions threshold', () => {
      const result = buildRovoPrompt('clarity', makeDetail(50), BASE_AXES, BASE_TICKET_CONTEXT);
      expect(result.prompt).toContain('70%');
    });
  });

  // ─── Optimal severity (>= threshold) ─────

  describe('optimal severity (score >= threshold)', () => {
    it('returns severity "optimal" for score exactly at threshold', () => {
      const result = buildRovoPrompt('clarity', makeDetail(70), BASE_AXES, BASE_TICKET_CONTEXT);
      expect(result.severity).toBe<PromptSeverity>('optimal');
    });

    it('returns severity "optimal" for score 100', () => {
      const result = buildRovoPrompt('clarity', makeDetail(100), BASE_AXES, BASE_TICKET_CONTEXT);
      expect(result.severity).toBe<PromptSeverity>('optimal');
    });

    it('optimal prompt includes issue key', () => {
      const result = buildRovoPrompt('clarity', makeDetail(80), BASE_AXES, BASE_TICKET_CONTEXT);
      expect(result.prompt).toContain('PROJ-123');
    });

    it('optimal prompt includes score percentage', () => {
      const result = buildRovoPrompt('clarity', makeDetail(80), BASE_AXES, BASE_TICKET_CONTEXT);
      expect(result.prompt).toContain('80%');
    });

    it('optimal prompt mentions optimization', () => {
      const result = buildRovoPrompt('clarity', makeDetail(80), BASE_AXES, BASE_TICKET_CONTEXT);
      expect(result.prompt).toContain('optimization');
    });
  });

  // ─── Boundary cases (TEST-QA-057) ─────

  describe('boundary cases', () => {
    it('score 39 is critical, score 40 is improvable', () => {
      const below = buildRovoPrompt('clarity', makeDetail(39), BASE_AXES, BASE_TICKET_CONTEXT);
      const atBoundary = buildRovoPrompt('clarity', makeDetail(40), BASE_AXES, BASE_TICKET_CONTEXT);
      expect(below.severity).toBe<PromptSeverity>('critical');
      expect(atBoundary.severity).toBe<PromptSeverity>('improvable');
    });

    it('score threshold-1 is improvable, score threshold is optimal', () => {
      const below = buildRovoPrompt('clarity', makeDetail(69), BASE_AXES, BASE_TICKET_CONTEXT);
      const atThreshold = buildRovoPrompt(
        'clarity',
        makeDetail(70),
        BASE_AXES,
        BASE_TICKET_CONTEXT,
      );
      expect(below.severity).toBe<PromptSeverity>('improvable');
      expect(atThreshold.severity).toBe<PromptSeverity>('optimal');
    });

    it('works with different threshold values', () => {
      const highThreshold: TicketContext = { ...BASE_TICKET_CONTEXT, scoreThreshold: 90 };
      const result = buildRovoPrompt('clarity', makeDetail(85), BASE_AXES, highThreshold);
      expect(result.severity).toBe<PromptSeverity>('improvable');
    });
  });

  // ─── Return shape (ARCH-SOLID-205) ─────

  describe('return shape', () => {
    it('returns object with prompt (string) and severity (PromptSeverity)', () => {
      const result = buildRovoPrompt('clarity', makeDetail(50), BASE_AXES, BASE_TICKET_CONTEXT);
      expect(result).toHaveProperty('prompt');
      expect(result).toHaveProperty('severity');
      expect(typeof result.prompt).toBe('string');
      expect(['critical', 'improvable', 'optimal']).toContain(result.severity);
    });

    it('prompt is always non-empty', () => {
      const cases = [0, 25, 39, 40, 50, 69, 70, 85, 100];
      for (const score of cases) {
        const result = buildRovoPrompt(
          'clarity',
          makeDetail(score),
          BASE_AXES,
          BASE_TICKET_CONTEXT,
        );
        expect(result.prompt.length).toBeGreaterThan(0);
      }
    });
  });

  // ─── Axis key in prompt ─────

  describe('axis key integration', () => {
    it('prompt references axis label for consistency axis', () => {
      const detail: AxisDetail = { score: 50, label: 'Consistency', suggestions: [] };
      const result = buildRovoPrompt('consistency', detail, BASE_AXES, BASE_TICKET_CONTEXT);
      expect(result.prompt).toContain('Consistency');
    });

    it('prompt includes issue summary', () => {
      const result = buildRovoPrompt('clarity', makeDetail(50), BASE_AXES, BASE_TICKET_CONTEXT);
      expect(result.prompt).toContain('Fix login bug');
    });
  });

  // ─── Edge cases (TEST-QA-057) ─────

  describe('edge cases', () => {
    it('handles empty suggestions array', () => {
      const detail: AxisDetail = { score: 50, label: 'Clarity', suggestions: [] };
      const result = buildRovoPrompt('clarity', detail, BASE_AXES, BASE_TICKET_CONTEXT);
      expect(result.severity).toBe<PromptSeverity>('improvable');
      expect(result.prompt.length).toBeGreaterThan(0);
    });

    it('handles zero threshold', () => {
      const zeroThreshold: TicketContext = { ...BASE_TICKET_CONTEXT, scoreThreshold: 0 };
      const result = buildRovoPrompt('clarity', makeDetail(50), BASE_AXES, zeroThreshold);
      expect(result.severity).toBe<PromptSeverity>('optimal');
    });

    it('handles score of 0 gracefully', () => {
      const result = buildRovoPrompt('clarity', makeDetail(0), BASE_AXES, BASE_TICKET_CONTEXT);
      expect(result.severity).toBe<PromptSeverity>('critical');
      expect(result.prompt).toContain('0%');
    });
  });
});

// ═══════════════════════════════════════════
// COMPONENT TESTS — AC-02, AC-03
// ═══════════════════════════════════════════

// Lazy import so mocks are registered first
// eslint-disable-next-line @typescript-eslint/no-require-imports
const appModule = require('../../../../../src/frontend/custom-ui/issue-panel/app') as {
  RovoButton: React.ComponentType<{
    axisKey: string;
    detail: AxisDetail;
    axes: ScoreAxes;
    ticketContext: TicketContext;
  }>;
  FullAnalysisButton: React.ComponentType<{
    score: {
      overall: number;
      axes: ScoreAxes;
      axisDetails?: Record<string, AxisDetail>;
      ticketContext?: TicketContext;
      timestamp: string;
      executionId: string;
    };
    rovoEnabled: boolean;
  }>;
  AxisRow: React.ComponentType<{
    axisKey: string;
    detail: AxisDetail;
    axes: ScoreAxes;
    ticketContext?: TicketContext;
    rovoEnabled: boolean;
  }>;
  IssuePanel: React.ComponentType;
};

const { RovoButton, FullAnalysisButton, AxisRow, IssuePanel } = appModule;

/* eslint-disable @typescript-eslint/no-require-imports */
const {
  rovo,
  invoke: invokeMock,
  view: viewMock,
} = require('@forge/bridge') as {
  rovo: { open: jest.Mock; isEnabled: jest.Mock };
  invoke: jest.Mock;
  view: { getContext: jest.Mock };
};

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { token: tokenMock } = require('@atlaskit/tokens') as {
  token: jest.Mock;
};

// Sentry mock references for assertion
// eslint-disable-next-line @typescript-eslint/no-require-imports
const sentryMocks = require('../../../../../src/frontend/utils/sentry') as {
  captureException: jest.Mock;
  addErrorBreadcrumb: jest.Mock;
};
const { captureException: captureExceptionMock, addErrorBreadcrumb: addErrorBreadcrumbMock } =
  sentryMocks;

describe('RovoButton — agent type and severity labels (AC-02, AC-03)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (rovo.open as jest.Mock).mockResolvedValue(undefined);
  });

  // ─── AC-02: rovo.open uses agent type ─────

  it('calls rovo.open with type:forge and agentKey', async () => {
    render(
      React.createElement(RovoButton, {
        axisKey: 'clarity',
        detail: makeDetail(25),
        axes: BASE_AXES,
        ticketContext: BASE_TICKET_CONTEXT,
      }),
    );

    fireEvent.click(screen.getByRole('button'));

    await waitFor(() => {
      expect(rovo.open).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'forge',
          agentKey: AGENT_KEY,
          agentName: AGENT_NAME,
          prompt: expect.any(String),
        }),
      );
    });
  });

  it('does NOT call rovo.open with type:default', async () => {
    render(
      React.createElement(RovoButton, {
        axisKey: 'clarity',
        detail: makeDetail(50),
        axes: BASE_AXES,
        ticketContext: BASE_TICKET_CONTEXT,
      }),
    );

    fireEvent.click(screen.getByRole('button'));

    await waitFor(() => {
      const callArgs = (rovo.open as jest.Mock).mock.calls[0]?.[0];
      expect(callArgs?.type).not.toBe('default');
    });
  });

  // ─── AC-03: Severity label display ─────

  it('shows "Fix now" label for critical severity (score < 40)', () => {
    render(
      React.createElement(RovoButton, {
        axisKey: 'clarity',
        detail: makeDetail(25),
        axes: BASE_AXES,
        ticketContext: BASE_TICKET_CONTEXT,
      }),
    );

    expect(screen.getByRole('button')).toHaveTextContent('Fix now');
  });

  it('shows "Improve" label for improvable severity', () => {
    render(
      React.createElement(RovoButton, {
        axisKey: 'clarity',
        detail: makeDetail(50),
        axes: BASE_AXES,
        ticketContext: BASE_TICKET_CONTEXT,
      }),
    );

    expect(screen.getByRole('button')).toHaveTextContent('Improve');
  });

  it('shows "Optimize" label for optimal severity', () => {
    render(
      React.createElement(RovoButton, {
        axisKey: 'clarity',
        detail: makeDetail(80),
        axes: BASE_AXES,
        ticketContext: BASE_TICKET_CONTEXT,
      }),
    );

    expect(screen.getByRole('button')).toHaveTextContent('Optimize');
  });

  // ─── AC-03: Severity-based button styling ─────

  it('uses resolved SCORE_COLOR_TOKENS for button border color', () => {
    render(
      React.createElement(RovoButton, {
        axisKey: 'clarity',
        detail: makeDetail(25),
        axes: BASE_AXES,
        ticketContext: BASE_TICKET_CONTEXT,
      }),
    );

    // Verify token() was called with the RED token name for critical severity
    expect(tokenMock).toHaveBeenCalledWith('color.text.error');
  });

  it('uses YELLOW token for improvable severity', () => {
    render(
      React.createElement(RovoButton, {
        axisKey: 'clarity',
        detail: makeDetail(50),
        axes: BASE_AXES,
        ticketContext: BASE_TICKET_CONTEXT,
      }),
    );

    expect(tokenMock).toHaveBeenCalledWith('color.text.warning');
  });

  it('uses GREEN token for optimal severity', () => {
    render(
      React.createElement(RovoButton, {
        axisKey: 'clarity',
        detail: makeDetail(80),
        axes: BASE_AXES,
        ticketContext: BASE_TICKET_CONTEXT,
      }),
    );

    expect(tokenMock).toHaveBeenCalledWith('color.text.success');
  });

  // ─── Accessibility (UI-ADS-004) ─────

  it('button has aria-label describing severity and axis', () => {
    render(
      React.createElement(RovoButton, {
        axisKey: 'clarity',
        detail: makeDetail(25),
        axes: BASE_AXES,
        ticketContext: BASE_TICKET_CONTEXT,
      }),
    );

    expect(screen.getByRole('button')).toHaveAttribute(
      'aria-label',
      expect.stringContaining('Fix now'),
    );
  });

  // ─── Error handling ─────

  it('shows error state when rovo.open rejects', async () => {
    (rovo.open as jest.Mock).mockRejectedValue(new Error('Rovo not available'));

    render(
      React.createElement(RovoButton, {
        axisKey: 'clarity',
        detail: makeDetail(50),
        axes: BASE_AXES,
        ticketContext: BASE_TICKET_CONTEXT,
      }),
    );

    fireEvent.click(screen.getByRole('button'));

    await waitFor(() => {
      expect(screen.getByText(/Could not open Rovo/)).toBeInTheDocument();
    });
  });
});

// ═══════════════════════════════════════════
// SCORE FIXTURES for FullAnalysisButton
// ═══════════════════════════════════════════

const BASE_SCORE = {
  overall: 72,
  axes: BASE_AXES,
  ticketContext: BASE_TICKET_CONTEXT,
  timestamp: '2026-05-01T00:00:00Z',
  executionId: 'exec-001',
};

const SCORE_WITHOUT_CONTEXT = {
  overall: 72,
  axes: BASE_AXES,
  timestamp: '2026-05-01T00:00:00Z',
  executionId: 'exec-002',
};

const SCORE_WITH_DETAILS = {
  overall: 72,
  axes: BASE_AXES,
  ticketContext: BASE_TICKET_CONTEXT,
  axisDetails: {
    clarity: { score: 75, label: 'Clarity', suggestions: ['Add more detail'] },
    consistency: { score: 80, label: 'Consistency', suggestions: ['Check links'] },
  } as Record<string, AxisDetail>,
  timestamp: '2026-05-01T00:00:00Z',
  executionId: 'exec-003',
};

// ═══════════════════════════════════════════
// COMPONENT TESTS — AC-04, AC-05 (FullAnalysisButton)
// ═══════════════════════════════════════════

describe('FullAnalysisButton — Full Analysis and Rovo guard (AC-04, AC-05)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (rovo.open as jest.Mock).mockResolvedValue(undefined);
  });

  // ─── AC-04: Full Analysis button renders ─────

  it('renders when rovoEnabled is true and ticketContext exists', () => {
    render(
      React.createElement(FullAnalysisButton, {
        score: BASE_SCORE,
        rovoEnabled: true,
      }),
    );

    expect(screen.getByRole('button', { name: /full consistency analysis/i })).toBeInTheDocument();
    expect(screen.getByRole('button')).toHaveTextContent('Full Analysis');
  });

  it('does NOT render when ticketContext is undefined', () => {
    render(
      React.createElement(FullAnalysisButton, {
        score: SCORE_WITHOUT_CONTEXT,
        rovoEnabled: true,
      }),
    );

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  // ─── AC-05: Rovo guard ─────

  it('shows disabled message when rovoEnabled is false', () => {
    render(
      React.createElement(FullAnalysisButton, {
        score: BASE_SCORE,
        rovoEnabled: false,
      }),
    );

    expect(screen.getByText(/Rovo is not available/)).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  // ─── AC-04: rovo.open with comprehensive prompt ─────

  it('calls rovo.open with forge type, agentKey and comprehensive prompt on click', async () => {
    render(
      React.createElement(FullAnalysisButton, {
        score: BASE_SCORE,
        rovoEnabled: true,
      }),
    );

    fireEvent.click(screen.getByRole('button'));

    await waitFor(() => {
      expect(rovo.open).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'forge',
          agentKey: AGENT_KEY,
          agentName: AGENT_NAME,
          prompt: expect.any(String),
        }),
      );
    });

    const callArgs = (rovo.open as jest.Mock).mock.calls[0]?.[0];
    expect(callArgs.prompt).toContain('PROJ-123');
    expect(callArgs.prompt).toContain('72%');
    expect(callArgs.prompt).toContain('Fix login bug');
  });

  // ─── AC-07: Sentry breadcrumbs before rovo.open ─────

  it('calls addErrorBreadcrumb before rovo.open', async () => {
    render(
      React.createElement(FullAnalysisButton, {
        score: BASE_SCORE,
        rovoEnabled: true,
      }),
    );

    fireEvent.click(screen.getByRole('button'));

    await waitFor(() => {
      expect(rovo.open).toHaveBeenCalled();
    });

    expect(addErrorBreadcrumbMock).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'rovo',
        message: expect.stringContaining('full analysis'),
        level: 'info',
      }),
    );
  });

  // ─── AC-07: Sentry captureException on failure ─────

  it('calls captureException on rovo.open failure', async () => {
    (rovo.open as jest.Mock).mockRejectedValue(new Error('Rovo not available'));

    render(
      React.createElement(FullAnalysisButton, {
        score: BASE_SCORE,
        rovoEnabled: true,
      }),
    );

    fireEvent.click(screen.getByRole('button'));

    await waitFor(() => {
      expect(captureExceptionMock).toHaveBeenCalled();
    });

    expect(captureExceptionMock).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ issueKey: 'PROJ-123' }),
    );
  });

  it('shows error state when rovo.open fails', async () => {
    (rovo.open as jest.Mock).mockRejectedValue(new Error('Rovo not available'));

    render(
      React.createElement(FullAnalysisButton, {
        score: BASE_SCORE,
        rovoEnabled: true,
      }),
    );

    fireEvent.click(screen.getByRole('button'));

    await waitFor(() => {
      expect(screen.getByText(/Could not open Rovo/)).toBeInTheDocument();
    });
  });
});

// ═══════════════════════════════════════════
// SENTRY INTEGRATION TESTS — AC-07 (RovoButton)
// ═══════════════════════════════════════════

describe('Sentry integration in RovoButton (AC-07)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (rovo.open as jest.Mock).mockResolvedValue(undefined);
  });

  it('calls addErrorBreadcrumb before rovo.open', async () => {
    render(
      React.createElement(RovoButton, {
        axisKey: 'clarity',
        detail: makeDetail(50),
        axes: BASE_AXES,
        ticketContext: BASE_TICKET_CONTEXT,
      }),
    );

    fireEvent.click(screen.getByRole('button'));

    await waitFor(() => {
      expect(rovo.open).toHaveBeenCalled();
    });

    expect(addErrorBreadcrumbMock).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'rovo',
        level: 'info',
      }),
    );
  });

  it('calls captureException on rovo.open error', async () => {
    (rovo.open as jest.Mock).mockRejectedValue(new Error('Rovo failed'));

    render(
      React.createElement(RovoButton, {
        axisKey: 'clarity',
        detail: makeDetail(50),
        axes: BASE_AXES,
        ticketContext: BASE_TICKET_CONTEXT,
      }),
    );

    fireEvent.click(screen.getByRole('button'));

    await waitFor(() => {
      expect(captureExceptionMock).toHaveBeenCalled();
    });

    expect(captureExceptionMock).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ issueKey: 'PROJ-123' }),
    );
  });

  // ─── SEC-PRIV-002: No PII in breadcrumbs ─────

  it('breadcrumbs do NOT contain PII (no summary/description)', async () => {
    render(
      React.createElement(RovoButton, {
        axisKey: 'clarity',
        detail: makeDetail(50),
        axes: BASE_AXES,
        ticketContext: BASE_TICKET_CONTEXT,
      }),
    );

    fireEvent.click(screen.getByRole('button'));

    await waitFor(() => {
      expect(rovo.open).toHaveBeenCalled();
    });

    const breadcrumbCalls = (addErrorBreadcrumbMock as jest.Mock).mock.calls;
    for (const call of breadcrumbCalls) {
      const breadcrumb = call[0];
      expect(breadcrumb.message).not.toContain('Fix login bug');
      expect(breadcrumb.message).not.toContain('Users cannot log in');
    }
  });
});

// ═══════════════════════════════════════════
// AXIS ROW TESTS — expand/collapse, conditional RovoButton
// ═══════════════════════════════════════════

describe('AxisRow — expand/collapse and conditional rendering', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (rovo.open as jest.Mock).mockResolvedValue(undefined);
  });

  const detail: AxisDetail = {
    score: 75,
    label: 'Clarity',
    suggestions: ['Add more detail', 'Include acceptance criteria'],
  };

  it('renders axis label and score percentage', () => {
    render(
      React.createElement(AxisRow, {
        axisKey: 'clarity',
        detail,
        axes: BASE_AXES,
        ticketContext: BASE_TICKET_CONTEXT,
        rovoEnabled: true,
      }),
    );

    expect(screen.getByText('Clarity')).toBeInTheDocument();
    expect(screen.getByText('75%')).toBeInTheDocument();
  });

  it('starts collapsed — suggestions not visible', () => {
    render(
      React.createElement(AxisRow, {
        axisKey: 'clarity',
        detail,
        axes: BASE_AXES,
        ticketContext: BASE_TICKET_CONTEXT,
        rovoEnabled: true,
      }),
    );

    expect(screen.queryByText(/Add more detail/)).not.toBeInTheDocument();
  });

  it('expands on click to show suggestions', () => {
    render(
      React.createElement(AxisRow, {
        axisKey: 'clarity',
        detail,
        axes: BASE_AXES,
        ticketContext: BASE_TICKET_CONTEXT,
        rovoEnabled: false,
      }),
    );

    fireEvent.click(screen.getByText('Clarity'));

    expect(screen.getByText(/Add more detail/)).toBeInTheDocument();
    expect(screen.getByText(/Include acceptance criteria/)).toBeInTheDocument();
  });

  it('collapses on second click', () => {
    render(
      React.createElement(AxisRow, {
        axisKey: 'clarity',
        detail,
        axes: BASE_AXES,
        ticketContext: BASE_TICKET_CONTEXT,
        rovoEnabled: false,
      }),
    );

    fireEvent.click(screen.getByText('Clarity'));
    expect(screen.getByText(/Add more detail/)).toBeInTheDocument();

    fireEvent.click(screen.getByText('Clarity'));
    expect(screen.queryByText(/Add more detail/)).not.toBeInTheDocument();
  });

  it('shows RovoButton when expanded with rovoEnabled and ticketContext', () => {
    render(
      React.createElement(AxisRow, {
        axisKey: 'clarity',
        detail,
        axes: BASE_AXES,
        ticketContext: BASE_TICKET_CONTEXT,
        rovoEnabled: true,
      }),
    );

    fireEvent.click(screen.getByText('Clarity'));

    expect(screen.getByRole('button', { name: /ask agent/i })).toBeInTheDocument();
  });

  it('does NOT show RovoButton when rovoEnabled is false', () => {
    render(
      React.createElement(AxisRow, {
        axisKey: 'clarity',
        detail,
        axes: BASE_AXES,
        ticketContext: BASE_TICKET_CONTEXT,
        rovoEnabled: false,
      }),
    );

    fireEvent.click(screen.getByText('Clarity'));

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('does NOT show RovoButton when ticketContext is undefined', () => {
    render(
      React.createElement(AxisRow, {
        axisKey: 'clarity',
        detail,
        axes: BASE_AXES,
        rovoEnabled: true,
      }),
    );

    fireEvent.click(screen.getByText('Clarity'));

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════
// ISSUE PANEL TESTS — loading, error, and success states
// ═══════════════════════════════════════════

describe('IssuePanel — loading, error, and success states', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows loading state initially', () => {
    viewMock.getContext.mockReturnValue(new Promise(() => {}));
    rovo.isEnabled.mockReturnValue(new Promise(() => {}));

    render(React.createElement(IssuePanel));

    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('calls rovo.isEnabled() on mount', async () => {
    viewMock.getContext.mockResolvedValue({ extension: { issue: { key: 'PROJ-123' } } });
    invokeMock
      .mockResolvedValueOnce({
        success: true,
        data: { available: true },
        executionId: 'exec-health',
      })
      .mockResolvedValueOnce({
        success: true,
        data: SCORE_WITH_DETAILS,
        executionId: 'exec-001',
      });
    rovo.isEnabled.mockResolvedValue(true);

    render(React.createElement(IssuePanel));

    await waitFor(() => {
      expect(screen.getByText('72%')).toBeInTheDocument();
    });

    expect(rovo.isEnabled).toHaveBeenCalled();
  });

  it('shows error when context has no issue key', async () => {
    viewMock.getContext.mockResolvedValue({ extension: {} });
    rovo.isEnabled.mockResolvedValue(false);

    render(React.createElement(IssuePanel));

    await waitFor(() => {
      expect(screen.getByText(/Error:/)).toBeInTheDocument();
    });

    expect(screen.getByText(/Unable to determine issue key/)).toBeInTheDocument();
  });

  it('shows error when invoke returns failure', async () => {
    viewMock.getContext.mockResolvedValue({ extension: { issue: { key: 'PROJ-123' } } });
    invokeMock.mockResolvedValue({
      success: false,
      error: 'Score service unavailable',
      executionId: 'exec-001',
    });
    rovo.isEnabled.mockResolvedValue(false);

    render(React.createElement(IssuePanel));

    await waitFor(() => {
      expect(screen.getByText(/Error:/)).toBeInTheDocument();
    });

    expect(screen.getByText(/Score service unavailable/)).toBeInTheDocument();
  });

  it('shows error when invoke throws', async () => {
    viewMock.getContext.mockResolvedValue({ extension: { issue: { key: 'PROJ-123' } } });
    invokeMock.mockRejectedValue(new Error('Network error'));
    rovo.isEnabled.mockResolvedValue(false);

    render(React.createElement(IssuePanel));

    await waitFor(() => {
      expect(screen.getByText(/Error:/)).toBeInTheDocument();
    });

    expect(screen.getByText(/Network error/)).toBeInTheDocument();
  });

  it('renders score, FullAnalysisButton, and AxisRows on success', async () => {
    viewMock.getContext.mockResolvedValue({ extension: { issue: { key: 'PROJ-123' } } });
    invokeMock
      .mockResolvedValueOnce({
        success: true,
        data: { available: true },
        executionId: 'exec-health',
      })
      .mockResolvedValueOnce({
        success: true,
        data: SCORE_WITH_DETAILS,
        executionId: 'exec-001',
      });
    rovo.isEnabled.mockResolvedValue(true);

    render(React.createElement(IssuePanel));

    await waitFor(() => {
      expect(screen.getByText('Consistency Score')).toBeInTheDocument();
    });

    expect(screen.getByText('72%')).toBeInTheDocument();
    expect(screen.getByText('Overall Consistency')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /full consistency analysis/i })).toBeInTheDocument();
    expect(screen.getByText('Clarity')).toBeInTheDocument();
    expect(screen.getByText('Consistency')).toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════
// OPENING STATE TESTS
// ═══════════════════════════════════════════

describe('RovoButton — opening state', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows "Opening..." when rovo.open is pending', async () => {
    let resolveOpen!: () => void;
    (rovo.open as jest.Mock).mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveOpen = resolve;
        }),
    );

    render(
      React.createElement(RovoButton, {
        axisKey: 'clarity',
        detail: makeDetail(50),
        axes: BASE_AXES,
        ticketContext: BASE_TICKET_CONTEXT,
      }),
    );

    fireEvent.click(screen.getByRole('button'));

    await waitFor(() => {
      expect(screen.getByRole('button')).toHaveTextContent('Opening...');
    });

    resolveOpen();
  });
});

describe('FullAnalysisButton — opening state', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows "Analyzing..." when rovo.open is pending', async () => {
    let resolveOpen!: () => void;
    (rovo.open as jest.Mock).mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveOpen = resolve;
        }),
    );

    render(
      React.createElement(FullAnalysisButton, {
        score: BASE_SCORE,
        rovoEnabled: true,
      }),
    );

    fireEvent.click(screen.getByRole('button'));

    await waitFor(() => {
      expect(screen.getByRole('button')).toHaveTextContent('Analyzing...');
    });

    resolveOpen();
  });
});
