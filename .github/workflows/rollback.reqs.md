# rollback.reqs.md — Automated Rollback Workflow

> GitHub Actions rollback pipeline for Rovo Execution Guard

## Requirements Traceability

### REQ-ROLLBACK-001: Workflow Triggers

- **Source:** RTASK-025 spec — Workflow 3: rollback.yml
- **Rulebook:** GIT-CI-051 (sequential pipeline)
- **Acceptance:** AC-09
- **Description:** Triggers on `workflow_dispatch` (manual trigger with environment choice) and `repository_dispatch` event type `deploy-failed` (automatic trigger from deploy.yml on health check failure).

### REQ-ROLLBACK-002: Read lastStable from Version Tracking

- **Source:** RTASK-025 spec — Job: rollback (step 2)
- **Rulebook:** AC-07
- **Acceptance:** AC-07
- **Description:** Reads `.forge-versions.json` to find the `lastStable` SHA. Exits with error if the file or key is missing — no rollback possible without a known stable version.

### REQ-ROLLBACK-003: Checkout and Redeploy lastStable

- **Source:** RTASK-025 spec — Job: rollback (steps 3-4)
- **Rulebook:** FORGE-OPS-018 (forge deploy, never tunnel)
- **Acceptance:** AC-07
- **Description:** Fetches from origin, checks out the `lastStable` commit SHA, installs dependencies, and runs `forge deploy` targeting the affected environment.

### REQ-ROLLBACK-004: Post-Rollback Health Check

- **Source:** RTASK-025 spec — Job: rollback (steps 5-6)
- **Rulebook:** GIT-CI-053 (smoke tests after every Forge deploy)
- **Acceptance:** AC-08
- **Description:** After rollback deploy, waits 30 seconds for Forge warm-up, then runs `scripts/health-check.ts`. If the rolled-back version is also unhealthy, creates a GitHub issue with `rollback-failure` and `critical` labels for immediate team attention.

### REQ-ROLLBACK-005: Alert on Rollback Failure

- **Source:** RTASK-025 spec — Job: rollback (step 7)
- **Acceptance:** AC-09
- **Description:** If the health check fails after rollback, creates a GitHub issue containing environment, rolled-back SHA, failed deploy SHA, and trigger source. The job then fails explicitly. `continue-on-error: true` on the health check step ensures the alert step runs before the job fails.

### REQ-ROLLBACK-006: Version Tracking Update

- **Source:** RTASK-025 spec — Job: rollback (step 8)
- **Description:** On successful rollback health check, updates `.forge-versions.json` with the rollback SHA, `rolledBackFrom` SHA, and timestamp. Commits and pushes with `[skip ci]` to avoid retriggering the pipeline.

### REQ-ROLLBACK-007: Secrets Handling

- **Source:** RTASK-025 spec — Secrets section
- **Rulebook:** SEC-PRIV-002 (no secrets in logs/code)
- **Acceptance:** AC-10
- **Description:** `FORGE_API_TOKEN`, `FORGE_APP_ID`, `SENTRY_DSN`, and `GITHUB_TOKEN` referenced via GitHub Secrets. Never hardcoded or logged.

### REQ-ROLLBACK-008: Concurrency Control

- **Source:** CI/CD best practice, GIT-CI-301
- **Description:** One rollback per environment at a time using `concurrency` groups keyed by environment name. Does not cancel in-progress rollbacks (`cancel-in-progress: false`) to avoid interrupting a recovery.

### REQ-ROLLBACK-009: Integration with deploy.yml

- **Source:** RTASK-025 spec — Job: deploy (step 8)
- **Rulebook:** GIT-CI-051 (full sequential pipeline)
- **Acceptance:** AC-09
- **Description:** deploy.yml triggers rollback via `repository_dispatch` with event type `deploy-failed`, passing `environment`, `sha`, and `ref` in the client payload. rollback.yml reads these to determine the target environment and failed version.

## Secrets Required

| Secret            | Purpose                             | Used In              |
| ----------------- | ----------------------------------- | -------------------- |
| `FORGE_API_TOKEN` | Forge CLI authentication            | Forge deploy step    |
| `FORGE_APP_ID`    | Forge application identifier        | Environment variable |
| `SENTRY_DSN`      | Sentry error reporting (optional)   | Environment variable |
| `GITHUB_TOKEN`    | Creating issues on rollback failure | Alert step           |

## Dependencies

- `.nvmrc` — Node.js version file (must contain `22`)
- `package.json` — npm scripts
- `scripts/health-check.ts` — Post-deploy health check (RTASK-023)
- `.forge-versions.json` — Version tracking file (must contain `lastStable` key)
- `deploy.yml` — Triggers rollback via `repository_dispatch` event type `deploy-failed`

## Validation

- YAML syntax validated on creation
- Workflow execution validates end-to-end
- No actionlint warnings
