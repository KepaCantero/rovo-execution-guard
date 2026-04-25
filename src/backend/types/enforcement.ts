// [ARCH-SOLID-058] Enforcement action domain model — zero framework dependencies
// [ARCH-SOLID-203] Interface for public data structure
// Discriminated union with literal type fields

import type { Inconsistency } from './inconsistency';

interface BlockTransitionAction {
  readonly type: 'block_transition';
  readonly transitionId: string;
  readonly reason: string;
}

interface BlockPRAction {
  readonly type: 'block_pr';
  readonly prNumber: number;
  readonly repo: string;
  readonly reason: string;
}

interface AddCommentAction {
  readonly type: 'add_comment';
  readonly target: 'jira' | 'github';
  readonly body: string;
}

interface FlagInconsistencyAction {
  readonly type: 'flag_inconsistency';
  readonly inconsistency: Inconsistency;
}

export type EnforcementAction =
  | BlockTransitionAction
  | BlockPRAction
  | AddCommentAction
  | FlagInconsistencyAction;
