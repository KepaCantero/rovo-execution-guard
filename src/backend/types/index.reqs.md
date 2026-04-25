# REQUISITOS: Domain Types Barrel

> **Sidecar File** | Vinculado a: `src/backend/types/index.ts`

---

## Descripcion

Barrel file that re-exports all domain types from the `src/backend/types/` directory. Provides a single import point for consumers. Organized by category with section comments. Named exports only, no default export.

---

## Acceptance Criteria

- [ ] **AC-01**: All types from all modules are re-exported
- [ ] **AC-02**: Error classes are exported as values (not types)
- [ ] **AC-03**: Interfaces and type aliases are exported as `type` exports
- [ ] **AC-04**: No circular dependencies
- [ ] **AC-05**: Consumers can import everything from `src/backend/types` with a single import statement

---

## Reglas del Rulebook

| ID Regla         | Categoria    | Descripcion breve                            |
| ---------------- | ------------ | -------------------------------------------- |
| [ARCH-SOLID-058] | Arquitectura | Domain layer has zero framework dependencies |
| [ARCH-SOLID-232] | TypeScript   | Named exports as default, no export default  |
| [ARCH-SOLID-224] | TypeScript   | Consistent type imports with `type` keyword  |

---

## Contrato Publico (API del modulo)

### Re-exports

All types and classes from the following modules:

- `errors.ts` — Error hierarchy (11 classes)
- `consistency-score.ts` — `ScoreAxes`, `ConsistencyScore`
- `inconsistency.ts` — `InconsistencyType`, `Severity`, `InconsistencySource`, `Inconsistency`
- `quality-gate.ts` — `GateType`, `QualityGateResult`
- `project-config.ts` — `GateConfig`, `ProjectConfig`
- `enforcement.ts` — `EnforcementAction`
- `rovo-context.ts` — `RovoDocument`, `HistoricalDecision`, `RovoContext`
- `jira-data.ts` — `JiraStatus`, `JiraTransition`, `JiraTicketData`
- `github-data.ts` — `PRFile`, `GitHubPRData`, `GitHubStatusCheck`
- `confluence-data.ts` — `ConfluencePageData`, `ConfluencePageMetadata`
- `audit-log.ts` — `AuditAction`, `AuditLogEntry`

---

## Dependencias (imports)

### Internas

- All modules within `src/backend/types/`
