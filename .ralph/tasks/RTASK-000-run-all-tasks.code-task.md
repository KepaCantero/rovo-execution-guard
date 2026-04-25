---
id: RTASK-000
title: 'Sequential Pipeline: RTASK-005 through RTASK-031'
status: pending
priority: 0
type: meta
dependencies: []
rulebook_refs: []
spec: .ralph/tasks/RTASK-000-run-all-tasks.code-task.md
---

# RTASK-000: Sequential Pipeline — RTASK-005 through RTASK-031

## Objective

Implement RTASK-005 through RTASK-031 sequentially inside a single Ralph loop. Each step reads the corresponding task file, implements it fully (TDD, triple deliverable, QA gates), commits, then advances to the next.

## How This Task Works

This is NOT a normal task with a fixed set of files. Instead:

- The **Planner** creates one numbered step per RTASK (27 steps total)
- For each step, the Planner reads the RTASK file and creates runtime tasks from its content
- The **Builder** implements the runtime tasks following that RTASK's spec
- The **Critic** and **Enforcer** validate against that RTASK's acceptance criteria
- The **Finalizer** verifies QA gates pass, then advances to the next step

## Plan Steps (Planner MUST follow this exact order)

The Planner MUST write these 27 steps to `plan.md`. No deviations. No reordering.

| Step | RTASK File                                                              | Title                                    |
| ---- | ----------------------------------------------------------------------- | ---------------------------------------- |
| 1    | `.ralph/tasks/RTASK-005-domain-types-models.code-task.md`               | Domain Layer - Types and Models          |
| 2    | `.ralph/tasks/RTASK-006-domain-scoring-engine.code-task.md`             | Domain Layer - Scoring Engine            |
| 3    | `.ralph/tasks/RTASK-007-domain-inconsistency-detector.code-task.md`     | Domain Layer - Inconsistency Detector    |
| 4    | `.ralph/tasks/RTASK-008-domain-quality-gate-rules.code-task.md`         | Domain Layer - Quality Gate Rules Engine |
| 5    | `.ralph/tasks/RTASK-013-integration-resilience.code-task.md`            | Integration Layer - Resilience           |
| 6    | `.ralph/tasks/RTASK-021-observability-structured-logger.code-task.md`   | Observability - Structured Logger        |
| 7    | `.ralph/tasks/RTASK-024-configuration-project-settings.code-task.md`    | Configuration - Project Settings         |
| 8    | `.ralph/tasks/RTASK-009-integration-jira-adapter.code-task.md`          | Integration Layer - Jira API Adapter     |
| 9    | `.ralph/tasks/RTASK-010-integration-rovo-adapter.code-task.md`          | Integration Layer - Rovo API Adapter     |
| 10   | `.ralph/tasks/RTASK-011-integration-github-adapter.code-task.md`        | Integration Layer - GitHub Adapter       |
| 11   | `.ralph/tasks/RTASK-012-integration-confluence-adapter.code-task.md`    | Integration Layer - Confluence Adapter   |
| 12   | `.ralph/tasks/RTASK-022-observability-sentry.code-task.md`              | Observability - Sentry Integration       |
| 13   | `.ralph/tasks/RTASK-014-orchestration-jira-triggers.code-task.md`       | Orchestration - Jira Triggers            |
| 14   | `.ralph/tasks/RTASK-015-orchestration-resolvers.code-task.md`           | Orchestration - Resolvers                |
| 15   | `.ralph/tasks/RTASK-016-orchestration-github-webhook.code-task.md`      | Orchestration - GitHub Webhook           |
| 16   | `.ralph/tasks/RTASK-017-orchestration-enforcement-actions.code-task.md` | Orchestration - Enforcement Actions      |
| 17   | `.ralph/tasks/RTASK-025-cicd-github-actions.code-task.md`               | CI/CD - GitHub Actions                   |
| 18   | `.ralph/tasks/RTASK-023-observability-health-checks.code-task.md`       | Observability - Health Checks            |
| 19   | `.ralph/tasks/RTASK-026-cicd-semantic-release.code-task.md`             | CI/CD - Semantic Release                 |
| 20   | `.ralph/tasks/RTASK-018-presentation-jira-issue-panel.code-task.md`     | Presentation - Jira Issue Panel          |
| 21   | `.ralph/tasks/RTASK-019-presentation-admin-dashboard.code-task.md`      | Presentation - Admin Dashboard           |
| 22   | `.ralph/tasks/RTASK-020-presentation-github-pr-comments.code-task.md`   | Presentation - GitHub PR Comments        |
| 23   | `.ralph/tasks/RTASK-027-testing-jest-unit-suite.code-task.md`           | Testing - Jest Unit Suite                |
| 24   | `.ralph/tasks/RTASK-028-testing-integration-tests.code-task.md`         | Testing - Integration Tests              |
| 25   | `.ralph/tasks/RTASK-029-testing-e2e-playwright.code-task.md`            | Testing - E2E Playwright                 |
| 26   | `.ralph/tasks/RTASK-030-documentation-readmes-marketplace.code-task.md` | Documentation - READMEs and Marketplace  |
| 27   | `.ralph/tasks/RTASK-031-audit-coverage.code-task.md`                    | Audit Coverage                           |

## Planner Instructions (CRITICAL)

### On First Activation (build.start)

1. Create working directory: `.ralph/specs/RTASK-000-run-all-tasks/`
2. Write `context.md` with:
   - This is a pipeline task executing 27 RTASKs sequentially
   - Each step reads an external task file and implements its full spec
   - The current task file IS the source of truth for each step
3. Write `plan.md` with the 27 steps from the table above. Format:

```
## Plan: RTASK-000 Sequential Pipeline

### Step 1: RTASK-005 — Domain Layer - Types and Models
- Source: .ralph/tasks/RTASK-005-domain-types-models.code-task.md
- Status: pending

### Step 2: RTASK-006 — Domain Layer - Scoring Engine
- Source: .ralph/tasks/RTASK-006-domain-scoring-engine.code-task.md
- Status: pending

[... repeat for all 27 steps ...]
```

4. Write `progress.md`:

```
## Pipeline Progress
- Current Step: 1 (RTASK-005)
- Completed: (none)
- Failed: (none)
```

5. Read the RTASK-005 task file (`.ralph/tasks/RTASK-005-domain-types-models.code-task.md`)
6. Create runtime tasks from RTASK-005's Technical Specification
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
4. Use stable keys: `reg:rtask000:step-XX:slug`
5. Include the RTASK's acceptance criteria in each runtime task description

## Builder Instructions (CRITICAL)

### Before Implementing Each Runtime Task

1. Read the source RTASK file for the current step (path from `plan.md`)
2. Read the Rulebook: `docs/rulebook/RULEBOOK.md`
3. Read `rulebook-context.md` from the researcher
4. Follow the RTASK's Implementation Protocol exactly

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
4. Write findings to `.ralph/specs/RTASK-000-run-all-tasks/rulebook-context.md`
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
5. If all 27 steps are complete:
   - Run project-wide QA gates
   - Emit `LOOP_COMPLETE`

## Acceptance Criteria

- [ ] AC-01: All 27 RTASKs (005-031) implemented in the specified order
- [ ] AC-02: Each RTASK passes its own acceptance criteria before advancing
- [ ] AC-03: `npm run typecheck` passes for the full project
- [ ] AC-04: `npm run lint` passes with zero warnings
- [ ] AC-05: `npm run test:unit` passes with project-wide coverage > 85%
- [ ] AC-06: `npm run format:check` passes
- [ ] AC-07: Zero `any` types across the entire codebase
- [ ] AC-08: All `.reqs.md` sidecars exist for every production `.ts` file
- [ ] AC-09: All `.spec.ts` test files exist and pass
- [ ] AC-10: Progress log in `.ralph/specs/RTASK-000-run-all-tasks/progress.md` is complete
- [ ] AC-11: One commit per completed RTASK with correct format

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
| Context window fills over 27 tasks          | Each step gets fresh context via queue.advance; planner re-reads state each time |
| Single step failure blocks pipeline         | Debugger hat repairs; 3-attempt limit; progress.md tracks failures               |
| Builder confused about which spec to follow | Progress.md always shows current step; planner reads correct RTASK file          |
| QA gates accumulate errors                  | Gates run per-step, catching issues early                                        |

## Usage

```bash
ralph run -c ralph.yml -p ".ralph/tasks/RTASK-000-run-all-tasks.code-task.md"
```
