# CLAUDE.md — Rovo Execution Guard

## Project Overview

Atlassian Forge app that validates consistency between Jira, Confluence, and GitHub using a relationship index and multi-axis scoring, blocking low-quality workflow transitions. Optionally integrates with Rovo AI for enriched context.

## Stack

- **Runtime**: Atlassian Forge (nodejs22.x)
- **Language**: TypeScript (strict, module: Node16)
- **UI**: React 18 + @forge/react + @atlaskit components
- **Test**: Jest + ts-jest
- **Lint**: ESLint + Prettier
- **Git**: Husky + lint-staged + commitlint (conventional)
- **Agent**: Claude Code + Serena MCP + Zai MCP

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
│   │   ├── rovo/             # Rovo AI adapter (optional enrichment)
│   │   ├── confluence/       # Confluence adapter
│   │   ├── scoring/          # Scoring engine + quality gates + inconsistency detector
│   │   ├── evaluation/       # Shared evaluation pipeline (RTASK-014/016)
│   │   ├── enforcement/      # Enforcement actions (block/approve/comment)
│   │   └── relationship-index/  # Cross-tool relationship graph + context builder
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

Before reading a file with `Read`, try Serena tools (`find_symbol`, `find_referencing_symbols`, `get_symbols_overview`) to understand dependencies and impact.

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

All 46 Ralph tasks completed (RTASK-001 through RTASK-044 + orchestrators). The project is feature-complete.

### Completed Milestones

- RTASK 001-011: Foundation, types, scoring, adapters (Jira, Rovo, GitHub, Confluence), resilience
- RTASK 012: Confluence adapter
- RTASK 013: Resilience patterns
- RTASK 014: Jira triggers (evaluation pipeline)
- RTASK 015: Resolvers (Forge Bridge)
- RTASK 016: GitHub webhook
- RTASK 017: Enforcement actions
- RTASK 018: Jira Issue Panel (UI)
- RTASK 019: Admin Dashboard (UI)
- RTASK 020: GitHub PR Comments
- RTASK 021: Structured logger
- RTASK 024: Project settings
- RTASK 033-036: Rovo Agent (definition, actions, frontend, automation)
- RTASK 037-044: Relationship Index (types, storage, Jira/Confluence/GitHub indexers, context consumer, maintenance)

### Remaining (not Ralph-tracked)

- RTASK 022: Sentry integration
- RTASK 023: Health checks
- RTASK 025-031: CI/CD, testing, docs, coverage

## Key Decisions

- Resilience patterns inline in adapters, not shared module
- Forge handler format: `<filename>.<export>` with thin entry points in `src/`
- Evaluation pipeline shared between RTASK-014 and RTASK-016
- Forge Webpack bundler handles `.ts` natively (no EAP or build step needed)
- Backend resolvers export both `handler` (Forge entry) and named business functions
- Scoring uses relationship context (sibling tickets, docs, PRs, cross-refs) as primary data source; Rovo AI is optional enrichment
- Relationship index is built from Jira/Confluence/GitHub data and maintained via scheduled triggers
- Ralph task pipeline completed — no more orchestrator-driven task execution
