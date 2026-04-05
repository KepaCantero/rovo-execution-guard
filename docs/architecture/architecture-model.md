# Architecture Model

## Technology Stack

| Technology | Version | Purpose |
|---|---|---|
| Atlassian Forge | Current | Serverless runtime with integrated security |
| Node.js | 22.x LTS | Runtime (use nvm for version management) |
| @forge/react | v10 | React integration for Forge |
| React | 18 | UI (native hooks mandatory) |
| Atlassian Design System (ADS) | Current | UI components and design patterns |
| GitHub REST API | v3 | PR control and status checks |
| GitHub Webhooks | - | Event triggers from external repositories |
| GitHub Actions | - | CI/CD automation for the app's own repo |
| TypeScript | Strict | Type safety across all code |
| Jest | - | Unit and integration testing |
| Playwright | - | End-to-end testing |
| Husky + commitlint | - | Git hooks and commit validation |
| Semantic Release | - | Automated versioning |
| Sentry/Datadog | - | Error monitoring and observability |

### Important Constraints

- Avoid unnecessary backend invocations
- Prioritize client-side execution when possible
- Minimize latency
- Respect Forge platform limits

## 6-Layer Architecture

### 1. Domain Layer
The core business logic with zero external dependencies.

- Quality rules
- Ticket and PR validation
- Inconsistency logic
- Enforcement criteria

### 2. Integration Layer
External system communication via adapters.

- Forge APIs
- Jira API
- Confluence API
- Rovo context access
- GitHub API (state synchronization, commit/PR validation)

### 3. Orchestration Layer
Event-driven coordination.

- Triggers (Forge events + GitHub Webhooks)
- Resolvers
- Validation flows
- Automatic actions

### 4. Presentation Layer
User-facing interfaces.

- UI in Jira issue view
- UI in Confluence
- Clear feedback panel
- Automated comments in GitHub PRs

### 5. Observability Layer
System transparency and monitoring.

- Structured logs
- Functional metrics
- Audit trail

### 6. Configuration Layer
Per-team customization.

- Rules per team
- Quality thresholds
- Feature toggles

## Forge Platform Restrictions

The following constraints must be respected in all implementations:

- Respect execution time and latency limits
- Minimize storage usage
- Avoid heavy/long-running processes
- Design for scalability
- Handle permissions correctly (Jira Scopes, Confluence Scopes, GitHub App/Tokens)
