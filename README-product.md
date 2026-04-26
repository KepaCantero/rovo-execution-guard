# Rovo Execution Guard

Automated quality gates for Jira, Confluence, and GitHub -- powered by Atlassian Rovo AI.

---

## The Problem

Engineering teams lose hours every sprint to inconsistent work items: Jira tickets with vague descriptions, pull requests missing acceptance criteria, and documentation that contradicts the code it describes. These gaps compound into rework, missed deadlines, and production incidents.

Manual reviews catch some of these problems, but they are inconsistent, slow, and burdensome for senior engineers who should be focused on architecture rather than ticket quality patrol.

## The Solution

Rovo Execution Guard (REG) automatically evaluates every Jira workflow transition and GitHub pull request against configurable quality gates. When a developer moves a ticket to "In Review" or opens a PR, REG scores the work item across five dimensions, cross-references it with Confluence documentation and Rovo AI context, and either approves the transition or blocks it with a detailed explanation of what needs to be fixed.

**Result:** Higher-quality work items reach production, fewer cycles are wasted on rework, and engineering managers get a consistent, objective quality signal across every project.

### Key Differentiators

- **Automated, not manual:** Quality gates run on every transition -- no human reviewer needed for basic quality checks
- **Cross-tool intelligence:** REG correlates data from Jira, Confluence, and GitHub in a single evaluation, catching inconsistencies that siloed reviews miss
- **Fail-open by design:** If REG encounters an error, it allows the transition and logs a warning. Your workflow is never blocked by a tool failure
- **Per-project configuration:** Each Jira project sets its own thresholds, active gates, and scoring weights
- **Full audit trail:** Every evaluation is logged with scores, decisions, and reasoning for compliance and retrospective analysis

### Who Is It For

| Role                    | Benefit                                                               |
| ----------------------- | --------------------------------------------------------------------- |
| **Engineering Manager** | Objective quality metrics across all projects; fewer sprint surprises |
| **Tech Lead**           | Consistent code review standards; less time policing ticket quality   |
| **Developer**           | Immediate feedback on what a ticket or PR needs before review begins  |
| **DevOps / QA**         | Automated enforcement of documentation and consistency standards      |

---

## Key Features

### 1. Consistency Score Algorithm

Every work item is scored on five independent axes, each rated 0-100. The overall score is a weighted average:

| Axis               | Weight | What it measures                                                  |
| ------------------ | ------ | ----------------------------------------------------------------- |
| **Clarity**        | 25%    | Description structure, acceptance criteria, headings              |
| **Consistency**    | 25%    | Alignment between summary and description, keyword overlap        |
| **Risk**           | 20%    | Risk indicators (missing assignee, vague language), inverse scale |
| **Documentation**  | 15%    | Labels, Confluence links, reporter presence                       |
| **Technical Debt** | 15%    | Scope focus, issue type, debt keywords (hack, workaround)         |

Teams can customize axis weights per project to emphasize what matters most. The default threshold is 80/100 -- work items scoring below are flagged or blocked.

### 2. Three Enforcement Gates

REG enforces quality at three lifecycle boundaries:

| Gate           | Triggered when                                        | What happens on failure                                                 |
| -------------- | ----------------------------------------------------- | ----------------------------------------------------------------------- |
| **Definition** | Ticket moves to "In Progress"                         | Transition blocked, comment posted with score breakdown                 |
| **Execution**  | Ticket moves to "In Review" or PR opened/synchronized | PR status check set to failure, blocking comment on PR                  |
| **Delivery**   | Ticket moves to "Done" or PR merged                   | Transition blocked if critical inconsistencies or missing documentation |

### 3. Bidirectional Jira <-> GitHub Enforcement

Changes in Jira are reflected in GitHub and vice versa:

- A Jira transition triggers evaluation and can block the corresponding PR
- A GitHub PR event triggers evaluation and posts results back to the Jira ticket
- Status checks on GitHub PRs show REG pass/fail with score details
- Comments on both Jira and GitHub include the full score breakdown and specific inconsistencies found

### 4. Per-Project Configuration

Each Jira project configures REG independently:

```json
{
  "projectKey": "ENG",
  "enabled": true,
  "scoreThreshold": 80,
  "gates": {
    "definition": true,
    "execution": true,
    "delivery": true
  },
  "githubOwner": "my-org",
  "githubRepo": "my-repo"
}
```

Teams control which gates are active, what score threshold applies, and which GitHub repository is linked. Configuration is managed through the Admin Dashboard in Jira project settings.

### 5. Full Audit Trail

Every evaluation is logged with:

- Timestamp and execution ID
- Overall score and per-axis breakdown
- Gate result (pass/fail) and enforcement actions taken
- Inconsistencies detected with severity levels
- Rovo AI context used in the evaluation

The audit trail is accessible through the Admin Dashboard and can be exported for compliance reporting.

### 6. Rovo AI-Powered Context

REG leverages Atlassian Rovo AI to enrich ticket analysis with cross-tool intelligence. Rovo correlates information across Jira, Confluence, and connected knowledge bases to identify:

- Outdated documentation referenced by a ticket
- Contradictions between Confluence pages and Jira descriptions
- Missing context that similar completed tickets included
- Related work items that should be linked

This cross-tool awareness catches issues that single-source scoring cannot.

---

## User Flows

### Scenario 1: Developer Moves Jira Ticket to "In Review"

```
Developer opens Jira ticket ENG-123
       |
       v
Clicks "Move to In Review"
       |
       v
REG intercepts the transition event
       |
       v
+------+------+------+------+
|      |      |      |      |
v      v      v      v      v
Jira   Rovo   Score  Gate   Confluence
data   AI     engine check docs
       |             |
       v             v
  Score: 72/100   FAIL (threshold: 80)
       |
       v
Transition BLOCKED
Comment posted: "Score 72/100. Issues found:
 - Clarity (60): Missing acceptance criteria
 - Documentation (55): No Confluence links
 Improve these axes to pass the gate."
       |
       v
Developer updates ticket, retries transition
       |
       v
Score: 85/100 -- PASS -- Transition proceeds
```

**What the developer sees:** A detailed comment on the Jira ticket explaining exactly which axes scored low and what to improve. No guesswork.

### Scenario 2: Developer Opens a GitHub Pull Request

```
Developer opens PR #42 in GitHub
       |
       v
GitHub sends webhook to REG (via Forge webtrigger)
       |
       v
REG validates HMAC signature + deduplicates event
       |
       v
+------+------+------+------+
|      |      |      |      |
v      v      v      v      v
Jira   Rovo   Score  Gate   Cross-ref
ticket AI     engine check PR with Jira
       |
       v
Score: 88/100 -- PASS
       |
       v
+---------------------------+
| GitHub status check: pass |
| PR comment: score 88/100  |
| Jira comment: PR approved |
+---------------------------+
```

**What the developer sees:** A green status check on the PR and a comment with the score breakdown. The linked Jira ticket is also updated.

### Scenario 3: Engineering Manager Reviews Audit Trail

```
Manager opens Jira project settings
       |
       v
Navigates to "Execution Guard" admin page
       |
       v
+------------------------------------------+
| Overview Tab                             |
|  - Avg score this week: 82/100           |
|  - Gate pass rate: 87%                   |
|  - Most common failure: documentation    |
|                                          |
| Configuration Tab                        |
|  - Score threshold: 80                   |
|  - Active gates: definition, execution   |
|  - GitHub repo: my-org/my-repo           |
|                                          |
| Audit Log Tab                            |
|  - ENG-123 | 2026-04-20 | PASS | 85     |
|  - ENG-124 | 2026-04-20 | FAIL | 62     |
|  - ENG-125 | 2026-04-21 | PASS | 91     |
+------------------------------------------+
```

**What the manager sees:** Aggregate metrics, per-project configuration, and a searchable audit log of every evaluation.

---

## ROI Calculator

Use this framework to estimate the return on investment from deploying REG.

### Baseline Metrics (Before REG)

Track these metrics for 2-4 weeks before enabling REG:

| Metric                                        | How to measure                                               | Your baseline |
| --------------------------------------------- | ------------------------------------------------------------ | ------------- |
| Rework rate                                   | % of tickets that return to "In Progress" after "In Review"  | \_\_\_%       |
| Sprint carry-over                             | % of stories not completed within the sprint                 | \_\_\_%       |
| PR review cycles                              | Average number of review rounds before merge                 | \_\_\_        |
| Documentation gaps                            | % of tickets missing acceptance criteria or Confluence links | \_\_\_%       |
| Production incidents from missed requirements | Count per sprint                                             | \_\_\_        |

### Expected Improvements

Based on automated quality gate patterns:

| Metric                             | Expected improvement | Low estimate | High estimate |
| ---------------------------------- | -------------------- | ------------ | ------------- |
| Rework rate                        | 30-50% reduction     | \_\_\_%      | \_\_\_%       |
| Sprint carry-over                  | 15-25% reduction     | \_\_\_%      | \_\_\_%       |
| PR review cycles                   | 20-30% reduction     | \_\_\_%      | \_\_\_%       |
| Documentation gaps                 | 50-70% reduction     | \_\_\_%      | \_\_\_%       |
| Incidents from missed requirements | 25-40% reduction     | \_\_\_%      | \_\_\_%       |

### Sample Calculation

For a team of 8 developers with an average cost of $75/hour:

| Item                                     | Calculation                     | Annual savings   |
| ---------------------------------------- | ------------------------------- | ---------------- |
| Reduced rework (2 hrs/sprint avoided)    | 2 hrs x 26 sprints x $75        | $3,900           |
| Faster PR reviews (1 round saved per PR) | 1 hr x 10 PRs/sprint x 26 x $75 | $19,500          |
| Fewer carry-over items (1 story/sprint)  | 4 hrs x 26 sprints x $75        | $7,800           |
| **Estimated total**                      |                                 | **$31,200/year** |

Adjust the numbers to your team's actual costs and volumes. Even conservative estimates typically show ROI within the first sprint cycle.

---

## Screenshots

> Screenshots will be added when the UI modules (RTASK-018 Issue Panel, RTASK-019 Admin Dashboard) reach production.

### Issue Panel (Jira)

<!-- Placeholder: screenshot of REG evaluation results in the Jira issue panel -->

```
[TODO: Screenshot - Issue Panel]
Shows: Overall score with per-axis breakdown, gate result (pass/fail),
       list of detected inconsistencies with severity indicators,
       and action buttons for re-evaluation.
```

### Admin Dashboard

<!-- Placeholder: screenshot of REG admin dashboard in Jira project settings -->

```
[TODO: Screenshot - Admin Dashboard]
Shows: Overview tab with aggregate metrics (avg score, pass rate, common failures),
       Configuration tab with project settings (threshold, gates, GitHub link),
       Audit log tab with filterable evaluation history.
```

### GitHub PR Status Check

<!-- Placeholder: screenshot of REG status check on a GitHub pull request -->

```
[TODO: Screenshot - GitHub PR Check]
Shows: REG status check (pass/fail) in the PR merge box,
       detailed comment with score breakdown and specific issues,
       link back to the Jira ticket evaluation.
```

---

## Pricing

|                        | **Free**                                    | **Pro**                                      |
| ---------------------- | ------------------------------------------- | -------------------------------------------- |
| **Price**              | $0                                          | Contact for pricing                          |
| **Projects**           | Up to 5 Jira projects                       | Unlimited                                    |
| **Quality gates**      | All three (definition, execution, delivery) | All three                                    |
| **Scoring axes**       | All five axes                               | All five axes + custom weights               |
| **Audit trail**        | 30-day history                              | Unlimited history + export                   |
| **GitHub integration** | Yes                                         | Yes                                          |
| **Rovo AI context**    | Yes                                         | Yes                                          |
| **Admin dashboard**    | Basic metrics                               | Advanced analytics + trends                  |
| **Support**            | Community                                   | Priority email                               |
| **Custom enforcement** | Default actions only                        | Custom gate rules and thresholds per project |

**Enterprise tier** with custom deployment, SLA guarantees, and dedicated support is planned. See the [Marketplace plan](docs/marketplace-plan.md) for details.

---

## Get Started

1. Install REG from the Atlassian Marketplace (or deploy from source -- see the [technical README](README.md))
2. Configure your first project in Jira project settings > Execution Guard
3. Set your quality thresholds and enable gates
4. REG evaluates every transition automatically -- no manual triggering needed

For detailed setup instructions including GitHub App configuration, see the [technical README](README.md).
