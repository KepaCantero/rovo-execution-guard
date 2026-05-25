// [ARCH-SOLID-058] Stale Ticket Detector — zero framework dependencies
// [ARCH-SOLID-049-01] SRP: stale detection + triage suggestions only
// [ARCH-SOLID-202] Zero any usage
// [ARCH-SOLID-232] Named exports only, no default export

import type { JiraTicketData } from '../../types/jira-data';
import type { EnforcementAction } from '../../types/enforcement';
import type {
  StaleReason,
  SuggestedAction,
  StaleTicketReport,
  EpicStalenessReport,
} from '../../types/epic-types';
import { getEpicChildren } from '../jira/jira-adapter';

// ═══════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════

const DAY_MS = 86_400_000;
const DEFAULT_STALE_THRESHOLD_DAYS = 14;
const MAX_CHILDREN = 100;

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
// STALENESS CLASSIFICATION
// ═══════════════════════════════════════════

export const classifyStaleness = (
  ticket: JiraTicketData,
  thresholdDays: number,
): readonly StaleReason[] => {
  const reasons: StaleReason[] = [];
  const now = Date.now();
  const updatedMs = new Date(ticket.updated).getTime();
  const daysSinceUpdate = (now - updatedMs) / DAY_MS;

  if (daysSinceUpdate > thresholdDays) {
    reasons.push('no_updates');
  }

  if (ticket.assignee === undefined || ticket.assignee === '') {
    reasons.push('no_assignee');
  }

  if (daysSinceUpdate > thresholdDays && !reasons.includes('no_updates')) {
    reasons.push('no_activity');
  }

  const terminalStatuses = new Set(['DONE', 'CLOSED', 'RESOLVED']);
  if (!terminalStatuses.has(ticket.status.toUpperCase()) && daysSinceUpdate > thresholdDays) {
    reasons.push('stale_status');
  }

  return reasons;
};

// ═══════════════════════════════════════════
// TRIAGE SUGGESTIONS
// ═══════════════════════════════════════════

export const suggestAction = (
  ticket: JiraTicketData,
  staleReasons: readonly StaleReason[],
  _siblings: readonly JiraTicketData[],
): SuggestedAction => {
  if (staleReasons.length === 0) return 'comment';

  if (staleReasons.includes('no_assignee')) return 'reassign';

  if (staleReasons.includes('stale_status') && ticket.status.toUpperCase() === 'TO DO') {
    return 'close';
  }

  if (staleReasons.includes('no_updates') && staleReasons.includes('stale_status')) {
    return 'escalate';
  }

  return 'comment';
};

// ═══════════════════════════════════════════
// COMMENT GENERATION
// ═══════════════════════════════════════════

export const generateStalenessComment = (report: StaleTicketReport): string => {
  const reasons = report.staleReasons.join(', ');
  const lines = [
    `**Stale Ticket Alert** — ${report.ticketKey}`,
    '',
    `This ticket has been identified as stale within epic \`${report.epicKey}\`.`,
    '',
    `| Metric | Value |`,
    `|---|---|`,
    `| Days since update | ${report.daysSinceUpdate} |`,
    `| Stale reasons | ${reasons} |`,
    `| Suggested action | ${report.suggestedAction} |`,
    `| Severity | ${report.severity} |`,
    '',
  ];

  if (report.suggestedAction === 'reassign') {
    lines.push('This ticket has no assignee. Consider assigning it to a team member.');
  } else if (report.suggestedAction === 'close') {
    lines.push(
      'This ticket has been inactive in "To Do" for an extended period. Consider closing it if no longer relevant.',
    );
  } else if (report.suggestedAction === 'escalate') {
    lines.push(
      'This ticket requires attention — it has multiple staleness indicators. Consider escalating to the epic owner.',
    );
  } else {
    lines.push(
      'Please review this ticket and update its status or add a comment with current progress.',
    );
  }

  return lines.join('\n');
};

// ═══════════════════════════════════════════
// AUTO-TRIAGE
// ═══════════════════════════════════════════

export const autoTriageStaleTickets = (
  report: EpicStalenessReport,
): readonly EnforcementAction[] => {
  return report.staleTickets.map(
    (ticket): EnforcementAction => ({
      type: 'add_comment' as const,
      target: 'jira' as const,
      body: generateStalenessComment(ticket),
    }),
  );
};

// ═══════════════════════════════════════════
// MAIN DETECTION
// ═══════════════════════════════════════════

export const detectStaleTickets = async (
  epicKey: string,
  projectKey: string,
  thresholdDays: number = DEFAULT_STALE_THRESHOLD_DAYS,
  executionId: string,
): Promise<EpicStalenessReport> => {
  const timestamp = new Date().toISOString();

  try {
    const children = await getEpicChildren(epicKey, executionId);

    if (children.length === 0) {
      log('info', 'detectStaleTickets', executionId, { epicKey, note: 'no children found' });
      return {
        epicKey,
        staleTickets: [],
        totalTickets: 0,
        stalenessPercentage: 0,
        enforcementActions: [],
        executionId,
        timestamp,
      };
    }

    const cappedChildren = children.slice(0, MAX_CHILDREN);
    const now = Date.now();

    const staleTickets: StaleTicketReport[] = cappedChildren
      .map((ticket): StaleTicketReport => {
        const daysSinceUpdate = Math.floor((now - new Date(ticket.updated).getTime()) / DAY_MS);
        const staleReasons = classifyStaleness(ticket, thresholdDays);
        const severity =
          staleReasons.length >= 2
            ? ('critical' as const)
            : staleReasons.length === 1
              ? ('warning' as const)
              : ('info' as const);

        return {
          ticketKey: ticket.key,
          summary: ticket.summary,
          status: ticket.status,
          assignee: ticket.assignee,
          lastUpdated: ticket.updated,
          daysSinceUpdate,
          staleReasons,
          suggestedAction: suggestAction(ticket, staleReasons, cappedChildren),
          epicKey,
          severity,
        };
      })
      .filter((report) => report.staleReasons.length > 0);

    const enforcementActions =
      staleTickets.length > 0
        ? autoTriageStaleTickets({
            epicKey,
            staleTickets,
            totalTickets: cappedChildren.length,
            stalenessPercentage: 0,
            enforcementActions: [],
            executionId,
            timestamp,
          })
        : [];

    const stalenessPercentage =
      cappedChildren.length > 0
        ? Math.round((staleTickets.length / cappedChildren.length) * 100)
        : 0;

    log('info', 'detectStaleTickets', executionId, {
      epicKey,
      totalTickets: cappedChildren.length,
      staleCount: staleTickets.length,
      stalenessPercentage,
    });

    return {
      epicKey,
      staleTickets,
      totalTickets: cappedChildren.length,
      stalenessPercentage,
      enforcementActions,
      executionId,
      timestamp,
    };
  } catch (error: unknown) {
    log('error', 'detectStaleTickets', executionId, {
      epicKey,
      projectKey,
      error: error instanceof Error ? error.message : String(error),
    });

    return {
      epicKey,
      staleTickets: [],
      totalTickets: 0,
      stalenessPercentage: 0,
      enforcementActions: [],
      executionId,
      timestamp,
    };
  }
};
