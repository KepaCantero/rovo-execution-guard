---
id: RTASK-023
title: 'Observability Layer - Health Checks Post-Deploy'
status: pending
priority: 4
type: infrastructure
dependencies: [RTASK-025, RTASK-026]
rulebook_refs: [FORGE-OPS-007, GIT-CI-010]
spec: docs/tickets/TASK-023-observability-health-checks.md
---

# RTASK-023: Observability Layer - Health Checks Post-Deploy

## Objective

Implement an automated health check system that validates critical service connectivity after every deployment. If the Forge app is unhealthy post-deploy, the system triggers an automatic rollback to the last known stable version. Health status and version history are persisted in `.forge-versions.json` for traceability.

## Context

The Rovo Execution Guard depends on four critical external services: the Forge runtime, Jira API, Rovo API, and GitHub API. A deployment that breaks connectivity to any of these services must be detected and rolled back automatically. Manual verification after each deploy is error-prone and slow. This task builds the health check script and the version tracking file that enables safe rollbacks.

## Technical Specification

### Location

`scripts/health-check.ts`

### Interface

```typescript
type HealthStatus = 'healthy' | 'degraded' | 'unhealthy';

interface HealthCheck {
  readonly name: string;
  readonly status: HealthStatus;
  readonly latencyMs: number;
  readonly error?: string;
}

interface HealthCheckResult {
  readonly status: HealthStatus;
  readonly checks: readonly HealthCheck[];
  readonly timestamp: string;
  readonly version: string;
}

function runHealthCheck(environment: string): Promise<HealthCheckResult>;
```

### Health Check Services (4 checks)

1. **Forge App** — invoke a Forge function endpoint, expect 200
2. **Jira API** — call `myself` endpoint, expect 200
3. **Rovo API** — call a lightweight status/query endpoint, expect 200
4. **GitHub API** — call `rate_limit` endpoint, expect 200

### Status Classification

- **healthy**: All 4 checks pass
- **degraded**: 1-2 non-critical checks fail (Forge + Jira must pass)
- **unhealthy**: Any critical check fails (Forge or Jira), or 3+ checks fail

### Timeout

- Each check has a **5-second timeout**
- If timeout exceeded, check is marked as failed with latency = 5000ms

### Post-Deploy Flow

1. Deploy completes
2. Wait 30 seconds (Forge warm-up)
3. Run `runHealthCheck(environment)`
4. If `unhealthy` -> trigger rollback via RTASK-025 rollback workflow
5. If `healthy` -> mark deployment as success
6. Register version in `.forge-versions.json`

### Version Tracking: `.forge-versions.json`

```json
{
  "current": "1.2.3",
  "lastStable": "1.2.2",
  "environments": {
    "development": { "version": "1.3.0-alpha.1", "deployedAt": "2025-01-15T10:00:00Z" },
    "staging": { "version": "1.2.3", "deployedAt": "2025-01-14T15:30:00Z" },
    "production": { "version": "1.2.2", "deployedAt": "2025-01-13T09:00:00Z" }
  }
}
```

### GitHub Actions Integration

- Callable from GitHub Actions workflow (RTASK-025)
- Exit code 0 = healthy, 1 = degraded, 2 = unhealthy
- Output JSON result to stdout for workflow parsing

### Sidecar: `health-check.reqs.md`

- Use `.ralph/templates/reqs-template.md` format
- Document checks, status classification, rollback triggers, acceptance criteria

## Acceptance Criteria

- [ ] AC-01: `runHealthCheck` checks all 4 critical services (Forge, Jira, Rovo, GitHub)
- [ ] AC-02: Result correctly classified as `healthy`, `degraded`, or `unhealthy`
- [ ] AC-03: Each check has a 5-second timeout; timeout counts as failure
- [ ] AC-04: Script is executable from GitHub Actions with appropriate exit codes
- [ ] AC-05: `unhealthy` result triggers rollback in the deploy workflow
- [ ] AC-06: Successful deployment registers version in `.forge-versions.json`
- [ ] AC-07: 30-second wait after deploy before health check begins
- [ ] AC-08: Unit tests cover status classification, timeout handling, and result formatting
- [ ] AC-09: `health-check.reqs.md` sidecar created with acceptance criteria

## Triple Deliverable

| Production (.ts)          | Sidecar (.reqs.md)             | Test (.spec.ts)                           |
| ------------------------- | ------------------------------ | ----------------------------------------- |
| `scripts/health-check.ts` | `scripts/health-check.reqs.md` | `tests/unit/scripts/health-check.spec.ts` |

## Risks

| Risk                                | Mitigation                                         |
| ----------------------------------- | -------------------------------------------------- |
| Forge warm-up takes longer than 30s | Make wait configurable; retry once on failure      |
| Health check itself fails (network) | Treat as unhealthy; trigger rollback               |
| False positive rollback             | `degraded` status does NOT trigger rollback        |
| `.forge-versions.json` corruption   | Validate JSON before reading; fallback to git tags |

## QA Gates

### Pre-Implementation Gates

- [ ] **GATE-READY**: All dependencies ([RTASK-025, RTASK-026]) are completed
- [ ] **GATE-SPEC**: Rulebook sections FORGE-OPS-007, GIT-CI-010 have been read and understood
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

1. Read the full task spec (`docs/tickets/TASK-023-observability-health-checks.md`)
2. Read referenced rulebook sections (`docs/rulebook/RULEBOOK.md` → FORGE-OPS-007, GIT-CI-010)
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
- [ ] Rulebook rules FORGE-OPS-007, GIT-CI-010 are satisfied

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

### Unit Tests (`tests/unit/scripts/`)

- Location: Mirror production path under `tests/unit/`
- Naming: `[filename].spec.ts`
- Coverage target: 85%
- Pattern: Arrange-Act-Assert (AAA)
- Must test: Happy path, error paths, edge cases, boundary values

### Test Categories Required

- [ ] **Happy path**: Primary function works with valid inputs
- [ ] **Error handling**: Function handles errors gracefully
- [ ] **Edge cases**: Empty inputs, null/undefined, boundary values
- [ ] **Integration points**: Mocked adapter/service calls work correctly
- [ ] **Exit code behavior**: Script returns correct exit codes (0=healthy, 1=degraded, 2=unhealthy) for GitHub Actions integration
- [ ] **Timeout handling**: Each service check respects 5-second timeout

### Mock Strategy

- Mock all external APIs (Jira, Confluence, Rovo, GitHub)
- Mock `@forge/api` and `@forge/resolver` calls
- Use `jest.fn()` for function mocks, not hand-rolled stubs
- Reset mocks between tests (`beforeEach`)
