---
id: RTASK-022
title: 'Observability Layer - Sentry Integration'
status: pending
priority: 4
type: infrastructure
dependencies: [RTASK-021]
rulebook_refs: [FORGE-OPS-006, SEC-PRIV-006]
spec: docs/tickets/TASK-022-observability-sentry.md
---

# RTASK-022: Observability Layer - Sentry Integration

## Objective

Integrate Sentry for real-time error tracking across both the Forge backend and the React frontend. Exceptions must be enriched with execution context (executionId, ticketKey, module) to enable rapid diagnosis. Expected errors (e.g., TicketNotFoundError) must not pollute Sentry alerts. The integration must degrade gracefully when DSN is not configured.

## Context

The application runs on Atlassian Forge (backend) and renders in Jira iframes (frontend). Both environments need independent Sentry SDKs (Node and Browser). The structured logger (RTASK-021) provides executionId and module context that Sentry must carry as scope tags. Alert rules must catch critical failures (CircuitOpenError, TimeoutError, high error rates) without noise from expected domain errors.

## Technical Specification

### Backend: Sentry Node SDK

- Initialize with `@sentry/node`
- DSN stored as Forge environment variable (`SENTRY_DSN`)
- Scope tags: `executionId`, `ticketKey`, `module`, `environment`
- Integrate with structured logger: errors logged via RTASK-021 are also sent to Sentry

### Frontend: Sentry Browser SDK

- Initialize with `@sentry/browser`
- React Error Boundaries wrap key UI components
- Scope tags: `issueKey`, `projectKey`
- Capture unhandled promise rejections

### Functions

```typescript
// Backend
function initSentry(environment: string): void;
// Only initializes if SENTRY_DSN is configured (graceful degradation)
// If DSN missing, all Sentry calls become no-ops

function captureException(error: Error, context: Record<string, unknown>): void;
// Enriches exception with executionId, ticketKey, module from context
// Does NOT send expected errors: TicketNotFoundError, InsufficientDataError

function addErrorBreadcrumb(breadcrumb: {
  category: string;
  message: string;
  level: 'info' | 'warning' | 'error';
  data?: Record<string, unknown>;
}): void;
// Adds breadcrumb to current Sentry scope for flow tracing

// Frontend
function initSentryBrowser(dsn: string, environment: string): void;
function ErrorBoundaryWrapper: React.ComponentType<{children: React.ReactNode}>;
```

### Alert Rules

- **Error rate > 5%** in any 5-minute window — trigger warning
- **Any `CircuitOpenError`** — trigger critical alert (Rovo API is down)
- **Any `TimeoutError`** in Rovo adapter — trigger warning (degraded performance)
- Alerts configured in Sentry project settings (not in code)

### Expected Errors (Not Sent to Sentry)

- `TicketNotFoundError` — valid domain scenario
- `InsufficientDataError` — valid when ticket lacks required fields
- Any error with `expected: true` property

### Graceful Degradation

- If `SENTRY_DSN` is not set, `initSentry` returns silently
- `captureException` and `addErrorBreadcrumb` become no-ops
- Application functions normally without Sentry

### Sidecar: `sentry.reqs.md`

- Use `.ralph/templates/reqs-template.md` format
- Document initialization, error filtering, alert rules, acceptance criteria

## Acceptance Criteria

- [ ] AC-01: Sentry only initializes if `SENTRY_DSN` environment variable is configured
- [ ] AC-02: `captureException` enriches exceptions with `executionId` and `ticketKey` tags
- [ ] AC-03: React Error Boundaries send caught errors to Sentry with component info
- [ ] AC-04: Breadcrumbs trace the evaluation flow (adapter calls, gate evaluations, enforcement)
- [ ] AC-05: Expected errors (`TicketNotFoundError`, `InsufficientDataError`) are NOT sent to Sentry
- [ ] AC-06: Application functions normally when Sentry DSN is missing (graceful degradation)
- [ ] AC-07: Backend uses `@sentry/node`, frontend uses `@sentry/browser`
- [ ] AC-08: Unit tests cover initialization, error capture, breadcrumb, and filtering logic
- [ ] AC-09: `sentry.reqs.md` sidecar created with acceptance criteria

## Triple Deliverable

| Production (.ts)                            | Sidecar (.reqs.md)                              | Test (.spec.ts)                                |
| ------------------------------------------- | ----------------------------------------------- | ---------------------------------------------- |
| `src/backend/utils/sentry.ts`               | `src/backend/utils/sentry.reqs.md`              | `tests/unit/utils/sentry.spec.ts`              |
| `src/frontend/utils/sentry.ts`              | `src/frontend/utils/sentry.reqs.md`             | `tests/unit/utils/sentry-browser.spec.ts`      |
| `src/frontend/components/ErrorBoundary.tsx` | `src/frontend/components/ErrorBoundary.reqs.md` | `tests/unit/components/ErrorBoundary.spec.tsx` |

## Risks

| Risk                                    | Mitigation                                           |
| --------------------------------------- | ---------------------------------------------------- |
| Sentry DSN leaked in logs               | Logger sanitization from RTASK-021 covers DSN values |
| Forge environment variables unavailable | Graceful degradation — no-op when DSN missing        |
| Too many expected errors in Sentry      | Explicit allowlist of expected error types to filter |
| Bundle size increase from Sentry SDK    | Use tree-shaking; only import needed functions       |

## QA Gates

### Pre-Implementation Gates

- [ ] **GATE-READY**: All dependencies ([RTASK-021]) are completed
- [ ] **GATE-SPEC**: Rulebook sections FORGE-OPS-006, SEC-PRIV-006 have been read and understood
- [ ] **GATE-DESIGN**: Implementation approach documented before coding

### Implementation Gates (per file/function)

- [ ] **GATE-RED**: Write failing test FIRST for each function/component
- [ ] **GATE-GREEN**: Write minimum code to make test pass
- [ ] **GATE-REFACTOR**: Clean up code while keeping tests green

### Post-Implementation Gates

- [ ] **GATE-TYPECHECK**: `npm run typecheck` passes with zero errors
- [ ] **GATE-LINT**: `npm run lint` passes with zero warnings
- [ ] **GATE-FORMAT**: `npm run format:check` passes
- [ ] **GATE-TEST**: `npm run test:unit` passes with coverage > 85%
- [ ] **GATE-REQS**: All `.reqs.md` sidecar files created and complete
- [ ] **GATE-ZERO-ANY**: `grep -r "any" src/` returns zero results (no `any` types)

## Requirements Creation Protocol

For each production file, the builder MUST create a `.reqs.md` sidecar:

1. **Before implementation**: Create `.reqs.md` listing all requirements from the spec
2. **Format**: Use `.ralph/templates/reqs-template.md` format
3. **Content**: Each requirement maps to an acceptance criterion and rulebook rule
4. **Traceability**: Every AC in the task maps to at least one section in the sidecar
5. **Location**: Sidecar lives adjacent to the production file (same directory)

## Implementation Protocol

### Step 1: Preparation

1. Read the full task spec (`docs/tickets/TASK-022-observability-sentry.md`)
2. Read referenced rulebook sections (`docs/rulebook/RULEBOOK.md` → FORGE-OPS-006, SEC-PRIV-006)
3. Read all dependency task outputs to understand available interfaces
4. Create `.reqs.md` sidecar files with requirements traceability

### Step 2: TDD Cycle (per function/component)

1. **RED**: Write a failing test that defines expected behavior
2. **GREEN**: Write the minimum code to make the test pass
3. **REFACTOR**: Clean up while keeping all tests green
4. Repeat for next function/component

### Step 3: Integration

1. Wire components together
2. Add integration-level tests if applicable
3. Verify all exports are accessible from barrel files

### Step 4: Validation

1. Run `npm run typecheck` — must pass
2. Run `npm run lint` — must pass with zero warnings
3. Run `npm run format:check` — must pass
4. Run `npm run test:unit` — must pass with > 85% coverage
5. Verify zero `any` usage

## Auditing Protocol

### Critic Review Checklist

- [ ] All acceptance criteria verified as implemented
- [ ] No `any` types anywhere in new code
- [ ] All interfaces use `readonly` properties
- [ ] Error handling follows hierarchy (REGError → domain errors)
- [ ] Structured logging with `executionId` on all operations
- [ ] No hardcoded secrets, tokens, or credentials
- [ ] Input validation on all external-facing functions
- [ ] Triple deliverable complete: `.ts` + `.reqs.md` + `.spec.ts`
- [ ] No code outside specified file locations
- [ ] Dependencies only on completed RTASK modules
- [ ] Rulebook rules FORGE-OPS-006, SEC-PRIV-006 are satisfied

### Rejection Criteria

The critic MUST reject if:

- Any `any` type is present
- Coverage is below the required threshold (85%)
- A `.reqs.md` sidecar is missing
- A `.spec.ts` test file is missing
- Structured logging is absent
- Error handling is missing or generic (`catch (e) { }`)
- External dependencies were added without approval

## Testing Protocol

### Unit Tests - Backend (`tests/unit/utils/`)

- Location: Mirror production path under `tests/unit/`
- Naming: `[filename].spec.ts`
- Coverage target: 85%
- Pattern: Arrange-Act-Assert (AAA)
- Must test: Happy path, error paths, edge cases, boundary values

### Unit Tests - Frontend (`tests/unit/utils/` and `tests/unit/components/`)

- Location: Mirror production path under `tests/unit/`
- Naming: `[filename].spec.ts` / `[filename].spec.tsx`
- Coverage target: 85%
- Must test: React Error Boundary rendering, error capture calls, graceful degradation

### Test Categories Required

- [ ] **Happy path**: Primary function works with valid inputs
- [ ] **Error handling**: Function handles errors gracefully
- [ ] **Edge cases**: Empty inputs, null/undefined, boundary values
- [ ] **Integration points**: Mocked adapter/service calls work correctly
- [ ] **React Error Boundaries**: Error boundaries catch errors and send to Sentry with component info
- [ ] **Graceful degradation**: Sentry calls become no-ops when DSN is missing

### Mock Strategy

- Mock all external APIs (Jira, Confluence, Rovo, GitHub)
- Mock `@forge/api` and `@forge/resolver` calls
- Mock `@sentry/node` and `@sentry/browser` SDK calls
- Use `jest.fn()` for function mocks, not hand-rolled stubs
- Reset mocks between tests (`beforeEach`)
