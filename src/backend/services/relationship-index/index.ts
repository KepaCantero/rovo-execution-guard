// [ARCH-SOLID-058] Barrel file — zero framework dependencies, pure re-exports
// [ARCH-SOLID-232] Named exports only, no default export
// [ARCH-SOLID-006] Service layer public API — single import surface for consumers

// --- Storage Functions ---
export {
  getNode,
  putNode,
  deleteNode,
  getEdges,
  putEdges,
  deleteEdges,
  getTopicEntities,
  putTopicIndex,
  getStats,
  putStats,
  queryRelationships,
  buildRelationshipContext,
  bulkPutNodes,
  bulkPutEdges,
  getNeighborhood,
  putNeighborhood,
} from './relationship-storage';

// --- Jira Indexer ---
export {
  indexJiraIssue,
  buildJiraNode,
  extractJiraEdges,
  buildJiraNeighborhood,
  getJiraRelationshipContext,
  bootstrapProjectIndex,
  EMPTY_RELATIONSHIP_CONTEXT,
} from './jira-indexer';

export type { JiraIndexInput, JiraIssueLinkInput } from './jira-indexer';

// --- Confluence Indexer ---
export {
  indexConfluencePage,
  extractJiraReferences,
  extractPageTopics,
  getDocumentingPages,
  buildConfluenceNeighborhood,
  stalenessFactor,
} from './confluence-indexer';

export type { ConfluencePageInput } from './confluence-indexer';

// --- GitHub Indexer ---
export {
  indexPullRequest,
  extractJiraKeysFromPR,
  getImplementingPRs,
  buildPRNeighborhood,
  extractPRTopics,
} from './github-indexer';

export type { PRIndexInput } from './github-indexer';

// --- Context Builder ---
export {
  extractCausalPaths,
  rankPaths,
  assembleContext,
  estimateTokens,
  DEFAULT_BUDGET,
} from './context-builder';

export type { CausalPath, BuiltContext } from './context-builder';

// --- Relationship Consumer ---
export {
  detectSiblingContradictions,
  detectSpecDrift,
  detectScopeMismatch,
  detectOrphanReferences,
  detectRelationshipInconsistencies,
  calculateDocumentationSignal,
  calculateConsistencySignal,
} from './relationship-consumer';

export type { SignalResult } from './relationship-consumer';

// --- Decision Consumer ---
export { analyzeDecisionPatterns, computeContextSignature } from './decision-consumer';

export type { DecisionPattern } from './decision-consumer';

// --- Context Formatter ---
export {
  formatRelationshipContext,
  formatSiblings,
  formatDocumentation,
  formatPullRequests,
  formatTopics,
  formatCrossReferences,
  buildActionContext,
  buildPathContext,
  buildEvolvingPrompt,
} from './context-formatter';

// --- Domain Types ---
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
  NeighborSummary,
  EntityNeighborhood,
  ContextBudget,
  DecisionRecord,
} from '../../types/relationship-index';

// --- Graph Maintenance ---
export {
  validateNodeBatch,
  removeOrphanedEdges,
  refreshStaleNodes,
  compactStorage,
  generateHealthReport,
  pruneDecisionLog,
  compactDecisionPatterns,
  validateNeighborhoods,
  runMaintenanceCycle,
} from './graph-maintenance';

export type { MaintenanceResult, GraphHealthReport } from './graph-maintenance';
