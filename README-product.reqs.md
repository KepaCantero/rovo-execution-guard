# REQUISITOS: README-product.md

> **Sidecar File** | Vinculado a: `README-product.md`

---

## Descripcion

Product-oriented documentation for Rovo Execution Guard targeting evaluators, product managers, and decision-makers considering adoption. Communicates the value proposition, key features, user flows, ROI framework, and pricing tiers. Unlike the technical README.md, this document focuses on business outcomes, user experience, and investment rationale rather than implementation details.

---

## Acceptance Criteria

- [ ] **AC-01**: README-product.md includes a clear value proposition explaining why teams need this tool
- [ ] **AC-02**: Key Features section documents all 6 core features (Consistency Score, 3 Enforcement Gates, Bidirectional Jira<->GitHub, Per-project configuration, Full audit trail)
- [ ] **AC-03**: User Flows section provides step-by-step usage scenarios with visual aids (diagrams or flow descriptions)
- [ ] **AC-04**: ROI Calculator section provides a framework for measuring time and quality improvements
- [ ] **AC-05**: Screenshots section includes placeholders for UI captures of panels, dashboards, and notifications
- [ ] **AC-06**: Pricing section documents Free tier (up to 5 projects) and Pro tier (unlimited projects)
- [ ] **AC-07**: No spelling errors in the document
- [ ] **AC-08**: No broken links in the document

---

## Required Sections

### Value Proposition

- Problem statement: why teams waste time on inconsistent tickets and PRs
- How REG solves it (automated quality gates at transition boundaries)
- Key differentiators vs. manual review processes
- Target audience: engineering managers, tech leads, DevOps teams

### Key Features

1. **Consistency Score Algorithm** - Multi-axis scoring (clarity, consistency, risk, documentation, technicalDebt) with configurable thresholds
2. **3 Enforcement Gates** - Jira transition blocking, PR status checks, merge protection
3. **Bidirectional Jira <-> GitHub Enforcement** - Changes in Jira reflect in GitHub and vice versa
4. **Per-project Configuration** - Custom quality gate rules per Jira project (ProjectConfig, GateConfig)
5. **Full Audit Trail** - Every evaluation logged with scores, decisions, and reasoning
6. **Rovo AI-powered Context** - Atlassian Rovo enriches ticket analysis with cross-tool intelligence

### User Flows

- Scenario 1: Developer moves Jira ticket to "In Review"
- Scenario 2: Developer opens a GitHub pull request
- Scenario 3: Engineering manager reviews audit trail in admin dashboard
- Each flow with step-by-step description and visual representation

### ROI Calculator

- Framework for measuring: reduced rework, faster sprint completion, fewer production incidents
- Baseline metrics to track before/after REG adoption
- Sample calculation template

### Screenshots

- Issue panel in Jira (evaluation results)
- Admin dashboard (project configuration, audit logs)
- GitHub PR status check (pass/fail with details)
- Placeholder format with descriptions for each screenshot

### Pricing

- **Free tier**: Up to 5 projects, community support, basic scoring
- **Pro tier**: Unlimited projects, priority support, advanced analytics, custom gates
- Note: Enterprise tier details are in the Marketplace plan (docs/marketplace-plan.md)

---

## Reglas del Rulebook

Las siguientes reglas del RULEBOOK.md deben respetarse en este modulo:

| ID Regla      | Categoria   | Descripcion breve                                         |
| ------------- | ----------- | --------------------------------------------------------- |
| [GIT-CI-0931] | Git & CI/CD | Documentation must enable quick evaluation and onboarding |

---

## Contrato Publico (API del modulo)

This is a documentation file. Its contract is defined by the acceptance criteria above.

### Target Audiences

1. **Product Evaluator**: Considering adoption, needs to understand value and features
2. **Engineering Manager**: Needs ROI justification for budget approval
3. **Tech Lead**: Wants to understand how it fits into team workflows
4. **Marketplace Reviewer**: Assessing publication readiness and completeness

---

## Dependencias (imports)

### Internas (proyecto)

- All completed RTASK modules (the documentation reflects their implementation)

### Externas (npm)

- None (documentation file)

---

## Estrategia de Test

### Validation (non-unit)

| Test                                         | AC cubierto | Regla cubierta |
| -------------------------------------------- | ----------- | -------------- |
| Value proposition is clear and compelling    | AC-01       | -              |
| All 6 features documented                    | AC-02       | -              |
| User flows are step-by-step with visual aids | AC-03       | -              |
| ROI framework provides measurable criteria   | AC-04       | -              |
| Screenshots section has placeholders         | AC-05       | -              |
| Pricing tiers documented (Free/Pro)          | AC-06       | -              |
| Spell check (zero errors)                    | AC-07       | -              |
| Link validation (zero broken)                | AC-08       | -              |

---

## Historial de Cambios

| Fecha      | Tarea Ralph | Cambio         |
| ---------- | ----------- | -------------- |
| 2026-04-26 | RTASK-030   | Creado inicial |
