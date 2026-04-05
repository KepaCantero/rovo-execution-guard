# Rovo Execution Guard - Task Index

## Overview
30 tasks organized in 8 phases. Each task follows the Ralph Protocol (PER) with:
- Objective, Context, Technical Specification
- Acceptance Criteria
- Rulebook references
- Test strategy
- Dependencies

## Execution Order

Tasks must be executed in dependency order, not necessarily sequential. Tasks within the same phase can run in parallel.

---

### Phase 1: Foundation (TASK-001 to TASK-004)
Infrastructure setup. No business logic.

| Task | Title | Dependencies | Priority |
|------|-------|-------------|----------|
| TASK-001 | Project Foundation & Forge Manifest | None | BLOCKER |
| TASK-002 | Rulebook Consolidated | None | BLOCKER |
| TASK-003 | TypeScript, ESLint, Prettier | TASK-001 | HIGH |
| TASK-004 | Husky, Commitlint, lint-staged | TASK-001, TASK-003 | HIGH |

---

### Phase 2: Domain Layer (TASK-005 to TASK-008)
Core business logic. Zero external dependencies.

| Task | Title | Dependencies | Priority |
|------|-------|-------------|----------|
| TASK-005 | Domain Types & Models | TASK-001, TASK-003 | BLOCKER |
| TASK-006 | Scoring Engine | TASK-005 | HIGH |
| TASK-007 | Inconsistency Detector | TASK-005 | HIGH |
| TASK-008 | Quality Gate Rules Engine | TASK-005, TASK-006, TASK-007 | HIGH |

---

### Phase 3: Integration Layer (TASK-009 to TASK-013)
API adapters and resilience patterns.

| Task | Title | Dependencies | Priority |
|------|-------|-------------|----------|
| TASK-009 | Jira API Adapter | TASK-005, TASK-013 | HIGH |
| TASK-010 | Rovo API Adapter | TASK-005, TASK-013 | HIGH |
| TASK-011 | GitHub API Adapter | TASK-005, TASK-013 | HIGH |
| TASK-012 | Confluence API Adapter | TASK-005, TASK-013 | MEDIUM |
| TASK-013 | Resilience (CB, Retry, Timeout) | TASK-005 | BLOCKER |

---

### Phase 4: Orchestration Layer (TASK-014 to TASK-017)
Triggers, resolvers, webhooks, enforcement.

| Task | Title | Dependencies | Priority |
|------|-------|-------------|----------|
| TASK-014 | Jira Triggers (Workflow Validator) | TASK-008, TASK-009, TASK-010, TASK-013, TASK-021 | HIGH |
| TASK-015 | Resolvers (Forge Bridge) | TASK-006, TASK-007, TASK-008, TASK-009, TASK-024 | HIGH |
| TASK-016 | GitHub Webhook Handler | TASK-008, TASK-009, TASK-010, TASK-011, TASK-013 | HIGH |
| TASK-017 | Enforcement Actions | TASK-008, TASK-009, TASK-011 | HIGH |

---

### Phase 5: Presentation Layer (TASK-018 to TASK-020)
UI components and GitHub comments.

| Task | Title | Dependencies | Priority |
|------|-------|-------------|----------|
| TASK-018 | Jira Issue Panel (Spider Chart) | TASK-015, TASK-006, TASK-007 | HIGH |
| TASK-019 | Admin Dashboard | TASK-015, TASK-024 | MEDIUM |
| TASK-020 | GitHub PR Comments | TASK-011, TASK-008 | MEDIUM |

---

### Phase 6: Observability (TASK-021 to TASK-023)
Logging, monitoring, health checks.

| Task | Title | Dependencies | Priority |
|------|-------|-------------|----------|
| TASK-021 | Structured Logger | TASK-005 | BLOCKER |
| TASK-022 | Sentry Integration | TASK-021 | HIGH |
| TASK-023 | Health Checks Post-Deploy | TASK-021 | HIGH |

---

### Phase 7: CI/CD & Testing (TASK-025 to TASK-029)
Pipelines, versioning, and test suites.

| Task | Title | Dependencies | Priority |
|------|-------|-------------|----------|
| TASK-025 | GitHub Actions Pipelines | TASK-004 | HIGH |
| TASK-026 | Semantic Release & Versioning | TASK-004 | HIGH |
| TASK-027 | Jest Unit Test Suite | TASK-006, TASK-007, TASK-013, TASK-021 | HIGH |
| TASK-028 | Integration Tests with Mocks | TASK-009, TASK-010, TASK-011 | HIGH |
| TASK-029 | E2E Playwright Suite | TASK-014, TASK-016, TASK-018 | HIGH |

---

### Phase 8: Documentation & Marketplace (TASK-030)
READMEs and marketplace plan.

| Task | Title | Dependencies | Priority |
|------|-------|-------------|----------|
| TASK-030 | READMEs & Marketplace Plan | All previous | MEDIUM |

---

## Quality Gates

Every task must pass these gates before being marked as complete:

1. **Code**: TypeScript strict, ESLint zero warnings, no `any`
2. **Tests**: Unit > 85% coverage for the module
3. **Sidecar**: `.reqs.md` file exists for every production file
4. **Rulebook**: All referenced rules are respected
5. **Review**: Ralph audit against AC and Rulebook

## Critical Path

```
TASK-001 ─┬─ TASK-003 ─── TASK-004 ─┬─ TASK-025
          │                          └─ TASK-026
          ├─ TASK-005 ─┬─ TASK-006 ───┬─ TASK-008 ── TASK-014
          │            ├─ TASK-007 ───┘              TASK-015
          │            └─ TASK-013 ──┬─ TASK-009     TASK-016
          │                          ├─ TASK-010     TASK-017
          │                          ├─ TASK-011       │
          │                          └─ TASK-012       │
          └─ TASK-021 ── TASK-022                      │
                  └── TASK-023                         │
                                                       ▼
TASK-018 ── TASK-019 ── TASK-020 ── TASK-027 ── TASK-028 ── TASK-029 ── TASK-030
```
