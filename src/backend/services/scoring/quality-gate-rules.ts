// [ARCH-SOLID-058] Quality Gate Rules Engine — zero framework dependencies
// [ARCH-SOLID-049-01] SRP: gate evaluation, enforcement action mapping, transition checking
// [ARCH-SOLID-049-02] OCP: gate behavior configurable via QualityGateRulesConfig and ProjectConfig
// [ARCH-SOLID-049-05] DIP: configuration injected via parameters, not hardcoded
// [ARCH-SOLID-0912] Idempotent: same input produces same output
// [ARCH-SOLID-202] Zero any usage

import type { QualityGateResult, GateType } from '../../types/quality-gate';
import type { ConsistencyScore } from '../../types/consistency-score';
import type { Inconsistency, Severity } from '../../types/inconsistency';
import type { EnforcementAction } from '../../types/enforcement';
import type { ProjectConfig, GateConfig } from '../../types/project-config';

// ---------------------------------------------------------------------------
// Public Types
// ---------------------------------------------------------------------------

/**
 * [ARCH-SOLID-203] Composite input type for gate evaluation.
 * Bundles all data needed for evaluating a quality gate.
 */
export interface GateEvaluationInput {
  readonly score: ConsistencyScore;
  readonly inconsistencies: readonly Inconsistency[];
  readonly config: ProjectConfig;
  readonly prData?: Readonly<{ prNumber: number; repo: string }>;
  readonly ticketKey: string;
  readonly documentationRefs?: readonly string[];
}

/**
 * [ARCH-SOLID-203] Additional configuration options not present in ProjectConfig.
 * [ARCH-SOLID-049-05] DIP: defaults injected, not hardcoded.
 */
export interface QualityGateRulesConfig {
  readonly blockOnCritical?: boolean;
  readonly requireDocumentation?: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_RULES_CONFIG: Required<QualityGateRulesConfig> = {
  blockOnCritical: true,
  requireDocumentation: true,
};

/** [ARCH-SOLID-061] Status-to-gate mapping for transition checking. */
const STATUS_GATE_MAP: Readonly<Record<string, GateType>> = {
  'In Progress': 'definition',
  'In Review': 'execution',
  Done: 'delivery',
  Merge: 'delivery',
} as const;

// ---------------------------------------------------------------------------
// Internal Helpers
// ---------------------------------------------------------------------------

/** [ARCH-SOLID-0941] Filter inconsistencies by severity. O(n). */
const filterBySeverity = (
  inconsistencies: readonly Inconsistency[],
  severity: Severity,
): readonly Inconsistency[] => inconsistencies.filter((inc) => inc.severity === severity);

/** Resolve effective rules config with defaults. */
const resolveRulesConfig = (config?: QualityGateRulesConfig): Required<QualityGateRulesConfig> => ({
  blockOnCritical: config?.blockOnCritical ?? DEFAULT_RULES_CONFIG.blockOnCritical,
  requireDocumentation: config?.requireDocumentation ?? DEFAULT_RULES_CONFIG.requireDocumentation,
});

/** Check if a gate is enabled in the project config. */
const isGateEnabled = (gates: GateConfig, gateType: GateType): boolean => gates[gateType];

// ---------------------------------------------------------------------------
// Gate Evaluation Functions
// ---------------------------------------------------------------------------

/** Evaluate definition gate: score must meet threshold. */
const evaluateDefinitionGate = (
  input: GateEvaluationInput,
): Pick<QualityGateResult, 'passed' | 'blockedTransitions'> => {
  const threshold = input.config.scoreThreshold;
  const passed = input.score.overall >= threshold;
  const blockedTransitions = passed ? [] : ['In Progress'];
  return { passed, blockedTransitions };
};

/** Evaluate execution gate: no critical inconsistencies when blockOnCritical is true. */
const evaluateExecutionGate = (
  input: GateEvaluationInput,
  rulesConfig: Required<QualityGateRulesConfig>,
): Pick<QualityGateResult, 'passed' | 'blockedTransitions'> => {
  if (!rulesConfig.blockOnCritical) {
    return { passed: true, blockedTransitions: [] };
  }
  const criticals = filterBySeverity(input.inconsistencies, 'critical');
  const passed = criticals.length === 0;
  const blockedTransitions = passed ? [] : ['PR Merge'];
  return { passed, blockedTransitions };
};

/** Evaluate delivery gate: score + no criticals + optional documentation. */
const evaluateDeliveryGate = (
  input: GateEvaluationInput,
  rulesConfig: Required<QualityGateRulesConfig>,
): Pick<QualityGateResult, 'passed' | 'blockedTransitions'> => {
  const threshold = input.config.scoreThreshold;
  const scorePass = input.score.overall >= threshold;
  const criticals = filterBySeverity(input.inconsistencies, 'critical');
  const noCriticals = criticals.length === 0;
  const hasDocs =
    !rulesConfig.requireDocumentation ||
    (input.documentationRefs !== undefined && input.documentationRefs.length > 0);

  const passed = scorePass && noCriticals && hasDocs;
  const blockedTransitions = passed ? [] : ['Merge'];
  return { passed, blockedTransitions };
};

// ---------------------------------------------------------------------------
// Enforcement Action Builders
// ---------------------------------------------------------------------------

/** Build BlockTransitionAction. */
const buildBlockTransition = (transitionId: string, ticketKey: string): EnforcementAction => ({
  type: 'block_transition',
  transitionId,
  reason: `Transition "${transitionId}" blocked for ticket ${ticketKey}`,
});

/** Build AddCommentAction. */
const buildAddComment = (
  gate: GateType,
  ticketKey: string,
  passed: boolean,
): EnforcementAction => ({
  type: 'add_comment',
  target: 'jira',
  body: `Quality gate "${gate}" ${passed ? 'passed' : 'failed'} for ticket ${ticketKey}`,
});

/** Build BlockPRAction. */
const buildBlockPR = (
  prData: Readonly<{ prNumber: number; repo: string }>,
  ticketKey: string,
): EnforcementAction => ({
  type: 'block_pr',
  prNumber: prData.prNumber,
  repo: prData.repo,
  reason: `PR blocked for ticket ${ticketKey}: critical inconsistencies detected`,
});

/** Build FlagInconsistencyAction. */
const buildFlagInconsistency = (inconsistency: Inconsistency): EnforcementAction => ({
  type: 'flag_inconsistency',
  inconsistency,
});

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Evaluate a specific quality gate using the provided composite input data.
 *
 * AC ref: AC-01, AC-02, AC-05, AC-06, AC-07, AC-10, AC-13
 * REGLA: [ARCH-SOLID-058] - zero framework dependencies
 * REGLA: [ARCH-SOLID-0912] - deterministic: same input produces same output
 * REGLA: [ARCH-SOLID-0941] - O(n) where n = number of inconsistencies
 *
 * @param gate - Which lifecycle gate to evaluate
 * @param input - Composite input with score, inconsistencies, config, and optional data
 * @param rulesConfig - Optional additional rules configuration
 * @returns QualityGateResult with pass/fail status, reasons, and metadata
 */
export const evaluateGate = (
  gate: GateType,
  input: GateEvaluationInput,
  rulesConfig?: QualityGateRulesConfig,
): QualityGateResult => {
  const resolved = resolveRulesConfig(rulesConfig);

  // Disabled gates auto-pass
  if (!isGateEnabled(input.config.gates, gate)) {
    return {
      gate,
      passed: true,
      score: input.score,
      inconsistencies: [],
      blockedTransitions: [],
      executionId: input.score.executionId,
    };
  }

  let evaluation: Pick<QualityGateResult, 'passed' | 'blockedTransitions'>;

  switch (gate) {
    case 'definition':
      evaluation = evaluateDefinitionGate(input);
      break;
    case 'execution':
      evaluation = evaluateExecutionGate(input, resolved);
      break;
    case 'delivery':
      evaluation = evaluateDeliveryGate(input, resolved);
      break;
  }

  const criticals = filterBySeverity(input.inconsistencies, 'critical');

  return {
    gate,
    passed: evaluation.passed,
    score: input.score,
    inconsistencies: criticals,
    blockedTransitions: evaluation.blockedTransitions,
    executionId: input.score.executionId,
  };
};

/**
 * Given a QualityGateResult, determine what enforcement actions should be taken.
 *
 * AC ref: AC-03, AC-05, AC-06, AC-07
 * REGLA: [ARCH-SOLID-0861] - enforcement is one of three essential capabilities
 * REGLA: [GH-INTEG-001] - PR status check reflects ticket validation state
 * REGLA: [ARCH-SOLID-0941] - O(n) where n = number of critical inconsistencies
 *
 * @param result - QualityGateResult from evaluateGate
 * @param prData - Optional PR metadata for BlockPRAction generation
 * @param ticketKey - The ticket key for user-facing messages (e.g. "PROJ-123")
 * @returns Array of EnforcementAction objects
 */
export const determineEnforcementActions = (
  result: QualityGateResult,
  prData?: Readonly<{ prNumber: number; repo: string }>,
  ticketKey?: string,
): EnforcementAction[] => {
  if (result.passed) {
    return [];
  }

  const key = ticketKey ?? result.score.executionId;
  const actions: EnforcementAction[] = [];

  switch (result.gate) {
    case 'definition': {
      for (const transition of result.blockedTransitions) {
        actions.push(buildBlockTransition(transition, key));
      }
      actions.push(buildAddComment(result.gate, key, false));
      break;
    }
    case 'execution': {
      if (prData) {
        actions.push(buildBlockPR(prData, key));
      }
      for (const inc of result.inconsistencies) {
        actions.push(buildFlagInconsistency(inc));
      }
      break;
    }
    case 'delivery': {
      for (const transition of result.blockedTransitions) {
        actions.push(buildBlockTransition(transition, key));
      }
      actions.push(buildAddComment(result.gate, key, false));
      break;
    }
  }

  return actions;
};

/**
 * High-level function that checks whether a ticket can transition to a target status.
 * Orchestrates gate evaluation based on the target transition.
 *
 * AC ref: AC-11
 * REGLA: [ARCH-SOLID-0941] - O(1) — delegates to evaluateGate for a single gate
 * REGLA: [ROVO-INTEG-0915] - must not depend on Rovo availability
 *
 * @param ticketKey - The ticket being evaluated
 * @param targetStatus - The target Jira status for the transition
 * @param input - Composite evaluation input
 * @param rulesConfig - Optional additional rules configuration
 * @returns true if the applicable gate passes, false otherwise
 */
export const canTransition = (
  ticketKey: string,
  targetStatus: string,
  input: GateEvaluationInput,
  rulesConfig?: QualityGateRulesConfig,
): boolean => {
  const gate = STATUS_GATE_MAP[targetStatus];

  // If no gate maps to this status, allow the transition
  if (gate === undefined) {
    return true;
  }

  const result = evaluateGate(gate, input, rulesConfig);
  return result.passed;
};
