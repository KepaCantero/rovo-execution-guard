---
id: RTASK-043
title: 'Orchestration — Rovo Agent Prompt Templates with Relationship Context'
status: pending
priority: 3
type: orchestration
dependencies: [RTASK-033, RTASK-041]
rulebook_refs: [ROVO-INTEG-001, ROVO-INTEG-009, ARCH-SOLID-006]
---

# RTASK-043: Orchestration — Rovo Agent Prompt Templates with Relationship Context

## Objective

Create relationship-aware prompt templates for the Rovo Consistency Guard agent so that when Rovo reasons about a ticket, it receives structured context about siblings, documentation, PRs, and topic clusters — enabling higher-quality decisions than keyword-based analysis alone.

## Context

RTASK-033 defines the Consistency Guard agent with a single prompt file (`consistency-guard.txt`). The agent's 5 actions (`evaluate-issue`, `check-pr-consistency`, `validate-spec-alignment`, `explain-score`, `get-improvement-tips`) currently return structured JSON based on single-ticket text analysis.

RTASK-041 wires the Relationship Context into the action handlers, but the agent's prompt template doesn't instruct it on how to use relationship data. This task creates:

1. **Action-specific prompt templates** that inject relationship context into Rovo's reasoning
2. **Context formatting utilities** that translate `RelationshipContext` into LLM-friendly text
3. **Updated agent prompt** that teaches the agent to reason over structural relationships
4. **ACE-style evolving prompt snippets** that adapt based on past decision outcomes — the agent's instructions improve over time as it learns which patterns lead to overridden vs. confirmed decisions

### Why This Matters

The Rovo Agent receives a prompt and context before generating its response. Without relationship-aware prompts:

- The agent can't reason about sibling contradictions ("This story says Redis but its sibling says Memcached")
- It can't assess spec alignment structurally ("This Confluence page documents this feature and was updated yesterday")
- It can't detect scope creep ("This PR touches 20 files but the story is about a single component")

The `RelationshipContext.rankedItems` field is explicitly designed for LLM consumption — this task connects it.

### Existing Components to Modify

| Module                   | Location                                                        | What Changes                                 |
| ------------------------ | --------------------------------------------------------------- | -------------------------------------------- |
| **Agent prompt**         | `src/backend/services/rovo/agent-prompts/consistency-guard.txt` | Rewrite with relationship-aware instructions |
| **Agent action handler** | `src/backend/resolvers/agent-action.ts`                         | Inject formatted context into responses      |

### New Components

| Module                | Location                                                       | Purpose                                                       |
| --------------------- | -------------------------------------------------------------- | ------------------------------------------------------------- |
| **Context formatter** | `src/backend/services/relationship-index/context-formatter.ts` | Translate `RelationshipContext` into prompt-ready text blocks |
| **Action prompts**    | `src/backend/services/rovo/agent-prompts/` (new files)         | Per-action prompt templates                                   |

## Technical Specification

### Step 1: Context Formatter

**File**: `src/backend/services/relationship-index/context-formatter.ts`

This module takes a `RelationshipContext` and produces structured text blocks suitable for injection into Rovo agent prompts.

```typescript
import type {
  RelationshipContext,
  EntityNode,
  TopicCluster,
  CrossReference,
} from '../../types/relationship-index';

/** Format the full relationship context as a prompt section */
export function formatRelationshipContext(context: RelationshipContext): string;

/** Format sibling tickets section */
export function formatSiblings(siblings: readonly EntityNode[]): string;

/** Format documentation section */
export function formatDocumentation(docs: readonly EntityNode[]): string;

/** Format PR associations section */
export function formatPullRequests(prs: readonly EntityNode[]): string;

/** Format topic clusters section */
export function formatTopics(topics: readonly TopicCluster[]): string;

/** Format cross-references section */
export function formatCrossReferences(refs: readonly CrossReference[]): string;

// Types from RTASK-037, RTASK-041
type ContextBudget = { readonly maxTokens: number; readonly reservedForPrompt: number };
type CausalPath = { readonly steps: readonly string[]; readonly weight: number };
type DecisionRecord = { readonly id: string; readonly outcome: string; readonly timestamp: string };

/** Build action-specific context injection with token budget */
export function buildActionContext(
  actionKey: string,
  context: RelationshipContext,
  budget?: ContextBudget,
): string;

/** Build context from assembled paths (PathRAG-style) instead of raw dump */
export function buildPathContext(
  paths: readonly CausalPath[],
  facts: readonly string[],
  decisions: readonly DecisionRecord[],
  budget: ContextBudget,
): string;

/** Generate evolving prompt snippet based on decision patterns */
export function buildEvolvingPrompt(
  overridePatterns: readonly { readonly contextSignature: string; readonly overrideRate: number }[],
): string;
```

#### Output Format

The formatter produces markdown-like sections:

```
## Relationship Context

### Epic & Siblings
This ticket belongs to epic PROJ-100 ("Authentication Refactor").
Siblings in the same epic:
- PROJ-101: "Migrate login to OAuth2" (In Progress)
- PROJ-102: "Add session timeout config" (Done)
- PROJ-103: "Update auth middleware" (To Do)

### Documentation
Linked Confluence pages:
- "Authentication Architecture" (updated 2026-04-28, relevance: 0.92) — SPEC
- "Migration Runbook" (updated 2026-04-15, relevance: 0.75) — REFERENCE

### Pull Requests
- PR #42: "feat: add OAuth2 login" (open, 12 files, owner/repo) — IMPLEMENTS this ticket

### Topic Clusters
- authentication (strength: 0.85, 4 entities)
- oauth-migration (strength: 0.72, 3 entities)
```

### Step 2: Action-Specific Prompt Templates

Create separate prompt templates for each action that benefits from relationship context.

**File**: `src/backend/services/rovo/agent-prompts/evaluate-issue.txt`

```
You are the Consistency Guard evaluating a Jira ticket for quality.

## Your Task
Analyze this ticket for consistency, clarity, and completeness.

## Ticket Data
{ticketJson}

## Relationship Context (curated, {tokenCount} tokens)

{builtContext.factsAtStart}

{builtContext.evidenceInMiddle}

{builtContext.questionAtEnd}

{evolvingPrompt}

## Analysis Instructions

When evaluating consistency, consider:
1. **Sibling alignment**: Does this ticket overlap or contradict its sibling stories in the same epic?
2. **Documentation alignment**: Do the linked Confluence specs match the ticket's description? Is the documentation fresh?
3. **PR alignment**: If there are associated PRs, do their changes align with the ticket's scope?
4. **Topic coverage**: Does this ticket fit within its topic clusters, or does it drift?

Prioritize structural evidence over keyword matching. A sibling contradiction is more significant than a single ambiguous word.

Respond with structured JSON:
{
  "overallScore": number,
  "axes": { "clarity": number, "consistency": number, "risk": number, "documentation": number, "technicalDebt": number },
  "inconsistencies": [...],
  "relationshipInsights": [string]
}
```

**File**: `src/backend/services/rovo/agent-prompts/check-pr-consistency.txt`

```
You are checking whether a GitHub PR aligns with its linked Jira issue.

## PR Data
{prJson}

## Issue Data
{ticketJson}

## Relationship Context (curated, {tokenCount} tokens)

{builtContext.factsAtStart}

{builtContext.evidenceInMiddle}

{builtContext.questionAtEnd}

{evolvingPrompt}

## Analysis Instructions

Use structural relationships for alignment assessment:
1. **Scope alignment**: Do the PR's changed files belong to the components covered by this ticket's topic cluster?
2. **Epic coherence**: Does this PR's scope align with the epic's overall direction, or does it introduce unrelated changes?
3. **Sibling coordination**: Are there other PRs implementing sibling stories? Are they coordinated?
4. **Documentation verification**: Do the linked specs support the PR's changes?

Do NOT rely solely on whether the issue key appears in the PR title — use the graph's `implements` edges for structural verification.

Respond with structured JSON:
{
  "alignment": "aligned" | "partial" | "misaligned",
  "gaps": [string],
  "relationshipInsights": [string]
}
```

**File**: `src/backend/services/rovo/agent-prompts/validate-spec-alignment.txt`

```
You are validating alignment between a Jira ticket and its Confluence documentation.

## Ticket Data
{ticketJson}

## Documentation
{documentationJson}

## Relationship Context (curated, {tokenCount} tokens)

{builtContext.factsAtStart}

{builtContext.evidenceInMiddle}

{builtContext.questionAtEnd}

{evolvingPrompt}

## Analysis Instructions

Use structural relationships instead of keyword search:
1. **Direct documentation**: Does a `documented-by` edge exist from this ticket to a Confluence page? This is stronger than keyword match.
2. **Staleness**: Compare the documentation's last update with the ticket's last update. Flag drift > 30 days.
3. **Coverage gaps**: Does the ticket's epic have a spec page? Do all sibling stories reference it?
4. **Orphaned specs**: Are there Confluence pages that document related topics but aren't linked to any ticket in the epic?

Respond with structured JSON:
{
  "alignedSpecs": [...],
  "misalignedSpecs": [...],
  "suggestions": [string],
  "relationshipInsights": [string]
}
```

### Step 3: Update Agent Action Handler

In `src/backend/resolvers/agent-action.ts`, modify the handlers to inject formatted context:

```typescript
import {
  formatRelationshipContext,
  buildActionContext,
} from '../services/relationship-index/context-formatter.js';

// In handleEvaluateIssue, after fetching relationship context:
const formattedContext = relationshipContext ? formatRelationshipContext(relationshipContext) : '';

// Include in response:
return actionSuccess(
  {
    ...existingData,
    relationshipInsights: relationshipContext ? extractInsights(relationshipContext) : undefined,
  },
  executionId,
);
```

### Step 4: Update Main Agent Prompt

**File**: `src/backend/services/rovo/agent-prompts/consistency-guard.txt`

Add a section teaching the agent about relationship context:

```
## Relationship Awareness

You have access to structural relationship data from the project's Knowledge Graph. This includes:

- **Epic hierarchy**: Parent epic and sibling stories
- **Documentation links**: Confluence pages that document this ticket's feature
- **PR associations**: Pull requests that implement this ticket
- **Topic clusters**: Groups of related entities across tools
- **Cross-references**: Bidirectional links found across Jira, Confluence, and GitHub

When relationship context is provided:
- Prefer structural evidence (graph edges) over keyword matching
- Flag contradictions between siblings as high-priority
- Consider documentation freshness (staleness) in your assessment
- Use topic clusters to verify scope alignment

When relationship context is NOT provided:
- Fall back to single-ticket text analysis
- Do not mention or reference relationship data
- Provide your best assessment with available data
```

## Acceptance Criteria

- [ ] AC-01: `context-formatter.ts` implements all format functions
- [ ] AC-02: `formatRelationshipContext` produces clear, LLM-friendly text
- [ ] AC-03: `buildActionContext` customizes context per action type
- [ ] AC-04: `evaluate-issue.txt` prompt template created with relationship instructions
- [ ] AC-05: `check-pr-consistency.txt` prompt template created with structural alignment instructions
- [ ] AC-06: `validate-spec-alignment.txt` prompt template created with staleness and coverage instructions
- [ ] AC-07: Main `consistency-guard.txt` updated with relationship awareness section
- [ ] AC-08: Agent action handler injects formatted context into responses
- [ ] AC-09: Graceful degradation when no relationship context available
- [ ] AC-10: Test coverage > 85% for formatter
- [ ] AC-11: `.reqs.md` sidecars created/updated
- [ ] AC-12: `buildPathContext` uses PathRAG-style causal paths instead of raw node dumps
- [ ] AC-13: `buildEvolvingPrompt` generates adaptive instructions from override patterns
- [ ] AC-14: Formatted context respects token budget (under 2,500 tokens)
- [ ] AC-15: Context uses positional optimization (facts at edges per "lost in the middle" research)

## QA Gates

### Pre-Implementation

- [ ] **GATE-READY**: RTASK-041 completed (relationship context consumer)
- [ ] **GATE-REVIEW**: Read current `consistency-guard.txt` prompt

### Implementation

- [ ] **GATE-DEGRADATION**: Agent works correctly with and without relationship context
- [ ] **GATE-FORMAT**: Formatted context is clear, concise, and under 2000 tokens
- [ ] **GATE-TYPES**: No `any` types

### Post-Implementation

- [ ] **GATE-TYPECHECK**: `pnpm typecheck` passes
- [ ] **GATE-LINT**: `pnpm lint` passes
- [ ] **GATE-TEST**: `pnpm test:unit` passes

## Implementation Protocol

### Step 1: Context Formatter

1. Create `context-formatter.ts`
2. Implement all format functions
3. Write tests with sample `RelationshipContext` objects
4. Verify output is under 2000 tokens for typical context

### Step 2: Prompt Templates

1. Create `evaluate-issue.txt`
2. Create `check-pr-consistency.txt`
3. Create `validate-spec-alignment.txt`
4. Update `consistency-guard.txt`

### Step 3: Handler Integration

1. Import formatter in `agent-action.ts`
2. Inject formatted context into `handleEvaluateIssue`
3. Inject formatted context into `handleCheckPRConsistency`
4. Inject formatted context into `handleValidateSpecAlignment`
5. Verify graceful degradation

### Step 4: Validation

1. `pnpm typecheck`
2. `pnpm lint`
3. `pnpm test:unit`
4. Verify agent responses with and without relationship context

## Triple Deliverable

| Production                                                                  | Sidecar            | Test                                                               |
| --------------------------------------------------------------------------- | ------------------ | ------------------------------------------------------------------ |
| `src/backend/services/relationship-index/context-formatter.ts` (new)        | `.reqs.md`         | `tests/unit/services/relationship-index/context-formatter.spec.ts` |
| `src/backend/services/rovo/agent-prompts/evaluate-issue.txt` (new)          | -                  | -                                                                  |
| `src/backend/services/rovo/agent-prompts/check-pr-consistency.txt` (new)    | -                  | -                                                                  |
| `src/backend/services/rovo/agent-prompts/validate-spec-alignment.txt` (new) | -                  | -                                                                  |
| `src/backend/services/rovo/agent-prompts/consistency-guard.txt` (modified)  | -                  | -                                                                  |
| `src/backend/resolvers/agent-action.ts` (modified)                          | updated `.reqs.md` | `tests/unit/resolvers/agent-action.spec.ts` (extended)             |

## Risks

| Risk                                          | Mitigation                                                                  |
| --------------------------------------------- | --------------------------------------------------------------------------- |
| Prompt too long for Rovo context window       | Cap formatted context at 1500 tokens; prioritize `rankedItems` by relevance |
| Agent ignores relationship context            | Explicit instructions in prompt to prefer structural evidence               |
| Context formatting adds latency               | Formatter is pure string operations — negligible overhead                   |
| Breaking existing agent behavior              | Relationship context is optional; agent falls back gracefully               |
| Evolving prompt drifts from original intent   | Cap evolving additions to 200 tokens; never override core instructions      |
| Token budget exceeded by relationship context | Prioritize facts > paths > decisions; drop lowest-signal items first        |
