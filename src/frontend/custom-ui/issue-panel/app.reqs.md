# REQUISITOS: Issue Panel — Rovo Agent Frontend Integration

> **Sidecar File** | Vinculado a: `src/frontend/custom-ui/issue-panel/app.tsx`

---

## Descripcion

Issue Panel for Jira that displays per-axis consistency scores and integrates with the Rovo Consistency Guard agent. Enhances the existing panel with severity-differentiated prompts, per-axis agent buttons using design tokens, a Full Analysis button, error boundary wrapping, and Sentry error reporting.

---

## Acceptance Criteria

- [x] **AC-01**: `buildRovoPrompt` generates different prompts for critical (< 40%), improvable (< threshold), and optimal (>= threshold) ranges
- [x] **AC-02**: Per-axis "Ask Agent" buttons open Consistency Guard agent via `rovo.open({ type: 'agent', agentKey: 'consistency-guard' })`
- [x] **AC-03**: Per-axis buttons are visually differentiated by severity using design tokens (SCORE_COLOR_TOKENS)
- [x] **AC-04**: "Full Analysis" button opens agent with comprehensive evaluation prompt
- [x] **AC-05**: All Rovo-related UI is guarded by `rovo.isEnabled()` check
- [x] **AC-06**: Buttons show disabled state with tooltip when Rovo is not available
- [x] **AC-07**: Existing non-Rovo functionality (score display, axis details) remains unchanged
- [x] **AC-08**: No `any` types — uses `PromptSeverity` discriminated union
- [x] **AC-09**: Test coverage exceeds 85% for helper functions and component logic
- [x] **AC-10**: `.reqs.md` sidecar file created

---

## Reglas del Rulebook

| ID Regla         | Categoria        | Descripcion breve                                        |
| ---------------- | ---------------- | -------------------------------------------------------- |
| [UI-ADS-001]     | Atlassian Design | All colors via design tokens, no hardcoded hex           |
| [UI-ADS-004]     | Atlassian Design | Accessible labels, focus states, keyboard navigation     |
| [UI-ADS-008]     | Atlassian Design | Custom UI communicates via @forge/bridge only            |
| [UI-ADS-0955]    | Atlassian Design | Functional components with hooks only                    |
| [UI-ADS-0841]    | Atlassian Design | Three visual states: green/red/yellow                    |
| [UI-ADS-0862]    | Atlassian Design | Essential info only; expand for details                  |
| [UI-ADS-0892]    | Atlassian Design | Functionality before aesthetics                          |
| [FORGE-OPS-001]  | Forge Ops        | manifest.yml contains exactly app, modules, permissions  |
| [FORGE-OPS-009]  | Forge Ops        | Custom UI CSP compliance — no external scripts           |
| [ARCH-SOLID-004] | Architecture     | Business logic in Forge Functions, not UI                |
| [ARCH-SOLID-202] | Architecture     | Zero `any` — use unknown, generics, discriminated unions |
| [ARCH-SOLID-205] | Architecture     | Explicit return types on all exported functions          |
| [ARCH-SOLID-232] | Architecture     | Named exports only, no default export                    |
| [ROVO-INTEG-005] | Rovo Integration | Timeout and graceful fallback for Rovo API calls         |
| [ROVO-INTEG-060] | Rovo Integration | Handle uncertainty explicitly                            |
| [SEC-PRIV-002]   | Security         | No sensitive data in logs                                |
| [SEC-PRIV-008]   | Security         | Data minimization                                        |
| [TEST-QA-036-01] | Testing          | All uncaught exceptions to Sentry                        |
| [TEST-QA-036-02] | Testing          | Breadcrumbs at each significant step                     |
| [TEST-QA-056]    | Testing          | TDD cycle: RED, GREEN, REFACTOR                          |
| [TEST-QA-057]    | Testing          | Edge case coverage                                       |

---

## Contrato Publico (API del modulo)

### Tipos exportados

#### `type PromptSeverity = 'critical' | 'improvable' | 'optimal'`

- **Proposito**: Discriminated union for prompt severity levels
- **Valores**: critical (< 40%), improvable (< threshold), optimal (>= threshold)

### Constantes exportadas

#### `SEVERITY_LABELS: Record<PromptSeverity, string>`

- **Proposito**: Human-readable severity labels for buttons
- **Valores**: `{ critical: 'Fix now', improvable: 'Improve', optimal: 'Optimize' }`

#### `AGENT_KEY: string`

- **Proposito**: Agent key constant matching manifest entry
- **Valor**: `'consistency-guard'`

### Funciones (internal, exported for testing)

#### `buildRovoPrompt(axisKey, detail, axes, ticketContext): { prompt: string; severity: PromptSeverity }`

- **Proposito**: Generates severity-differentiated prompt for Rovo agent
- **Pre-condiciones**: `detail.score` is a number, `ticketContext` is complete
- **Post-condiciones**: Returns prompt string + severity classification
- **Errores**: None — handles edge cases gracefully

### Componentes

#### `RovoButton({ axisKey, detail, axes, ticketContext, rovoAvailable })`

- **Proposito**: Per-axis button opening Consistency Guard agent
- **Comportamiento**: Calls `rovo.open({ type: 'agent', agentKey, prompt })`, shows severity styling
- **Estado**: `idle | opening | error`

#### `AxisRow({ axisKey, detail, axes, ticketContext, rovoEnabled })`

- **Proposito**: Expandable axis row with score bar and agent button
- **Cambios**: Uses `getScoreColorToken` instead of `scoreColor` hex

#### `IssuePanel()`

- **Proposito**: Main panel component — fetches and displays consistency scores
- **Cambios**: Wrapped in ErrorBoundaryWrapper, adds Full Analysis button

---

## Dependencias (imports)

### Internas (proyecto)

- `src/frontend/custom-ui/admin-dashboard/styles/theme.ts` -> `getScoreColorToken`, `SCORE_COLOR_TOKENS`
- `src/frontend/components/ErrorBoundary.tsx` -> `ErrorBoundaryWrapper`
- `src/frontend/utils/sentry.ts` -> `captureException`, `addErrorBreadcrumb`

### Externas (npm)

- `react` -> React, useState, useEffect, useCallback
- `react-dom/client` -> createRoot
- `@forge/bridge` -> invoke, view, rovo

---

## Estrategia de Test

### Unit Tests (`tests/unit/frontend/custom-ui/issue-panel/app.spec.tsx`)

| Test                                                           | AC cubierto | Regla cubierta |
| -------------------------------------------------------------- | ----------- | -------------- |
| buildRovoPrompt returns critical for score < 40                | AC-01       | ARCH-SOLID-202 |
| buildRovoPrompt returns improvable for score 40..threshold-1   | AC-01       | ARCH-SOLID-202 |
| buildRovoPrompt returns optimal for score >= threshold         | AC-01       | ARCH-SOLID-202 |
| buildRovoPrompt includes issue key in prompt text              | AC-01       | ROVO-INTEG-060 |
| buildRovoPrompt includes suggestions in prompt                 | AC-01       | ROVO-INTEG-060 |
| buildRovoPrompt handles score at boundary 39                   | AC-01       | TEST-QA-057    |
| buildRovoPrompt handles score at boundary 40                   | AC-01       | TEST-QA-057    |
| RovoButton renders with correct severity styling               | AC-03       | UI-ADS-001     |
| RovoButton calls rovo.open with agent type on click            | AC-02       | ROVO-INTEG-005 |
| RovoButton is disabled when rovoAvailable is false             | AC-06       | ROVO-INTEG-060 |
| RovoButton calls captureException on rovo.open error           | AC-07       | TEST-QA-036-01 |
| RovoButton adds breadcrumb before rovo.open                    | AC-07       | TEST-QA-036-02 |
| Full Analysis button calls rovo.open with comprehensive prompt | AC-04       | ROVO-INTEG-005 |
| Full Analysis button includes issue key and overall score      | AC-04       | ROVO-INTEG-060 |
| Full Analysis button disabled when rovoAvailable is false      | AC-06       | ROVO-INTEG-060 |
| AxisRow uses getScoreColorToken instead of hex                 | AC-03       | UI-ADS-001     |
| IssuePanel renders score display unchanged                     | AC-07       | UI-ADS-0841    |
| IssuePanel renders axis details unchanged                      | AC-07       | UI-ADS-0862    |
| Zero any types in source and tests                             | AC-08       | ARCH-SOLID-202 |

### Mock Strategy

- Mock `@forge/bridge`: `rovo.open`, `rovo.isEnabled`, `view.getContext`, `invoke`
- Mock `../../utils/sentry`: `captureException`, `addErrorBreadcrumb`, `isSentryInitialized`
- Mock `../admin-dashboard/styles/theme` if design token resolution is needed
- Use React Testing Library for component tests
- Reset mocks between tests (`beforeEach`)

---

## Historial de Cambios

| Fecha      | Tarea Ralph | Cambio         |
| ---------- | ----------- | -------------- |
| 2026-05-01 | RTASK-035   | Creado inicial |
