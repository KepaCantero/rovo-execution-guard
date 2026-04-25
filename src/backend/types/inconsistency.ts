// [ARCH-SOLID-058] Inconsistency domain model — zero framework dependencies
// [ARCH-SOLID-203] Interface for public data structure

export type InconsistencyType = 'contradiction' | 'duplicate' | 'missing_context' | 'ambiguity';

export type Severity = 'critical' | 'warning' | 'info';

export type InconsistencySource = 'rovo' | 'jira' | 'confluence' | 'github';

export interface Inconsistency {
  readonly id: string;
  readonly type: InconsistencyType;
  readonly severity: Severity;
  readonly source: InconsistencySource;
  readonly description: string;
  readonly affectedTicketKey: string;
  readonly relatedDocs?: readonly string[];
  readonly suggestion?: string;
}
