# Quality Gates

The system defines two levels of Quality Gates: business logic gates (product) and code quality gates (engineering).

## A. Product Quality Gates (Business Logic)

### Gate 1 - Definition
**Trigger:** Ticket transition to "In Progress"

A ticket cannot transition to "In Progress" if the **Rovo Consistency Score is below 80%**.

This ensures every ticket entering development has sufficient clarity, context, and organizational alignment.

### Gate 2 - Execution
**Trigger:** PR merge attempt in GitHub

A PR in GitHub **cannot be merged** if the associated Jira ticket has unresolved inconsistencies.

The system acts as a GitHub Status Check that fails when:
- The linked ticket has detected contradictions
- Required context is missing
- The ticket contradicts organizational documentation

### Gate 3 - Delivery
**Trigger:** Final validation before release

Cross-validation between the PR description and the historical context extracted by Rovo.

Ensures what was delivered aligns with what was validated.

## B. Code Quality Gates (CI/CD Pipeline)

These gates apply to the app's own development pipeline:

| Gate | Requirement | Tool |
|---|---|---|
| Unit Test Coverage | Minimum 85% (target 90%+) | Jest |
| ESLint | Zero warnings, TypeScript strict | ESLint |
| Dependencies | No known vulnerabilities | Dependabot/Snyk |
| Forge Lint | Automatic in pipeline | `forge lint` |
| Integration Tests | Must pass before deploy | Jest + Nock |
| E2E Tests | 100% success required for staging deploy | Playwright |

## Engineering Quality Gates

1. **Technical Gate 1:** No commit enters the repo without passing the linter and local unit tests (enforced via Husky pre-commit).
2. **Technical Gate 2:** No PR is merged without 100% E2E test success in GitHub Actions.
3. **Business Gate:** No Jira ticket is marked "Ready for Development" if Rovo detects a critical technical ambiguity.

## Pipeline Quality Gates

| Stage | Gate | Enforcement |
|---|---|---|
| Local (Husky) | pre-commit: Lint + Unit tests | commit blocked on failure |
| Local (Husky) | commit-msg: Conventional Commits syntax | commit blocked on failure |
| CI (GitHub Actions) | Security scan (Snyk), Code coverage, E2E | PR merge blocked on failure |
| CD (Forge Deploy) | Version tag created + Staging tests pass at 100% | Deploy blocked on failure |
