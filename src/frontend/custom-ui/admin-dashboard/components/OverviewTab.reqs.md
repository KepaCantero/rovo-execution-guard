# REQUISITOS: OverviewTab Component

> **Sidecar File** | Vinculado a: `src/frontend/custom-ui/admin-dashboard/components/OverviewTab.tsx`

---

## Descripcion

Presentational React component that renders the system metrics dashboard in the Overview tab of the admin dashboard. Displays ticket evaluation counts, block rates, PR blocking stats, average quality score with color coding, inconsistency type breakdown with an inline SVG bar chart, and a revalidate action. All data is received via props from the parent container component which uses the `useAdminData` hook.

---

## Acceptance Criteria

- [ ] **AC-01**: Renders a loading indicator (spinner) when `loading` prop is true
- [ ] **AC-02**: Renders an error banner with retry action when `error` prop is non-null and `loading` is false
- [ ] **AC-03**: Renders all metric cards (totalEvaluated, totalBlocked with percentage, prsBlocked, avgScore with color) when metrics are provided and not loading
- [ ] **AC-04**: Renders an empty state message when metrics is null, loading is false, and error is null
- [ ] **AC-05**: Computes blockedPercentage via useMemo as `(totalBlocked / totalEvaluated) * 100` when totalEvaluated > 0, else 0
- [ ] **AC-06**: Applies score color via getScoreColorToken() from theme.ts, resolved through useMemo
- [ ] **AC-07**: Renders inline SVG bar chart for inconsistencyBreakdown with a bar per inconsistency type
- [ ] **AC-08**: Retry button in error state has an aria-label for accessibility
- [ ] **AC-09**: Uses @atlaskit components: SectionMessage for errors, Spinner for loading, Button for retry
- [ ] **AC-10**: Uses @atlaskit/tokens for all color references via theme helpers
- [ ] **AC-11**: Named export only — no export default [ARCH-SOLID-232]
- [ ] **AC-12**: Explicit return type annotation on exported component function [ARCH-SOLID-205]
- [ ] **AC-13**: Zero `any` in component code [ARCH-SOLID-202]
- [ ] **AC-14**: No business logic — purely presentational, all data via props [ARCH-SOLID-004]

---

## Reglas del Rulebook

| ID Regla       | Categoria    | Descripcion breve                              |
| -------------- | ------------ | ---------------------------------------------- |
| ARCH-SOLID-202 | Arquitectura | Zero `any` — use typed props and state         |
| ARCH-SOLID-203 | Arquitectura | Interface for props, type for unions only      |
| ARCH-SOLID-004 | Arquitectura | No business logic in UI — presentational only  |
| ARCH-SOLID-205 | Arquitectura | Explicit return types on exported functions    |
| ARCH-SOLID-232 | Arquitectura | Named exports only                             |
| ARCH-SOLID-231 | Arquitectura | Naming conventions (PascalCase component)      |
| UI-ADS-001     | UI           | All colors via @atlaskit/tokens design tokens  |
| UI-ADS-002     | UI           | WCAG 2.1 AA contrast ratios                    |
| UI-ADS-004     | UI           | Aria-labels on interactive elements            |
| UI-ADS-005     | UI           | Functional components with hooks only          |
| UI-ADS-009     | UI           | No eval, no external scripts — inline SVG only |
| UI-ADS-202     | UI           | Presentational component — data via props      |
| UI-ADS-205     | UI           | useMemo for derived values, not useEffect      |
| SEC-PRIV-002   | Security     | No sensitive data rendered                     |
| SEC-PRIV-0792  | Security     | Error displayed to user, no silent swallowing  |
| FORGE-OPS-009  | Forge Ops    | No external charting library — inline SVG      |

---

## Contrato Publico (API del modulo)

### Componentes exportados

#### `OverviewTab(props: OverviewTabProps): React.ReactElement`

- **Proposito**: Renders the metrics overview dashboard with inline SVG chart
- **Pre-condiciones**: Parent must provide metrics data via useAdminData hook
- **Post-condiciones**: Renders loading, error, empty, or metrics display state
- **Props**:
  - `metrics: OverviewMetrics | null` — aggregation metrics or null
  - `loading: boolean` — whether data is being fetched
  - `error: string | null` — error message if fetch failed
  - `onRevalidate: (ticketKey: string) => void` — callback for revalidation action

---

## Dependencias (imports)

### Internas (proyecto)

- `../types` -> `OverviewTabProps`, `OverviewMetrics`
- `../styles/theme` -> `getScoreColorToken`

### Externas (npm)

- `react` -> `useMemo` [UI-ADS-205]
- `@atlaskit/section-message` -> Error banner
- `@atlaskit/button` -> Retry button
- `@atlaskit/spinner` -> Loading indicator
- `@atlaskit/tokens` -> `token()` for resolving design token names to CSS values

---

## Estrategia de Test

### Unit Tests (`tests/unit/frontend/admin-dashboard/components/OverviewTab.spec.tsx`)

| Test                                                       | AC cubierto | Regla cubierta |
| ---------------------------------------------------------- | ----------- | -------------- |
| renders spinner when loading                               | AC-01       | UI-ADS-005     |
| renders error banner with retry when error and not loading | AC-02       | SEC-PRIV-0792  |
| renders all metric cards with correct values               | AC-03       | ARCH-SOLID-004 |
| renders empty state when metrics null and no error         | AC-04       | -              |
| computes blocked percentage correctly                      | AC-05       | UI-ADS-205     |
| applies score color token based on avgScore                | AC-06       | UI-ADS-001     |
| renders SVG bar chart with breakdown data                  | AC-07       | FORGE-OPS-009  |
| retry button has aria-label                                | AC-08       | UI-ADS-004     |
| uses @atlaskit SectionMessage and Spinner                  | AC-09       | UI-ADS-005     |
| blockedPercentage is 0 when totalEvaluated is 0            | AC-05       | UI-ADS-205     |
| SVG chart renders correct number of bars                   | AC-07       | FORGE-OPS-009  |

---

## Historial de Cambios

| Fecha      | Tarea Ralph      | Cambio         |
| ---------- | ---------------- | -------------- |
| 2026-04-25 | RTASK-019 Step 2 | Creado inicial |
