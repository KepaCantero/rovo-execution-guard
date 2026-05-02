# REQUISITOS: relationship-index barrel

> **Sidecar File** | Vinculado a: `src/backend/services/relationship-index/index.ts`

---

## Descripcion

Barrel file for the relationship-index service module. Re-exports all public functions and types from a single import surface, so future indexers and consumers import from one path.

---

## Acceptance Criteria

- [x] **AC-01**: Re-export all 15 functions from `./relationship-storage` using named exports
- [x] **AC-02**: Re-export all 12 types from `../../types/relationship-index` using `export type`
- [x] **AC-03**: No `export default` — named exports only [ARCH-SOLID-232]
- [x] **AC-04**: Zero framework dependencies — pure re-export barrel [ARCH-SOLID-058]
- [x] **AC-05**: All imports resolve at compile time (typecheck passes)
- [x] **AC-06**: Follows the grouped section-comment pattern from `src/backend/types/index.ts`

---

## Reglas del Rulebook

| ID Regla       | Categoria    | Descripcion breve              |
| -------------- | ------------ | ------------------------------ |
| ARCH-SOLID-232 | Arquitectura | Named exports only, no default |
| ARCH-SOLID-058 | Arquitectura | Barrel has zero framework deps |
| ARCH-SOLID-006 | Arquitectura | Service layer public API       |

---

## Contrato Publico (API del modulo)

### Re-exported functions (from relationship-storage)

All 15 async functions re-exported by name:
getNode, putNode, deleteNode, getEdges, putEdges, deleteEdges,
getTopicEntities, putTopicIndex, getStats, putStats,
queryRelationships, buildRelationshipContext,
bulkPutNodes, bulkPutEdges

### Re-exported types (from relationship-index domain types)

All 12 types re-exported via `export type`:
EntityType, EntityNode, EdgeType, RelationshipEdge, TopicCluster,
RelationshipContext, ContextItem, CrossReference,
RelationshipQuery, RelationshipQueryResult, GraphStats,
RelationshipIndexer

---

## Dependencias (imports)

### Internas (proyecto)

- `./relationship-storage` -> 15 async functions
- `../../types/relationship-index` -> 12 domain types

### Externas (npm)

- None — pure re-export barrel

---

## Estrategia de Test

### Unit Tests (`tests/unit/services/relationship-index/index.spec.ts`)

| Test                                    | AC cubierto | Regla cubierta |
| --------------------------------------- | ----------- | -------------- |
| should export all 15 functions by name  | AC-01       | ARCH-SOLID-232 |
| should export all 12 types by name      | AC-02       | ARCH-SOLID-232 |
| should not have a default export        | AC-03       | ARCH-SOLID-232 |
| should have zero runtime framework deps | AC-04       | ARCH-SOLID-058 |

---

## Historial de Cambios

| Fecha      | Tarea Ralph | Cambio                   |
| ---------- | ----------- | ------------------------ |
| 2026-05-01 | RTASK-037   | Creado inicial [REG-037] |
