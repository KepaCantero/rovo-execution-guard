# REQUISITOS: Graph Maintenance

> **Sidecar File** | Vinculado a: `src/backend/services/relationship-index/graph-maintenance.ts`

---

## Descripcion

Storage-level graph maintenance operations for the Relationship Index: node validation against storage, orphaned edge cleanup. Keeps the graph healthy by detecting and removing stale data without external API calls.

---

## Acceptance Criteria

- [ ] **AC-01**: `validateNodeBatch` validates nodes against storage, checking both node existence and edge target existence, returning deduplicated orphaned IDs
- [ ] **AC-03**: `removeOrphanedEdges` removes edge entries for orphaned node IDs, returning count of individual edges removed
- [ ] **AC-11**: All maintenance operations are idempotent — running twice produces same state

---

## Reglas del Rulebook

| ID Regla       | Categoria    | Descripcion breve                                             |
| -------------- | ------------ | ------------------------------------------------------------- |
| FORGE-OPS-007  | Forge Ops    | Rate limits: 110ms between deletes                            |
| FORGE-OPS-0102 | Forge Ops    | Retry with exponential backoff (baked into storage functions) |
| FORGE-OPS-0104 | Forge Ops    | Graceful degradation — errors logged, not thrown              |
| FORGE-OPS-0105 | Forge Ops    | Stateless functions, no module-level mutable state            |
| ARCH-SOLID-006 | Arquitectura | Handler → Service → Repository (this is Service)              |
| ARCH-SOLID-202 | Arquitectura | Zero any                                                      |
| ARCH-SOLID-205 | Arquitectura | Explicit return types on all exports                          |
| ARCH-SOLID-232 | Arquitectura | Named exports only                                            |
| ARCH-SOLID-241 | Arquitectura | Try/catch or delegated error handling                         |
| ARCH-SOLID-255 | Arquitectura | Structured JSON logging                                       |
| TEST-QA-056    | Testing      | TDD cycle — RED, GREEN, REFACTOR                              |
| TEST-QA-057    | Testing      | Edge case coverage                                            |

---

## Contrato Publico (API del modulo)

### Funciones exportadas

#### `validateNodeBatch(nodes: readonly EntityNode[], executionId: string): Promise<readonly string[]>`

- **Proposito**: Validate a batch of nodes against storage, returning IDs of orphaned nodes (both missing source nodes and missing edge targets)
- **Pre-condiciones**: nodes array may be empty; each EntityNode has its own projectKey
- **Post-condiciones**: Returns deduplicated list of node IDs that don't exist in storage
- **Errores**: Individual errors logged and skipped (graceful degradation)

#### `removeOrphanedEdges(projectKey: string, orphanedNodeIds: readonly string[], executionId: string): Promise<number>`

- **Proposito**: Remove edge entries for orphaned nodes, counting individual edges removed
- **Pre-condiciones**: orphanedNodeIds may be empty; all IDs belong to same project
- **Post-condiciones**: Returns count of individual edges removed across all orphaned nodes
- **Errores**: Individual errors logged and skipped (graceful degradation)

---

## Dependencias (imports)

### Internas (proyecto)

- `src/backend/services/relationship-index/relationship-storage` → `getNode`, `getEdges`, `deleteEdges`
- `src/backend/types/relationship-index` → `EntityNode` (type-only)

---

## Estrategia de Test

### Unit Tests (`tests/unit/services/relationship-index/graph-maintenance.spec.ts`)

| Test                                             | AC cubierto | Regla cubierta |
| ------------------------------------------------ | ----------- | -------------- |
| Returns empty array when all nodes exist         | AC-01       | -              |
| Returns orphaned IDs for missing nodes           | AC-01       | -              |
| Checks edge targets and reports orphaned targets | AC-01       | -              |
| Deduplicates orphaned IDs                        | AC-01       | -              |
| Handles empty node batch                         | AC-01       | -              |
| All nodes orphaned                               | AC-01       | -              |
| Validates all 6 entity types                     | AC-01       | -              |
| Idempotent: same input produces same output      | AC-11       | -              |
| Continues after individual errors                | AC-01       | FORGE-OPS-0104 |
| Deletes edge entries for orphaned nodes          | AC-03       | -              |
| Returns 0 when no edges to remove                | AC-03       | -              |
| Handles empty orphaned list                      | AC-03       | -              |
| Idempotent: running twice same state             | AC-11       | -              |
| Continues after delete errors                    | AC-03       | FORGE-OPS-0104 |

---

## Historial de Cambios

| Fecha      | Tarea Ralph | Cambio                                                                                |
| ---------- | ----------- | ------------------------------------------------------------------------------------- |
| 2026-05-02 | RTASK-044   | Creado inicial (Step 11.1: validateNodeBatch, removeOrphanedEdges, MaintenanceResult) |
