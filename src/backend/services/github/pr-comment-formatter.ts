// [ARCH-SOLID-058] PR comment formatter — zero external dependencies
// [ARCH-SOLID-203] Interfaces with readonly properties
// [ARCH-SOLID-232] Named exports only, no export default
// [ARCH-SOLID-069] Pure function composition, no shared mutable state
// [ARCH-SOLID-061] Bounded context: PR Enforcement (GitHub-side)
// [SEC-PRIV-002] No sensitive data in comments
// [SEC-PRIV-051] All external input validated and sanitized
// [GH-INTEG-305] Status checks use context rovo-execution-guard/consistency

import type { EvaluationPipelineResult } from '../evaluation/evaluation-pipeline';
import type { RovoContext } from '../../types/rovo-context';
import type { ConsistencyScore } from '../../types/consistency-score';
import type { Inconsistency, Severity } from '../../types/inconsistency';

// ═══════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════

/** [ARCH-SOLID-203] Configuration for comment template rendering */
export interface CommentTemplateConfig {
  readonly headerText?: string;
  readonly footerText?: string;
  readonly showScoreBreakdown: boolean;
  readonly showSuggestions: boolean;
  readonly showRelatedTickets: boolean;
  readonly showDocumentationLinks: boolean;
  readonly showQuickActions: boolean;
}

/** [ARCH-SOLID-203] Default template configuration */
const DEFAULT_CONFIG: CommentTemplateConfig = {
  showScoreBreakdown: true,
  showSuggestions: true,
  showRelatedTickets: true,
  showDocumentationLinks: true,
  showQuickActions: true,
};

// ═══════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════

const MAX_INPUT_LENGTH = 500;
const TRUNCATION_SUFFIX = '...';

/** [ARCH-SOLID-061] Score axis labels for display */
const AXIS_LABELS: Readonly<Record<string, string>> = {
  clarity: 'Clarity',
  consistency: 'Consistency',
  risk: 'Risk',
  documentation: 'Documentation',
  technicalDebt: 'Technical Debt',
};

/** [UI-ADS-0821] Severity emoji mapping */
const SEVERITY_EMOJI: Readonly<Record<Severity, string>> = {
  critical: ':red_circle:',
  warning: ':warning:',
  info: ':information_source:',
};

// ═══════════════════════════════════════════
// INTERNAL HELPERS
// ═══════════════════════════════════════════

/**
 * [SEC-PRIV-051] Sanitize dynamic content for safe Markdown insertion.
 * Escapes special GFM characters and truncates long strings.
 */
const sanitizeMarkdown = (input: string): string => {
  if (input.length === 0) {
    return '';
  }

  const truncated =
    input.length > MAX_INPUT_LENGTH
      ? input.substring(0, MAX_INPUT_LENGTH - TRUNCATION_SUFFIX.length) + TRUNCATION_SUFFIX
      : input;

  return truncated
    .replace(/\|/g, '\\|')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]')
    .replace(/`/g, '\\`')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
};

/** [ARCH-SOLID-052] Build score status indicator for a given score */
const scoreIndicator = (score: number): string => (score >= 80 ? ':white_check_mark:' : ':x:');

/** [ARCH-SOLID-052] Format a score value with fallback for undefined */
const formatScoreValue = (value: number | undefined): string => {
  if (value === undefined || value === null) {
    return 'N/A';
  }
  return String(value);
};

/** [ARCH-SOLID-052] Build the score breakdown table rows */
const buildScoreTable = (score: ConsistencyScore): string => {
  const header = '| Axis | Score | Status |\n|------|-------|--------|';
  const overallRow = `| **Overall** | **${formatScoreValue(score.overall)}** | ${scoreIndicator(score.overall)} |`;

  const axisRows = Object.entries(score.axes)
    .map(
      ([key, value]: readonly [string, number]) =>
        `| ${AXIS_LABELS[key] ?? key} | ${formatScoreValue(value)} | ${scoreIndicator(value)} |`,
    )
    .join('\n');

  return `${header}\n${overallRow}\n${axisRows}`;
};

/** [ARCH-SOLID-052] Build inconsistency reasons with severity */
const buildReasonsList = (inconsistencies: readonly Inconsistency[]): string => {
  if (inconsistencies.length === 0) {
    return '';
  }

  return inconsistencies
    .map(
      (inc: Inconsistency) =>
        `${SEVERITY_EMOJI[inc.severity] ?? ':grey_question:'} **[${sanitizeMarkdown(inc.severity)}]** ${sanitizeMarkdown(inc.description)}`,
    )
    .join('\n');
};

/** [ARCH-SOLID-052] Build suggestions checklist from inconsistencies */
const buildSuggestionsChecklist = (inconsistencies: readonly Inconsistency[]): string => {
  const withSuggestions = inconsistencies.filter(
    (inc: Inconsistency): inc is Inconsistency & { readonly suggestion: string } =>
      inc.suggestion !== undefined && inc.suggestion.length > 0,
  );

  if (withSuggestions.length === 0) {
    return '';
  }

  return withSuggestions
    .map(
      (inc: Inconsistency & { readonly suggestion: string }) =>
        `- [ ] ${sanitizeMarkdown(inc.suggestion)}`,
    )
    .join('\n');
};

/** [ARCH-SOLID-052] Build related tickets section */
const buildRelatedTickets = (tickets: readonly string[]): string => {
  if (tickets.length === 0) {
    return '_No related tickets found._';
  }

  return tickets.map((key: string) => `- ${sanitizeMarkdown(key)}`).join('\n');
};

/** [ARCH-SOLID-052] Build documentation links section */
const buildDocumentationLinks = (documents: RovoContext['documents']): string => {
  if (documents.length === 0) {
    return '_No documentation links available._';
  }

  return documents.map((doc) => `- ${sanitizeMarkdown(doc.title)}`).join('\n');
};

/** [ARCH-SOLID-052] Build quick actions section */
const buildQuickActions = (ticketKey: string): string => {
  const sanitizedKey = sanitizeMarkdown(ticketKey);
  return `- Re-validate \`${sanitizedKey}\`\n- View issue panel for \`${sanitizedKey}\``;
};

/** [ARCH-SOLID-052] Build header section with optional custom text */
const buildHeader = (config: CommentTemplateConfig): string => {
  if (config.headerText && config.headerText.length > 0) {
    return `> ${sanitizeMarkdown(config.headerText)}\n\n`;
  }
  return '';
};

/** [ARCH-SOLID-052] Build footer section with optional custom text */
const buildFooter = (config: CommentTemplateConfig): string => {
  if (config.footerText && config.footerText.length > 0) {
    return `\n---\n> ${sanitizeMarkdown(config.footerText)}`;
  }
  return '';
};

// ═══════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════

/**
 * Sanitize dynamic content before Markdown insertion.
 * AC ref: AC-05
 * REGLA: [SEC-PRIV-051], [SEC-PRIV-0914]
 */
export { sanitizeMarkdown };

/**
 * Generate a GFM comment when the PR passes all quality gates.
 *
 * AC ref: AC-01, AC-02, AC-05
 * REGLA: [ARCH-SOLID-069], [ARCH-SOLID-205], [UI-ADS-0862]
 */
export const formatPassedComment = (
  result: EvaluationPipelineResult,
  ticketKey: string,
  config?: CommentTemplateConfig,
): string => {
  const cfg = config ?? DEFAULT_CONFIG;
  const sanitizedKey = sanitizeMarkdown(ticketKey);
  const header = buildHeader(cfg);

  const topSection = [
    `${header}## :white_check_mark: Quality Gate Passed — \`${sanitizedKey}\``,
    '',
    `**Overall Score: ${formatScoreValue(result.score.overall)}** ${scoreIndicator(result.score.overall)}`,
    '',
  ];

  const detailSections = cfg.showScoreBreakdown
    ? [
        '<details>',
        '<summary>Score Breakdown</summary>',
        '',
        buildScoreTable(result.score),
        '',
        '</details>',
        '',
      ]
    : [];

  const refSection = [`_Ref: ${sanitizeMarkdown(result.executionId)}_`];

  const allSections = [...topSection, ...detailSections, ...refSection, buildFooter(cfg)];

  return allSections.join('\n').trim();
};

/**
 * Generate a GFM comment when the PR fails quality gates.
 *
 * AC ref: AC-01, AC-03, AC-05
 * REGLA: [ARCH-SOLID-069], [ARCH-SOLID-205], [UI-ADS-0821], [UI-ADS-0862]
 */
export const formatFailedComment = (
  result: EvaluationPipelineResult,
  ticketKey: string,
  config?: CommentTemplateConfig,
): string => {
  const cfg = config ?? DEFAULT_CONFIG;
  const sanitizedKey = sanitizeMarkdown(ticketKey);
  const header = buildHeader(cfg);

  const topSection = [
    `${header}## :x: Quality Gate Failed — \`${sanitizedKey}\``,
    '',
    `**Overall Score: ${formatScoreValue(result.score.overall)}** ${scoreIndicator(result.score.overall)}`,
    '',
  ];

  const reasonsSection =
    result.inconsistencies.length > 0
      ? ['### Reasons', '', buildReasonsList(result.inconsistencies), '']
      : [];

  const suggestionsSection =
    cfg.showSuggestions && result.inconsistencies.length > 0
      ? [
          '<details>',
          '<summary>Actionable Suggestions</summary>',
          '',
          buildSuggestionsChecklist(result.inconsistencies),
          '',
          '</details>',
          '',
        ]
      : [];

  const scoreSection = cfg.showScoreBreakdown
    ? [
        '<details>',
        '<summary>Score Breakdown</summary>',
        '',
        buildScoreTable(result.score),
        '',
        '</details>',
        '',
      ]
    : [];

  const guidanceSection = [
    '### Next Steps',
    '',
    'Resolve the issues above and push new commits to re-trigger the quality gate evaluation.',
    '',
  ];

  const refSection = [`_Ref: ${sanitizeMarkdown(result.executionId)}_`];

  const allSections = [
    ...topSection,
    ...reasonsSection,
    ...suggestionsSection,
    ...scoreSection,
    ...guidanceSection,
    ...refSection,
    buildFooter(cfg),
  ];

  return allSections.join('\n').trim();
};

/**
 * Generate a GFM comment with contextual information.
 *
 * AC ref: AC-01, AC-04, AC-05
 * REGLA: [ARCH-SOLID-069], [ARCH-SOLID-205], [UI-ADS-0862]
 */
export const formatContextComment = (
  context: RovoContext,
  ticketKey: string,
  config?: CommentTemplateConfig,
): string => {
  const cfg = config ?? DEFAULT_CONFIG;
  const sanitizedKey = sanitizeMarkdown(ticketKey);
  const header = buildHeader(cfg);

  const topSection = [`${header}## :information_source: Context — \`${sanitizedKey}\``, ''];

  const ticketsSection = cfg.showRelatedTickets
    ? ['### Related Tickets', '', buildRelatedTickets(context.relatedTickets), '']
    : [];

  const docsSection = cfg.showDocumentationLinks
    ? ['### Documentation', '', buildDocumentationLinks(context.documents), '']
    : [];

  const actionsSection = cfg.showQuickActions
    ? ['### Quick Actions', '', buildQuickActions(ticketKey), '']
    : [];

  const allSections = [
    ...topSection,
    ...ticketsSection,
    ...docsSection,
    ...actionsSection,
    buildFooter(cfg),
  ];

  return allSections.join('\n').trim();
};
