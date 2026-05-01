---
id: RTASK-033
title: 'Integration Layer - Rovo Agent Definition'
status: pending
priority: 3
type: integration
dependencies: [RTASK-010, RTASK-005]
rulebook_refs: [ROVO-INTEG-001, ROVO-INTEG-002, ROVO-INTEG-003, FORGE-OPS-001]
spec: docs/tickets/TASK-033-integration-rovo-agent-definition.md
---

# RTASK-033: Integration Layer - Rovo Agent Definition

## Objective

Define a Rovo Agent via the official Forge `rovo:agent` and `action` manifest modules, creating a "Consistency Guard" specialist that integrates natively into Jira/Confluence Chat, automation rules, and the issue context. This replaces the reliance on undocumented internal `/gateway/api/rovo/*` endpoints with a GA, publicly supported integration path.

## Context

The existing Rovo integration (RTASK-010) uses internal gateway endpoints (`/gateway/api/rovo/search` and `/gateway/api/rovo/validate`) that are not publicly documented and may change without notice. Atlassian now provides official Forge modules (`rovo:agent` + `action`) that allow apps to define agents with custom prompts, conversation starters, and typed actions backed by Forge functions.

This task creates the declarative foundation: manifest entries for the agent and its 5 actions, plus the agent prompt file. The actual handler logic for actions is implemented in RTASK-034.

### Key Rovo Agent Capabilities

- Appears in Rovo Chat sidebar in Jira and Confluence
- Can be used in Jira/Confluence automation rules (asynchronous)
- Can be a "teammate" on Jira work items
- Accesses organizational knowledge via Teamwork Graph
- Supports Deep Research mode for complex analysis
- Can invoke Forge functions via `action` modules with typed inputs

## Technical Specification

### Location

- `manifest.yml` (modify)
- `src/backend/services/rovo/agent-prompts/consistency-guard.txt` (create)

### Manifest Changes

#### 1. `rovo:agent` Module

```yaml
modules:
  rovo:agent:
    - key: consistency-guard
      name: 'Consistency Guard'
      description: 'Validates consistency between Jira, Confluence, and GitHub, explains scoring, and suggests improvements.'
      prompt: resource:agent-prompts;consistency-guard.txt
      conversationStarters:
        - 'Evaluate the current issue for consistency'
        - "What is wrong with this ticket's documentation score?"
        - 'Check if this issue aligns with our Confluence specs'
        - "Suggest improvements for my ticket's clarity"
        - 'Explain why my workflow transition was blocked'
      actions:
        - evaluate-issue
        - check-pr-consistency
        - validate-spec-alignment
        - explain-score
        - get-improvement-tips
      followUpPrompt: >
        Based on the analysis above, would you like me to suggest specific edits
        to improve the ticket, or shall I re-evaluate after you make changes?
```

**Key constraints:**

- `key` must match regex `^[a-zA-Z0-9_-]+$` and max 23 characters (`consistency-guard` = 16 chars)
- `name` max 30 characters
- `prompt` can be a string or a resource reference (`resource:key;filename`)
- Agent only accesses data from the workspace where the app is installed

#### 2. `action` Modules (5 actions)

```yaml
action:
  - key: evaluate-issue
    function: agent-action-fn
    actionVerb: GET
    name: Evaluate Issue
    description: 'Runs the full consistency evaluation on a Jira issue, returning scores, inconsistencies, and gate status.'
    inputs:
      issueKey:
        type: string
        required: true
        description: 'The Jira issue key to evaluate (e.g., PROJ-123)'

  - key: check-pr-consistency
    function: agent-action-fn
    actionVerb: GET
    name: Check PR Consistency
    description: 'Checks consistency between a GitHub PR and its linked Jira issue.'
    inputs:
      prUrl:
        type: string
        required: true
        description: 'The GitHub PR URL to check'
      issueKey:
        type: string
        required: true
        description: 'The linked Jira issue key'

  - key: validate-spec-alignment
    function: agent-action-fn
    actionVerb: GET
    name: Validate Spec Alignment
    description: 'Validates that a Jira issue aligns with its related Confluence specification pages.'
    inputs:
      issueKey:
        type: string
        required: true
        description: 'The Jira issue key to validate'

  - key: explain-score
    function: agent-action-fn
    actionVerb: GET
    name: Explain Score
    description: 'Provides a detailed explanation of how each scoring axis was calculated for a given issue.'
    inputs:
      issueKey:
        type: string
        required: true
        description: 'The Jira issue key to explain'

  - key: get-improvement-tips
    function: agent-action-fn
    actionVerb: GET
    name: Get Improvement Tips
    description: 'Generates specific, actionable improvement suggestions for a Jira issue based on its consistency analysis.'
    inputs:
      issueKey:
        type: string
        required: true
        description: 'The Jira issue key to improve'
      focusAxis:
        type: string
        required: false
        description: 'Optional: focus suggestions on one axis (clarity, consistency, risk, documentation, technicalDebt)'
```

**Key constraints:**

- `key` max 23 characters (all pass: `evaluate-issue` = 14, `check-pr-consistency` = 19, etc.)
- `actionVerb` must be one of: `GET`, `CREATE`, `UPDATE`, `DELETE`, `TRIGGER`
- `description` is used by the LLM to decide when to invoke the action
- `inputs` define typed parameters the LLM collects from the user
- Automation agents do NOT invoke actions with `CREATE`, `UPDATE`, `DELETE`, `TRIGGER` verbs

#### 3. New `function` Entry

```yaml
function:
  # ... existing entries ...
  - key: agent-action-fn
    handler: agent-action-handler.handler
```

#### 4. New `resource` Entry (for prompt file)

```yaml
resources:
  # ... existing entries ...
  - key: agent-prompts
    path: src/backend/services/rovo/agent-prompts
```

**Resource key constraint:** max 23 characters (`agent-prompts` = 13 chars).

### Agent Prompt File

**File:** `src/backend/services/rovo/agent-prompts/consistency-guard.txt`

The prompt must define:

1. **Role**: AI specialist in workflow quality and consistency validation between Jira, Confluence, and GitHub
2. **5 Capabilities**:
   - A. Evaluating Jira issues for consistency quality
   - B. Checking PR-to-issue alignment
   - C. Validating spec alignment between Jira and Confluence
   - D. Explaining scoring methodology and individual axis scores
   - E. Suggesting specific improvements to ticket quality
3. **Scoring Guide**:
   - 80-100: Excellent quality, ready for transition
   - 60-79: Acceptable but needs improvement
   - 40-59: Below standard, significant improvements needed
   - 0-39: Critical issues, should not transition
4. **Axis Explanations** (for capability D):
   - Clarity (25%): Description quality, structure, acceptance criteria
   - Consistency (25%): Summary-description alignment, keyword overlap
   - Risk (20%): Missing fields, vague urgency, incomplete information
   - Documentation (15%): Labels, assignee, reporter, links to docs
   - Technical Debt (15%): Issue type, acceptance criteria, debt keywords
5. **Output Format**: Clear headings, bullets, prominent score display
6. **Important Rules**:
   - Never suggest bypassing quality gates
   - Base analysis on data returned by actions, not assumptions
   - Respect the project's configured threshold
   - Highlight both agreements and discrepancies across tools

### Action Function Payload

Each action receives a payload with this structure:

```typescript
interface ActionPayload {
  // Input parameters as defined in manifest
  issueKey?: string;
  prUrl?: string;
  focusAxis?: string;
  // Forge-injected context
  context: {
    cloudId: string;
    moduleKey: string;
    jira?: {
      url: string;
      resourceType: string;
      issueKey: string;
      issueId: number;
      issueType: string;
      projectKey: string;
      projectId: number;
    };
  };
}
```

### No Additional Scopes Required

The agent and actions use existing scopes:

- `read:jira-work`, `write:jira-work`
- `read:confluence-content.all`, `write:confluence-content`
- `storage:app`
- External fetch to `*.github.com`

## Acceptance Criteria

- [ ] AC-01: `rovo:agent` module defined in `manifest.yml` with key `consistency-guard`, correct name, description, and conversation starters
- [ ] AC-02: Five `action` modules defined in `manifest.yml` with correct keys, verbs, functions, and typed inputs
- [ ] AC-03: New `function` entry `agent-action-fn` points to `agent-action-handler.handler`
- [ ] AC-04: New `resource` entry `agent-prompts` points to prompt directory
- [ ] AC-05: Agent prompt file `consistency-guard.txt` exists with role definition, 5 capabilities, scoring guide, output format, and rules
- [ ] AC-06: All keys comply with Forge manifest constraints (max 23 chars, valid regex)
- [ ] AC-07: `forge manifest validate` passes with zero errors
- [ ] AC-08: `.reqs.md` sidecar file created for manifest changes

## QA Gates

### Pre-Implementation Gates

- [ ] **GATE-READY**: All dependencies (RTASK-010, RTASK-005) are completed
- [ ] **GATE-SPEC**: Rulebook sections ROVO-INTEG-001, ROVO-INTEG-002, ROVO-INTEG-003, FORGE-OPS-001 have been read and understood
- [ ] **GATE-DESIGN**: Manifest structure and prompt content reviewed before coding

### Implementation Gates

- [ ] **GATE-MANIFEST**: Manifest YAML is valid (no syntax errors, all keys within limits)
- [ ] **GATE-PROMPT**: Agent prompt covers all 5 capabilities with clear instructions
- [ ] **GATE-RESOURCE**: Resource directory exists with prompt file

### Post-Implementation Gates

- [ ] **GATE-VALIDATE**: `forge manifest validate` passes
- [ ] **GATE-REQS**: `.reqs.md` sidecar file created
- [ ] **GATE-TYPECHECK**: No changes to TypeScript files (manifest + txt only)

## Requirements Creation Protocol

For each production file, the builder MUST create a `.reqs.md` sidecar:

1. **Before implementation**: Create `.reqs.md` listing all requirements from the spec
2. **Format**: Use `.ralph/templates/reqs-template.md` format
3. **Content**: Each requirement maps to an acceptance criterion and rulebook rule
4. **Traceability**: Every AC in the task maps to at least one section in the sidecar
5. **Location**: Sidecar lives adjacent to the production file (same directory)

## Implementation Protocol

### Step 1: Preparation

1. Read the Rovo Agent module reference: https://developer.atlassian.com/platform/forge/manifest-reference/modules/rovo-agent/
2. Read the Action module reference: https://developer.atlassian.com/platform/forge/manifest-reference/modules/rovo-action/
3. Read existing manifest.yml to understand current structure
4. Read RTASK-010 output to understand existing Rovo adapter interface

### Step 2: Manifest Modification

1. Add `rovo:agent` module block
2. Add 5 `action` module blocks
3. Add `agent-action-fn` to `function` block
4. Add `agent-prompts` to `resources` block
5. Verify all key length constraints

### Step 3: Prompt Creation

1. Create `src/backend/services/rovo/agent-prompts/` directory
2. Write `consistency-guard.txt` with comprehensive agent instructions
3. Include all 5 capability sections with detailed guidance
4. Include scoring methodology explanation

### Step 4: Validation

1. Run `forge manifest validate` — must pass
2. Verify prompt file is accessible as resource

## Auditing Protocol

### Critic Review Checklist

- [ ] All acceptance criteria verified as implemented
- [ ] Manifest keys comply with Forge constraints (max 23 chars)
- [ ] Agent prompt is comprehensive and covers all 5 capabilities
- [ ] No syntax errors in manifest YAML
- [ ] Resource path matches actual file location
- [ ] `.reqs.md` sidecar created for manifest changes

### Rejection Criteria

The critic MUST reject if:

- `forge manifest validate` fails
- Any key exceeds 23 characters
- Agent prompt is missing or incomplete (missing capabilities)
- Action inputs don't match handler expectations
- Missing `.reqs.md` sidecar

## Testing Protocol

### Validation Tests

- [ ] **Manifest syntax**: `forge manifest validate` passes
- [ ] **Key constraints**: All keys < 24 characters
- [ ] **Resource accessibility**: Prompt file exists at declared path
- [ ] **Prompt completeness**: All 5 capabilities documented in prompt

### No Unit Tests Required

This task only creates declarative manifest entries and a text prompt. Unit tests are covered in RTASK-034 for the action handler.

## Triple Deliverable

| Production                                                      | Sidecar                      | Test                                   |
| --------------------------------------------------------------- | ---------------------------- | -------------------------------------- |
| `manifest.yml` (modified)                                       | `manifest.reqs.md` (updated) | Validated by `forge manifest validate` |
| `src/backend/services/rovo/agent-prompts/consistency-guard.txt` | -                            | Validated by prompt completeness check |

## Risks

| Risk                                       | Mitigation                                                                             |
| ------------------------------------------ | -------------------------------------------------------------------------------------- |
| Rovo Agent module API changes              | Use only GA features documented in official Atlassian docs; avoid Preview/EAP features |
| Agent prompt too long/complex              | Keep prompt focused on 5 specific capabilities; use structured sections                |
| Manifest key conflicts                     | Verify all keys are unique across the entire manifest                                  |
| Prompt resource not found at runtime       | Verify resource path matches actual directory structure                                |
| Agent does not appear in Chat after deploy | Verify `rovo:agent` module syntax and that app has required permissions                |
