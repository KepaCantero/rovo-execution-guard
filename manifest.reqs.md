# REQUISITOS: manifest.yml

> **Sidecar File** | Vinculado a: `manifest.yml`

---

## Descripcion

Forge manifest for the Rovo Execution Guard app. Defines the app identity, modules (Jira issue panel, admin page, workflow trigger, GitHub webhook, Rovo agent with 5 actions), permissions (least-privilege scopes), and external fetch allowlist. This is the single source of truth for Forge platform configuration.

---

## Acceptance Criteria

- [x] **AC-06**: manifest.yml has jira:issuePanel, jira:adminPage, trigger, webtrigger modules
- [x] **AC-07**: Scopes follow least privilege (only read:jira-work, write:jira-work, read:confluence-content, write:confluence-content, storage:app)
- [x] **AC-08**: External fetch configured for api.github.com
- [x] **AC-09**: manifest.reqs.md sidecar created with acceptance criteria

### RTASK-033: Rovo Agent Definition

- [ ] **AC-033-01**: `rovo:agent` module defined with key `consistency-guard`, name, description, 5 conversation starters, 5 actions, and follow-up prompt
- [ ] **AC-033-02**: Five `action` modules defined with correct keys, `GET` verb, `agent-action-fn` function, and typed inputs
- [ ] **AC-033-03**: `function` entry `agent-action-fn` points to `agent-action-handler.handler`
- [ ] **AC-033-04**: `resource` entry `agent-prompts` points to `src/backend/services/rovo/agent-prompts`
- [ ] **AC-033-05**: Agent prompt file `consistency-guard.txt` exists with role, 5 capabilities, scoring guide, output format, and rules
- [ ] **AC-033-06**: All keys comply with Forge manifest constraints (max 23 chars)
- [ ] **AC-033-07**: `forge manifest validate` passes

---

## Reglas del Rulebook

Las siguientes reglas del RULEBOOK.md deben respetarse en este modulo:

| ID Regla         | Categoria    | Descripcion breve                                                           |
| ---------------- | ------------ | --------------------------------------------------------------------------- |
| [FORGE-OPS-001]  | Forge Ops    | manifest.yml must contain exactly app, modules, permissions top-level props |
| [FORGE-OPS-002]  | Forge Ops    | manifest.yml must not exceed 200KB                                          |
| [FORGE-OPS-004]  | Forge Ops    | external.fetch must list only domains the app actually needs, no wildcards  |
| [ARCH-SOLID-001] | Arquitectura | runtime.name must specify explicit LTS Node.js version (nodejs22.x)         |
| [FORGE-OPS-003]  | Forge Ops    | Max 100 modules in manifest                                                 |
| [ROVO-INTEG-001] | Rovo Integ   | Use official Forge rovo:agent and action modules for GA integration path    |
| [ROVO-INTEG-002] | Rovo Integ   | Agent keys must match ^[a-zA-Z0-9_-]+$ and max 23 characters                |
| [ROVO-INTEG-003] | Rovo Integ   | Action actionVerb must be one of: GET, CREATE, UPDATE, DELETE, TRIGGER      |

---

## Contrato Publico (API del modulo)

This is a configuration file, not a code module. Its contract is defined by the Forge platform schema.

### Modules Defined

- `jira:issuePanel` (key: `reg-issue-panel`) - Displays consistency score on Jira issues
- `jira:adminPage` (key: `reg-admin-page`) - Admin dashboard for configuration
- `trigger` (key: `on-jira-workflow-transition`) - Fires on Jira issue updates
- `webtrigger` (key: `github-webhook`) - Receives GitHub webhook events
- `rovo:agent` (key: `consistency-guard`) - Rovo Chat agent for consistency validation
- `action` (key: `evaluate-issue`) - Full consistency evaluation action
- `action` (key: `check-pr-consistency`) - PR-to-issue alignment check action
- `action` (key: `validate-spec-alignment`) - Jira-Confluence spec alignment action
- `action` (key: `explain-score`) - Score explanation action
- `action` (key: `get-improvement-tips`) - Improvement suggestions action

### Functions Defined

- `resolver-fn` - Handler for Custom UI resolvers
- `transition-fn` - Handler for workflow transition events
- `webhook-fn` - Handler for GitHub webhook payloads
- `agent-action-fn` - Handler for all Rovo agent actions

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

| Fecha      | Tarea Ralph | Cambio                                                                                      |
| ---------- | ----------- | ------------------------------------------------------------------------------------------- |
| 2026-04-05 | RTASK-001   | Creado inicial                                                                              |
| 2026-04-30 | RTASK-033   | Added rovo:agent module, 5 action modules, agent-action-fn function, agent-prompts resource |
