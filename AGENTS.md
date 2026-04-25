# Agent instructions (Cursor)

This repository uses a **seven-role software workflow**. Global rules live under `.cursor/rules/`:

- `workflow.mdc` — phases and handoffs
- `pipeline-contract.mdc` — handoff tokens, RULEBOOK read order, **per-iteration gates**, specification layout
- `guardrails.mdc`, `gates.mdc`

Role-specific behavior is in `.cursor/rules/roles/*.mdc`.

## Repository paths (task workflow)

| Purpose                 | Path                        |
| ----------------------- | --------------------------- |
| Specification workspace | `.ralph/specs/{task_name}/` |
| Task definition files   | `.ralph/tasks/`             |
| Code / reqs templates   | `.ralph/templates/`         |

Files in the specification workspace typically include `context.md`, `plan.md`, `progress.md`, and `rulebook-context.md`.

## RULEBOOK (canonical)

| Document                 | Path                                       |
| ------------------------ | ------------------------------------------ |
| Full rules               | `docs/rulebook/RULEBOOK.md`                |
| Category index           | `docs/rulebook/RULEBOOK-INDEX.md`          |
| Workflow quick reference | `docs/rulebook/RULEBOOK-WORKFLOW-GUIDE.md` |

## Roles (invoke explicitly when simulating the team)

| Role                | File                                          |
| ------------------- | --------------------------------------------- |
| Tech Lead           | `.cursor/rules/roles/tech-lead.mdc`           |
| Solutions Architect | `.cursor/rules/roles/solutions-architect.mdc` |
| Developer           | `.cursor/rules/roles/developer.mdc`           |
| Code Reviewer       | `.cursor/rules/roles/reviewer.mdc`            |
| QA Engineer         | `.cursor/rules/roles/qa-engineer.mdc`         |
| SRE                 | `.cursor/rules/roles/sre.mdc`                 |
| Delivery Manager    | `.cursor/rules/roles/delivery-manager.mdc`    |

Human-facing workflow diagrams: [docs/cursor-task-implementation-flow.md](docs/cursor-task-implementation-flow.md).
