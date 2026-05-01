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

import {
  buildRovoPrompt,
  SEVERITY_LABELS,
  AGENT_KEY,
} from '../../../../../src/frontend/custom-ui/issue-panel/app';
import type { PromptSeverity } from '../../../../../src/frontend/custom-ui/issue-panel/app';
import type {
  AxisDetail,
  ScoreAxes,
  TicketContext,
} from '../../../../../src/frontend/custom-ui/issue-panel/app';

// Mock @forge/bridge — required by app.tsx but not used in buildRovoPrompt tests
jest.mock('@forge/bridge', () => ({
  invoke: jest.fn(),
  view: { getContext: jest.fn() },
  rovo: { open: jest.fn(), isEnabled: jest.fn() },
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
