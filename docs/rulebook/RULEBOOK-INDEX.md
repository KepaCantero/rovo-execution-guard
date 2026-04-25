# RULEBOOK-INDEX — Category-to-Task Mapping

> Canonical rules: `docs/rulebook/RULEBOOK.md`  
> Source files: `docs/rulebook/sources/` (books/, links/, rules/)

Read this file at the **start** of every task before implementing.

## How to Use

1. Read `docs/rulebook/RULEBOOK.md` at the start of each iteration
2. For the current task, identify applicable categories from the 8 below
3. Extract CRITICAL and HIGH rules relevant to the task
4. Cite rule IDs in code comments: `// [FORGE-OPS-005]`
5. If a CRITICAL rule is violated, stop and fix before proceeding

## Categories

| Category   | Applies To                                               |
| ---------- | -------------------------------------------------------- |
| FORGE-OPS  | Forge runtime, manifest, storage, platform limits        |
| SEC-PRIV   | Data handling, auth, scopes, OAuth, secrets              |
| ARCH-SOLID | All code tasks - types, models, adapters, orchestrators  |
| TEST-QA    | All tasks producing `.spec.ts` files                     |
| GIT-CI     | RTASK-003, 004, 025, 026 (tooling and CI/CD)             |
| UI-ADS     | RTASK-018, 019, 020 (presentation layer, Custom UI)      |
| ROVO-INTEG | RTASK-010, 013, 014 (Rovo adapter, resilience, triggers) |
| GH-INTEG   | RTASK-011, 016, 017, 020 (GitHub integration, webhooks)  |

## Priority Hierarchy (resolves contradictions)

1. FORGE-OPS - Forge platform limits override everything
2. SEC-PRIV - Security rules override aesthetic preferences
3. GH-INTEG - GitHub API rules override generic patterns
4. ARCH-SOLID - Clean Architecture and DDD, SOLID
5. TEST-QA - Testing standards
6. GIT-CI - Git workflow and CI/CD
7. UI-ADS - Atlassian Design System
8. ROVO-INTEG - Rovo AI integration rules
