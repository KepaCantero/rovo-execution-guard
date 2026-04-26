# REQUISITOS: README.md

> **Sidecar File** | Vinculado a: `README.md`

---

## Descripcion

Technical developer documentation for Rovo Execution Guard. Serves as the primary entry point for developers integrating, contributing to, or deploying the app. Must enable a complete development environment setup in under 10 minutes per the Quick Start guide, and accurately document the 6-layer architecture, configuration options, and deployment pipeline.

---

## Acceptance Criteria

- [ ] **AC-01**: README.md has a functional Quick Start guide completable in under 10 minutes
- [ ] **AC-02**: Architecture is documented with a clear 6-layer diagram (ASCII or Mermaid)
- [ ] **AC-03**: GitHub App setup is documented with step-by-step instructions
- [ ] **AC-04**: All required sections present: Overview, Architecture, Prerequisites, Quick Start, Project Structure, Configuration, GitHub App Setup, Development, Deployment, Troubleshooting
- [ ] **AC-05**: No spelling errors in the document
- [ ] **AC-06**: No broken links in the document
- [ ] **AC-07**: Technical details verified against actual implementation (package manager, Node version, Forge CLI commands, scopes, architecture layers)

---

## Required Sections

### Overview

- What Rovo Execution Guard does
- Why it exists (problem it solves)
- High-level value proposition

### Architecture Diagram

- 6-layer architecture: Types -> Services (Adapters + Scoring + Evaluation + Enforcement) -> Resolvers -> Handlers -> Custom UI
- Must note that domain types are pure TypeScript per [ARCH-SOLID-058]
- Must include the 3 Forge handlers: resolver-handler, transition-handler, webhook-handler

### Prerequisites

- Node.js 22.x (via nvm or direct install)
- Forge CLI (`pnpm add -g @forge/cli`)
- Atlassian account with Forge enabled
- GitHub account with App creation permissions

### Quick Start

- Must be completable in < 10 minutes
- Steps: nvm use -> pnpm install -> forge login -> forge register -> forge deploy
- Must use **pnpm** as package manager (not npm)

### Project Structure

- Directory tree with descriptions matching actual `src/` layout
- Must reflect: types/, services/ (jira/, github/, rovo/, confluence/, scoring/, evaluation/, enforcement/), resolvers/, frontend/ (custom-ui/, components/, utils/)

### Configuration Guide

- ProjectConfig options
- Scoring thresholds
- Quality gate rules
- Per-project settings

### GitHub App Setup

- Step-by-step GitHub App creation
- Webhook URL configuration
- Required permissions
- Secret management

### Development

- `forge tunnel` for local development
- `pnpm test:unit` for running tests
- `pnpm lint` for linting
- `pnpm typecheck` for type checking

### Deployment

- Environments: development -> staging -> production
- `forge deploy -e <env>` command
- CI/CD pipeline via GitHub Actions (ci.yml, deploy.yml, rollback.yml)

### Troubleshooting

- Common issues and resolutions
- Forge tunnel connection issues
- Permission errors
- Deployment failures

---

## Reglas del Rulebook

Las siguientes reglas del RULEBOOK.md deben respetarse en este modulo:

| ID Regla         | Categoria    | Descripcion breve                                               |
| ---------------- | ------------ | --------------------------------------------------------------- |
| [GIT-CI-0931]    | Git & CI/CD  | Setup en < 30 min con documentacion paso a paso en README       |
| [ARCH-SOLID-058] | Arquitectura | Domain types must be pure TypeScript, no framework dependencies |

---

## Contrato Publico (API del modulo)

This is a documentation file. Its contract is defined by the acceptance criteria above.

### Target Audiences

1. **Developer (integrator)**: Setting up the project, understanding architecture, deploying
2. **Developer (contributor)**: Understanding the codebase structure, running tests, local development
3. **DevOps**: CI/CD pipeline, deployment environments, rollback procedures

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
| Quick Start timing verification (< 10 min)   | AC-01       | GIT-CI-0931    |
| Architecture diagram accuracy (matches code) | AC-02       | ARCH-SOLID-058 |
| GitHub App setup completeness                | AC-03       | -              |
| All required sections present                | AC-04       | -              |
| Spell check (zero errors)                    | AC-05       | -              |
| Link validation (zero broken)                | AC-06       | -              |
| Technical accuracy verification              | AC-07       | -              |

---

## Historial de Cambios

| Fecha      | Tarea Ralph | Cambio         |
| ---------- | ----------- | -------------- |
| 2026-04-26 | RTASK-030   | Creado inicial |
