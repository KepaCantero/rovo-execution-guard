# REQUISITOS: Project Config

> **Sidecar File** | Vinculado a: `src/backend/types/project-config.ts`

---

## Descripcion

Defines per-project configuration for Rovo Execution Guard. Each Jira project can have its own quality gate thresholds, enabled/disabled gates, and GitHub repository linkage. This allows teams to adopt the enforcement progressively and customize it to their workflow.

---

## Acceptance Criteria

- [ ] **AC-01**: `GateConfig` has three boolean properties: definition, execution, delivery
- [ ] **AC-02**: `ProjectConfig` includes `projectKey`, `enabled`, `scoreThreshold`, `gates`, and optional GitHub fields
- [ ] **AC-03**: All interface properties are `readonly`
- [ ] **AC-04**: Zero external dependencies

---

## Reglas del Rulebook

| ID Regla          | Categoria    | Descripcion breve                            |
| ----------------- | ------------ | -------------------------------------------- |
| [ARCH-SOLID-058]  | Arquitectura | Domain layer has zero framework dependencies |
| [ARCH-SOLID-202]  | TypeScript   | Zero any usage                               |
| [ARCH-SOLID-203]  | TypeScript   | Interfaces for public data structures        |
| [ROVO-INTEG-0845] | Rovo         | Defaults work without personalization        |

---

## Contrato Publico (API del modulo)

### Tipos exportados

#### `GateConfig`

- **Proposito**: Which quality gates are enabled for a project
- **Propiedades**: `definition: boolean`, `execution: boolean`, `delivery: boolean`

#### `ProjectConfig`

- **Proposito**: Full configuration for a single Jira project
- **Propiedades**: `projectKey`, `enabled`, `scoreThreshold`, `gates: GateConfig`, optional `githubRepo`, optional `githubOwner`

---

## Dependencias (imports)

### Internas

- None (leaf module)
