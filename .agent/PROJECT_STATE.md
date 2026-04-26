# PROJECT_STATE.md — Rovo Execution Guard

## Stack

- **Runtime**: Atlassian Forge (nodejs22.x)
- **Language**: TypeScript (strict)
- **Test**: Jest + ts-jest
- **Lint**: ESLint + Prettier
- **CI**: Husky + lint-staged + commitlint
- **Agent Stack**: Ralph (orchestrator) + Claude Code + Serena MCP + Zai MCP

## Pipeline Status

### Completed

| RTASK     | Title                                                |
| --------- | ---------------------------------------------------- |
| RTASK-001 | Project Foundation                                   |
| RTASK-002 | Rulebook                                             |
| RTASK-003 | TypeScript + ESLint + Prettier                       |
| RTASK-004 | Husky + Commitlint + Lint-staged                     |
| RTASK-005 | Domain Layer - Types and Models                      |
| RTASK-006 | Domain Layer - Scoring Engine                        |
| RTASK-007 | Domain Layer - Inconsistency Detector                |
| RTASK-008 | Domain Layer - Quality Gate Rules Engine             |
| RTASK-009 | Integration Layer - Jira API Adapter                 |
| RTASK-010 | Integration Layer - Rovo API Adapter                 |
| RTASK-011 | Integration Layer - GitHub Adapter                   |
| RTASK-012 | Integration Layer - Confluence Adapter (IN PROGRESS) |
| RTASK-013 | Integration Layer - Resilience (inline in adapters)  |
| RTASK-021 | Observability - Structured Logger (inline)           |
| RTASK-024 | Configuration - Project Settings                     |

### Next Up (reordered for business logic first)

1. **RTASK-017** — Enforcement Actions (enforcement module)
2. **RTASK-014** — Jira Triggers (workflow validator)
3. **RTASK-016** — GitHub Webhook Handler
4. **RTASK-020** — GitHub PR Comments
5. **RTASK-015** — Resolvers (Forge Bridge)
6. **RTASK-018** — Jira Issue Panel (UI)
7. **RTASK-019** — Admin Dashboard (UI)
8. RTASK-022..031 — Observability, Testing, CI/CD, Docs

## Current Step

- **Active**: RTASK-012 (Confluence Adapter) — in progress by Ralph
- **Forge**: Deployed v2.0.0 to DEV kcantero environment
- **Blocker**: None

## Key Decisions

- Resilience patterns (retry, timeout, circuit breaker) implemented inline in each adapter, not as shared module
- Handler paths in manifest must match `manifest.yml` exactly (`src/backend/resolvers/`)
- Evaluation pipeline shared between RTASK-014 and RTASK-016 (extract to `evaluation-pipeline.ts`)
