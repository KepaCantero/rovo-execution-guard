---
id: RTASK-018
title: "Presentation Layer - Jira Issue Panel (Spider Chart)"
status: pending
priority: 4
type: presentation
dependencies: [RTASK-015, RTASK-006, RTASK-007]
rulebook_refs: [UI-ADS-001, UI-ADS-002, FORGE-OPS-005]
spec: docs/tickets/TASK-018-presentation-jira-issue-panel.md
---

# RTASK-018: Presentation Layer - Jira Issue Panel (Spider Chart)

## Objective
Implement the Jira Issue Panel as a Forge Custom UI module that provides an at-a-glance visualization of ticket quality scores, inconsistencies, and enforcement status directly within the Jira issue view.

## Context
The issue panel is the primary user-facing interface for developers and project managers interacting with the Rovo Execution Guard system. It must present complex quality gate data in an intuitive, visually appealing format using a spider (radar) chart. This task depends on the Forge UI infrastructure (RTASK-015), the quality scoring model (RTASK-006), and the inconsistency tracking model (RTASK-007).

## Technical Specification

### Location
`src/frontend/custom-ui/issue-panel/`

### Forge Module Configuration
- Register as **`jira:issuePanel`** in `manifest.yml`
- Must load as a Custom UI module using React

### Component Architecture

#### `IssuePanelApp` (Entry Component)
- Root component rendered in the Forge panel
- Invokes Forge resolvers to fetch ticket quality data
- Manages global state and error/loading boundaries
- Passes data down to child components

#### `SpiderChart` (Radar Chart)
- Renders a radar/spider chart with **5 axes** representing the quality dimensions
- **Color-coded score ranges**:
  - **Green**: Score > 80 (good)
  - **Yellow**: Score 60-80 (needs improvement)
  - **Red**: Score < 60 (failing)
- **Overall score** displayed prominently in the center of the chart
- Lazy-loaded for performance (only render when panel is visible)

#### `ScoreSummary`
- Displays a badge with the overall quality score
- Gate indicator showing pass/fail status for each gate
- Timestamp of last evaluation
- **Revalidate button** to trigger a fresh quality gate evaluation

#### `InconsistenciesList`
- Lists all detected inconsistencies for the ticket
- Each item shows a **severity icon** (critical/warning/info)
- **Expandable suggestions** with actionable fix recommendations
- **Resolve** and **Dismiss** action buttons per inconsistency

#### `EnforcementStatus`
- Displays the current gate states (Gate 1, Gate 2, Gate 3)
- Shows blocked transitions with reasons
- Provides **GitHub PR links** for associated pull requests
- Visual indicator of enforcement actions taken

### Technology Stack
- **React 18** with hooks (useState, useEffect, useCallback, useMemo)
- **@atlaskit/*** component library for Atlassian Design System compliance
- **Custom UI** (Forge) for rendering within Jira
- **CSS-in-JS** for scoped styling

### Performance Requirements
- **< 1 second** initial load time for the panel
- Lazy load the `SpiderChart` component (only when visible)
- Cache resolver data to avoid redundant fetches
- Use React.memo and useMemo for expensive computations

### Accessibility & Responsiveness
- Panel must be keyboard navigable
- Screen reader support with ARIA labels
- Responsive layout adapting to panel width constraints

## Acceptance Criteria
- [ ] Panel is visible and functional in the Jira issue view
- [ ] Spider chart renders 5 axes with correct color coding (green > 80, yellow 60-80, red < 60)
- [ ] Overall score displayed in center and color-coded appropriately
- [ ] Inconsistency list shows severity icons with expandable suggestions
- [ ] Revalidate button triggers a fresh quality gate evaluation
- [ ] Loading states displayed during data fetch
- [ ] Error states displayed gracefully with retry option
- [ ] Uses Atlassian Design System (@atlaskit/*) components throughout
- [ ] Responsive layout and accessible (keyboard + screen reader)
- [ ] Component test coverage > 85%
- [ ] `.reqs.md` sidecar file produced

## Triple Deliverable
1. **Implementation**: Full React component tree with SpiderChart, ScoreSummary, InconsistenciesList, and EnforcementStatus components
2. **Test Suite**: Component tests for each sub-component, integration tests for resolver invocation, and visual regression baseline
3. **Requirements Traceability**: `.reqs.md` sidecar file mapping implementation to rulebook refs and acceptance criteria

## Risks
- **Forge Custom UI Limitations**: Custom UI has restricted API access; some features may require bridge calls or resolver invocations
- **Chart Library Bundle Size**: Including a charting library (e.g., recharts, d3) could impact load time; evaluate lightweight alternatives
- **Panel Width Constraints**: Jira issue panels have limited width; spider chart must remain readable at small sizes
- **Resolver Latency**: Multiple resolver calls could slow panel rendering; batch requests where possible

## QA Gates

### Pre-Implementation Gates
- [ ] **GATE-READY**: All dependencies (RTASK-015, RTASK-006, RTASK-007) are completed
- [ ] **GATE-SPEC**: Rulebook sections UI-ADS-001, UI-ADS-002, FORGE-OPS-005 have been read and understood
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
1. Read the full task spec (`docs/tickets/TASK-018-presentation-jira-issue-panel.md`)
2. Read referenced rulebook sections (`docs/rulebook/RULEBOOK.md` -> UI-ADS-001, UI-ADS-002, FORGE-OPS-005)
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
4. Run `npm run test:unit` -- must pass with > 85% coverage
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
- [ ] Rulebook rules UI-ADS-001, UI-ADS-002, FORGE-OPS-005 are satisfied

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

### Unit Tests (`tests/unit/frontend/issue-panel/`)
- Location: Mirror production path under `tests/unit/`
- Naming: `[filename].spec.ts`
- Coverage target: 85%
- Pattern: Arrange-Act-Assert (AAA)
- Must test: Happy path, error paths, edge cases, boundary values

### Test Categories Required
- [ ] **Happy path**: Component renders correctly with valid data
- [ ] **Error handling**: Component handles errors gracefully (error boundary, retry)
- [ ] **Edge cases**: Empty data, null/undefined scores, boundary values
- [ ] **Component rendering**: React Testing Library renders all sub-components correctly
- [ ] **User interactions**: Click handlers (revalidate, resolve, dismiss) fire correctly
- [ ] **Accessibility**: Keyboard navigation and ARIA labels work as expected

### React Testing Strategy
- Use `@testing-library/react` for component rendering and queries
- Use `userEvent` for simulating user interactions (clicks, keyboard)
- Use `render` within `@testing-library/react` for each component test
- Mock Forge resolver invocations with `jest.fn()`
- Mock `@forge/bridge` calls for resolver communication
- Test loading states, error states, and empty states for each component
- Reset mocks between tests (`beforeEach`)
