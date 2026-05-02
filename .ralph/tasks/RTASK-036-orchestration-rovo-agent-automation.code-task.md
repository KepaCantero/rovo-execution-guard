---
id: RTASK-036
title: 'Orchestration Layer - Rovo Agent Automation & Deprecation'
status: pending
priority: 2
type: orchestration
dependencies: [RTASK-033, RTASK-034]
rulebook_refs: [ROVO-INTEG-001, ROVO-INTEG-009, FORGE-OPS-001, SEC-PRIV-005]
spec: docs/tickets/TASK-036-orchestration-rovo-agent-automation.md
---

# RTASK-036: Orchestration Layer - Rovo Agent Automation & Deprecation

## Objective

Enable the Consistency Guard agent for use in Jira/Confluence automation rules, add optional scheduled-trigger for weekly consistency reports, document automation templates for users, and deprecate the undocumented internal Rovo API endpoints in favor of the official `rovo:agent` + `action` module pattern.

## Context

The Rovo Agent defined in RTASK-033 and wired in RTASK-034 is automatically compatible with Jira/Confluence Automation — agents appear as invocable actions in automation rules with no additional code needed. However, users need documentation on recommended automation templates.

Additionally, the existing `rovo-adapter.ts` uses internal endpoints (`/gateway/api/rovo/search` and `/gateway/api/rovo/validate`) that are not publicly documented. With the official agent + action pattern now in place, these endpoints should be marked as deprecated with a migration timeline.

### Automation Compatibility

The `rovo:agent` module in the manifest makes the agent available in:

1. **Chat side panel** (Jira and Confluence) — already covered by RTASK-033
2. **AI toolbar** in editors (`/ai`) — automatic
3. **Jira Automation rules** — agent appears as an action in automation builder
4. **Confluence Automation rules** — same as above
5. **Jira work items** — agent can be added as a "teammate"

## Technical Specification

### Location

- `src/backend/services/rovo/rovo-adapter.ts` (modify — add deprecation notices)
- `docs/rovo-agent-automation-templates.md` (create — user documentation)

### Existing Components Referenced

This task interacts with the following already-implemented modules:

| Module                   | Location                                                                    | Relevance                                                                                                           |
| ------------------------ | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| **Rovo Adapter**         | `src/backend/services/rovo/rovo-adapter.ts`                                 | Target for deprecation notices — contains `callRovoSearch()` and `callRovoValidation()` that use internal endpoints |
| **Agent Action Handler** | `src/backend/resolvers/agent-action.ts` (RTASK-034)                         | Replacement for internal endpoints — the `evaluate-issue` action replaces `callRovoSearch` + `callRovoValidation`   |
| **Agent Manifest**       | `manifest.yml` (RTASK-033)                                                  | Defines `rovo:agent` + `action` modules that replace internal API calls                                             |
| **Agent Prompts**        | `src/backend/services/rovo/agent-prompts/consistency-guard.txt` (RTASK-033) | Agent prompt file that defines the AI behavior                                                                      |
| **Issue Panel**          | `src/frontend/custom-ui/issue-panel/app.tsx`                                | Frontend that will use the agent via `rovo.open({ type: 'agent' })` (RTASK-035)                                     |
| **Error Types**          | `src/backend/types/errors.ts`                                               | Domain error types used by the agent action handler                                                                 |
| **Scoring Services**     | `src/backend/services/scoring/`                                             | Scoring engine, inconsistency detector, quality gates — all used by agent actions                                   |

### Deprecation Strategy

The deprecation follows a 3-layer resilience model:

| Layer                             | Status                 | Description                                                      |
| --------------------------------- | ---------------------- | ---------------------------------------------------------------- |
| **Layer 1: Agent + Actions**      | NEW (RTASK-033/034)    | Official `rovo:agent` + `action` Forge modules                   |
| **Layer 2: Internal endpoints**   | DEPRECATED (this task) | `callRovoSearch()`, `callRovoValidation()` with JQL/CQL fallback |
| **Layer 3: Fail-open safety net** | PERMANENT              | Score 100 + audit log when all services unavailable              |

### Part 1: Deprecation Notices in Rovo Adapter

#### Changes to `src/backend/services/rovo/rovo-adapter.ts`

Add deprecation notices to the two internal endpoint functions:

**`callRovoSearch()` deprecation:**

```typescript
/**
 * DEPRECATION NOTICE (RTASK-036):
 * This function uses the undocumented internal endpoint /gateway/api/rovo/search.
 * It will be replaced by the official rovo:agent + action module pattern
 * once the agent integration is fully validated in production.
 *
 * Migration path: Use the Consistency Guard agent's evaluate-issue action instead.
 * Timeline: Deprecation target Q3 2026. Fallback to JQL + CQL remains as permanent safety net.
 * @deprecated Use agent-action-handler via rovo:agent module instead.
 */
```

**`callRovoValidation()` deprecation:**

```typescript
/**
 * DEPRECATION NOTICE (RTASK-036):
 * This function uses the undocumented internal endpoint /gateway/api/rovo/validate.
 * It will be replaced by the official rovo:agent + action module pattern
 * once the agent integration is fully validated in production.
 *
 * Migration path: Use the Consistency Guard agent's evaluate-issue action instead.
 * Timeline: Deprecation target Q3 2026. Rule-based fallback remains as permanent safety net.
 * @deprecated Use agent-action-handler via rovo:agent module instead.
 */
```

Add a module-level notice:

```typescript
/**
 * ROVO ADAPTER — DEPRECATION STRATEGY
 *
 * This module uses two undocumented internal endpoints:
 *   - /gateway/api/rovo/search  (callRovoSearch)
 *   - /gateway/api/rovo/validate (callRovoValidation)
 *
 * These are NOT part of the public Rovo API and may change without notice.
 * The official integration path is now the rovo:agent + action Forge modules (RTASK-033/034).
 *
 * 3-LAYER RESILIENCE:
 *   Layer 1: rovo:agent + actions (official, GA) — NEW
 *   Layer 2: Internal endpoints + fallback (JQL + CQL + rules) — DEPRECATED
 *   Layer 3: Fail-open with score 100 + audit log — PERMANENT SAFETY NET
 */
```

### Part 2: Automation Templates Documentation

**File:** `docs/rovo-agent-automation-templates.md`

Document the following automation templates for users:

#### Template 1: Pre-Transition Consistency Check

```
Name: Pre-Transition Consistency Check
Trigger: Issue transitioned (Before save)
Condition: Target status is "In Progress", "In Review", or "Done"
Action: Invoke Consistency Guard agent with prompt:
  "Evaluate issue {{issue.key}} and determine if it should transition
   from {{issue.fromStatus}} to {{issue.toStatus}}. Report any quality
   concerns that should be addressed before the transition."
```

#### Template 2: Weekly Consistency Report

```
Name: Weekly Consistency Report
Trigger: Scheduled (every Monday at 9:00 AM)
Scope: Project {{project.key}}
Action: Invoke Consistency Guard agent with prompt:
  "Generate a weekly consistency report for project {{project.key}}.
   Analyze all issues updated in the last 7 days and provide:
   1. Average consistency score
   2. Worst performing scoring axis
   3. Top 5 issues needing attention
   4. Trend compared to last week (if data available)
   5. Recommendations for the team"
```

#### Template 3: PR Created Auto-Check

```
Name: PR Created Auto-Check
Trigger: Issue linked to external resource (webhook)
Condition: Resource type is "pull_request"
Action: Invoke Consistency Guard agent with prompt:
  "Check PR consistency for {{issue.key}} against its linked pull request.
   Verify that acceptance criteria are addressed and there are no
   scope mismatches between the issue and the PR."
```

#### Template 4: New Issue Quality Gate

```
Name: New Issue Quality Gate
Trigger: Issue created
Condition: Issue type is Story, Task, or Bug
Action: Invoke Consistency Guard agent with prompt:
  "Evaluate the quality of newly created issue {{issue.key}}.
   Check if it has adequate description, acceptance criteria, labels,
   and priority. Suggest improvements before development begins."
```

#### Template 5: Confluence Spec Change Alert

```
Name: Confluence Spec Change Alert
Trigger: Confluence page updated (in specific space)
Condition: Page labels include "specification" or "requirements"
Action: Invoke Consistency Guard agent with prompt:
  "A specification page has been updated: {{content.title}}.
   Identify any Jira issues in project {{project.key}} that may be
   affected by this change and report potential misalignments."
```

### Part 3: Optional Scheduled Trigger (Future Enhancement)

Document but do NOT implement a `scheduled-trigger` module for automated weekly reports. This is a future enhancement that can be added when the agent is validated in production:

```yaml
# FUTURE: Add to manifest.yml when ready
modules:
  scheduled-trigger:
    - key: weekly-consistency-report
      function: scheduled-report-fn
      schedule: '0 9 * * 1' # Monday 9am UTC
```

Corresponding handler structure (for documentation only):

- `src/scheduled-report-handler.ts` — entry point
- `src/backend/resolvers/scheduled-report.ts` — batch evaluation logic

### Part 4: Update CLAUDE.md Pipeline

Update the pipeline section in `CLAUDE.md` to reflect the new RTASKs:

```
## Pipeline (RTASK)

Completed: 001-011, 013, 021, 024, 033-036. In progress: 012.

Next in order:
1. RTASK-017 — Enforcement Actions
2. RTASK-014 — Jira Triggers
...
```

## Acceptance Criteria

- [ ] AC-01: Deprecation notices added to `callRovoSearch()` in `rovo-adapter.ts` with `@deprecated` JSDoc tag
- [ ] AC-02: Deprecation notices added to `callRovoValidation()` in `rovo-adapter.ts` with `@deprecated` JSDoc tag
- [ ] AC-03: Module-level deprecation strategy comment added at top of `rovo-adapter.ts`
- [ ] AC-04: Automation templates document created with 5 templates
- [ ] AC-05: Each template includes: name, trigger, condition, action with prompt template
- [ ] AC-06: CLAUDE.md pipeline section updated with RTASK-033 to RTASK-036
- [ ] AC-07: All existing functionality preserved (no behavior changes in `rovo-adapter.ts`)
- [ ] AC-08: `.reqs.md` sidecar file created
- [ ] AC-09: `pnpm typecheck` passes
- [ ] AC-10: `pnpm test:unit` passes (existing tests unaffected)

## QA Gates

### Pre-Implementation Gates

- [ ] **GATE-READY**: All dependencies (RTASK-033, RTASK-034) are completed
- [ ] **GATE-SPEC**: Rulebook sections ROVO-INTEG-001, ROVO-INTEG-009, FORGE-OPS-001, SEC-PRIV-005 have been read and understood
- [ ] **GATE-DESIGN**: Deprecation plan and automation templates reviewed

### Implementation Gates

- [ ] **GATE-DEPRECATION**: All internal endpoint usages have clear `@deprecated` JSDoc tags
- [ ] **GATE-DOCS**: Automation templates document is complete with all 5 templates
- [ ] **GATE-NO-REGRESSION**: Existing tests pass unchanged

### Post-Implementation Gates

- [ ] **GATE-TYPECHECK**: `pnpm typecheck` passes (comments don't affect types)
- [ ] **GATE-LINT**: `pnpm lint` passes
- [ ] **GATE-TEST**: `pnpm test:unit` passes — all existing tests pass
- [ ] **GATE-REQS**: `.reqs.md` sidecar file created

## Requirements Creation Protocol

For each production file, the builder MUST create a `.reqs.md` sidecar:

1. **Before implementation**: Create `.reqs.md` listing all requirements from the spec
2. **Format**: Use `.ralph/templates/reqs-template.md` format
3. **Content**: Each requirement maps to an acceptance criterion and rulebook rule
4. **Traceability**: Every AC in the task maps to at least one section in the sidecar
5. **Location**: Sidecar lives adjacent to the production file (same directory)

## Implementation Protocol

### Step 1: Preparation

1. Read current `rovo-adapter.ts` to locate `callRovoSearch` and `callRovoValidation` functions
2. Read `src/backend/resolvers/agent-action.ts` (RTASK-034) to understand the replacement agent action handler
3. Read `manifest.yml` to confirm the `rovo:agent` and `action` module definitions from RTASK-033
4. Read `src/backend/services/rovo/agent-prompts/consistency-guard.txt` for agent prompt reference
5. Read `src/frontend/custom-ui/issue-panel/app.tsx` to understand the frontend integration that replaces these endpoints
6. Read CLAUDE.md pipeline section
7. Create `.reqs.md` sidecar file

### Step 2: Deprecation Notices

1. Add module-level comment at top of `rovo-adapter.ts`
2. Add `@deprecated` JSDoc + deprecation notice to `callRovoSearch`
3. Add `@deprecated` JSDoc + deprecation notice to `callRovoValidation`
4. Verify no behavior changes (comments only)

### Step 3: Documentation

1. Create `docs/rovo-agent-automation-templates.md`
2. Document all 5 automation templates
3. Include instructions for setting up automation rules in Jira/Confluence

### Step 4: Update Pipeline

1. Update `CLAUDE.md` pipeline section with RTASK-033 to RTASK-036

### Step 5: Validation

1. Run `pnpm typecheck` — must pass
2. Run `pnpm lint` — must pass
3. Run `pnpm test:unit` — all existing tests pass

## Auditing Protocol

### Critic Review Checklist

- [ ] All acceptance criteria verified as implemented
- [ ] Deprecation notices include migration path and timeline
- [ ] No behavior changes in `rovo-adapter.ts` (comments only)
- [ ] Automation templates are clear and actionable for end users
- [ ] CLAUDE.md pipeline section is accurate
- [ ] `.reqs.md` sidecar created

### Rejection Criteria

The critic MUST reject if:

- Any behavior change in `rovo-adapter.ts` (this task is comments + docs only)
- `@deprecated` tags are missing
- Automation templates document is incomplete (missing any of the 5 templates)
- Existing tests fail
- CLAUDE.md pipeline section not updated

## Testing Protocol

### No New Tests Required

This task adds deprecation comments (no behavior change) and documentation files. Existing tests must continue to pass unchanged.

### Validation

- [ ] **No regression**: `pnpm test:unit` passes
- [ ] **No type errors**: `pnpm typecheck` passes
- [ ] **No lint errors**: `pnpm lint` passes

## Triple Deliverable

| Production                                                                    | Sidecar                                                    | Test                               |
| ----------------------------------------------------------------------------- | ---------------------------------------------------------- | ---------------------------------- |
| `src/backend/services/rovo/rovo-adapter.ts` (modified — deprecation comments) | `src/backend/services/rovo/rovo-adapter.reqs.md` (updated) | Existing tests pass unchanged      |
| `docs/rovo-agent-automation-templates.md` (new)                               | -                                                          | Validated by template completeness |
| `CLAUDE.md` (updated pipeline section)                                        | -                                                          | Validated by pipeline accuracy     |

## Risks

| Risk                                                   | Mitigation                                                                              |
| ------------------------------------------------------ | --------------------------------------------------------------------------------------- |
| Premature deprecation before agent is validated        | Keep both paths functional; deprecation is documentation only, not removal              |
| Automation templates don't match future API changes    | Mark templates as "recommended patterns" subject to Rovo Agent API evolution            |
| Users confused by deprecation notices in code          | Notices are in code comments only, not user-facing; user-facing migration docs separate |
| Scheduled trigger implementation deferred indefinitely | Document as future enhancement with clear spec; no partial code to maintain             |
