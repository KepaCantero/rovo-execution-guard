# Agentic Process & Ralph Protocol (PER)

## Agent Roles

### Claude (Architect & Planner)
- Deep reasoning and architecture decisions
- Product decisions and risk identification
- Quality gate definition and standards
- API contract design and rulebook rule selection per module

### GLM-5 (Execution Engine)
- Large-scale code generation
- Full module implementation
- Refactoring and technical documentation
- Test writing (Unit, Integration, E2E)
- CI/CD workflow configuration
- **No autonomy:** Cannot create code without a prior Ralph Task

### Ralph (Orchestrator, Auditor & PO)
- Simplifies decisions, eliminates unnecessary complexity
- Prioritizes fast delivery with real value
- Ensures continuous iteration, avoids over-engineering
- Audits strict compliance with Quality Gates
- Acts as Product Owner: defines tasks, validates ROI, signs off DoD

## Iteration Cycle

The system iterates following this loop:

1. **Decide** - Claude defines architecture and quality gates
2. **Build** - GLM-5 generates complete code and tests
3. **Validate** - Pass Quality Gates (Ralph audits)
4. **Simplify** - Ralph eliminates over-engineering
5. **Repeat**

## Ralph Protocol: Task Execution (PER)

All development (Feature or Bugfix) follows the Ralph Lifecycle. Ralph is responsible for creating the task file that serves as the "execution contract."

### 1. Ralph Task Structure (TASK-XXX.md)

Ralph generates this file before GLM-5 starts working:

| Section | Owner | Content |
|---|---|---|
| ID & Title | Ralph | Reference to Jira ticket and technical description |
| Value Objective | Ralph | What real problem it solves and why it's a priority (ROI) |
| Technical Spec | Claude | Architectural approach, patterns to use, edge cases |
| Definition of Done (DoD) | Ralph | Checklist of acceptance criteria |
| Audit Protocol | Ralph | Specific points Ralph will review for approval |

### 2. Sidecar Requirement Files (.reqs.md)

Every production file (`.ts`, `.tsx`) has a twin requirements file `[filename].reqs.md` containing:

```markdown
# Requirements: [Module Name]

## Description
Why this file exists and its impact on Rovo Execution Guard.

## Acceptance Criteria (AC)
- [ ] AC-01: [Specific functional requirement]
- [ ] AC-02: [Specific functional requirement]

## Rulebook Rules (IDs)
- [FORGE-OPS-042]: Timeout handling in async invocations
- [SEC-PRIV-009]: Encryption of sensitive data in Forge storage

## Test Strategy
- Unit: [What to test]
- E2E: [What scenario to validate]
```

### 3. Workflow Phases

#### Phase 1: Definition (Ralph + Claude)
1. Ralph identifies the need (Feature/Bug)
2. Claude adds technical constraints and risks to the task file
3. Ralph closes the task and "assigns" it to GLM-5

#### Phase 2: Execution (GLM-5)
1. GLM-5 reads the TASK-XXX.md and the Rulebook
2. Generates code (`.ts`), requirements (`.reqs.md`), and tests (`.spec.ts`)
3. Self-evaluates against the task's DoD

#### Phase 3: Audit & Closure (Ralph)
1. Ralph analyzes the generated code
2. Verifies no "over-engineering" (unnecessary extra code)
3. Compares code against TASK and .reqs.md
4. If audit fails: Ralph returns the task to GLM-5 with the exact rejection reason
5. If audit passes: Ralph signs the task and merge proceeds

### 4. Sidecar Applicability

Sidecar files apply strictly to:
- Domain layer (scoring, validation, inconsistency detection)
- Resolvers (Forge bridge)
- Triggers (event handlers)
- API connectors/adapters

Sidecar files do NOT apply to:
- Trivial config files (`.prettierrc`, `.gitignore`)
- Purely aesthetic UI components (use general UI-ADS rules instead)
- Test mocks

### 5. Quality Gate: No Sidecar, No Merge

A GitHub Actions check verifies that every new file in `/src` has its corresponding `.reqs.md`. No merge without requirements documentation.
