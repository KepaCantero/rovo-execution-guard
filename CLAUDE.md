# CLAUDE.md — Rovo Execution Guard

## Project Overview

Atlassian Forge app that validates consistency between Jira, Confluence, and GitHub using Rovo AI, blocking low-quality workflow transitions.

## Stack

- **Runtime**: Atlassian Forge (nodejs22.x)
- **Language**: TypeScript (strict, module: Node16)
- **UI**: React 18 + @forge/react + @atlaskit components
- **Test**: Jest + ts-jest
- **Lint**: ESLint + Prettier
- **Git**: Husky + lint-staged + commitlint (conventional)
- **Agent**: Ralph (orchestrator) + Claude Code + Serena MCP + Zai MCP

## Architecture

```
src/
├── resolver-handler.ts       # Forge entry: Custom UI resolvers
├── transition-handler.ts     # Forge entry: Jira workflow trigger
├── webhook-handler.ts        # Forge entry: GitHub webtrigger
├── backend/
│   ├── types/                # Domain types (11 files)
│   ├── services/
│   │   ├── jira/             # Jira API adapter
│   │   ├── github/           # GitHub API adapter
│   │   ├── rovo/             # Rovo AI adapter
│   │   ├── confluence/       # Confluence adapter
│   │   ├── scoring/          # Scoring engine + quality gates + inconsistency detector
│   │   ├── evaluation/       # Shared evaluation pipeline (RTASK-014/016)
│   │   └── enforcement/      # Enforcement actions (block/approve/comment)
│   ├── resolvers/            # Backend logic (index, workflow-transition, github-webhook)
│   └── utils/                # Shared utilities
├── frontend/
│   ├── custom-ui/
│   │   ├── issue-panel/      # Jira issue panel (index.html + React app)
│   │   └── admin-dashboard/  # Admin dashboard (index.html + React app)
│   ├── components/           # Shared React components
│   └── utils/                # Frontend utilities
tests/
├── unit/                     # Mirrors src/ structure
manifest.yml                  # Forge app manifest
```

## Rules

### Semantic First

Before reading a file with `Read`, try Serena tools (`find_definition`, `get_references`, `list_symbols`) to understand dependencies and impact.

### GSD State Updates

After every successful task:

1. Update `.agent/PROJECT_STATE.md` (completed tasks, current step, blockers)
2. Append to `.agent/SESSION_LOG.md` (what was done, decisions, status)
3. Update `.agent/SCRATCHPAD.md` if investigating an issue

### Code Conventions

- All source files are `.ts` / `.tsx` — no `.js` / `.jsx`
- `moduleResolution: "node16"` — use explicit file extensions in imports
- Strict TypeScript: `noUncheckedIndexedAccess`, `noImplicitReturns`
- Path aliases: `@domain/*`, `@services/*`, `@resolvers/*`, `@frontend/*`, `@shared/*`
- Every type/service has a `.reqs.md` sidecar with requirements traceability
- Resilience patterns (retry, timeout, circuit breaker) are inline in each adapter
- Handler paths must match `manifest.yml` exactly

### Testing

- Unit tests mirror source structure under `tests/unit/`
- Run: `pnpm test:unit`
- Config: `config/jest.config.js`

### Git

- Conventional commits enforced by commitlint
- Pre-commit: lint-staged (eslint + prettier)
- Pre-push: typecheck + tests

### Forge

- App ID: `51b53283-caf2-4636-9e4b-5a6e1d048260`
- Environment: `kcantero`
- Handler format: `<filename>.<export>` (single dot, relative to `src/`, no extension)
- Entry point files live in `src/` (thin re-exports from `src/backend/resolvers/`)
- Custom UI modules use `resource` + `resolver` + `function` pattern
- Resources are directories containing `index.html`
- Resource keys max 23 characters
- Function keys max 23 characters
- Scopes: `read:jira-work`, `write:jira-work`, `read:confluence-content.all`, `write:confluence-content`, `storage:app`
- Deploy: `forge deploy -e kcantero`

## Pipeline (RTASK)

Completed: 001-011, 013, 021, 024. In progress: 012.

Next in order:

1. RTASK-017 — Enforcement Actions
2. RTASK-014 — Jira Triggers
3. RTASK-016 — GitHub Webhook
4. RTASK-020 — GitHub PR Comments
5. RTASK-015 — Resolvers (Forge Bridge)
6. RTASK-018 — Jira Issue Panel (UI)
7. RTASK-019 — Admin Dashboard (UI)
8. RTASK-022..031 — Observability, Testing, CI/CD, Docs

Key: RTASK-014 and RTASK-016 share an evaluation pipeline (`src/backend/services/evaluation/`). Both depend on RTASK-017 for enforcement functions.

## Key Decisions

- Resilience patterns inline in adapters, not shared module
- Forge handler format: `<filename>.<export>` with thin entry points in `src/`
- Evaluation pipeline shared between RTASK-014 and RTASK-016
- Forge Webpack bundler handles `.ts` natively (no EAP or build step needed)
- Backend resolvers export both `handler` (Forge entry) and named business functions

## Open Issues

- None — Forge deploy clean and working
