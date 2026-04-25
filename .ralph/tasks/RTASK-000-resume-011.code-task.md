---
id: RTASK-000-RESUME
title: 'Resume Pipeline: RTASK-011 through RTASK-031'
status: pending
priority: 0
type: meta
dependencies: [RTASK-010]
rulebook_refs: []
spec: .ralph/tasks/RTASK-000-resume-011.code-task.md
---

# RTASK-000-RESUME: Resume Pipeline — RTASK-011 through RTASK-031

## Objective

Resume the sequential pipeline after RTASK-012 (Confluence Adapter). Tasks RTASK-005 through RTASK-012 are already completed, plus RTASK-013, RTASK-021, and RTASK-024. Implement the remaining 16 RTASKs sequentially inside a single Ralph loop, reordered to prioritize business logic and app functionality first, with testing/deployment at the end. Each step reads the corresponding task file, implements it fully (TDD, triple deliverable, QA gates), commits, then advances to the next.

## How This Task Works

This is NOT a normal task with a fixed set of files. Instead:

- The **Planner** creates one numbered step per RTASK (16 steps total)
- For each step, the Planner reads the RTASK file and creates runtime tasks from its content
- The **Builder** implements the runtime tasks following that RTASK's spec
- The **Critic** and **Enforcer** validate against that RTASK's acceptance criteria
- The **Finalizer** verifies QA gates pass, then advances to the next step

## Already Completed (DO NOT re-implement)

These tasks are DONE. Skip them entirely:

| RTASK | Title |
|-------|-------|
| RTASK-005 | Domain Layer - Types and Models |
| RTASK-006 | Domain Layer - Scoring Engine |
| RTASK-007 | Domain Layer - Inconsistency Detector |
| RTASK-008 | Domain Layer - Quality Gate Rules Engine |
| RTASK-009 | Integration Layer - Jira API Adapter |
| RTASK-010 | Integration Layer - Rovo API Adapter |
| RTASK-011 | Integration Layer - GitHub Adapter |
| RTASK-012 | Integration Layer - Confluence Adapter |
| RTASK-013 | Integration Layer - Resilience (inline in adapters) |
| RTASK-021 | Observability - Structured Logger (inline in adapters) |
| RTASK-024 | Configuration - Project Settings |

## Plan Steps (Planner MUST follow this exact order)

The Planner MUST write these 16 steps to `plan.md`. No deviations. No reordering.

**Reordering rationale:** Business logic and app functionality first (the app becomes testable after Step 4), then UI (complete app after Step 7), then observability, testing, CI/CD, and documentation.

### Phase 1: Business Logic / Orchestration (app becomes functional)

| Step | RTASK File                                                              | Title                                    | Rationale |
| ---- | ----------------------------------------------------------------------- | ---------------------------------------- | --------- |
| 1    | `.ralph/tasks/RTASK-017-orchestration-enforcement-actions.code-task.md` | Orchestration - Enforcement Actions      | MUST go first. Triggers (014, 016) depend on enforcement functions. Without this, triggers duplicate blocking/comment logic. |
| 2    | `.ralph/tasks/RTASK-014-orchestration-jira-triggers.code-task.md`       | Orchestration - Jira Triggers            | Primary Jira-side trigger. Calls enforcement from Step 1. Handler path: `src/backend/resolvers/workflow-transition.handler` (per manifest.yml). |
| 3    | `.ralph/tasks/RTASK-016-orchestration-github-webhook.code-task.md`      | Orchestration - GitHub Webhook           | Primary GitHub-side trigger. Calls enforcement from Step 1. Handler path: `src/backend/resolvers/github-webhook.handler` (per manifest.yml). |
| 4    | `.ralph/tasks/RTASK-020-presentation-github-pr-comments.code-task.md`   | Presentation - GitHub PR Comments        | Markdown templates for PRs. Only depends on 011 (done) and 008 (done). No resolver dependency. |

> **MILESTONE: App is FUNCTIONAL after Step 4** — intercepts tickets and PRs, evaluates quality gates, blocks/comments.

### Phase 2: Frontend / UI (app becomes visible)

| Step | RTASK File                                                              | Title                                    | Rationale |
| ---- | ----------------------------------------------------------------------- | ---------------------------------------- | --------- |
| 5    | `.ralph/tasks/RTASK-015-orchestration-resolvers.code-task.md`           | Orchestration - Resolvers (Forge Bridge) | Frontend-backend bridge via @forge/resolver. Required before UI panels. |
| 6    | `.ralph/tasks/RTASK-018-presentation-jira-issue-panel.code-task.md`     | Presentation - Jira Issue Panel          | Spider chart in Jira issue view. Depends on 015 (Step 5). |
| 7    | `.ralph/tasks/RTASK-019-presentation-admin-dashboard.code-task.md`      | Presentation - Admin Dashboard           | Admin config + audit log. Depends on 015 (Step 5) and 024 (done). |

> **MILESTONE: App is COMPLETE and VISIBLE after Step 7** — full UI in Jira + Admin dashboard.

### Phase 3: Observability (production hardening, not needed to try the app)

| Step | RTASK File                                                              | Title                                    |
| ---- | ----------------------------------------------------------------------- | ---------------------------------------- |
| 8    | `.ralph/tasks/RTASK-022-observability-sentry.code-task.md`              | Observability - Sentry Integration       |
| 9    | `.ralph/tasks/RTASK-023-observability-health-checks.code-task.md`       | Observability - Health Checks            |

### Phase 4: Testing

| Step | RTASK File                                                              | Title                                    |
| ---- | ----------------------------------------------------------------------- | ---------------------------------------- |
| 10   | `.ralph/tasks/RTASK-027-testing-jest-unit-suite.code-task.md`           | Testing - Jest Unit Suite                |
| 11   | `.ralph/tasks/RTASK-028-testing-integration-tests.code-task.md`         | Testing - Integration Tests              |
| 12   | `.ralph/tasks/RTASK-029-testing-e2e-playwright.code-task.md`            | Testing - E2E Playwright                 |

### Phase 5: CI/CD and Release

| Step | RTASK File                                                              | Title                                    |
| ---- | ----------------------------------------------------------------------- | ---------------------------------------- |
| 13   | `.ralph/tasks/RTASK-025-cicd-github-actions.code-task.md`               | CI/CD - GitHub Actions                   |
| 14   | `.ralph/tasks/RTASK-026-cicd-semantic-release.code-task.md`             | CI/CD - Semantic Release                 |

### Phase 6: Closure

| Step | RTASK File                                                              | Title                                    |
| ---- | ----------------------------------------------------------------------- | ---------------------------------------- |
| 15   | `.ralph/tasks/RTASK-030-documentation-readmes-marketplace.code-task.md` | Documentation - READMEs and Marketplace  |
| 16   | `.ralph/tasks/RTASK-031-audit-coverage.code-task.md`                    | Audit Coverage                           |

## Critical Implementation Notes

### Shared Evaluation Pipeline (applies to Steps 2 and 3)

Both RTASK-014 (Jira Triggers) and RTASK-016 (GitHub Webhook) execute the SAME evaluation pipeline:
```
fetch ticket data -> fetch Rovo context -> detect inconsistencies -> calculate score -> evaluate quality gate -> execute enforcement
```

The Builder MUST extract this into a shared module (e.g. `src/backend/services/evaluation/evaluation-pipeline.ts`) so both handlers call a single `evaluateTicketForGate(ticketKey, gateType)` function instead of duplicating orchestration logic.

### Handler Paths (MUST match manifest.yml)

The `manifest.yml` declares these handler paths. Files MUST be created at these exact locations:

- **Jira trigger handler**: `src/backend/resolvers/workflow-transition.handler` (NOT `src/backend/handlers/workflow-trigger.ts`)
- **GitHub webhook handler**: `src/backend/resolvers/github-webhook.handler` (NOT `src/backend/handlers/github-webhook.ts`)

### Enforcement Dependency (Steps 2 and 3 depend on Step 1)

RTASK-014 and RTASK-016 MUST import and call enforcement functions from RTASK-017:
- `blockTransition()`, `addComment()` for Jira triggers
- `blockPR()`, `approvePR()`, `addComment()` for GitHub webhooks
- Do NOT reimplement blocking/comment logic inline in the handlers.

### Audit Log

No dedicated audit log service exists. The `AuditLogEntry` type is defined in `src/backend/types/audit-log.ts`. Handlers should write audit entries directly to Forge Storage using `@forge/api` storage API. The resolvers (Step 5) will expose `getAuditLog()` to query these entries.

## Planner Instructions (CRITICAL)

### On First Activation (build.start)

1. Create working directory: `.ralph/specs/RTASK-000-resume-011/`
2. Write `context.md` with:
   - This is a RESUME pipeline task executing 16 RTASKs sequentially (reordered for business logic first)
   - RTASK-005 through RTASK-012 are already completed, plus RTASK-013, RTASK-021, RTASK-024 — DO NOT re-implement them
   - Each step reads an external task file and implements its full spec
   - The current task file IS the source of truth for each step
   - CRITICAL: Read the "Critical Implementation Notes" section above for shared pipeline and handler path requirements
3. Write `plan.md` with the 16 steps from the table above. Format:

```
## Plan: RTASK-000-RESUME Pipeline (16 RTASKs, reordered)

### Step 1: RTASK-017 — Orchestration - Enforcement Actions
- Source: .ralph/tasks/RTASK-017-orchestration-enforcement-actions.code-task.md
- Status: pending

### Step 2: RTASK-014 — Orchestration - Jira Triggers
- Source: .ralph/tasks/RTASK-014-orchestration-jira-triggers.code-task.md
- Status: pending

[... repeat for all 16 steps following the exact order from the Plan Steps table ...]
```

4. Write `progress.md`:

```
## Pipeline Progress
- Current Step: 1 (RTASK-017)
- Completed: RTASK-005, RTASK-006, RTASK-007, RTASK-008, RTASK-009, RTASK-010, RTASK-011, RTASK-012, RTASK-013, RTASK-021, RTASK-024
- Failed: (none)
```

5. Read the RTASK-017 task file (`.ralph/tasks/RTASK-017-orchestration-enforcement-actions.code-task.md`)
6. Create runtime tasks from RTASK-017's Technical Specification
7. Emit `tasks.ready`

### On Subsequent Activation (queue.advance)

1. Re-read `progress.md` to find current step
2. Check if current step's runtime tasks are all closed
3. If YES:
   a. Mark current step as completed in `plan.md`
   b. Add to Completed list in `progress.md`
   c. Move to next step
   d. Read the next step's RTASK file
   e. Create runtime tasks from that RTASK's Technical Specification
   f. Emit `tasks.ready`
4. If NO remaining steps:
   - Leave queue empty for Finalizer

### Runtime Task Creation

For each step, the Planner MUST:

1. Read the RTASK file specified in the step's Source path
2. Extract the Technical Specification section
3. Create runtime tasks from that spec — one per file or logical unit
4. Use stable keys: `reg:rtask000resume:step-XX:slug`
5. Include the RTASK's acceptance criteria in each runtime task description

## Builder Instructions (CRITICAL)

### Before Implementing Each Runtime Task

1. Read the source RTASK file for the current step (path from `plan.md`)
2. Read the Rulebook: `docs/rulebook/RULEBOOK.md`
3. Read `rulebook-context.md` from the researcher
4. Follow the RTASK's Implementation Protocol exactly
5. Check existing code — previous tasks (RTASK-005 through RTASK-012, plus RTASK-013, RTASK-021, RTASK-024) are already implemented. Do NOT recreate or overwrite their files unless the current RTASK explicitly modifies them.

### Key Rules

- Follow the current step's RTASK spec, NOT this meta-task
- Each step has its own acceptance criteria, triple deliverable, QA gates
- Commit after each completed step with format: `type(scope): description [RTASK-NNN]`
- Run QA gates after each step: `npm run typecheck && npm run lint && npm run format:check && npm run test:unit`

## Researcher Instructions

For each step, the researcher MUST:

1. Read the source RTASK file for the current step
2. Extract rulebook_refs from that RTASK's frontmatter
3. Read those rulebook sections from `docs/rulebook/RULEBOOK.md`
4. Write findings to `.ralph/specs/RTASK-000-resume-011/rulebook-context.md`
5. Update the context for the current step's requirements

## Critic Instructions

For each step, the critic MUST:

1. Read the source RTASK file for the current step
2. Validate against THAT RTASK's acceptance criteria and auditing protocol
3. Verify the triple deliverable for THAT RTASK's files
4. Re-run QA gates: `npm run typecheck && npm run lint && npm run format:check && npm run test:unit`

## Enforcer Instructions

For each step, the enforcer MUST:

1. Read the source RTASK file's rulebook_refs
2. Verify compliance against THOSE specific rules
3. Only block on CRITICAL rules from the current step's RTASK

## Finalizer Instructions (CRITICAL)

The finalizer decides between `queue.advance` and `LOOP_COMPLETE`:

1. Re-read `progress.md` and `plan.md`
2. Verify current step's QA gates pass:
   - `npm run typecheck` passes
   - `npm run lint` passes
   - `npm run format:check` passes
   - `npm run test:unit` passes
   - Zero `any` in new code
3. Verify current step's acceptance criteria from the RTASK file
4. If current step is complete and more steps remain:
   - Emit `queue.advance`
5. If all 18 steps are complete:
   - Run project-wide QA gates
   - Emit `LOOP_COMPLETE`

## Acceptance Criteria

- [ ] AC-01: All 16 RTASKs (017, 014, 016, 020, 015, 018, 019, 022, 023, 027, 028, 029, 025, 026, 030, 031) implemented in the specified order
- [ ] AC-02: Each RTASK passes its own acceptance criteria before advancing
- [ ] AC-03: `npm run typecheck` passes for the full project
- [ ] AC-04: `npm run lint` passes with zero warnings
- [ ] AC-05: `npm run test:unit` passes with project-wide coverage > 85%
- [ ] AC-06: `npm run format:check` passes
- [ ] AC-07: Zero `any` types across the entire codebase
- [ ] AC-08: All `.reqs.md` sidecars exist for every production `.ts` file
- [ ] AC-09: All `.spec.ts` test files exist and pass
- [ ] AC-10: Progress log in `.ralph/specs/RTASK-000-resume-011/progress.md` is complete
- [ ] AC-11: One commit per completed RTASK with correct format
- [ ] AC-12: No previously completed files (RTASK-005 through RTASK-012, plus RTASK-013, RTASK-021, RTASK-024) are overwritten or broken

## QA Gates

### Per-Step Gates (enforced by Finalizer)

- [ ] `npm run typecheck` passes
- [ ] `npm run lint` passes
- [ ] `npm run format:check` passes
- [ ] `npm run test:unit` passes
- [ ] Zero `any` in step's new files
- [ ] Triple deliverable complete for step's files

### Pipeline-Level Gates (enforced at LOOP_COMPLETE)

- [ ] `npm run typecheck` passes (full project)
- [ ] `npm run lint` passes (full project)
- [ ] `npm run test:unit` passes (full project, coverage > 85%)
- [ ] `npm run format:check` passes (full project)
- [ ] Zero `any` in `src/` (full project)

## Risks

| Risk                                        | Mitigation                                                                       |
| ------------------------------------------- | -------------------------------------------------------------------------------- |
| Context window fills over 16 tasks          | Each step gets fresh context via queue.advance; planner re-reads state each time |
| Single step failure blocks pipeline         | Debugger hat repairs; 3-attempt limit; progress.md tracks failures               |
| Builder confused about which spec to follow | Progress.md always shows current step; planner reads correct RTASK file          |
| Builder overwrites completed tasks          | context.md explicitly lists completed RTASKs; builder checks existing files      |
| QA gates accumulate errors                  | Gates run per-step, catching issues early                                        |
| Triggers duplicate enforcement logic        | Shared evaluation pipeline extracted in Step 1; handlers call shared module      |
| Handler path mismatch with manifest.yml     | Critical Implementation Notes section specifies exact paths from manifest        |

## Usage

```bash
ralph run -c ralph.yml -p ".ralph/tasks/RTASK-000-resume-011.code-task.md"
```
