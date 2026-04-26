# REQUISITOS: useProjectConfig hook

> **Sidecar File** | Vinculado a: `src/frontend/custom-ui/admin-dashboard/hooks/useProjectConfig.ts`

---

## Descripcion

Custom hook that manages project configuration CRUD for the Admin Dashboard. Fetches current config on mount via `getProjectConfig` resolver and exposes a `saveConfig` function to persist updates via `updateProjectConfig` resolver. Provides two loading states: initial load and save operation.

---

## Acceptance Criteria

- [ ] **AC-01**: Hook returns data, loading, error, saving, and saveConfig
- [ ] **AC-02**: Hook fetches project config on mount via `invoke('getProjectConfig', ...)` [UI-ADS-008]
- [ ] **AC-03**: Hook exposes `saveConfig(config: ProjectConfig)` that calls `invoke('updateProjectConfig', ...)` [UI-ADS-008]
- [ ] **AC-04**: `saving` state is independent from `loading` state (two loading states)
- [ ] **AC-05**: Loading state is `true` during initial fetch, `false` on completion
- [ ] **AC-06**: Saving state is `true` during save, `false` on completion
- [ ] **AC-07**: Error state captures resolver error message; null when no error [SEC-PRIV-0792]
- [ ] **AC-08**: Hook checks `ResolverResponse.success` before extracting data [ARCH-SOLID-004]
- [ ] **AC-09**: Zero `any` usage [ARCH-SOLID-202]
- [ ] **AC-10**: Named export only [ARCH-SOLID-232]
- [ ] **AC-11**: Explicit return type annotation [ARCH-SOLID-205]
- [ ] **AC-12**: Input validation on saveConfig — validates projectKey, scoreThreshold (0-100), and gates before invoking resolver [SEC-PRIV-004]
- [ ] **AC-13**: saveConfig receives fully-formed ProjectConfig [ARCH-SOLID-004]

---

## Reglas del Rulebook

| ID Regla       | Categoria    | Descripcion breve                                  |
| -------------- | ------------ | -------------------------------------------------- |
| UI-ADS-008     | UI-ADS       | All data via invoke() from @forge/bridge           |
| UI-ADS-201     | UI-ADS       | Hooks at top level only                            |
| UI-ADS-202     | UI-ADS       | Hooks are container layer                          |
| ARCH-SOLID-004 | Arquitectura | No business logic in hooks                         |
| ARCH-SOLID-202 | Arquitectura | Zero any                                           |
| ARCH-SOLID-205 | Arquitectura | Explicit return types                              |
| ARCH-SOLID-232 | Arquitectura | Named exports only                                 |
| SEC-PRIV-004   | Seguridad    | Input validation on saveConfig — security boundary |
| SEC-PRIV-0792  | Seguridad    | No silent error swallowing                         |
| FORGE-OPS-005  | Forge Ops    | Handle resolver timeout gracefully                 |

---

## Contrato Publico (API del modulo)

### Hook exportado

#### `useProjectConfig(projectKey: string): UseProjectConfigReturn`

- **Proposito**: Fetch and persist project configuration
- **Pre-condiciones**: `projectKey` must be a non-empty string
- **Post-condiciones**: Returns current config state and a saveConfig callback
- **Errores**: Sets error state with message from resolver failure

#### Return type: `UseProjectConfigReturn`

- `data: ProjectConfig | null` — Current config
- `loading: boolean` — Whether initial fetch is in progress
- `error: string | null` — Error message from resolver
- `saving: boolean` — Whether save operation is in progress
- `saveConfig: (config: ProjectConfig) => Promise<void>` — Persist config changes

---

## Dependencias (imports)

### Internas (proyecto)

- `../../../backend/types/project-config` -> `ProjectConfig`

### Externas (npm)

- `@forge/bridge` -> `invoke`

---

## Estrategia de Test

### Unit Tests (`tests/unit/frontend/admin-dashboard/hooks/useProjectConfig.spec.ts`)

| Test                                    | AC cubierto | Regla cubierta |
| --------------------------------------- | ----------- | -------------- |
| should return initial loading state     | AC-01,05    | UI-ADS-201     |
| should fetch config on mount            | AC-02       | UI-ADS-008     |
| should save config via saveConfig       | AC-03,13    | UI-ADS-008     |
| should track saving state independently | AC-04,06    | ARCH-SOLID-004 |
| should handle fetch error               | AC-07,08    | SEC-PRIV-0792  |
| should handle save error                | AC-07       | SEC-PRIV-0792  |
| should validate config before saving    | AC-12       | SEC-PRIV-004   |
| should reject invalid scoreThreshold    | AC-12       | SEC-PRIV-004   |
| should reject empty projectKey          | AC-12       | SEC-PRIV-004   |

---

## Historial de Cambios

| Fecha      | Tarea Ralph | Cambio         |
| ---------- | ----------- | -------------- |
| 2026-04-25 | RTASK-019   | Creado inicial |
