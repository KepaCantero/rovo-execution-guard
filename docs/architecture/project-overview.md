# Rovo Execution Guard - Project Overview

## What Is It

Rovo Execution Guard is a **Forge app that acts as an operational control layer**, not an AI assistant or generic tool.

It uses Rovo as a source of organizational context to:
- Validate tickets and knowledge
- Detect real inconsistencies
- Apply enforcement within Jira, Confluence, and GitHub
- Reduce rework and errors
- Ensure quality before, during, and after execution

## Core Thesis

AI has made it trivial to generate content and code. The real problem now is: **ensuring that content is correct, consistent, executable, and that delivered code responds exactly to validated context.**

Therefore:

### What We Build
- Contextual validation
- Cross-platform operational enforcement (Jira <-> GitHub)
- Strict workflow control (Quality Gates)
- Audit and traceability

### What We Do NOT Build
- AI chat
- Automatic summaries
- Generic dashboards
- Simple commit visualizer in Jira

### What We DO Build
- A system that **blocks invalid tickets**
- A system that **blocks PRs that don't comply with the ticket context**
- A system that **explains errors with real context**
- A system that **acts** (not just suggests)

## Enforcement Capabilities (Core)

The system must be able to:
- Block ticket transitions in Jira
- Update and invalidate PR Checks in GitHub
- Mark inconsistencies
- Suggest ticket splitting
- Register decisions

## MVP Scope

The MVP must include:

1. **Quality / Consistency Score** - A numeric score representing ticket quality
2. **Context validation via Rovo** - Extract organizational truth from Jira, Confluence
3. **Inconsistency detection** - Find contradictions between ticket and documentation
4. **Basic GitHub validation** - PR status checks based on ticket state
5. **Workflow blocking** - In both Jira and GitHub when requirements aren't met
6. **Per-project configuration** - Customizable rules and thresholds
7. **Basic audit** - Log of enforcement actions and decisions
8. **CI/CD Pipeline** - Configured for the app's own repo (technical quality gates)

## AI Usage Strategy

AI is **optional and limited** to:
- Ticket rewriting suggestions
- Explanation of problems between PRs and tickets
- Signal prioritization

Requirements for AI features:
- Must have a **fallback without AI** (no critical dependency)
- Must have **cost controls**
- AI is a complement, never a dependency

## Business Metrics

Optimize for:
- Reduction of rework
- Reduction of clarifications in PRs
- Reduction of duplicates
- Improvement of ticket quality
- Team adoption

## Final Objective

Build an app that a company buys because it:
- Reduces real errors
- Improves execution
- Saves time
- Introduces control where there was chaos
