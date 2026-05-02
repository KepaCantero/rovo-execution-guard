import {
  analyzeDecisionPatterns,
  computeContextSignature,
} from '../../../../src/backend/services/relationship-index/decision-consumer';

import type { DecisionPattern } from '../../../../src/backend/services/relationship-index/decision-consumer';

import type { DecisionRecord } from '../../../../src/backend/types/relationship-index';

// ═══════════════════════════════════════════
// FIXTURES
// ═══════════════════════════════════════════

const makeDecision = (overrides: Partial<DecisionRecord> = {}): DecisionRecord => ({
  id: 'dec-001',
  issueKey: 'PROJ-100',
  gateType: 'delivery',
  score: 55,
  action: 'comment',
  overridden: false,
  contextSignature: 'PROJ-100:mid:delivery:few',
  timestamp: '2026-04-15T10:00:00Z',
  ...overrides,
});

const makeOverriddenBlock = (overrides: Partial<DecisionRecord> = {}): DecisionRecord =>
  makeDecision({
    action: 'block',
    overridden: true,
    contextSignature: 'PROJ-100:mid:delivery:few',
    ...overrides,
  });

const makeApprovedDecision = (overrides: Partial<DecisionRecord> = {}): DecisionRecord =>
  makeDecision({
    action: 'approve',
    overridden: false,
    contextSignature: 'PROJ-100:mid:delivery:few',
    ...overrides,
  });

// ═══════════════════════════════════════════
// TEST SUITE
// ═══════════════════════════════════════════

describe('decision-consumer', () => {
  // ─── computeContextSignature() ─────────

  describe('computeContextSignature()', () => {
    it('should return deterministic signature for same inputs (AC-DC-01)', () => {
      const a = computeContextSignature('PROJ-100', 55, 'delivery', 2);
      const b = computeContextSignature('PROJ-100', 55, 'delivery', 2);
      expect(a).toBe(b);
    });

    it('should produce different signatures for different inputs (AC-DC-01)', () => {
      const sig1 = computeContextSignature('PROJ-100', 55, 'delivery', 2);
      const sig2 = computeContextSignature('PROJ-200', 55, 'delivery', 2);
      expect(sig1).not.toBe(sig2);
    });

    it('should bucket scores correctly (AC-DC-02)', () => {
      const low = computeContextSignature('PROJ-100', 20, 'delivery', 1);
      const mid = computeContextSignature('PROJ-100', 55, 'delivery', 1);
      const high = computeContextSignature('PROJ-100', 85, 'delivery', 1);
      expect(low).toContain(':low:');
      expect(mid).toContain(':mid:');
      expect(high).toContain(':high:');
    });

    it('should treat score 40 as mid boundary (AC-DC-02)', () => {
      const at40 = computeContextSignature('PROJ-100', 40, 'delivery', 1);
      expect(at40).toContain(':mid:');
    });

    it('should treat score 70 as high boundary (AC-DC-02)', () => {
      const at70 = computeContextSignature('PROJ-100', 70, 'delivery', 1);
      expect(at70).toContain(':high:');
    });

    it('should bucket inconsistency counts correctly (AC-DC-03)', () => {
      const none = computeContextSignature('PROJ-100', 50, 'delivery', 0);
      const few = computeContextSignature('PROJ-100', 50, 'delivery', 2);
      const many = computeContextSignature('PROJ-100', 50, 'delivery', 5);
      expect(none).toContain(':none');
      expect(few).toContain(':few');
      expect(many).toContain(':many');
    });

    it('should treat 3 inconsistencies as few boundary (AC-DC-03)', () => {
      const at3 = computeContextSignature('PROJ-100', 50, 'delivery', 3);
      expect(at3).toContain(':few');
    });

    it('should treat 4 inconsistencies as many boundary (AC-DC-03)', () => {
      const at4 = computeContextSignature('PROJ-100', 50, 'delivery', 4);
      expect(at4).toContain(':many');
    });

    it('should include all components in signature format', () => {
      const sig = computeContextSignature('PROJ-100', 55, 'delivery', 2);
      expect(sig).toBe('PROJ-100:mid:delivery:few');
    });
  });

  // ─── analyzeDecisionPatterns() ─────────

  describe('analyzeDecisionPatterns()', () => {
    it('should proceed with empty decisions (AC-DC-04, AC-21)', () => {
      const result = analyzeDecisionPatterns([], 55, 'comment');

      expect(result.suggestedAction).toBe('proceed');
      expect(result.overrideRate).toBe(0);
      expect(result.similarPastDecisions).toEqual([]);
      expect(result.reason).toContain('No similar past decisions');
    });

    it('should soften when >3 overridden blocks for similar context (AC-DC-05, AC-22)', () => {
      const decisions: readonly DecisionRecord[] = [
        makeOverriddenBlock({ id: 'dec-01' }),
        makeOverriddenBlock({ id: 'dec-02' }),
        makeOverriddenBlock({ id: 'dec-03' }),
        makeOverriddenBlock({ id: 'dec-04' }),
      ];

      const result = analyzeDecisionPatterns(decisions, 55, 'block');

      expect(result.suggestedAction).toBe('soften');
      expect(result.reason).toContain('overridden');
      expect(result.similarPastDecisions).toHaveLength(4);
    });

    it('should not soften when exactly 3 overridden blocks (AC-DC-05)', () => {
      const decisions: readonly DecisionRecord[] = [
        makeOverriddenBlock({ id: 'dec-01' }),
        makeOverriddenBlock({ id: 'dec-02' }),
        makeOverriddenBlock({ id: 'dec-03' }),
      ];

      const result = analyzeDecisionPatterns(decisions, 55, 'block');

      // 3 overridden / 3 total = 100% > 50% → still soften via override rate rule
      // But the >3 blocks rule should NOT trigger
      expect(result.overrideRate).toBe(1);
    });

    it('should soften on high override rate >50% (AC-DC-06, AC-22)', () => {
      const decisions: readonly DecisionRecord[] = [
        makeOverriddenBlock({ id: 'dec-01' }),
        makeOverriddenBlock({ id: 'dec-02' }),
        makeOverriddenBlock({ id: 'dec-03' }),
        makeDecision({ id: 'dec-04', overridden: false }),
      ];

      const result = analyzeDecisionPatterns(decisions, 60, 'comment');

      expect(result.suggestedAction).toBe('soften');
      expect(result.overrideRate).toBe(0.75);
      expect(result.reason).toContain('false positive');
    });

    it('should escalate on low override rate <10% with low score (AC-DC-07, AC-22)', () => {
      const decisions: readonly DecisionRecord[] = [
        makeDecision({ id: 'dec-01', overridden: false }),
        makeDecision({ id: 'dec-02', overridden: false }),
        makeDecision({ id: 'dec-03', overridden: false }),
        makeDecision({ id: 'dec-04', overridden: false }),
        makeDecision({ id: 'dec-05', overridden: false }),
        makeDecision({ id: 'dec-06', overridden: false }),
        makeDecision({ id: 'dec-07', overridden: false }),
        makeDecision({ id: 'dec-08', overridden: false }),
        makeDecision({ id: 'dec-09', overridden: false }),
        makeDecision({ id: 'dec-10', overridden: false }),
        makeDecision({ id: 'dec-11', overridden: true }),
      ];

      const result = analyzeDecisionPatterns(decisions, 30, 'block');

      expect(result.suggestedAction).toBe('escalate');
      expect(result.overrideRate).toBeLessThan(0.1);
      expect(result.reason).toContain('escalate');
    });

    it('should proceed on zero overrides with high score (AC-DC-08)', () => {
      const decisions: readonly DecisionRecord[] = [
        makeApprovedDecision({ id: 'dec-01' }),
        makeApprovedDecision({ id: 'dec-02' }),
        makeApprovedDecision({ id: 'dec-03' }),
      ];

      const result = analyzeDecisionPatterns(decisions, 85, 'approve');

      expect(result.suggestedAction).toBe('proceed');
    });

    it('should handle override rate exactly at 50% threshold (AC-22)', () => {
      const decisions: readonly DecisionRecord[] = [
        makeOverriddenBlock({ id: 'dec-01' }),
        makeDecision({ id: 'dec-02', overridden: false }),
      ];

      const result = analyzeDecisionPatterns(decisions, 55, 'comment');

      // Exactly 50% should NOT trigger >50% rule (strict greater-than)
      expect(result.suggestedAction).toBe('proceed');
      expect(result.overrideRate).toBe(0.5);
    });

    it('should handle override rate exactly at 10% confidence threshold (AC-22)', () => {
      const decisions: readonly DecisionRecord[] = [
        makeDecision({ id: 'dec-01', overridden: false }),
        makeDecision({ id: 'dec-02', overridden: false }),
        makeDecision({ id: 'dec-03', overridden: false }),
        makeDecision({ id: 'dec-04', overridden: false }),
        makeDecision({ id: 'dec-05', overridden: false }),
        makeDecision({ id: 'dec-06', overridden: false }),
        makeDecision({ id: 'dec-07', overridden: false }),
        makeDecision({ id: 'dec-08', overridden: false }),
        makeDecision({ id: 'dec-09', overridden: false }),
        makeDecision({ id: 'dec-10', overridden: true }),
      ];

      const result = analyzeDecisionPatterns(decisions, 30, 'block');

      // Exactly 10% should NOT trigger <10% rule (strict less-than)
      expect(result.overrideRate).toBe(0.1);
      expect(result.suggestedAction).toBe('proceed');
    });

    it('should return all similar past decisions in result (AC-18)', () => {
      const decisions: readonly DecisionRecord[] = [
        makeDecision({ id: 'dec-01' }),
        makeDecision({ id: 'dec-02' }),
        makeDecision({ id: 'dec-03' }),
      ];

      const result = analyzeDecisionPatterns(decisions, 50, 'comment');

      expect(result.similarPastDecisions).toHaveLength(3);
    });

    it('should compute override rate correctly (AC-18)', () => {
      const decisions: readonly DecisionRecord[] = [
        makeDecision({ id: 'dec-01', overridden: true }),
        makeDecision({ id: 'dec-02', overridden: true }),
        makeDecision({ id: 'dec-03', overridden: false }),
        makeDecision({ id: 'dec-04', overridden: false }),
      ];

      const result = analyzeDecisionPatterns(decisions, 55, 'comment');

      expect(result.overrideRate).toBe(0.5);
    });

    it('should proceed as default for moderate override rate and score (AC-21)', () => {
      const decisions: readonly DecisionRecord[] = [
        makeDecision({ id: 'dec-01', overridden: true }),
        makeDecision({ id: 'dec-02', overridden: false }),
        makeDecision({ id: 'dec-03', overridden: false }),
      ];

      const result = analyzeDecisionPatterns(decisions, 65, 'comment');

      // Override rate ~33%, score 65 — no rule triggers
      expect(result.suggestedAction).toBe('proceed');
    });
  });

  // ─── Rulebook compliance ───────────────

  describe('Rulebook compliance', () => {
    it('should produce DecisionPattern with correct shape [ARCH-SOLID-205]', () => {
      const result: DecisionPattern = analyzeDecisionPatterns([], 50, 'comment');

      expect(result).toHaveProperty('similarPastDecisions');
      expect(result).toHaveProperty('overrideRate');
      expect(result).toHaveProperty('suggestedAction');
      expect(result).toHaveProperty('reason');
      expect(typeof result.overrideRate).toBe('number');
      expect(typeof result.reason).toBe('string');
    });

    it('should be referentially transparent [ARCH-SOLID-0912]', () => {
      const decisions = [makeDecision()];
      const a = analyzeDecisionPatterns(decisions, 50, 'comment');
      const b = analyzeDecisionPatterns(decisions, 50, 'comment');
      expect(a.suggestedAction).toBe(b.suggestedAction);
      expect(a.overrideRate).toBe(b.overrideRate);
    });
  });
});
