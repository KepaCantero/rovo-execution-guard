// [ARCH-SOLID-058] Barrel file for domain types — zero framework dependencies
// Re-exports all domain types organized by category
// [ARCH-SOLID-232] Named exports only, no default export

// --- Error Hierarchy ---
export {
  REGError,
  ScoringError,
  InsufficientDataError,
  JiraApiError,
  TicketNotFoundError,
  PermissionDeniedError,
  TransitionBlockedError,
  RovoApiError,
  QuotaExceededError,
  GitHubApiError,
  TokenExpiredError,
  ConfluenceApiError,
  PageNotFoundError,
  SpaceNotFoundError,
  TimeoutError,
  CircuitOpenError,
  StorageError,
} from './errors';

// --- Scoring ---
export type { ScoreAxes, ConsistencyScore } from './consistency-score';

// --- Inconsistency Detection ---
export type {
  InconsistencyType,
  Severity,
  InconsistencySource,
  Inconsistency,
} from './inconsistency';

// --- Quality Gates ---
export type { GateType, QualityGateResult } from './quality-gate';

// --- Project Configuration ---
export type { GateConfig, ProjectConfig } from './project-config';

// --- Enforcement ---
export type { EnforcementAction } from './enforcement';

// --- Rovo Context ---
export type { RovoDocument, HistoricalDecision, RovoContext } from './rovo-context';

// --- Jira Data ---
export type { JiraStatus, JiraTransition, JiraIssueLink, JiraTicketData } from './jira-data';

// --- GitHub Data ---
export type { PRFile, GitHubPRData, GitHubStatusCheck } from './github-data';

// --- Confluence Data ---
export type { ConfluencePageData, ConfluencePageMetadata } from './confluence-data';

// --- Audit Log ---
export type { AuditAction, AuditLogEntry } from './audit-log';

// --- Relationship Index ---
export type {
  EntityType,
  EntityNode,
  EdgeType,
  RelationshipEdge,
  TopicCluster,
  RelationshipContext,
  ContextItem,
  CrossReference,
  RelationshipQuery,
  RelationshipQueryResult,
  GraphStats,
  RelationshipIndexer,
} from './relationship-index';
