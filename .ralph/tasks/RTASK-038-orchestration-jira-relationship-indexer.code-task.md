---
id: RTASK-038
title: 'Orchestration — Jira Relationship Indexer (Phase 1)'
status: pending
priority: 2
type: orchestration
dependencies: [RTASK-037, RTASK-014, RTASK-034]
rulebook_refs: [ARCH-SOLID-006, FORGE-OPS-001, JIRA-INTEG-001]
---

# RTASK-038: Orchestration — Jira Relationship Indexer (Phase 1)

## Objective

Build the Jira relationship indexer that populates the Relationship Index with Jira entity nodes (epics, stories, tasks, bugs) and their structural edges (parent-of, related-to, topic-match). This is the highest-ROI phase — it immediately improves `scoreConsistency` and `detectContradictions` by providing sibling-aware and epic-aware context.

## Context

RTASK-037 defines the storage layer and domain types. This task implements the first `RelationshipIndexer` — the Jira indexer — which:

1. Indexes Jira issues as `EntityNode` objects when they are created, updated, or transitioned
2. Extracts edges: epic→story (`parent-of`), issue links (`related-to`), labels→topics (`topic-match`)
3. Provides a query function that assembles `RelationshipContext` for a given Jira issue

This indexer is triggered by two existing entry points:

- **`transition-handler`** (RTASK-014): When a ticket transitions, re-index it and its siblings
- **`agent-action`** (RTASK-034): Lazy hydration — if a node is missing during evaluation, index it on-the-fly

### Storage Strategy (LightRAG / Forge-optimized)

This indexer writes to **two** storage patterns:

1. **Adjacency list** (edges per source node) — for cross-entity queries
2. **Denormalized neighborhood** (`EntityNeighborhood`) — for O(1) single-read context retrieval

The neighborhood is the **primary read path**. When `indexJiraIssue` runs, it atomically updates both the adjacency list and the denormalized neighborhood. Subsequent tasks (RTASK-041, 043) read neighborhoods, not raw edges.

The graph stores **pointers only** (entity IDs, relationship types, lightweight metadata). Content (descriptions, comments, full text) stays in source APIs — fetched on demand by the Context Builder.

### What This Enables

After this task, the system will be able to answer:

- "Does this story have siblings in the same epic? Are they consistent with each other?"
- "Does this ticket link to other tickets that contradict it?"
- "What topics (labels) does this ticket belong to, and what other tickets share those topics?"

These questions are impossible today because `detectInconsistencies` only sees a single ticket in isolation.

### Existing Components to Reuse

| Module                   | Location                                                                      | What to Reuse                                                                                          |
| ------------------------ | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| **Storage layer**        | `src/backend/services/relationship-index/relationship-storage.ts` (RTASK-037) | All CRUD operations for nodes, edges, neighborhoods, topic index                                       |
| **Domain types**         | `src/backend/types/relationship-index.ts` (RTASK-037)                         | `EntityNode`, `RelationshipEdge`, `RelationshipContext`, `EntityNeighborhood`, `NeighborSummary`, etc. |
| **Jira adapter**         | `src/backend/services/jira/jira-adapter.ts`                                   | `getTicketData` — fetch ticket fields; pattern for Forge API calls                                     |
| **Agent action handler** | `src/backend/resolvers/agent-action.ts` (RTASK-034)                           | Hook point for lazy hydration in `handleEvaluateIssue`                                                 |
| **Transition handler**   | `src/backend/resolvers/workflow-transition.ts` (RTASK-014)                    | Hook point for incremental indexing on transitions                                                     |
| **Error types**          | `src/backend/types/errors.ts`                                                 | Domain error pattern                                                                                   |

## Technical Specification

### Location

- `src/backend/services/relationship-index/jira-indexer.ts` (create — indexer logic)
- `src/backend/resolvers/agent-action.ts` (modify — add lazy hydration call)
- `src/backend/resolvers/workflow-transition.ts` (modify — add incremental indexing hook)

### Jira Indexer (`src/backend/services/relationship-index/jira-indexer.ts`)

#### Types

```typescript
/** Input for indexing a Jira issue */
interface JiraIndexInput {
  readonly issueKey: string;
  readonly projectKey: string;
  readonly summary: string;
  readonly description: string;
  readonly issueType: string;
  readonly status: string;
  readonly labels: readonly string[];
  readonly epicKey?: string; // parent epic (if story/task)
  readonly issueLinks?: readonly JiraIssueLink[];
}

interface JiraIssueLink {
  readonly type: string; // "Blocks", "Depends on", "Relates", etc.
  readonly direction: 'inward' | 'outward';
  readonly targetKey: string;
}
```

#### Core Functions

```typescript
/**
 * Index a single Jira issue as an EntityNode + its edges.
 * Called from transition-handler (incremental) or agent-action (lazy hydration).
 */
export async function indexJiraIssue(input: JiraIndexInput, executionId: string): Promise<void>;

/**
 * Build an EntityNode from JiraIndexInput.
 */
export function buildJiraNode(input: JiraIndexInput): EntityNode;

/**
 * Extract edges from a Jira issue:
 * - parent-of: if epic, edge to each child story
 * - related-to: issue links (blocks, depends, etc.)
 * - topic-match: one edge per label to topic entity
 */
export function extractJiraEdges(
  input: JiraIndexInput,
  executionId: string,
): readonly RelationshipEdge[];

/**
 * Fetch and index all issues in a project.
 * Used for initial project bootstrap or full resync.
 */
export async function bootstrapProjectIndex(
  projectKey: string,
  executionId: string,
): Promise<GraphStats>;

/**
 * Get the RelationshipContext for a Jira issue.
 * Reads the denormalized neighborhood first (O(1)), falls back to traversal.
 */
export async function getJiraRelationshipContext(
  issueKey: string,
  projectKey: string,
  executionId: string,
): Promise<RelationshipContext>;

/**
 * Build and persist a denormalized neighborhood for a Jira issue.
 * Called automatically by indexJiraIssue after edges are written.
 */
export function buildJiraNeighborhood(
  input: JiraIndexInput,
  edges: readonly RelationshipEdge[],
): EntityNeighborhood;
```

#### Edge Extraction Logic

| Source            | Edge Type     | Target             | Weight | Condition                             |
| ----------------- | ------------- | ------------------ | ------ | ------------------------------------- |
| Epic key present  | `parent-of`   | `jira:{epicKey}`   | 1.0    | `input.epicKey` is not empty          |
| Issue link exists | `related-to`  | `jira:{targetKey}` | 0.8    | For each `issueLink`                  |
| Label present     | `topic-match` | `topic:{label}`    | 0.6    | For each label (normalized lowercase) |

#### Node ID Convention

- Jira issue: `jira:{issueKey}` (e.g., `jira:PROJ-123`)
- Jira epic: `jira:{epicKey}` (same format, `type: 'jira-epic'`)
- Topic: `topic:{normalizedLabel}` (e.g., `topic:performance`, `topic:cache-migration`)

### Integration Points

#### 1. Lazy Hydration in Agent Actions

In `src/backend/resolvers/agent-action.ts`, modify `handleEvaluateIssue` to fetch relationship context:

```typescript
// In handleEvaluateIssue, after fetching ticket:
const relContext = await getJiraRelationshipContext(issueKey, projectKey ?? '', executionId).catch(
  () => EMPTY_RELATIONSHIP_CONTEXT,
);

// Pass to inconsistency detector (future: RTASK-042 enhances detectInconsistencies to use this)
```

#### 2. Incremental Indexing in Transition Handler

In `src/backend/resolvers/workflow-transition.ts`, after successful evaluation:

```typescript
// After scoring, index the ticket asynchronously (fire-and-forget)
void indexJiraIssue(buildIndexInput(ticket), executionId).catch(() => {
  // Log but don't fail the transition
});
```

## Implementation Notes

1. **Jira Epic Link**: The `epicKey` field may require a separate API call depending on Jira version. Use the `getTicketData` adapter which should already fetch custom fields.
2. **Issue Links**: Similarly, issue links may need a separate query. Consider batching.
3. **Bootstrap**: The `bootstrapProjectIndex` function should use Jira's JQL search to fetch all issues in a project and index them in batches of 50-100.
4. **Idempotency**: All indexing operations must be idempotent. Re-indexing the same issue should update the node/edges/neighborhood, not create duplicates.
5. **Neighborhood writes**: `indexJiraIssue` MUST atomically update the denormalized neighborhood after writing edges. The neighborhood is the primary read path for RTASK-041/043.

## Testing Strategy

1. **Unit tests**: `buildJiraNode`, `extractJiraEdges` with various inputs (with/without epic, with/without links, with/without labels)
2. **Integration tests**: `indexJiraIssue` → verify storage contains correct nodes and edges
3. **Context tests**: `getJiraRelationshipContext` → verify correct siblings, related tickets, and topics are returned
4. **Edge cases**: Empty project, issue with no links/labels, circular issue links

## Risks and Mitigations

| Risk                                            | Mitigation                                              |
| ----------------------------------------------- | ------------------------------------------------------- |
| Jira API rate limits during bootstrap           | Batch processing with configurable delay                |
| Stale index after bulk Jira updates             | Support for full re-sync via `bootstrapProjectIndex`    |
| Performance impact on transitions               | Fire-and-forget async indexing, non-blocking            |
| Storage limits for large projects               | Paginated edge storage, topic index pruning             |
| Neighborhood grows too large (>50 neighbors)    | Prune lowest-weight neighbors; cap `linkedIssues` at 30 |
| Neighborhood out of sync after partial indexing | RTASK-044 validates and repairs neighborhoods weekly    |

## Triple Deliverables

| Type           | File                                                             |
| -------------- | ---------------------------------------------------------------- |
| Implementation | `src/backend/services/relationship-index/jira-indexer.ts`        |
| Tests          | `tests/backend/services/relationship-index/jira-indexer.spec.ts` |
| Modified       | `src/backend/resolvers/agent-action.ts` (lazy hydration hook)    |
| Modified       | `src/backend/resolvers/workflow-transition.ts` (indexing hook)   |
