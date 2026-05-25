// [ARCH-SOLID-058] DoD Enforcement — evaluates Definition-of-Done criteria for epics
// [ARCH-SOLID-049-01] SRP: DoD evaluation + enforcement action generation only
// [ARCH-SOLID-202] Zero any usage
// [ARCH-SOLID-232] Named exports only, no default export
// [FORGE-OPS-0105] Stateless functions, no module-level mutable state

import type {
  EpicDoDConfig,
  DoDEvaluationResult,
  DoDCriterionResult,
  DoDCriterion,
} from '../../types/epic-types';
import type { JiraTicketData } from '../../types/jira-data';
import type { EnforcementAction } from '../../types/enforcement';
import type { RelationshipContext } from '../../types/relationship-index';
import type { ScoringInput } from '../scoring/scoring-engine';

import { getEpicChildren } from '../jira/jira-adapter';
import { getJiraRelationshipContext } from '../relationship-index/jira-indexer';
import { detectInconsistencies } from '../scoring/inconsistency-detector';
import { calculateScore } from '../scoring/scoring-engine';

// ═══════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════

const DAY_MS = 86_400_000;
const MAX_SAMPLE = 20;

const TERMINAL_STATUSES = new Set(['DONE', 'CLOSED', 'RESOLVED']);

// ═══════════════════════════════════════════
// STRUCTURED LOGGING
// ═══════════════════════════════════════════

interface StructuredLogEntry {
  readonly timestamp: string;
  readonly level: 'info' | 'warn' | 'error';
  readonly operation: string;
  readonly executionId?: string;
  readonly [key: string]: unknown;
}

const log = (
  level: StructuredLogEntry['level'],
  operation: string,
  executionId?: string,
  data?: Record<string, unknown>,
): void => {
  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify({ timestamp: new Date().toISOString(), level, operation, executionId, ...data }),
  );
};

// ═══════════════════════════════════════════
// CRITERION EVALUATOR: all_subtickets_closed
// ═══════════════════════════════════════════

export const evaluateAllSubticketsClosed = (
  children: readonly JiraTicketData[],
): DoDCriterionResult => {
  if (children.length === 0) {
    return {
      type: 'all_subtickets_closed',
      passed: true,
      details: 'No sub-tickets found; criterion vacuously passes.',
    };
  }

  const notDone = children.filter((c) => !TERMINAL_STATUSES.has(c.status.toUpperCase()));

  if (notDone.length === 0) {
    return {
      type: 'all_subtickets_closed',
      passed: true,
      details: `All ${children.length} sub-tickets are in terminal status.`,
    };
  }

  const notDoneKeys = notDone.map((c) => c.key);
  return {
    type: 'all_subtickets_closed',
    passed: false,
    details: `${notDone.length} of ${children.length} sub-tickets are not done.`,
    remediation: `Close or resolve: ${notDoneKeys.join(', ')}`,
  };
};

// ═══════════════════════════════════════════
// CRITERION EVALUATOR: confluence_page_updated
// ═══════════════════════════════════════════

export const evaluateConfluencePageUpdated = (
  context: RelationshipContext | undefined,
  maxAgeDays: number,
): DoDCriterionResult => {
  if (!context || context.documentation.length === 0) {
    return {
      type: 'confluence_page_updated',
      passed: false,
      details: 'No Confluence documentation linked to this epic.',
      remediation: 'Link at least one Confluence page and keep it updated.',
    };
  }

  const now = Date.now();
  const thresholdMs = maxAgeDays * DAY_MS;

  const freshDoc = context.documentation.find((doc) => {
    const updatedMs = new Date(doc.updatedAt).getTime();
    return now - updatedMs < thresholdMs;
  });

  if (freshDoc) {
    return {
      type: 'confluence_page_updated',
      passed: true,
      details: `Documentation "${freshDoc.label}" updated within ${maxAgeDays} days.`,
    };
  }

  return {
    type: 'confluence_page_updated',
    passed: false,
    details: `${context.documentation.length} docs linked but none updated in the last ${maxAgeDays} days.`,
    remediation: 'Update at least one linked Confluence page.',
  };
};

// ═══════════════════════════════════════════
// CRITERION EVALUATOR: prs_merged
// ═══════════════════════════════════════════

export const evaluatePRsMerged = (
  children: readonly JiraTicketData[],
  context: RelationshipContext | undefined,
): DoDCriterionResult => {
  // Best-effort: check relationship context for merged PRs
  if (context && context.pullRequests.length > 0) {
    const mergedPRs = context.pullRequests.filter(
      (pr) => pr.status.toUpperCase() === 'MERGED' || pr.status.toUpperCase() === 'CLOSED',
    );
    if (mergedPRs.length > 0) {
      return {
        type: 'prs_merged',
        passed: true,
        details: `${mergedPRs.length} merged/closed PR(s) found in relationship context.`,
      };
    }
  }

  // Fallback: scan ticket descriptions for PR references
  const prPattern = /(?:github\.com\/[^/]+\/[^/]+\/pull\/\d+|pull request|pr\s*#?\d+)/i;
  const ticketsWithPRRef = children.filter(
    (c) => prPattern.test(c.description) || prPattern.test(c.summary),
  );

  if (ticketsWithPRRef.length > 0) {
    return {
      type: 'prs_merged',
      passed: true,
      details: `${ticketsWithPRRef.length} ticket(s) reference PRs in description/summary.`,
    };
  }

  return {
    type: 'prs_merged',
    passed: true,
    details: 'No PR references found; passing (best-effort check — cannot confirm absence).',
  };
};

// ═══════════════════════════════════════════
// CRITERION EVALUATOR: no_open_blockers
// ═══════════════════════════════════════════

export const evaluateNoOpenBlockers = (children: readonly JiraTicketData[]): DoDCriterionResult => {
  const openBlockers: readonly string[] = children.flatMap((child) => {
    const links = child.issueLinks ?? [];
    return links
      .filter(
        (link) =>
          link.type.toLowerCase() === 'is blocked by' &&
          !TERMINAL_STATUSES.has(link.targetStatus.toUpperCase()),
      )
      .map((link) => `${child.key} blocked by ${link.targetKey} (${link.targetStatus})`);
  });

  if (openBlockers.length === 0) {
    return {
      type: 'no_open_blockers',
      passed: true,
      details: 'No open blockers found across sub-tickets.',
    };
  }

  return {
    type: 'no_open_blockers',
    passed: false,
    details: `${openBlockers.length} open blocker(s) found.`,
    remediation: openBlockers.join('; '),
  };
};

// ═══════════════════════════════════════════
// CRITERION EVALUATOR: no_critical_inconsistencies
// ═══════════════════════════════════════════

export const evaluateNoCriticalInconsistencies = async (
  children: readonly JiraTicketData[],
  executionId: string,
): Promise<DoDCriterionResult> => {
  const operation = 'evaluateNoCriticalInconsistencies';
  const sample = children.slice(0, MAX_SAMPLE);

  let criticalCount = 0;
  const criticalTickets: string[] = [];

  for (const child of sample) {
    try {
      const inconsistencies = detectInconsistencies(child);
      const criticals = inconsistencies.filter((i) => i.severity === 'critical');
      criticalCount += criticals.length;
      if (criticals.length > 0) {
        criticalTickets.push(child.key);
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'unknown error';
      log('warn', operation, executionId, { ticketKey: child.key, error: message });
      // Fail-open: skip this ticket
    }
  }

  if (criticalCount === 0) {
    return {
      type: 'no_critical_inconsistencies',
      passed: true,
      details: `No critical inconsistencies found (sampled ${sample.length} tickets).`,
    };
  }

  return {
    type: 'no_critical_inconsistencies',
    passed: false,
    details: `${criticalCount} critical inconsistency(ies) in ${criticalTickets.length} ticket(s).`,
    remediation: `Review tickets: ${criticalTickets.join(', ')}`,
  };
};

// ═══════════════════════════════════════════
// CRITERION EVALUATOR: score_above_threshold
// ═══════════════════════════════════════════

export const evaluateScoreAboveThreshold = async (
  children: readonly JiraTicketData[],
  threshold: number,
  executionId: string,
): Promise<DoDCriterionResult> => {
  const operation = 'evaluateScoreAboveThreshold';
  const sample = children.slice(0, MAX_SAMPLE);

  const belowThreshold: string[] = [];
  let totalScore = 0;

  for (const child of sample) {
    try {
      const input: ScoringInput = { ticket: child };
      const result = calculateScore(input);
      totalScore += result.overall;

      if (result.overall < threshold) {
        belowThreshold.push(`${child.key} (${result.overall})`);
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'unknown error';
      log('warn', operation, executionId, { ticketKey: child.key, error: message });
      // Fail-open: skip this ticket
    }
  }

  if (sample.length === 0) {
    return {
      type: 'score_above_threshold',
      passed: true,
      details: 'No sub-tickets to score; criterion vacuously passes.',
    };
  }

  if (belowThreshold.length === 0) {
    const avgScore = Math.round(totalScore / sample.length);
    return {
      type: 'score_above_threshold',
      passed: true,
      details: `All ${sample.length} tickets score >= ${threshold} (avg: ${avgScore}).`,
    };
  }

  return {
    type: 'score_above_threshold',
    passed: false,
    details: `${belowThreshold.length} ticket(s) below threshold ${threshold}.`,
    remediation: `Improve scores for: ${belowThreshold.join(', ')}`,
  };
};

// ═══════════════════════════════════════════
// CRITERION DISPATCHER
// ═══════════════════════════════════════════

/** Dispatch a single criterion to its evaluator (extracted to keep complexity under 10). */
const dispatchCriterion = async (
  criterion: DoDCriterion,
  children: readonly JiraTicketData[],
  context: RelationshipContext | undefined,
  executionId: string,
): Promise<DoDCriterionResult> => {
  switch (criterion.type) {
    case 'all_subtickets_closed':
      return evaluateAllSubticketsClosed(children);

    case 'confluence_page_updated': {
      const maxAgeDays =
        typeof criterion.config?.maxAgeDays === 'number' ? criterion.config.maxAgeDays : 30;
      return evaluateConfluencePageUpdated(context, maxAgeDays);
    }

    case 'prs_merged':
      return evaluatePRsMerged(children, context);

    case 'no_open_blockers':
      return evaluateNoOpenBlockers(children);

    case 'no_critical_inconsistencies':
      return await evaluateNoCriticalInconsistencies(children, executionId);

    case 'score_above_threshold': {
      const threshold =
        typeof criterion.config?.threshold === 'number' ? criterion.config.threshold : 80;
      return await evaluateScoreAboveThreshold(children, threshold, executionId);
    }

    default:
      return {
        type: criterion.type,
        passed: true,
        details: `Unknown criterion type "${criterion.type}"; passing by default.`,
      };
  }
};

const evaluateCriterion = async (
  criterion: DoDCriterion,
  children: readonly JiraTicketData[],
  context: RelationshipContext | undefined,
  executionId: string,
): Promise<DoDCriterionResult> => {
  const operation = 'evaluateCriterion';

  try {
    return await dispatchCriterion(criterion, children, context, executionId);
  } catch (error: unknown) {
    // Fail-open: catch any unexpected errors and mark as passed
    const message = error instanceof Error ? error.message : 'unknown error';
    log('warn', operation, executionId, {
      criterionType: criterion.type,
      error: message,
      note: 'fail-open',
    });
    return {
      type: criterion.type,
      passed: true,
      details: `Criterion evaluation error: ${message}. Passed by default (fail-open).`,
    };
  }
};

// ═══════════════════════════════════════════
// MAIN ORCHESTRATOR
// ═══════════════════════════════════════════

export const evaluateEpicDoD = async (
  epicKey: string,
  projectKey: string,
  dodConfig: EpicDoDConfig,
  executionId: string,
): Promise<DoDEvaluationResult> => {
  const operation = 'evaluateEpicDoD';
  log('info', operation, executionId, {
    epicKey,
    projectKey,
    enabledCriteria: dodConfig.criteria.filter((c) => c.enabled).length,
  });

  // Fetch epic children
  const children = await getEpicChildren(epicKey, executionId);
  log('info', operation, executionId, { epicKey, childCount: children.length });

  // Get relationship context (graceful degradation on failure)
  let context: RelationshipContext | undefined;
  try {
    context = await getJiraRelationshipContext(epicKey, projectKey, executionId);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'unknown error';
    log('warn', operation, executionId, {
      epicKey,
      error: message,
      note: 'relationship context unavailable',
    });
    context = undefined;
  }

  // Evaluate each enabled criterion
  const enabledCriteria = dodConfig.criteria.filter((c) => c.enabled);
  const criterionResults: DoDCriterionResult[] = [];

  for (const criterion of enabledCriteria) {
    const result = await evaluateCriterion(criterion, children, context, executionId);
    criterionResults.push(result);
  }

  // Build overall result
  const passed = criterionResults.every((r) => r.passed);
  const failingCriteria = criterionResults.filter((r) => !r.passed).map((r) => r.type);
  const overallCompletion =
    criterionResults.length > 0
      ? Math.round(
          (criterionResults.filter((r) => r.passed).length / criterionResults.length) * 100,
        )
      : 100;

  const result: DoDEvaluationResult = {
    epicKey,
    passed,
    criterionResults,
    failingCriteria,
    overallCompletion,
    executionId,
    timestamp: new Date().toISOString(),
  };

  log('info', operation, executionId, {
    epicKey,
    passed,
    overallCompletion,
    failingCount: failingCriteria.length,
  });

  return result;
};

// ═══════════════════════════════════════════
// ENFORCEMENT ACTION GENERATOR
// ═══════════════════════════════════════════

export const determineDoDEnforcementActions = (
  result: DoDEvaluationResult,
  epicKey: string,
): readonly EnforcementAction[] => {
  if (result.passed) {
    return [];
  }

  const failedSummary = result.criterionResults
    .filter((r) => !r.passed)
    .map((r) => `- ${r.type}: ${r.details}`)
    .join('\n');

  const actions: EnforcementAction[] = [
    {
      type: 'add_comment',
      target: 'jira',
      body: `**Definition of Done check failed** for epic ${epicKey}.\n\nCompletion: ${result.overallCompletion}%\n\nFailed criteria:\n${failedSummary}`,
    },
    {
      type: 'block_transition',
      transitionId: '',
      reason: `DoD not met for ${epicKey}: ${result.failingCriteria.join(', ')}`,
    },
  ];

  return actions;
};
