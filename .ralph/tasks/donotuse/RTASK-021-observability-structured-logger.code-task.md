---
id: RTASK-021
title: "Observability Layer - Structured Logger"
status: pending
priority: 2
type: infrastructure
dependencies: [RTASK-005]
rulebook_refs: [FORGE-OPS-005, SEC-PRIV-006]
spec: docs/tickets/TASK-021-observability-structured-logger.md
---

# RTASK-021: Observability Layer - Structured Logger

## Objective

Implement a structured JSON logger that provides consistent, traceable observability across the entire Rovo Execution Guard application. Every log entry must carry an `executionId` that propagates through the full evaluation flow, enabling end-to-end tracing of gate evaluations from trigger to enforcement decision.

## Context

The application processes workflow transitions through multiple adapters (Jira, Rovo, GitHub, Confluence) and quality gates. Without structured logging, debugging production issues is near-impossible. Forge captures `console.log` output, so the logger must output JSON-structured entries via console while respecting environment-specific log levels. Sensitive data (tokens, passwords) must never appear in logs.

## Technical Specification

### Location
`src/backend/utils/logger.ts`

### Interface

```typescript
interface LogContext {
  readonly executionId: string;
  readonly module: string;
  readonly ticketKey?: string;
  readonly prNumber?: number;
  readonly projectKey?: string;
}

interface LogEntry {
  readonly timestamp: string;
  readonly level: 'debug' | 'info' | 'warn' | 'error';
  readonly executionId: string;
  readonly module: string;
  readonly ticketKey?: string;
  readonly prNumber?: number;
  readonly projectKey?: string;
  readonly message: string;
  readonly data?: Record<string, unknown>;
}

interface Logger {
  info(message: string, data?: Record<string, unknown>): void;
  warn(message: string, data?: Record<string, unknown>): void;
  error(message: string, data?: Record<string, unknown>): void;
  debug(message: string, data?: Record<string, unknown>): void;
}

function createLogger(context: LogContext): Logger;
```

### JSON Structured Output
Every log entry is a JSON object with the following fields:
- `timestamp` — ISO 8601 format
- `level` — debug | info | warn | error
- `executionId` — unique identifier per evaluation flow
- `module` — source module name (e.g., `jira-adapter`, `scoring-engine`)
- `ticketKey` — optional Jira ticket key
- `prNumber` — optional GitHub PR number
- `projectKey` — optional Jira project key
- `message` — human-readable log message
- `data` — optional structured data payload

### executionId Propagation
- `executionId` is generated once per evaluation flow (e.g., UUID v4)
- Propagated through all log calls within that flow
- Every adapter, gate, and service receives the logger with the same `executionId`
- Enables correlating all logs for a single gate evaluation

### Log Level Configuration
- **Development**: `debug` — all logs visible
- **Staging**: `info` — debug suppressed
- **Production**: `warn` — only warnings and errors
- Level determined via `process.env.NODE_ENV` or Forge environment variable
- Logs below configured level are silently discarded (not sent to console)

### Sensitive Data Protection
- Never log: authentication tokens, passwords, API keys, personal data
- Logger sanitizes known sensitive field names (e.g., `token`, `password`, `apiKey`, `secret`)
- If `data` contains sensitive keys, values are replaced with `[REDACTED]`

### Forge Integration
- Forge captures `console.log` output automatically
- Logger writes JSON to `console.log` — no file system or external transport
- Zero external dependencies (no winston, pino, etc.)

### Sidecar: `logger.reqs.md`
- Use `.ralph/templates/reqs-template.md` format
- Document interface, log levels, sanitization rules, acceptance criteria

## Acceptance Criteria

- [ ] AC-01: `createLogger(context)` returns a Logger with `info`, `warn`, `error`, `debug` methods
- [ ] AC-02: All log output is valid JSON with `timestamp`, `level`, `executionId`, `module`, `message` fields
- [ ] AC-03: `executionId` is propagated through all log entries for a given flow
- [ ] AC-04: Log level is configurable per environment (dev: debug, staging: info, prod: warn)
- [ ] AC-05: Logs below configured level are discarded (no output)
- [ ] AC-06: Sensitive data fields (token, password, apiKey, secret) are replaced with `[REDACTED]`
- [ ] AC-07: All adapters (Jira, Rovo, GitHub, Confluence) use the structured logger
- [ ] AC-08: Zero external dependencies (no third-party logging libraries)
- [ ] AC-09: Test coverage > 90%
- [ ] AC-10: `logger.reqs.md` sidecar created with acceptance criteria

## Triple Deliverable

| Production (.ts) | Sidecar (.reqs.md) | Test (.spec.ts) |
|------------------|-------------------|-----------------|
| `src/backend/utils/logger.ts` | `src/backend/utils/logger.reqs.md` | `tests/unit/utils/logger.spec.ts` |

## Risks

| Risk | Mitigation |
|------|------------|
| Forge console.log limits | Keep log payloads small; avoid large data objects |
| Log volume in production | Default to `warn` level; structured JSON enables filtering |
| Sensitive data leakage | Explicit sanitization of known sensitive field names |
| Performance overhead | Level check before JSON serialization; discard early |

## QA Gates

### Pre-Implementation Gates
- [ ] **GATE-READY**: All dependencies ([RTASK-005]) are completed
- [ ] **GATE-SPEC**: Rulebook sections FORGE-OPS-005, SEC-PRIV-006 have been read and understood
- [ ] **GATE-DESIGN**: Implementation approach documented before coding

### Implementation Gates (per file/function)
- [ ] **GATE-RED**: Write failing test FIRST for each function/component
- [ ] **GATE-GREEN**: Write minimum code to make test pass
- [ ] **GATE-REFACTOR**: Clean up code while keeping tests green

### Post-Implementation Gates
- [ ] **GATE-TYPECHECK**: `npm run typecheck` passes with zero errors
- [ ] **GATE-LINT**: `npm run lint` passes with zero warnings
- [ ] **GATE-FORMAT**: `npm run format:check` passes
- [ ] **GATE-TEST**: `npm run test:unit` passes with coverage > 90%
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
1. Read the full task spec (`docs/tickets/TASK-021-observability-structured-logger.md`)
2. Read referenced rulebook sections (`docs/rulebook/RULEBOOK.md` → FORGE-OPS-005, SEC-PRIV-006)
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
4. Run `npm run test:unit` — must pass with > 90% coverage
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
- [ ] Rulebook rules FORGE-OPS-005, SEC-PRIV-006 are satisfied

### Rejection Criteria
The critic MUST reject if:
- Any `any` type is present
- Coverage is below the required threshold (90%)
- A `.reqs.md` sidecar is missing
- A `.spec.ts` test file is missing
- Structured logging is absent
- Error handling is missing or generic (`catch (e) { }`)
- External dependencies were added without approval

## Testing Protocol

### Unit Tests (`tests/unit/utils/`)
- Location: Mirror production path under `tests/unit/`
- Naming: `[filename].spec.ts`
- Coverage target: 90%
- Pattern: Arrange-Act-Assert (AAA)
- Must test: Happy path, error paths, edge cases, boundary values

### Test Categories Required
- [ ] **Happy path**: Primary function works with valid inputs
- [ ] **Error handling**: Function handles errors gracefully
- [ ] **Edge cases**: Empty inputs, null/undefined, boundary values
- [ ] **Integration points**: Mocked adapter/service calls work correctly

### Mock Strategy
- Mock all external APIs (Jira, Confluence, Rovo, GitHub)
- Mock `@forge/api` and `@forge/resolver` calls
- Use `jest.fn()` for function mocks, not hand-rolled stubs
- Reset mocks between tests (`beforeEach`)
