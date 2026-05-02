---
id: RTASK-041
title: 'Orchestration — Relationship Context Consumer: Wire Graph into Scoring & Detection'
status: pending
priority: 2
type: orchestration
dependencies: [RTASK-037, RTASK-038, RTASK-039, RTASK-040, RTASK-042]
rulebook_refs: [ARCH-SOLID-006, ARCH-SOLID-049-01, FORGE-OPS-001, JIRA-INTEG-001]
---

# RTASK-041: Orchestration — Relationship Context Consumer

## Objective

Wire the Relationship Index into the existing scoring, inconsistency detection, and agent action handlers so that Rovo's decisions are informed by structural relationships across Jira, Confluence, and GitHub — not just single-ticket text analysis.

## Context

RTASK-037..040 build the Relationship Index (types, storage, 3 indexers). But currently no code **consumes** the graph. This task closes that gap by:

1. Enhancing `detectInconsistencies` with cross-entity awareness (siblings contradict, docs drift, PR scope mismatch)
2. Enhancing `scoreConsistency` and `scoreDocumentation` with relationship signals
3. Injecting `RelationshipContext` into the evaluation pipeline and agent action handlers
4. Adding new relationship-aware inconsistency types

This task also introduces the **Context Builder** — a JIT assembly pipeline (inspired by PathRAG's path-centric prompting) that:

- Extracts causal paths from the graph (not raw node dumps)
- Ranks items by signal strength (weight × recency × relevance)
- Prunes to a strict token budget (1,500-2,500 tokens)
- Places most important information at START and END of context (counteracts "lost in the middle")

And the **Operational Memory Consumer** that:

- Queries past decisions for similar contexts before scoring
- Adjusts thresholds based on override patterns
- Prevents the system from repeating enforcement mistakes

### What Changes Without This Task

The graph gets populated but Rovo still evaluates tickets in isolation. Siblings in the same epic could contradict each other, specs could drift from tickets, and PRs could diverge from their linked issues — all without detection.

### What This Enables After

- "This story says 'use Redis cache' but its sibling PROJ-102 says 'use Memcached' — contradiction within the same epic"
- "This ticket references CONFL-999 but that page was last updated 6 months ago, and the ticket changed 3 times since"
- "PR #42 implements PROJ-100 but also touches files unrelated to any ticket in the epic — scope creep signal"
- "This epic has 5 stories but no Confluence spec — documentation gap at epic level"

### Existing Components to Modify

| Module                     | Location                                                                      | What Changes                                                                                                |
| -------------------------- | ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| **Inconsistency types**    | `src/backend/types/inconsistency.ts`                                          | Add `InconsistencyType` values: `sibling_contradiction`, `spec_drift`, `scope_mismatch`, `orphan_reference` |
| **Inconsistency detector** | `src/backend/services/scoring/inconsistency-detector.ts`                      | Accept optional `RelationshipContext`, add 4 new detector functions                                         |
| **Scoring engine**         | `src/backend/services/scoring/scoring-engine.ts`                              | `ScoringInput` gains optional `relationshipContext`, `scoreConsistency` and `scoreDocumentation` use it     |
| **Evaluation pipeline**    | `src/backend/services/evaluation/evaluation-pipeline.ts`                      | `runPipeline` fetches `RelationshipContext` between ticket fetch and detection                              |
| **Agent action handler**   | `src/backend/resolvers/agent-action.ts`                                       | `handleEvaluateIssue`, `handleCheckPRConsistency`, `handleValidateSpecAlignment` fetch relationship context |
| **Storage adapter**        | `src/backend/services/relationship-index/relationship-storage.ts` (RTASK-037) | Consumed via `buildRelationshipContext()`                                                                   |

### New Components

| Module                    | Location                                                           | Purpose                                                                                       |
| ------------------------- | ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| **Relationship consumer** | `src/backend/services/relationship-index/relationship-consumer.ts` | Translate `RelationshipContext` into scoring signals and inconsistency inputs                 |
| **Context builder**       | `src/backend/services/relationship-index/context-builder.ts`       | JIT context assembly: path extraction, ranking, token budget pruning, positional optimization |
| **Decision consumer**     | `src/backend/services/relationship-index/decision-consumer.ts`     | Query past decisions, detect override patterns, suggest threshold adjustments                 |

## Technical Specification

### Step 1: Extend Inconsistency Types

In `src/backend/types/inconsistency.ts`, add to `InconsistencyType`:

```typescript
export type InconsistencyType =
  | 'contradiction'
  | 'duplicate'
  | 'missing_context'
  | 'ambiguity'
  | 'sibling_contradiction' // NEW: contradicts sibling in same epic
  | 'spec_drift' // NEW: linked doc is stale
  | 'scope_mismatch' // NEW: PR scope diverges from issue
  | 'orphan_reference'; // NEW: references unlinked entity
```

### Step 1.5: Context Builder (New File)

**Location**: `src/backend/services/relationship-index/context-builder.ts`

This module implements JIT context assembly inspired by PathRAG's path-centric prompting. Instead of dumping raw graph data, it:

1. Extracts causal paths from the neighborhood (e.g., "PROJ-123 → referenced_by → PR#789 → CI failing")
2. Ranks paths by signal strength (weight × recency × relevance)
3. Prunes to the `ContextBudget` from RTASK-037 (default 2,500 tokens)
4. Places verified facts at START and END of context (counteracts "lost in the middle")

```typescript
import type {
  RelationshipContext,
  EntityNeighborhood,
  ContextBudget,
  DecisionRecord,
} from '../../types/relationship-index';

/** A causal path extracted from the graph — the unit of context */
export interface CausalPath {
  readonly steps: readonly string[]; // e.g., ["jira:PROJ-123", "implements", "github:org/repo/pull/42"]
  readonly signalScore: number; // weight × recency × relevance
  readonly pathType: 'contradiction' | 'alignment' | 'gap' | 'drift' | 'neutral';
  readonly summary: string; // Human-readable: "PR #42 implements this ticket (merged, CI passing)"
}

/** Result of context building */
export interface BuiltContext {
  readonly paths: readonly CausalPath[];
  readonly factsAtStart: readonly string[]; // High-confidence facts (position: START)
  readonly evidenceInMiddle: readonly string[]; // Supporting evidence (position: MIDDLE)
  readonly questionAtEnd: readonly string[]; // Decision points (position: END)
  readonly totalTokens: number;
  readonly budget: ContextBudget;
}

/** Extract causal paths from neighborhood */
export function extractCausalPaths(
  neighborhood: EntityNeighborhood,
  context: RelationshipContext,
): readonly CausalPath[];

/** Rank paths by signal strength */
export function rankPaths(
  paths: readonly CausalPath[],
  budget: ContextBudget,
): readonly CausalPath[];

/** Assemble context with positional optimization (facts at edges) */
export function assembleContext(
  rankedPaths: readonly CausalPath[],
  primaryEntity: { readonly key: string; readonly summary: string; readonly status: string },
  recentDecisions: readonly DecisionRecord[],
  budget: ContextBudget,
): BuiltContext;

/** Estimate token count for a string (rough: 1 token ≈ 4 chars) */
export function estimateTokens(text: string): number;
```

#### Path Extraction Logic

| Path Pattern                                | pathType        | Signal Weight |
| ------------------------------------------- | --------------- | ------------- |
| Issue → sibling contradicts                 | `contradiction` | High (0.9)    |
| Issue → implements → PR merged + CI passing | `alignment`     | High (0.85)   |
| Issue → documented-by → page stale (>30d)   | `drift`         | Medium (0.7)  |
| Issue → topic → no documentation            | `gap`           | Medium (0.65) |
| Issue → related-to → similar issue          | `neutral`       | Low (0.3)     |

#### Positional Assembly

Following "lost in the middle" research:

- **START position**: System instructions + verified facts (high signal paths + recent confirmed decisions)
- **MIDDLE position**: Supporting evidence (alignment paths, neutral paths, raw data)
- **END position**: The actual question + past overridden decisions + threshold suggestion

### Step 1.6: Decision Consumer (New File)

**Location**: `src/backend/services/relationship-index/decision-consumer.ts`

This module queries operational memory before making enforcement decisions:

```typescript
import type { DecisionRecord } from '../../types/relationship-index';

/** Result of decision pattern analysis */
export interface DecisionPattern {
  readonly similarPastDecisions: readonly DecisionRecord[];
  readonly overrideRate: number; // 0-1, fraction of similar decisions that were overridden
  readonly suggestedAction: 'proceed' | 'soften' | 'escalate';
  readonly reason: string;
}

/** Analyze past decisions for a similar context */
export function analyzeDecisionPatterns(
  decisions: readonly DecisionRecord[],
  currentScore: number,
  currentAction: 'block' | 'approve' | 'comment',
): DecisionPattern;

/** Compute a context signature for similarity matching */
export function computeContextSignature(
  issueKey: string,
  score: number,
  gateType: string,
  inconsistencyCount: number,
): string;
```

#### Pattern Analysis Logic

- If >3 past `block` decisions for similar context were overridden → suggest `comment` instead of `block`
- If past `approve` decisions for similar context were never disputed → confidence boost
- If override rate > 50% for a context pattern → flag as "potential false positive pattern"

### Step 2: Create Relationship Consumer

**Location**: `src/backend/services/relationship-index/relationship-consumer.ts`

This module translates raw graph data into structured inputs for the existing scoring and detection modules.

```typescript
import type {
  RelationshipContext,
  EntityNode,
  CrossReference,
} from '../../types/relationship-index';
import type { Inconsistency } from '../../types/inconsistency';

/** Extract sibling contradictions from relationship context */
export function detectSiblingContradictions(
  ticketSummary: string,
  ticketDescription: string,
  siblings: readonly EntityNode[],
  ticketKey: string,
): readonly Inconsistency[];

/** Detect spec drift by comparing ticket and doc update timestamps */
export function detectSpecDrift(
  documentation: readonly EntityNode[],
  ticketUpdatedAt: string,
  ticketKey: string,
): readonly Inconsistency[];

/** Detect PR scope mismatch */
export function detectScopeMismatch(
  pullRequests: readonly EntityNode[],
  ticketKey: string,
  ticketSummary: string,
): readonly Inconsistency[];

/** Detect orphan references (ticket mentions entity not in graph) */
export function detectOrphanReferences(
  crossReferences: readonly CrossReference[],
  ticketKey: string,
): readonly Inconsistency[];

/** Run all relationship-aware detectors */
export function detectRelationshipInconsistencies(
  context: RelationshipContext,
  ticketSummary: string,
  ticketDescription: string,
  ticketUpdatedAt: string,
  ticketKey: string,
): readonly Inconsistency[];

/** Calculate documentation score bonus/penalty from relationship context */
export function calculateDocumentationSignal(context: RelationshipContext): {
  bonus: number;
  penalty: number;
  signals: readonly string[];
};

/** Calculate consistency score bonus/penalty from sibling alignment */
export function calculateConsistencySignal(context: RelationshipContext): {
  bonus: number;
  penalty: number;
  signals: readonly string[];
};
```

#### Detection Logic

**Sibling Contradiction** (`detectSiblingContradictions`):

- For each sibling in the same epic, check if summary/description contains contradictory terms (reuse `contradictionPairs` from inconsistency-detector)
- Weight: higher severity if multiple siblings contradict
- Only check siblings with `topic-match` edges sharing topics with the target ticket

**Spec Drift** (`detectSpecDrift`):

- Compare `context.documentation[].updatedAt` with `ticketUpdatedAt`
- If doc is > 30 days older than last ticket update → `warning`
- If doc is > 90 days older → `critical`
- Staleness factor from RTASK-039 applies

**Scope Mismatch** (`detectScopeMismatch`):

- If a PR node exists but has no `implements` edge back to the ticket → `warning`
- If PR's `fileCount` is > 20 but ticket is a single story (not epic) → `info` (possible scope creep)

**Orphan Reference** (`detectOrphanReferences`):

- If `crossReferences` has entries with `confidence < 0.3` → `info` (weak reference, may be noise)
- If a cross-reference targets a tool but no corresponding node exists in the graph → `warning`

### Step 3: Modify Scoring Engine

In `src/backend/services/scoring/scoring-engine.ts`:

```typescript
// Extend ScoringInput:
export interface ScoringInput {
  readonly ticket: JiraTicketData;
  readonly inconsistencies?: readonly Inconsistency[];
  readonly relationshipContext?: RelationshipContext; // NEW
}
```

Then in `scoreConsistency`:

- If `relationshipContext` provided, call `calculateConsistencySignal()`
- Apply bonus (up to +15) if siblings are well-aligned
- Apply penalty (up to -20) if siblings contradict

In `scoreDocumentation`:

- If `relationshipContext` provided, call `calculateDocumentationSignal()`
- Apply bonus (up to +20) if linked docs exist and are fresh
- Apply penalty (up to -15) if docs are stale or missing for topics with high cluster strength

### Step 4: Modify Evaluation Pipeline

In `src/backend/services/evaluation/evaluation-pipeline.ts`, add between Steps 2 and 3:

```typescript
// Step 2.5: Fetch relationship context (optional, graceful degradation)
const relationshipContext = await fetchRelationshipContext(
  ticketKey,
  projectConfig.projectKey,
  executionId,
);

// Step 3: Detect inconsistencies (now with relationship context)
const inconsistencies = detectIssues(ticket, rovoContext, executionId, relationshipContext);
```

Where `fetchRelationshipContext` is:

```typescript
const fetchRelationshipContext = async (
  ticketKey: string,
  projectKey: string,
  executionId: string,
): Promise<RelationshipContext | undefined> => {
  try {
    const { buildRelationshipContext } =
      await import('../relationship-index/relationship-storage.js');
    return await buildRelationshipContext(projectKey, `jira:${ticketKey}`, executionId);
  } catch {
    // Relationship index not available — graceful degradation
    return undefined;
  }
};
```

```typescript
// Step 2.6: Build curated context (JIT assembly with token budget)
const builtContext = relationshipContext
  ? assembleContextFromNeighborhood(ticket, relationshipContext, recentDecisions, executionId)
  : undefined;

// Step 2.7: Query operational memory
const recentDecisions = await fetchRecentDecisions(ticketKey, projectKey, executionId);
const decisionPattern = analyzeDecisionPatterns(recentDecisions, 0, 'comment');
```

And update the pipeline to use `builtContext` for the LLM call instead of raw `relationshipContext`.

### Step 5: Fix Delivery Gate documentationRefs

**BUG**: `evaluateDeliveryGate` in `quality-gate-rules.ts` requires `documentationRefs` to pass the delivery gate, but `determineEnforcementActions` passes `undefined` and the evaluation pipeline never populates this field. The gate's documentation check is effectively disabled.

**Fix in evaluation pipeline** (`src/backend/services/evaluation/evaluation-pipeline.ts`):

```typescript
// In runPipeline, after relationship context is fetched:
const documentationRefs = relationshipContext
  ? relationshipContext.documentation.map((d) => d.id)
  : undefined;

// In evaluateQualityGate, pass documentationRefs:
const { gateResult, actions } = evaluateQualityGate(
  gateType,
  score,
  inconsistencies,
  projectConfig,
  ticketKey,
  executionId,
  documentationRefs, // NEW
);
```

**Fix in quality gate evaluation** (`src/backend/services/scoring/quality-gate-rules.ts`):

Update `evaluateQualityGate` in the evaluation pipeline to pass `documentationRefs` through to `GateEvaluationInput`. When relationship context is available, `documentationRefs` is populated from `RelationshipContext.documentation`. When not available, it falls back to checking the ticket description for `"http"` strings (current behavior).

### Step 6: Modify Agent Action Handler

In `src/backend/resolvers/agent-action.ts`:

- `handleEvaluateIssue`: Fetch `RelationshipContext` and pass to `detectInconsistencies` + `calculateScore`
- `handleCheckPRConsistency`: Use graph traversal (PR → issue → epic) instead of string similarity
- `handleValidateSpecAlignment`: Use `context.documentation` from graph instead of Rovo search

### Step 7: Modify Inconsistency Detector

In `src/backend/services/scoring/inconsistency-detector.ts`:

Add optional `RelationshipContext` parameter to `detectInconsistencies`:

```typescript
export const detectInconsistencies = (
  ticket: JiraTicketData,
  context?: RovoContext,
  config: DetectorConfig = DEFAULT_DETECTOR_CONFIG,
  relationshipContext?: RelationshipContext, // NEW — optional, graceful
): Inconsistency[] => {
  validateTicket(ticket);

  // Existing detectors (unchanged)
  const contradictions = detectContradictions(ticket, context, config);
  const duplicates = detectDuplicates(ticket, config);
  const missingContext = detectMissingContext(ticket, config);
  const ambiguities = detectAmbiguity(ticket, config);

  // NEW: Relationship-aware detectors (only if context available)
  const relationshipIssues = relationshipContext
    ? detectRelationshipInconsistencies(
        relationshipContext,
        ticket.summary,
        ticket.description,
        ticket.updated ?? new Date().toISOString(),
        ticket.key,
      )
    : [];

  const allInconsistencies = [
    ...contradictions,
    ...duplicates,
    ...missingContext,
    ...ambiguities,
    ...relationshipIssues,
  ];

  return allInconsistencies.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
};
```

## Acceptance Criteria

- [ ] AC-01: `InconsistencyType` extended with 4 new types
- [ ] AC-02: `relationship-consumer.ts` implements all 4 detection functions + 2 signal functions
- [ ] AC-03: `detectInconsistencies` accepts optional `RelationshipContext` without breaking existing callers
- [ ] AC-04: `ScoringInput` extended with optional `relationshipContext`
- [ ] AC-05: `scoreConsistency` and `scoreDocumentation` use relationship signals when available
- [ ] AC-06: Evaluation pipeline fetches relationship context with graceful degradation
- [ ] AC-07: `handleEvaluateIssue` passes relationship context to scoring/detection
- [ ] AC-08: `handleCheckPRConsistency` uses graph traversal for alignment check
- [ ] AC-09: `handleValidateSpecAlignment` uses graph documentation instead of Rovo search
- [ ] AC-10: Delivery gate `documentationRefs` populated from `RelationshipContext.documentation` when available
- [ ] AC-11: Delivery gate falls back to ticket description string check when relationship context unavailable
- [ ] AC-12: All new code has zero `any` types
- [ ] AC-13: All modifications to existing modules are backward-compatible (relationship context is optional)
- [ ] AC-14: Test coverage > 85% for new code
- [ ] AC-15: Existing tests still pass unchanged
- [ ] AC-16: `.reqs.md` sidecars created/updated for all modified files
- [ ] AC-17: `context-builder.ts` implements path extraction, ranking, and positional assembly
- [ ] AC-18: `decision-consumer.ts` queries past decisions and detects override patterns
- [ ] AC-19: Context assembled with token budget enforcement (max 2,500 tokens)
- [ ] AC-20: Context uses positional optimization (facts at START/END, evidence in MIDDLE)
- [ ] AC-21: Operational memory consulted before enforcement decisions
- [ ] AC-22: Override patterns adjust threshold suggestions

## QA Gates

### Pre-Implementation

- [ ] **GATE-READY**: RTASK-037..040 completed (types, storage, 3 indexers)
- [ ] **GATE-REVIEW**: Review all 6 modules to be modified for current signatures

### Implementation

- [ ] **GATE-BACKWARD**: Every change is backward-compatible — existing callers work without relationship context
- [ ] **GATE-GRACEFUL**: Missing relationship context degrades gracefully (no error, no score penalty)
- [ ] **GATE-TYPES**: No `any` types introduced
- [ ] **GATE-TESTS**: New tests for each detector function and scoring signal

### Post-Implementation

- [ ] **GATE-TYPECHECK**: `pnpm typecheck` passes
- [ ] **GATE-LINT**: `pnpm lint` passes
- [ ] **GATE-TEST**: `pnpm test:unit` passes
- [ ] **GATE-EXISTING**: All existing tests pass unchanged

## Implementation Protocol

### Step 1: Types (non-breaking)

1. Add 4 new `InconsistencyType` values to `inconsistency.ts`
2. Update `classifySeverity` and `generateSuggestion` maps for new types

### Step 2: Consumer Module (new file)

1. Create `relationship-consumer.ts`
2. Implement detection functions
3. Implement signal functions
4. Write tests

### Step 3: Detector Integration (non-breaking)

1. Add optional `RelationshipContext` parameter to `detectInconsistencies`
2. Import and call `detectRelationshipInconsistencies` when context provided
3. Update existing tests to cover the new parameter (pass undefined for existing tests)

### Step 4: Scoring Integration (non-breaking)

1. Extend `ScoringInput` with optional field
2. Modify `scoreConsistency` and `scoreDocumentation` to check for context
3. Write tests with/without relationship context

### Step 5: Pipeline + Agent Integration (non-breaking)

1. Add relationship context fetch to evaluation pipeline (with graceful degradation)
2. Add relationship context fetch to agent action handlers
3. Update `handleCheckPRConsistency` to use graph traversal
4. Write tests

### Step 6: Validation

1. Run full test suite
2. Verify typecheck passes
3. Verify no regressions in existing tests

## Triple Deliverable

| Production                                                               | Sidecar            | Test                                                                    |
| ------------------------------------------------------------------------ | ------------------ | ----------------------------------------------------------------------- |
| `src/backend/services/relationship-index/relationship-consumer.ts` (new) | `.reqs.md`         | `tests/unit/services/relationship-index/relationship-consumer.spec.ts`  |
| `src/backend/services/relationship-index/context-builder.ts` (new)       | `.reqs.md`         | `tests/unit/services/relationship-index/context-builder.spec.ts`        |
| `src/backend/services/relationship-index/decision-consumer.ts` (new)     | `.reqs.md`         | `tests/unit/services/relationship-index/decision-consumer.spec.ts`      |
| `src/backend/types/inconsistency.ts` (modified)                          | updated `.reqs.md` | `tests/unit/types/inconsistency.spec.ts` (extended)                     |
| `src/backend/services/scoring/inconsistency-detector.ts` (modified)      | updated `.reqs.md` | `tests/unit/services/scoring/inconsistency-detector.spec.ts` (extended) |
| `src/backend/services/scoring/scoring-engine.ts` (modified)              | updated `.reqs.md` | `tests/unit/services/scoring/scoring-engine.spec.ts` (extended)         |
| `src/backend/services/evaluation/evaluation-pipeline.ts` (modified)      | updated `.reqs.md` | `tests/unit/services/evaluation/evaluation-pipeline.spec.ts` (extended) |
| `src/backend/services/scoring/quality-gate-rules.ts` (modified)          | updated `.reqs.md` | `tests/unit/services/scoring/quality-gate-rules.spec.ts` (extended)     |
| `src/backend/resolvers/agent-action.ts` (modified)                       | updated `.reqs.md` | `tests/unit/resolvers/agent-action.spec.ts` (extended)                  |

## Risks

| Risk                                                                          | Mitigation                                                              |
| ----------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Breaking existing callers of `detectInconsistencies`                          | New parameter is optional and last — existing signatures work unchanged |
| Performance regression from graph traversal in pipeline                       | Relationship context fetch is timeout-guarded and degrades gracefully   |
| Circular dependency (consumer imports from scoring, scoring imports consumer) | Consumer is standalone — returns raw data, scoring applies it           |
| Large relationship context for well-connected entities                        | Cap `rankedItems` to top 10 by relevance; skip low-weight edges         |
| Relationship index not populated yet (RTASK-038..040 not run)                 | All consumers check for undefined/empty context and degrade gracefully  |
