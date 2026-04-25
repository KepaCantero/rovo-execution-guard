---
id: RTASK-024
title: 'Configuration Layer - Per-Project Settings'
status: pending
priority: 2
type: infrastructure
dependencies: [RTASK-005]
rulebook_refs: [FORGE-OPS-002, ARCH-SOLID-005, SEC-PRIV-002]
spec: docs/tickets/TASK-024-configuration-project-settings.md
---

# RTASK-024: Configuration Layer - Per-Project Settings

## Objective

Implement a per-project configuration service that allows Jira project administrators to customize quality gate behavior (thresholds, enabled gates, GitHub repo linkage) for their specific projects. Settings are stored via the Forge Storage API, cached in-memory with a TTL, and all modifications are audit-logged for traceability.

## Context

Different Jira projects have different quality standards. A mission-critical project may require a score threshold of 90 with all gates enabled, while an internal tooling project may use a threshold of 60 with only the execution gate. The configuration service must provide sensible defaults for new projects, validate all changes, restrict modifications to project admins, and cache settings to minimize Storage API calls.

## Technical Specification

### Location

`src/backend/services/config/`

### Storage

- **Backend**: Forge Storage API
- **Key pattern**: `project-config:{projectKey}`
- **Value**: JSON-serialized `ProjectConfig`

### Interface

```typescript
interface ProjectConfig {
  readonly projectKey: string;
  readonly enabled: boolean;
  readonly scoreThreshold: number;
  readonly gates: GateConfig;
  readonly githubRepo?: string;
  readonly githubOwner?: string;
}

interface GateConfig {
  readonly definition: boolean;
  readonly execution: boolean;
  readonly delivery: boolean;
}

interface ConfigService {
  getProjectConfig(projectKey: string): Promise<ProjectConfig>;
  saveProjectConfig(config: ProjectConfig): Promise<void>;
  validateConfig(config: unknown): config is ProjectConfig;
  invalidateCache(projectKey?: string): void;
}
```

### Default Configuration

When no config exists for a project, return defaults:

- `enabled`: `true`
- `scoreThreshold`: `80`
- `gates`: `{ definition: true, execution: true, delivery: true }`
- `githubRepo`: `undefined`
- `githubOwner`: `undefined`

### Functions

#### `getProjectConfig(projectKey: string) -> Promise<ProjectConfig>`

1. Check in-memory cache for `projectKey`
2. If cached and not expired, return cached value
3. If not cached, read from Forge Storage
4. If Storage returns nothing, return defaults
5. If Storage returns invalid data, log warning and return defaults
6. Cache the result with TTL

#### `saveProjectConfig(config: ProjectConfig) -> Promise<void>`

1. Validate caller is a project admin (check Jira permissions)
2. Run `validateConfig(config)` — reject if invalid
3. Serialize and write to Forge Storage
4. Invalidate cache for that project
5. Log the change to audit log (who, what, when, previous value)

#### `validateConfig(config: unknown) -> config is ProjectConfig`

- Type guard: validates that `config` conforms to `ProjectConfig`
- `projectKey`: non-empty string matching Jira project key pattern (`[A-Z][A-Z0-9]+`)
- `enabled`: boolean
- `scoreThreshold`: number between 0 and 100 (inclusive)
- `gates.definition`: boolean
- `gates.execution`: boolean
- `gates.delivery`: boolean
- `githubRepo`: optional string
- `githubOwner`: optional string

#### `invalidateCache(projectKey?: string) -> void`

- If `projectKey` provided: invalidate only that project's cache entry
- If no argument: invalidate entire cache (admin flush)

### Cache

- **Storage**: In-memory `Map<string, {config: ProjectConfig, expiresAt: number}>`
- **TTL**: 5 minutes (300,000 ms)
- **Invalidation**: Manual via `invalidateCache()` (admin action or after save)
- Cache is per-Forge-function invocation (in-memory, not shared across invocations)

### Audit Logging

Every `saveProjectConfig` call logs an `AuditLogEntry` with:

- `action`: `config_updated`
- `projectKey`: from config
- `userId`: from Forge invocation context
- `details`: `{ previousConfig, newConfig }`

### Sidecar: `config.reqs.md`

- Use `.ralph/templates/reqs-template.md` format
- Document interface, defaults, validation rules, cache strategy, acceptance criteria

## Acceptance Criteria

- [ ] AC-01: Default configuration works for new projects (no Storage entry needed)
- [ ] AC-02: `getProjectConfig` returns valid config from Storage or sensible defaults
- [ ] AC-03: `saveProjectConfig` validates config before saving; rejects invalid
- [ ] AC-04: `saveProjectConfig` rejects non-admin users with appropriate error
- [ ] AC-05: `validateConfig` acts as type guard with range checks (scoreThreshold 0-100)
- [ ] AC-06: In-memory cache with 5-minute TTL reduces Storage API calls
- [ ] AC-07: `invalidateCache` supports both single-project and full flush
- [ ] AC-08: All config changes are logged to audit with previous and new values
- [ ] AC-09: Test coverage > 85%
- [ ] AC-10: `config.reqs.md` sidecar created with acceptance criteria

## Triple Deliverable

| Production (.ts)                                  | Sidecar (.reqs.md)                                     | Test (.spec.ts)                                       |
| ------------------------------------------------- | ------------------------------------------------------ | ----------------------------------------------------- |
| `src/backend/services/config/config-service.ts`   | `src/backend/services/config/config-service.reqs.md`   | `tests/unit/services/config/config-service.spec.ts`   |
| `src/backend/services/config/config-validator.ts` | `src/backend/services/config/config-validator.reqs.md` | `tests/unit/services/config/config-validator.spec.ts` |
| `src/backend/services/config/index.ts`            | `src/backend/services/config/index.reqs.md`            | `tests/unit/services/config/index.spec.ts`            |

## Risks

| Risk                               | Mitigation                                                |
| ---------------------------------- | --------------------------------------------------------- |
| Forge Storage API latency          | In-memory cache with 5-min TTL minimizes calls            |
| Invalid config in Storage          | Validate on read; fall back to defaults if invalid        |
| Cache staleness after admin change | `saveProjectConfig` invalidates cache immediately         |
| Admin permission check fails       | Use Forge `@forge/api` context to verify Jira permissions |

## QA Gates

### Pre-Implementation Gates

- [ ] **GATE-READY**: All dependencies ([RTASK-005]) are completed
- [ ] **GATE-SPEC**: Rulebook sections FORGE-OPS-002, ARCH-SOLID-005, SEC-PRIV-002 have been read and understood
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

1. Read the full task spec (`docs/tickets/TASK-024-configuration-project-settings.md`)
2. Read referenced rulebook sections (`docs/rulebook/RULEBOOK.md` → FORGE-OPS-002, ARCH-SOLID-005, SEC-PRIV-002)
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
- [ ] Rulebook rules FORGE-OPS-002, ARCH-SOLID-005, SEC-PRIV-002 are satisfied

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

### Unit Tests (`tests/unit/services/config/`)

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

### Mock Strategy

- Mock all external APIs (Jira, Confluence, Rovo, GitHub)
- Mock `@forge/api` and `@forge/resolver` calls
- Use `jest.fn()` for function mocks, not hand-rolled stubs
- Reset mocks between tests (`beforeEach`)
