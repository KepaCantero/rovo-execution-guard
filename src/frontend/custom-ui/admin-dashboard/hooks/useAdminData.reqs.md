# REQUISITOS: useAdminData hook

> **Sidecar File** | Vinculado a: `src/frontend/custom-ui/admin-dashboard/hooks/useAdminData.ts`

---

## Descripcion

Custom hook that fetches overview metrics for the Admin Dashboard via the `getConsistencyScore` resolver. Provides loading/error state management and a refresh callback for re-fetching data. Acts as the container layer for the OverviewTab presentational component.

---

## Acceptance Criteria

- [ ] **AC-01**: Hook returns `AdminDataState<OverviewMetrics>` with data, loading, error fields
- [ ] **AC-02**: Hook fetches data on mount via `invoke('getConsistencyScore', ...)` [UI-ADS-008]
- [ ] **AC-03**: Hook exposes a `refresh` callback to re-trigger data fetch [UI-ADS-204]
- [ ] **AC-04**: Loading state is `true` during fetch, `false` on completion (success or error)
- [ ] **AC-05**: Error state captures resolver error message; null when no error [SEC-PRIV-0792]
- [ ] **AC-06**: Data state is `null` initially and on error; populated on successful fetch
- [ ] **AC-07**: Hook checks `ResolverResponse.success` before extracting data [ARCH-SOLID-004]
- [ ] **AC-08**: Zero `any` usage — uses generics and proper types [ARCH-SOLID-202]
- [ ] **AC-09**: Named export only — no default export [ARCH-SOLID-232]
- [ ] **AC-10**: Explicit return type annotation on the hook [ARCH-SOLID-205]
- [ ] **AC-11**: No business logic — state management + invoke only [ARCH-SOLID-004]

---

## Reglas del Rulebook

| ID Regla       | Categoria    | Descripcion breve                        |
| -------------- | ------------ | ---------------------------------------- |
| UI-ADS-008     | UI-ADS       | All data via invoke() from @forge/bridge |
| UI-ADS-201     | UI-ADS       | Hooks at top level only                  |
| UI-ADS-202     | UI-ADS       | Hooks are container layer                |
| UI-ADS-204     | UI-ADS       | Stabilize callbacks with useCallback     |
| ARCH-SOLID-004 | Arquitectura | No business logic in hooks               |
| ARCH-SOLID-202 | Arquitectura | Zero any                                 |
| ARCH-SOLID-205 | Arquitectura | Explicit return types                    |
| ARCH-SOLID-232 | Arquitectura | Named exports only                       |
| SEC-PRIV-0792  | Seguridad    | No silent error swallowing               |
| FORGE-OPS-005  | Forge Ops    | Handle resolver timeout gracefully       |

---

## Contrato Publico (API del modulo)

### Hook exportado

#### `useAdminData(projectKey: string): UseAdminDataReturn`

- **Proposito**: Fetch overview metrics for a project and expose data/loading/error state + refresh
- **Pre-condiciones**: `projectKey` must be a non-empty string
- **Post-condiciones**: Returns current fetch state and a stable refresh callback
- **Errores**: Sets error state with message from resolver failure

#### Return type: `UseAdminDataReturn`

- `data: OverviewMetrics | null` — Current metrics data
- `loading: boolean` — Whether a fetch is in progress
- `error: string | null` — Error message from resolver
- `refresh: () => void` — Re-trigger the data fetch

---

## Dependencias (imports)

### Internas (proyecto)

- `../types` -> `AdminDataState, OverviewMetrics`

### Externas (npm)

- `@forge/bridge` -> `invoke`

---

## Estrategia de Test

### Unit Tests (`tests/unit/frontend/admin-dashboard/hooks/useAdminData.spec.ts`)

| Test                                          | AC cubierto | Regla cubierta |
| --------------------------------------------- | ----------- | -------------- |
| should return initial loading state           | AC-01,04    | UI-ADS-201     |
| should fetch data on mount and populate state | AC-02,06    | UI-ADS-008     |
| should expose working refresh callback        | AC-03       | UI-ADS-204     |
| should handle resolver error response         | AC-05,07    | SEC-PRIV-0792  |
| should handle invoke exception                | AC-05       | FORGE-OPS-005  |
| should set data null on error                 | AC-06       | ARCH-SOLID-004 |
| should use named export only                  | AC-09       | ARCH-SOLID-232 |

---

## Historial de Cambios

| Fecha      | Tarea Ralph | Cambio         |
| ---------- | ----------- | -------------- |
| 2026-04-25 | RTASK-019   | Creado inicial |
