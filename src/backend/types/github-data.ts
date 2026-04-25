// [ARCH-SOLID-058] GitHub data domain model — zero framework dependencies
// [ARCH-SOLID-203] Interface for public data structure

export interface PRFile {
  readonly filename: string;
  readonly status: 'added' | 'modified' | 'removed';
  readonly additions: number;
  readonly deletions: number;
}

export interface GitHubPRData {
  readonly number: number;
  readonly title: string;
  readonly body: string;
  readonly state: 'open' | 'closed' | 'merged';
  readonly branch: string;
  readonly baseBranch: string;
  readonly files: readonly PRFile[];
  readonly url: string;
}

export interface GitHubStatusCheck {
  readonly state: 'pending' | 'success' | 'failure' | 'error';
  readonly targetUrl: string;
  readonly description: string;
  readonly context: string;
}
