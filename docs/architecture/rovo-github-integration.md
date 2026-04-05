# Rovo & GitHub Integration

The app crosses organizational context (from Rovo) with technical execution (from GitHub) to enforce quality before code reaches production.

## Rovo Integration

### What Rovo Provides
- Relevant documentation from Confluence
- Historical tickets from Jira
- Previous decisions and their rationale
- Team context and patterns
- Behavioral patterns (how the team works)

### What the App Does with Rovo Data
- **Detect contradictions** between a ticket and existing documentation
- **Detect functional duplicates** (tickets that solve the same problem)
- **Detect missing critical context** in tickets
- **Validate against implicit standards** (team conventions not written down)

## GitHub Integration

### PR Status Checks
The app acts as a **GitHub Status Check**:
- When a PR is created/updated, the app evaluates the linked Jira ticket
- If the ticket doesn't pass the Rovo consistency score, the PR check **fails**
- This blocks the merge in GitHub until the ticket is fixed

### Context Injection in PRs
- The app injects **validated context** as comments in GitHub PRs
- This gives reviewers the organizational context directly in the PR
- No need to switch to Jira to understand the ticket's background

### Webhook Event Handling
- The app listens to GitHub Webhooks (PR created, updated, synchronize)
- On each event, it re-evaluates the Jira ticket based on code changes
- This creates a **bidirectional validation loop**

### Bidirectional Blocking
If code in a PR contradicts business rules in Jira (detected via Rovo):
- The PR fails its status check
- A comment is added explaining the inconsistency
- The Jira ticket is updated with the enforcement action

## Data Flow

```
Jira Ticket ──> Rovo Context Extraction ──> Consistency Scoring
                                                        │
                                                        ▼
GitHub PR ──> Webhook Trigger ──> Cross-Validation ──> Status Check (Pass/Fail)
                                                        │
                                                        ▼
                                              Enforcement Action
                                              (Block/Approve/Comment)
```

## Integration Architecture

```
Jira API <──> Forge Triggers <──> Domain (Scoring + Validation)
                                          │
                                          ▼
GitHub API <──> Webhooks <──> Enforcement (Status Checks + Comments)
                                          │
                                          ▼
Rovo API ──> Context Provider ──> Inconsistency Detection
```
