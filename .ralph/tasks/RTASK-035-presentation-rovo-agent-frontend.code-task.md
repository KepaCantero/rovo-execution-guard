---
id: RTASK-035
title: 'Presentation Layer - Rovo Agent Frontend Integration'
status: pending
priority: 2
type: presentation
dependencies: [RTASK-033, RTASK-018]
rulebook_refs: [UI-ADS-001, ROVO-INTEG-001, FORGE-OPS-001]
spec: docs/tickets/TASK-035-presentation-rovo-agent-frontend.md
---

# RTASK-035: Presentation Layer - Rovo Agent Frontend Integration

## Objective

Enhance the Jira Issue Panel frontend to integrate deeply with the Rovo Agent, replacing the generic "Ask Rovo" button with contextual prompts differentiated by score severity and adding a direct "Full Analysis" button that opens the Consistency Guard agent via `rovo.open()` with the `type: 'agent'` parameter.

## Context

The existing Issue Panel (RTASK-018) displays consistency scores per axis with an "Ask Rovo for suggestions" button that calls `rovo.open()` with a generic prompt. This integration is basic — it doesn't differentiate between critical vs. acceptable scores, and it opens the default Rovo Chat rather than the specific Consistency Guard agent defined in RTASK-033.

With the Consistency Guard agent now defined (RTASK-033), the frontend can:

1. Open the specific agent directly via `rovo.open({ type: 'agent', agentKey: 'consistency-guard' })`
2. Generate prompts contextualized by score severity (urgent for low scores, optimization for high scores)
3. Pre-fill the agent with rich context (issue key, axis scores, threshold, suggestions)

### Forge Bridge Rovo API (Preview)

Available methods from `@forge/bridge`:

- `rovo.open({ type: 'agent', agentKey: string, prompt: string })` — Opens Chat with a specific agent and pre-filled prompt
- `rovo.open({ type: 'default', prompt: string })` — Opens Chat with default agent (existing pattern)
- `rovo.isEnabled()` — Returns boolean indicating if Rovo is available

## Technical Specification

### Location

- `src/frontend/custom-ui/issue-panel/app.tsx` (modify)

### Changes to Issue Panel

#### 1. Score-Contextual Prompt Builder

Create a helper function that generates different prompts based on score ranges:

```typescript
type PromptSeverity = 'critical' | 'improvable' | 'optimal';

const buildRovoPrompt = (
  axisKey: string,
  detail: AxisDetail,
  axes: ScoreAxes,
  ticketContext?: TicketContext,
): { prompt: string; severity: PromptSeverity } => {
  const pct = Math.round(detail.score);
  const threshold = ticketContext?.scoreThreshold ?? 60;

  if (pct < 40) {
    // CRITICAL: Urgent prompt demanding immediate fixes
    return {
      severity: 'critical',
      prompt: [
        `URGENT: The "${detail.label}" score for ${ticketContext?.issueKey} is critically low at ${pct}%.`,
        `This is blocking workflow transitions. The project threshold is ${threshold}%.`,
        `Current suggestions: ${detail.suggestions.join('; ')}`,
        `Provide 3-5 IMMEDIATE fixes to raise this score above ${threshold}%.`,
        `Issue summary: ${ticketContext?.summary}`,
      ].join('\n'),
    };
  }

  if (pct < threshold) {
    // IMPROVABLE: Targeted improvement prompt
    return {
      severity: 'improvable',
      prompt: [
        `The "${detail.label}" score for ${ticketContext?.issueKey} is ${pct}%, below the ${threshold}% threshold.`,
        `Current suggestions: ${detail.suggestions.join('; ')}`,
        `Suggest specific improvements to reach ${threshold}%.`,
        `Issue summary: ${ticketContext?.summary}`,
      ].join('\n'),
    };
  }

  // OPTIMAL: Optimization prompt
  return {
    severity: 'optimal',
    prompt: [
      `The "${detail.label}" score for ${ticketContext?.issueKey} is ${pct}% (above ${threshold}% threshold).`,
      `Are there further optimizations to push this score higher?`,
      `Issue summary: ${ticketContext?.summary}`,
    ].join('\n'),
  };
};
```

#### 2. Per-Axis "Ask Agent" Buttons

Replace the existing generic "Ask Rovo for suggestions" handler in `AxisRow` with:

```typescript
const handleAskAgent = async (axisKey: string): Promise<void> => {
  const { prompt } = buildRovoPrompt(axisKey, detail, axes, score?.ticketContext);
  await rovo.open({
    type: 'agent',
    agentKey: 'consistency-guard',
    prompt,
  });
};
```

Each axis row button should visually indicate severity:

- Critical (< 40%): Red-tinted button with "Fix now" label
- Improvable (40 - threshold): Yellow-tinted button with "Improve" label
- Optimal (>= threshold): Green-tinted button with "Optimize" label

#### 3. Full Analysis Button

Add a primary action button at the top of the panel:

```typescript
const handleFullAnalysis = async (): Promise<void> => {
  if (!score?.ticketContext) return;
  const { issueKey, summary } = score.ticketContext;
  const overallPct = Math.round(score.overall);

  await rovo.open({
    type: 'agent',
    agentKey: 'consistency-guard',
    prompt: [
      `Perform a full consistency evaluation for ${issueKey}: ${summary}`,
      `Current overall score: ${overallPct}%`,
      `Provide a comprehensive analysis with specific improvement recommendations.`,
    ].join('\n'),
  });
};
```

#### 4. Rovo Availability Guard

Wrap all Rovo-related UI with `rovo.isEnabled()` check:

```typescript
const [rovoAvailable, setRovoAvailable] = useState(false);

useEffect(() => {
  rovo
    .isEnabled()
    .then(setRovoAvailable)
    .catch(() => setRovoAvailable(false));
}, []);
```

Only render agent buttons when `rovoAvailable === true`.

### Visual Design

- **Full Analysis button**: Primary action (Atlaskit `@atlaskit/button` appearance="primary"), positioned prominently at the top of the panel
- **Per-axis buttons**: Compact buttons within each axis row, color-coded by severity
- **Fallback**: If Rovo is not available, show a tooltip "Rovo is not available in this environment" and disable the buttons

### Theme Integration

Use existing theme tokens from `src/frontend/custom-ui/admin-dashboard/styles/theme.ts`:

- `theme.score.critical` for < 40%
- `theme.score.warning` for < threshold
- `theme.score.good` for >= threshold

## Acceptance Criteria

- [ ] AC-01: `buildRovoPrompt` helper generates different prompts for critical (< 40%), improvable (< threshold), and optimal (>= threshold) ranges
- [ ] AC-02: Per-axis "Ask Agent" buttons open Consistency Guard agent with contextual prompts via `rovo.open({ type: 'agent', agentKey: 'consistency-guard' })`
- [ ] AC-03: Per-axis buttons are visually differentiated by severity (color-coded)
- [ ] AC-04: "Full Analysis" button opens agent with comprehensive evaluation prompt
- [ ] AC-05: All Rovo-related UI is guarded by `rovo.isEnabled()` check
- [ ] AC-06: Buttons show disabled state with tooltip when Rovo is not available
- [ ] AC-07: Existing non-Rovo functionality (score display, axis details) remains unchanged
- [ ] AC-08: No `any` types in new code
- [ ] AC-09: Test coverage exceeds 85% for new helper functions and component logic
- [ ] AC-10: `.reqs.md` sidecar file created

## QA Gates

### Pre-Implementation Gates

- [ ] **GATE-READY**: All dependencies (RTASK-033, RTASK-018) are completed
- [ ] **GATE-SPEC**: Rulebook sections UI-ADS-001, ROVO-INTEG-001, FORGE-OPS-001 have been read and understood
- [ ] **GATE-DESIGN**: UI layout and prompt templates documented before coding

### Implementation Gates (per component/function)

- [ ] **GATE-RED**: Write failing test FIRST for each new function/component
- [ ] **GATE-GREEN**: Write minimum code to make test pass
- [ ] **GATE-REFACTOR**: Clean up code while keeping tests green

### Post-Implementation Gates

- [ ] **GATE-TYPECHECK**: `pnpm typecheck` passes with zero errors
- [ ] **GATE-LINT**: `pnpm lint` passes with zero warnings
- [ ] **GATE-FORMAT**: `pnpm format:check` passes
- [ ] **GATE-TEST**: `pnpm test:unit` passes with coverage > 85%
- [ ] **GATE-REQS**: All `.reqs.md` sidecar files created and complete
- [ ] **GATE-ZERO-ANY**: `grep -r "any" src/` returns zero results (no `any` types)

## Requirements Creation Protocol

For each production file, the builder MUST create a `.reqs.md` sidecar:

1. **Before implementation**: Create `.reqs.md` listing all requirements from the spec
2. **Format**: Use `.ralph/templates/reqs-template.md` format
3. **Content**: Each requirement maps to an acceptance criterion and rulebook rule
4. **Traceability**: Every AC in the task maps to at least one section in the sidecar
5. **Location**: Sidecar lives adjacent to the production file (same directory)

## Implementation Protocol

### Step 1: Preparation

1. Read existing Issue Panel implementation (`src/frontend/custom-ui/issue-panel/app.tsx`)
2. Read existing theme tokens (`src/frontend/custom-ui/admin-dashboard/styles/theme.ts`)
3. Read Forge Bridge Rovo API docs: https://developer.atlassian.com/platform/forge/apis-reference/ui-api-bridge/rovo/
4. Create `.reqs.md` sidecar file

### Step 2: TDD Cycle

1. **RED**: Write tests for `buildRovoPrompt` helper (critical/improvable/optimal ranges)
2. **GREEN**: Implement `buildRovoPrompt`
3. **REFACTOR**: Clean up
4. **RED**: Write tests for agent button rendering (severity colors, disabled state)
5. **GREEN**: Implement UI changes
6. **REFACTOR**: Clean up

### Step 3: Integration

1. Add `rovo.isEnabled()` check on component mount
2. Wire agent buttons with `rovo.open({ type: 'agent', ... })`
3. Verify "Full Analysis" button behavior

### Step 4: Validation

1. Run `pnpm typecheck` — must pass
2. Run `pnpm lint` — must pass
3. Run `pnpm format:check` — must pass
4. Run `pnpm test:unit` — must pass with > 85% coverage
5. Verify zero `any` usage

## Auditing Protocol

### Critic Review Checklist

- [ ] All acceptance criteria verified as implemented
- [ ] No `any` types anywhere in new code
- [ ] All interfaces use `readonly` properties
- [ ] Prompt templates are contextually appropriate for each severity level
- [ ] Visual differentiation is clear and accessible (color + label)
- [ ] `rovo.isEnabled()` guard is in place
- [ ] Triple deliverable complete: `.tsx` + `.reqs.md` + `.spec.tsx`
- [ ] No code outside specified file locations

### Rejection Criteria

The critic MUST reject if:

- Any `any` type is present
- Coverage is below the required threshold (85%)
- A `.reqs.md` sidecar is missing
- `rovo.open()` is called without `rovo.isEnabled()` guard
- Agent key doesn't match manifest (`consistency-guard`)
- Existing functionality is broken (score display, axis details)

## Testing Protocol

### Unit Tests (`tests/unit/frontend/custom-ui/issue-panel/`)

- Location: Mirror production path under `tests/unit/`
- Coverage target: 85%
- Pattern: Arrange-Act-Assert (AAA)

### Test Categories Required

- [ ] **`buildRovoPrompt` helper**:
  - Returns `{ severity: 'critical' }` for score < 40
  - Returns `{ severity: 'improvable' }` for score 40..threshold-1
  - Returns `{ severity: 'optimal' }` for score >= threshold
  - Includes issue key and suggestions in prompt text
  - Handles missing `ticketContext` gracefully
- [ ] **Per-axis buttons**:
  - Render with correct severity styling
  - Call `rovo.open()` with correct `agentKey` and contextual prompt on click
  - Are disabled when `rovoAvailable` is false
- [ ] **Full Analysis button**:
  - Calls `rovo.open()` with comprehensive prompt
  - Includes issue key and overall score
  - Is disabled when `rovoAvailable` is false
- [ ] **Edge cases**: Missing score data, missing ticket context, zero suggestions

### Mock Strategy

- Mock `@forge/bridge` (specifically `rovo.open`, `rovo.isEnabled`)
- Mock `invoke` from `@forge/bridge` for resolver calls
- Use React Testing Library for component tests
- Reset mocks between tests (`beforeEach`)

## Triple Deliverable

| Production                                              | Sidecar                                                    | Test                                                               |
| ------------------------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------ |
| `src/frontend/custom-ui/issue-panel/app.tsx` (modified) | `src/frontend/custom-ui/issue-panel/app.reqs.md` (updated) | `tests/unit/frontend/custom-ui/issue-panel/app.spec.tsx` (updated) |

## Risks

| Risk                                                    | Mitigation                                                                                                    |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `rovo.open()` API changes (Preview status)              | Guard all calls with try-catch; fallback to generic `rovo.open({ type: 'default' })` if `type: 'agent'` fails |
| Forge Bridge Rovo API not available in test environment | Mock `rovo.isEnabled()` to return `false` in tests; verify guard behavior                                     |
| Prompt text too long for `rovo.open()` parameter        | Truncate to 500 characters max; include only essential context                                                |
| Agent key mismatch with manifest                        | Use constant `AGENT_KEY = 'consistency-guard'` shared between frontend and manifest                           |
| Accessibility: color-only severity indicators           | Use both color AND text labels ("Fix now", "Improve", "Optimize")                                             |
