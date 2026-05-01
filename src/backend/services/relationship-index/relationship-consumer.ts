// [ARCH-SOLID-058] SERVICE layer — relationship signal extraction, zero framework dependencies
// [ARCH-SOLID-006] Handler -> Service -> Repository (this is the Service)
// [ARCH-SOLID-202] Zero any usage
// [ARCH-SOLID-232] Named exports only, no export default
// [FORGE-OPS-0105] Stateless functions, no module-level mutable state
// RTASK-041 Step 9.2: Relationship Consumer — 7 exported functions

import type {
  RelationshipContext,
  EntityNode,
  CrossReference,
} from '../../types/relationship-index';

import type { Inconsistency, Severity, InconsistencySource } from '../../types/inconsistency';

// ═══════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════

/** Signal result with bonus/penalty and human-readable explanations. */
export interface SignalResult {
  readonly bonus: number;
  readonly penalty: number;
  readonly signals: readonly string[];
}

/** Contradiction term pair for sibling comparison. */
interface ContradictionPair {
  readonly term: string;
  readonly negation: string;
}

// ═══════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════

/** [ARCH-SOLID-0941] Contradiction pairs for sibling comparison — subset of inconsistency-detector pairs */
const CONTRADICTION_PAIRS: readonly ContradictionPair[] = [
  { term: 'must', negation: 'must not' },
  { term: 'must', negation: 'should not' },
  { term: 'should', negation: 'should not' },
  { term: 'will', negation: 'will not' },
  { term: 'can', negation: 'cannot' },
  { term: 'implement', negation: 'do not implement' },
  { term: 'include', negation: 'exclude' },
  { term: 'enable', negation: 'disable' },
  { term: 'required', negation: 'optional' },
  { term: 'always', negation: 'never' },
] as const;

/** Spec drift thresholds in days */
const DRIFT_WARNING_DAYS = 30;
const DRIFT_CRITICAL_DAYS = 90;

/** Milliseconds per day */
const DAY_MS = 86_400_000;

/** File count threshold for scope mismatch */
const FILE_COUNT_THRESHOLD = 20;

/** Signal caps — bonus/penalty limits */
const DOC_BONUS_CAP = 20;
const DOC_PENALTY_CAP = 15;
const CONSISTENCY_BONUS_CAP = 15;
const CONSISTENCY_PENALTY_CAP = 20;

/** Per-item signal weights */
const DOC_FRESH_BONUS = 10;
const DOC_STALE_PENALTY = 8;
const SIBLING_ALIGN_BONUS = 5;
const SIBLING_CONTRADICT_PENALTY = 7;

// ═══════════════════════════════════════════
// PRIVATE HELPERS
// ═══════════════════════════════════════════

/** Build an Inconsistency object with deterministic ID. [ARCH-SOLID-006] [ARCH-SOLID-0912] */
function makeInconsistency(
  type: Inconsistency['type'],
  severity: Severity,
  description: string,
  ticketKey: string,
  relatedDocs?: readonly string[],
  suggestion?: string,
): Inconsistency {
  // Deterministic ID based on inputs — same inputs always produce same ID
  const contentHash = `${type}:${ticketKey}:${description}`
    .split('')
    .reduce((h, c) => ((h << 5) - h + c.charCodeAt(0)) | 0, 0);
  const id = `rel-${type}-${ticketKey}-${(contentHash >>> 0).toString(36)}`;

  return {
    id,
    type,
    severity,
    source: 'rovo' as InconsistencySource,
    description,
    affectedTicketKey: ticketKey,
    ...(relatedDocs ? { relatedDocs } : {}),
    ...(suggestion ? { suggestion } : {}),
  };
}

/** Check if textA contradicts textB using term/negation pairs. */
function hasContradiction(textA: string, textB: string): boolean {
  const aLower = textA.toLowerCase();
  const bLower = textB.toLowerCase();

  return CONTRADICTION_PAIRS.some((pair) => {
    const termInA = aLower.includes(pair.term);
    const negationInB = bLower.includes(pair.negation);
    const termInB = bLower.includes(pair.term);
    const negationInA = aLower.includes(pair.negation);

    return (termInA && negationInB) || (termInB && negationInA);
  });
}

/** Parse fileCount from PR metadata, returning 0 if missing. */
function parseFileCount(metadata: Readonly<Record<string, string>>): number {
  const raw = metadata['fileCount'];
  if (raw === undefined) return 0;
  const parsed = parseInt(raw, 10);
  return Number.isNaN(parsed) ? 0 : parsed;
}

/** Check if PR metadata indicates it's linked to the ticket. */
function isLinkedToTicket(metadata: Readonly<Record<string, string>>, ticketKey: string): boolean {
  const linked = metadata['linkedIssues'];
  if (linked === undefined) return false;
  return linked.includes(ticketKey);
}

// ═══════════════════════════════════════════
// PUBLIC FUNCTIONS — Detection
// ═══════════════════════════════════════════

/**
 * Detect contradictions between a ticket and its siblings in the same epic.
 * Compares ticket summary+description against each sibling's label.
 *
 * AC ref: AC-01 of .reqs.md
 * Complexity: O(s × p) where s=siblings, p=contradiction pairs
 * [ARCH-SOLID-0912] Pure function — deterministic.
 */
export function detectSiblingContradictions(
  ticketSummary: string,
  ticketDescription: string,
  siblings: readonly EntityNode[],
  ticketKey: string,
): readonly Inconsistency[] {
  const ticketText = `${ticketSummary} ${ticketDescription}`;
  const contradictingSiblings: EntityNode[] = [];

  for (const sibling of siblings) {
    if (hasContradiction(ticketText, sibling.label)) {
      contradictingSiblings.push(sibling);
    }
  }

  if (contradictingSiblings.length === 0) {
    return [];
  }

  const severity: Severity = contradictingSiblings.length >= 3 ? 'critical' : 'warning';
  const siblingKeys = contradictingSiblings.map((s) => s.id.split(':')[1] ?? s.id).join(', ');

  return [
    makeInconsistency(
      'sibling_contradiction',
      severity,
      `${contradictingSiblings.length} sibling(s) contradict this ticket: ${siblingKeys}`,
      ticketKey,
      contradictingSiblings.map((s) => s.id),
      severity === 'critical'
        ? 'Multiple siblings contradict — review epic alignment before proceeding'
        : 'Sibling contradicts this ticket — verify requirements are consistent',
    ),
  ];
}

/**
 * Detect documentation staleness by comparing update timestamps.
 * Warning at >30 days, critical at >90 days.
 *
 * AC ref: AC-02 of .reqs.md
 * Complexity: O(d) where d=documentation nodes
 * [ARCH-SOLID-0912] Pure function — deterministic.
 */
export function detectSpecDrift(
  documentation: readonly EntityNode[],
  ticketUpdatedAt: string,
  ticketKey: string,
): readonly Inconsistency[] {
  const ticketMs = new Date(ticketUpdatedAt).getTime();
  const results: Inconsistency[] = [];

  for (const doc of documentation) {
    const docMs = new Date(doc.updatedAt).getTime();
    const daysDiff = (ticketMs - docMs) / DAY_MS;

    if (daysDiff > DRIFT_CRITICAL_DAYS) {
      results.push(
        makeInconsistency(
          'spec_drift',
          'critical',
          `Documentation "${doc.label}" is ${Math.round(daysDiff)} days older than ticket — severely stale`,
          ticketKey,
          [doc.id],
          'Update documentation to reflect recent ticket changes',
        ),
      );
    } else if (daysDiff > DRIFT_WARNING_DAYS) {
      results.push(
        makeInconsistency(
          'spec_drift',
          'warning',
          `Documentation "${doc.label}" is ${Math.round(daysDiff)} days older than ticket — possibly stale`,
          ticketKey,
          [doc.id],
          'Review documentation for recent changes',
        ),
      );
    }
  }

  return results;
}

/**
 * Detect PR scope issues — unlinked PRs or excessive file changes.
 *
 * AC ref: AC-03 of .reqs.md
 * Complexity: O(p) where p=pull requests
 * [ARCH-SOLID-0912] Pure function — deterministic.
 */
export function detectScopeMismatch(
  pullRequests: readonly EntityNode[],
  ticketKey: string,
  ticketSummary: string,
): readonly Inconsistency[] {
  const results: Inconsistency[] = [];

  for (const pr of pullRequests) {
    const fileCount = parseFileCount(pr.metadata);
    const isLinked = isLinkedToTicket(pr.metadata, ticketKey);

    if (!isLinked && fileCount > 0) {
      results.push(
        makeInconsistency(
          'scope_mismatch',
          'warning',
          `PR "${pr.label}" is not linked to ${ticketKey} — possible scope creep`,
          ticketKey,
          [pr.id],
          'Verify PR is related to this ticket',
        ),
      );
    }

    if (fileCount > FILE_COUNT_THRESHOLD) {
      results.push(
        makeInconsistency(
          'scope_mismatch',
          'info',
          `PR "${pr.label}" touches ${fileCount} files — exceeds threshold (${FILE_COUNT_THRESHOLD})`,
          ticketKey,
          [pr.id],
          `Review if all ${fileCount} files are needed for "${ticketSummary}"`,
        ),
      );
    }
  }

  return results;
}

/**
 * Detect orphan references — low-confidence cross-references or references to missing entities.
 *
 * AC ref: AC-04 of .reqs.md
 * Complexity: O(x) where x=cross references
 * [ARCH-SOLID-0912] Pure function — deterministic.
 */
export function detectOrphanReferences(
  crossReferences: readonly CrossReference[],
  ticketKey: string,
): readonly Inconsistency[] {
  const results: Inconsistency[] = [];

  for (const xref of crossReferences) {
    if (xref.confidence < 0.3) {
      results.push(
        makeInconsistency(
          'orphan_reference',
          'info',
          `Cross-reference from ${xref.source} to ${xref.target} has low confidence (${(xref.confidence * 100).toFixed(0)}%) — possibly noise`,
          ticketKey,
          [xref.source, xref.target],
        ),
      );
    } else if (
      xref.referenceType === 'mention' &&
      xref.confidence >= 0.5 &&
      xref.confidence < 0.7
    ) {
      results.push(
        makeInconsistency(
          'orphan_reference',
          'warning',
          `Cross-reference from ${xref.source} to ${xref.target} is a mention with moderate confidence — verify link exists`,
          ticketKey,
          [xref.source, xref.target],
          'Manually verify the cross-reference is valid',
        ),
      );
    }
  }

  return results;
}

/**
 * Run all relationship-aware detectors and aggregate results.
 *
 * AC ref: AC-05 of .reqs.md
 * Complexity: O(s×p + d + pr + x) — sum of individual detector complexities
 * [ARCH-SOLID-0912] Pure function — deterministic.
 */
export function detectRelationshipInconsistencies(
  context: RelationshipContext,
  ticketSummary: string,
  ticketDescription: string,
  ticketUpdatedAt: string,
  ticketKey: string,
): readonly Inconsistency[] {
  const results: Inconsistency[] = [
    ...detectSiblingContradictions(ticketSummary, ticketDescription, context.siblings, ticketKey),
    ...detectSpecDrift(context.documentation, ticketUpdatedAt, ticketKey),
    ...detectScopeMismatch(context.pullRequests, ticketKey, ticketSummary),
    ...detectOrphanReferences(context.crossReferences, ticketKey),
  ];

  return results;
}

// ═══════════════════════════════════════════
// PUBLIC FUNCTIONS — Signals
// ═══════════════════════════════════════════

/**
 * Calculate documentation score adjustment from relationship context.
 * Bonus for fresh docs (up to +20), penalty for stale/missing (up to -15).
 *
 * AC ref: AC-06 of .reqs.md
 * Complexity: O(d) where d=documentation nodes
 * [ARCH-SOLID-0912] Pure function — deterministic.
 */
export function calculateDocumentationSignal(context: RelationshipContext): SignalResult {
  const signals: string[] = [];
  let bonus = 0;
  let penalty = 0;

  const nowMs = new Date(context.assembledAt).getTime();

  if (context.documentation.length === 0) {
    return { bonus: 0, penalty: 0, signals: [] };
  }

  for (const doc of context.documentation) {
    const daysSinceUpdate = (nowMs - new Date(doc.updatedAt).getTime()) / DAY_MS;

    if (daysSinceUpdate <= DRIFT_WARNING_DAYS) {
      bonus = Math.min(bonus + DOC_FRESH_BONUS, DOC_BONUS_CAP);
      signals.push(`Fresh documentation: "${doc.label}" (${Math.round(daysSinceUpdate)}d old)`);
    } else {
      penalty = Math.max(penalty - DOC_STALE_PENALTY, -DOC_PENALTY_CAP);
      signals.push(`Stale documentation: "${doc.label}" (${Math.round(daysSinceUpdate)}d old)`);
    }
  }

  return { bonus, penalty, signals };
}

/**
 * Calculate consistency score adjustment from sibling alignment.
 * Bonus for aligned siblings (up to +15), penalty for contradictions (up to -20).
 *
 * AC ref: AC-07 of .reqs.md
 * Complexity: O(s × p) where s=siblings, p=contradiction pairs
 * [ARCH-SOLID-0912] Pure function — deterministic.
 */
export function calculateConsistencySignal(
  context: RelationshipContext,
  ticketSummary?: string,
): SignalResult {
  const signals: string[] = [];
  let bonus = 0;
  let penalty = 0;

  if (context.siblings.length === 0) {
    return { bonus: 0, penalty: 0, signals: [] };
  }

  const ticketText = ticketSummary ?? '';

  for (const sibling of context.siblings) {
    if (ticketText && hasContradiction(ticketText, sibling.label)) {
      penalty = Math.max(penalty - SIBLING_CONTRADICT_PENALTY, -CONSISTENCY_PENALTY_CAP);
      signals.push(`Sibling contradicts: ${sibling.label}`);
    } else {
      bonus = Math.min(bonus + SIBLING_ALIGN_BONUS, CONSISTENCY_BONUS_CAP);
      signals.push(`Sibling aligned: ${sibling.label}`);
    }
  }

  return { bonus, penalty, signals };
}
