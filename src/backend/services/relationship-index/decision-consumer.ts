// [ARCH-SOLID-058] SERVICE layer — operational memory consumer, zero framework dependencies
// [ARCH-SOLID-006] Handler -> Service -> Repository (this is the Service)
// [ARCH-SOLID-202] Zero any usage
// [ARCH-SOLID-232] Named exports only, no export default
// [FORGE-OPS-0105] Stateless functions, no module-level mutable state
// RTASK-041 Step 9.2: Decision Consumer — 2 exported functions + 1 interface

import type { DecisionRecord } from '../../types/relationship-index';

// ═══════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════

/** Result of decision pattern analysis. */
export interface DecisionPattern {
  readonly similarPastDecisions: readonly DecisionRecord[];
  readonly overrideRate: number;
  readonly suggestedAction: 'proceed' | 'soften' | 'escalate';
  readonly reason: string;
}

// ═══════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════

/** Override rate above this → soften (false positive pattern). */
const OVERRIDE_THRESHOLD = 0.5;

/** Override rate below this → escalate (high confidence in enforcement). */
const CONFIDENCE_THRESHOLD = 0.1;

/** More than this many overridden blocks → soften. */
const BLOCK_OVERRIDE_LIMIT = 3;

// ═══════════════════════════════════════════
// PRIVATE HELPERS
// ═══════════════════════════════════════════

/** Bucket a score into low/mid/high range. */
function scoreRange(score: number): 'low' | 'mid' | 'high' {
  if (score < 40) return 'low';
  if (score < 70) return 'mid';
  return 'high';
}

/** Bucket inconsistency count into none/few/many. */
function inconsistencyBucket(count: number): 'none' | 'few' | 'many' {
  if (count === 0) return 'none';
  if (count <= 3) return 'few';
  return 'many';
}

/** Count overridden block decisions. */
function countOverriddenBlocks(decisions: readonly DecisionRecord[]): number {
  return decisions.filter((d) => d.action === 'block' && d.overridden).length;
}

/** Compute override rate as fraction of total decisions. */
function computeOverrideRate(decisions: readonly DecisionRecord[]): number {
  if (decisions.length === 0) return 0;
  return decisions.filter((d) => d.overridden).length / decisions.length;
}

/** Determine suggested action from pattern analysis rules. */
function determineSuggestion(
  decisions: readonly DecisionRecord[],
  overrideRate: number,
  currentScore: number,
): { action: DecisionPattern['suggestedAction']; reason: string } {
  const overriddenBlocks = countOverriddenBlocks(decisions);

  if (overriddenBlocks > BLOCK_OVERRIDE_LIMIT) {
    return {
      action: 'soften',
      reason: `${overriddenBlocks} past block decisions overridden — suggest comment instead`,
    };
  }

  if (overrideRate > OVERRIDE_THRESHOLD) {
    return {
      action: 'soften',
      reason: `Override rate ${(overrideRate * 100).toFixed(0)}% — potential false positive pattern`,
    };
  }

  if (overrideRate < CONFIDENCE_THRESHOLD && currentScore < 40) {
    return {
      action: 'escalate',
      reason: `Low override rate (${(overrideRate * 100).toFixed(0)}%) with low score — escalate enforcement`,
    };
  }

  return { action: 'proceed', reason: 'No override pattern detected' };
}

// ═══════════════════════════════════════════
// PUBLIC FUNCTIONS
// ═══════════════════════════════════════════

/**
 * Compute a context signature for similarity matching.
 * Format: `{issueKey}:{scoreRange}:{gateType}:{bucket}`
 *
 * AC ref: AC-DC-01, AC-DC-02, AC-DC-03 of .reqs.md
 * [ARCH-SOLID-0912] Pure function — deterministic output for given inputs.
 */
export function computeContextSignature(
  issueKey: string,
  score: number,
  gateType: string,
  inconsistencyCount: number,
): string {
  return `${issueKey}:${scoreRange(score)}:${gateType}:${inconsistencyBucket(inconsistencyCount)}`;
}

/**
 * Analyze past decisions to detect override patterns and suggest action adjustments.
 * Returns suggested action (proceed/soften/escalate) with reasoning.
 *
 * AC ref: AC-18, AC-21, AC-22 of RTASK-041 spec
 * AC ref: AC-DC-04..AC-DC-08 of .reqs.md
 * [ARCH-SOLID-0912] Pure function — deterministic output for given inputs.
 */
export function analyzeDecisionPatterns(
  decisions: readonly DecisionRecord[],
  currentScore: number,
  currentAction: 'block' | 'approve' | 'comment',
): DecisionPattern {
  if (decisions.length === 0) {
    return {
      similarPastDecisions: [],
      overrideRate: 0,
      suggestedAction: 'proceed',
      reason: `No similar past decisions — proceed with ${currentAction}`,
    };
  }

  const overrideRate = computeOverrideRate(decisions);
  const suggestion = determineSuggestion(decisions, overrideRate, currentScore);

  return {
    similarPastDecisions: decisions,
    overrideRate,
    suggestedAction: suggestion.action,
    reason: suggestion.reason,
  };
}
