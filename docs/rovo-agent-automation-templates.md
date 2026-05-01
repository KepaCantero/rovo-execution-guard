# Rovo Agent Automation Templates

Recommended automation templates for using the Consistency Guard agent in Jira and Confluence automation rules.

## Prerequisites

- The Consistency Guard agent is registered via the `rovo:agent` Forge module
- The agent exposes 5 actions: `evaluate-issue`, `check-pr-consistency`, `validate-spec-alignment`, `explain-score`, `get-improvement-tips`
- The agent appears automatically in Jira/Confluence automation builders under "AI actions"

## Template 1: Pre-Transition Consistency Check

| Field     | Value                                                  |
| --------- | ------------------------------------------------------ |
| Name      | Pre-Transition Consistency Check                       |
| Trigger   | Issue transitioned (Before save)                       |
| Condition | Target status is "In Progress", "In Review", or "Done" |
| Action    | Invoke Consistency Guard agent                         |

**Prompt:**

```
Evaluate issue {{issue.key}} and determine if it should transition
from {{issue.fromStatus}} to {{issue.toStatus}}. Report any quality
concerns that should be addressed before the transition.
```

**Use case:** Prevent low-quality transitions by running a consistency check before state changes. The agent evaluates documentation coverage, spec alignment, and cross-references.

---

## Template 2: Weekly Consistency Report

| Field   | Value                               |
| ------- | ----------------------------------- |
| Name    | Weekly Consistency Report           |
| Trigger | Scheduled (every Monday at 9:00 AM) |
| Scope   | Project {{project.key}}             |
| Action  | Invoke Consistency Guard agent      |

**Prompt:**

```
Generate a weekly consistency report for project {{project.key}}.
Analyze all issues updated in the last 7 days and provide:
1. Average consistency score
2. Worst performing scoring axis
3. Top 5 issues needing attention
4. Trend compared to last week (if data available)
5. Recommendations for the team
```

**Use case:** Generate periodic quality snapshots for project health monitoring. Identifies systemic issues and trends over time.

> **Note:** Scheduled triggers require adding a `scheduled-trigger` module to the app manifest. This is a future enhancement.

---

## Template 3: PR Created Auto-Check

| Field     | Value                                       |
| --------- | ------------------------------------------- |
| Name      | PR Created Auto-Check                       |
| Trigger   | Issue linked to external resource (webhook) |
| Condition | Resource type is "pull_request"             |
| Action    | Invoke Consistency Guard agent              |

**Prompt:**

```
Check PR consistency for {{issue.key}} against its linked pull request.
Verify that acceptance criteria are addressed and there are no
scope mismatches between the issue and the PR.
```

**Use case:** Automatically validate PR-issue alignment when a pull request is linked, catching scope creep and missing acceptance criteria early.

---

## Template 4: New Issue Quality Gate

| Field     | Value                             |
| --------- | --------------------------------- |
| Name      | New Issue Quality Gate            |
| Trigger   | Issue created                     |
| Condition | Issue type is Story, Task, or Bug |
| Action    | Invoke Consistency Guard agent    |

**Prompt:**

```
Evaluate the quality of newly created issue {{issue.key}}.
Check if it has adequate description, acceptance criteria, labels,
and priority. Suggest improvements before development begins.
```

**Use case:** Enforce minimum quality standards at issue creation time, reducing rework caused by poorly specified work items.

---

## Template 5: Confluence Spec Change Alert

| Field     | Value                                                 |
| --------- | ----------------------------------------------------- |
| Name      | Confluence Spec Change Alert                          |
| Trigger   | Confluence page updated (in specific space)           |
| Condition | Page labels include "specification" or "requirements" |
| Action    | Invoke Consistency Guard agent                        |

**Prompt:**

```
A specification page has been updated: {{content.title}}.
Identify any Jira issues in project {{project.key}} that may be
affected by this change and report potential misalignments.
```

**Use case:** Detect when specification changes may invalidate existing issue descriptions or acceptance criteria, enabling proactive updates.

---

## Setting Up Automation Rules

1. Navigate to **Project Settings > Automation** in Jira (or **Space Settings > Automation** in Confluence)
2. Create a new rule
3. Select the appropriate trigger from the templates above
4. Add the condition if specified
5. Select **AI Action** as the action type
6. Choose **Consistency Guard** from the agent list
7. Paste the prompt template, replacing placeholders with smart values (e.g., `{{issue.key}}`)
8. Test the rule with a sample issue before enabling

## Smart Value Reference

| Placeholder            | Jira Source           | Confluence Source  |
| ---------------------- | --------------------- | ------------------ |
| `{{issue.key}}`        | Current issue key     | N/A                |
| `{{issue.fromStatus}}` | Previous status value | N/A                |
| `{{issue.toStatus}}`   | Target status value   | N/A                |
| `{{project.key}}`      | Current project key   | Space key          |
| `{{content.title}}`    | N/A                   | Updated page title |
