---
id: RTASK-042
title: 'Infrastructure — Jira Adapter Extensions: Epic Links, Issue Links, JQL Search'
status: pending
priority: 2
type: infrastructure
dependencies: [RTASK-009]
rulebook_refs: [ARCH-SOLID-006, JIRA-INTEG-001, FORGE-OPS-001]
---

# RTASK-042: Infrastructure — Jira Adapter Extensions

## Objective

Extend the Jira domain types and adapter to support epic hierarchy, issue links, and JQL search — prerequisite capabilities for the Relationship Index indexers (RTASK-038) and the consumer (RTASK-041).

## Context

The current `JiraTicketData` type and `jira-adapter` lack fields needed for relationship-aware evaluation:

- **No `epicKey`**: RTASK-038 cannot build `parent-of` edges without knowing which epic a story belongs to
- **No `issueLinks`**: RTASK-038 cannot build `related-to` edges (blocks, depends on, relates to)
- **No `searchByJQL`**: RTASK-038's `bootstrapProjectIndex` has no way to fetch all issues in a project
- **No `getEpicChildren`**: RTASK-041's sibling detection needs to fetch all children of an epic

These gaps mean the Jira indexer would need to make N+1 API calls per issue (one for the issue, one for links, one for epic link) — inefficient and error-prone.

### Current State

```typescript
// src/backend/types/jira-data.ts — current
export interface JiraTicketData {
  readonly key: string;
  readonly summary: string;
  readonly description: string;
  readonly status: string;
  readonly assignee?: string;
  readonly reporter?: string;
  readonly priority?: string;
  readonly issueType: string;
  readonly labels: readonly string[];
  readonly projectKey: string;
  readonly created: string;
  readonly updated: string;
}
```

### What's Missing

| Field/Function                   | Where Needed                                                          | Impact of Absence                                   |
| -------------------------------- | --------------------------------------------------------------------- | --------------------------------------------------- |
| `epicKey` on `JiraTicketData`    | RTASK-038 (parent-of edges), RTASK-041 (sibling detection)            | Cannot detect epic hierarchy                        |
| `issueLinks` on `JiraTicketData` | RTASK-038 (related-to edges), RTASK-041 (cross-ticket contradictions) | Cannot detect dependencies or linked contradictions |
| `searchByJQL(projectKey)`        | RTASK-038 (`bootstrapProjectIndex`)                                   | Cannot bulk-index a project                         |
| `getEpicChildren(epicKey)`       | RTASK-041 (fetch siblings for comparison)                             | Cannot compare stories within an epic               |

### Existing Components to Modify

| Module           | Location                                    | What Changes                                                                     |
| ---------------- | ------------------------------------------- | -------------------------------------------------------------------------------- |
| **Jira types**   | `src/backend/types/jira-data.ts`            | Add `epicKey`, `issueLinks` fields + `JiraIssueLink` type                        |
| **Jira adapter** | `src/backend/services/jira/jira-adapter.ts` | Extend `getTicketData` to fetch new fields, add `searchByJQL`, `getEpicChildren` |

## Technical Specification

### Step 1: Extend Jira Types

**File**: `src/backend/types/jira-data.ts`

```typescript
/** Represents a Jira issue link (directional relationship between two issues) */
export interface JiraIssueLink {
  readonly type: string; // "Blocks", "Depends on", "Relates to", "Clones", etc.
  readonly direction: 'inward' | 'outward';
  readonly targetKey: string; // The key of the linked issue
  readonly targetSummary: string; // Summary of the linked issue (for context)
  readonly targetStatus: string; // Status of the linked issue
}

/** Extended Jira ticket data with relationship fields */
export interface JiraTicketData {
  readonly key: string;
  readonly summary: string;
  readonly description: string;
  readonly status: string;
  readonly assignee?: string;
  readonly reporter?: string;
  readonly priority?: string;
  readonly issueType: string;
  readonly labels: readonly string[];
  readonly projectKey: string;
  readonly created: string;
  readonly updated: string;

  // NEW — Relationship fields (optional for backward compatibility)
  readonly epicKey?: string; // Parent epic key (e.g., "PROJ-100")
  readonly epicSummary?: string; // Epic summary (for context)
  readonly issueLinks?: readonly JiraIssueLink[];
  readonly fixVersions?: readonly string[]; // Fix versions (for release tracking)
}
```

**Design decision**: All new fields are optional to maintain backward compatibility. Existing callers that don't pass these fields continue to work unchanged.

### Step 2: Extend Jira Adapter

**File**: `src/backend/services/jira/jira-adapter.ts`

#### 2a: Extend `getTicketData` to fetch relationship fields

The Jira REST API returns `issuelinks` and the epic link custom field (typically `customfield_10014` in Jira Cloud) as part of the issue response. Extend the field list:

```typescript
// In getTicketData, extend the fields parameter:
const fields = [
  'summary',
  'description',
  'status',
  'assignee',
  'reporter',
  'priority',
  'issuetype',
  'labels',
  'project',
  'created',
  'updated',
  // NEW:
  'issuelinks',
  'fixVersions',
  'customfield_10014', // Epic Link (Jira Cloud standard)
  'customfield_10010', // Epic Name (for epic summary lookup)
].join(',');
```

Map the response to include the new fields:

```typescript
const epicKey: string | undefined = fieldsMap['customfield_10014'] ?? undefined;
const issueLinks: JiraIssueLink[] = (fieldsMap['issuelinks'] ?? []).map(mapIssueLink);
```

#### 2b: Add `searchByJQL` function

```typescript
/**
 * Search for Jira issues using JQL.
 * Used by RTASK-038 for project bootstrap and resync.
 *
 * @param jql - JQL query string
 * @param maxResults - Maximum results to return (default 50, max 100)
 * @param executionId - Execution ID for logging
 * @returns Array of JiraTicketData matching the query
 */
export async function searchByJQL(
  jql: string,
  maxResults?: number,
  executionId?: string,
): Promise<readonly JiraTicketData[]>;
```

#### 2c: Add `getEpicChildren` function

```typescript
/**
 * Fetch all issues that belong to a given epic.
 * Uses JQL: "parent = {epicKey}" or "epicLink = {epicKey}" depending on Jira version.
 *
 * @param epicKey - The epic issue key (e.g., "PROJ-100")
 * @param executionId - Execution ID for logging
 * @returns Array of child JiraTicketData
 */
export async function getEpicChildren(
  epicKey: string,
  executionId?: string,
): Promise<readonly JiraTicketData[]>;
```

**Jira Cloud epic link behavior**: In Jira Cloud, epic children can be queried via:

- Classic: `"Epic Link" = {epicKey}` (customfield_10014)
- New: `parent = {epicKey}` (hierarchy-based)
  The adapter should try the new format first, falling back to the classic format.

### Step 3: Backward Compatibility

All changes must be backward-compatible:

1. **Type extension**: New fields are optional on `JiraTicketData`
2. **Adapter extension**: `getTicketData` still works if epic link or issue links are not available (graceful `undefined`)
3. **New functions**: `searchByJQL` and `getEpicChildren` are additive — no existing code calls them
4. **Test updates**: Existing tests must pass without modification. New tests cover the new fields/functions.

### Step 4: Custom Field Discovery

Epic link custom field IDs vary across Jira instances. Implement a discovery mechanism:

```typescript
/**
 * Discover the epic link custom field ID for the current Jira instance.
 * Caches result for the session.
 */
async function discoverEpicLinkField(): Promise<string>;
```

This calls `/rest/api/3/field` and searches for a field with name "Epic Link" or schema type `gh-epic-link`. Falls back to `customfield_10014` if discovery fails.

## Acceptance Criteria

- [ ] AC-01: `JiraIssueLink` type defined in `jira-data.ts` with type, direction, targetKey, targetSummary, targetStatus
- [ ] AC-02: `JiraTicketData` extended with optional `epicKey`, `epicSummary`, `issueLinks`, `fixVersions`
- [ ] AC-03: `getTicketData` fetches epic link and issue links when available
- [ ] AC-04: `searchByJQL` executes JQL queries and returns typed results
- [ ] AC-05: `getEpicChildren` fetches all children of an epic
- [ ] AC-06: Epic link custom field discovery with fallback
- [ ] AC-07: All new fields are optional — existing callers unaffected
- [ ] AC-08: All existing tests pass unchanged
- [ ] AC-09: New test coverage > 85%
- [ ] AC-10: `.reqs.md` sidecars updated
- [ ] AC-11: `pnpm typecheck` passes

## QA Gates

### Pre-Implementation

- [ ] **GATE-REVIEW**: Read current `getTicketData` implementation to understand field mapping
- [ ] **GATE-COMPAT**: Identify all callers of `JiraTicketData` — verify optional fields won't break them

### Implementation

- [ ] **GATE-BACKWARD**: Existing tests pass without modification
- [ ] **GATE-GRACEFUL**: Missing epic link or issue links return `undefined`, never throw
- [ ] **GATE-TYPES**: No `any` types

### Post-Implementation

- [ ] **GATE-TYPECHECK**: `pnpm typecheck` passes
- [ ] **GATE-LINT**: `pnpm lint` passes
- [ ] **GATE-TEST**: `pnpm test:unit` passes (existing + new tests)

## Implementation Protocol

### Step 1: Types (non-breaking)

1. Add `JiraIssueLink` interface to `jira-data.ts`
2. Add optional fields to `JiraTicketData`
3. Run typecheck — verify existing callers compile

### Step 2: Adapter Extensions

1. Extend `getTicketData` field list and response mapping
2. Add epic link field discovery function
3. Implement `searchByJQL`
4. Implement `getEpicChildren`

### Step 3: Tests

1. Write tests for new type fields
2. Write tests for `searchByJQL` with various JQL queries
3. Write tests for `getEpicChildren` with epic/empty/invalid epic keys
4. Write tests for epic link field discovery (success + fallback)
5. Run full test suite — verify no regressions

### Step 4: Validation

1. `pnpm typecheck`
2. `pnpm lint`
3. `pnpm test:unit`
4. Update `.reqs.md` sidecars

## Triple Deliverable

| Production                                             | Sidecar            | Test                                                       |
| ------------------------------------------------------ | ------------------ | ---------------------------------------------------------- |
| `src/backend/types/jira-data.ts` (modified)            | updated `.reqs.md` | `tests/unit/types/jira-data.spec.ts` (extended)            |
| `src/backend/services/jira/jira-adapter.ts` (modified) | updated `.reqs.md` | `tests/unit/services/jira/jira-adapter.spec.ts` (extended) |

## Risks

| Risk                                                              | Mitigation                                                           |
| ----------------------------------------------------------------- | -------------------------------------------------------------------- |
| Epic link custom field ID varies across instances                 | Discovery mechanism with fallback to `customfield_10014`             |
| Issue links API returns different formats in Jira Cloud vs Server | Normalize in adapter — only expose typed `JiraIssueLink[]`           |
| JQL search timeout on large projects                              | Cap `maxResults` at 100, paginate in caller                          |
| New fields break existing callers                                 | All new fields optional; typecheck validates all callers             |
| Forge function timeout during bootstrap                           | `searchByJQL` paginated; `bootstrapProjectIndex` calls it in batches |
