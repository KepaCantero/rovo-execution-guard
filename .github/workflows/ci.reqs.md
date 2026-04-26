# ci.reqs.md — Continuous Integration Workflow

> GitHub Actions CI pipeline for Rovo Execution Guard

## Requirements Traceability

### REQ-CI-001: Workflow Triggers

- **Source:** RTASK-025 spec — Workflow 1: ci.yml
- **Rulebook:** GIT-CI-051 (sequential pipeline), GIT-CI-052 (main always deployable)
- **Acceptance:** AC-01
- **Description:** Triggers on pull requests targeting `main` or `develop`. All PRs (including Dependabot) run the full CI suite.

### REQ-CI-002: Lint and Security Job

- **Source:** RTASK-025 spec — Job: lint-and-security
- **Rulebook:** SEC-PRIV-002 (no secrets in logs), GIT-CI-044-03 (Prettier check in CI), GIT-CI-301 (explicit sequential jobs)
- **Acceptance:** AC-01
- **Description:** Runs ESLint (zero warnings), TypeScript strict check, Prettier format check, Snyk security scan, and Forge manifest lint. Sequential steps with fail-fast behavior.

### REQ-CI-003: Unit Tests with Coverage

- **Source:** RTASK-025 spec — Job: test-unit
- **Rulebook:** GIT-CI-0814 (coverage as CI gate), GIT-CI-0865 (essential checks block merge)
- **Acceptance:** AC-02
- **Description:** Runs unit tests with coverage collection. Fails if coverage drops below 85%. Independent job running in parallel with lint-and-security.

### REQ-CI-004: Integration Tests

- **Source:** RTASK-025 spec — Job: test-integration
- **Rulebook:** GIT-CI-051 (full sequential pipeline)
- **Acceptance:** AC-01
- **Description:** Runs integration tests with mocks. No real API calls. Independent job.

### REQ-CI-005: E2E Tests (main only)

- **Source:** RTASK-025 spec — Job: test-e2e
- **Rulebook:** GIT-CI-051
- **Acceptance:** AC-03
- **Description:** Runs Playwright E2E tests only on PRs targeting `main` (not `develop`). Conditional execution.

### REQ-CI-006: Node.js Version

- **Source:** RTASK-025 spec — Node 22 from .nvmrc
- **Rulebook:** GIT-CI-303 (matrix builds for supported versions)
- **Description:** Uses Node 22 from `.nvmrc`. Single version (no matrix) as Forge targets nodejs22.x.

### REQ-CI-007: Secrets Handling

- **Source:** RTASK-025 spec — Secrets section
- **Rulebook:** SEC-PRIV-002 (no sensitive data in logs/code)
- **Acceptance:** AC-10
- **Description:** Snyk token referenced via `secrets.SNYK_TOKEN`. Never hardcoded or logged.

### REQ-CI-008: Job Dependencies

- **Source:** RTASK-025 spec — Workflow structure
- **Rulebook:** GIT-CI-301 (sequential jobs with `needs`)
- **Description:** `lint-and-security` and `test-unit` run in parallel. `test-integration` depends on `lint-and-security`. `test-e2e` depends on `test-integration` and only runs on `main` PRs.

### REQ-CI-009: Timeout

- **Source:** RTASK-025 spec (general CI best practice)
- **Description:** 30-minute timeout per job to prevent runaway builds.

### REQ-CI-010: Concurrency

- **Source:** CI/CD best practice
- **Description:** Cancel in-progress runs for the same PR to save resources.

## Secrets Required

| Secret       | Purpose                                | Used In           |
| ------------ | -------------------------------------- | ----------------- |
| `SNYK_TOKEN` | Snyk vulnerability scan authentication | lint-and-security |

## Dependencies

- `.nvmrc` — Node.js version file (must contain `22`)
- `package.json` — npm scripts: `lint`, `typecheck`, `format:check`, `test:unit`
- `config/jest.config.js` — Jest configuration

## Validation

- YAML syntax validated on creation
- Workflow execution validates end-to-end
- No actionlint warnings
