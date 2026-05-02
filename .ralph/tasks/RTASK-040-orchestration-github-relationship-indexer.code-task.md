---
id: RTASK-040
title: 'Orchestration — GitHub Relationship Indexer (Phase 3)'
status: pending
priority: 3
type: orchestration
dependencies: [RTASK-037, RTASK-038]
rulebook_refs: [ARCH-SOLID-006, FORGE-OPS-001, GH-INTEG-001]
---

# RTASK-040: Orchestration — GitHub Relationship Indexer (Phase 3)

## Objective

Build the GitHub relationship indexer that populates the Relationship Index with PR nodes and their edges to Jira issues and topics. This enables Rovo to detect scope misalignment between PRs and their linked issues using structural relationships rather than string matching.

## Context

RTASK-038 indexes Jira, RTASK-039 indexes Confluence. This task adds PRs as the third entity type, completing the cross-tool graph. After this, `handleCheckPRConsistency` can traverse PR → issue → epic → siblings to detect scope misalignment at a structural level, not just title similarity.

### Storage Strategy (LightRAG / Forge-optimized)

Writes to both adjacency list and **denormalized neighborhood** (from RTASK-037). The neighborhood enables O(1) context retrieval — a single Forge Storage read gives the full PR context including all linked Jira issues and topics. Graph stores pointers only; content fetched on demand.

### What This Enables

- "This PR implements PROJ-100 but PROJ-100's epic has 3 other stories about the same feature — are they coordinated?"
- "This PR touches authentication files but the linked issue is about caching — scope mismatch"
- "This PR references PROJ-100 and PROJ-101 but they belong to different epics — is this intentional?"

### Existing Components to Reuse

| Module              | Location                                                                      | What to Reuse                    |
| ------------------- | ----------------------------------------------------------------------------- | -------------------------------- |
| **Storage layer**   | `src/backend/services/relationship-index/relationship-storage.ts` (RTASK-037) | All CRUD operations              |
| **Domain types**    | `src/backend/types/relationship-index.ts` (RTASK-037)                         | `EntityNode`, `RelationshipEdge` |
| **GitHub adapter**  | `src/backend/services/github/github-adapter.ts`                               | `getPRData` — fetch PR details   |
| **Webhook handler** | `src/backend/resolvers/github-webhook.ts`                                     | Hook point for PR event indexing |
| **Jira indexer**    | `src/backend/services/relationship-index/jira-indexer.ts` (RTASK-038)         | Topic extraction pattern         |

## Technical Specification

### Location

- `src/backend/services/relationship-index/github-indexer.ts` (create)

### Edge Extraction Logic

| Source                             | Edge Type      | Target                | Weight | How Detected                             |
| ---------------------------------- | -------------- | --------------------- | ------ | ---------------------------------------- |
| PR title/body contains Jira key    | `implements`   | `jira:{issueKey}`     | 0.9    | Regex match `\[A-Z]+-\d+`                |
| PR branch name contains Jira key   | `implements`   | `jira:{issueKey}`     | 0.7    | Parse branch name pattern `PROJ-123-...` |
| PR labels match topic              | `topic-match`  | `topic:{topicId}`     | 0.6    | Same topic extraction as Jira indexer    |
| PR body references Confluence page | `mentioned-in` | `confluence:{pageId}` | 0.5    | URL pattern matching                     |

### Core Functions

```typescript
/** Index a GitHub PR as EntityNode + edges */
export async function indexPullRequest(
  pr: PRIndexInput,
  projectKey: string,
  executionId: string,
): Promise<void>;

/** Extract Jira issue keys from PR title, body, and branch name */
export function extractJiraKeysFromPR(
  prTitle: string,
  prBody: string,
  branchName: string,
): readonly string[];

/** Get all PRs that implement a given Jira issue (reverse lookup) */
export async function getImplementingPRs(
  issueKey: string,
  projectKey: string,
  executionId: string,
): Promise<readonly EntityNode[]>;

/** Build and persist denormalized neighborhood for a GitHub PR */
export function buildPRNeighborhood(
  pr: PRIndexInput,
  projectKey: string,
  jiraKeys: readonly string[],
  topics: readonly string[],
): EntityNeighborhood;
```

### Node ID Convention

- GitHub PR: `github:{owner}/{repo}/pull/{number}` (e.g., `github:org/repo/pull/42`)

### Metadata

The PR node's `metadata` field stores:

- `state`: open/closed/merged
- `branch`: head branch name
- `baseBranch`: target branch name
- `fileCount`: number of files changed
- `additions`/`deletions`: line counts
- `author`: GitHub login (not a person node — just metadata for now)

### Integration Point

The existing `webhook-handler.ts` fires when GitHub sends PR events. Add lazy hydration:

```typescript
// In webhook handler, after processing PR:
void indexPullRequest(buildPRIndexInput(prData), projectKey, executionId).catch(() => {});
```

## Acceptance Criteria

- [ ] AC-01: `github-indexer.ts` implements `indexPullRequest` with structured logging
- [ ] AC-02: Extracts `implements` edges from PR title, body, and branch name
- [ ] AC-03: Extracts `topic-match` edges from PR labels
- [ ] AC-04: `getImplementingPRs` performs reverse lookup efficiently
- [ ] AC-05: All operations are idempotent
- [ ] AC-06: Test coverage > 85%
- [ ] AC-07: `.reqs.md` sidecar created

## Triple Deliverable

| Production                                                  | Sidecar    | Test                                                            |
| ----------------------------------------------------------- | ---------- | --------------------------------------------------------------- |
| `src/backend/services/relationship-index/github-indexer.ts` | `.reqs.md` | `tests/unit/services/relationship-index/github-indexer.spec.ts` |

## Risks

| Risk                                        | Mitigation                                               |
| ------------------------------------------- | -------------------------------------------------------- |
| GitHub webhook may not include full PR data | Lazy fetch via `getPRData` if data incomplete            |
| PR body may reference many issues           | Cap at 10 `implements` edges per PR                      |
| Branch name parsing fragile                 | Use multiple patterns: `PROJ-123`, `PROJ_123`, `proj123` |
