// [ARCH-SOLID-058] Epic Health Scorer — zero framework dependencies
// [ARCH-SOLID-049-01] SRP: epic-level health scoring only
// [ARCH-SOLID-202] Zero any usage
// [ARCH-SOLID-232] Named exports only, no default export

import type { AxisDetail } from '../../types/consistency-score';
import type { JiraTicketData } from '../../types/jira-data';
import type { RelationshipContext } from '../../types/relationship-index';
import type { EpicHealthAxes, EpicHealthScore } from '../../types/epic-types';
import { getEpicChildren, getTicketData } from '../jira/jira-adapter';
import { getJiraRelationshipContext } from '../relationship-index/jira-indexer';
import { calculateDocumentationSignal } from '../relationship-index/relationship-consumer';

// ═══════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════

const DAY_MS = 86_400_000;
const STALE_THRESHOLD_DAYS = 14;
const MAX_CHILDREN = 100;

const EPIC_HEALTH_WEIGHTS = {
  criteriaCoverage: 25,
  progressVsEstimate: 25,
  staleness: 20,
  blockerHealth: 15,
  documentationQuality: 15,
} as const;

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
// AXIS SCORERS
// ═══════════════════════════════════════════

export const scoreCriteriaCoverage = (
  epicSummary: string,
  epicDescription: string,
  children: readonly JiraTicketData[],
): number => {
  if (children.length === 0) return 0;

  const epicText = `${epicSummary} ${epicDescription}`.toLowerCase();
  const epicKeywords = extractKeywords(epicText);

  if (epicKeywords.size === 0) return 50;

  let coveredCount = 0;
  for (const keyword of epicKeywords) {
    const isCovered = children.some((child) => {
      const childText = `${child.summary} ${child.description}`.toLowerCase();
      return childText.includes(keyword);
    });
    if (isCovered) coveredCount++;
  }

  return Math.round((coveredCount / epicKeywords.size) * 100);
};

export const scoreProgressVsEstimate = (children: readonly JiraTicketData[]): number => {
  if (children.length === 0) return 50;

  const doneStatuses = new Set(['DONE', 'CLOSED', 'RESOLVED']);
  const completed = children.filter((c) => doneStatuses.has(c.status.toUpperCase())).length;

  return Math.round((completed / children.length) * 100);
};

export const scoreStaleness = (children: readonly JiraTicketData[]): number => {
  if (children.length === 0) return 100;

  const now = Date.now();
  let freshCount = 0;

  for (const child of children) {
    const daysSinceUpdate = (now - new Date(child.updated).getTime()) / DAY_MS;
    if (daysSinceUpdate <= STALE_THRESHOLD_DAYS) freshCount++;
  }

  return Math.round((freshCount / children.length) * 100);
};

export const scoreBlockerHealth = (children: readonly JiraTicketData[]): number => {
  if (children.length === 0) return 100;

  let blockerCount = 0;
  const doneStatuses = new Set(['DONE', 'CLOSED', 'RESOLVED']);

  for (const child of children) {
    const links = child.issueLinks ?? [];
    for (const link of links) {
      if (link.type.toLowerCase().includes('block') && link.direction === 'inward') {
        if (!doneStatuses.has(link.targetStatus.toUpperCase())) {
          blockerCount++;
        }
      }
    }
  }

  const maxBlockers = children.length;
  return Math.round(Math.max(0, (1 - blockerCount / maxBlockers) * 100));
};

export const scoreDocumentationQuality = (
  context: RelationshipContext | undefined,
  children: readonly JiraTicketData[],
): number => {
  if (!context || context.documentation.length === 0) {
    const docLinks = children.filter((c) => {
      const desc = c.description.toLowerCase();
      return desc.includes('confluence') || desc.includes('wiki') || desc.includes('documentation');
    });
    return Math.round((docLinks.length / Math.max(children.length, 1)) * 50);
  }

  const signal = calculateDocumentationSignal(context);
  const base = 50;
  const adjusted = base + signal.bonus + signal.penalty;
  return Math.round(Math.max(0, Math.min(100, adjusted)));
};

// ═══════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════

const extractKeywords = (text: string): Set<string> => {
  const stopWords = new Set([
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
    'could',
    'should',
    'may',
    'might',
    'shall',
    'can',
    'this',
    'that',
    'these',
    'those',
    'it',
    'its',
    'as',
    'if',
    'not',
    'no',
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
    'then',
    'so',
    'we',
    'our',
    'us',
    'must',
    'need',
    'should',
    'user',
    'system',
    'feature',
    'allow',
    'ensure',
    'provide',
    'include',
    'support',
    'via',
    'when',
    'which',
    'their',
    'they',
  ]);

  const words = text
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 3 && !stopWords.has(w));

  return new Set(words.slice(0, 30));
};

const generateEpicHealthAxisDetails = (
  axes: EpicHealthAxes,
  children: readonly JiraTicketData[],
): Readonly<Record<string, AxisDetail>> => {
  const doneStatuses = new Set(['DONE', 'CLOSED', 'RESOLVED']);
  const completed = children.filter((c) => doneStatuses.has(c.status.toUpperCase())).length;

  return {
    criteriaCoverage: {
      score: axes.criteriaCoverage,
      label: 'Criteria Coverage',
      suggestions:
        axes.criteriaCoverage < 60
          ? [
              'Child tickets do not cover all epic scope areas. Consider breaking down uncovered topics into new tickets.',
            ]
          : [],
    },
    progressVsEstimate: {
      score: axes.progressVsEstimate,
      label: 'Progress vs Estimate',
      suggestions:
        axes.progressVsEstimate < 40
          ? [
              `Only ${completed}/${children.length} tickets completed. Review remaining scope and priorities.`,
            ]
          : [],
    },
    staleness: {
      score: axes.staleness,
      label: 'Staleness',
      suggestions:
        axes.staleness < 50
          ? ['Multiple tickets have not been updated recently. Review stale tickets for relevance.']
          : [],
    },
    blockerHealth: {
      score: axes.blockerHealth,
      label: 'Blocker Health',
      suggestions:
        axes.blockerHealth < 70
          ? ['There are unresolved blockers linked to epic tickets. Prioritize resolving blockers.']
          : [],
    },
    documentationQuality: {
      score: axes.documentationQuality,
      label: 'Documentation Quality',
      suggestions:
        axes.documentationQuality < 40
          ? ['Documentation coverage is low. Link Confluence pages to epic tickets.']
          : [],
    },
  };
};

// ═══════════════════════════════════════════
// MAIN SCORER
// ═══════════════════════════════════════════

export const calculateEpicHealthScore = async (
  epicKey: string,
  projectKey: string,
  executionId: string,
): Promise<EpicHealthScore> => {
  const timestamp = new Date().toISOString();

  try {
    const [epicData, children] = await Promise.all([
      getTicketData(epicKey, executionId),
      getEpicChildren(epicKey, executionId),
    ]);

    const cappedChildren = children.slice(0, MAX_CHILDREN);

    let context: RelationshipContext | undefined;
    try {
      context = await getJiraRelationshipContext(epicKey, projectKey, executionId);
    } catch {
      log('warn', 'calculateEpicHealthScore', executionId, {
        epicKey,
        note: 'relationship context unavailable',
      });
    }

    const doneStatuses = new Set(['DONE', 'CLOSED', 'RESOLVED']);
    const completedTickets = cappedChildren.filter((c) =>
      doneStatuses.has(c.status.toUpperCase()),
    ).length;

    const now = Date.now();
    const staleTickets = cappedChildren.filter(
      (c) => (now - new Date(c.updated).getTime()) / DAY_MS > STALE_THRESHOLD_DAYS,
    ).length;

    let activeBlockers = 0;
    for (const child of cappedChildren) {
      const links = child.issueLinks ?? [];
      for (const link of links) {
        if (link.type.toLowerCase().includes('block') && link.direction === 'inward') {
          if (!doneStatuses.has(link.targetStatus.toUpperCase())) activeBlockers++;
        }
      }
    }

    const axes: EpicHealthAxes = {
      criteriaCoverage: scoreCriteriaCoverage(
        epicData.summary,
        epicData.description,
        cappedChildren,
      ),
      progressVsEstimate: scoreProgressVsEstimate(cappedChildren),
      staleness: scoreStaleness(cappedChildren),
      blockerHealth: scoreBlockerHealth(cappedChildren),
      documentationQuality: scoreDocumentationQuality(context, cappedChildren),
    };

    const rawOverall =
      axes.criteriaCoverage * (EPIC_HEALTH_WEIGHTS.criteriaCoverage / 100) +
      axes.progressVsEstimate * (EPIC_HEALTH_WEIGHTS.progressVsEstimate / 100) +
      axes.staleness * (EPIC_HEALTH_WEIGHTS.staleness / 100) +
      axes.blockerHealth * (EPIC_HEALTH_WEIGHTS.blockerHealth / 100) +
      axes.documentationQuality * (EPIC_HEALTH_WEIGHTS.documentationQuality / 100);

    const overall = Math.round(Math.max(0, Math.min(100, rawOverall)));
    const axisDetails = generateEpicHealthAxisDetails(axes, cappedChildren);

    log('info', 'calculateEpicHealthScore', executionId, {
      epicKey,
      overall,
      totalTickets: cappedChildren.length,
      completedTickets,
      staleTickets,
      activeBlockers,
    });

    return {
      epicKey,
      epicSummary: epicData.summary,
      overall,
      axes,
      axisDetails,
      totalTickets: cappedChildren.length,
      completedTickets,
      staleTickets,
      activeBlockers,
      executionId,
      timestamp,
    };
  } catch (error: unknown) {
    log('error', 'calculateEpicHealthScore', executionId, {
      epicKey,
      projectKey,
      error: error instanceof Error ? error.message : String(error),
    });

    const emptyAxes: EpicHealthAxes = {
      criteriaCoverage: 0,
      progressVsEstimate: 0,
      staleness: 0,
      blockerHealth: 0,
      documentationQuality: 0,
    };

    return {
      epicKey,
      epicSummary: '',
      overall: 0,
      axes: emptyAxes,
      axisDetails: {},
      totalTickets: 0,
      completedTickets: 0,
      staleTickets: 0,
      activeBlockers: 0,
      executionId,
      timestamp,
    };
  }
};
