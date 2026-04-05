# Resilience & Technical Implementation Patterns

## Performance & Resilience

### Timeout Handling
- Use `AbortController` in all fetch calls to external APIs (Rovo, GitHub, Jira, Confluence)
- Maximum timeout: 10 seconds for Forge resolvers
- On timeout: log structured error with `executionId` to Sentry
- Never let a resolver hang indefinitely

### Retry Strategy (Exponential Backoff)
- Maximum 3 retry attempts for transient failures
- Exponential backoff between retries (e.g., 1s, 2s, 4s)
- Applies to all API adapter calls (Rovo, GitHub, Jira, Confluence)
- Only retry on transient errors (5xx, network timeouts), never on 4xx

### Circuit Breaker Pattern
- Implement Circuit Breaker for Rovo and GitHub API calls
- Opens after consecutive failures (configurable threshold)
- Half-open state allows probe requests to test recovery
- When open: returns fallback or cached response immediately
- Prevents cascade failures when external APIs are degraded

### Error Handling in Forge Resolvers
- Handle `AbortError` without breaking the Forge resolver
- Catch and log all exceptions with structured context
- Never expose internal error details to the UI
- Return meaningful user-facing error messages

## Security Implementation

### Secret Management
- Encrypt GitHub App tokens and API keys in Forge Storage
- Use Forge's secure storage API for sensitive data
- Never log or expose tokens/secrets
- Use minimum required scopes (Least Privilege principle)

### OAuth & Authentication
- GitHub Apps authentication for API access
- Forge's built-in authentication for Atlassian APIs
- No custom auth flows - leverage platform security

## Rovo API Quota Management
- Monitor Rovo API usage to stay within quota limits
- Cache context responses when possible (avoid re-querying unchanged data)
- Batch queries when the API supports it
- Fallback mode when quota is exhausted (degraded but functional)

## Structured Logging Specification

### Log Format (JSON)
```json
{
  "timestamp": "ISO-8601",
  "level": "info|warn|error",
  "executionId": "uuid",
  "jiraTicketId": "PROJ-123",
  "githubPrId": "456",
  "action": "describe the action",
  "duration": "ms",
  "context": {}
}
```

### executionId Propagation
- Generated at the start of each trigger/webhook event
- Passed through all function calls in the chain
- Included in all log entries, Sentry reports, and error responses
- Allows tracing: Jira ticket -> Rovo query -> GitHub action -> Audit log
