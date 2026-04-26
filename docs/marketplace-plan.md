# Rovo Execution Guard -- Atlassian Marketplace Plan

Publication plan for listing Rovo Execution Guard (REG) on the Atlassian Marketplace.

**App ID:** `51b53283-caf2-4636-9e4b-5a6e1d048260`
**Runtime:** Atlassian Forge (nodejs22.x)
**Status:** Pre-submission

---

## Atlassian Marketplace Requirements

### Compliance Checklist

| Requirement                     | Status  | Notes                                                                                                         |
| ------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------- |
| Forge app manifest valid        | Done    | `manifest.yml` passes `forge lint`                                                                            |
| App key under 23 characters     | Done    | All function and resource keys verified                                                                       |
| Required scopes declared        | Done    | `read:jira-work`, `write:jira-work`, `read:confluence-content.all`, `write:confluence-content`, `storage:app` |
| No hardcoded secrets            | Done    | All credentials via Forge environment variables                                                               |
| Data residency compliance       | Done    | Forge-hosted, data stays within Atlassian infrastructure                                                      |
| Privacy policy URL              | Pending | Must be hosted and accessible before submission                                                               |
| EULA URL                        | Pending | Must be drafted and hosted before submission                                                                  |
| Marketplace listing description | Pending | Draft in this document below                                                                                  |
| Screenshots (minimum 3)         | Pending | Issue Panel, Admin Dashboard, GitHub PR Check                                                                 |
| App logo (SVG, 144x144)         | Pending | Design needed                                                                                                 |
| Support email configured        | Pending | Set in developer.atlassian.com profile                                                                        |
| Forge CLI version current       | Done    | Using latest `@forge/cli`                                                                                     |

### App Review Criteria

Atlassian reviews submissions against these criteria:

1. **Functionality:** The app does what it claims and handles errors gracefully. REG's fail-open design ensures the app never blocks workflows due to its own failures.
2. **Security:** Minimal scopes, no secret exposure, proper HMAC validation. REG requests only the scopes listed above and validates GitHub webhook signatures with HMAC-SHA256.
3. **Performance:** Operations complete within Forge limits. REG's evaluation pipeline has a 5-second timeout (within the 8-second Forge limit), with per-adapter timeouts (Rovo: 3s).
4. **User Experience:** Clear UI, helpful error messages, consistent with Atlassian Design System. REG uses @atlaskit components throughout.
5. **Data Privacy:** No data leaves the Atlassian infrastructure. REG processes ticket data in-memory during evaluation and stores only configuration and audit logs in Forge Storage.

---

## Pricing Tiers

### Feature Comparison

|                        | **Free**                                    | **Pro**                                      | **Enterprise**                                 |
| ---------------------- | ------------------------------------------- | -------------------------------------------- | ---------------------------------------------- |
| **Price**              | $0                                          | $5/user/month                                | Custom                                         |
| **Jira projects**      | Up to 5                                     | Unlimited                                    | Unlimited                                      |
| **Quality gates**      | All three (definition, execution, delivery) | All three                                    | All three + custom gates                       |
| **Scoring axes**       | All five (standard weights)                 | All five + custom weights                    | All five + custom weights + custom axes        |
| **Audit trail**        | 30-day history                              | Unlimited history + CSV/PDF export           | Unlimited + SIEM integration                   |
| **GitHub integration** | Yes                                         | Yes                                          | Yes + on-premise GitHub Enterprise             |
| **Rovo AI context**    | Yes                                         | Yes                                          | Yes + custom AI models                         |
| **Admin dashboard**    | Basic metrics                               | Advanced analytics + trends                  | Advanced + team benchmarks + executive reports |
| **Enforcement rules**  | Default actions only                        | Custom gate rules and thresholds per project | Custom rules + approval workflows              |
| **Support**            | Community (Atlassian Community forum)       | Priority email (24h response)                | Dedicated support engineer + Slack channel     |
| **SLA**                | Best effort                                 | 99.5% uptime SLA                             | 99.9% uptime SLA + custom terms                |
| **SSO/SAML**           | No                                          | No                                           | Yes                                            |
| **Deployment**         | Forge-hosted                                | Forge-hosted                                 | Forge-hosted or dedicated                      |
| **Onboarding**         | Self-service docs                           | Guided setup + onboarding call               | White-glove onboarding + training sessions     |
| **Contract**           | Monthly                                     | Monthly or annual                            | Annual or multi-year                           |

### Pricing Rationale

- **Free tier** targets small teams and evaluation use cases. The 5-project limit is generous enough for a single engineering team to adopt REG across their active projects while encouraging upgrade for multi-team organizations.
- **Pro tier** at $5/user/month is competitive with similar quality gate tools. The unlimited projects, custom weights, and advanced analytics justify the cost for teams that have validated REG on the free tier.
- **Enterprise tier** is priced individually based on organization size and requirements. The dedicated support, SLA guarantees, and custom integration options address the needs of large organizations with compliance requirements.

### Billing Model

REG uses the Atlassian Marketplace billing system:

- **Free:** No billing required. Users install directly.
- **Pro:** Billed per Jira user on the instance (not per project). Monthly or annual billing through Atlassian.
- **Enterprise:** Custom contract. Billed annually through Atlassian or direct sales.

---

## Publication Checklist

### Pre-Submission

- [ ] **Manifest validation:** Run `forge lint` -- zero errors
- [ ] **Privacy policy:** Draft and host at a public URL
- [ ] **EULA:** Draft and host at a public URL
- [ ] **App logo:** Create SVG logo (144x144, follows Atlassian brand guidelines)
- [ ] **Screenshots:** Capture 3 minimum:
  - [ ] Issue Panel showing evaluation results
  - [ ] Admin Dashboard showing configuration and metrics
  - [ ] GitHub PR Check showing status check and comment
- [ ] **Listing description:** Finalize marketing copy (see draft below)
- [ ] **Category selection:** Choose "Developer Tools" or "Project Management"
- [ ] **Search keywords:** Define for marketplace search visibility
- [ ] **Support channel:** Set up support email and response process
- [ ] **Documentation:** Verify [README.md](../README.md) is complete and accurate

### Testing Verification

- [ ] **Unit tests:** All pass with >= 85% coverage (`pnpm test:unit -- --coverage`)
- [ ] **Integration tests:** All pass (`pnpm test:integration`)
- [ ] **Typecheck:** Zero errors (`pnpm typecheck`)
- [ ] **Lint:** Zero errors (`pnpm lint`)
- [ ] **Format:** Consistent formatting (`pnpm format:check`)
- [ ] **Forge deploy:** Clean deploy to staging environment
- [ ] **Smoke test:** Full end-to-end flow verified on staging:
  - [ ] Jira transition triggers evaluation
  - [ ] GitHub PR triggers evaluation
  - [ ] Score below threshold blocks transition
  - [ ] Score above threshold approves transition
  - [ ] Admin dashboard loads and displays metrics
  - [ ] Issue panel loads and displays evaluation

### Security Review

- [ ] **Scopes minimal:** Only 5 scopes requested, all necessary
- [ ] **No hardcoded secrets:** All credentials via Forge environment variables
- [ ] **HMAC validation:** GitHub webhook signature verification implemented
- [ ] **Rate limiting:** Webhook handler enforces 60 req/min per repository
- [ ] **Fail-open design:** Errors do not block customer workflows
- [ ] **Data handling:** No PII stored; only project configuration and audit scores in Forge Storage
- [ ] **Sentry DSN:** Error tracking configured, no sensitive data in breadcrumbs

### Marketing Assets

- [ ] **Logo:** SVG, 144x144, follows Atlassian brand guidelines
- [ ] **Banner image:** 2880x600 px for marketplace listing
- [ ] **Screenshots:** 3 minimum with annotations
- [ ] **Demo video (optional):** 2-3 minute walkthrough showing the core flow
- [ ] **Listing title:** "Rovo Execution Guard"
- [ ] **Tagline:** "Automated quality gates for Jira, Confluence, and GitHub"
- [ ] **Search keywords:** "quality gate", "jira github", "pull request check", "consistency score", "code review automation", "rovo ai"

### Submission

- [ ] **Create listing** on developer.atlassian.com
- [ ] **Upload assets** (logo, screenshots, banner)
- [ ] **Enter description** (see draft below)
- [ ] **Submit for review** (Atlassian review takes 5-10 business days)
- [ ] **Respond to reviewer feedback** if any

### Post-Submission

- [ ] **Monitor installation metrics** via developer.atlassian.com dashboard
- [ ] **Set up support process:** Respond to community questions within 48 hours
- [ ] **Plan update cadence:** Monthly patch releases, quarterly feature releases
- [ ] **Collect user feedback:** Track feature requests and bug reports
- [ ] **Monitor error rates** via Sentry dashboard
- [ ] **Update documentation** with each release

---

## Marketplace Listing Draft

### Short Description (200 characters max)

Automated quality gates that score Jira tickets and GitHub PRs across 5 dimensions, blocking low-quality transitions before they reach production.

### Long Description

**Rovo Execution Guard** automatically evaluates every Jira workflow transition and GitHub pull request against configurable quality gates, ensuring consistent, well-documented work items reach production.

**How it works:**

When a developer moves a Jira ticket through workflow transitions or opens a pull request, Rovo Execution Guard scores the work item across five dimensions -- clarity, consistency, risk, documentation quality, and technical debt. If the score falls below your configured threshold, the transition is blocked with a detailed explanation of what needs to be fixed.

**Key features:**

- **5-Axis Consistency Score:** Every ticket scored on clarity, consistency, risk, documentation, and technical debt with configurable weights and thresholds
- **3 Enforcement Gates:** Quality gates at definition (In Progress), execution (In Review/PR), and delivery (Done/Merge) lifecycle boundaries
- **Bidirectional Jira-GitHub:** Changes in Jira reflect in GitHub and vice versa -- status checks, comments, and enforcement stay synchronized
- **Rovo AI-Powered Context:** Atlassian Rovo AI enriches evaluations with cross-tool intelligence, catching inconsistencies that siloed reviews miss
- **Per-Project Configuration:** Each Jira project sets its own thresholds, active gates, and scoring weights
- **Full Audit Trail:** Every evaluation logged with scores, decisions, and reasoning for compliance and retrospectives

**Built on Atlassian Forge** -- data stays within Atlassian infrastructure. No external servers, no data residency concerns.

### Categories

Primary: Developer Tools
Secondary: Project Management

### Search Keywords

quality gate, jira github, pull request check, consistency score, code review automation, rovo ai, workflow enforcement, ticket quality

---

## Timeline

| Phase                         | Description                                                                       |
| ----------------------------- | --------------------------------------------------------------------------------- |
| **Alpha**                     | Internal testing on development environment. Core evaluation pipeline functional. |
| **Beta**                      | Limited external testing. Free tier available. Collect feedback.                  |
| **GA (General Availability)** | Full marketplace listing. Free + Pro tiers. Marketing campaign launch.            |
| **Enterprise**                | Enterprise tier available. Custom deployments. Dedicated support team.            |

---

## Success Metrics

| Metric                       | Target (6 months post-launch)            |
| ---------------------------- | ---------------------------------------- |
| Total installations          | 100+                                     |
| Active weekly users          | 50+                                      |
| Free-to-Pro conversion       | 10-15%                                   |
| Average gate pass rate       | 80%+ (indicates effective enforcement)   |
| Support ticket response time | < 24 hours (Pro), < 4 hours (Enterprise) |
| NPS score                    | > 40                                     |
