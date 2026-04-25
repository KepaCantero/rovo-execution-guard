# Hats — Roles and Responsibilities

Ralph uses a hat system where each hat has a single responsibility. Hats communicate through events and never share state directly.

```mermaid
flowchart TD
    P["Planner<br/>Decomposition &amp; Queue"]
    R["Researcher<br/>RULEBOOK Pre-Flight"]
    B["Builder<br/>TDD Implementation"]
    C["Critic<br/>Adversarial Review"]
    E["Enforcer<br/>RULEBOOK Compliance"]
    D["Debugger<br/>Failure Diagnosis"]
    F["Finalizer<br/>Completion Gate"]

    P --> R --> B --> C --> E --> F
    E -.->|"on failure"| D
    D -.->|"retry"| R

    style P fill:#2196F3,color:#fff
    style R fill:#9C27B0,color:#fff
    style B fill:#FF9800,color:#fff
    style C fill:#F44336,color:#fff
    style E fill:#795548,color:#fff
    style D fill:#FF5722,color:#fff
    style F fill:#607D8B,color:#fff
```

---

## Planner

```mermaid
flowchart LR
    IN(["build.start / queue.advance"]) --> P["Planner"]
    P --> OUT(["tasks.ready"])

    P --- W1["Reads task spec"]
    P --- W2["Creates plan.md"]
    P --- W3["Ensures runtime tasks"]
    P --- W4["Manages step waves"]

    style P fill:#2196F3,color:#fff
```

| Property              | Value                                                                         |
| --------------------- | ----------------------------------------------------------------------------- |
| **Triggers**          | `build.start`, `queue.advance`                                                |
| **Publishes**         | `tasks.ready`                                                                 |
| **Role**              | Decomposes the Ralph task into numbered steps and manages the execution queue |
| **Rule**              | Does NOT implement. Does NOT review. Only decomposes.                         |
| **Working Directory** | `.ralph/specs/{task_name}/` — owns `context.md`, `plan.md`, `progress.md`     |

### Key Behaviors

- On `build.start`: reads task spec, creates working directory, writes `context.md` and `plan.md`, materializes Step 1 runtime tasks
- On `queue.advance`: checks if current step's wave is closed, advances to next step if so, ensures next wave of runtime tasks
- Task granularity: one focused subtask per runtime task (e.g., "Create src/backend/types/errors.ts with REGError base class")

---

## Researcher

```mermaid
flowchart LR
    IN(["tasks.ready"]) --> R["Researcher"]
    R --> OUT(["research.done"])
    R -.->|"RULEBOOK missing"| BLOCKED(["build.blocked"])

    R --- W1["Reads RULEBOOK.md"]
    R --- W2["Reads RULEBOOK-INDEX.md"]
    R --- W3["Extracts CRITICAL/HIGH rules"]
    R --- W4["Writes rulebook-context.md"]

    style R fill:#9C27B0,color:#fff
```

| Property      | Value                                                                                  |
| ------------- | -------------------------------------------------------------------------------------- |
| **Triggers**  | `tasks.ready`                                                                          |
| **Publishes** | `research.done`                                                                        |
| **Role**      | Pre-implementation RULEBOOK consultation — extracts relevant rules before Builder acts |
| **Output**    | `.ralph/specs/{task_name}/rulebook-context.md`                                         |

### Key Behaviors

- Reads `docs/rulebook/RULEBOOK.md` and `docs/rulebook/RULEBOOK-INDEX.md` on every activation
- Identifies applicable RULEBOOK categories for the current task
- Extracts all CRITICAL and HIGH priority rules
- Verifies API constraints (rate limits, timeouts, permissions) if task involves external APIs
- Emits `build.blocked` if RULEBOOK is missing or empty

---

## Builder

```mermaid
flowchart LR
    IN(["research.done / review.rejected"]) --> B["Builder"]
    B --> OUT(["review.ready"])
    B -.->|"blocked"| BLOCKED(["build.blocked"])

    B --- W1["TDD: RED to GREEN to REFACTOR"]
    B --- W2["Creates triple deliverable"]
    B --- W3["Runs all verification"]
    B --- W4["Commits per subtask"]

    style B fill:#FF9800,color:#fff
```

| Property      | Value                                                     |
| ------------- | --------------------------------------------------------- |
| **Triggers**  | `research.done`, `review.rejected`, `finalization.failed` |
| **Publishes** | `review.ready`, `build.blocked`                           |
| **Role**      | TDD implementer — one task at a time, tests first         |
| **Rule**      | Implements ONE runtime task per iteration. Never batches. |

### Key Behaviors

- Follows strict TDD cycle: RED (failing test) → GREEN (minimal code) → REFACTOR (clean up)
- Creates triple deliverable for every `.ts` file: `.reqs.md` sidecar → `.ts` code → `.spec.ts` test
- Runs all 4 verification commands before emitting `review.ready`: `typecheck`, `lint`, `test:unit`, `format:check`
- Commit format: `type(scope): description [REG-XXX]`

---

## Critic

```mermaid
flowchart LR
    IN(["review.ready"]) --> C["Critic"]
    C --> OUT(["review.passed"])
    C -.->|"reject"| REJECT(["review.rejected"])

    C --- W1["Requirement fidelity check"]
    C --- W2["Triple deliverable check"]
    C --- W3["Re-runs verification"]
    C --- W4["Over-engineering detection"]

    style C fill:#F44336,color:#fff
```

| Property      | Value                                            |
| ------------- | ------------------------------------------------ |
| **Triggers**  | `review.ready`                                   |
| **Publishes** | `review.passed`, `review.rejected`               |
| **Default**   | `review.rejected` (reject unless proven correct) |
| **Role**      | Fresh-eyes adversarial review — not the builder  |

### Key Behaviors

- Checks requirement fidelity: did Builder satisfy the task? Were ACs met? Were rules followed?
- Verifies triple deliverable: every `.ts` has `.reqs.md` and `.spec.ts`
- Re-runs verification commands (does NOT trust "it passes" claims)
- Detects over-engineering: extra files, unused types, premature abstractions
- Records durable patterns to memory: `ralph tools memory add "pattern" -t pattern`

---

## Enforcer

```mermaid
flowchart LR
    IN(["review.passed"]) --> E["Enforcer"]
    E --> OUT(["enforcement.passed"])
    E -.->|"CRITICAL violated"| FAIL(["enforcement.failed"])

    E --- W1["Reads RULEBOOK.md"]
    E --- W2["Reads rulebook-context.md"]
    E --- W3["Verifies CRITICAL rules"]
    E --- W4["Records MEDIA rules"]

    style E fill:#795548,color:#fff
```

| Property      | Value                                                               |
| ------------- | ------------------------------------------------------------------- |
| **Triggers**  | `review.passed`                                                     |
| **Publishes** | `enforcement.passed`, `enforcement.failed`                          |
| **Default**   | `enforcement.failed` (fail unless proven compliant)                 |
| **Role**      | RULEBOOK compliance verification after Critic approves code quality |

### Key Behaviors

- Reads `docs/rulebook/RULEBOOK.md` and the Researcher's `rulebook-context.md`
- Verifies each CRITICAL rule is satisfied by the implementation
- For HIGH rules: verifies or documents justified exception
- MEDIA priority rules: records but never blocks
- Never blocks on style preferences or rules from non-applicable categories

---

## Debugger

```mermaid
flowchart TD
    IN(["enforcement.failed / build.blocked"]) --> D["Debugger"]
    D --> CLASSIFY{"Classify fix"}

    CLASSIFY -->|"TRIVIAL - under 10 lines"| FIX["Apply fix"]
    CLASSIFY -->|"COMPLEX or 3rd failure"| ESCALATE(["debug.escalate"])

    FIX --> RETRY(["tasks.ready"])

    style D fill:#FF5722,color:#fff
    style CLASSIFY fill:#FF9800,color:#fff
    style ESCALATE fill:#B71C1C,color:#fff
    style RETRY fill:#4CAF50,color:#fff
```

| Property      | Value                                                          |
| ------------- | -------------------------------------------------------------- |
| **Triggers**  | `enforcement.failed`, `build.blocked`                          |
| **Publishes** | `tasks.ready`, `debug.escalate`                                |
| **Default**   | `tasks.ready` (retry by default)                               |
| **Role**      | Diagnoses and repairs gate failures and enforcement violations |

### Key Behaviors

- Reads the exact error from the triggering event
- Locates the file and line of the problem
- Classifies the fix: TRIVIAL (< 10 lines) → repair directly, COMPLEX → escalate, FALSE POSITIVE → escalate
- Anti-loop protection: after 3 consecutive failures of the same gate, always escalates
- Writes debug session log to `progress.md`

---

## Finalizer

```mermaid
flowchart TD
    IN(["enforcement.passed"]) --> F["Finalizer"]
    F --> CHECK{"All steps done?"}

    CHECK -->|"Yes - all complete"| DONE(["LOOP_COMPLETE"])
    CHECK -->|"No - more subtasks"| ADVANCE(["queue.advance"])
    CHECK -->|"No - needs rework"| REDO(["finalization.failed"])

    style F fill:#607D8B,color:#fff
    style DONE fill:#4CAF50,color:#fff
    style ADVANCE fill:#2196F3,color:#fff
    style REDO fill:#F44336,color:#fff
```

| Property      | Value                                                   |
| ------------- | ------------------------------------------------------- |
| **Triggers**  | `enforcement.passed`                                    |
| **Publishes** | `queue.advance`, `finalization.failed`, `LOOP_COMPLETE` |
| **Default**   | `finalization.failed` (fail unless proven complete)     |
| **Role**      | Whole-task completion gate — the strictest check        |

### Key Behaviors

- Checks plan completion: all numbered steps done? All runtime tasks closed?
- Runs quality gates: `typecheck`, `lint`, `test:unit`
- Checks definition of done: all files exist, all sidecars exist, no `any` types
- Performs adversarial pass: tests edge cases and failure scenarios
- MUST be stricter than both Builder and Critic about what "done" means
