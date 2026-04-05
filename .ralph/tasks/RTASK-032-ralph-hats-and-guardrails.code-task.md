---
id: RTASK-032
title: "Ralph Enhancement — Integrate Researcher/Enforcer/Debugger Hats and RULEBOOK Skills"
status: pending
priority: 1
type: infrastructure
dependencies: [RTASK-001, RTASK-002]
rulebook_refs: []
source: docs/plan.txt
---

# RTASK-032: Ralph Enhancement — Integrate Researcher/Enforcer/Debugger Hats and RULEBOOK Skills

## Objective

Extract architecturally sound improvements from `docs/plan.txt` (1,351 lines of knowledge-base workflow specification) and integrate them into the existing `ralph.yml` orchestrator. Specifically: add 3 new hats (researcher, enforcer, debugger), create RULEBOOK auto-loading via `.claude/skills/`, add RULEBOOK backpressure gates, and add RULEBOOK compliance guardrails.

## Context

`docs/plan.txt` is a conversation log proposing a 6-task knowledge-base workflow with 9+ hats, separate config files, and new directory structures (`raw/`, `wiki/`). The existing project already has 31 RTASKs, a 4-hat `ralph.yml`, and rulebook content at `docs/rulebook/` (being consolidated by RTASK-002 into `docs/rulebook/`). This task cherry-picks the valid improvements from plan.txt and rejects what conflicts with or duplicates existing architecture.

### What plan.txt Gets RIGHT (to adopt)

| Idea | Adaptation |
|------|-----------|
| Researcher hat — pre-implementation RULEBOOK consultation | Add as new hat between planner and builder |
| Enforcer hat — RULEBOOK compliance gate after code review | Add as new hat between critic and finalizer |
| Debugger hat — diagnose gate failures and repair | Add as new hat on enforcement.failed path |
| RULEBOOK as auto-loaded skill in `.claude/skills/` | `ralph.yml` already has `skills.dirs: [.claude/skills]` — create the files |
| RULEBOOK availability backpressure gates | Add `rulebook_available` and `rulebook_populated` gates |
| Rule ID citation in design decisions | Add as guardrail |

### What plan.txt Gets WRONG (to reject)

| Proposal | Reason for Rejection |
|----------|---------------------|
| 6 sequential tasks overlay (Tarea 1-6) | 31 RTASKs already exist — no parallel task structure |
| 9+ hats (ingester, compiler, auditor, documenter, tester) | Over-engineering — existing builder handles code+tests+docs via triple deliverable |
| `raw/` and `wiki/` directories | Sources already exist at `docs/rulebook/`, target at `docs/rulebook/` |
| Separate `ralph.knowledge-base.yml` | Single `ralph.yml` is simpler and sufficient |
| `HATS-BOOTSTRAP.md` + `HATS-CANONICAL.md` | Hats are defined in `ralph.yml` — no runtime auto-creation needed |
| `CLAUDE.md` at repository root | `ralph.yml` guardrails + `.claude/skills/` cover this |
| 6-domain format (FORGE-OPS, ARCH, QUALITY, RESILIENCE, OBSERVABILITY, SECURITY) | Existing RULEBOOK uses 8 categories (FORGE-OPS, SEC-PRIV, ARCH-SOLID, TEST-QA, GIT-CI, UI-ADS, ROVO-INTEG, GH-INTEG) |

## Technical Specification

### Phase 1: Create `.claude/skills/` Directory

The `ralph.yml` already configures `skills.dirs: [.claude/skills]` but the directory doesn't exist yet.

#### 1.1 `.claude/skills/RULEBOOK.md`

A reference file that tells Ralph where the canonical rulebook is and how to use it. NOT a copy of the full rulebook (that would create a sync problem). Instead, it's a concise guide:

```markdown
# RULEBOOK — Quick Reference

> Canonical location: `docs/rulebook/RULEBOOK.md`
> Source files: `docs/rulebook/sources/` (books/, links/, rules/)
> Read this file at the START of every task before implementing.

## How to Use

1. Read `docs/rulebook/RULEBOOK.md` at the start of each iteration
2. For the current task, identify applicable categories from the 8 below
3. Extract CRITICAL and HIGH rules relevant to the task
4. Cite rule IDs in code comments: `// [FORGE-OPS-005]`
5. If a CRITICAL rule is violated, stop and fix before proceeding

## Categories

| Category | Applies To |
|----------|-----------|
| FORGE-OPS | Forge runtime, manifest, storage, platform limits |
| SEC-PRIV | Data handling, auth, scopes, OAuth, secrets |
| ARCH-SOLID | All code tasks — types, models, adapters, orchestrators |
| TEST-QA | All tasks producing `.spec.ts` files |
| GIT-CI | RTASK-003, 004, 025, 026 (tooling and CI/CD) |
| UI-ADS | RTASK-018, 019, 020 (presentation layer, Custom UI) |
| ROVO-INTEG | RTASK-010, 013, 014 (Rovo adapter, resilience, triggers) |
| GH-INTEG | RTASK-011, 016, 017, 020 (GitHub integration, webhooks) |

## Priority Hierarchy (resolves contradictions)

1. FORGE-OPS — Forge platform limits override everything
2. SEC-PRIV — Security rules override aesthetic preferences
3. GH-INTEG — GitHub API rules override generic patterns
4. ARCH-SOLID — Architecture patterns
5. TEST-QA — Testing standards
6. GIT-CI — CI/CD conventions
7. UI-ADS — UI guidelines
8. ROVO-INTEG — Rovo/AI integration

## Rule Format

Every rule follows: DEFINICION / VALOR / IMPLEMENTACION / AUDITORIA
```

#### 1.2 `.claude/skills/RULEBOOK-INDEX.md`

Category-to-task mapping for all 8 RULEBOOK categories (see content above in the RULEBOOK.md guide).

### Phase 2: Update `ralph.yml` — Add 3 New Hats

#### Current Event Chain (4 hats)

```
build.start -> [planner] -> tasks.ready
  -> [builder] -> review.ready
    -> [critic] -> review.passed
      -> [finalizer] -> LOOP_COMPLETE / queue.advance
```

#### New Event Chain (7 hats)

```
build.start -> [planner] -> tasks.ready
  -> [researcher] -> research.done
    -> [builder] -> review.ready
      -> [critic] -> review.passed
        -> [enforcer] -> enforcement.passed / enforcement.failed
          -> enforcement.passed -> [finalizer] -> LOOP_COMPLETE / queue.advance
          -> enforcement.failed -> [debugger] -> tasks.ready (retry) / debug.escalate
```

#### 2.1 New Hat: Researcher

```yaml
researcher:
  name: "Researcher"
  description: "Pre-implementation RULEBOOK consultation — extracts relevant rules before Builder acts"
  triggers: ["tasks.ready"]
  publishes: ["research.done"]
  default_publishes: "research.done"
  instructions: |
    ## RESEARCHER MODE - RULEBOOK Pre-Flight

    You are the pre-flight check before implementation. Your job is to read the
    RULEBOOK and extract all rules relevant to the current runtime task.

    ### MANDATORY Reading (EVERY activation)
    1. Read the runtime task from event payload
    2. Read `docs/rulebook/RULEBOOK.md`
    3. Read `.claude/skills/RULEBOOK-INDEX.md` for category mapping
    4. Read `context.md` from `.ralph/specs/{task_name}/`

    ### Process
    1. Identify which RULEBOOK categories apply to this task
    2. Extract all CRITICAL and HIGH priority rules from those categories
    3. If the task involves external APIs (Rovo, GitHub, Jira) — verify
       rate limits, permissions, and sandbox restrictions
    4. Write findings to `.ralph/specs/{task_name}/rulebook-context.md`

    ### Output Format (rulebook-context.md)
    ```markdown
    ## RULEBOOK Context for [Task Name]

    ### Applicable Categories: [list]

    ### CRITICAL Rules (non-negotiable)
    - [FORGE-OPS-005]: [definition] -> Builder must [action]

    ### HIGH Priority Rules
    - [ARCH-SOLID-003]: [definition] -> Builder must [action]

    ### API Constraints (if applicable)
    - Rate limit: ...
    - Timeout: ...
    - Permissions: ...
    ```

    ### On Completion
    1. Verify `rulebook-context.md` is written and not empty
    2. Emit `research.done` with task_id and task_key

    ### Failure Handling
    If RULEBOOK.md is missing or empty:
    - Emit `build.blocked` with reason "RULEBOOK not available for research"
```

#### 2.2 New Hat: Enforcer

```yaml
enforcer:
  name: "Enforcer"
  description: "RULEBOOK compliance verification — checks deliverables against CRITICAL rules"
  triggers: ["review.passed"]
  publishes: ["enforcement.passed", "enforcement.failed"]
  default_publishes: "enforcement.failed"
  instructions: |
    ## ENFORCER MODE - RULEBOOK Compliance Gate

    The Critic already approved the code quality. You verify RULEBOOK compliance.

    ### Process
    1. Read `docs/rulebook/RULEBOOK.md`
    2. Read `rulebook-context.md` from `.ralph/specs/{task_name}/`
    3. Identify CRITICAL and HIGH rules applicable to this deliverable
    4. For each CRITICAL rule: verify implementation satisfies it
    5. For each HIGH rule: verify or document justified exception
    6. MEDIA priority rules: record but never block

    ### Decision
    ALL CRITICAL rules satisfied -> emit `enforcement.passed`
      Add to progress.md: "Enforcement: [N] CRITICAL rules verified"

    ANY CRITICAL rule violated -> emit `enforcement.failed` with:
      - Rule ID violated
      - Exact file and line
      - Required correction

    ### Never Block On
    - MEDIA priority rules (record only)
    - Style preferences not backed by a CRITICAL rule
    - Rules from categories that do not apply to this task type
```

#### 2.3 New Hat: Debugger

```yaml
debugger:
  name: "Debugger"
  description: "Diagnoses and repairs gate failures and enforcement violations"
  triggers: ["enforcement.failed", "build.blocked"]
  publishes: ["tasks.ready", "debug.escalate"]
  default_publishes: "tasks.ready"
  instructions: |
    ## DEBUGGER MODE - Failure Diagnosis and Repair

    A gate or enforcement check failed. Diagnose and repair.

    ### Process
    1. Read the exact error from the triggering event
    2. Locate the file and line of the problem
    3. Read the RULEBOOK — identify which rule was violated
    4. Classify the fix:
       - TRIVIAL (< 10 lines) -> repair directly
       - COMPLEX (requires redesign) -> document and escalate
       - FALSE POSITIVE (gate is wrong) -> document and escalate
    5. Apply fix if trivial
    6. Update progress.md with debug session notes

    ### Anti-Loop Protection
    If this is the 3rd consecutive failure of the same gate:
    - ALWAYS emit `debug.escalate` regardless of complexity

    ### Required Debug Log in progress.md
    ```
    ## Debug Session [timestamp]
    - Failed gate/event: [name]
    - Root cause: [description]
    - Fix applied: [description or ESCALATED]
    - Related RULEBOOK rule: [ID]
    - Attempt N of 3
    ```

    ### On Completion
    TRIVIAL fix -> emit `tasks.ready` (retry through normal flow)
    ESCALATED -> emit `debug.escalate` for human intervention
```

#### 2.4 Modified Hats

| Hat | Change | Before | After |
|-----|--------|--------|-------|
| builder | Add trigger | `["tasks.ready", "review.rejected", "finalization.failed"]` | `["research.done", "review.rejected", "finalization.failed"]` |
| finalizer | Change trigger | `["review.passed"]` | `["enforcement.passed"]` |
| planner | No change | — | — |
| critic | No change | — | — |

### Phase 3: Update `ralph.yml` — Guardrails and Gates

#### 3.1 New Guardrails (add to existing 10)

```yaml
- "Read the RULEBOOK (docs/rulebook/RULEBOOK.md) at the start of each iteration before acting — use .claude/skills/RULEBOOK-INDEX.md to identify applicable categories."
- "Every design decision must cite the RULEBOOK rule ID that supports it: // [ARCH-SOLID-003]. If no rule applies, note it in decisions.md."
- "If an action violates a CRITICAL RULEBOOK rule, stop and emit build.blocked instead of proceeding. CRITICAL rules are non-negotiable."
```

#### 3.2 New Backpressure Gates (add to existing 4)

```yaml
- name: rulebook_available
  command: test -f docs/rulebook/RULEBOOK.md
  on_fail: "RULEBOOK not found at docs/rulebook/RULEBOOK.md. Complete RTASK-002 first."
- name: rulebook_populated
  command: grep -q "DEFINICION" docs/rulebook/RULEBOOK.md
  on_fail: "RULEBOOK exists but has no rules. Complete RTASK-002 first."
```

### Phase 4: Cleanup References

1. Search all `.ralph/tasks/` files for `docs/rulebook/` references
2. Replace with `docs/rulebook/` or `docs/rulebook/sources/` as appropriate
3. Verify `ralph.yml` has no `docs/rulebook/` references

## Acceptance Criteria

- [ ] AC-01: `.claude/skills/` directory created with 2 files: `RULEBOOK.md` and `RULEBOOK-INDEX.md`
- [ ] AC-02: `ralph.yml` updated with 3 new hats (researcher, enforcer, debugger) and modified triggers for builder and finalizer
- [ ] AC-03: 3 guardrails added to `ralph.yml` core.guardrails (rulebook read, rule ID cite, CRITICAL violation block)
- [ ] AC-04: 2 backpressure gates added to `ralph.yml` (rulebook_available, rulebook_populated)
- [ ] AC-05: Event chain is coherent — every published event has a listener, no orphan events
- [ ] AC-06: Zero references to `docs/rulebook/` in `.ralph/tasks/` and `ralph.yml`
- [ ] AC-07: All RTASK files referencing `docs/rulebook/` updated to `docs/rulebook/`
- [ ] AC-08: `RTASK-032.reqs.md` sidecar created
- [ ] AC-09: No `raw/` or `wiki/` directories created
- [ ] AC-10: No separate `ralph.knowledge-base.yml` config created
- [ ] AC-11: No `HATS-BOOTSTRAP.md`, `HATS-CANONICAL.md`, or `CLAUDE.md` created
- [ ] AC-12: `ralph preflight` passes after all changes

## Triple Deliverable

| Production | Sidecar | Test |
|------------|---------|------|
| `.ralph/tasks/RTASK-032-ralph-hats-and-guardrails.code-task.md` | `.ralph/tasks/RTASK-032.reqs.md` | Validated by `ralph preflight` |
| `ralph.yml` (updated) | — | Validated by YAML parse + `ralph preflight` |
| `.claude/skills/RULEBOOK.md` + `.claude/skills/RULEBOOK-INDEX.md` | — | Validated by file existence + content check |

## Risks

| Risk | Mitigation |
|------|------------|
| Breaking existing event chain | Changes are surgical: builder gets 1 new trigger, finalizer gets 1 changed trigger. Planner and critic untouched. |
| RULEBOOK.md skills file becomes stale | Skills file is a reference guide, not a copy. Points to canonical `docs/rulebook/RULEBOOK.md`. |
| Enforcer too strict, blocking progress | Enforcer only blocks on CRITICAL rules. HIGH = warn. MEDIA = record. |
| Debugger enters infinite loop | Anti-loop: after 3 consecutive failures of same gate, always escalate. |
| Backpressure gates fail before RTASK-001 | Gates reference `docs/rulebook/RULEBOOK.md` which depends on RTASK-002. This task depends on RTASK-001 and RTASK-002. |

## QA Gates

### Pre-Implementation Gates
- [ ] **GATE-READY**: Dependencies RTASK-001 and RTASK-002 completed
- [ ] **GATE-SPEC**: `docs/plan.txt` fully analyzed (1,351 lines), current `ralph.yml` understood
- [ ] **GATE-DESIGN**: Hat event chain diagram documented before modification

### Implementation Gates (per phase)
- [ ] **GATE-PHASE1**: `.claude/skills/` created with RULEBOOK.md and RULEBOOK-INDEX.md
- [ ] **GATE-PHASE2**: `ralph.yml` updated with 3 new hats, modified triggers, guardrails, gates
- [ ] **GATE-PHASE3**: Event chain validated — no orphan events, no broken triggers
- [ ] **GATE-PHASE4**: All `docs/rulebook/` references replaced, `ralph preflight` passes

### Post-Implementation Gates
- [ ] **GATE-YAML-VALID**: `ralph.yml` parses as valid YAML
- [ ] **GATE-NO-DUPE-HATS**: No duplicate hat names in `ralph.yml`
- [ ] **GATE-NO-ORPHAN-EVENTS**: Every published event has at least one listener hat
- [ ] **GATE-NO-EXTRANEOUS**: No `raw/`, `wiki/`, `ralph.knowledge-base.yml`, `CLAUDE.md` created
- [ ] **GATE-REQS**: `.reqs.md` sidecar created
- [ ] **GATE-ZERO-REFS**: `grep -r "docs/rulebook/sources" .ralph/ docs/ ralph.yml` returns zero results

## Requirements Creation Protocol

1. **Before implementation**: Create `.reqs.md` listing all requirements from plan.txt analysis
2. **Format**: Use `.ralph/templates/reqs-template.md` format
3. **Content**: Each AC maps to a requirement with traceability to plan.txt source
4. **Traceability**: Every adopted/rejected idea from plan.txt documented

## Implementation Protocol

### Step 1: Preparation
1. Read `docs/plan.txt` completely (1,351 lines)
2. Read current `ralph.yml` (4 hats, guardrails, gates)
3. Read `docs/rulebook/RULEBOOK.md` to understand current structure
4. Create `.reqs.md` sidecar

### Step 2: Create `.claude/skills/`
1. Create directory `.claude/skills/`
2. Create `RULEBOOK.md` — reference guide pointing to canonical rulebook
3. Create `RULEBOOK-INDEX.md` — category-to-task mapping
4. Verify `ralph.yml` has `skills.dirs: [.claude/skills]` (already exists)

### Step 3: Update `ralph.yml` — Hats
1. Add `researcher` hat (triggers: `tasks.ready`, publishes: `research.done`)
2. Modify `builder` triggers: add `research.done`, keep `review.rejected`, `finalization.failed`
3. Add `enforcer` hat (triggers: `review.passed`, publishes: `enforcement.passed`/`enforcement.failed`)
4. Add `debugger` hat (triggers: `enforcement.failed`/`build.blocked`, publishes: `tasks.ready`/`debug.escalate`)
5. Modify `finalizer` triggers: change `review.passed` to `enforcement.passed`

### Step 4: Update `ralph.yml` — Guardrails and Gates
1. Add 3 RULEBOOK guardrails to `core.guardrails`
2. Add 2 RULEBOOK gates to `backpressure.gates`

### Step 5: Fix References
1. `grep -r "docs/rulebook/sources" .ralph/ docs/ ralph.yml`
2. Replace all `docs/rulebook/` with `docs/rulebook/` or `docs/rulebook/sources/`
3. Verify zero remaining references

### Step 6: Validate
1. Parse `ralph.yml` as valid YAML
2. Verify event chain: `build.start` → planner → researcher → builder → critic → enforcer → finalizer
3. Verify failure path: enforcement.failed → debugger → tasks.ready (retry) or debug.escalate
4. Verify `.claude/skills/` files exist and are non-empty
5. Run `ralph preflight` — must pass

## Auditing Protocol

### Critic Review Checklist
- [ ] `ralph.yml` is valid YAML (parse check)
- [ ] Event chain complete — every published event has at least one listener
- [ ] No orphan triggers (trigger published but nothing subscribes)
- [ ] New hats have correct trigger/publish chain
- [ ] Existing hat instructions intact (planner, builder, critic, finalizer)
- [ ] `.claude/skills/` has exactly 2 files (RULEBOOK.md, RULEBOOK-INDEX.md)
- [ ] No references to `docs/rulebook/` remain
- [ ] No `raw/`, `wiki/`, `CLAUDE.md`, `HATS-BOOTSTRAP.md` created
- [ ] Backpressure gates reference correct paths

### Rejection Criteria
The critic MUST reject if:
- `ralph.yml` has invalid YAML syntax
- Event chain has orphan events (published with no listener)
- Any existing hat removed without replacement
- `.claude/skills/` directory missing
- RULEBOOK reference guide points to wrong path

## Testing Protocol

### Validation Tests
- [ ] `ralph preflight` passes with updated config
- [ ] `ralph run --dry-run` shows 7 hats correctly configured
- [ ] `.claude/skills/RULEBOOK.md` contains reference to canonical rulebook
- [ ] `.claude/skills/RULEBOOK-INDEX.md` has all 8 categories mapped to RTASKs
- [ ] Event chain: `build.start` → planner → researcher → builder → critic → enforcer → finalizer is complete
- [ ] Failure path: `enforcement.failed` → debugger → `tasks.ready` (retry) works
- [ ] `grep -r "docs/rulebook/sources" .ralph/ docs/ ralph.yml` returns nothing

### Mock Strategy
- This is an infrastructure task — no code mocks needed
- Validation uses `ralph preflight` and file system checks
