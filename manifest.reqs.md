# REQUISITOS: manifest.yml

> **Sidecar File** | Vinculado a: `manifest.yml`

---

## Descripcion
Forge manifest for the Rovo Execution Guard app. Defines the app identity, modules (Jira issue panel, admin page, workflow trigger, GitHub webhook), permissions (least-privilege scopes), and external fetch allowlist. This is the single source of truth for Forge platform configuration.

---

## Acceptance Criteria

- [x] **AC-06**: manifest.yml has jira:issuePanel, jira:adminPage, trigger, webtrigger modules
- [x] **AC-07**: Scopes follow least privilege (only read:jira-work, write:jira-work, read:confluence-content, write:confluence-content, storage:app)
- [x] **AC-08**: External fetch configured for api.github.com
- [x] **AC-09**: manifest.reqs.md sidecar created with acceptance criteria

---

## Reglas del Rulebook

Las siguientes reglas del RULEBOOK.md deben respetarse en este modulo:

| ID Regla | Categoria | Descripcion breve |
|----------|-----------|-------------------|
| [FORGE-OPS-001] | Forge Ops | manifest.yml must contain exactly app, modules, permissions top-level props |
| [FORGE-OPS-002] | Forge Ops | manifest.yml must not exceed 200KB |
| [FORGE-OPS-004] | Forge Ops | external.fetch must list only domains the app actually needs, no wildcards |
| [ARCH-SOLID-001] | Arquitectura | runtime.name must specify explicit LTS Node.js version (nodejs22.x) |

---

## Contrato Publico (API del modulo)

This is a configuration file, not a code module. Its contract is defined by the Forge platform schema.

### Modules Defined
- `jira:issuePanel` (key: `reg-issue-panel`) - Displays consistency score on Jira issues
- `jira:adminPage` (key: `reg-admin-page`) - Admin dashboard for configuration
- `trigger` (key: `on-jira-workflow-transition`) - Fires on Jira issue updates
- `webtrigger` (key: `github-webhook`) - Receives GitHub webhook events

### Functions Defined
- `issue-panel-fn` - Handler for the issue panel UI
- `admin-page-fn` - Handler for the admin page UI
- `workflow-transition-fn` - Handler for workflow transition events
- `github-webhook-fn` - Handler for GitHub webhook payloads

### Scopes (Least Privilege)
- `read:jira-work`, `write:jira-work` - Read and block workflow transitions
- `read:confluence-content`, `write:confluence-content` - Cross-reference documentation
- `storage:app` - Persist app configuration

### External Fetch
- `api.github.com` (read only) - Fetch PR status, checks, and commit data

---

## Dependencias (imports)

### Internas (proyecto)
- Handler files referenced in function definitions

### Externas (npm)
- None (this is a configuration file)

---

## Estrategia de Test

### Validation
- `forge lint` validates the manifest schema
- Manual review against FORGE-OPS-001, FORGE-OPS-002, FORGE-OPS-004

---

## Historial de Cambios

| Fecha | Tarea Ralph | Cambio |
|-------|-------------|--------|
| 2026-04-05 | RTASK-001 | Creado inicial |
