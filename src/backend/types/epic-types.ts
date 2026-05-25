// [ARCH-SOLID-058] Epic management domain types — zero framework dependencies
// [ARCH-SOLID-203] Interface for public data structures
// [ARCH-SOLID-232] Named exports only, no default export

import type { Severity } from './inconsistency';
import type { AxisDetail } from './consistency-score';
import type { EnforcementAction } from './enforcement';

// ═══════════════════════════════════════════
// Feature 1: Cross-Epic Consistency Validation
// ═══════════════════════════════════════════

export type ContradictionType =
  | 'duplicate_criteria'
  | 'conflicting_scope'
  | 'dependency_gap'
  | 'coverage_hole';

export interface SiblingContradictionResult {
  readonly ticketA: string;
  readonly ticketB: string;
  readonly contradictionType: ContradictionType;
  readonly description: string;
  readonly severity: Severity;
}

export interface CoverageGap {
  readonly area: string;
  readonly description: string;
  readonly suggestedTicketSummary: string;
}

export interface DependencyGap {
  readonly sourceTicket: string;
  readonly missingDependency: string;
  readonly description: string;
}

export interface CrossEpicValidationResult {
  readonly epicKey: string;
  readonly siblingsAnalyzed: number;
  readonly contradictions: readonly SiblingContradictionResult[];
  readonly coverageGaps: readonly CoverageGap[];
  readonly dependencyGaps: readonly DependencyGap[];
  readonly overallConsistency: number;
  readonly executionId: string;
  readonly timestamp: string;
}

// ═══════════════════════════════════════════
// Feature 2: Definition-of-Done Enforcement
// ═══════════════════════════════════════════

export type DoDCriterionType =
  | 'all_subtickets_closed'
  | 'confluence_page_updated'
  | 'prs_merged'
  | 'no_open_blockers'
  | 'no_critical_inconsistencies'
  | 'score_above_threshold';

export interface DoDCriterion {
  readonly type: DoDCriterionType;
  readonly enabled: boolean;
  readonly config?: Readonly<Record<string, string | number | boolean>>;
}

export interface EpicDoDConfig {
  readonly epicKey: string;
  readonly projectKey: string;
  readonly criteria: readonly DoDCriterion[];
  readonly updatedAt: string;
}

export interface DoDCriterionResult {
  readonly type: DoDCriterionType;
  readonly passed: boolean;
  readonly details: string;
  readonly remediation?: string;
}

export interface DoDEvaluationResult {
  readonly epicKey: string;
  readonly passed: boolean;
  readonly criterionResults: readonly DoDCriterionResult[];
  readonly failingCriteria: readonly string[];
  readonly overallCompletion: number;
  readonly executionId: string;
  readonly timestamp: string;
}

// ═══════════════════════════════════════════
// Feature 3: Dependency Chain Validation
// ═══════════════════════════════════════════

export type DependencyLinkType =
  | 'blocks'
  | 'is blocked by'
  | 'depends on'
  | 'implements'
  | 'relates to';

export interface DependencyNode {
  readonly ticketKey: string;
  readonly summary: string;
  readonly status: string;
  readonly epicKey?: string;
  readonly resolved: boolean;
}

export interface DependencyEdge {
  readonly source: string;
  readonly target: string;
  readonly linkType: DependencyLinkType;
  readonly direction: 'upstream' | 'downstream';
}

export interface CircularDependency {
  readonly cycle: readonly string[];
  readonly severity: Severity;
  readonly description: string;
}

export interface DependencyChainResult {
  readonly ticketKey: string;
  readonly upstreamDeps: readonly DependencyNode[];
  readonly downstreamDeps: readonly DependencyNode[];
  readonly unresolvedUpstream: readonly DependencyNode[];
  readonly circularDependencies: readonly CircularDependency[];
  readonly canTransition: boolean;
  readonly blockingReason?: string;
  readonly executionId: string;
  readonly timestamp: string;
}

// ═══════════════════════════════════════════
// Feature 4: Epic Health Score
// ═══════════════════════════════════════════

export interface EpicHealthAxes {
  readonly criteriaCoverage: number;
  readonly progressVsEstimate: number;
  readonly staleness: number;
  readonly blockerHealth: number;
  readonly documentationQuality: number;
}

export interface EpicHealthScore {
  readonly epicKey: string;
  readonly epicSummary: string;
  readonly overall: number;
  readonly axes: EpicHealthAxes;
  readonly axisDetails: Readonly<Record<string, AxisDetail>>;
  readonly totalTickets: number;
  readonly completedTickets: number;
  readonly staleTickets: number;
  readonly activeBlockers: number;
  readonly executionId: string;
  readonly timestamp: string;
}

// ═══════════════════════════════════════════
// Feature 5: Stale Ticket Detection
// ═══════════════════════════════════════════

export type StaleReason = 'no_activity' | 'no_assignee' | 'no_updates' | 'stale_status';

export type SuggestedAction = 'reassign' | 'close' | 'escalate' | 'comment';

export interface StaleTicketReport {
  readonly ticketKey: string;
  readonly summary: string;
  readonly status: string;
  readonly assignee?: string;
  readonly lastUpdated: string;
  readonly daysSinceUpdate: number;
  readonly staleReasons: readonly StaleReason[];
  readonly suggestedAction: SuggestedAction;
  readonly epicKey: string;
  readonly severity: Severity;
}

export interface EpicStalenessReport {
  readonly epicKey: string;
  readonly staleTickets: readonly StaleTicketReport[];
  readonly totalTickets: number;
  readonly stalenessPercentage: number;
  readonly enforcementActions: readonly EnforcementAction[];
  readonly executionId: string;
  readonly timestamp: string;
}

// ═══════════════════════════════════════════
// Shared Epic Analysis Input
// ═══════════════════════════════════════════

export interface EpicAnalysisInput {
  readonly epicKey: string;
  readonly projectKey: string;
  readonly executionId: string;
}
