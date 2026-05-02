---
id: RTASK-000-FULL
title: 'Sequential Pipeline: RTASK-034 through RTASK-044'
status: pending
priority: 0
type: meta
dependencies: []
rulebook_refs: []
spec: .ralph/tasks/RTASK-000-FULL-run-all-tasks.code-task.md
---

# RTASK-000-FULL: Sequential Pipeline — RTASK-034 through RTASK-044

## Objective

Implement RTASK-034 through RTASK-044 sequentially inside a single Ralph loop. Tasks 001-036 and 042 are already implemented in the codebase. Each step reads the corresponding task file, implements it fully (TDD, triple deliverable, QA gates), commits, then advances to the next.

## Completed Steps (DO NOT re-implement)

These RTASKs have commits in git and are verified done:

| Step | RTASK     | Evidence                                                                           |
| ---- | --------- | ---------------------------------------------------------------------------------- |
| 1    | RTASK-034 | `ae9c912 fix(RTASK-034): pass owner/repo format to getPRData`                      |
| 2    | RTASK-035 | `159f218 feat(RTASK-035): add AxisRow, IssuePanel, and opening state tests`        |
| 3    | RTASK-036 | `6986b97 docs(RTASK-036): add deprecation notices and automation templates`        |
| 4    | RTASK-042 | `c11d3f4 feat(RTASK-042): add searchByJQL, getEpicChildren, discoverEpicLinkField` |

**The Planner MUST start from Step 5 (RTASK-037).** Steps 1-4 are DONE.

## How This Task Works

This is NOT a normal task with a fixed set of files. Instead:

- The **Planner** creates one numbered step per RTASK (11 steps total)
- For each step, the Planner reads the RTASK file and creates runtime tasks from its content
- The **Builder** implements the runtime tasks following that RTASK's spec
- The **Critic** and **Enforcer** validate against that RTASK's acceptance criteria
- The **Finalizer** verifies QA gates pass, then advances to the next step

## Dependency Graph

```
Step 1:  RTASK-034 (Agent Actions Handler)         — DONE ✓
Step 2:  RTASK-035 (Agent Frontend)                — DONE ✓
Step 3:  RTASK-036 (Agent Automation & Deprecation) — DONE ✓
Step 4:  RTASK-042 (Jira Adapter Extensions)       — DONE ✓
Step 5:  RTASK-037 (KG: Types & Storage)           — fundación del grafo ← START HERE
Step 6:  RTASK-038 (KG: Jira Indexer)              — depende de 037, 042 (done)
Step 7:  RTASK-039 (KG: Confluence Indexer)        — depende de 037, 038
Step 8:  RTASK-040 (KG: GitHub Indexer)            — depende de 037, 038
Step 9:  RTASK-041 (KG: Context Consumer)          — depende de 037-040, 042 (done)
Step 10: RTASK-043 (KG: Agent Prompts)             — depende de 041
Step 11: RTASK-044 (KG: Maintenance)               — depende de 037-040
```

## Plan Steps (Planner MUST follow this exact order)

The Planner MUST write these 7 REMAINING steps to `plan.md`. Steps 1-4 are DONE (RTASK-034, 035, 036, 042). No deviations. No reordering.

| Step  | RTASK File                                                                            | Title                                            |
| ----- | ------------------------------------------------------------------------------------- | ------------------------------------------------ |
| ~~1~~ | ~~RTASK-034~~                                                                         | ~~Rovo Agent Actions Handler~~ **DONE**          |
| ~~2~~ | ~~RTASK-035~~                                                                         | ~~Rovo Agent Frontend~~ **DONE**                 |
| ~~3~~ | ~~RTASK-036~~                                                                         | ~~Rovo Agent Automation & Deprecation~~ **DONE** |
| ~~4~~ | ~~RTASK-042~~                                                                         | ~~Jira Adapter Extensions~~ **DONE**             |
| 5     | `.ralph/tasks/RTASK-037-infrastructure-relationship-index-types-storage.code-task.md` | KG: Types & Storage                              |
| 6     | `.ralph/tasks/RTASK-038-orchestration-jira-relationship-indexer.code-task.md`         | KG: Jira Indexer                                 |
| 7     | `.ralph/tasks/RTASK-039-orchestration-confluence-relationship-indexer.code-task.md`   | KG: Confluence Indexer                           |
| 8     | `.ralph/tasks/RTASK-040-orchestration-github-relationship-indexer.code-task.md`       | KG: GitHub Indexer                               |
| 9     | `.ralph/tasks/RTASK-041-orchestration-relationship-context-consumer.code-task.md`     | KG: Context Consumer                             |
| 10    | `.ralph/tasks/RTASK-043-orchestration-rovo-agent-relationship-prompts.code-task.md`   | KG: Agent Prompts                                |
| 11    | `.ralph/tasks/RTASK-044-infrastructure-relationship-index-maintenance.code-task.md`   | KG: Maintenance                                  |

## Planner Instructions (CRITICAL)

### On First Activation (build.start)

1. Create working directory: `.ralph/specs/RTASK-000-FULL/`
2. Write `context.md` with:
   - This is a pipeline task executing RTASKs 037-044 (Steps 5-11)
   - RTASK-001 through RTASK-036 and RTASK-042 are ALREADY IMPLEMENTED — do not re-implement
   - Each step reads an external task file and implements its full spec
   - The current task file IS the source of truth for each step
   - Phase 1 (Steps 1-3): Rovo Agent — DONE
   - Phase 2 (Step 4): Jira adapter extensions — DONE
   - Phase 3 (Steps 5-11): Knowledge Graph — types, indexers, consumer, prompts, maintenance ← CURRENT
   - Key constraint: Forge Storage as key-value backend, not a graph DB
3. Write `plan.md` with all 11 steps (Steps 1-4 marked DONE). Format per step:

```
## Plan: RTASK-000-FULL Sequential Pipeline

### Step 1: RTASK-034 — Rovo Agent Actions Handler
- Source: .ralph/tasks/RTASK-034-orchestration-rovo-agent-actions.code-task.md
- Status: DONE

### Step 2: RTASK-035 — Rovo Agent Frontend
- Source: .ralph/tasks/RTASK-035-presentation-rovo-agent-frontend.code-task.md
- Status: DONE

### Step 3: RTASK-036 — Rovo Agent Automation & Deprecation
- Source: .ralph/tasks/RTASK-036-orchestration-rovo-agent-automation.code-task.md
- Status: DONE

### Step 4: RTASK-042 — Jira Adapter Extensions
- Source: .ralph/tasks/RTASK-042-infrastructure-jira-adapter-extensions.code-task.md
- Status: DONE

### Step 5: RTASK-037 — KG: Types & Storage
- Source: .ralph/tasks/RTASK-037-infrastructure-relationship-index-types-storage.code-task.md
- Status: pending

### Step 6: RTASK-038 — KG: Jira Indexer
- Source: .ralph/tasks/RTASK-038-orchestration-jira-relationship-indexer.code-task.md
- Status: pending

### Step 7: RTASK-039 — KG: Confluence Indexer
- Source: .ralph/tasks/RTASK-039-orchestration-confluence-relationship-indexer.code-task.md
- Status: pending

### Step 8: RTASK-040 — KG: GitHub Indexer
- Source: .ralph/tasks/RTASK-040-orchestration-github-relationship-indexer.code-task.md
- Status: pending

### Step 9: RTASK-041 — KG: Context Consumer
- Source: .ralph/tasks/RTASK-041-orchestration-relationship-context-consumer.code-task.md
- Status: pending

### Step 10: RTASK-043 — KG: Agent Prompts
- Source: .ralph/tasks/RTASK-043-orchestration-rovo-agent-relationship-prompts.code-task.md
- Status: pending

### Step 11: RTASK-044 — KG: Maintenance
- Source: .ralph/tasks/RTASK-044-infrastructure-relationship-index-maintenance.code-task.md
- Status: pending
```

4. Write `progress.md`:

```
## Pipeline Progress
- Current Step: 5 (RTASK-037 — KG: Types & Storage)
- Completed: Step 1 (RTASK-034), Step 2 (RTASK-035), Step 3 (RTASK-036), Step 4 (RTASK-042)
- Failed: (none)
- Phase: Knowledge Graph
```

5. Read the RTASK-037 task file
6. Create runtime tasks from RTASK-037's Technical Specification
7. Emit `tasks.ready`

### On Subsequent Activation (queue.advance)

1. Re-read `progress.md` to find current step
2. Check if current step's runtime tasks are all closed
3. If YES:
   a. Mark current step as completed in `plan.md`
   b. Add to Completed list in `progress.md`
   c. Move to next step
   d. Update Phase in `progress.md` if entering new phase
   e. Read the next step's RTASK file
   f. Create runtime tasks from that RTASK's Technical Specification
   g. Emit `tasks.ready`
4. If NO remaining steps:
   - Leave queue empty for Finalizer

### Runtime Task Creation

For each step, the Planner MUST:

1. Read the RTASK file specified in the step's Source path
2. Extract the Technical Specification section
3. Create runtime tasks from that spec — one per file or logical unit
4. Use stable keys: `reg:rtask000full:step-XX:slug`
5. Include the RTASK's acceptance criteria in each runtime task description

## Builder Instructions (CRITICAL)

### Before Implementing Each Runtime Task

1. Read the source RTASK file for the current step (path from `plan.md`)
2. Read the Rulebook: `docs/rulebook/RULEBOOK.md`
3. Read `rulebook-context.md` from the researcher
4. Follow the RTASK's Implementation Protocol exactly
5. Read existing source files that the RTASK will modify — understand current state before changing

### Key Rules

- Follow the current step's RTASK spec, NOT this meta-task
- Each step has its own acceptance criteria, triple deliverable, QA gates
- Commit after each completed step with format: `type(scope): description [REG-XXX]`
- Run QA gates after each step: `pnpm typecheck && pnpm lint && pnpm format:check && pnpm test:unit`
- NEVER break existing functionality — all changes to existing files MUST be backward-compatible

### Per-Step Special Instructions

| Step         | Phase          | Special Instructions                                                                                                                                                                                                 |
| ------------ | -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ~~1 (034)~~  | ~~Agent~~      | ~~Implement agent action handler~~ **DONE**                                                                                                                                                                          |
| ~~2 (035)~~  | ~~Agent~~      | ~~MODIFY existing issue-panel~~ **DONE**                                                                                                                                                                             |
| ~~3 (036)~~  | ~~Agent~~      | ~~Add deprecation notices~~ **DONE**                                                                                                                                                                                 |
| ~~4 (042)~~  | ~~KG Prep~~    | ~~EXTEND JiraTicketData~~ **DONE**                                                                                                                                                                                   |
| **5 (037)**  | KG Core        | New files: `relationship-index.ts` types + `relationship-storage.ts`. Foundation for Steps 6-11.                                                                                                                     |
| **6 (038)**  | KG Indexer     | `jira-indexer.ts`. Uses `epicKey` from Step 4 (done). Add lazy hydration hooks in `agent-action.ts` and `workflow-transition.ts`.                                                                                    |
| **7 (039)**  | KG Indexer     | `confluence-indexer.ts`. Reuses pattern from Step 6. Staleness factor calculation.                                                                                                                                   |
| **8 (040)**  | KG Indexer     | `github-indexer.ts`. Reuses pattern from Steps 6-7. PR key format: `github:owner/repo/pull/N`.                                                                                                                       |
| **9 (041)**  | KG Consumer    | CRITICAL STEP. Modifies 6 existing files. ALL changes MUST be backward-compatible. Includes delivery gate bug fix (`documentationRefs`). Test that existing tests pass unchanged.                                    |
| **10 (043)** | KG Prompts     | New files: prompt templates + `context-formatter.ts`. MODIFY `agent-action.ts` to inject formatted context. Graceful degradation when no relationship context.                                                       |
| **11 (044)** | KG Maintenance | New files: `graph-maintenance.ts` + `scheduled-indexer.ts`. MODIFY `manifest.yml` (add scheduled trigger). MODIFY `workflow-transition.ts` and `github-webhook.ts` (add re-index hooks). Verify `forge lint` passes. |

## Researcher Instructions

For each step, the researcher MUST:

1. Read the source RTASK file for the current step
2. Extract rulebook_refs from that RTASK's frontmatter
3. Read those rulebook sections from `docs/rulebook/RULEBOOK.md`
4. Read the existing source files that the RTASK will modify or depend on
5. Write findings to `.ralph/specs/RTASK-000-FULL/rulebook-context.md`
6. Update the context for the current step's requirements

## Critic Instructions

For each step, the critic MUST:

1. Read the source RTASK file for the current step
2. Validate against THAT RTASK's acceptance criteria and auditing protocol
3. Verify the triple deliverable for THAT RTASK's files
4. Re-run QA gates: `pnpm typecheck && pnpm lint && pnpm format:check && pnpm test:unit`
5. For Steps 4, 9: Verify that existing tests pass unchanged (backward compatibility)

## Enforcer Instructions

For each step, the enforcer MUST:

1. Read the source RTASK file's rulebook_refs
2. Verify compliance against THOSE specific rules
3. Only block on CRITICAL rules from the current step's RTASK
4. For Steps 4, 9: Extra scrutiny on backward compatibility — no existing caller may break

## Finalizer Instructions (CRITICAL)

The finalizer decides between `queue.advance` and `LOOP_COMPLETE`:

1. Re-read `progress.md` and `plan.md`
2. Verify current step's QA gates pass:
   - `pnpm typecheck` passes
   - `pnpm lint` passes
   - `pnpm format:check` passes
   - `pnpm test:unit` passes
   - Zero `any` in new code
3. Verify current step's acceptance criteria from the RTASK file
4. If current step is complete and more steps remain:
   - Emit `queue.advance`
5. If all 11 steps are complete:
   - Run project-wide QA gates
   - Verify `forge lint` passes
   - Verify `forge deploy -e kcantero` succeeds
   - Emit `LOOP_COMPLETE`

## Acceptance Criteria

- [ ] AC-01: All 7 remaining RTASKs (037-041, 043-044) implemented in the specified order (Steps 1-4 already done)
- [ ] AC-02: Each RTASK passes its own acceptance criteria before advancing
- [ ] AC-03: `pnpm typecheck` passes for the full project
- [ ] AC-04: `pnpm lint` passes with zero warnings
- [ ] AC-05: `pnpm test:unit` passes with project-wide coverage > 85%
- [ ] AC-06: `pnpm format:check` passes
- [ ] AC-07: Zero `any` types in new code
- [ ] AC-08: All `.reqs.md` sidecars exist for new production files
- [ ] AC-09: All new `.spec.ts` test files exist and pass
- [ ] AC-10: `forge lint` passes
- [ ] AC-11: Existing tests pass unchanged for backward-compatible steps (RTASK-042, RTASK-041)
- [ ] AC-12: Delivery gate `documentationRefs` bug fixed (RTASK-041)
- [ ] AC-13: Progress log in `.ralph/specs/RTASK-000-FULL/progress.md` is complete
- [ ] AC-14: One commit per completed RTASK with correct format

## QA Gates

### Per-Step Gates (enforced by Finalizer)

- [ ] `pnpm typecheck` passes
- [ ] `pnpm lint` passes
- [ ] `pnpm format:check` passes
- [ ] `pnpm test:unit` passes
- [ ] Zero `any` in step's new files
- [ ] Triple deliverable complete for step's files

### Pipeline-Level Gates (enforced at LOOP_COMPLETE)

- [ ] `pnpm typecheck` passes (full project)
- [ ] `pnpm lint` passes (full project)
- [ ] `pnpm test:unit` passes (full project, coverage > 85%)
- [ ] `pnpm format:check` passes (full project)
- [ ] Zero `any` in `src/` (full project)
- [ ] `forge lint` passes
- [ ] `forge deploy -e kcantero` succeeds

## Risks

| Risk                                          | Mitigation                                                                       |
| --------------------------------------------- | -------------------------------------------------------------------------------- |
| Context window fills over 11 tasks            | Each step gets fresh context via queue.advance; planner re-reads state each time |
| Single step failure blocks pipeline           | Debugger hat repairs; 3-attempt limit; progress.md tracks failures               |
| Builder confused about which spec to follow   | Progress.md always shows current step; planner reads correct RTASK file          |
| RTASK-041 backward compatibility break        | Critic enforces existing tests pass unchanged; extra scrutiny on Step 9          |
| Forge Storage limits exceeded                 | RTASK-037 caps edge lists; RTASK-044 compacts storage                            |
| Forge function timeout during graph traversal | RTASK-037 limits to 2-hop; timeout guard at 5s                                   |

## Usage

```bash
ralph run -c ralph.yml -p ".ralph/tasks/RTASK-000-FULL-run-all-tasks.code-task.md"
```
