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
} from '../../types/relationship-index';
