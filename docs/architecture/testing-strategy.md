# Testing Strategy

## Testing Pyramid (AAA Level)

### Unit Tests (Jest + @testing-library/react)

- **Framework:** Jest
- **Coverage target:** >90% on domain layer and Rovo validation logic
- **Scope:** Pure business logic, scoring engine, inconsistency detection, validation rules
- **No external dependencies:** All API calls mocked

### Integration Tests

- **Framework:** Jest with mocking (Nock for HTTP)
- **Scope:** Contract tests with Atlassian and GitHub APIs
- **Approach:** Standardized mocks for Rovo responses
- **Key scenarios:**
  - Jira API adapter handles errors correctly
  - GitHub API adapter creates status checks properly
  - Rovo API adapter processes context extraction
  - Confluence API adapter retrieves documentation

### E2E Tests (Playwright)

- **Framework:** Playwright in isolated containers
- **Mandatory flow to test:**
  1. Create/Edit a ticket in Jira
  2. Rovo Execution Guard trigger activates
  3. Attempt to create a PR in GitHub
  4. Block/Approve based on Quality Score
- **Deployment gate:** 100% E2E success required before staging/production deploy

## Automation with Git Hooks (Husky + lint-staged)

### pre-commit Hook
Runs on every `git commit`:
- ESLint linting
- Prettier formatting
- Unit tests of affected files only

### pre-push Hook
Runs on every `git push`:
- TypeScript type checking
- Critical integration tests

### commit-msg Hook
- Validates Conventional Commits syntax
- Ensures Jira ticket ID is present

## Test Scope by Layer

| Layer | Unit | Integration | E2E |
|---|---|---|---|
| Domain (Scoring, Validation) | Yes (primary) | - | - |
| Integration (API Adapters) | - | Yes (primary) | - |
| Orchestration (Triggers, Resolvers) | Yes | Yes | - |
| Presentation (UI) | Yes (components) | - | Yes (flows) |
| Full Flow (Jira -> Rovo -> GitHub) | - | - | Yes (primary) |

## Quality Gate: Code Coverage

- Minimum coverage: **85%** (strict)
- Target coverage: **90%+** on domain and validation layers
- Coverage is enforced in CI pipeline (merge blocked if below threshold)
