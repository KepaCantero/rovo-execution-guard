// [ARCH-SOLID-058] Cross-Epic Consistency Validator — zero framework dependencies
// [ARCH-SOLID-049-01] SRP: cross-epic validation + consistency scoring only
// [ARCH-SOLID-202] Zero any usage
// [ARCH-SOLID-232] Named exports only, no default export

import type { JiraTicketData } from '../../types/jira-data';
import type { Severity } from '../../types/inconsistency';
import type {
  CrossEpicValidationResult,
  SiblingContradictionResult,
  CoverageGap,
  DependencyGap,
  ContradictionType,
  EpicAnalysisInput,
} from '../../types/epic-types';
import { getEpicChildren, getTicketData } from '../jira/jira-adapter';

// ═══════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════

const SIMILARITY_THRESHOLD = 0.7;
const MAX_SIBLINGS = 50;

const DONE_STATUSES = new Set(['DONE', 'CLOSED', 'RESOLVED']);

const SCOPE_CONTRADICTION_PAIRS: readonly {
  readonly term: string;
  readonly negation: string;
}[] = [
  { term: 'include', negation: 'exclude' },
  { term: 'enable', negation: 'disable' },
  { term: 'must', negation: 'must not' },
];

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
// TRIGRAM SIMILARITY (local implementation)
// ═══════════════════════════════════════════

const buildTrigrams = (text: string): Set<string> => {
  const trigrams = new Set<string>();
  for (let i = 0; i <= text.length - 3; i++) {
    trigrams.add(text.substring(i, i + 3));
  }
  return trigrams;
};

const calculateTrigramSimilarity = (a: string, b: string): number => {
  const normA = a.toLowerCase().replace(/\s+/g, ' ').trim();
  const normB = b.toLowerCase().replace(/\s+/g, ' ').trim();
  if (normA === normB) return 1;
  if (normA.length === 0 || normB.length === 0) return 0;
  const trigramsA = buildTrigrams(normA);
  const trigramsB = buildTrigrams(normB);
  let intersection = 0;
  for (const t of trigramsA) {
    if (trigramsB.has(t)) intersection++;
  }
  const union = trigramsA.size + trigramsB.size - intersection;
  return union === 0 ? 0 : intersection / union;
};

// ═══════════════════════════════════════════
// KEYWORD EXTRACTION
// ═══════════════════════════════════════════

const STOP_WORDS = new Set([
  'the',
  'a',
  'an',
  'and',
  'or',
  'but',
  'in',
  'on',
  'at',
  'to',
  'for',
  'of',
  'with',
  'by',
  'from',
  'is',
  'it',
  'as',
  'be',
  'was',
  'are',
  'this',
  'that',
  'which',
  'who',
  'whom',
  'its',
  'has',
  'had',
  'have',
  'will',
  'shall',
  'may',
  'can',
  'do',
  'did',
  'not',
  'no',
  'all',
  'any',
]);

const extractKeywords = (text: string): readonly string[] => {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
  return [...new Set(words)];
};

// ═══════════════════════════════════════════
// DETECTION SUB-FUNCTIONS
// ═══════════════════════════════════════════

/**
 * Pairwise trigram comparison of sibling summaries.
 * Returns duplicate contradictions where similarity exceeds threshold.
 * Complexity: O(n^2 * m) where n = siblings, m = max summary length.
 */
export const detectDuplicateCriteria = (
  siblings: readonly JiraTicketData[],
): readonly SiblingContradictionResult[] => {
  if (siblings.length < 2) return [];

  const capped = siblings.slice(0, MAX_SIBLINGS);
  const results: SiblingContradictionResult[] = [];

  for (let i = 0; i < capped.length; i++) {
    for (let j = i + 1; j < capped.length; j++) {
      const ticketA = capped[i] as JiraTicketData;
      const ticketB = capped[j] as JiraTicketData;
      const similarity = calculateTrigramSimilarity(ticketA.summary, ticketB.summary);

      if (similarity >= SIMILARITY_THRESHOLD && similarity < 1) {
        results.push({
          ticketA: ticketA.key,
          ticketB: ticketB.key,
          contradictionType: 'duplicate_criteria' as ContradictionType,
          description: `Summaries are ${Math.round(similarity * 100)}% similar — possible duplicate criteria`,
          severity: 'warning' as Severity,
        });
      }
    }
  }

  return results;
};

/**
 * Detect contradiction pairs (include/exclude, enable/disable, must/must not)
 * across sibling descriptions.
 * Complexity: O(n^2 * p) where n = siblings, p = contradiction pairs.
 */
export const detectConflictingScope = (
  siblings: readonly JiraTicketData[],
): readonly SiblingContradictionResult[] => {
  if (siblings.length < 2) return [];

  const capped = siblings.slice(0, MAX_SIBLINGS);
  const results: SiblingContradictionResult[] = [];

  for (let i = 0; i < capped.length; i++) {
    for (let j = i + 1; j < capped.length; j++) {
      const ticketA = capped[i] as JiraTicketData;
      const ticketB = capped[j] as JiraTicketData;

      const textA = `${ticketA.summary} ${ticketA.description}`.toLowerCase();
      const textB = `${ticketB.summary} ${ticketB.description}`.toLowerCase();

      for (const pair of SCOPE_CONTRADICTION_PAIRS) {
        const termPattern = new RegExp(`\\b${pair.term}\\b`, 'i');
        const negationPattern = new RegExp(`\\b${pair.negation}\\b`, 'i');

        const termInA = termPattern.test(textA);
        const negationInB = negationPattern.test(textB);
        const termInB = termPattern.test(textB);
        const negationInA = negationPattern.test(textA);

        if ((termInA && negationInB) || (termInB && negationInA)) {
          results.push({
            ticketA: ticketA.key,
            ticketB: ticketB.key,
            contradictionType: 'conflicting_scope' as ContradictionType,
            description: `Conflicting scope: "${pair.term}" vs "${pair.negation}" across siblings`,
            severity: 'critical' as Severity,
          });
        }
      }
    }
  }

  return results;
};

/**
 * Extract keywords from epic text and find keywords not covered by any child summary.
 * Generate suggested ticket summaries for uncovered areas.
 * Complexity: O(k * n * m) where k = epic keywords, n = siblings, m = summary length.
 */
export const detectCoverageHoles = (
  epicSummary: string,
  epicDescription: string,
  siblings: readonly JiraTicketData[],
): readonly CoverageGap[] => {
  const epicText = `${epicSummary} ${epicDescription}`;
  const epicKeywords = extractKeywords(epicText);

  if (epicKeywords.length === 0 || siblings.length === 0) return [];

  const childKeywords = new Set<string>();
  for (const sibling of siblings) {
    const words = extractKeywords(sibling.summary);
    for (const word of words) {
      childKeywords.add(word);
    }
  }

  const uncovered = epicKeywords.filter((kw) => !childKeywords.has(kw));

  return uncovered.slice(0, 10).map(
    (area): CoverageGap => ({
      area,
      description: `Epic keyword "${area}" not covered by any child ticket summary`,
      suggestedTicketSummary: `Implement ${area} functionality`,
    }),
  );
};

/**
 * Scan issueLinks of each sibling for references to tickets outside the epic
 * that are not in a "Done" state.
 * Complexity: O(n * l) where n = siblings, l = links per sibling.
 */
export const detectDependencyGaps = (
  siblings: readonly JiraTicketData[],
): readonly DependencyGap[] => {
  const epicKeys = new Set(siblings.map((s) => s.key));
  const results: DependencyGap[] = [];

  for (const sibling of siblings) {
    const links = sibling.issueLinks;
    if (links === undefined || links.length === 0) continue;

    for (const link of links) {
      if (epicKeys.has(link.targetKey)) continue;

      const isDone = DONE_STATUSES.has(link.targetStatus.toUpperCase());
      if (!isDone && link.targetStatus.trim().length > 0) {
        results.push({
          sourceTicket: sibling.key,
          missingDependency: link.targetKey,
          description: `${sibling.key} depends on ${link.targetKey} (${link.targetStatus}) which is not done`,
        });
      }
    }
  }

  return results;
};

/**
 * Calculate overall cross-epic consistency score (0-100).
 * Starts at 100, subtracts per contradiction severity: critical=-20, warning=-10, info=-2.
 * Complexity: O(n) where n = contradiction count.
 */
export const calculateCrossEpicConsistencyScore = (
  contradictions: readonly SiblingContradictionResult[],
  _siblings: readonly JiraTicketData[],
): number => {
  let score = 100;

  for (const c of contradictions) {
    if (c.severity === 'critical') {
      score -= 20;
    } else if (c.severity === 'warning') {
      score -= 10;
    } else {
      score -= 2;
    }
  }

  return Math.max(0, score);
};

// ═══════════════════════════════════════════
// MAIN ORCHESTRATOR
// ═══════════════════════════════════════════

/**
 * Main orchestrator: fetches epic children and epic data, runs all detection
 * sub-functions, calculates overall consistency score.
 * Fail-open: returns empty result on any error.
 *
 * AC ref: Feature 1 — Cross-Epic Consistency Validation
 * REGLA: [ARCH-SOLID-058] — zero framework dependencies
 * REGLA: [ARCH-SOLID-232] — named exports only
 */
export const validateCrossEpicConsistency = async (
  input: EpicAnalysisInput,
): Promise<CrossEpicValidationResult> => {
  const timestamp = new Date().toISOString();
  const emptyResult: CrossEpicValidationResult = {
    epicKey: input.epicKey,
    siblingsAnalyzed: 0,
    contradictions: [],
    coverageGaps: [],
    dependencyGaps: [],
    overallConsistency: 100,
    executionId: input.executionId,
    timestamp,
  };

  try {
    log('info', 'validateCrossEpicConsistency', input.executionId, {
      epicKey: input.epicKey,
      projectKey: input.projectKey,
    });

    const [siblings, epicData] = await Promise.all([
      getEpicChildren(input.epicKey, input.executionId),
      getTicketData(input.epicKey, input.executionId),
    ]);

    if (siblings.length === 0) {
      log('info', 'validateCrossEpicConsistency', input.executionId, {
        epicKey: input.epicKey,
        note: 'no children found',
      });
      return emptyResult;
    }

    const cappedSiblings = siblings.slice(0, MAX_SIBLINGS);

    const duplicateCriteria = detectDuplicateCriteria(cappedSiblings);
    const conflictingScope = detectConflictingScope(cappedSiblings);
    const coverageHoles = detectCoverageHoles(
      epicData.summary,
      epicData.description,
      cappedSiblings,
    );
    const dependencyGaps = detectDependencyGaps(cappedSiblings);

    const allContradictions: readonly SiblingContradictionResult[] = [
      ...duplicateCriteria,
      ...conflictingScope,
    ];

    const overallConsistency = calculateCrossEpicConsistencyScore(
      allContradictions,
      cappedSiblings,
    );

    log('info', 'validateCrossEpicConsistency', input.executionId, {
      epicKey: input.epicKey,
      siblingsAnalyzed: cappedSiblings.length,
      contradictionCount: allContradictions.length,
      coverageGapCount: coverageHoles.length,
      dependencyGapCount: dependencyGaps.length,
      overallConsistency,
    });

    return {
      epicKey: input.epicKey,
      siblingsAnalyzed: cappedSiblings.length,
      contradictions: allContradictions,
      coverageGaps: coverageHoles,
      dependencyGaps,
      overallConsistency,
      executionId: input.executionId,
      timestamp,
    };
  } catch (error: unknown) {
    log('error', 'validateCrossEpicConsistency', input.executionId, {
      epicKey: input.epicKey,
      error: error instanceof Error ? error.message : String(error),
    });

    return emptyResult;
  }
};
