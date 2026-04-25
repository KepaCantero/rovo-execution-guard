# Gates and Guardrails

Ralph enforces quality through two mechanisms: **backpressure gates** (automated shell checks) and **guardrails** (behavioral rules injected into every iteration).

## Backpressure Gates

Gates are shell commands that must pass before Ralph proceeds. They act as pre-conditions for every iteration.

```mermaid
flowchart TD
    ITERATION["New Iteration Starts"] --> TC{"typecheck"}
    TC -->|PASS| LINT{"lint"}
    TC -->|FAIL| BLOCK["Block iteration"]

    LINT -->|PASS| TEST{"test"}
    LINT -->|FAIL| BLOCK

    TEST -->|PASS| FMT{"format"}
    TEST -->|FAIL| BLOCK

    FMT -->|PASS| RB1{"rulebook_available"}
    FMT -->|FAIL| BLOCK

    RB1 -->|PASS| RB2{"rulebook_populated"}
    RB1 -->|FAIL| BLOCK

    RB2 -->|PASS| PROCEED["Proceed with iteration"]
    RB2 -->|FAIL| BLOCK

    style PROCEED fill:#4CAF50,color:#fff
    style BLOCK fill:#F44336,color:#fff
```

### Gate Summary

| Gate                 | Command                                          | Purpose                              |
| -------------------- | ------------------------------------------------ | ------------------------------------ |
| `typecheck`          | `npm run typecheck`                              | TypeScript strict compilation passes |
| `lint`               | `npm run lint`                                   | ESLint reports zero errors           |
| `test`               | `npm run test:unit`                              | All unit tests pass                  |
| `format`             | `npm run format:check`                           | Prettier formatting is consistent    |
| `rulebook_available` | `test -f docs/rulebook/RULEBOOK.md`              | RULEBOOK file exists                 |
| `rulebook_populated` | `grep -q "DEFINICION" docs/rulebook/RULEBOOK.md` | RULEBOOK has actual rule content     |

### Gate Categories

```mermaid
pie title "Gate Categories"
    "Code Quality" : 4
    "RULEBOOK" : 2
```

- **Code Quality gates** (4): Validate code correctness — TypeScript, ESLint, Jest, Prettier
- **RULEBOOK gates** (2): Ensure the rulebook infrastructure is in place before work begins

---

## Guardrails

Guardrails are text instructions injected into every Ralph iteration. They define behavioral constraints that all hats must follow.

### Code Quality Guardrails

| #   | Guardrail                    | Effect                                                     |
| --- | ---------------------------- | ---------------------------------------------------------- |
| 1   | Fresh context each iteration | Re-read task spec and rulebook every time                  |
| 2   | Zero `any` — no exceptions   | Use `unknown`, generics, or discriminated unions           |
| 3   | Verification is mandatory    | typecheck, lint, and tests must pass before declaring done |
| 4   | Read-only domain types       | `src/backend/types/` imports nothing external              |

### Process Guardrails

| #   | Guardrail           | Effect                                                        |
| --- | ------------------- | ------------------------------------------------------------- |
| 5   | Triple deliverable  | Every `.ts` MUST have `.reqs.md` sidecar and `.spec.ts` test  |
| 6   | Follow templates    | Use `.ralph/templates/` for consistent output                 |
| 7   | Confidence protocol | >80% proceed; 50-80% proceed + note; <50% safe default + note |
| 8   | No over-engineering | If something can wait, let it wait                            |
| 9   | Commit per subtask  | Never commit `.ralph/` files                                  |

### RULEBOOK Guardrails

| #   | Guardrail                    | Effect                                                          |
| --- | ---------------------------- | --------------------------------------------------------------- |
| 10  | Auto-read RULEBOOK           | Read `docs/rulebook/RULEBOOK.md` at start of each iteration     |
| 11  | Cite rule IDs                | Design decisions must cite RULEBOOK rule: `// [ARCH-SOLID-003]` |
| 12  | Block on CRITICAL violations | Stop and emit `build.blocked` instead of proceeding             |

### Guardrail Enforcement Flow

```mermaid
flowchart TD
    START["Iteration begins"] --> READ["Read RULEBOOK - Guardrail 10"]
    READ --> CHECK{"CRITICAL rule violated?"}

    CHECK -->|"Yes"| BLOCKED["emit build.blocked - Guardrail 12"]
    CHECK -->|"No"| PROCEED["Proceed with work"]

    PROCEED --> IMPLEMENT["Implement with rule citations - Guardrail 11"]
    IMPLEMENT --> VERIFY["Run verification - Guardrail 3"]
    VERIFY --> TRIPLE["Check triple deliverable - Guardrail 5"]
    TRIPLE --> COMMIT["Commit per subtask - Guardrail 9"]

    style BLOCKED fill:#F44336,color:#fff
    style COMMIT fill:#4CAF50,color:#fff
```
