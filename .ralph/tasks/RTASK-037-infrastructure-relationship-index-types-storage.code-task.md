---
id: RTASK-037
title: 'Infrastructure — Relationship Index: Domain Types & Storage Layer'
status: pending
priority: 2
type: infrastructure
dependencies: [RTASK-012, RTASK-034]
rulebook_refs: [ARCH-SOLID-001, ARCH-SOLID-006, FORGE-OPS-001]
---

# RTASK-037: Infrastructure — Relationship Index: Domain Types & Storage Layer

## Objective

Define the domain types and Forge Storage abstraction layer for the Project Relationship Index — A structured index using two complementary Forge Storage patterns: (1) a denormalized neighborhood for O(1) single-read context retrieval, and (2) an adjacency list for cross-entity queries. The graph stores only entity IDs and relationship types — content stays in source APIs. Includes operational memory types for tracking past decisions. This is the foundation for all 4 phases of the Relationship Index.

## Context

The current scoring and inconsistency detection operates on **single-ticket context** only. `detectContradictions` uses regex pairs, `scoreConsistency` compares summary vs description within one ticket, and `scoreDocumentation` checks for the string `"http"` in descriptions. There is no structural awareness of:

- Epic → Story → Sub-task hierarchies
- Ticket ↔ Confluence page linkages
- Ticket ↔ Pull Request associations
- Topic clusters across entities

This task creates the **type system and storage primitives** that subsequent tasks (RTASK-038 through RTASK-041) will populate and consume. It follows the same pattern as `src/backend/types/` (domain types) and service adapters in `src/backend/services/`.

### Existing Components to Reuse

| Module                | Location                                    | What to Reuse                                                                        |
| --------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------ |
| **Domain types**      | `src/backend/types/jira-data.ts`            | `JiraTicketData` — source of truth for Jira entity fields                            |
| **Domain types**      | `src/backend/types/github-data.ts`          | `GitHubPRData`, `PRFile` — source of truth for PR entities                           |
| **Domain types**      | `src/backend/types/inconsistency.ts`        | `Inconsistency`, `Severity` — relationship-aware detection will extend these         |
| **Domain types**      | `src/backend/types/quality-gate.ts`         | `QualityGateResult` — may carry relationship context in future                       |
| **Domain types**      | `src/backend/types/consistency-score.ts`    | `ConsistencyScore`, `ScoreAxes` — scoring will be enhanced with relationship context |
| **Error types**       | `src/backend/types/errors.ts`               | Domain error hierarchy pattern                                                       |
| **Forge Storage**     | `@forge/api` (`storage`)                    | Key-value storage API — basis for the storage adapter                                |
| **Existing adapters** | `src/backend/services/jira/jira-adapter.ts` | Pattern for service adapter with resilience                                          |

## Technical Specification

### Location

- `src/backend/types/relationship-index.ts` (create — domain types)
- `src/backend/services/relationship-index/relationship-storage.ts` (create — storage adapter)
- `src/backend/services/relationship-index/index.ts` (create — barrel export)

### Domain Types (`src/backend/types/relationship-index.ts`)

```typescript
// ═══════════════════════════════════════════
// ENTITY NODE
// ═══════════════════════════════════════════

/**
 * Entity types in the relationship index.
 * Each maps to a real Atlassian/GitHub resource.
 */
export type EntityType = 'jira-issue' | 'jira-epic' | 'confluence-page' | 'github-pr' | 'topic';

/**
 * A node in the relationship index representing a single entity.
 * Stored as a value in Forge Storage keyed by entityId.
 */
export interface EntityNode {
  /** Globally unique ID: "jira:PROJ-123" | "confluence:12345" | "github:owner/repo/pull/42" | "topic:cache-migration" */
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

/**
 * Relationship types between entities.
 * These are the edges in the relationship index.
 */
export type EdgeType =
  | 'parent-of' // epic → issue
  | 'related-to' // issue link (blocks, depends on, etc.)
  | 'documented-by' // issue ↔ confluence page
  | 'implements' // issue ↔ PR
  | 'topic-match' // entity ↔ topic
  | 'mentioned-in'; // entity referenced in another's text

/**
 * A directed edge between two entities.
 * Stored as an element in an adjacency list keyed by source ID.
 */
export interface RelationshipEdge {
  readonly source: string; // entityId
  readonly target: string; // entityId
  readonly type: EdgeType;
  /** Relevance weight 0-1. 1 = exact/manual link, 0.5 = inferred/topic match */
  readonly weight: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

// ═══════════════════════════════════════════
// TOPIC
// ═══════════════════════════════════════════

/**
 * A topic cluster — groups entities by shared subject matter.
 * Topics are derived from labels, keywords, and explicit links.
 */
export interface TopicCluster {
  readonly id: string; // "topic:cache-migration"
  readonly label: string; // Human-readable topic name
  readonly keywords: readonly string[];
  readonly entityIds: readonly string[];
  readonly projectKeys: readonly string[];
  readonly strength: number; // 0-1, how tightly coupled the entities are
}

// ═══════════════════════════════════════════
// RELATIONSHIP CONTEXT (consumed by agent actions)
// ═══════════════════════════════════════════

/**
 * Structured context derived from the relationship index.
 * This is what gets passed to scoring/detection/agent handlers
 * to provide relational awareness beyond single-ticket context.
 */
export interface RelationshipContext {
  /** Tickets sharing the same parent epic */
  readonly siblings: readonly EntityNode[];
  /** Confluence pages connected to this ticket (via links, topics, or explicit references) */
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

/**
 * A ranked context item — relevance-scored for the LLM.
 * Prevents context overflow by ranking nodes by relevance to the target ticket.
 */
export interface ContextItem {
  readonly node: EntityNode;
  readonly relevanceScore: number; // 0-1
  readonly matchReason: string; // e.g. "shares epic PROJ-E-5" / "topic: cache-migration"
}

/**
 * A cross-reference between two entities across tools.
 * Example: "Confluence page X references Jira ticket Y, and PR Z implements it"
 */
export interface CrossReference {
  readonly source: string; // entityId
  readonly target: string; // entityId
  readonly sourceTool: 'jira' | 'confluence' | 'github';
  readonly targetTool: 'jira' | 'confluence' | 'github';
  readonly referenceType: 'link' | 'mention' | 'keyword' | 'structural';
  readonly confidence: number; // 0-1
}

// ═══════════════════════════════════════════
// STORAGE SCHEMA
// ═══════════════════════════════════════════

/**
 * Forge Storage key patterns for the relationship index.
 * All keys are prefixed with project key for isolation.
 *
 * node:{projectKey}:{entityId}           → EntityNode (JSON)
 * edges:{projectKey}:{sourceId}          → RelationshipEdge[] (JSON)
 * topic-index:{projectKey}:{topicId}     → string[] (entityIds)
 * neighborhood:{projectKey}:{entityId}  → EntityNeighborhood (JSON, denormalized 1-hop)
 * decision:{projectKey}:{timestamp}:{issueKey} → DecisionRecord (JSON, operational memory)
 */

// ═══════════════════════════════════════════
// QUERY TYPES
// ═══════════════════════════════════════════

/** Parameters for querying the relationship index */
export interface RelationshipQuery {
  readonly projectKey: string;
  readonly entityId?: string;
  readonly entityType?: EntityType;
  readonly edgeTypes?: readonly EdgeType[];
  readonly maxDepth?: number; // traversal depth (max 2)
  readonly minWeight?: number; // minimum edge weight to follow
}

/** Result of a relationship index query */
export interface RelationshipQueryResult {
  readonly nodes: readonly EntityNode[];
  readonly edges: readonly RelationshipEdge[];
  readonly query: RelationshipQuery;
  readonly executionId: string;
}

// ═══════════════════════════════════════════
// INDEXER CONTRACT
// ═══════════════════════════════════════════

/**
 * Contract for relationship indexers.
 * Each data source (Jira, Confluence, GitHub) implements this
 * to populate the relationship index from its events.
 */
export interface RelationshipIndexer {
  readonly source: EntityType;
  indexNode(node: EntityNode, executionId: string): Promise<void>;
  indexEdges(edges: readonly RelationshipEdge[], executionId: string): Promise<void>;
  removeNode(entityId: string, executionId: string): Promise<void>;
}

// ═══════════════════════════════════════════
// DENORMALIZED NEIGHBORHOOD (primary read pattern)
// ═══════════════════════════════════════════

/**
 * Denormalized neighborhood — the primary read pattern.
 * One Forge Storage read gives the complete context for an entity.
 * Key: "neighborhood:{projectKey}:{entityId}"
 * Updated atomically when any edge for this entity changes.
 */
export interface EntityNeighborhood {
  readonly entityId: string;
  readonly entityType: EntityType;
  readonly label: string;
  readonly status: string;
  readonly projectKey: string;
  readonly metadata: Readonly<Record<string, string>>;
  readonly updatedAt: string;
  /** Linked Jira issues (siblings, related, blocked-by, etc.) */
  readonly linkedIssues: readonly NeighborSummary[];
  /** Linked Confluence pages */
  readonly linkedPages: readonly NeighborSummary[];
  /** Linked GitHub PRs */
  readonly linkedPRs: readonly NeighborSummary[];
  /** Topics this entity belongs to */
  readonly topics: readonly string[];
}

/** Lightweight summary of a neighboring entity — pointer, not content */
export interface NeighborSummary {
  readonly id: string; // e.g., "jira:PROJ-123"
  readonly label: string; // summary or title
  readonly status: string; // current status
  readonly relationship: EdgeType;
  readonly weight: number;
  readonly updatedAt: string;
}

// ═══════════════════════════════════════════
// OPERATIONAL MEMORY (HippoRAG 2 pattern)
// ═══════════════════════════════════════════

/**
 * A decision record for operational memory.
 * Tracks enforcement decisions and their outcomes to avoid repeating mistakes.
 * Key: "decision:{projectKey}:{timestamp}:{issueKey}"
 */
export interface DecisionRecord {
  readonly id: string;
  readonly issueKey: string;
  readonly projectKey: string;
  readonly gateType: string;
  readonly action: 'block' | 'approve' | 'comment';
  readonly score: number;
  readonly reason: string;
  readonly contextSignature: string; // hash of issue state for similarity matching
  readonly outcome: 'confirmed' | 'overridden' | 'disputed' | 'pending';
  readonly timestamp: string;
}

/**
 * Token budget for context assembly.
 * Prevents context rot by capping LLM input size.
 * Based on Context Engineering research: sweet spot is 1,500-2,500 tokens.
 */
export interface ContextBudget {
  readonly maxTokens: number; // hard cap (default: 2500)
  readonly systemTokens: number; // instructions (~10%)
  readonly entityTokens: number; // primary entity data (~30%)
  readonly relationshipTokens: number; // neighborhood context (~20%)
  readonly evidenceTokens: number; // supporting evidence (~25%)
  readonly reserveTokens: number; // reserved for output (~15%)
}

/** Default context budget */
export const DEFAULT_CONTEXT_BUDGET: ContextBudget = {
  maxTokens: 2500,
  systemTokens: 250,
  entityTokens: 750,
  relationshipTokens: 500,
  evidenceTokens: 625,
  reserveTokens: 375,
};
```

### Storage Adapter (`src/backend/services/relationship-index/relationship-storage.ts`)

```typescript
/**
 * Forge Storage adapter for the relationship index.
 * Provides typed CRUD operations over Forge's key-value storage.
 *
 * Key design decisions:
 * - All keys prefixed with project key for multi-tenancy
 * - Adjacency list model (not graph DB) — edges stored per source node
 * - Max 2-hop traversal ( Forge function timeout constraint)
 * - Bulk operations batched to stay within Forge Storage API limits
 */

// Core operations:
export function getNode(
  projectKey: string,
  entityId: string,
  executionId?: string,
): Promise<EntityNode | null>;
export function getEdges(
  projectKey: string,
  sourceId: string,
  executionId?: string,
): Promise<readonly RelationshipEdge[]>;
export function getTopicEntities(
  projectKey: string,
  topicId: string,
  executionId?: string,
): Promise<readonly string[]>;
export function getStats(projectKey: string, executionId?: string): Promise<GraphStats>;

export function putNode(projectKey: string, node: EntityNode, executionId?: string): Promise<void>;
export function putEdges(
  projectKey: string,
  sourceId: string,
  edges: readonly RelationshipEdge[],
  executionId?: string,
): Promise<void>;
export function putTopicIndex(
  projectKey: string,
  topicId: string,
  entityIds: readonly string[],
  executionId?: string,
): Promise<void>;
export function putStats(
  projectKey: string,
  stats: GraphStats,
  executionId?: string,
): Promise<void>;

export function deleteNode(
  projectKey: string,
  entityId: string,
  executionId?: string,
): Promise<void>;
export function deleteEdges(
  projectKey: string,
  sourceId: string,
  executionId?: string,
): Promise<void>;

// Query operations:
export function queryRelationships(
  query: RelationshipQuery,
  executionId?: string,
): Promise<RelationshipQueryResult>;
export function buildRelationshipContext(
  projectKey: string,
  entityId: string,
  executionId?: string,
): Promise<RelationshipContext>;

// Bulk operations:
export function bulkPutNodes(
  projectKey: string,
  nodes: readonly EntityNode[],
  executionId?: string,
): Promise<void>;
export function bulkPutEdges(
  projectKey: string,
  edges: readonly RelationshipEdge[],
  executionId?: string,
): Promise<void>;

// Denormalized neighborhood (primary read pattern — O(1)):
export function getNeighborhood(
  projectKey: string,
  entityId: string,
  executionId?: string,
): Promise<EntityNeighborhood | null>;
export function putNeighborhood(
  projectKey: string,
  neighborhood: EntityNeighborhood,
  executionId?: string,
): Promise<void>;
export function deleteNeighborhood(
  projectKey: string,
  entityId: string,
  executionId?: string,
): Promise<void>;

// Operational memory (decision log):
export function putDecision(
  projectKey: string,
  decision: DecisionRecord,
  executionId?: string,
): Promise<void>;
export function getRecentDecisions(
  projectKey: string,
  issueKey: string,
  limit: number,
  executionId?: string,
): Promise<readonly DecisionRecord[]>;
export function getSimilarDecisions(
  projectKey: string,
  contextSignature: string,
  limit: number,
  executionId?: string,
): Promise<readonly DecisionRecord[]>;
```

### Barrel Export (`src/backend/services/relationship-index/index.ts`)

Re-export all public functions and types.

## Acceptance Criteria

- [ ] AC-01: `src/backend/types/relationship-index.ts` created with all types: `EntityNode`, `EntityType`, `RelationshipEdge`, `EdgeType`, `TopicCluster`, `RelationshipContext`, `CrossReference`, `GraphStats`, `RelationshipQuery`, `RelationshipQueryResult`, `RelationshipIndexer`
- [ ] AC-02: All interfaces use `readonly` properties, no `any` types
- [ ] AC-03: `src/backend/services/relationship-index/relationship-storage.ts` implements all storage functions with structured logging
- [ ] AC-04: Storage keys follow the documented schema pattern (`node:{projectKey}:{entityId}`, etc.)
- [ ] AC-05: `queryRelationships` supports traversal up to depth 2 with edge type and weight filtering
- [ ] AC-06: `buildRelationshipContext` assembles a complete `RelationshipContext` for a given entity
- [ ] AC-07: All storage operations have error handling that returns gracefully (never throws unhandled)
- [ ] AC-08: `src/backend/services/relationship-index/index.ts` barrel export created
- [ ] AC-09a: `EntityNeighborhood` type created with `NeighborSummary`, supports O(1) single-read context retrieval
- [ ] AC-09b: `DecisionRecord` and `ContextBudget` types created for operational memory
- [ ] AC-09c: Neighborhood storage functions (`getNeighborhood`, `putNeighborhood`) implemented
- [ ] AC-09d: Decision log storage functions (`putDecision`, `getRecentDecisions`, `getSimilarDecisions`) implemented
- [ ] AC-09e: Neighborhood updated atomically when edges change
- [ ] AC-09: Test coverage exceeds 90%
- [ ] AC-10: `.reqs.md` sidecar files created for all production files
- [ ] AC-11: `pnpm typecheck` passes
- [ ] AC-12: Zero `any` usage in new code

## QA Gates

### Pre-Implementation Gates

- [ ] **GATE-READY**: Dependencies (RTASK-012 types, RTASK-034 action handler) are completed
- [ ] **GATE-SPEC**: Existing domain types in `src/backend/types/` reviewed for consistency
- [ ] **GATE-DESIGN**: Storage key schema documented before coding

### Implementation Gates

- [ ] **GATE-RED**: Write failing tests for storage operations first
- [ ] **GATE-GREEN**: Implement minimum code to pass
- [ ] **GATE-REFACTOR**: Clean up

### Post-Implementation Gates

- [ ] **GATE-TYPECHECK**: `pnpm typecheck` passes
- [ ] **GATE-LINT**: `pnpm lint` passes
- [ ] **GATE-FORMAT**: `pnpm format:check` passes
- [ ] **GATE-TEST**: `pnpm test:unit` passes with > 90% coverage
- [ ] **GATE-REQS**: All `.reqs.md` sidecars created
- [ ] **GATE-ZERO-ANY**: No `any` types

## Requirements Creation Protocol

For each production file, the builder MUST create a `.reqs.md` sidecar:

1. **Before implementation**: Create `.reqs.md` listing all requirements from the spec
2. **Format**: Use `.ralph/templates/reqs-template.md` format
3. **Content**: Each requirement maps to an acceptance criterion and rulebook rule
4. **Traceability**: Every AC maps to at least one sidecar section
5. **Location**: Sidecar lives adjacent to the production file

## Implementation Protocol

### Step 1: Preparation

1. Read existing domain types in `src/backend/types/` — understand naming conventions, `readonly` patterns
2. Read `src/backend/types/errors.ts` — understand error hierarchy pattern
3. Read `@forge/api` storage documentation
4. Read `src/backend/services/jira/jira-adapter.ts` — understand adapter pattern with logging
5. Create `.reqs.md` sidecar files

### Step 2: TDD Cycle

1. **RED**: Write tests for domain types (compile-time verification)
2. **GREEN**: Implement types
3. **RED**: Write tests for storage CRUD operations
4. **GREEN**: Implement storage adapter
5. **RED**: Write tests for `queryRelationships` traversal
6. **GREEN**: Implement query engine
7. **RED**: Write tests for `buildRelationshipContext`
8. **GREEN**: Implement context builder

### Step 3: Integration

1. Create barrel export
2. Verify types are importable from other modules
3. Verify storage adapter works with `@forge/api` storage mock

### Step 4: Validation

1. Run `pnpm typecheck` — must pass
2. Run `pnpm lint` — must pass
3. Run `pnpm format:check` — must pass
4. Run `pnpm test:unit` — must pass with > 90% coverage
5. Verify zero `any` usage

## Auditing Protocol

### Critic Review Checklist

- [ ] All acceptance criteria verified
- [ ] No `any` types anywhere
- [ ] All interfaces use `readonly` properties
- [ ] Storage key schema matches documented pattern
- [ ] Error handling never throws unhandled
- [ ] Structured logging with `executionId` on all operations
- [ ] Triple deliverable: `.ts` + `.reqs.md` + `.spec.ts`
- [ ] Types are consistent with existing `src/backend/types/` conventions

### Rejection Criteria

- Any `any` type
- Coverage below 90%
- Missing `.reqs.md` sidecar
- Storage operations that throw unhandled
- Types that conflict with existing domain types

## Testing Protocol

### Unit Tests

- `tests/unit/types/relationship-index.spec.ts` — type-level tests
- `tests/unit/services/relationship-index/relationship-storage.spec.ts` — storage CRUD, queries, context building

### Test Categories Required

- [ ] **Node CRUD**: put, get, delete nodes with all entity types
- [ ] **Edge CRUD**: put, get, delete edges with all edge types
- [ ] **Topic index**: put, get topic entity lists
- [ ] **Query traversal**: 1-hop and 2-hop queries with type/weight filtering
- [ ] **Context building**: `buildRelationshipContext` assembles correct siblings, docs, PRs, topics, crossRefs
- [ ] **Error handling**: Storage failures, missing keys, invalid entity IDs
- [ ] **Edge cases**: Empty project, orphaned nodes, cycles in relationships
- [ ] **Neighborhood CRUD**: put, get, delete neighborhoods with all entity types
- [ ] **Neighborhood atomicity**: neighborhood updates when edges change
- [ ] **Decision log**: store and retrieve decisions by issue key and context signature
- [ ] **Context budget**: verify token counting and budget enforcement

### Mock Strategy

- Mock `@forge/api` storage (`storage.get`, `storage.set`, `storage.delete`)
- Mock Forge storage keys
- Use `jest.fn()` for all external calls

## Triple Deliverable

| Production                                                        | Sidecar                                                                | Test                                                                  |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `src/backend/types/relationship-index.ts`                         | `src/backend/types/relationship-index.reqs.md`                         | `tests/unit/types/relationship-index.spec.ts`                         |
| `src/backend/services/relationship-index/relationship-storage.ts` | `src/backend/services/relationship-index/relationship-storage.reqs.md` | `tests/unit/services/relationship-index/relationship-storage.spec.ts` |
| `src/backend/services/relationship-index/index.ts`                | -                                                                      | Validated by barrel import                                            |

## Risks

| Risk                                         | Mitigation                                                                                       |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Forge Storage key length limits              | Use compressed entity IDs; validate key length < 100 chars                                       |
| Storage size limits per key                  | Batch edges per source node; paginate if > 100 edges per node                                    |
| 2-hop traversal timeout on large projects    | Limit max nodes returned; add timeout guard at 5s                                                |
| Type conflicts with existing domain types    | Use dedicated `relationship-index.ts` file; extend, never modify existing                        |
| Denormalized neighborhood grows too large    | Cap at 50 neighbors per entity; oldest/lowest-weight pruned first                                |
| Operational memory grows unbounded           | TTL-based pruning (default 90 days); configurable retention                                      |
| Neighborhood out of sync with adjacency list | Neighborhood is the source of truth for reads; adjacency list used only for cross-entity queries |
