// [ARCH-SOLID-058] Jira data domain model — zero framework dependencies
// [ARCH-SOLID-203] Interface for public data structure

export type JiraStatus = 'TO DO' | 'IN PROGRESS' | 'IN REVIEW' | 'DONE';

export interface JiraTransition {
  readonly id: string;
  readonly name: string;
  readonly toStatus: string;
}

/** [ARCH-SOLID-203] Directional relationship between two Jira issues */
export interface JiraIssueLink {
  readonly type: string;
  readonly direction: 'inward' | 'outward';
  readonly targetKey: string;
  readonly targetSummary: string;
  readonly targetStatus: string;
}

export interface JiraTicketData {
  readonly key: string;
  readonly summary: string;
  readonly description: string;
  readonly status: string;
  readonly assignee?: string;
  readonly reporter?: string;
  readonly priority?: string;
  readonly issueType: string;
  readonly labels: readonly string[];
  readonly projectKey: string;
  readonly created: string;
  readonly updated: string;

  // Relationship fields — optional for backward compatibility [RTASK-042]
  readonly epicKey?: string;
  readonly epicSummary?: string;
  readonly issueLinks?: readonly JiraIssueLink[];
  readonly fixVersions?: readonly string[];
}
