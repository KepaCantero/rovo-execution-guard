# REQUISITOS: ConfigurationTab Component

> **Sidecar File** | Vinculado a: `src/frontend/custom-ui/admin-dashboard/components/ConfigurationTab.tsx`

---

## Descripcion

Presentational React component that renders an editable configuration form for `ProjectConfig` in the Configuration tab of the admin dashboard. Displays loading, error, and empty states, and renders form fields for enabled toggle, score threshold slider, gate toggles (definition, execution, delivery), GitHub repo/owner text inputs, and a save button. All data is received via props from the parent container which uses the `useProjectConfig` hook. Component-level UX validation provides immediate inline error messages; the hook's `validateConfig()` is the security boundary.

---

## Acceptance Criteria

- [ ] **AC-01**: Renders a loading indicator (spinner) when `loading` prop is true
- [ ] **AC-02**: Renders an error banner with SectionMessage when `error` prop is non-null and `loading` is false
- [ ] **AC-03**: Renders an empty state message when `config` is null, `loading` is false, and `error` is null
- [ ] **AC-04**: Renders all form fields with correct initial values from `config` prop when config is provided and not loading
- [ ] **AC-05**: Renders enabled toggle that updates local form state when toggled
- [ ] **AC-06**: Renders score threshold slider (0-100) using @atlaskit/range with current value display
- [ ] **AC-07**: Renders gate toggles for definition, execution, and delivery that update local form state
- [ ] **AC-08**: Renders GitHub repo and GitHub owner text fields using @atlaskit/textfield
- [ ] **AC-09**: Save button calls `onSave` prop with updated ProjectConfig when clicked
- [ ] **AC-10**: Save button is disabled while `saving` is true
- [ ] **AC-11**: Inline validation shows error when GitHub repo is provided but does not start with `https://`
- [ ] **AC-12**: Save button is disabled when form has validation errors
- [ ] **AC-13**: All interactive elements have aria-labels for accessibility
- [ ] **AC-14**: Named export only — no export default [ARCH-SOLID-232]
- [ ] **AC-15**: Explicit return type annotation on exported component function [ARCH-SOLID-205]
- [ ] **AC-16**: Zero `any` in component code [ARCH-SOLID-202]
- [ ] **AC-17**: No business logic — presentational only, all data via props [ARCH-SOLID-004]

---

## Reglas del Rulebook

| ID Regla       | Categoria    | Descripcion breve                                    |
| -------------- | ------------ | ---------------------------------------------------- |
| ARCH-SOLID-202 | Arquitectura | Zero `any` — use typed props and state               |
| ARCH-SOLID-203 | Arquitectura | Interface for props, type for unions only            |
| ARCH-SOLID-004 | Arquitectura | No business logic in UI — presentational only        |
| ARCH-SOLID-205 | Arquitectura | Explicit return types on exported functions          |
| ARCH-SOLID-232 | Arquitectura | Named exports only                                   |
| ARCH-SOLID-231 | Arquitectura | Naming conventions (PascalCase component)            |
| UI-ADS-001     | UI           | All colors via @atlaskit/tokens design tokens        |
| UI-ADS-002     | UI           | WCAG 2.1 AA contrast ratios                          |
| UI-ADS-004     | UI           | Aria-labels on interactive elements                  |
| UI-ADS-005     | UI           | Functional components with hooks only                |
| UI-ADS-009     | UI           | No eval, no external scripts                         |
| UI-ADS-202     | UI           | Presentational component — data via props            |
| UI-ADS-205     | UI           | useMemo for derived values, not useEffect            |
| SEC-PRIV-002   | Security     | No sensitive data rendered                           |
| SEC-PRIV-004   | Security     | Input validation on form fields — inline UX feedback |
| SEC-PRIV-0792  | Security     | Error displayed to user, no silent swallowing        |
| SEC-PRIV-0914  | Security     | Treat user input as hostile, React JSX auto-escapes  |
| FORGE-OPS-005  | Forge Ops    | Loading/saving states displayed                      |

---

## Contrato Publico (API del modulo)

### Componentes exportados

#### `ConfigurationTab(props: ConfigurationTabProps): React.ReactElement`

- **Proposito**: Renders the project configuration form with editable fields and save action
- **Pre-condiciones**: Parent must provide config data via useProjectConfig hook
- **Post-condiciones**: Renders loading, error, empty, or configuration form state
- **Props**:
  - `config: ProjectConfig | null` — current config data or null
  - `loading: boolean` — whether data is being fetched
  - `error: string | null` — error message if fetch failed
  - `saving: boolean` — whether a save operation is in progress
  - `onSave: (config: ProjectConfig) => void` — callback to trigger save

---

## Dependencias (imports)

### Internas (proyecto)

- `../types` -> `ConfigurationTabProps`
- `../../../../backend/types/project-config` -> `ProjectConfig`, `GateConfig`

### Externas (npm)

- `react` -> `useState`, `useMemo` [UI-ADS-205]
- `@atlaskit/tokens` -> `token()` for resolving design token names to CSS values
- `@atlaskit/section-message` -> Error/success banners
- `@atlaskit/button` -> Save button
- `@atlaskit/spinner` -> Loading indicator
- `@atlaskit/textfield` -> GitHub repo/owner text inputs
- `@atlaskit/toggle` -> Enabled/gate toggles
- `@atlaskit/range` -> Score threshold slider

---

## Estrategia de Test

### Unit Tests (`tests/unit/frontend/admin-dashboard/components/ConfigurationTab.spec.tsx`)

| Test                                                | AC cubierto | Regla cubierta |
| --------------------------------------------------- | ----------- | -------------- |
| renders spinner when loading                        | AC-01       | FORGE-OPS-005  |
| renders error banner when error and not loading     | AC-02       | SEC-PRIV-0792  |
| renders empty state when config null and no error   | AC-03       | -              |
| renders all form fields with initial config values  | AC-04       | ARCH-SOLID-004 |
| enabled toggle updates local form state             | AC-05       | UI-ADS-202     |
| score threshold slider renders with current value   | AC-06       | -              |
| gate toggles update local form state                | AC-07       | UI-ADS-202     |
| GitHub repo and owner text fields render            | AC-08       | -              |
| save button calls onSave with updated config        | AC-09       | ARCH-SOLID-004 |
| save button disabled while saving                   | AC-10       | FORGE-OPS-005  |
| inline validation error for invalid GitHub repo URL | AC-11       | SEC-PRIV-004   |
| save button disabled when validation errors exist   | AC-12       | SEC-PRIV-004   |
| all interactive elements have aria-labels           | AC-13       | UI-ADS-004     |
| named export only                                   | AC-14       | ARCH-SOLID-232 |
| explicit return type on exported function           | AC-15       | ARCH-SOLID-205 |
| zero any in component                               | AC-16       | ARCH-SOLID-202 |
| no business logic — presentational only             | AC-17       | ARCH-SOLID-004 |

---

## Historial de Cambios

| Fecha      | Tarea Ralph      | Cambio         |
| ---------- | ---------------- | -------------- |
| 2026-04-25 | RTASK-019 Step 3 | Creado inicial |
