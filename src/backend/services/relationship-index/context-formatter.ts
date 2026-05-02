// [ARCH-SOLID-058] SERVICE layer — LLM-friendly context formatting, zero framework dependencies
// [ARCH-SOLID-006] Handler -> Service -> Repository (this is the Service)
// [ARCH-SOLID-202] Zero any usage
// [ARCH-SOLID-232] Named exports only, no export default
// [FORGE-OPS-0105] Stateless functions, no module-level mutable state
// RTASK-043 Step 10.1: Context Formatter — 9 exported functions

import type {
  RelationshipContext,
  EntityNode,
  TopicCluster,
  CrossReference,
  DecisionRecord,
  ContextBudget,
} from '../../types/relationship-index';
import type { CausalPath } from './context-builder.js';

// ═══════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════

/** Token estimation: 1 token ≈ 4 chars (matches context-builder.estimateTokens). */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

const DEFAULT_MAX_TOKENS = 2000;
const EVOLVING_PROMPT_MAX_TOKENS = 200;

// ═══════════════════════════════════════════
// PRIVATE HELPERS
// ═══════════════════════════════════════════

/** [ARCH-SOLID-052] Truncate text to fit within token budget. */
function truncateToBudget(text: string, maxTokens: number): string {
  if (estimateTokens(text) <= maxTokens) {
    return text;
  }
  const maxChars = maxTokens * 4;
  const truncated = text.slice(0, maxChars);
  const lastNewline = truncated.lastIndexOf('\n');
  return lastNewline > 0 ? truncated.slice(0, lastNewline) : truncated;
}

/** [ARCH-SOLID-052] Format a single entity node as a bullet. */
function formatSiblingNode(node: EntityNode): string {
  return `- ${node.label} (${node.status})`;
}

/** [ARCH-SOLID-052] Format a documentation node with metadata. */
function formatDocNode(node: EntityNode): string {
  const relevance = node.metadata['relevance'] ?? 'unknown';
  const pageType = node.metadata['pageType'] ?? 'unknown';
  const date = node.updatedAt.slice(0, 10);
  return `- "${node.label}" (updated ${date}, relevance: ${relevance}) — ${pageType}`;
}

/** [ARCH-SOLID-052] Format a PR node with metadata. */
function formatPrNode(node: EntityNode): string {
  const files = node.metadata['files'] ?? '0';
  const repo = node.metadata['repo'] ?? 'unknown';
  const number = node.metadata['number'] ?? '?';
  return `- PR #${number}: "${node.label}" (${node.status}, ${files} files, ${repo})`;
}

/** [ARCH-SOLID-052] Format a topic cluster. */
function formatTopicNode(topic: TopicCluster): string {
  return `- ${topic.label} (strength: ${topic.strength.toFixed(2)}, ${topic.entityIds.length} entities)`;
}

/** [ARCH-SOLID-052] Format a cross-reference. */
function formatXrefNode(ref: CrossReference): string {
  return `- ${ref.sourceTool}:${ref.source} → ${ref.targetTool}:${ref.target} (${ref.referenceType}, confidence: ${ref.confidence.toFixed(2)})`;
}

/** [ARCH-SOLID-052] Build section from formatted text with header. */
function addSection(sections: string[], header: string, content: string): void {
  if (content) sections.push(`${header}\n${content}`);
}

/** [ARCH-SOLID-052] Collect formatted sections from context. */
function collectSections(context: RelationshipContext): {
  sibs: string;
  docs: string;
  prs: string;
  topics: string;
  refs: string;
} {
  return {
    sibs: formatSiblings(context.siblings),
    docs: formatDocumentation(context.documentation),
    prs: formatPullRequests(context.pullRequests),
    topics: formatTopics(context.topics),
    refs: formatCrossReferences(context.crossReferences),
  };
}

/** [ARCH-SOLID-052] Select context sections relevant to an action. */
function actionSpecificSections(actionKey: string, context: RelationshipContext): string {
  const s = collectSections(context);
  const sections: string[] = [];

  if (actionKey === 'evaluate-issue') {
    addSection(sections, '### Epic & Siblings', s.sibs);
    addSection(sections, '### Documentation', s.docs);
    addSection(sections, '### Topic Clusters', s.topics);
    return sections.join('\n\n');
  }

  if (actionKey === 'check-pr-consistency') {
    addSection(sections, '### Pull Requests', s.prs);
    addSection(sections, '### Topic Clusters', s.topics);
    return sections.join('\n\n');
  }

  if (actionKey === 'validate-spec-alignment') {
    addSection(sections, '### Documentation', s.docs);
    addSection(sections, '### Cross-References', s.refs);
    return sections.join('\n\n');
  }

  return formatRelationshipContext(context);
}

// ═══════════════════════════════════════════
// PUBLIC FUNCTIONS — Section Formatters
// ═══════════════════════════════════════════

/** Format sibling tickets as a bullet list. AC-01. */
export function formatSiblings(siblings: readonly EntityNode[]): string {
  if (siblings.length === 0) return '';
  return siblings.map(formatSiblingNode).join('\n');
}

/** Format Confluence documentation with relevance and type. AC-01. */
export function formatDocumentation(docs: readonly EntityNode[]): string {
  if (docs.length === 0) return '';
  return docs.map(formatDocNode).join('\n');
}

/** Format PR associations with files and repo. AC-01. */
export function formatPullRequests(prs: readonly EntityNode[]): string {
  if (prs.length === 0) return '';
  return prs.map(formatPrNode).join('\n');
}

/** Format topic clusters with strength and entity count. AC-01. */
export function formatTopics(topics: readonly TopicCluster[]): string {
  if (topics.length === 0) return '';
  return topics.map(formatTopicNode).join('\n');
}

/** Format cross-references with source→target and confidence. AC-01. */
export function formatCrossReferences(refs: readonly CrossReference[]): string {
  if (refs.length === 0) return '';
  return refs.map(formatXrefNode).join('\n');
}

/** Format the full relationship context as markdown sections. AC-01, AC-02. */
export function formatRelationshipContext(context: RelationshipContext): string {
  const sections: string[] = [];
  const sibs = formatSiblings(context.siblings);
  const docs = formatDocumentation(context.documentation);
  const prs = formatPullRequests(context.pullRequests);
  const topics = formatTopics(context.topics);
  const refs = formatCrossReferences(context.crossReferences);

  if (sibs) sections.push('### Epic & Siblings\n' + sibs);
  if (docs) sections.push('### Documentation\n' + docs);
  if (prs) sections.push('### Pull Requests\n' + prs);
  if (topics) sections.push('### Topic Clusters\n' + topics);
  if (refs) sections.push('### Cross-References\n' + refs);

  if (sections.length === 0) return '';
  return '## Relationship Context\n\n' + sections.join('\n\n');
}

// ═══════════════════════════════════════════
// PUBLIC FUNCTIONS — Composite Builders
// ═══════════════════════════════════════════

/** Build action-specific context with token budget. AC-03, AC-14. */
export function buildActionContext(
  actionKey: string,
  context: RelationshipContext,
  budget?: ContextBudget,
): string {
  const maxTokens = budget ? budget.maxTokens - budget.reserveForPrompt : DEFAULT_MAX_TOKENS;
  const raw = actionSpecificSections(actionKey, context);
  if (!raw) return '';
  return truncateToBudget(raw, maxTokens);
}

/** Build PathRAG-style context with positional optimization. AC-12, AC-14, AC-15. */
export function buildPathContext(
  paths: readonly CausalPath[],
  facts: readonly string[],
  decisions: readonly DecisionRecord[],
  budget: ContextBudget,
): string {
  const maxTokens = budget.maxTokens - budget.reserveForPrompt;
  const parts: string[] = [];

  // START: high-signal facts [ARCH-SOLID-0912]
  if (facts.length > 0) {
    parts.push('## Key Facts\n' + facts.map((f) => `- ${f}`).join('\n'));
  }

  // MIDDLE: causal paths sorted by signal
  const sorted = [...paths].sort((a, b) => b.signalScore - a.signalScore);
  if (sorted.length > 0) {
    const pathLines = sorted.map((p) => `- [${p.pathType}] ${p.summary}`).join('\n');
    parts.push('## Evidence Paths\n' + pathLines);
  }

  // END: recent decisions [ARCH-SOLID-0912] lost-in-the-middle optimization
  if (decisions.length > 0) {
    const decisionLines = decisions
      .slice(0, 5)
      .map(
        (d) => `- ${d.issueKey}: ${d.action}${d.overridden ? ' (overridden)' : ''} [${d.gateType}]`,
      )
      .join('\n');
    parts.push('## Recent Decisions\n' + decisionLines);
  }

  if (parts.length === 0) return '';
  return truncateToBudget(parts.join('\n\n'), maxTokens);
}

/** Generate adaptive prompt snippet from override patterns. AC-13. */
export function buildEvolvingPrompt(
  overridePatterns: readonly {
    readonly contextSignature: string;
    readonly overrideRate: number;
  }[],
): string {
  if (overridePatterns.length === 0) return '';

  const lines: string[] = ['## Adaptive Guidance'];

  for (const pattern of overridePatterns) {
    if (pattern.overrideRate > 0.5) {
      lines.push(
        `- Context "${pattern.contextSignature}": high override rate (${(pattern.overrideRate * 100).toFixed(0)}%) — consider softening enforcement`,
      );
    } else if (pattern.overrideRate < 0.1) {
      lines.push(
        `- Context "${pattern.contextSignature}": low override rate (${(pattern.overrideRate * 100).toFixed(0)}%) — enforcement is well-calibrated`,
      );
    }
  }

  if (lines.length === 1) return '';
  const result = lines.join('\n');
  return truncateToBudget(result, EVOLVING_PROMPT_MAX_TOKENS);
}
