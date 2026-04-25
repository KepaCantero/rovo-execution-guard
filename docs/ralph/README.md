# Ralph Orchestrator — Workflow Documentation

This directory contains visual documentation of the Ralph orchestrator used by the Rovo Execution Guard project. All diagrams use [Mermaid](https://mermaid.js.org/) syntax and render natively on GitHub.

## Contents

| Document                                             | Description                                                                                                   |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| [event-flow.md](./event-flow.md)                     | Main event chain: the 7-hat pipeline from `build.start` to `LOOP_COMPLETE`, including failure and retry paths |
| [hats.md](./hats.md)                                 | Individual hat responsibilities, triggers, published events, and behavior                                     |
| [gates-and-guardrails.md](./gates-and-guardrails.md) | Backpressure gates (shell pre-conditions) and guardrails (behavioral rules injected into every iteration)     |
| [triple-deliverable.md](./triple-deliverable.md)     | The mandatory `.ts` + `.reqs.md` + `.spec.ts` pattern enforced on every production file                       |
| [glossary.md](./glossary.md)                         | Complete glossary of Ralph terminology: hats, events, guardrails, gates, skills, memories, RULEBOOK, and more |

## Quick Reference

### Event Chain (happy path)

```
build.start → Planner → tasks.ready → Researcher → research.done
  → Builder → review.ready → Critic → review.passed
    → Enforcer → enforcement.passed → Finalizer → LOOP_COMPLETE
```

### Event Chain (failure path)

```
enforcement.failed ──┐
build.blocked ───────┤→ Debugger → tasks.ready (retry) / debug.escalate (escalate)
review.rejected ─────┘→ Builder (retry)
```

### Configuration File

All behavior is defined in [`ralph.yml`](../../ralph.yml) at the repository root.
