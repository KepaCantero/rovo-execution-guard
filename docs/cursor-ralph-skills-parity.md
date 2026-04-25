# Cursor rules vs other automation in this repo

**Note:** `.cursor/rules/` is **vendor-neutral** (no external product names in those files). This document explains how Cursor rules align with **other** tooling and docs in the repository.

---

## What lives where

| Concern                                                                     | Location                                                                                                           |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Cursor — always-on workflow, gates, guardrails, **pipeline handoff tokens** | `.cursor/rules/workflow.mdc`, `guardrails.mdc`, `gates.mdc`, **`pipeline-contract.mdc`**                           |
| Cursor — per-role prompts                                                   | `.cursor/rules/roles/*.mdc`                                                                                        |
| **Canonical** RULEBOOK + category index (for humans and all tools)          | `docs/rulebook/RULEBOOK.md`, `docs/rulebook/RULEBOOK-INDEX.md`, `docs/rulebook/RULEBOOK-WORKFLOW-GUIDE.md`         |
| Repository paths (spec workspace, templates, task files)                    | **`AGENTS.md`** (root)                                                                                             |
| Optional duplicate / legacy quick-reference trees                           | May exist under other dot-directories; **editors should prefer `docs/rulebook/`** for the index and workflow guide |

---

## Cursor parity (behavior, not runtime)

| Other automation might provide…      | Cursor analogue                                                                                    |
| ------------------------------------ | -------------------------------------------------------------------------------------------------- |
| Guardrail strings repeated in config | `guardrails.mdc`                                                                                   |
| Shell gates between iterations       | `gates.mdc` + **`pipeline-contract.mdc`** (re-run full gate list when resuming work)               |
| Role / “hat” instructions            | `roles/*.mdc` + explicit “act as …”                                                                |
| Skills / index files                 | **`docs/rulebook/RULEBOOK-INDEX.md`** and **`RULEBOOK-WORKFLOW-GUIDE.md`** (referenced from rules) |
| Event names in logs                  | **`Workflow handoff: <token>`** tokens in `pipeline-contract.mdc` (neutral vocabulary)             |
| Hard-enforced state machine          | **Not inside Cursor** — use your external runner and/or **Husky / CI** for mandatory checks        |

---

## Practical patterns

1. **Single index for categories** — Use **`docs/rulebook/RULEBOOK-INDEX.md`** in prompts, rules, and other config so paths stay consistent.
2. **Paths in one place** — **`AGENTS.md`** lists specification workspace and template locations so `.cursor` rules stay free of repeated path literals.
3. **Hard enforcement** — Keep `npm run typecheck`, `lint`, `test:unit`, `format:check` in **hooks/CI**; Cursor rules express the same **policy**.

---

## Related

- [cursor-task-implementation-flow.md](./cursor-task-implementation-flow.md)
- `.cursor/rules/pipeline-contract.mdc`
- `AGENTS.md`
