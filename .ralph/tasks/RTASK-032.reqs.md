# REQUISITOS: RTASK-032 Ralph Enhancement

> **Sidecar File** | Vinculado a: `ralph.yml`, `.claude/skills/RULEBOOK.md`, `.claude/skills/RULEBOOK-INDEX.md`

---

## Descripcion
Integrate architecturally sound improvements from docs/plan.txt into the existing ralph.yml orchestrator. Add 3 new hats (researcher, enforcer, debugger), create RULEBOOK auto-loading via .claude/skills/, add RULEBOOK backpressure gates, and add RULEBOOK compliance guardrails. Reject over-engineering proposals from plan.txt.

---

## Acceptance Criteria

- [x] **AC-01**: `.claude/skills/` directory created with 2 files: `RULEBOOK.md` and `RULEBOOK-INDEX.md`
- [x] **AC-02**: `ralph.yml` updated with 3 new hats (researcher, enforcer, debugger) and modified triggers for builder and finalizer
- [x] **AC-03**: 3 guardrails added to `ralph.yml` core.guardrails
- [x] **AC-04**: 2 backpressure gates added to `ralph.yml`
- [x] **AC-05**: Event chain is coherent - every published event has a listener, no orphan events
- [x] **AC-06**: Zero references to `docs/runbooks/` in `.ralph/tasks/` and `ralph.yml`
- [x] **AC-07**: All RTASK files referencing `docs/runbooks/` updated to `docs/rulebook/`
- [x] **AC-08**: `RTASK-032.reqs.md` sidecar created
- [x] **AC-09**: No `raw/` or `wiki/` directories created
- [x] **AC-10**: No separate `ralph.knowledge-base.yml` config created
- [x] **AC-11**: No `HATS-BOOTSTRAP.md`, `HATS-CANONICAL.md`, or `CLAUDE.md` created
- [ ] **AC-12**: `ralph preflight` passes after all changes

---

## Reglas del Rulebook

| ID Regla | Categoria | Descripcion breve |
|----------|-----------|-------------------|
| [ARCH-SOLID-001] | Arquitectura | Separacion de capas estricta |
| [ARCH-SOLID-002] | Arquitectura | Sin dependencias externas en dominio |
| [ARCH-SOLID-003] | Arquitectura | Principios SOLID en disenio de hats |

---

## Contrato Publico (API del modulo)

### Entregables

#### `.claude/skills/RULEBOOK.md`
- **Proposito**: Reference guide pointing to canonical rulebook at `docs/rulebook/RULEBOOK.md`
- **Pre-condiciones**: `docs/rulebook/RULEBOOK.md` exists
- **Post-condiciones**: Skills auto-loading provides rulebook context to all hats

#### `.claude/skills/RULEBOOK-INDEX.md`
- **Proposito**: Category-to-task mapping for 8 RULEBOOK categories
- **Pre-condiciones**: RULEBOOK.md exists
- **Post-condiciones**: Maps each category to applicable RTASKs

#### `ralph.yml` (updated)
- **Proposito**: Orchestrator config with 7 hats (was 4), 13 guardrails (was 10), 6 gates (was 4)
- **Pre-condiciones**: Existing ralph.yml with 4 hats
- **Post-condiciones**: 7 hats, coherent event chain, no orphan events
- **Errores**: Invalid YAML, orphan events, broken triggers

---

## Dependencias (imports)

### Internas (proyecto)
- `docs/rulebook/RULEBOOK.md` -> Canonical rulebook (dependency on RTASK-002)
- `.claude/skills/RULEBOOK.md` -> Reference guide
- `.claude/skills/RULEBOOK-INDEX.md` -> Category mapping

### Externas (npm)
- None

### NOTA: Capa de dominio
- This is an infrastructure task - no domain layer involved

---

## Estrategia de Test

### Validation Tests (infrastructure task - no unit tests)
| Test | AC cubierto | Regla cubierta |
|------|------------|----------------|
| ralph.yml parses as valid YAML | AC-02 | - |
| Event chain: no orphan events | AC-05 | ARCH-SOLID-001 |
| grep for docs/runbooks returns zero in ralph.yml | AC-06 | - |
| .claude/skills/ has 2 files | AC-01 | - |
| No extraneous files (raw/, wiki/, etc.) | AC-09,10,11 | - |
| ralph preflight passes | AC-12 | - |

### Integration Tests
- Event chain traversal: build.start through to LOOP_COMPLETE

### E2E Tests
- Full ralph preflight validates entire config

---

## Historial de Cambios

| Fecha | Tarea Ralph | Cambio |
|-------|-------------|--------|
| 2026-04-05 | RTASK-032 | Creado inicial |
