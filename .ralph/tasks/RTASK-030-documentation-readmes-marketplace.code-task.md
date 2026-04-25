---
id: RTASK-030
title: 'Documentation - READMEs and Marketplace Plan'
status: pending
priority: 5
type: documentation
dependencies:
  [
    RTASK-004,
    RTASK-006,
    RTASK-007,
    RTASK-009,
    RTASK-010,
    RTASK-011,
    RTASK-012,
    RTASK-013,
    RTASK-014,
    RTASK-016,
    RTASK-017,
    RTASK-018,
    RTASK-019,
    RTASK-021,
    RTASK-025,
    RTASK-026,
    RTASK-027,
    RTASK-028,
    RTASK-029,
  ]
rulebook_refs: [GIT-CI-005]
spec: docs/tickets/TASK-030-documentation-readmes-marketplace.md
---

# RTASK-030: Documentation - READMEs and Marketplace Plan

## Objective

Create comprehensive technical and product documentation including a developer-focused README, a product-oriented README, and a detailed Atlassian Marketplace publication plan with tiered pricing and a publication checklist.

## Context

All core features, tests, and infrastructure are complete. The project now needs polished documentation that serves three audiences: developers integrating or contributing to the project, product evaluators considering adoption, and marketplace reviewers assessing publication readiness. This is the final documentation task that synthesizes all prior work.

## Technical Specification

### Deliverable 1: `README.md` (Technical)

**Required Sections:**

- **Overview** - What the project does and why it exists
- **Architecture Diagram** - Visual representation of the 6-layer architecture
- **Prerequisites** - Node 22, Forge CLI, Atlassian account, GitHub App setup
- **Quick Start** - Get running in under 10 minutes:
  1. `nvm use` - Set Node version
  2. `npm install` - Install dependencies
  3. `forge login` - Authenticate with Atlassian
  4. `forge register` - Register the app
  5. `forge deploy` - Deploy to environment
- **Project Structure** - Directory layout with descriptions
- **Configuration Guide** - All configurable options with defaults
- **GitHub App Setup** - Step-by-step guide to create and configure the GitHub App
- **Development** - `forge tunnel` for local development, running tests, linting
- **Deployment** - Promotion pipeline: dev -> staging -> prod
- **Troubleshooting** - Common issues and resolutions

### Deliverable 2: `README-product.md`

**Required Sections:**

- **Value Proposition** - Why teams need this tool
- **Key Features**:
  - Consistency Score algorithm
  - 3 Enforcement Gates (Jira transition, PR status check, merge protection)
  - Bidirectional Jira <-> GitHub enforcement
  - Per-project configuration
  - Full audit trail
- **User Flows** - Step-by-step usage scenarios with visual aids
- **ROI Calculator** - Framework for measuring time and quality improvements
- **Screenshots** - UI captures of panels, dashboards, and notifications
- **Pricing** - Free tier (5 projects) / Pro tier (unlimited projects)

### Deliverable 3: Marketplace Plan

**Required Sections:**

- **Atlassian Marketplace Requirements** - Compliance checklist for listing
- **Pricing Tiers**:
  - Free: Up to 5 projects, community support
  - Pro: Unlimited projects, priority support, advanced analytics
  - Enterprise: Custom deployment, SLA, dedicated support
- **Publication Checklist** - Step-by-step items to complete before submission

## Acceptance Criteria

- [ ] `README.md` has a functional Quick Start guide completable in under 10 minutes
- [ ] Architecture is documented with a clear 6-layer diagram
- [ ] GitHub App setup is documented with step-by-step instructions
- [ ] `README-product.md` includes a clear value proposition and feature list
- [ ] Marketplace plan includes tiered pricing (Free/Pro/Enterprise)
- [ ] Publication checklist is complete with all required items
- [ ] No spelling errors across all documentation
- [ ] No broken links across all documentation
- [ ] `.reqs.md` sidecar file is maintained

## Triple Deliverable

1. **Source**: `README.md`, `README-product.md`, marketplace plan document
2. **Tests**: Link validation, spell check, and Quick Start timing verification
3. **Documentation**: The documentation itself is the primary deliverable; all files in `docs/tickets/TASK-030-documentation-readmes-marketplace.md`; updated `.reqs.md` sidecar

## Risks

- Architecture diagram may become outdated as the codebase evolves
- Quick Start guide must be validated by a fresh user to confirm the 10-minute target
- Marketplace requirements may change with Atlassian platform updates
- Screenshots may need frequent updates as the UI evolves
- Pricing strategy needs market research to remain competitive
- Enterprise tier details require legal and business model alignment

## QA Gates

### Pre-Implementation Gates

- [ ] **GATE-READY**: All dependencies ([RTASK-004, RTASK-006, RTASK-007, RTASK-009, RTASK-010, RTASK-011, RTASK-012, RTASK-013, RTASK-014, RTASK-016, RTASK-017, RTASK-018, RTASK-019, RTASK-021, RTASK-025, RTASK-026, RTASK-027, RTASK-028, RTASK-029]) are completed
- [ ] **GATE-SPEC**: Rulebook section GIT-CI-005 has been read and understood
- [ ] **GATE-DESIGN**: Implementation approach documented before coding

### Implementation Gates (per document)

- [ ] **GATE-ACCURACY**: All technical details verified against actual implementation
- [ ] **GATE-COMPLETENESS**: All required sections present and populated
- [ ] **GATE-CLARITY**: Documentation is clear and understandable by target audience

### Post-Implementation Gates

- [ ] **GATE-SPELL**: No spelling errors across all documentation
- [ ] **GATE-LINKS**: No broken links across all documentation
- [ ] **GATE-QUICK-START**: Quick Start guide completable in under 10 minutes
- [ ] **GATE-REQS**: All `.reqs.md` sidecar files created and complete

## Requirements Creation Protocol

For each documentation file, the builder MUST create a `.reqs.md` sidecar:

1. **Before implementation**: Create `.reqs.md` listing all requirements from the spec
2. **Format**: Use `.ralph/templates/reqs-template.md` format
3. **Content**: Each requirement maps to an acceptance criterion and rulebook rule
4. **Traceability**: Every AC in the task maps to at least one section in the sidecar
5. **Location**: Sidecar lives adjacent to the documentation file (same directory)

## Implementation Protocol

### Step 1: Preparation

1. Read the full task spec (`docs/tickets/TASK-030-documentation-readmes-marketplace.md`)
2. Read referenced rulebook sections (`docs/rulebook/RULEBOOK.md` → GIT-CI-005)
3. Read all dependency task outputs to understand available interfaces
4. Create `.reqs.md` sidecar files with requirements traceability

### Step 2: Documentation Creation

1. Create `README.md` with all required sections
2. Create `README-product.md` with all required sections
3. Create Marketplace plan document
4. Verify all technical details against actual implementation

### Step 3: Integration

1. Verify links across all documentation files
2. Verify Quick Start guide is completable
3. Ensure architecture diagram matches actual code structure

### Step 4: Validation

1. Run spell check — must pass with zero errors
2. Run link validation — must pass with zero broken links
3. Verify Quick Start timing — must be completable in under 10 minutes
4. Verify all required sections are present and populated

## Auditing Protocol

### Critic Review Checklist

- [ ] All acceptance criteria verified as implemented
- [ ] No spelling errors across all documentation
- [ ] No broken links across all documentation
- [ ] Architecture diagram is accurate and clear
- [ ] Quick Start guide is completable in under 10 minutes
- [ ] Marketplace plan includes tiered pricing (Free/Pro/Enterprise)
- [ ] Triple deliverable complete: documentation + `.reqs.md` + validation
- [ ] No code outside specified file locations (project root)
- [ ] Dependencies only on completed RTASK modules
- [ ] Rulebook rule GIT-CI-005 is satisfied

### Rejection Criteria

The critic MUST reject if:

- A `.reqs.md` sidecar is missing
- Spelling errors are present
- Broken links are present
- Quick Start guide is not completable in under 10 minutes
- Required sections are missing from documentation
- Marketplace plan lacks tiered pricing

## Testing Protocol

### Documentation Validation

- **No unit tests for documentation** — validated by link check, spell check, and timing
- Location: Project root (`README.md`, `README-product.md`)
- Validation approach: Link validation, spell check, Quick Start timing verification

### Validation Categories Required

- [ ] **Spell check**: No spelling errors across all documentation
- [ ] **Link validation**: No broken links across all documentation
- [ ] **Quick Start timing**: Completable in under 10 minutes
- [ ] **Architecture diagram**: Accurate and matches actual code structure
- [ ] **Completeness**: All required sections present and populated
