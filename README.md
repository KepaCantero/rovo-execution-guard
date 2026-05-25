# Rovo Execution Guard

An Atlassian Forge application that validates consistency between Jira, Confluence, and GitHub using a relationship index and multi-axis scoring, blocking low-quality workflow transitions before they reach production. Optionally integrates with Rovo AI for enriched context.

**Version:** 0.1.0
**App ID:** `51b53283-caf2-4636-9e4b-5a6e1d048260`
**Runtime:** Atlassian Forge (nodejs22.x)

---

## Overview

REG acts as an automated quality gatekeeper across your Atlassian and GitHub toolchain. When a developer moves a Jira ticket through workflow transitions or opens a pull request, REG evaluates the ticket against configurable quality gates -- scoring clarity, consistency, risk, documentation quality, and technical debt indicators.

**The problem it solves:** Teams frequently push work through Jira workflows and GitHub PRs with incomplete descriptions, missing acceptance criteria, contradictory documentation, or ambiguous scope. These issues compound into rework, failed sprints, and production incidents. REG catches these problems at the transition boundary, before they propagate downstream.

**How it works:**

1. A Jira ticket transitions to a gated status (e.g., In Progress, In Review, Done), or a GitHub PR is opened/synchronized/merged.
2. REG fetches ticket data from Jira, enriches it with cross-tool relationship context (sibling tickets, linked Confluence docs, associated PRs, cross-references), and optionally queries Rovo AI for additional insights.
3. A multi-axis scoring engine evaluates the ticket on five dimensions.
4. Quality gates compare the score against configurable thresholds.
5. If the gate fails, REG blocks the transition and posts a detailed comment explaining what needs to be fixed.
6. If the gate passes, REG approves the transition and, for PRs, creates a success status check.

**Key design principle: fail-open.** If REG encounters an error (Rovo unavailable, API timeout, malformed data), it allows the transition and logs a warning. The guard never becomes a blocker due to its own failures.

---

## Architecture

REG follows a six-layer architecture with strict dependency rules. Data flows downward -- higher layers depend on lower layers, never the reverse.

```
                    FORGE PLATFORM
                         |
    +--------------------+--------------------+
    |         HANDLERS (Forge entry points)   |
    |  resolver-handler   transition-handler  |
    |  webhook-handler                      |
    +--------------------+--------------------+
                         |
    +--------------------+--------------------+
    |         RESOLVERS (Business logic)      |
    |  workflow-transition  github-webhook    |
    |  index (Custom UI resolvers)           |
    +--------------------+--------------------+
                         |
    +--------------------+--------------------+
    |         SERVICES (Adapters + Engines)   |
    |                                        |
    |  Adapters: jira | github | rovo |      |
|            confluence | relationship-  |
|            index                        |
|                                        |
|  Engines: scoring | quality-gates |     |
|           inconsistency | evaluation |  |
|           enforcement | context-builder                  |
    +--------------------+--------------------+
                         |
    +--------------------+--------------------+
    |         TYPES (Domain models)           |
    |  12 pure TypeScript interfaces          |
    |  Zero external dependencies             |
    +--------------------+--------------------+

    +--------------------+--------------------+
    |         FRONTEND (Custom UI)            |
    |  issue-panel | admin-dashboard          |
    |  shared components + utilities          |
    +-----------------------------------------+
```

**Data flow for a Jira transition:**

```
Jira Event (avi:jira/updated:issue)
    |
    v
transition-handler.handler        <-- Forge trigger entry point
    |
    v
workflow-transition resolver      <-- Parse event, resolve gate type
    |
    v
evaluation-pipeline               <-- Orchestrate: fetch -> score -> gate -> enforce
    |         |          |
    v         v          v
jira       rovo      scoring     <-- Adapters fetch data, engine scores
adapter   adapter     engine
    |
    v
quality-gate-rules                <-- Evaluate pass/fail
    |
    v
enforcement-actions               <-- Block/approve/comment
```

**Data flow for a GitHub PR event:**

```
GitHub Webhook (pull_request event)
    |
    v
webhook-handler.handler           <-- Forge webtrigger entry point
    |
    v
github-webhook resolver           <-- HMAC validation, dedup, rate limit
    |
    v
evaluation-pipeline               <-- Same pipeline shared with Jira triggers
    |
    v
enforcement-actions               <-- Block PR / approve PR / status check
```

---

## Prerequisites

| Requirement           | Version     | Notes                                              |
| --------------------- | ----------- | -------------------------------------------------- |
| **Node.js**           | 22.x        | Specified in `.nvmrc`                              |
| **pnpm**              | Latest      | Package manager (not npm)                          |
| **Forge CLI**         | Latest      | `npm install -g @forge/cli`                        |
| **Atlassian account** | --          | With Forge development access                      |
| **GitHub account**    | --          | For webhook integration and PR status checks       |
| **Sentry**            | Recommended | Error tracking (`@sentry/browser`, `@sentry/node`) |

Install the Forge CLI:

```bash
npm install -g @forge/cli
```

---

## Quick Start

Get REG running locally in under 10 minutes.

**1. Clone and set Node version:**

```bash
git clone <repository-url>
cd rovo-execution-guard
nvm use
```

**2. Install dependencies:**

```bash
pnpm install
```

**3. Authenticate with Forge:**

```bash
forge login
```

**4. Register the app (first time only):**

```bash
forge register
```

**5. Deploy to your development environment:**

```bash
forge deploy -e <environment>
```

Replace `<environment>` with your Forge environment name (e.g., `development`, `staging`, or your custom name).

**6. Verify the deployment:**

```bash
forge install --environment <environment>
```

The app will appear in your Jira instance as an issue panel and an admin page under project settings.

---

## Project Structure

```
rovo-execution-guard/
├── manifest.yml                              # Forge app manifest
├── package.json                              # Dependencies and scripts
├── tsconfig.json                             # TypeScript configuration
├── .nvmrc                                    # Node 22
├── .github/
│   └── workflows/
│       ├── ci.yml                            # PR pipeline
│       ├── deploy.yml                        # Multi-environment deploy
│       └── rollback.yml                      # Automated rollback
├── config/
│   ├── jest.config.js                        # Unit test config
│   └── jest.integration.config.js            # Integration test config
├── src/
│   ├── resolver-handler.ts                   # Forge entry: Custom UI resolvers
│   ├── transition-handler.ts                 # Forge entry: Jira workflow trigger
│   ├── webhook-handler.ts                    # Forge entry: GitHub webtrigger
│   ├── backend/
│   │   ├── types/                            # Domain types (12 files, zero deps)
│   │   │   ├── audit-log.ts                  # Audit trail types
│   │   │   ├── confluence-data.ts            # Confluence page data
│   │   │   ├── consistency-score.ts          # ScoreAxes + ConsistencyScore
│   │   │   ├── enforcement.ts               # EnforcementAction discriminated union
│   │   │   ├── errors.ts                    # Domain error types
│   │   │   ├── github-data.ts               # GitHub PR and status check types
│   │   │   ├── inconsistency.ts             # Inconsistency + severity + source
│   │   │   ├── index.ts                     # Barrel export
│   │   │   ├── jira-data.ts                 # JiraTicketData
│   │   │   ├── project-config.ts            # ProjectConfig + GateConfig
│   │   │   ├── quality-gate.ts              # QualityGateResult + GateType
│   │   │   └── rovo-context.ts              # Rovo AI context
│   │   ├── services/
│   │   │   ├── confluence/
│   │   │   │   └── confluence-adapter.ts     # Confluence API adapter
│   │   │   ├── enforcement/
│   │   │   │   └── enforcement-actions.ts    # Block/approve/comment execution
│   │   │   ├── evaluation/
│   │   │   │   └── evaluation-pipeline.ts    # Shared orchestration pipeline
│   │   │   ├── github/
│   │   │   │   ├── github-adapter.ts         # GitHub API adapter
│   │   │   │   └── pr-comment-formatter.ts   # PR comment templates
│   │   │   ├── jira/
│   │   │   │   └── jira-adapter.ts           # Jira API adapter
│   │   │   ├── rovo/
│   │   │   │   └── rovo-adapter.ts           # Rovo AI adapter
│   │   │   └── scoring/
│   │   │       ├── inconsistency-detector.ts # Cross-source inconsistency finder
│   │   │       ├── quality-gate-rules.ts     # Gate evaluation + enforcement mapping
│   │   │       └── scoring-engine.ts         # Multi-axis weighted scoring
│   │   ├── resolvers/
│   │   │   ├── index.ts                     # Custom UI resolver dispatch
│   │   │   ├── workflow-transition.ts       # Jira transition business logic
│   │   │   └── github-webhook.ts            # GitHub webhook business logic
│   │   └── utils/
│   │       └── sentry.ts                    # Sentry initialization
│   └── frontend/
│       ├── index.ts                         # Frontend entry
│       ├── custom-ui/
│       │   ├── issue-panel/                 # Jira issue panel (index.html + React)
│       │   │   ├── index.ts                # Panel entry point
│       │   │   ├── components/             # Panel-specific components
│       │   │   ├── hooks/                  # Panel-specific hooks
│       │   │   └── styles/                 # Panel styles
│       │   └── admin-dashboard/            # Admin dashboard (index.html + React)
│       │       ├── index.ts                # Dashboard entry point
│       │       ├── types.ts                # Dashboard type definitions
│       │       ├── components/
│       │       │   ├── OverviewTab.tsx      # Metrics dashboard
│       │       │   └── ConfigurationTab.tsx # Project config form
│       │       ├── hooks/
│       │       │   ├── useAdminData.ts      # Admin data fetching
│       │       │   ├── useAuditLog.ts       # Audit log fetching
│       │       │   └── useProjectConfig.ts  # Project config state
│       │       └── styles/
│       │           └── theme.ts            # Dashboard theme constants
│       ├── components/
│       │   └── ErrorBoundary.tsx            # Shared error boundary
│       ├── shared/                          # Shared frontend modules
│       │   ├── components/                  # Shared React components
│       │   ├── hooks/                       # Shared React hooks
│       │   ├── types/                       # Shared TypeScript types
│       │   └── utils/                       # Shared utility functions
│       └── utils/
│           └── sentry.ts                    # Sentry for frontend
├── tests/
│   ├── unit/                                # Mirrors src/ structure
│   ├── integration/                         # Integration tests
│   │   ├── github/                          # GitHub adapter integration
│   │   ├── jira/                            # Jira adapter integration
│   │   ├── rovo/                            # Rovo adapter integration
│   │   └── fixtures/                        # Test fixture JSON files
│   ├── e2e/                                 # End-to-end tests
│   │   ├── github-checks/                   # GitHub status check tests
│   │   ├── admin-dashboard/                 # Dashboard UI tests
│   │   ├── jira-panel/                      # Issue panel UI tests
│   │   └── fixtures/                        # E2E test fixtures
│   ├── mocks/
│   │   ├── forge-api.ts                     # Forge API test mocks
│   │   └── forge-api.spec.ts                # Mock unit tests
│   └── helpers/
│       └── styleMock.js                     # CSS/style mock for Jest
```

---

## Configuration Guide

### ProjectConfig

Each Jira project can have its own configuration stored in Forge Storage. The `ProjectConfig` interface controls which gates are active and what score threshold is required.

```typescript
interface ProjectConfig {
  readonly projectKey: string; // Jira project key (e.g., "PROJ")
  readonly enabled: boolean; // Master switch for REG on this project
  readonly scoreThreshold: number; // Minimum score (0-100) to pass a gate
  readonly gates: GateConfig; // Which lifecycle gates are active
  readonly githubOwner?: string; // GitHub org/user for PR integration
  readonly githubRepo?: string; // GitHub repo for PR integration
}

interface GateConfig {
  readonly definition: boolean; // Gate for "In Progress" transitions
  readonly execution: boolean; // Gate for "In Review" transitions / PR events
  readonly delivery: boolean; // Gate for "Done" / "Merge" transitions
}
```

**Example configuration:**

```json
{
  "projectKey": "ENG",
  "enabled": true,
  "scoreThreshold": 80,
  "gates": {
    "definition": true,
    "execution": true,
    "delivery": true
  },
  "githubOwner": "my-org",
  "githubRepo": "my-repo"
}
```

### Scoring Axes

The scoring engine evaluates each ticket on five independent axes, each scored 0-100. The overall score is a weighted average.

| Axis              | Weight | What it measures                                                    |
| ----------------- | ------ | ------------------------------------------------------------------- |
| **clarity**       | 25     | Description length, structure, acceptance criteria, headings        |
| **consistency**   | 25     | Alignment between summary and description, keyword overlap          |
| **risk**          | 20     | Risk indicators (assignee, priority, vague language), inverse scale |
| **documentation** | 15     | Labels, assignee, reporter, Confluence links in description         |
| **technicalDebt** | 15     | Scope focus, issue type, debt keywords (hack, workaround, etc.)     |

**Default weights:** `clarity: 25, consistency: 25, risk: 20, documentation: 15, technicalDebt: 15` (must sum to 100)

**Default threshold:** `80` (tickets scoring below 80 fail the gate)

Custom weights can be provided via `ScoringConfig`:

```typescript
const customWeights: AxisWeights = {
  clarity: 30,
  consistency: 20,
  risk: 20,
  documentation: 15,
  technicalDebt: 15,
};
```

### Quality Gates

Three lifecycle gates map to Jira workflow statuses:

| Gate           | Triggered by                                          | Pass condition                                                                                   |
| -------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| **definition** | Transition to "In Progress"                           | `overall >= scoreThreshold`                                                                      |
| **execution**  | Transition to "In Review" / PR opened or synchronized | No critical inconsistencies                                                                      |
| **delivery**   | Transition to "Done" / "Merge" / PR merged            | `overall >= scoreThreshold` AND no critical inconsistencies AND documentation references present |

Additional rules configurable via `QualityGateRulesConfig`:

```typescript
interface QualityGateRulesConfig {
  readonly blockOnCritical?: boolean; // Default: true
  readonly requireDocumentation?: boolean; // Default: true
}
```

### Enforcement Actions

When a gate fails, REG generates enforcement actions based on the gate type:

| Action               | Gate                 | What happens                                                 |
| -------------------- | -------------------- | ------------------------------------------------------------ |
| `block_transition`   | definition, delivery | Blocking comment posted on Jira ticket                       |
| `block_pr`           | execution            | GitHub status check set to `failure`, blocking comment on PR |
| `add_comment`        | definition, delivery | Informational comment with score breakdown                   |
| `flag_inconsistency` | execution            | Severity-colored comment on the affected Jira ticket         |

When a gate passes for PR events, REG creates a `success` status check and posts an approval comment with the score breakdown.

---

## GitHub App Setup

To enable PR status checks and webhook evaluation, configure a GitHub App.

### Step 1: Create the GitHub App

1. Go to GitHub Settings > Developer settings > GitHub Apps > New GitHub App.
2. Fill in the application details:
   - **GitHub App name:** `Rovo Execution Guard`
   - **Homepage URL:** Your Atlassian instance URL
   - **Webhook URL:** The Forge webtrigger URL (displayed after running `forge deploy`)
   - **Webhook secret:** Generate a secure random string
3. Set the following permissions:
   - **Pull requests:** Read and write
   - **Commit statuses:** Read and write
   - **Repository metadata:** Read-only
4. Subscribe to events:
   - **Pull request** events
5. Create the App and note the App ID.

### Step 2: Generate a Private Key

1. In the GitHub App settings, scroll to "Private keys".
2. Click "Generate a private key" and save the `.pem` file securely.

### Step 3: Install the App on Your Repository

1. Install the GitHub App on the target repository.
2. Note the installation ID from the installation URL.

### Step 4: Configure Forge Environment Variables

Set the required secrets in your Forge environment:

```bash
forge variables:set --environment development GITHUB_WEBHOOK_SECRET <your-webhook-secret>
forge variables:set --environment development GITHUB_TOKEN <github-token-or-installation-token>
```

**Required environment variables:**

| Variable                | Purpose                                               |
| ----------------------- | ----------------------------------------------------- |
| `GITHUB_WEBHOOK_SECRET` | HMAC-SHA256 secret for webhook signature verification |
| `GITHUB_TOKEN`          | GitHub API token for status checks and PR comments    |

### Step 5: Verify the Webhook

1. Open a test PR in your repository.
2. Check the GitHub App's "Advanced" tab for webhook deliveries.
3. Verify the delivery received a 200 response from the Forge webtrigger.
4. Check the PR for the `rovo-execution-guard/consistency` status check.

---

## Development

### Local Development with Forge Tunnel

The `forge tunnel` command proxies requests from your Atlassian instance to your local machine, enabling hot-reload development:

```bash
pnpm install
forge tunnel
```

The tunnel watches for file changes and automatically reloads. Keep it running while developing.

### Commands

```bash
# Linting
pnpm lint              # ESLint check
pnpm lint:fix          # ESLint with auto-fix

# Formatting
pnpm format            # Prettier write
pnpm format:check      # Prettier check

# Type checking
pnpm typecheck         # TypeScript --noEmit

# Testing
pnpm test:unit         # Jest unit tests
pnpm test:integration  # Jest integration tests
pnpm test:staged       # Jest for staged files (used by lint-staged)
```

### Git Hooks

The project uses Husky 9 with lint-staged and commitlint:

- **Pre-commit:** lint-staged runs ESLint and Prettier on staged files
- **Pre-push:** typecheck + unit tests
- **Commit message:** conventional commits enforced via commitlint

Conventional commit format:

```
type(scope): description [ticket-id]

# Examples:
feat(scoring): add custom axis weights support [RTASK-012]
fix(webhook): handle malformed HMAC signature [REG-022]
chore(deps): update @forge/react to v10 [REG-000]
```

### TypeScript Configuration

REG uses strict TypeScript with the following compiler options:

```json
{
  "target": "ES2022",
  "module": "Node16",
  "moduleResolution": "Node16",
  "strict": true,
  "noUncheckedIndexedAccess": true,
  "noImplicitReturns": true
}
```

**Path aliases** (configured in `tsconfig.json`):

| Alias          | Resolves to                                                 |
| -------------- | ----------------------------------------------------------- |
| `@domain/*`    | `src/backend/*`                                             |
| `@services/*`  | `src/backend/services/*`                                    |
| `@resolvers/*` | `src/backend/resolvers/*`                                   |
| `@frontend/*`  | `src/frontend/*`                                            |
| `@shared/*`    | `src/frontend/shared/*` (scaffolded, no implementation yet) |

### Adding a New Service

1. Create the type interface in `src/backend/types/` with zero external dependencies.
2. Create the adapter in `src/backend/services/<service-name>/` following the Handler -> Service -> Repository pattern.
3. Add a `.reqs.md` sidecar file for requirements traceability.
4. Write unit tests in `tests/unit/` mirroring the source structure.
5. Export from the appropriate barrel file.

---

## Deployment

### Environments

REG uses three environments, each triggered independently:

| Environment     | Branch trigger    | Approval required                  |
| --------------- | ----------------- | ---------------------------------- |
| **development** | Push to `develop` | No                                 |
| **staging**     | Push to `main`    | No                                 |
| **production**  | Tag `v*`          | Yes (GitHub environment reviewers) |

> **Note:** Each environment deploys independently based on the branch/tag trigger. There is no sequential promotion step — ensure staging is verified before tagging a production release.

### Manual Deployment

```bash
# Deploy to a specific environment
forge deploy -e development
forge deploy -e staging
forge deploy -e production
```

### CI/CD Pipeline

> **Note:** CI/CD workflows use `npm ci` for dependency installation. Locally, use `pnpm` as described in Quick Start. Both package managers produce compatible installations.

#### CI Pipeline (`ci.yml`)

Triggered on pull requests to `main` and `develop`. Jobs run in parallel where possible:

```
lint-and-security ──> test-integration ──> test-e2e (main only)

test-unit (parallel with lint-and-security)
```

**Lint and Security job:**

- Prettier format check
- ESLint
- TypeScript strict mode typecheck
- Snyk security scan
- Forge manifest lint (`npx forge lint`)

**Unit Tests job:**

- Jest with coverage
- Coverage gate: 85% on branches, functions, lines, and statements

**Integration Tests job:**

- Runs after lint-and-security passes

**E2E Tests job:**

- Runs only on PRs targeting `main` (not `develop`)

#### Deploy Pipeline (`deploy.yml`)

Triggered by pushes to `develop`, `main`, or version tags (each environment deploys independently):

1. Checkout and install dependencies
2. Install Forge CLI
3. Run `forge deploy --environment <env>`
4. Wait 30 seconds for Forge warm-up
5. Run health check
6. On health check failure: trigger rollback via `repository_dispatch`
7. On success: update `.forge-versions.json` with deployment metadata

#### Rollback Pipeline (`rollback.yml`)

Triggered manually or automatically on deploy failure:

1. Read `lastStable` SHA from `.forge-versions.json`
2. Checkout the last stable version
3. Deploy to the target environment
4. Run health check
5. If rollback also fails: create a GitHub issue with `rollback-failure` and `critical` labels

### Required GitHub Secrets

| Secret            | Purpose                                    |
| ----------------- | ------------------------------------------ |
| `FORGE_APP_ID`    | Forge application ID                       |
| `FORGE_API_TOKEN` | Forge authentication token                 |
| `SENTRY_DSN`      | Sentry Data Source Name for error tracking |
| `SNYK_TOKEN`      | Snyk security scan token                   |
| `GITHUB_TOKEN`    | Automatic (GitHub Actions)                 |

---

## Troubleshooting

### Forge deploy fails with "Manifest validation error"

**Cause:** A module key exceeds the 23-character limit or a handler path is incorrect.

**Fix:** Check `manifest.yml` -- all `key` fields under `function`, `jira:issuePanel`, `jira:adminPage`, `trigger`, and `webtrigger` must be 23 characters or fewer. Handler paths must follow the `<filename>.<export>` format (single dot, relative to `src/`, no file extension).

```yaml
# Correct:
handler: resolver-handler.handler

# Incorrect:
handler: src/resolver-handler.handler
handler: resolver-handler.ts.handler
```

### Forge tunnel disconnects frequently

**Cause:** Network instability or Node version mismatch.

**Fix:** Ensure you are running Node 22.x (`nvm use`). Restart the tunnel with `forge tunnel`. Check your network connection to Atlassian services.

### Unit tests fail with coverage threshold errors

**Cause:** Code coverage dropped below 85% on any metric.

**Fix:** Add tests for uncovered branches, functions, lines, or statements. Check the coverage report:

```bash
pnpm test:unit -- --coverage
```

The coverage thresholds are enforced both locally and in CI (85% on branches, functions, lines, and statements).

### Typecheck fails with module resolution errors

**Cause:** Missing file extensions in imports (required by `moduleResolution: "Node16"`).

**Fix:** Always include `.js` extensions in relative imports (TypeScript resolves these to `.ts` files at compile time):

```typescript
// Correct:
import { getTicketData } from '../jira/jira-adapter.js';

// Incorrect:
import { getTicketData } from '../jira/jira-adapter';
```

### GitHub webhooks return 403

**Cause:** HMAC signature validation failed.

**Fix:** Verify that `GITHUB_WEBHOOK_SECRET` in Forge environment variables matches the secret configured in your GitHub App settings:

```bash
forge variables:list --environment development
```

### GitHub webhooks return 200 but no status check appears

**Cause:** `GITHUB_TOKEN` is missing or invalid.

**Fix:** Set the GitHub token in your Forge environment:

```bash
forge variables:set --environment development GITHUB_TOKEN <your-token>
```

The token needs `repo` scope for creating status checks and PR comments.

### Jira transitions are not being intercepted

**Cause:** The trigger is registered but the gate is disabled in project configuration.

**Fix:** Check the `ProjectConfig` for the project. Ensure `enabled: true` and the relevant gate (definition, execution, or delivery) is set to `true` in the `gates` object. Also verify the target status matches one of the mapped statuses: "In Progress", "In Review", "Done", or "Merge".

### Sentry is not capturing errors

**Cause:** `SENTRY_DSN` environment variable is not set.

**Fix:** Set the Sentry DSN in Forge environment variables and redeploy:

```bash
forge variables:set --environment development SENTRY_DSN <your-sentry-dsn>
forge deploy -e development
```

### Rate limit warnings in logs

**Cause:** The GitHub webhook handler enforces a rate limit of 60 deliveries per minute per repository.

**Fix:** This is expected under heavy webhook traffic. If legitimate events are being throttled, review your GitHub App webhook configuration to ensure you are only subscribing to `pull_request` events, not all repository events.

### "Pipeline timed out after 5000ms" in logs

**Cause:** The evaluation pipeline has a 5-second timeout (within the 8-second Forge limit).

**Fix:** This typically indicates a slow response from Jira, Rovo, or GitHub APIs. The system will fail-open and allow the transition. Check the structured logs for the specific adapter that is timing out. The Rovo adapter has its own 3-second timeout and degrades gracefully when unavailable.
