// [ARCH-SOLID-058] SERVICE layer — JIT context assembly, zero framework dependencies
// [ARCH-SOLID-006] Handler -> Service -> Repository (this is the Service)
// [ARCH-SOLID-202] Zero any usage
// [ARCH-SOLID-232] Named exports only, no export default
// [FORGE-OPS-0105] Stateless functions, no module-level mutable state
// RTASK-041 Step 9.1b: Context Builder — 4 exported functions

import type {
  EntityNeighborhood,
  RelationshipContext,
  ContextBudget,
  DecisionRecord,
} from '../../types/relationship-index';

// ═══════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════

/** A causal path extracted from the graph — the unit of context. */
export interface CausalPath {
  readonly steps: readonly string[];
  readonly signalScore: number;
  readonly pathType: 'contradiction' | 'alignment' | 'gap' | 'drift' | 'neutral';
  readonly summary: string;
}

/** Result of context building with positional optimization. */
export interface BuiltContext {
  readonly paths: readonly CausalPath[];
  readonly factsAtStart: readonly string[];
  readonly evidenceInMiddle: readonly string[];
  readonly questionAtEnd: readonly string[];
  readonly totalTokens: number;
  readonly budget: ContextBudget;
}

// ═══════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════

/** [FORGE-OPS-013] Max paths extracted to keep context under 4KB equivalent */
const MAX_PATHS = 20;

/** Drift threshold: docs older than 30 days are stale */
const DRIFT_THRESHOLD_DAYS = 30;

/** Milliseconds per day */
const DAY_MS = 86_400_000;

/** Signal weights per path type — higher = more important for scoring */
const SIGNAL_WEIGHTS = {
  contradiction: 0.9,
  alignment: 0.85,
  drift: 0.7,
  gap: 0.65,
  neutral: 0.3,
} as const;

/** Default context budget [FORGE-OPS-013] */
export const DEFAULT_BUDGET: ContextBudget = {
  maxTokens: 2500,
  reserveForPrompt: 500,
};

// ═══════════════════════════════════════════
// PRIVATE HELPERS
// ═══════════════════════════════════════════

/** Extract sibling contradiction paths from context. */
function extractSiblingPaths(
  primaryId: string,
  siblings: readonly import('../../types/relationship-index').EntityNode[],
): readonly CausalPath[] {
  return siblings.map((sibling) => ({
    steps: [primaryId, 'sibling-of', sibling.id],
    signalScore: SIGNAL_WEIGHTS.contradiction,
    pathType: 'contradiction' as const,
    summary: `Sibling ${sibling.label} in same epic (${sibling.status})`,
  }));
}

/** Extract PR alignment/neutral paths from context. */
function extractPRPaths(
  primaryId: string,
  pullRequests: readonly import('../../types/relationship-index').EntityNode[],
): readonly CausalPath[] {
  return pullRequests.map((pr) => {
    const isAlignment = pr.status === 'merged' || pr.status === 'closed';
    return {
      steps: [primaryId, 'implements', pr.id],
      signalScore: isAlignment ? SIGNAL_WEIGHTS.alignment : SIGNAL_WEIGHTS.neutral,
      pathType: (isAlignment ? 'alignment' : 'neutral') as CausalPath['pathType'],
      summary: `PR ${pr.label} (${pr.status}) implements this ticket`,
    };
  });
}

/** Extract documentation drift/alignment paths from context. */
function extractDocPaths(
  primaryId: string,
  documentation: readonly import('../../types/relationship-index').EntityNode[],
  referenceDate: string,
): readonly CausalPath[] {
  const nowMs = new Date(referenceDate).getTime();
  return documentation.map((doc) => {
    const daysSinceUpdate = (nowMs - new Date(doc.updatedAt).getTime()) / DAY_MS;
    const isDrift = daysSinceUpdate > DRIFT_THRESHOLD_DAYS;
    return {
      steps: [primaryId, 'documented-by', doc.id],
      signalScore: isDrift ? SIGNAL_WEIGHTS.drift : SIGNAL_WEIGHTS.alignment,
      pathType: (isDrift ? 'drift' : 'alignment') as CausalPath['pathType'],
      summary: isDrift
        ? `Doc "${doc.label}" is ${Math.round(daysSinceUpdate)}d old (stale)`
        : `Doc "${doc.label}" is up to date`,
    };
  });
}

/** Check if a doc matches any keyword from a topic. */
function docMatchesTopic(
  doc: import('../../types/relationship-index').EntityNode,
  keywords: readonly string[],
): boolean {
  const lowerLabel = doc.label.toLowerCase();
  return keywords.some(
    (kw) =>
      lowerLabel.includes(kw.toLowerCase()) ||
      Object.values(doc.metadata).some((v) => v.toLowerCase().includes(kw.toLowerCase())),
  );
}

/** Extract topic gap paths — topics with no matching documentation. */
function extractTopicGapPaths(
  primaryId: string,
  topics: readonly import('../../types/relationship-index').TopicCluster[],
  documentation: readonly import('../../types/relationship-index').EntityNode[],
): readonly CausalPath[] {
  const result: CausalPath[] = [];
  for (const topic of topics) {
    const hasDocs = documentation.some((doc) => docMatchesTopic(doc, topic.keywords));
    if (!hasDocs) {
      result.push({
        steps: [primaryId, 'topic-match', topic.id],
        signalScore: SIGNAL_WEIGHTS.gap,
        pathType: 'gap',
        summary: `Topic "${topic.label}" has no documentation`,
      });
    }
  }
  return result;
}

/** Extract cross-reference paths scaled by confidence. */
function extractXrefPaths(
  crossReferences: readonly import('../../types/relationship-index').CrossReference[],
): readonly CausalPath[] {
  return crossReferences.map((xref) => ({
    steps: [xref.source, xref.referenceType, xref.target],
    signalScore: SIGNAL_WEIGHTS.neutral * xref.confidence,
    pathType: 'neutral' as const,
    summary: `${xref.sourceTool} → ${xref.targetTool} reference (${xref.referenceType})`,
  }));
}

// ═══════════════════════════════════════════
// PUBLIC FUNCTIONS
// ═══════════════════════════════════════════

/**
 * Estimate token count for a string.
 * Rough approximation: 1 token ≈ 4 chars.
 *
 * AC ref: AC-04 of .reqs.md
 * Complexity: O(1)
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Extract causal paths from the relationship graph.
 * Produces typed paths with signal scores for ranking.
 *
 * AC ref: AC-01, AC-06, AC-07, AC-08, AC-09 of .reqs.md
 * Complexity: O(s + p + d + t·d + x) where s=siblings, p=PRs, d=docs, t=topics, x=xrefs
 *
 * [ARCH-SOLID-0912] Pure function — deterministic output for given inputs.
 */
export function extractCausalPaths(
  neighborhood: EntityNeighborhood,
  context: RelationshipContext,
): readonly CausalPath[] {
  const primaryId = neighborhood.entityId;

  const paths: readonly CausalPath[] = [
    ...extractSiblingPaths(primaryId, context.siblings),
    ...extractPRPaths(primaryId, context.pullRequests),
    ...extractDocPaths(primaryId, context.documentation, context.assembledAt),
    ...extractTopicGapPaths(primaryId, context.topics, context.documentation),
    ...extractXrefPaths(context.crossReferences),
  ];

  // [FORGE-OPS-013] Cap at MAX_PATHS to keep context under budget
  return paths.slice(0, MAX_PATHS);
}

/**
 * Rank paths by signal strength and prune to token budget.
 * Sorts descending by signalScore, then trims to fit within budget.
 *
 * AC ref: AC-02, AC-05 of .reqs.md
 * Complexity: O(n log n) for sort + O(n) for prune = O(n log n)
 *
 * [ARCH-SOLID-0912] Pure function.
 */
export function rankPaths(
  paths: readonly CausalPath[],
  budget: ContextBudget,
): readonly CausalPath[] {
  const sorted = [...paths].sort((a, b) => b.signalScore - a.signalScore);

  const result: CausalPath[] = [];
  let tokenCount = 0;
  const maxTokens = budget.maxTokens - budget.reserveForPrompt;

  for (const path of sorted) {
    const pathTokens = estimateTokens(path.summary);
    if (tokenCount + pathTokens > maxTokens) {
      break;
    }
    tokenCount += pathTokens;
    result.push(path);
  }

  return result;
}

/**
 * Assemble context with positional optimization.
 * Facts at START, evidence in MIDDLE, questions at END.
 * Counteracts "lost in the middle" LLM attention patterns.
 *
 * AC ref: AC-03, AC-10 of .reqs.md
 * Complexity: O(p + d) where p=paths, d=decisions
 *
 * [ARCH-SOLID-0912] Pure function.
 */
export function assembleContext(
  rankedPaths: readonly CausalPath[],
  primaryEntity: { readonly key: string; readonly summary: string; readonly status: string },
  recentDecisions: readonly DecisionRecord[],
  budget: ContextBudget,
): BuiltContext {
  const factsAtStart: string[] = [];
  const evidenceInMiddle: string[] = [];
  const questionAtEnd: string[] = [];

  for (const path of rankedPaths) {
    if (path.signalScore >= 0.7) {
      factsAtStart.push(path.summary);
    } else {
      evidenceInMiddle.push(path.summary);
    }
  }

  // Primary entity context → END position
  questionAtEnd.push(
    `Evaluating: ${primaryEntity.key} — ${primaryEntity.summary} (${primaryEntity.status})`,
  );

  // Overridden decisions → END position (learn from past enforcement)
  const overridden = recentDecisions.filter((d) => d.overridden);
  if (overridden.length > 0) {
    questionAtEnd.push(
      `Past ${overridden.length} overridden decision(s) for similar context — consider softening`,
    );
  }

  const allText = [...factsAtStart, ...evidenceInMiddle, ...questionAtEnd].join('\n');

  return {
    paths: rankedPaths,
    factsAtStart,
    evidenceInMiddle,
    questionAtEnd,
    totalTokens: estimateTokens(allText),
    budget,
  };
}
