# REQUISITOS: useAuditLog hook

> **Sidecar File** | Vinculado a: `src/frontend/custom-ui/admin-dashboard/hooks/useAuditLog.ts`

---

## Descripcion

Custom hook that fetches audit log entries with server-side pagination for the Admin Dashboard. Calls `getAuditLog` resolver with limit/offset parameters and supports a `loadMore` callback for incremental data fetching.

---

## Acceptance Criteria

- [ ] **AC-01**: Hook returns data, loading, error, pagination, and loadMore
- [ ] **AC-02**: Hook fetches audit log on mount via `invoke('getAuditLog', ...)` with projectKey and limit [UI-ADS-008]
- [ ] **AC-03**: Hook passes `limit` parameter for server-side pagination [FORGE-OPS-005]
- [ ] **AC-04**: `loadMore` increments offset and appends results (not replaces)
- [ ] **AC-05**: `pagination` tracks offset, limit, total, and hasMore from `PaginationState`
- [ ] **AC-06**: Loading state is `true` during fetch, `false` on completion
- [ ] **AC-07**: Error state captures resolver error message; null when no error [SEC-PRIV-0792]
- [ ] **AC-08**: Hook checks `ResolverResponse.success` before extracting data [ARCH-SOLID-004]
- [ ] **AC-09**: Zero `any` usage [ARCH-SOLID-202]
- [ ] **AC-10**: Named export only [ARCH-SOLID-232]
- [ ] **AC-11**: Explicit return type annotation [ARCH-SOLID-205]
- [ ] **AC-12**: No business logic — state management + invoke only [ARCH-SOLID-004]
- [ ] **AC-13**: Data starts as empty array, accumulates on loadMore

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

#### `useAuditLog(projectKey: string, pageSize?: number): UseAuditLogReturn`

- **Proposito**: Fetch audit log entries with server-side pagination
- **Pre-condiciones**: `projectKey` must be a non-empty string; `pageSize` defaults to 20
- **Post-condiciones**: Returns current entries, pagination state, and a loadMore callback
- **Errores**: Sets error state with message from resolver failure

#### Return type: `UseAuditLogReturn`

- `data: AuditLogEntry[]` — Accumulated audit log entries
- `loading: boolean` — Whether a fetch is in progress
- `error: string | null` — Error message from resolver
- `pagination: PaginationState` — Current pagination state
- `loadMore: () => void` — Fetch next page and append results

---

## Dependencias (imports)

### Internas (proyecto)

- `../types` -> `PaginationState`
- `../../../backend/types/audit-log` -> `AuditLogEntry`

### Externas (npm)

- `@forge/bridge` -> `invoke`

---

## Estrategia de Test

### Unit Tests (`tests/unit/frontend/admin-dashboard/hooks/useAuditLog.spec.ts`)

| Test                                | AC cubierto | Regla cubierta |
| ----------------------------------- | ----------- | -------------- |
| should return initial loading state | AC-01,06    | UI-ADS-201     |
| should fetch audit log on mount     | AC-02,03    | UI-ADS-008     |
| should track pagination state       | AC-05       | ARCH-SOLID-004 |
| should loadMore and append results  | AC-04,13    | UI-ADS-204     |
| should handle fetch error           | AC-07,08    | SEC-PRIV-0792  |
| should handle invoke exception      | AC-07       | FORGE-OPS-005  |
| should start with empty array       | AC-13       | ARCH-SOLID-004 |

---

## Historial de Cambios

| Fecha      | Tarea Ralph | Cambio         |
| ---------- | ----------- | -------------- |
| 2026-04-25 | RTASK-019   | Creado inicial |
