# Event Flow — Ralph 7-Hat Pipeline

## Happy Path

The main pipeline flows through 7 hats in sequence. Each hat consumes an event, does work, and publishes the next event.

```mermaid
flowchart TD
    START(["build.start - User triggers Ralph"])

    PLANNER["Planner - Decomposes task into steps"]
    RESEARCHER["Researcher - Reads RULEBOOK, extracts rules"]
    BUILDER["Builder - TDD: RED, GREEN, REFACTOR"]
    CRITIC["Critic - Adversarial review"]
    ENFORCER["Enforcer - RULEBOOK compliance gate"]
    FINALIZER["Finalizer - Whole-task completeness"]
    COMPLETE(["LOOP_COMPLETE - Task finished"])

    START --> PLANNER
    PLANNER -->|"tasks.ready"| RESEARCHER
    RESEARCHER -->|"research.done"| BUILDER
    BUILDER -->|"review.ready"| CRITIC
    CRITIC -->|"review.passed"| ENFORCER
    ENFORCER -->|"enforcement.passed"| FINALIZER
    FINALIZER -->|"LOOP_COMPLETE"| COMPLETE

    style START fill:#4CAF50,color:#fff
    style COMPLETE fill:#4CAF50,color:#fff
    style PLANNER fill:#2196F3,color:#fff
    style RESEARCHER fill:#9C27B0,color:#fff
    style BUILDER fill:#FF9800,color:#fff
    style CRITIC fill:#F44336,color:#fff
    style ENFORCER fill:#795548,color:#fff
    style FINALIZER fill:#607D8B,color:#fff
```

## Failure and Retry Paths

When a hat detects a problem, the event chain diverges into failure handling paths.

```mermaid
flowchart TD
    BUILDER["Builder"]
    CRITIC["Critic"]
    ENFORCER["Enforcer"]
    DEBUGGER["Debugger - Diagnoses failure, classifies fix"]
    ESCALATE(["debug.escalate - Human intervention"])
    RESEARCHER2["Researcher"]

    BUILDER -->|"build.blocked"| DEBUGGER
    CRITIC -->|"review.rejected"| BUILDER
    ENFORCER -->|"enforcement.failed"| DEBUGGER

    DEBUGGER -->|"TRIVIAL fix - tasks.ready"| RESEARCHER2
    DEBUGGER -->|"COMPLEX or 3rd failure - debug.escalate"| ESCALATE

    style DEBUGGER fill:#FF5722,color:#fff
    style ESCALATE fill:#B71C1C,color:#fff
    style BUILDER fill:#FF9800,color:#fff
    style CRITIC fill:#F44336,color:#fff
    style ENFORCER fill:#795548,color:#fff
    style RESEARCHER2 fill:#9C27B0,color:#fff
```

## Queue Advancement

The Finalizer controls queue progression. After a subtask passes enforcement, the Finalizer decides what happens next.

```mermaid
flowchart LR
    ENFORCER["Enforcer"] -->|"enforcement.passed"| FINALIZER["Finalizer"]

    FINALIZER -->|"More subtasks - queue.advance"| PLANNER["Planner"]
    FINALIZER -->|"Needs rework - finalization.failed"| BUILDER["Builder"]
    FINALIZER -->|"All done - LOOP_COMPLETE"| COMPLETE(["Done"])

    style ENFORCER fill:#795548,color:#fff
    style FINALIZER fill:#607D8B,color:#fff
    style PLANNER fill:#2196F3,color:#fff
    style BUILDER fill:#FF9800,color:#fff
    style COMPLETE fill:#4CAF50,color:#fff
```

## Complete Event Map

Every event in the system with its publisher and subscribers.

```mermaid
flowchart LR
    E1["build.start"] -->|"Planner"| E2["tasks.ready"]
    E2 -->|"Researcher"| E3["research.done"]
    E3 -->|"Builder"| E4["review.ready"]
    E4 -->|"Critic"| E5["review.passed"]
    E4 -->|"Critic"| E6["review.rejected"]
    E5 -->|"Enforcer"| E7["enforcement.passed"]
    E5 -->|"Enforcer"| E8["enforcement.failed"]
    E6 -->|"Builder"| E3
    E7 -->|"Finalizer"| E10["queue.advance"]
    E7 -->|"Finalizer"| E11["finalization.failed"]
    E7 -->|"Finalizer"| E12["LOOP_COMPLETE"]
    E8 -->|"Debugger"| E2
    E8 -->|"Debugger"| E13["debug.escalate"]
    E9["build.blocked"] -->|"Debugger"| E2
    E9 -->|"Debugger"| E13
    E10 -->|"Planner"| E2
    E11 -->|"Builder"| E3
```

## Event Routing Table

| Event                 | Published By        | Consumed By            | Meaning                                       |
| --------------------- | ------------------- | ---------------------- | --------------------------------------------- |
| `build.start`         | External (user)     | Planner                | Initial trigger                               |
| `tasks.ready`         | Planner, Debugger   | Researcher             | A subtask is ready for research               |
| `research.done`       | Researcher          | Builder                | RULEBOOK context extracted, safe to implement |
| `review.ready`        | Builder             | Critic                 | Code increment ready for review               |
| `review.passed`       | Critic              | Enforcer               | Code quality approved                         |
| `review.rejected`     | Critic              | Builder                | Code quality rejected, rework needed          |
| `enforcement.passed`  | Enforcer            | Finalizer              | RULEBOOK compliance verified                  |
| `enforcement.failed`  | Enforcer            | Debugger               | CRITICAL rule violated                        |
| `build.blocked`       | Builder, Researcher | Debugger               | Implementation cannot proceed                 |
| `queue.advance`       | Finalizer           | Planner                | Current step done, advance to next            |
| `finalization.failed` | Finalizer           | Builder                | Whole-task check failed, more work needed     |
| `LOOP_COMPLETE`       | Finalizer           | _(completion_promise)_ | All work finished                             |
| `debug.escalate`      | Debugger            | _(human)_              | Unresolvable, requires human intervention     |
