# EXP-001: Structured workflow vs Cursor Plan mode — code quality

## Purpose

Run a **controlled comparison** on the **same micro-task** using:

- **Track A — Structured workflow:** [cursor-task-implementation-flow.md](../cursor-task-implementation-flow.md) (roles, artifacts, triple deliverable as documented).
- **Track B — Plan mode:** Cursor **Plan** first, then implementation in **Agent** mode, with **project rules** unchanged (`guardrails`, `gates`, `workflow` still apply via `.cursor/rules`).

Record scores with a fixed rubric so results are comparable across runs and reviewers.

---

## Hypothesis (optional — fill after runs)

| Team belief        | Track expected to win |
| ------------------ | --------------------- |
| _Write yours here_ | A / B / tie           |

---

## Control variables (keep identical)

| Variable         | Rule                                                                                                                                        |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| **Base commit**  | Same `main` (or release) SHA for both tracks — record below.                                                                                |
| **Branches**     | `experiment/exp-001-track-a` and `experiment/exp-001-track-b` from that SHA.                                                                |
| **Task text**    | Exact copy from [Task ticket (EXP-001)](#task-ticket-exp-001) — no edits between tracks.                                                    |
| **Cursor model** | Same model tier for both (record which).                                                                                                    |
| **Human**        | Ideally different people implement A vs B; if same person, do **B first** one day and **A** another to reduce carryover, or separate weeks. |
| **Time box**     | Optional: e.g. max 90 minutes active work per track (record actual).                                                                        |

**Base commit SHA:** `________________`  
**Date Track A:** `________` **Date Track B:** `________`  
**Model:** `________________`

---

## Task ticket (EXP-001)

_Copy everything in this box into both runs as the sole task description (plus file paths below)._

```text
## Objective

Add a small pure utility used by future scoring logic: normalize a raw value into an integer score in the closed range [0, 100].

## Files to create (triple deliverable)

1. `src/backend/lib/normalize-execution-guard-score.reqs.md` — requirements sidecar (use `.ralph/templates/reqs-template.md` structure: description, AC table, RULEBOOK table with at least one plausible ARCH-SOLID or TEST-QA rule ID from docs/rulebook/RULEBOOK.md if applicable).
2. `src/backend/lib/normalize-execution-guard-score.ts` — implementation.
3. `src/backend/lib/normalize-execution-guard-score.spec.ts` — Jest unit tests.

## Public API

Export exactly one function:

`normalizeExecutionGuardScore(raw: unknown): number`

## Behavior (acceptance criteria)

1. If `raw` is a finite number and `raw >= 0` and `raw <= 100`, return `Math.round(raw)` (standard rounding).
2. If `raw` is a finite number and `raw < 0`, return `0`.
3. If `raw` is a finite number and `raw > 100`, return `100`.
4. If `raw` is not a number, or is `NaN`, or is not finite (`Infinity`, `-Infinity`), return `0`.
5. No use of `any`. No external runtime dependencies beyond TypeScript stdlib.
6. `npm run typecheck`, `npm run lint`, `npm run test:unit`, `npm run format:check` must pass.

## Non-goals

- Do not change other modules except if ESLint/tsconfig require a minimal path alias update (prefer not to).
- Do not add Forge or React code.

## Verification

After implementation, paste the output of the four npm scripts into the experiment log (or attach CI).
```

---

## Track A — Structured workflow (procedure)

1. Checkout base SHA; create `experiment/exp-001-track-a`.
2. In Cursor, explicitly follow [cursor-task-implementation-flow.md](../cursor-task-implementation-flow.md):
   - Gates first (or confirm green).
   - **Tech Lead:** `context.md` / `plan.md` / `progress.md` under `.ralph/specs/exp-001-normalize-score/` (create folder).
   - **Solutions Architect:** `rulebook-context.md` in that folder.
   - **Developer:** TDD, triple files listed above.
   - **Code Reviewer:** adversarial pass + re-run commands.
   - **QA Engineer:** RULEBOOK / CRITICAL check as per rules.
   - **Delivery Manager:** confirm all ACs and files.
3. Commit on branch A with message like `feat(lib): normalize execution guard score [EXP-001-A]`.
4. Fill [Results](#results-log) for Track A.

---

## Track B — Plan mode (procedure)

1. Checkout **same** base SHA; create `experiment/exp-001-track-b`.
2. Open **Plan** mode; paste the [task ticket](#task-ticket-exp-001) only.
3. Ask for a short implementation plan; approve or refine until plan explicitly mentions ACs 1–6 and the three file paths.
4. Switch to **Agent** mode; implement **without** simulating seven roles, but **do not** disable `.cursor/rules` (project rules stay on).
5. Optional: add one user rule in the prompt: _Before marking done, verify every AC and re-run typecheck, lint, test:unit, format:check._
6. Commit on branch B with message like `feat(lib): normalize execution guard score [EXP-001-B]`.
7. Fill [Results](#results-log) for Track B.

---

## Scoring rubric (1–5 each; higher is better)

Score **blind** if possible: reviewer shuffles branches or reads diffs without knowing A vs B until totals are done.

| #   | Criterion                                  | What to look for                                                                                                                                                                                             |
| --- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | **AC correctness**                         | Matches all six ACs; edge cases covered in tests.                                                                                                                                                            |
| 2   | **Tests**                                  | Meaningful cases; not only happy path; no flaky patterns.                                                                                                                                                    |
| 3   | **Types / no `any`**                       | Strict typing; `unknown` handled properly.                                                                                                                                                                   |
| 4   | **Reqs sidecar**                           | Complete template sections; RULEBOOK IDs plausible and linked to behavior.                                                                                                                                   |
| 5   | **Style & minimalism**                     | Clear naming; no unnecessary abstraction; fits `src/backend/lib`.                                                                                                                                            |
| 6   | **Process artifacts (Track A only bias?)** | For a **fair** comparison, score **only repo files in the PR**. Optionally score **process** separately: presence/quality of `.ralph/specs/...` on Track A (does not apply to B unless B also created them). |

**Suggested weights:** Criteria 1–5 sum to **main quality score** (max 25). Criterion 6 optional **process bonus** (max 5) documented separately so you can report “code only” vs “code + process”.

### Scoring sheet

| Criterion            | Track A (1–5) | Track B (1–5) |
| -------------------- | ------------- | ------------- |
| 1 AC correctness     |               |               |
| 2 Tests              |               |               |
| 3 Types              |               |               |
| 4 Reqs sidecar       |               |               |
| 5 Style              |               |               |
| **Subtotal**         |               |               |
| 6 Process (optional) |               |               |
| **Grand total**      |               |               |

**Reviewer name:** `________________` **Date:** `________`

---

## Results log

### Objective checks (must pass for valid experiment)

| Check                             | Track A     | Track B     |
| --------------------------------- | ----------- | ----------- |
| `npm run typecheck`               | pass / fail | pass / fail |
| `npm run lint`                    | pass / fail | pass / fail |
| `npm run test:unit`               | pass / fail | pass / fail |
| `npm run format:check`            | pass / fail | pass / fail |
| All three deliverable files exist | yes / no    | yes / no    |

### Subjective rubric totals

|                        | Track A | Track B |
| ---------------------- | ------- | ------- |
| Subtotal (1–5, max 25) |         |         |
| Notes                  |         |         |

### Conclusion (team fills)

- **Winner (code quality):** A / B / Tie
- **Notes:** lessons, surprises, what to change in rules or docs

---

## Cleanup

After the experiment, either:

- Merge the winning approach (or the more maintainable branch) and **delete** the other branch, or
- Keep both as references and close with a short summary in this file’s **Conclusion**.

---

## Related docs

- [cursor-task-implementation-flow.md](../cursor-task-implementation-flow.md)
- [cursor-workflow-vs-adhoc-token-comparison.md](../cursor-workflow-vs-adhoc-token-comparison.md)
