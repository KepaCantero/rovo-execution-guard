# REQUISITOS: theme.ts (Admin Dashboard)

> **Sidecar File** | Vinculado a: `src/frontend/custom-ui/admin-dashboard/styles/theme.ts`

---

## Descripcion

Defines color constants and shared styling values for the Admin Dashboard. Uses `@atlaskit/tokens` design token references (string-based token names) instead of hardcoded hex values. Provides helper functions to derive color classes from score ranges and enforcement statuses.

---

## Acceptance Criteria

- [ ] **AC-01**: Score range colors: green (>80), yellow (60-80), red (<60) — via token name constants [UI-ADS-001]
- [ ] **AC-02**: Status colors: pass (green), fail (red), warning (yellow) — via token name constants [UI-ADS-001]
- [ ] **AC-03**: All color constants use `UPPER_SNAKE_CASE` naming [ARCH-SOLID-231]
- [ ] **AC-04**: Named exports only — no default export [ARCH-SOLID-232]
- [ ] **AC-05**: `getScoreColorToken` function returns the correct token name for a numeric score
- [ ] **AC-06**: `getStatusColorToken` function returns the correct token name for pass/fail/warning
- [ ] **AC-07**: `getSeverityColorToken` function returns the correct token name for critical/warning/info
- [ ] **AC-08**: Zero hardcoded hex/RGB color values [UI-ADS-001]
- [ ] **AC-09**: All exported functions declare explicit return types [ARCH-SOLID-205]

---

## Reglas del Rulebook

| ID Regla       | Categoria    | Descripcion breve                  |
| -------------- | ------------ | ---------------------------------- |
| UI-ADS-001     | UI-ADS       | Use @atlaskit/tokens design tokens |
| UI-ADS-002     | UI-ADS       | WCAG 2.1 AA contrast ratios        |
| ARCH-SOLID-231 | Arquitectura | UPPER_SNAKE_CASE for constants     |
| ARCH-SOLID-232 | Arquitectura | Named exports only                 |
| ARCH-SOLID-205 | Arquitectura | Explicit return types              |
| ARCH-SOLID-202 | Arquitectura | Zero any                           |

---

## Contrato Publico (API del modulo)

### Constantes exportadas

#### `SCORE_COLOR_TOKENS`

- Token names for score ranges: `GREEN`, `YELLOW`, `RED`

#### `STATUS_COLOR_TOKENS`

- Token names for pass/fail/warning statuses

#### `SEVERITY_COLOR_TOKENS`

- Token names for inconsistency severity levels

### Funciones exportadas

#### `getScoreColorToken(score: number): string`

- Returns the design token name for the given score range
- > 80 = green token, 60-80 = yellow token, < 60 = red token

#### `getStatusColorToken(status: 'pass' | 'fail' | 'warning'): string`

- Returns the design token name for the given status

#### `getSeverityColorToken(severity: 'critical' | 'warning' | 'info'): string`

- Returns the design token name for the given severity

---

## Dependencias (imports)

### Internas (proyecto)

- None

### Externas (npm)

- None (token names are string constants — actual token resolution happens at render time)

---

## Estrategia de Test

### Unit Tests (`tests/unit/frontend/admin-dashboard/styles/theme.spec.ts`)

| Test                                       | AC cubierto | Regla cubierta |
| ------------------------------------------ | ----------- | -------------- |
| should return green token for score > 80   | AC-05       | UI-ADS-001     |
| should return yellow token for score 60-80 | AC-05       | UI-ADS-001     |
| should return red token for score < 60     | AC-05       | UI-ADS-001     |
| should handle boundary scores (60, 80)     | AC-05       | UI-ADS-001     |
| should return correct status tokens        | AC-06       | UI-ADS-001     |
| should return correct severity tokens      | AC-07       | UI-ADS-001     |
| should not contain hex values              | AC-08       | UI-ADS-001     |
| should have UPPER_SNAKE_CASE constants     | AC-03       | ARCH-SOLID-231 |

---

## Historial de Cambios

| Fecha      | Tarea Ralph | Cambio         |
| ---------- | ----------- | -------------- |
| 2026-04-25 | RTASK-019   | Creado inicial |
