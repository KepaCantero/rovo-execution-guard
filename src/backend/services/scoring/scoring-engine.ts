// [ARCH-SOLID-058] Scoring Engine — zero framework dependencies
// [ARCH-SOLID-001] Single Responsibility: score calculation + quality gate evaluation
// [ARCH-SOLID-002] Open/Closed: weights and thresholds configurable without code change
// [ARCH-SOLID-202] Zero any usage
// [ARCH-SOLID-0802] Proprietary weighted scoring combining multiple signals

import type { ConsistencyScore, ScoreAxes, AxisDetail } from '../../types/consistency-score';
import type { QualityGateResult, GateType } from '../../types/quality-gate';
import type { Inconsistency } from '../../types/inconsistency';
import type { ProjectConfig } from '../../types/project-config';
import type { JiraTicketData } from '../../types/jira-data';
import type { RelationshipContext } from '../../types/relationship-index';
import { ScoringError, InsufficientDataError } from '../../types/errors';
import {
  calculateDocumentationSignal,
  calculateConsistencySignal,
} from '../relationship-index/relationship-consumer';

// ---------------------------------------------------------------------------
// Public Types
// ---------------------------------------------------------------------------

export type ScoringAxisName =
  | 'clarity'
  | 'consistency'
  | 'risk'
  | 'documentation'
  | 'technicalDebt';

export type AxisWeights = Readonly<Record<ScoringAxisName, number>>;

export interface ScoringInput {
  readonly ticket: JiraTicketData;
  readonly inconsistencies?: readonly Inconsistency[];
  readonly relationshipContext?: RelationshipContext; // [AC-04] optional relationship context
}

export interface ScoringConfig {
  readonly axisWeights?: AxisWeights;
  readonly scoreThreshold?: number;
}

// ---------------------------------------------------------------------------
// Scoring Constants
// ---------------------------------------------------------------------------

export const DEFAULT_AXIS_WEIGHTS: AxisWeights = {
  clarity: 25,
  consistency: 25,
  risk: 20,
  documentation: 15,
  technicalDebt: 15,
} as const;

export const DEFAULT_SCORE_THRESHOLD = 80;

export const SCORING_PRECISION = 2;

// ---------------------------------------------------------------------------
// Internal Helpers
// ---------------------------------------------------------------------------

/** Generate a unique execution ID (timestamp + random suffix). */
const generateExecutionId = (): string => {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `exec-${timestamp}-${random}`;
};

/** Round to fixed precision using integer arithmetic to avoid floating-point drift. */
const roundToPrecision = (value: number, precision: number = SCORING_PRECISION): number => {
  const factor = Math.pow(10, precision);
  return Math.round(value * factor) / factor;
};

/** Clamp a value between min and max inclusive. */
const clamp = (value: number, min: number, max: number): number => {
  return Math.min(Math.max(value, min), max);
};

/** Check if a string has meaningful content after trimming. */
const hasContent = (value: string | undefined): boolean => {
  return typeof value === 'string' && value.trim().length > 0;
};

/** [AC-05] Apply relationship documentation signal to a score. */
const applyDocSignal = (score: number, relationshipContext?: RelationshipContext): number => {
  if (!relationshipContext) return score;
  const signal = calculateDocumentationSignal(relationshipContext);
  return score + signal.bonus + signal.penalty;
};

/** [AC-05] Apply relationship consistency signal to a score. */
const applyConsistencySignal = (
  score: number,
  relationshipContext?: RelationshipContext,
  ticketSummary?: string,
): number => {
  if (!relationshipContext) return score;
  const signal = calculateConsistencySignal(relationshipContext, ticketSummary);
  return score + signal.bonus + signal.penalty;
};

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const validateTicket = (ticket: JiraTicketData, executionId: string): void => {
  if (!hasContent(ticket.key)) {
    throw new InsufficientDataError(
      'Ticket key is required for scoring',
      'SCORING_MISSING_KEY',
      executionId,
    );
  }
  if (!hasContent(ticket.summary)) {
    throw new InsufficientDataError(
      'Ticket summary is required for scoring',
      'SCORING_MISSING_SUMMARY',
      executionId,
    );
  }
  if (!hasContent(ticket.description)) {
    throw new InsufficientDataError(
      'Ticket description is required for scoring',
      'SCORING_MISSING_DESCRIPTION',
      executionId,
    );
  }
};

const validateWeights = (weights: AxisWeights, executionId: string): void => {
  const total =
    weights.clarity +
    weights.consistency +
    weights.risk +
    weights.documentation +
    weights.technicalDebt;
  if (total !== 100) {
    throw new ScoringError(
      `Axis weights must sum to 100, got ${total}`,
      'SCORING_INVALID_WEIGHTS',
      executionId,
    );
  }
};

// ---------------------------------------------------------------------------
// Axis Scoring Functions (0-100 each)
// ---------------------------------------------------------------------------

/** Score description length contribution (0-30 points). */
const scoreDescLength = (descLength: number): number => {
  if (descLength >= 500) return 30;
  if (descLength >= 200) return 20;
  if (descLength >= 50) return 10;
  return 5;
};

/** Detect whether the description contains acceptance-criteria patterns. */
const hasAcceptanceCriteria = (description: string): boolean => {
  const lowerDesc = description.toLowerCase();
  return (
    lowerDesc.includes('acceptance criteria') ||
    lowerDesc.includes('acceptance criterion') ||
    lowerDesc.includes('definition of done') ||
    lowerDesc.includes('do:') ||
    /[-*]\s+\w+.*\n[-*]\s+\w+/.test(description)
  );
};

/** Score structure contribution from criteria and list items (0-30 points). */
const scoreStructure = (description: string): number => {
  if (hasAcceptanceCriteria(description)) return 30;
  if ((description.match(/\n[-*]\s/g) ?? []).length >= 2) return 15;
  return 0;
};

/** Score summary quality based on length (0-10 points). */
const scoreSummaryQuality = (summaryLength: number): number => {
  if (summaryLength >= 20 && summaryLength <= 100) return 10;
  if (summaryLength >= 10) return 5;
  return 0;
};

/**
 * Clarity: evaluates how clear and unambiguous the ticket description is.
 * Signals: description length, structure (headings, lists), acceptance criteria.
 */
const scoreClarity = (ticket: JiraTicketData): number => {
  const description = ticket.description;
  let score = 0;

  score += scoreDescLength(description.trim().length);
  score += scoreStructure(description);

  // Richness: multiple paragraphs/sections (0-20 points)
  const paragraphCount = description.split(/\n\s*\n/).filter((p) => p.trim().length > 0).length;
  score += clamp(paragraphCount * 5, 0, 20);

  score += scoreSummaryQuality(ticket.summary.trim().length);

  // Bonus: structured sections (headings)
  if (/^#{1,3}\s/m.test(description)) {
    score += 10;
  }

  return clamp(score, 0, 100);
};

/**
 * Consistency: alignment between summary, description, and criteria.
 * Measures how well the summary reflects the description content.
 * [AC-05] Applies relationship signals when available.
 */
const scoreConsistency = (
  ticket: JiraTicketData,
  relationshipContext?: RelationshipContext,
): number => {
  const summary = ticket.summary.trim().toLowerCase();
  const description = ticket.description.trim().toLowerCase();
  let score = applyConsistencySignal(40, relationshipContext, ticket.summary);

  // Extract significant words from summary (ignore common stop words)
  const stopWords = new Set([
    'a',
    'an',
    'the',
    'is',
    'are',
    'was',
    'were',
    'be',
    'been',
    'being',
    'have',
    'has',
    'had',
    'do',
    'does',
    'did',
    'will',
    'would',
    'shall',
    'should',
    'may',
    'might',
    'must',
    'can',
    'could',
    'of',
    'in',
    'to',
    'for',
    'with',
    'on',
    'at',
    'from',
    'by',
    'about',
    'as',
    'into',
    'through',
    'during',
    'before',
    'after',
    'above',
    'below',
    'between',
    'and',
    'or',
    'not',
    'no',
    'but',
    'it',
    'its',
    'this',
    'that',
    'these',
    'those',
    'we',
    'our',
    'they',
    'them',
    'their',
    'he',
    'she',
    'him',
    'her',
    'his',
    'which',
    'what',
    'when',
    'where',
    'how',
    'all',
    'each',
    'every',
    'both',
    'few',
    'more',
    'most',
    'other',
    'some',
    'such',
    'than',
    'too',
    'very',
    'just',
    'also',
    'now',
    'here',
    'there',
    'so',
    'if',
    'then',
    'because',
    'since',
    'while',
    'although',
    'unless',
    'until',
    'up',
    'out',
  ]);

  const summaryWords = summary.split(/\s+/).filter((w) => w.length > 2 && !stopWords.has(w));

  if (summaryWords.length > 0) {
    const matchCount = summaryWords.filter((w) => description.includes(w)).length;
    const matchRatio = matchCount / summaryWords.length;
    score += Math.round(matchRatio * 40);
  } else {
    score += 10;
  }

  // Alignment: description should expand on summary (longer description = better)
  if (description.length > summary.length * 3) {
    score += 20;
  } else if (description.length > summary.length * 2) {
    score += 10;
  }

  return clamp(score, 0, 100);
};

/** Count positive risk-reducing signals in the ticket metadata. */
const countPositiveRiskSignals = (ticket: JiraTicketData): number => {
  let bonus = 0;
  if (hasContent(ticket.assignee)) bonus += 10;
  if (hasContent(ticket.priority)) bonus += 10;
  if (ticket.labels.length > 0) bonus += 10;
  if (ticket.description.trim().length >= 200) bonus += 10;
  if (ticket.description.toLowerCase().includes('acceptance criteria')) bonus += 10;
  return bonus;
};

/** Count negative risk signals: vague language and high-priority-without-detail. */
const countNegativeRiskSignals = (ticket: JiraTicketData): number => {
  let penalty = 0;
  const vaguePhrases = [
    'asap',
    'urgent',
    'needs to be done',
    'just',
    'rewrite everything',
    'from scratch',
  ];
  penalty += countKeywordPenalties(ticket.description.toLowerCase(), vaguePhrases);

  // High priority without detail is risky
  if (
    (ticket.priority === 'High' || ticket.priority === 'Highest') &&
    ticket.description.trim().length < 100
  ) {
    penalty += 10;
  }
  return penalty;
};

/**
 * Risk: presence or absence of risk indicators (inverse: higher = lower risk).
 * Well-specified tickets with clear scope are lower risk.
 */
const scoreRisk = (ticket: JiraTicketData): number => {
  const score = 50 + countPositiveRiskSignals(ticket) - countNegativeRiskSignals(ticket);
  return clamp(score, 0, 100);
};

/**
 * Documentation: completeness of documentation and references.
 * Signals: labels, assignee, reporter, structured fields.
 * [AC-05] Applies relationship signals when available.
 */
const scoreDocumentation = (
  ticket: JiraTicketData,
  relationshipContext?: RelationshipContext,
): number => {
  let score = 20; // Base

  // Labels contribute (0-20 points)
  const labelCount = ticket.labels.length;
  if (labelCount >= 3) {
    score += 20;
  } else if (labelCount >= 1) {
    score += 10;
  }

  // Assignee present (+15)
  if (hasContent(ticket.assignee)) {
    score += 15;
  }

  // Reporter present (+10)
  if (hasContent(ticket.reporter)) {
    score += 10;
  }

  // Priority set (+10)
  if (hasContent(ticket.priority)) {
    score += 10;
  }

  // Summary is meaningful length (+10)
  if (ticket.summary.trim().length >= 15) {
    score += 10;
  }

  // Has linked documentation keywords (+15)
  const lowerDesc = ticket.description.toLowerCase();
  if (
    lowerDesc.includes('http') ||
    lowerDesc.includes('docs') ||
    lowerDesc.includes('confluence')
  ) {
    score += 15;
  }

  return clamp(applyDocSignal(score, relationshipContext), 0, 100);
};

/** Score description scope contribution for tech debt axis. */
const scoreDescriptionScope = (descLen: number): number => {
  if (descLen >= 100 && descLen <= 2000) return 15; // Well-scoped
  if (descLen > 2000) return 5; // Potentially too broad
  return -5; // Too thin
};

/** Count keyword matches in lowercased text, applying penalty per match. */
const countKeywordPenalties = (text: string, keywords: readonly string[]): number => {
  let penalty = 0;
  for (const keyword of keywords) {
    if (text.includes(keyword)) {
      penalty += 10;
    }
  }
  return penalty;
};

/**
 * TechnicalDebt: indicators of technical debt in the ticket scope (inverse: higher = less debt).
 * Focused, well-scoped tickets score higher.
 */
const scoreTechnicalDebt = (ticket: JiraTicketData): number => {
  let score = 60; // Base

  // Issue type: focused types score higher
  const focusedTypes = ['Task', 'Bug', 'Sub-task', 'Story'];
  if (focusedTypes.includes(ticket.issueType)) {
    score += 10;
  } else if (ticket.issueType === 'Epic') {
    score -= 10;
  }

  score += scoreDescriptionScope(ticket.description.trim().length);

  // Has acceptance criteria (+10)
  if (ticket.description.toLowerCase().includes('acceptance criteria')) {
    score += 10;
  }

  // Negative: debt keywords
  const debtKeywords = [
    'hack',
    'workaround',
    'temporary',
    'quick fix',
    'rewrite',
    'refactor all',
    'from scratch',
  ];
  score -= countKeywordPenalties(ticket.description.toLowerCase(), debtKeywords);

  return clamp(score, 0, 100);
};

// ---------------------------------------------------------------------------
// Core Scoring Function
// ---------------------------------------------------------------------------

/**
 * Calculate a multi-axis consistency score from ticket data.
 *
 * @param input - Scoring input containing the ticket and optional context
 * @param config - Optional configuration for weights and threshold
 * @returns ConsistencyScore with individual axis scores and weighted overall
 * @throws InsufficientDataError if ticket lacks required fields
 * @throws ScoringError if configuration is invalid
 */
export const calculateScore = (input: ScoringInput, config?: ScoringConfig): ConsistencyScore => {
  const executionId = generateExecutionId();

  // Validate inputs
  validateTicket(input.ticket, executionId);

  const weights = config?.axisWeights ?? DEFAULT_AXIS_WEIGHTS;
  if (config?.axisWeights) {
    validateWeights(config.axisWeights, executionId);
  }

  // Calculate individual axis scores
  const clarity = scoreClarity(input.ticket);
  const consistency = scoreConsistency(input.ticket, input.relationshipContext);
  const risk = scoreRisk(input.ticket);
  const documentation = scoreDocumentation(input.ticket, input.relationshipContext);
  const technicalDebt = scoreTechnicalDebt(input.ticket);

  const axes: ScoreAxes = { clarity, consistency, risk, documentation, technicalDebt };

  // Compute weighted overall using fixed-precision arithmetic
  const rawOverall =
    clarity * (weights.clarity / 100) +
    consistency * (weights.consistency / 100) +
    risk * (weights.risk / 100) +
    documentation * (weights.documentation / 100) +
    technicalDebt * (weights.technicalDebt / 100);

  const overall = roundToPrecision(clamp(rawOverall, 0, 100));

  return {
    overall,
    axes,
    timestamp: new Date().toISOString(),
    executionId,
  };
};

// ---------------------------------------------------------------------------
// Quality Gate Evaluation
// ---------------------------------------------------------------------------

/**
 * Evaluate whether a consistency score passes a specific quality gate.
 *
 * @param score - The consistency score to evaluate
 * @param gateType - Which lifecycle gate to evaluate
 * @param config - Optional project configuration for thresholds
 * @param inconsistencies - Optional list of detected inconsistencies
 * @returns QualityGateResult with pass/fail and detailed reasoning
 */
export const evaluateQualityGate = (
  score: ConsistencyScore,
  gateType: GateType,
  config?: Pick<ProjectConfig, 'scoreThreshold'>,
  inconsistencies?: readonly Inconsistency[],
): QualityGateResult => {
  const threshold = config?.scoreThreshold ?? DEFAULT_SCORE_THRESHOLD;
  const criticalInconsistencies = (inconsistencies ?? []).filter(
    (inc) => inc.severity === 'critical',
  );

  let passed = false;
  const blockedTransitions: string[] = [];

  switch (gateType) {
    case 'definition': {
      passed = score.overall >= threshold;
      if (!passed) {
        blockedTransitions.push('In Progress');
      }
      break;
    }
    case 'execution': {
      passed = criticalInconsistencies.length === 0;
      if (!passed) {
        blockedTransitions.push('PR Merge');
      }
      break;
    }
    case 'delivery': {
      const scorePass = score.overall >= threshold;
      const noCritical = criticalInconsistencies.length === 0;
      passed = scorePass && noCritical;
      if (!passed) {
        blockedTransitions.push('Merge');
      }
      break;
    }
  }

  return {
    gate: gateType,
    passed,
    score,
    inconsistencies: criticalInconsistencies,
    blockedTransitions,
    executionId: score.executionId,
  };
};

// ---------------------------------------------------------------------------
// Axis Suggestions
// ---------------------------------------------------------------------------

/** Human-readable descriptions of each scoring axis, used for Rovo prompts */
export const AXIS_DESCRIPTIONS: Readonly<Record<ScoringAxisName, string>> = {
  clarity:
    'Measures how clear and unambiguous the ticket description is. Considers description length, structure (headings, paragraphs), acceptance criteria, and summary quality.',
  consistency:
    'Measures alignment between summary and description. Evaluates keyword overlap and whether the description elaborates on the summary.',
  risk: 'Measures risk exposure based on missing fields (assignee, priority, labels), vague urgency language, and incomplete information.',
  documentation:
    'Measures completeness of documentation: labels, assignee, reporter, priority, summary quality, and links to external documentation.',
  technicalDebt:
    'Measures scoping quality: focused issue types, well-sized descriptions, acceptance criteria, and absence of debt-indicating keywords.',
};

/** Human-readable labels for each axis */
const AXIS_LABELS: Readonly<Record<ScoringAxisName, string>> = {
  clarity: 'Clarity',
  consistency: 'Consistency',
  risk: 'Risk',
  documentation: 'Documentation',
  technicalDebt: 'Technical Debt',
} as const;

const ensureNonEmpty = (items: string[], fallback: string): string[] =>
  items.length > 0 ? items : [fallback];

const claritySuggestions = (desc: string, summaryLen: number): string[] => {
  const out: string[] = [];
  const descLen = desc.length;
  const descLower = desc.toLowerCase();
  if (descLen < 200)
    out.push(`Expand the description (currently ${descLen} characters, recommended 200+).`);
  if (!descLower.includes('acceptance criteria') && !descLower.includes('## acceptance'))
    out.push('Add acceptance criteria to define when the task is complete.');
  if (!desc.includes('\n\n') && descLen > 50)
    out.push('Break the description into sections with headings for better readability.');
  if (!desc.includes('#') && descLen > 100)
    out.push('Use markdown headings (##) to structure the description.');
  if (summaryLen < 20 || summaryLen > 100)
    out.push('Use a summary between 20-100 characters that clearly states the goal.');
  return ensureNonEmpty(out, 'Description is clear and well-structured.');
};

const consistencySuggestions = (desc: string, summary: string): string[] => {
  const out: string[] = [];
  const summaryWords = summary
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 3);
  const descLower = desc.toLowerCase();
  const overlap = summaryWords.filter((w) => descLower.includes(w));
  if (summaryWords.length > 0 && overlap.length / summaryWords.length < 0.5)
    out.push('Ensure key terms from the summary appear in the description.');
  if (desc.length < summary.length * 3)
    out.push('Expand the description to elaborate on the summary in more detail.');
  return ensureNonEmpty(out, 'Summary and description are well aligned.');
};

const riskSuggestions = (
  desc: string,
  hasAssignee: boolean,
  hasPriority: boolean,
  labelCount: number,
): string[] => {
  const out: string[] = [];
  if (!hasAssignee) out.push('Assign the ticket to a responsible team member.');
  if (!hasPriority) out.push('Set a priority level to indicate urgency.');
  if (labelCount === 0) out.push('Add labels for categorization and traceability.');
  const vaguePatterns = /\b(asap|urgent|rewrite everything|from scratch|fix asap)\b/i;
  if (vaguePatterns.test(desc))
    out.push('Replace vague urgency language ("asap", "urgent") with specific timelines.');
  if (hasPriority && desc.length < 200)
    out.push('High-priority tickets should have detailed descriptions.');
  return ensureNonEmpty(out, 'Risk indicators look good.');
};

const documentationSuggestions = (
  desc: string,
  summary: string,
  hasAssignee: boolean,
  labelCount: number,
): string[] => {
  const out: string[] = [];
  const descLower = desc.toLowerCase();
  if (labelCount < 2) out.push(`Add more labels (currently ${labelCount}, recommended 2+).`);
  if (!hasAssignee) out.push('Assign the ticket for accountability.');
  if (!descLower.includes('http') && !descLower.includes('confluence'))
    out.push('Add links to relevant documentation or Confluence pages.');
  if (summary.length < 15) out.push('Use a more descriptive summary (15+ characters).');
  return ensureNonEmpty(out, 'Documentation is complete.');
};

const technicalDebtSuggestions = (desc: string, issueType: string): string[] => {
  const out: string[] = [];
  const debtKeywords =
    /\b(hack|workaround|temporary|quick fix|rewrite|refactor all|from scratch)\b/i;
  if (debtKeywords.test(desc))
    out.push(
      'Avoid debt-indicating keywords (hack, workaround, temporary, quick fix). Consider a proper solution.',
    );
  if (issueType === 'Epic')
    out.push('Break this Epic into smaller, focused Stories or Tasks for better scoping.');
  if (desc.length > 2000)
    out.push('Description is very long (2000+ chars). Consider splitting into smaller tickets.');
  if (!desc.toLowerCase().includes('acceptance criteria'))
    out.push('Add acceptance criteria to clearly scope the work.');
  return ensureNonEmpty(out, 'Ticket is well-scoped with low technical debt risk.');
};

/**
 * Generates per-axis actionable suggestions based on scoring signals.
 * These are static suggestions derived from the same signals the scoring engine uses.
 * Used as fallback when Rovo AI is not available.
 */
export const generateAxisSuggestions = (
  ticket: JiraTicketData,
  axes: ScoreAxes,
): Record<string, AxisDetail> => {
  const desc = ticket.description ?? '';
  const hasAssignee = !!ticket.assignee;
  const hasPriority = !!ticket.priority;
  const labelCount = ticket.labels.length;

  const suggestions: Record<ScoringAxisName, string[]> = {
    clarity: claritySuggestions(desc, ticket.summary.length),
    consistency: consistencySuggestions(desc, ticket.summary),
    risk: riskSuggestions(desc, hasAssignee, hasPriority, labelCount),
    documentation: documentationSuggestions(desc, ticket.summary, hasAssignee, labelCount),
    technicalDebt: technicalDebtSuggestions(desc, ticket.issueType),
  };

  const result: Record<string, AxisDetail> = {};
  const axisNames: ScoringAxisName[] = [
    'clarity',
    'consistency',
    'risk',
    'documentation',
    'technicalDebt',
  ];
  for (const name of axisNames) {
    result[name] = {
      score: axes[name],
      label: AXIS_LABELS[name],
      suggestions: suggestions[name],
    };
  }
  return result;
};
