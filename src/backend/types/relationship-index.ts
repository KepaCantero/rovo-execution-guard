// [ARCH-SOLID-058] Relationship index domain model — zero framework dependencies
// [ARCH-SOLID-203] Interface for public data structures, type for unions

// ═══════════════════════════════════════════
// ENTITY NODE
// ═══════════════════════════════════════════

/** Entity types in the relationship index. Each maps to a real Atlassian/GitHub resource. */
export type EntityType = 'jira-issue' | 'jira-epic' | 'confluence-page' | 'github-pr' | 'topic';

/** A node in the relationship index representing a single entity. */
export interface EntityNode {
  /** Globally unique ID: "jira:PROJ-123" | "confluence:12345" | "github:owner/repo/pull/42" | "topic:name" */
  readonly id: string;
  readonly type: EntityType;
  /** Human-readable label: ticket summary, page title, PR title, topic name */
  readonly label: string;
  /** Current status: Jira status, Confluence version, PR state, or "active" for topics */
  readonly status: string;
  /** Project key this entity belongs to (empty string for cross-project topics) */
  readonly projectKey: string;
  /** Structured metadata — different fields per entity type */
  readonly metadata: Readonly<Record<string, string>>;
  readonly createdAt: string;
  readonly updatedAt: string;
}

// ═══════════════════════════════════════════
// EDGE
// ═══════════════════════════════════════════

/** Relationship types between entities. These are the edges in the relationship index. */
export type EdgeType =
  | 'parent-of'
  | 'related-to'
  | 'documented-by'
  | 'implements'
  | 'topic-match'
  | 'mentioned-in';

/** A directed edge between two entities. Stored as an element in an adjacency list keyed by source ID. */
export interface RelationshipEdge {
  readonly source: string;
  readonly target: string;
  readonly type: EdgeType;
  /** Relevance weight 0-1. 1 = exact/manual link, 0.5 = inferred/topic match */
  readonly weight: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

// ═══════════════════════════════════════════
// TOPIC
// ═══════════════════════════════════════════

/** A topic cluster — groups entities by shared subject matter. */
export interface TopicCluster {
  readonly id: string;
  readonly label: string;
  readonly keywords: readonly string[];
  readonly entityIds: readonly string[];
  readonly projectKeys: readonly string[];
  /** How tightly coupled the entities are (0-1) */
  readonly strength: number;
}

// ═══════════════════════════════════════════
// RELATIONSHIP CONTEXT (consumed by agent actions)
// ═══════════════════════════════════════════

/** A ranked context item — relevance-scored for the LLM. */
export interface ContextItem {
  readonly node: EntityNode;
  /** Relevance score 0-1 */
  readonly relevanceScore: number;
  /** e.g. "shares epic PROJ-E-5" / "topic: cache-migration" */
  readonly matchReason: string;
}

/** A cross-reference between two entities across tools. */
export interface CrossReference {
  readonly source: string;
  readonly target: string;
  readonly sourceTool: 'jira' | 'confluence' | 'github';
  readonly targetTool: 'jira' | 'confluence' | 'github';
  readonly referenceType: 'link' | 'mention' | 'keyword' | 'structural';
  /** Confidence 0-1 */
  readonly confidence: number;
}

/** Structured context derived from the relationship index. */
export interface RelationshipContext {
  /** Tickets sharing the same parent epic */
  readonly siblings: readonly EntityNode[];
  /** Confluence pages connected to this ticket */
  readonly documentation: readonly EntityNode[];
  /** PRs that reference this ticket */
  readonly pullRequests: readonly EntityNode[];
  /** Topic clusters this ticket belongs to */
  readonly topics: readonly TopicCluster[];
  /** Bidirectional cross-references found across tools */
  readonly crossReferences: readonly CrossReference[];
  /** Ranked context items — relevance-scored for efficient LLM consumption */
  readonly rankedItems: readonly ContextItem[];
  /** When this context was assembled */
  readonly assembledAt: string;
}

// ═══════════════════════════════════════════
// QUERY TYPES
// ═══════════════════════════════════════════

/** Parameters for querying the relationship index. */
export interface RelationshipQuery {
  readonly projectKey: string;
  readonly entityId?: string;
  readonly entityType?: EntityType;
  readonly edgeTypes?: readonly EdgeType[];
  /** Traversal depth (max 2) [FORGE-OPS-001] */
  readonly maxDepth?: number;
  /** Minimum edge weight to follow */
  readonly minWeight?: number;
}

/** Result of a relationship index query. */
export interface RelationshipQueryResult {
  readonly nodes: readonly EntityNode[];
  readonly edges: readonly RelationshipEdge[];
  readonly query: RelationshipQuery;
  readonly executionId: string;
}

// ═══════════════════════════════════════════
// INDEX STATS
// ═══════════════════════════════════════════

/** Statistics about the relationship index for monitoring. */
export interface GraphStats {
  readonly totalNodes: number;
  readonly totalEdges: number;
  readonly nodesByType: Readonly<Record<EntityType, number>>;
  readonly edgesByType: Readonly<Record<EdgeType, number>>;
  readonly topicCount: number;
  readonly lastUpdated: string;
}

// ═══════════════════════════════════════════
// NEIGHBORHOOD (denormalized O(1) read path)
// ═══════════════════════════════════════════

/** Summary of a neighboring entity — lightweight pointer for O(1) context retrieval. */
export interface NeighborSummary {
  readonly id: string;
  readonly key: string;
  readonly type: EntityType;
  readonly relationship: EdgeType;
  readonly weight: number;
}

/** Denormalized neighborhood stored per entity for single-read context retrieval. */
export interface EntityNeighborhood {
  readonly entityId: string;
  readonly entityKey: string;
  readonly entityType: EntityType;
  readonly projectKey: string;
  readonly siblings: readonly NeighborSummary[];
  readonly linkedIssues: readonly NeighborSummary[];
  readonly topics: readonly string[];
  readonly updatedAt: string;
}

// ═══════════════════════════════════════════
// CONTEXT BUDGET & DECISION RECORD (RTASK-041)
// ═══════════════════════════════════════════

/** Token budget configuration for JIT context assembly. */
export interface ContextBudget {
  readonly maxTokens: number;
  readonly reserveForPrompt: number;
}

/** Stored enforcement decision for operational memory. */
export interface DecisionRecord {
  readonly id: string;
  readonly issueKey: string;
  readonly gateType: string;
  readonly score: number;
  readonly action: 'block' | 'approve' | 'comment';
  readonly overridden: boolean;
  readonly contextSignature: string;
  readonly timestamp: string;
}

// ═══════════════════════════════════════════
// INDEXER CONTRACT [ARCH-SOLID-006]
// ═══════════════════════════════════════════

/** Contract for relationship indexers. Each data source implements this. */
export interface RelationshipIndexer {
  readonly source: EntityType;
  indexNode(node: EntityNode, executionId: string): Promise<void>;
  indexEdges(edges: readonly RelationshipEdge[], executionId: string): Promise<void>;
  removeNode(entityId: string, executionId: string): Promise<void>;
}
