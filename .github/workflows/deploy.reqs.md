# deploy.reqs.md — Multi-Environment Deployment Workflow

> GitHub Actions deployment pipeline for Rovo Execution Guard

## Requirements Traceability

### REQ-DEPLOY-001: Workflow Triggers

- **Source:** RTASK-025 spec — Workflow 2: deploy.yml
- **Rulebook:** GIT-CI-051 (sequential pipeline), GIT-CI-0785 (staging auto-deploy)
- **Acceptance:** AC-04
- **Description:** Triggers on push to `develop` (→ development), push to `main` (→ staging), and tag `v*` (→ production). Each trigger maps to a specific Forge environment.

### REQ-DEPLOY-002: Development Deploy

- **Source:** RTASK-025 spec — Triggers section
- **Rulebook:** GIT-CI-051
- **Acceptance:** AC-04
- **Description:** On push to `develop`, deploys to the `development` Forge environment. No manual approval required.

### REQ-DEPLOY-003: Staging Deploy

- **Source:** RTASK-025 spec — Triggers section
- **Rulebook:** GIT-CI-0785 (staging auto-deploy on main merge)
- **Acceptance:** AC-04, AC-06
- **Description:** On push to `main`, deploys to the `staging` Forge environment. Automatic (no manual approval). Staging success gates production deployment.

### REQ-DEPLOY-004: Production Deploy with Manual Approval

- **Source:** RTASK-025 spec — Production gate section
- **Rulebook:** GIT-CI-302 (production requires environment with reviewers)
- **Acceptance:** AC-05
- **Description:** On tag `v*`, deploys to production. Uses `environment: production` with required reviewers. Staging must be healthy before production can proceed.

### REQ-DEPLOY-005: Staging Failure Blocks Production

- **Source:** RTASK-025 spec — Risks section
- **Rulebook:** GIT-CI-302 (deployment gate verifying integration tests), GIT-CI-0785
- **Acceptance:** AC-06
- **Description:** Production job depends on staging deploy via `needs`. If staging fails (unhealthy), production job does not execute.

### REQ-DEPLOY-006: Forge Deploy Steps

- **Source:** RTASK-025 spec — Job: deploy
- **Rulebook:** FORGE-OPS-018 (forge deploy, never tunnel)
- **Description:** Each deploy job: checkout → Node 22 → npm ci → install Forge CLI → forge deploy → 30s warm-up wait → health check → version update.

### REQ-DEPLOY-007: Post-Deploy Health Check

- **Source:** RTASK-025 spec — Job: deploy (steps 6-8)
- **Rulebook:** GIT-CI-053 (smoke tests after every Forge deploy)
- **Acceptance:** AC-08
- **Description:** After each deploy, waits 30 seconds for Forge warm-up, then runs `scripts/health-check.ts`. If unhealthy, triggers rollback workflow.

### REQ-DEPLOY-008: Unhealthy Triggers Rollback

- **Source:** RTASK-025 spec — Job: deploy (step 8)
- **Acceptance:** AC-09
- **Description:** If health check fails after deploy, triggers the rollback workflow via `repository_dispatch` event. Also posts a failure comment.

### REQ-DEPLOY-009: Version Tracking

- **Source:** RTASK-025 spec — Job: deploy (step 9)
- **Description:** On successful health check, updates `.forge-versions.json` with the new version and sets `lastStable`.

### REQ-DEPLOY-010: Secrets Handling

- **Source:** RTASK-025 spec — Secrets section
- **Rulebook:** SEC-PRIV-002 (no secrets in logs/code)
- **Acceptance:** AC-10
- **Description:** `FORGE_API_TOKEN`, `FORGE_APP_ID`, and `SENTRY_DSN` referenced via GitHub Secrets. Never hardcoded or logged.

### REQ-DEPLOY-011: Concurrency

- **Source:** CI/CD best practice, GIT-CI-301
- **Description:** One deploy per environment at a time using `concurrency` groups keyed by environment name. Pending deploys cancel in-progress older ones.

### REQ-DEPLOY-012: Job Dependencies

- **Source:** RTASK-025 spec — Sequential pipeline
- **Rulebook:** GIT-CI-301 (sequential jobs with `needs`)
- **Description:** Staging depends on nothing (triggered by push to main). Production depends on staging. Development is independent (triggered by push to develop).

## Secrets Required

| Secret            | Purpose                           | Used In         |
| ----------------- | --------------------------------- | --------------- |
| `FORGE_API_TOKEN` | Forge CLI authentication          | All deploy jobs |
| `FORGE_APP_ID`    | Forge application identifier      | All deploy jobs |
| `SENTRY_DSN`      | Sentry error reporting (optional) | All deploy jobs |

## Dependencies

- `.nvmrc` — Node.js version file (must contain `22`)
- `package.json` — npm scripts
- `scripts/health-check.ts` — Post-deploy health check (RTASK-023; path referenced but may not exist yet)
- `.forge-versions.json` — Version tracking file (created on first successful deploy)
- `rollback.yml` — Triggered on health check failure via `repository_dispatch`

## Validation

- YAML syntax validated on creation
- Workflow execution validates end-to-end
- No actionlint warnings
