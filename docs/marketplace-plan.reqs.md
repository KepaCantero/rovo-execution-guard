# REQUISITOS: marketplace-plan.md

> **Sidecar File** | Vinculado a: `docs/marketplace-plan.md`

---

## Descripcion

Atlassian Marketplace publication plan for Rovo Execution Guard. Covers marketplace listing requirements compliance, tiered pricing strategy (Free/Pro/Enterprise), and a step-by-step publication checklist. Targets marketplace reviewers, business stakeholders, and the engineering team responsible for the listing.

---

## Acceptance Criteria

- [ ] **AC-01**: Atlassian Marketplace requirements compliance checklist is present and complete
- [ ] **AC-02**: Pricing section documents three tiers: Free (up to 5 projects, community support), Pro (unlimited projects, priority support, advanced analytics), Enterprise (custom deployment, SLA, dedicated support)
- [ ] **AC-03**: Publication checklist is complete with all required items before submission
- [ ] **AC-04**: No spelling errors in the document
- [ ] **AC-05**: No broken links in the document
- [ ] **AC-06**: Pricing details are consistent with README-product.md pricing table

---

## Required Sections

### Atlassian Marketplace Requirements

- Forge app listing requirements from Atlassian documentation
- Manifest compliance (scopes, modules, permissions)
- Data privacy and security disclosure
- App review criteria

### Pricing Tiers

- **Free**: Up to 5 Jira projects, community support, basic scoring, all three gates, 30-day audit history
- **Pro**: Unlimited projects, priority email support, advanced analytics + trends, custom weights, unlimited history + export, custom enforcement rules
- **Enterprise**: Custom deployment, SLA guarantees, dedicated support, SSO/SAML, custom integrations, on-premise option

### Publication Checklist

- Pre-submission items (manifest, privacy policy, EULA, screenshots)
- Testing verification (unit, integration, e2e pass rates)
- Security review (scopes, data handling, secrets)
- Marketing assets (logo, screenshots, description, video)
- Post-submission items (monitoring, support channel, update cadence)

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

1. **Marketplace Reviewer**: Assessing publication readiness and completeness
2. **Business Stakeholder**: Evaluating pricing strategy and go-to-market plan
3. **Engineering Team**: Following the publication checklist to submit the listing

---

## Dependencias (imports)

### Internas (proyecto)

- README-product.md (pricing table must be consistent)
- manifest.yml (scopes, modules, permissions referenced in requirements)
- All completed RTASK modules (the plan reflects their implementation)

### Externas (npm)

- None (documentation file)

---

## Estrategia de Test

### Validation (non-unit)

| Test                                                   | AC cubierto | Regla cubierta |
| ------------------------------------------------------ | ----------- | -------------- |
| Marketplace requirements checklist is complete         | AC-01       | -              |
| Three pricing tiers documented with feature comparison | AC-02       | -              |
| Publication checklist covers pre/post submission       | AC-03       | -              |
| Spell check (zero errors)                              | AC-04       | -              |
| Link validation (zero broken)                          | AC-05       | -              |
| Pricing consistency with README-product.md             | AC-06       | -              |

---

## Historial de Cambios

| Fecha      | Tarea Ralph | Cambio         |
| ---------- | ----------- | -------------- |
| 2026-04-26 | RTASK-030   | Creado inicial |
