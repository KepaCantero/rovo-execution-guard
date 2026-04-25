// [ARCH-SOLID-058] Inconsistency Detector — zero framework dependencies
// [ARCH-SOLID-049-01] SRP: detectors handle only detection, not scoring or enforcement
// [ARCH-SOLID-049-02] OCP: detectors extensible via strategy pipeline
// [ARCH-SOLID-0784] Detectors as independent pipeline modules
// [ARCH-SOLID-0912] Idempotent: same input produces same output
// [ARCH-SOLID-202] Zero any usage

import type { Inconsistency, InconsistencyType, Severity } from '../../types/inconsistency';
import type { JiraTicketData } from '../../types/jira-data';
import type { RovoContext } from '../../types/rovo-context';
import { InsufficientDataError } from '../../types/errors';

// ═══════════════════════════════════════════
// PUBLIC TYPES
// ═══════════════════════════════════════════

export interface ContradictionPair {
  readonly term: string;
  readonly negation: string;
}

export interface DetectorConfig {
  readonly similarityThreshold: number;
  readonly ambiguousWords: readonly string[];
  readonly contradictionPairs: readonly ContradictionPair[];
  readonly requiredFields: readonly string[];
}

// ═══════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════

export const DEFAULT_DETECTOR_CONFIG: DetectorConfig = {
  similarityThreshold: 0.7,
  ambiguousWords: [
    'maybe',
    'possibly',
    'somehow',
    'tbd',
    'fixme',
    'etc.',
    'and so on',
    'somewhat',
    'roughly',
    'i think',
    'not sure',
    'unclear',
  ],
  contradictionPairs: [
    { term: 'must', negation: 'must not' },
    { term: 'must', negation: 'should not' },
    { term: 'should', negation: 'should not' },
    { term: 'will', negation: 'will not' },
    { term: 'can', negation: 'cannot' },
    { term: 'implement', negation: 'do not implement' },
    { term: 'implement', negation: 'not be implemented' },
    { term: 'include', negation: 'exclude' },
    { term: 'enable', negation: 'disable' },
    { term: 'required', negation: 'optional' },
    { term: 'always', negation: 'never' },
  ],
  requiredFields: ['summary', 'description', 'assignee', 'priority', 'labels'],
} as const;

const SEVERITY_ORDER: Record<Severity, number> = {
  critical: 0,
  warning: 1,
  info: 2,
} as const;

// ═══════════════════════════════════════════
// INTERNAL HELPERS
// ═══════════════════════════════════════════

/** [ARCH-SOLID-0941] Generate deterministic unique ID. O(1). */
const generateInconsistencyId = (
  ticketKey: string,
  type: InconsistencyType,
  detectorName: string,
  index: number,
): string => {
  const raw = `${ticketKey}:${detectorName}:${type}:${index}`;
  const numericHash = raw
    .split('')
    .reduce((acc, char) => ((acc << 5) - acc + char.charCodeAt(0)) | 0, 0);
  const hex = Math.abs(numericHash).toString(16).padStart(8, '0').substring(0, 8);
  return `inc-${detectorName}-${index}-${hex}`;
};

/** Check if a string has meaningful content. O(1). */
const hasContent = (value: string | undefined): boolean => {
  return typeof value === 'string' && value.trim().length > 0;
};

/** Normalize text for comparison. O(n). */
const normalizeText = (text: string): string => text.toLowerCase().replace(/\s+/g, ' ').trim();

/** Build set of character trigrams from normalized text. O(n). */
const buildTrigrams = (text: string): Set<string> => {
  const trigrams = new Set<string>();
  for (let i = 0; i <= text.length - 3; i++) {
    trigrams.add(text.substring(i, i + 3));
  }
  return trigrams;
};

/** Count shared elements between two sets. O(min(a,b)). */
const countIntersection = (a: Set<string>, b: Set<string>): number => {
  const [smaller, larger] = a.size <= b.size ? [a, b] : [b, a];
  let count = 0;
  for (const item of smaller) {
    if (larger.has(item)) count++;
  }
  return count;
};

/**
 * [ARCH-SOLID-0941] Calculate Jaccard-like trigram similarity between two strings.
 * O(n) where n = length of the longer string.
 * [ROVO-INTEG-0943] Empirically calibrated threshold of >70%.
 */
const calculateStringSimilarity = (a: string, b: string): number => {
  const normA = normalizeText(a);
  const normB = normalizeText(b);

  if (normA === normB) return 1;
  if (normA.length === 0 || normB.length === 0) return 0;

  const trigramsA = buildTrigrams(normA);
  const trigramsB = buildTrigrams(normB);

  if (trigramsA.size === 0 && trigramsB.size === 0) {
    return normA === normB ? 1 : 0;
  }

  const intersectionCount = countIntersection(trigramsA, trigramsB);
  const unionCount = trigramsA.size + trigramsB.size - intersectionCount;
  return unionCount === 0 ? 0 : intersectionCount / unionCount;
};

// ═══════════════════════════════════════════
// DETECTOR FUNCTIONS (independent pipeline)
// [ARCH-SOLID-0784] Each detector is independent
// ═══════════════════════════════════════════

/**
 * [ARCH-SOLID-0941] Detect contradictions via keyword negation pairs.
 * O(n * m) where n = text length, m = contradiction pairs count.
 */
const detectContradictions = (
  ticket: JiraTicketData,
  context?: RovoContext,
  config: DetectorConfig = DEFAULT_DETECTOR_CONFIG,
): Inconsistency[] => {
  const results: Inconsistency[] = [];
  const combinedText = `${ticket.summary} ${ticket.description}`.toLowerCase();
  let detectorIndex = 0;

  for (const pair of config.contradictionPairs) {
    const termPattern = new RegExp(`\\b${pair.term}\\b`, 'i');
    const negationPattern = new RegExp(`\\b${pair.negation}\\b`, 'i');

    if (termPattern.test(combinedText) && negationPattern.test(combinedText)) {
      results.push({
        id: generateInconsistencyId(ticket.key, 'contradiction', 'ticket', detectorIndex),
        type: 'contradiction',
        severity: 'critical',
        source: 'jira',
        description: `Contradiction detected: "${pair.term}" and "${pair.negation}" both appear in the ticket`,
        affectedTicketKey: ticket.key,
      });
      detectorIndex++;
    }
  }

  if (context?.documents) {
    for (const doc of context.documents) {
      const docContent = doc.content.toLowerCase();
      const ticketLower = ticket.description.toLowerCase();

      for (const pair of config.contradictionPairs) {
        const termInTicket = new RegExp(`\\b${pair.term}\\b`, 'i').test(ticketLower);
        const negationInDoc = new RegExp(`\\b${pair.negation}\\b`, 'i').test(docContent);

        if (termInTicket && negationInDoc) {
          results.push({
            id: generateInconsistencyId(ticket.key, 'contradiction', 'ctx', detectorIndex),
            type: 'contradiction',
            severity: 'critical',
            source: 'confluence',
            description: `Ticket "${pair.term}" contradicts document "${pair.negation}" in: ${doc.title}`,
            affectedTicketKey: ticket.key,
            relatedDocs: [doc.id],
          });
          detectorIndex++;
        }
      }
    }
  }

  return results;
};

/**
 * [ARCH-SOLID-0941] Detect duplicate content via trigram similarity.
 * O(n) where n = text length.
 * [ROVO-INTEG-0943] >70% string similarity threshold.
 */
const detectDuplicates = (
  ticket: JiraTicketData,
  config: DetectorConfig = DEFAULT_DETECTOR_CONFIG,
): Inconsistency[] => {
  const results: Inconsistency[] = [];

  const similarity = calculateStringSimilarity(ticket.summary, ticket.description);

  if (similarity >= config.similarityThreshold && hasContent(ticket.summary)) {
    results.push({
      id: generateInconsistencyId(ticket.key, 'duplicate', 'trigram', 0),
      type: 'duplicate',
      severity: 'warning',
      source: 'jira',
      description: `Summary and description have ${Math.round(similarity * 100)}% similarity — possible duplicate content`,
      affectedTicketKey: ticket.key,
    });
  }

  const sentences = ticket.description
    .split(/[.!?]+/)
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.length > 10);

  const seenSentences = new Map<string, number>();
  for (let i = 0; i < sentences.length; i++) {
    const sentence = sentences[i] as string;
    const existing = seenSentences.get(sentence);
    if (existing !== undefined) {
      results.push({
        id: generateInconsistencyId(ticket.key, 'duplicate', 'sent', results.length + 1),
        type: 'duplicate',
        severity: 'warning',
        source: 'jira',
        description: `Duplicate sentence found in description at positions ${existing + 1} and ${i + 1}`,
        affectedTicketKey: ticket.key,
      });
      break;
    }
    seenSentences.set(sentence, i);
  }

  return results;
};

/**
 * [ARCH-SOLID-0941] Detect missing context fields.
 * O(k) where k = number of required fields.
 * [ARCH-SOLID-049-05] DIP: configuration injected via parameters.
 */
const detectMissingContext = (
  ticket: JiraTicketData,
  config: DetectorConfig = DEFAULT_DETECTOR_CONFIG,
): Inconsistency[] => {
  const results: Inconsistency[] = [];
  let detectorIndex = 0;

  // Check acceptance criteria presence
  const lowerDesc = ticket.description.toLowerCase();
  const hasAcceptanceCriteria =
    lowerDesc.includes('acceptance criteria') ||
    lowerDesc.includes('definition of done') ||
    lowerDesc.includes('do:');

  if (!hasAcceptanceCriteria && ticket.description.trim().length > 0) {
    results.push({
      id: generateInconsistencyId(ticket.key, 'missing_context', 'ac', detectorIndex),
      type: 'missing_context',
      severity: 'warning',
      source: 'jira',
      description: 'Missing acceptance criteria or definition of done in description',
      affectedTicketKey: ticket.key,
    });
    detectorIndex++;
  }

  // Check empty description
  if (!hasContent(ticket.description)) {
    results.push({
      id: generateInconsistencyId(ticket.key, 'missing_context', 'desc', detectorIndex),
      type: 'missing_context',
      severity: 'critical',
      source: 'jira',
      description: 'Description is empty',
      affectedTicketKey: ticket.key,
    });
    detectorIndex++;
  }

  // Check required fields from config
  const fieldCheckers: Record<
    string,
    { check: () => boolean; message: string; severity: Severity }
  > = {
    assignee: {
      check: () => hasContent(ticket.assignee),
      message: 'No assignee specified',
      severity: 'warning',
    },
    priority: {
      check: () => hasContent(ticket.priority),
      message: 'No priority specified',
      severity: 'warning',
    },
    labels: {
      check: () => ticket.labels.length > 0,
      message: 'No labels attached',
      severity: 'info',
    },
  };

  for (const field of config.requiredFields) {
    const checker = fieldCheckers[field];
    if (checker && !checker.check()) {
      results.push({
        id: generateInconsistencyId(ticket.key, 'missing_context', field, detectorIndex),
        type: 'missing_context',
        severity: checker.severity,
        source: 'jira',
        description: checker.message,
        affectedTicketKey: ticket.key,
      });
      detectorIndex++;
    }
  }

  return results;
};

/**
 * [ARCH-SOLID-0941] Detect ambiguous language using predefined word list.
 * O(n * w) where n = text length, w = word list size.
 * [FORGE-OPS-059] Uses Set for O(1) word lookup.
 */
const detectAmbiguity = (
  ticket: JiraTicketData,
  config: DetectorConfig = DEFAULT_DETECTOR_CONFIG,
): Inconsistency[] => {
  const results: Inconsistency[] = [];
  const combinedText = `${ticket.summary} ${ticket.description}`.toLowerCase();
  const wordSet = new Set(config.ambiguousWords);

  for (const word of wordSet) {
    if (combinedText.includes(word)) {
      results.push({
        id: generateInconsistencyId(ticket.key, 'ambiguity', 'lang', results.length),
        type: 'ambiguity',
        severity: 'info',
        source: 'jira',
        description: `Ambiguous language detected: "${word}"`,
        affectedTicketKey: ticket.key,
      });
    }
  }

  return results;
};

// ═══════════════════════════════════════════
// VALIDATION
// ═══════════════════════════════════════════

const validateTicket = (ticket: JiraTicketData): void => {
  if (!hasContent(ticket.key)) {
    throw new InsufficientDataError(
      'Ticket key is required for inconsistency detection',
      'DETECTION_MISSING_KEY',
    );
  }
};

// ═══════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════

/**
 * Scan ticket data against provided context and detect all inconsistencies.
 *
 * AC ref: AC-01, AC-04, AC-07, AC-08, AC-09, AC-10
 * REGLA: [ARCH-SOLID-058] - zero framework dependencies
 * REGLA: [ARCH-SOLID-0784] - independent detector pipeline
 * REGLA: [ARCH-SOLID-0912] - deterministic output
 *
 * Complexity: O(n * m) where n = text length, m = config items [ARCH-SOLID-0941]
 *
 * @param ticket - Jira ticket data to analyze
 * @param context - Optional Rovo context for cross-referencing
 * @param config - Optional detection configuration
 * @returns Sorted array of detected Inconsistency objects (critical first)
 * @throws InsufficientDataError if ticket.key is empty
 */
export const detectInconsistencies = (
  ticket: JiraTicketData,
  context?: RovoContext,
  config: DetectorConfig = DEFAULT_DETECTOR_CONFIG,
): Inconsistency[] => {
  validateTicket(ticket);

  // [ARCH-SOLID-0784] Independent pipeline: each detector runs independently
  const contradictions = detectContradictions(ticket, context, config);
  const duplicates = detectDuplicates(ticket, config);
  const missingContext = detectMissingContext(ticket, config);
  const ambiguities = detectAmbiguity(ticket, config);

  const allInconsistencies = [...contradictions, ...duplicates, ...missingContext, ...ambiguities];

  // Sort by severity: critical first, then warning, then info
  return allInconsistencies.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
};

/**
 * Classify an inconsistency into severity level based on type.
 *
 * AC ref: AC-02
 * REGLA: [ARCH-SOLID-205] - explicit return type
 *
 * Complexity: O(1) [ARCH-SOLID-0941]
 *
 * @param inconsistency - The inconsistency to classify
 * @returns Severity level: critical, warning, or info
 */
export const classifySeverity = (inconsistency: Inconsistency): Severity => {
  const severityMap: Record<InconsistencyType, Severity> = {
    contradiction: 'critical',
    duplicate: 'warning',
    missing_context: 'warning',
    ambiguity: 'info',
  };

  return severityMap[inconsistency.type];
};

/**
 * Produce a human-readable, actionable suggestion for resolving the inconsistency.
 *
 * AC ref: AC-03
 * REGLA: [ARCH-SOLID-205] - explicit return type
 *
 * Complexity: O(1) [ARCH-SOLID-0941]
 *
 * @param inconsistency - The inconsistency to generate a suggestion for
 * @returns Actionable suggestion string
 */
export const generateSuggestion = (inconsistency: Inconsistency): string => {
  const suggestionMap: Record<InconsistencyType, string> = {
    contradiction:
      'Resolve the conflicting statements by clarifying the intended direction. Remove or update the contradictory content to reflect a single, consistent requirement.',
    duplicate:
      'Remove or consolidate the duplicated content. Ensure each concept is expressed once clearly rather than repeated.',
    missing_context:
      'Add the missing information to provide complete context. Include acceptance criteria, assignee, priority, and relevant labels to improve ticket clarity.',
    ambiguity:
      'Clarify the ambiguous language by replacing vague terms with specific, measurable requirements. Use concrete language that leaves no room for interpretation.',
  };

  return suggestionMap[inconsistency.type];
};
