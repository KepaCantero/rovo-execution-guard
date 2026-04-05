# CI/CD, Deploy & Versioning

## Semantic Versioning (Automated)

Use **Semantic Release** to automate versioning based on Conventional Commits:

| Commit Type | Version Bump | Example |
|---|---|---|
| `fix:` | PATCH | v1.0.0 -> v1.0.1 |
| `feat:` | MINOR | v1.0.0 -> v1.1.0 |
| `BREAKING CHANGE:` | MAJOR | v1.0.0 -> v2.0.0 |
| `chore/docs/style:` | None | No version change |

Each version automatically generates:
- Updated `CHANGELOG.md`
- GitHub Release with tag
- Updated version in `package.json` and Forge `manifest.yml`

## Deployment Environments

The GitHub Actions pipeline manages three Forge environments:

### Development
- **Trigger:** Push to `develop` branch
- **Command:** `forge deploy -e development`
- **Validation:** Lint + Unit tests (via Husky pre-push)

### Staging
- **Trigger:** Merge to `main` branch (or PR to main)
- **Command:** `forge deploy -e staging`
- **Validation:** Full test suite + Playwright E2E tests
- **Gate:** All E2E tests must pass at 100%

### Production
- **Trigger:** Version tag created (`v*.*.*`)
- **Command:** `forge deploy -e production + forge install --upgrade`
- **Validation:** All previous gates passed
- **Gate:** Manual approval (Deployment Gate in GitHub Actions)

## GitHub Actions Workflows

### CI Workflow (`ci.yml`)
Runs on every PR:
1. **Lint & Security Job:** Secret scanning + dependency audit (Snyk/Dependabot)
2. **Test Job:** Parallel execution of Unit + Integration tests
3. **E2E Job:** Playwright in isolated containers
4. **Deploy Job:** Auto-deploy to staging or production only if all previous succeed

### CD Workflow (`deploy.yml`)
- Push to `develop` -> Deploy to Forge Development
- Merge to `main` -> Deploy to Forge Staging + Playwright E2E
- Tag `v*.*.*` -> Deploy to Forge Production + `forge install --upgrade`

### Rollback Workflow (`rollback.yml`)
- **Trigger:** Manual or automatic (if Sentry detects critical errors post-deploy)
- **Action:** Deploys the previous stable version (`forge deploy -e production --version <stable_version>`)
- **Version registry:** The system maintains `.forge-versions.json` tracking the last stable version tested by E2E

## Rollback Strategy

### Automatic Rollback Triggers
- Sentry error rate exceeds 5% post-deploy
- Health check fails after deployment

### Rollback Execution
- GitHub Actions workflow triggered manually or automatically
- Deploys version n-1 (previous stable tag)
- Target: Revert in under 2 minutes

### Version State Tracking
- `.forge-versions.json` maintains a record of the last stable version
- Updated only when E2E tests pass in staging
