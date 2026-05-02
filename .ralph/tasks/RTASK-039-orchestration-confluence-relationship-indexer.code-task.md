---
id: RTASK-039
title: 'Orchestration — Confluence Relationship Indexer (Phase 2)'
status: pending
priority: 3
type: orchestration
dependencies: [RTASK-037, RTASK-038]
rulebook_refs: [ARCH-SOLID-006, FORGE-OPS-001]
---

# RTASK-039: Orchestration — Confluence Relationship Indexer (Phase 2)

## Objective

Build the Confluence relationship indexer that populates the Relationship Index with Confluence page nodes and their edges to Jira issues, topics, and other pages. This enables Rovo to detect spec drift, verify documentation alignment, and find cross-references between Confluence specs and Jira tickets.

## Context

RTASK-038 indexes Jira entities. This task adds Confluence pages as a second entity type, creating the first cross-tool edges (`documented-by`, `mentioned-in`). After this task, `handleValidateSpecAlignment` can use structural relationships instead of just keyword search to find relevant specs.

### Storage Strategy (LightRAG / Forge-optimized)

Writes to both adjacency list and **denormalized neighborhood** (from RTASK-037). The neighborhood enables O(1) context retrieval — a single Forge Storage read gives the full Confluence page context including all linked Jira issues and topics. Graph stores pointers only; content fetched on demand.

### What This Enables

- "This Confluence spec page was updated yesterday but the 3 Jira tickets it documents still reference the old architecture"
- "This ticket mentions CONFL-123 but that page was archived 2 months ago"
- "The spec page for 'cache-migration' exists but no ticket in the epic references it"

### Existing Components to Reuse

| Module                 | Location                                                                      | What to Reuse                                        |
| ---------------------- | ----------------------------------------------------------------------------- | ---------------------------------------------------- |
| **Storage layer**      | `src/backend/services/relationship-index/relationship-storage.ts` (RTASK-037) | All CRUD operations                                  |
| **Domain types**       | `src/backend/types/relationship-index.ts` (RTASK-037)                         | `EntityNode`, `RelationshipEdge`, `EdgeType`         |
| **Jira indexer**       | `src/backend/services/relationship-index/jira-indexer.ts` (RTASK-038)         | Pattern for indexer implementation, topic matching   |
| **Confluence adapter** | `src/backend/services/confluence/`                                            | Existing Confluence API calls (read pages, search)   |
| **Rovo adapter**       | `src/backend/services/rovo/rovo-adapter.ts`                                   | `fallbackConfluenceSearch`, `collectConfluencePages` |

## Technical Specification

### Location

- `src/backend/services/relationship-index/confluence-indexer.ts` (create)

### Edge Extraction Logic

| Source                                     | Edge Type       | Target                | Weight | How Detected                           |
| ------------------------------------------ | --------------- | --------------------- | ------ | -------------------------------------- |
| Page body contains Jira issue key          | `documented-by` | `jira:{issueKey}`     | 0.9    | Regex match `\[A-Z]+-\d+` in page body |
| Page body contains Confluence page link    | `mentioned-in`  | `confluence:{pageId}` | 0.7    | Parse internal links                   |
| Page title/labels match topic              | `topic-match`   | `topic:{topicId}`     | 0.6    | Same topic extraction as Jira indexer  |
| Page explicitly links to Jira (Jira macro) | `documented-by` | `jira:{issueKey}`     | 1.0    | Jira issue macro in page content       |

### Core Functions

```typescript
/** Index a Confluence page as EntityNode + edges */
export async function indexConfluencePage(
  page: ConfluencePageInput,
  projectKey: string,
  executionId: string,
): Promise<void>;

/** Extract Jira issue keys mentioned in a Confluence page */
export function extractJiraReferences(pageContent: string): readonly string[];

/** Extract topic edges from page title + labels */
export function extractPageTopics(
  pageTitle: string,
  labels: readonly string[],
): readonly RelationshipEdge[];

/** Get all Confluence pages that document a given Jira issue (reverse lookup) */
export async function getDocumentingPages(
  issueKey: string,
  projectKey: string,
  executionId: string,
): Promise<readonly EntityNode[]>;

/** Build and persist denormalized neighborhood for a Confluence page */
export function buildConfluenceNeighborhood(
  pageId: string,
  projectKey: string,
  jiraRefs: readonly string[],
  topics: readonly string[],
): EntityNeighborhood;
```

### Node ID Convention

- Confluence page: `confluence:{pageId}` (e.g., `confluence:12345`)

### Staleness Detection

Each page node's `updatedAt` is compared with linked Jira issues' `updatedAt` during context assembly. If the page is significantly older than the ticket, the edge weight is reduced:

```
effectiveWeight = edge.weight * stalenessFactor(source.updatedAt, target.updatedAt)
```

Where `stalenessFactor` = 1.0 if both updated within 7 days, linearly decaying to 0.5 if the page is 30+ days older.

## Acceptance Criteria

- [ ] AC-01: `confluence-indexer.ts` implements `indexConfluencePage` with structured logging
- [ ] AC-02: Extracts `documented-by` edges from Jira issue keys in page body
- [ ] AC-03: Extracts `topic-match` edges from page title and labels
- [ ] AC-04: `getDocumentingPages` performs reverse lookup efficiently
- [ ] AC-05: Staleness factor applied to edge weights during context assembly
- [ ] AC-06: All operations are idempotent
- [ ] AC-07: Error handling never throws unhandled
- [ ] AC-08: Test coverage > 85%
- [ ] AC-09: `.reqs.md` sidecar created

## Triple Deliverable

| Production                                                      | Sidecar    | Test                                                                |
| --------------------------------------------------------------- | ---------- | ------------------------------------------------------------------- |
| `src/backend/services/relationship-index/confluence-indexer.ts` | `.reqs.md` | `tests/unit/services/relationship-index/confluence-indexer.spec.ts` |

## Risks

| Risk                                   | Mitigation                                      |
| -------------------------------------- | ----------------------------------------------- |
| Large pages with many issue references | Cap at 50 referenced issues per page            |
| Confluence API rate limits             | Batch indexing with configurable delay          |
| Page body parsing (macros, HTML)       | Strip HTML/macro markup before regex extraction |
