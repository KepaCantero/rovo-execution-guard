# REQUISITOS: scheduled-indexer.ts

> **Sidecar File** | Vinculado a: `src/backend/resolvers/scheduled-indexer.ts`

---

## Descripcion

Forge scheduled trigger handler for graph maintenance. Runs weekly to generate health reports and keep the Relationship Index monitored. Thin HANDLER layer that delegates to SERVICE layer functions.

---

## Acceptance Criteria

- [ ] **AC-07**: `scheduled-indexer.ts` handler registered in manifest as `graph-maintenance-fn`
- [ ] **AC-08**: Scheduled trigger configured with cron `'0 3 * * 1'` (weekly Monday 3 AM)
- [ ] **AC-10**: Handler generates graph health report via `generateHealthReport`

---

## Reglas del Rulebook

| ID Regla         | Categoria    | Descripcion breve                                  |
| ---------------- | ------------ | -------------------------------------------------- |
| [FORGE-OPS-001]  | Forge Ops    | Manifest top-level: app, modules, permissions only |
| [FORGE-OPS-005]  | Forge Ops    | No invocation exceeds 10s (20s budget with guard)  |
| [FORGE-OPS-0105] | Forge Ops    | Stateless functions, no module-level mutable state |
| [ARCH-SOLID-006] | Arquitectura | Handler -> Service dependency direction            |
| [ARCH-SOLID-058] | Arquitectura | Handler layer annotation comments                  |
| [ARCH-SOLID-202] | Arquitectura | Zero any usage                                     |
| [ARCH-SOLID-205] | Arquitectura | Explicit return types on exported functions        |
| [ARCH-SOLID-225] | Arquitectura | No floating promises (void prefix + catch)         |
| [ARCH-SOLID-232] | Arquitectura | Named exports only                                 |
| [ARCH-SOLID-235] | Arquitectura | One main export per file                           |
| [ARCH-SOLID-241] | Arquitectura | All async functions wrap body in try/catch         |
| [ARCH-SOLID-255] | Arquitectura | Structured JSON logging                            |

---

## Contrato Publico (API del modulo)

### Funciones exportadas

#### `handler(payload: ScheduledMaintenancePayload, context: ScheduledMaintenanceContext): Promise<ScheduledMaintenanceResult>`

- **Proposito**: Forge scheduled trigger handler for graph health monitoring
- **Pre-condiciones**: None (triggered by Forge scheduler)
- **Post-condiciones**: Health report generated and logged
- **Errores**: Never throws — errors captured in result

#### `onScheduledMaintenance(payload: ScheduledMaintenancePayload, executionId: string): Promise<ScheduledMaintenanceResult>`

- **Proposito**: Business logic for scheduled maintenance
- **Pre-condiciones**: Valid projectKey in payload
- **Post-condiciones**: Health report generated
- **Errores**: Never throws — errors captured in result

---

## Dependencias (imports)

### Internas (proyecto)

- `src/backend/services/relationship-index/graph-maintenance` -> `generateHealthReport`, type `GraphHealthReport`, type `MaintenanceResult`

### NOTA: Capa HANDLER

- No `@forge/api` imports — storage access via service layer only
- No repository imports — service layer only

---

## Estrategia de Test

### Unit Tests (`tests/unit/resolvers/scheduled-indexer.spec.ts`)

| Test                                                  | AC cubierto  | Regla cubierta                |
| ----------------------------------------------------- | ------------ | ----------------------------- |
| should generate health report for valid projectKey    | AC-07, AC-10 | ARCH-SOLID-006                |
| should handle empty projectKey gracefully             | AC-07        | FORGE-OPS-054                 |
| should handle generateHealthReport failure gracefully | AC-07        | FORGE-OPS-054, ARCH-SOLID-241 |
| should include executionId in result                  | AC-07        | ARCH-SOLID-255                |
| should not exceed timeout budget                      | AC-08        | FORGE-OPS-005                 |
| should return error result when maintenance fails     | AC-07        | ARCH-SOLID-241                |

---

## Historial de Cambios

| Fecha      | Tarea Ralph | Cambio         |
| ---------- | ----------- | -------------- |
| 2026-05-02 | RTASK-044   | Creado inicial |
