# GitFlow Workflow

## Branch Strategy

| Branch | Purpose | Protection | Deploy Target |
|---|---|---|---|
| `main` | Production code | Protected, only receives merges from `release/*` or `hotfix/*` | Forge Production |
| `release/vX.X.X` | Stabilization for final testing and staging deploy | Protected | Forge Staging |
| `develop` | Integration branch | Protected | Forge Development |
| `feature/JIRA-ID-description` | Feature development | None | None (local) |
| `hotfix/JIRA-ID-description` | Critical production fixes | None | Forge Production |

## Conventional Commits Standard

All commits must follow this format:

```
<type>(<scope>): <description> [JIRA-ID]
```

### Types

| Type | Meaning | Version Impact |
|---|---|---|
| `feat` | New functionality | MINOR bump |
| `fix` | Bug correction | PATCH bump |
| `chore` | Maintenance (no code change) | None |
| `docs` | Documentation only | None |
| `style` | Formatting (no logic change) | None |
| `refactor` | Code restructuring (no behavior change) | None |
| `BREAKING CHANGE` | API/Manifest breaking change | MAJOR bump |

### Validation
- **Husky** enforces commit format at `commit-msg` hook
- **commitlint** validates syntax
- **lint-staged** runs linting on staged files

## Pull Request Protocol

### PR Template Requirements
Every PR must include:
- Context (what and why)
- Risk assessment
- Test checklist
- Link to associated Jira ticket

### Merge Criteria
A PR **cannot be merged** if:
- GitHub Actions pipeline fails (Lint + Unit + Integration + E2E)
- Code coverage drops below 90%
- Fewer than 2 approvals (Peer Review)

### Merge Method
- **Squash & Merge only** - Maintains a clean, atomic, linear history
- Each merged PR becomes a single commit on the target branch

## Development Lifecycle

```
1. Create feature branch from develop: feature/JIRA-ID-description
2. Implement with conventional commits (validated by Husky)
3. Push and create PR to develop
4. CI pipeline runs (Lint, Security, Unit, Integration)
5. Peer review (minimum 2 approvals)
6. Squash & Merge to develop -> Auto deploy to Forge Development
7. Create release/vX.X.X from develop
8. E2E tests run in Staging
9. Merge release to main -> Auto deploy to Forge Staging
10. Create version tag -> Manual approval -> Deploy to Forge Production
```
