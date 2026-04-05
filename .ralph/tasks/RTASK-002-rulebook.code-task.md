---
id: RTASK-002
title: "Rulebook Consolidated"
status: pending
priority: 1
type: documentation
dependencies: []
rulebook_refs: []
spec: docs/tickets/TASK-002-rulebook.md
sources: info.txt (50 links + 50 books)
---

# RTASK-002: Rulebook Consolidated

## Objective

Create the master rulebook (`docs/rulebook/RULEBOOK.md`) — the single source of truth for all implementation and audit rules. Every line of future code must pass through these rules. Extract actionable rules from the 100 sources in `info.txt`.

## Context

The rulebook governs all future implementation. It defines 8 categories of rules with strict format (DEFINICION, VALOR, IMPLEMENTACION, AUDITORIA). This is a BLOCKER for all code tasks — builders must read the rulebook before writing code.

## Technical Specification

### Categories (minimum rules per category)

| Category | Min | Target |
|----------|-----|--------|
| FORGE-OPS | 10 | 12 |
| SEC-PRIV | 10 | 12 |
| ARCH-SOLID | 10 | 12 |
| TEST-QA | 8 | 10 |
| GIT-CI | 8 | 10 |
| UI-ADS | 5 | 7 |
| ROVO-INTEG | 5 | 8 |
| GH-INTEG | 8 | 10 |
| **TOTAL** | **64** | **81** |

### Rule Format (STRICT — every rule must follow this)

```markdown
### FORGE-OPS-001: Timeout maximo en resolvers

**DEFINICION**: Ninguna funcion asincrona en un resolver o trigger debe exceder 10 segundos de ejecucion.

**VALOR**: Forge tiene un hard limit de ejecucion. Excederlo causa crash no recuperable.

**IMPLEMENTACION**:
- Envolver todas las llamadas async con `withTimeout(promise, 9000)`
- Usar AbortController en fetch calls
- Logging del tiempo de ejecucion en cada resolver

**AUDITORIA** (Ralph check):
- [ ] Verificar que no hay `await` sin timeout en ningun resolver
- [ ] Verificar que `withTimeout` se usa en todas las llamadas a APIs externas
- [ ] Verificar que hay tests de timeout en los unit tests
```

### Priority Hierarchy (resolves contradictions)
1. Forge limits and documentation (FORGE-OPS)
2. OWASP Security + GitHub API (SEC-PRIV, GH-INTEG)
3. Architecture/Clean Code (ARCH-SOLID)
4. Testing and quality (TEST-QA)
5. Git workflow and CI/CD (GIT-CI)
6. UI/UX and ADS (UI-ADS)
7. Rovo/AI (ROVO-INTEG)

### Required Sections
1. Index (table of contents by category)
2. Rules (all rules in strict format)
3. Conflict Resolution Index (documented contradictions resolved)

## Acceptance Criteria

- [ ] AC-01: >= 80 actionable rules total
- [ ] AC-02: All 8 categories covered with >= 5 rules each
- [ ] AC-03: Every rule has DEFINICION, VALOR, IMPLEMENTACION, AUDITORIA
- [ ] AC-04: Every rule has unique ID with format `[CATEGORY]-[NUM]`
- [ ] AC-05: No duplicate IDs
- [ ] AC-06: No contradictions between rules (cross-checked)
- [ ] AC-07: Conflict Resolution Index present
- [ ] AC-08: Format is parseable (consistent markdown headers)
- [ ] AC-09: `RULEBOOK.reqs.md` sidecar created
- [ ] AC-10: Validation script `scripts/validate-rulebook.ts` created

## Triple Deliverable

| File | Sidecar | Test |
|------|---------|------|
| `docs/rulebook/RULEBOOK.md` | `docs/rulebook/RULEBOOK.reqs.md` | `scripts/validate-rulebook.ts` |

## Sources to Extract From

1. `info.txt` — 50 links and 50 books listed
2. Forge documentation limits and constraints
3. OWASP top 10 for Node.js/TypeScript
4. GitHub REST API v3 best practices
5. Atlassian Design System guidelines

## Risks

| Risk | Mitigation |
|------|------------|
| Contradictory rules | Priority hierarchy resolves conflicts |
| Generic rules without value | Every rule needs IMPLEMENTACION and AUDITORIA |
| Too many rules (>100) | Cap at 100, deduplicate aggressively |

## QA Gates

### Pre-Implementation Gates
- [ ] **GATE-READY**: All dependencies (none — this is a root task) are completed
- [ ] **GATE-SPEC**: No rulebook refs (this IS the rulebook)
- [ ] **GATE-DESIGN**: Implementation approach documented before coding

### Implementation Gates (per section/rule)
- [ ] **GATE-RED**: Write failing validation test FIRST for each rule
- [ ] **GATE-GREEN**: Write minimum content to make validation pass
- [ ] **GATE-REFACTOR**: Clean up content while keeping validation green

### Post-Implementation Gates
- [ ] **GATE-TYPECHECK**: `npm run typecheck` passes with zero errors
- [ ] **GATE-LINT**: `npm run lint` passes with zero warnings
- [ ] **GATE-FORMAT**: `npm run format:check` passes
- [ ] **GATE-TEST**: Validation script (`scripts/validate-rulebook.ts`) passes all checks
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
1. Read the full task spec (`docs/tickets/TASK-002-rulebook.md`)
2. Read all source material from `info.txt` (50 links + 50 books)
3. Understand the 8 rule categories and minimum counts
4. Create `.reqs.md` sidecar files with requirements traceability

### Step 2: TDD Cycle (per rule)
1. **RED**: Write a failing validation test that defines expected rule format
2. **GREEN**: Write the minimum rule content to make validation pass
3. **REFACTOR**: Clean up while keeping all validations green
4. Repeat for next rule

### Step 3: Integration
1. Run full validation script across all rules
2. Verify cross-references between rules
3. Confirm Conflict Resolution Index is complete

### Step 4: Validation
1. Run `npm run typecheck` — must pass
2. Run `npm run lint` — must pass with zero warnings
3. Run `npm run format:check` — must pass
4. Run `scripts/validate-rulebook.ts` — must pass all checks
5. Verify >= 80 rules, all 8 categories covered

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
- [ ] No rulebook refs (this IS the rulebook)

### Rejection Criteria
The critic MUST reject if:
- Any `any` type is present
- Coverage is below the required threshold (N/A — documentation task)
- A `.reqs.md` sidecar is missing
- A validation script is missing
- Structured logging is absent
- Error handling is missing or generic (`catch (e) { }`)
- External dependencies were added without approval

## Testing Protocol

### Documentation Validation
- Production files: docs/rulebook/RULEBOOK.md, scripts/validate-rulebook.ts
- Validated by: `scripts/validate-rulebook.ts`
- Task type: documentation
- No unit tests required — validation is script-based

### Validation Checklist
- [ ] >= 80 actionable rules total
- [ ] All 8 categories covered with >= 5 rules each
- [ ] Every rule has DEFINICION, VALOR, IMPLEMENTACION, AUDITORIA
- [ ] Every rule has unique ID with format `[CATEGORY]-[NUM]`
- [ ] No duplicate IDs
- [ ] No contradictions between rules
- [ ] Conflict Resolution Index present
- [ ] Format is parseable (consistent markdown headers)
