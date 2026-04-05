# Observability & Monitoring

## Error Monitoring (Sentry)

- **Frontend (Custom UI):** Capture React exceptions in the Jira issue panel and admin dashboard
- **Backend (Forge Triggers):** Capture errors in resolvers, triggers, and webhook handlers
- **Context enrichment:** Every error includes the `executionId` linking Jira ticket to GitHub execution
- **Alerting:** Automatic alerts when error rate exceeds defined thresholds

## Structured Logging

- **Format:** JSON structured logs
- **Traceability:** An `executionId` travels from Jira events through Rovo queries to GitHub Actions
- **Correlation:** Logs can be traced between a Jira ticket ID and a GitHub Actions execution ID
- **Implementation:** Centralized logger module used across all layers

## Performance Metrics

- **Rovo query latency:** Track response times for context extraction queries
- **GitHub webhook response time:** Monitor how fast the app responds to webhook events
- **Resolver execution time:** Track Forge resolver performance

## UI Visualization

### Jira Issue Panel
- **Spider Chart (Radial Graph):** Visualizes 5 quality axes of the ticket according to Rovo:
  1. Clarity
  2. Consistency
  3. Risk
  4. Documentation
  5. Technical Debt

### Admin Dashboard
- Panel in Forge for Project Managers
- Shows how many tickets/PRs have been blocked
- ROI estimation in rework hours saved
- Audit log of enforcement actions
- Metrics over time (trends)

## Health Checks

- **Post-deploy script** that verifies the app responds correctly in each environment
- Runs automatically after each deployment
- Checks that Forge resolvers are operational
- Results logged and sent to monitoring

## Alert Strategy

### How to Detect Rovo Integration Failures Before Users Report Them
- Monitor Rovo API response times and error rates
- Alert on timeout patterns (>10s consecutive)
- Alert on empty responses (Rovo returning no context)
- Circuit breaker triggers alert when opened

### Post-Deploy Validation
1. Deploy completes
2. Health check script runs automatically
3. Sentry monitors error spike
4. If error rate >5%: automatic rollback trigger
5. All events logged with `executionId` for traceability
