---
id: RTASK-025
title: 'CI/CD - GitHub Actions Pipelines'
status: pending
priority: 3
type: infrastructure
dependencies: [RTASK-001, RTASK-004, RTASK-023]
rulebook_refs: [GIT-CI-004, GIT-CI-005, GIT-CI-006]
spec: docs/tickets/TASK-025-cicd-github-actions.md
---

# RTASK-025: CI/CD - GitHub Actions Pipelines

## Objective

Implement the complete CI/CD pipeline using GitHub Actions with three workflows: continuous integration (lint, security, tests), multi-environment deployment (dev, staging, production), and automated rollback. Every merge is validated before deployment, production requires manual approval, and unhealthy deployments are automatically rolled back.

## Context

The Rovo Execution Guard is deployed on Atlassian Forge, which uses the `forge deploy` CLI command. GitHub Actions orchestrates the CI checks and deployment flow across three environments. The pipeline must ensure code quality gates (lint, typecheck, security scan, tests with >85% coverage) pass before any deployment, and that post-deploy health checks (RTASK-023) validate each environment.

## Technical Specification

### Location

`.github/workflows/`

### Workflow 1: `ci.yml` — Continuous Integration

**Triggers:**

- Pull requests targeting `main` or `develop`

**Jobs:**

#### `lint-and-security`

1. Checkout code
2. Setup Node 22 (from `.nvmrc`)
3. `npm ci`
4. `npm run lint` — ESLint with zero warnings
5. `npm run typecheck` — TypeScript strict mode
6. Snyk security scan (`snyk test`)
7. `npx forge lint` — Forge manifest validation

#### `test-unit`

1. Checkout code
2. Setup Node 22
3. `npm ci`
4. `npm run test:unit -- --coverage`
5. Fail if coverage < 85%

#### `test-integration`

1. Checkout code
2. Setup Node 22
3. `npm ci`
4. `npm run test:integration` — runs with mocks (no real API calls)

#### `test-e2e`

- **Only runs on PRs targeting `main`** (not `develop`)

1. Checkout code
2. Setup Node 22
3. `npm ci`
4. `npm run test:e2e` — Playwright tests against staging

### Workflow 2: `deploy.yml` — Multi-Environment Deployment

**Triggers:**

- Push to `develop` -> deploy to **development**
- Push to `main` -> deploy to **staging**
- Tag `v*` -> deploy to **production** (requires manual approval)

**Jobs:**

#### `deploy` (matrix or conditional)

1. Checkout code
2. Setup Node 22
3. `npm ci`
4. Install Forge CLI: `npm install -g @forge/cli`
5. `forge deploy` using environment-specific credentials
6. Wait 30 seconds (Forge warm-up)
7. Run health check (`scripts/health-check.ts`)
8. If unhealthy -> trigger rollback workflow
9. If healthy -> update `.forge-versions.json` with new version

**Production gate:**

- `environment: production` with required reviewers (manual approval)
- Staging must be healthy before production deploy can proceed
- Secrets: `FORGE_API_TOKEN`, `FORGE_APP_ID`, `SENTRY_DSN`

### Workflow 3: `rollback.yml` — Automated Rollback

**Triggers:**

- `workflow_dispatch` (manual trigger)
- `repository_dispatch` (triggered by deploy workflow on health check failure)

**Jobs:**

#### `rollback`

1. Checkout code
2. Read `.forge-versions.json` to find `lastStable` version
3. Checkout `lastStable` version
4. `forge deploy` with stable version
5. Wait 30 seconds
6. Run health check
7. If still unhealthy -> alert via Sentry and GitHub issue
8. If healthy -> update `.forge-versions.json` with rollback info

### Secrets (GitHub Secrets)

- `FORGE_API_TOKEN` — Forge authentication token
- `FORGE_APP_ID` — Forge application identifier
- `SENTRY_DSN` — Sentry Data Source Name (optional)
- Secrets never logged or exposed in workflow output

### Sidecar: `ci.reqs.md`, `deploy.reqs.md`, `rollback.reqs.md`

- Use `.ralph/templates/reqs-template.md` format
- Document triggers, jobs, secrets, acceptance criteria

## Acceptance Criteria

- [ ] AC-01: `ci.yml` runs lint, typecheck, security scan, and tests on every PR to `main`/`develop`
- [ ] AC-02: `test-unit` job enforces >85% coverage; fails below threshold
- [ ] AC-03: `test-e2e` only runs on PRs to `main` (not `develop`)
- [ ] AC-04: `deploy.yml` deploys to correct environment per trigger (develop->dev, main->staging, tag->prod)
- [ ] AC-05: Production deployment requires manual approval (environment protection rule)
- [ ] AC-06: Staging failure blocks production deployment
- [ ] AC-07: `rollback.yml` can revert to `lastStable` version from `.forge-versions.json`
- [ ] AC-08: Health check runs post-deploy on all environments
- [ ] AC-09: Unhealthy deployment triggers rollback automatically
- [ ] AC-10: Secrets are referenced via GitHub Secrets (never hardcoded)
- [ ] AC-11: Sidecar files created for all three workflows

## Triple Deliverable

| Production (.yml)                | Sidecar (.reqs.md)                   | Test                            |
| -------------------------------- | ------------------------------------ | ------------------------------- |
| `.github/workflows/ci.yml`       | `.github/workflows/ci.reqs.md`       | Validated by workflow execution |
| `.github/workflows/deploy.yml`   | `.github/workflows/deploy.reqs.md`   | Validated by workflow execution |
| `.github/workflows/rollback.yml` | `.github/workflows/rollback.reqs.md` | Validated by workflow execution |

## Risks

| Risk                             | Mitigation                                                        |
| -------------------------------- | ----------------------------------------------------------------- |
| Forge CLI unavailable in Actions | Install via `npm install -g @forge/cli` in workflow               |
| Secrets leaked in logs           | GitHub Actions masks secrets automatically; never echo them       |
| Flaky E2E tests block PRs        | E2E only on `main` PRs; allow retry                               |
| Rollback to broken version       | Validate `lastStable` version is actually stable via health check |
| Deployment race conditions       | Staging must succeed before production gate opens                 |

## QA Gates

### Pre-Implementation Gates

- [ ] **GATE-READY**: All dependencies ([RTASK-001, RTASK-004, RTASK-023]) are completed
- [ ] **GATE-SPEC**: Rulebook sections GIT-CI-004, GIT-CI-005, GIT-CI-006 have been read and understood
- [ ] **GATE-DESIGN**: Implementation approach documented before coding

### Implementation Gates (per workflow)

- [ ] **GATE-VALIDATE**: YAML syntax validated before committing
- [ ] **GATE-SECURITY**: No secrets hardcoded; all use GitHub Secrets
- [ ] **GATE-IDEMPOTENT**: Workflows produce same result on re-run

### Post-Implementation Gates

- [ ] **GATE-LINT**: `actionlint` passes with zero warnings
- [ ] **GATE-REQS**: All `.reqs.md` sidecar files created and complete
- [ ] **GATE-DRY-RUN**: Workflows validated by execution (dry-run or actual trigger)

## Requirements Creation Protocol

For each workflow file, the builder MUST create a `.reqs.md` sidecar:

1. **Before implementation**: Create `.reqs.md` listing all requirements from the spec
2. **Format**: Use `.ralph/templates/reqs-template.md` format
3. **Content**: Each requirement maps to an acceptance criterion and rulebook rule
4. **Traceability**: Every AC in the task maps to at least one section in the sidecar
5. **Location**: Sidecar lives adjacent to the workflow file (same directory)

## Implementation Protocol

### Step 1: Preparation

1. Read the full task spec (`docs/tickets/TASK-025-cicd-github-actions.md`)
2. Read referenced rulebook sections (`docs/rulebook/RULEBOOK.md` → GIT-CI-004, GIT-CI-005, GIT-CI-006)
3. Read all dependency task outputs to understand available interfaces
4. Create `.reqs.md` sidecar files with requirements traceability

### Step 2: Workflow Creation (per workflow)

1. Create workflow YAML with proper triggers and jobs
2. Validate YAML syntax
3. Verify secrets reference (no hardcoded values)
4. Ensure proper environment protection rules

### Step 3: Integration

1. Wire workflow triggers (e.g., rollback triggered by deploy workflow)
2. Verify secret references match GitHub Secrets configuration
3. Ensure health check integration (RTASK-023) works in deploy workflow

### Step 4: Validation

1. Validate YAML syntax — must pass
2. Run `actionlint` — must pass with zero warnings
3. Verify by workflow execution (dry-run or actual trigger)
4. Confirm secrets are referenced via GitHub Secrets (never hardcoded)

## Auditing Protocol

### Critic Review Checklist

- [ ] All acceptance criteria verified as implemented
- [ ] No secrets hardcoded in workflow files
- [ ] All workflows use proper triggers (push, PR, workflow_dispatch)
- [ ] Production deployment requires manual approval
- [ ] Health check runs post-deploy on all environments
- [ ] Rollback workflow is triggered automatically on unhealthy deployment
- [ ] Triple deliverable complete: `.yml` + `.reqs.md` + validation
- [ ] No code outside specified file locations (`.github/workflows/`)
- [ ] Dependencies only on completed RTASK modules
- [ ] Rulebook rules GIT-CI-004, GIT-CI-005, GIT-CI-006 are satisfied

### Rejection Criteria

The critic MUST reject if:

- Any secret is hardcoded in a workflow file
- A `.reqs.md` sidecar is missing
- Production deployment lacks manual approval gate
- Health check step is missing from deploy workflow
- Rollback workflow is not wired to deploy workflow
- External dependencies were added without approval

## Testing Protocol

### CI/CD YAML Validation

- **No unit tests for YAML files** — validated by workflow execution
- Location: `.github/workflows/`
- Validation approach: Workflow execution and dry-run

### Validation Categories Required

- [ ] **ci.yml**: Runs lint, typecheck, security scan, and tests on every PR
- [ ] **deploy.yml**: Deploys to correct environment per trigger with health checks
- [ ] **rollback.yml**: Reverts to last stable version on health check failure
- [ ] **Secrets**: All secrets referenced via GitHub Secrets (never hardcoded)
- [ ] **Environment protection**: Production requires manual approval
