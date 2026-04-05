---
id: RTASK-019
title: "Presentation Layer - Admin Dashboard"
status: pending
priority: 4
type: presentation
dependencies: [RTASK-015, RTASK-024]
rulebook_refs: [UI-ADS-001, SEC-PRIV-002]
spec: docs/tickets/TASK-019-presentation-admin-dashboard.md
---

# RTASK-019: Presentation Layer - Admin Dashboard

## Objective
Implement the Admin Dashboard as a Forge Custom UI module that provides project administrators with an overview of system metrics, configuration management, and a comprehensive audit log for the Rovo Execution Guard system.

## Context
Administrators need a centralized view to monitor the health and effectiveness of the quality gate system, configure project-level settings, and review the full audit trail. This dashboard is critical for operational oversight and system tuning. It depends on the Forge UI infrastructure (RTASK-015) and the project configuration model (RTASK-024).

## Technical Specification

### Location
`src/frontend/custom-ui/admin-dashboard/`

### Forge Module Configuration
- Register as **`jira:adminPage`** in `manifest.yml`
- Accessible only to users with Jira admin permissions
- Renders as a full Custom UI page within Jira admin navigation

### Component Architecture

#### `AdminDashboardApp` (Entry Component)
- Root component with tabbed navigation
- **Tabs**: Overview, Configuration, Audit Log
- Admin-only access enforced at the Forge permission level
- Manages global state across tabs

#### `OverviewTab`
Displays key system metrics via Forge resolvers:
- **Tickets evaluated**: Total count of tickets processed by quality gates
- **Tickets blocked**: Count and percentage of tickets blocked by enforcement
- **PRs blocked**: Count of GitHub PRs blocked due to quality gate failures
- **Inconsistencies by type**: Breakdown of inconsistency categories (e.g., missing docs, stale story points)
- **Average quality score**: Mean score across all evaluated tickets
- **ROI estimation**: Estimated time saved by preventing rework (based on blocked tickets and average rework cost)
- **Trends chart**: Line/bar chart showing metric trends over time (daily/weekly/monthly)

#### `ConfigurationTab`
Editable form for managing `ProjectConfig`:
- **Threshold slider**: Quality score threshold (0-100) for gate pass/fail
- **Gate toggles**: Enable/disable individual quality gates (Gate 1, Gate 2, Gate 3)
- **GitHub repository**: Input field for linked GitHub repository URL
- **Confluence spaces**: Multi-select or input for linked Confluence spaces
- **Save button**: Persists configuration changes via resolver
- Validation on all fields with inline error messages

#### `AuditLogTab`
Searchable and filterable audit log table:
- **Columns**: Timestamp, Ticket Key, Action, Result, Score, User
- **Filters**: Date range, action type, result (pass/fail), ticket key, user
- **Sorting**: Clickable column headers for ascending/descending sort
- **Pagination**: Paginated results with configurable page size
- Data fetched via Forge resolvers from the audit log store

### Technology Stack
- **React 18** with hooks
- **@atlaskit/*** component library for Atlassian Design System compliance
- **Custom UI** (Forge) for rendering within Jira admin

## Acceptance Criteria
- [ ] Dashboard is accessible from the Jira admin page navigation
- [ ] Overview tab displays real metrics fetched via Forge resolvers
- [ ] Configuration tab allows editing and saving ProjectConfig
- [ ] Audit log tab displays entries with working filters and sorting
- [ ] Admin-only access enforced; non-admin users cannot access the dashboard
- [ ] Loading states displayed during data fetch for all tabs
- [ ] Error states displayed gracefully with retry option
- [ ] Uses Atlassian Design System (@atlaskit/*) components throughout
- [ ] Component test coverage > 80%
- [ ] `.reqs.md` sidecar file produced

## Triple Deliverable
1. **Implementation**: Full React dashboard with OverviewTab, ConfigurationTab, and AuditLogTab components, plus Forge resolver integration
2. **Test Suite**: Component tests for each tab, form validation tests, resolver invocation tests, and access control tests
3. **Requirements Traceability**: `.reqs.md` sidecar file mapping implementation to rulebook refs and acceptance criteria

## Risks
- **Admin Permission Scope**: Forge permissions must be correctly configured; insufficient scope will prevent resolver access to admin-only data
- **Audit Log Volume**: Large audit logs could cause performance issues; implement server-side pagination and filtering
- **Configuration Validation**: Invalid configuration values could break the quality gate pipeline; thorough validation is essential
- **Metrics Accuracy**: Overview metrics must reflect real-time data; consider caching strategy with appropriate TTL

## QA Gates

### Pre-Implementation Gates
- [ ] **GATE-READY**: All dependencies (RTASK-015, RTASK-024) are completed
- [ ] **GATE-SPEC**: Rulebook sections UI-ADS-001, SEC-PRIV-002 have been read and understood
- [ ] **GATE-DESIGN**: Implementation approach documented before coding

### Implementation Gates (per file/function)
- [ ] **GATE-RED**: Write failing test FIRST for each function/component
- [ ] **GATE-GREEN**: Write minimum code to make test pass
- [ ] **GATE-REFACTOR**: Clean up code while keeping tests green

### Post-Implementation Gates
- [ ] **GATE-TYPECHECK**: `npm run typecheck` passes with zero errors
- [ ] **GATE-LINT**: `npm run lint` passes with zero warnings
- [ ] **GATE-FORMAT**: `npm run format:check` passes
- [ ] **GATE-TEST**: `npm run test:unit` passes with coverage > 80%
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
1. Read the full task spec (`docs/tickets/TASK-019-presentation-admin-dashboard.md`)
2. Read referenced rulebook sections (`docs/rulebook/RULEBOOK.md` -> UI-ADS-001, SEC-PRIV-002)
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
1. Run `npm run typecheck` -- must pass
2. Run `npm run lint` -- must pass with zero warnings
3. Run `npm run format:check` -- must pass
4. Run `npm run test:unit` -- must pass with > 80% coverage
5. Verify zero `any` usage

## Auditing Protocol

### Critic Review Checklist
- [ ] All acceptance criteria verified as implemented
- [ ] No `any` types anywhere in new code
- [ ] All interfaces use `readonly` properties
- [ ] Error handling follows hierarchy (REGError -> domain errors)
- [ ] Structured logging with `executionId` on all operations
- [ ] No hardcoded secrets, tokens, or credentials
- [ ] Input validation on all external-facing functions
- [ ] Triple deliverable complete: `.ts` + `.reqs.md` + `.spec.ts`
- [ ] No code outside specified file locations
- [ ] Dependencies only on completed RTASK modules
- [ ] Rulebook rules UI-ADS-001, SEC-PRIV-002 are satisfied

### Rejection Criteria
The critic MUST reject if:
- Any `any` type is present
- Coverage is below the required threshold (80%)
- A `.reqs.md` sidecar is missing
- A `.spec.ts` test file is missing
- Structured logging is absent
- Error handling is missing or generic (`catch (e) { }`)
- External dependencies were added without approval

## Testing Protocol

### Unit Tests (`tests/unit/frontend/admin-dashboard/`)
- Location: Mirror production path under `tests/unit/`
- Naming: `[filename].spec.ts`
- Coverage target: 80%
- Pattern: Arrange-Act-Assert (AAA)
- Must test: Happy path, error paths, edge cases, boundary values

### Test Categories Required
- [ ] **Happy path**: Component renders correctly with valid data
- [ ] **Error handling**: Component handles errors gracefully (error boundary, retry)
- [ ] **Edge cases**: Empty data, null/undefined metrics, boundary values
- [ ] **Component rendering**: React Testing Library renders all sub-components correctly
- [ ] **User interactions**: Form submissions, tab switches, filter changes work correctly
- [ ] **Accessibility**: Keyboard navigation and ARIA labels work as expected

### React Testing Strategy
- Use `@testing-library/react` for component rendering and queries
- Use `userEvent` for simulating user interactions (clicks, keyboard, form input)
- Use `render` within `@testing-library/react` for each component test
- Mock Forge resolver invocations with `jest.fn()`
- Mock `@forge/bridge` calls for resolver communication
- Test loading states, error states, and empty states for each component
- Reset mocks between tests (`beforeEach`)
