# REQUISITOS: types.ts (Admin Dashboard)

> **Sidecar File** | Vinculado a: `src/frontend/custom-ui/admin-dashboard/types.ts`

---

## Descripcion

Defines all TypeScript interfaces and type aliases for the Admin Dashboard presentation layer. These types cover component props, hook return values, filter/pagination state, and resolver response wrappers. This module has zero runtime behavior — it is purely a type definition module consumed by components and hooks.

---

## Acceptance Criteria

- [ ] **AC-01**: All component prop interfaces use `readonly` properties [ARCH-SOLID-203]
- [ ] **AC-02**: Zero `any` usage — only `unknown`, generics, or discriminated unions [ARCH-SOLID-202]
- [ ] **AC-03**: `interface` used for data structures; `type` used only for union aliases [ARCH-SOLID-203]
- [ ] **AC-04**: Named exports only — no default export [ARCH-SOLID-232]
- [ ] **AC-05**: OverviewMetrics interface defines: totalEvaluated, totalBlocked, prsBlocked, avgScore, inconsistencyBreakdown
- [ ] **AC-06**: AuditLogFilter interface defines: actionTypes, dateRange, ticketKey, userId
- [ ] **AC-07**: PaginationState interface defines: offset, limit, total, hasMore
- [ ] **AC-08**: AdminDataState generic interface for loading/error/data state pattern
- [ ] **AC-09**: TabIdentifier type is a union of 'overview' | 'configuration' | 'auditLog'
- [ ] **AC-10**: SortDirection type is a union of 'asc' | 'desc'
- [ ] **AC-11**: AuditLogSort interface defines: field, direction

---

## Reglas del Rulebook

| ID Regla       | Categoria    | Descripcion breve                                        |
| -------------- | ------------ | -------------------------------------------------------- |
| ARCH-SOLID-202 | Arquitectura | Zero `any` — use unknown, generics, discriminated unions |
| ARCH-SOLID-203 | Arquitectura | Interface for data structures, type for unions           |
| ARCH-SOLID-232 | Arquitectura | Named exports only                                       |
| ARCH-SOLID-205 | Arquitectura | Explicit return types on all public functions            |
| ARCH-SOLID-231 | Arquitectura | camelCase for variables, PascalCase for interfaces       |
| UI-ADS-202     | UI-ADS       | Separate presentational and container components         |

---

## Contrato Publico (API del modulo)

### Tipos exportados

#### `TabIdentifier`

- Union type: `'overview' | 'configuration' | 'auditLog'`
- Identifies active tab in AdminDashboardApp

#### `SortDirection`

- Union type: `'asc' | 'desc'`
- Sort direction for audit log columns

#### `interface OverviewMetrics`

- `totalEvaluated: number` — Total tickets evaluated
- `totalBlocked: number` — Total tickets blocked
- `prsBlocked: number` — Total PRs blocked
- `avgScore: number` — Average consistency score (0-100)
- `inconsistencyBreakdown: Record<InconsistencyType, number>` — Count by type

#### `interface AuditLogFilter`

- `actionTypes: readonly AuditAction[]` — Filter by action types
- `dateRange: DateRange | null` — Optional date range filter
- `ticketKey: string` — Filter by ticket key (empty = no filter)
- `userId: string` — Filter by user ID (empty = no filter)

#### `interface DateRange`

- `start: string` — ISO 8601 start date
- `end: string` — ISO 8601 end date

#### `interface PaginationState`

- `offset: number` — Current offset in results
- `limit: number` — Number of results per page
- `total: number` — Total results available
- `hasMore: boolean` — Whether more results exist

#### `interface AuditLogSort`

- `field: 'timestamp' | 'action' | 'ticketKey' | 'userId'` — Sortable field
- `direction: SortDirection` — Sort direction

#### `interface AdminDataState<T>`

- `data: T | null` — Current data (null while loading or on error)
- `loading: boolean` — Whether data is being fetched
- `error: string | null` — Error message (null when no error)

#### `interface AdminDashboardProps`

- `projectKey: string` — Current project context

#### `interface OverviewTabProps`

- `metrics: OverviewMetrics | null` — Metrics data
- `loading: boolean` — Loading state
- `error: string | null` — Error message
- `onRevalidate: (ticketKey: string) => void` — Trigger revalidation

#### `interface ConfigurationTabProps`

- `projectKey: string` — Project to configure
- `loading: boolean` — Loading state
- `error: string | null` — Error message

#### `interface AuditLogTabProps`

- `projectKey: string` — Project to query
- `loading: boolean` — Loading state
- `error: string | null` — Error message

---

## Dependencias (imports)

### Internas (proyecto)

- `src/backend/types` -> `AuditAction, InconsistencyType`

### Externas (npm)

- None (pure type definitions)

---

## Estrategia de Test

### Unit Tests (`tests/unit/frontend/admin-dashboard/types.spec.ts`)

| Test                                               | AC cubierto  | Regla cubierta |
| -------------------------------------------------- | ------------ | -------------- |
| should export all expected types without errors    | AC-01..AC-11 | ARCH-SOLID-232 |
| should enforce readonly properties at compile time | AC-01        | ARCH-SOLID-203 |
| should have correct union type values              | AC-09, AC-10 | ARCH-SOLID-203 |

---

## Historial de Cambios

| Fecha      | Tarea Ralph | Cambio         |
| ---------- | ----------- | -------------- |
| 2026-04-25 | RTASK-019   | Creado inicial |
