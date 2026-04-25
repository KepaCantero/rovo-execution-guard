# REQUISITOS: Confluence Data

> **Sidecar File** | Vinculado a: `src/backend/types/confluence-data.ts`

---

## Descripcion

Defines the data structures representing Confluence page data as consumed by the Rovo Execution Guard domain. Includes full page content and lightweight metadata for listing and reference purposes.

---

## Acceptance Criteria

- [ ] **AC-01**: `ConfluencePageData` has `id`, `title`, `content`, `spaceKey`, `url`, `lastUpdated` (all readonly)
- [ ] **AC-02**: `ConfluencePageMetadata` has `id`, `title`, `spaceKey`, `labels`, `version`, `lastUpdated` (all readonly)
- [ ] **AC-03**: All interface properties are `readonly`
- [ ] **AC-04**: Zero external dependencies

---

## Reglas del Rulebook

| ID Regla         | Categoria    | Descripcion breve                            |
| ---------------- | ------------ | -------------------------------------------- |
| [ARCH-SOLID-058] | Arquitectura | Domain layer has zero framework dependencies |
| [ARCH-SOLID-202] | TypeScript   | Zero any usage                               |
| [ARCH-SOLID-203] | TypeScript   | Interfaces for public data structures        |

---

## Contrato Publico (API del modulo)

### Tipos exportados

#### `ConfluencePageData`

- **Proposito**: Full Confluence page content for consistency analysis
- **Propiedades**: `id`, `title`, `content`, `spaceKey`, `url`, `lastUpdated`

#### `ConfluencePageMetadata`

- **Proposito**: Lightweight Confluence page metadata for listing and referencing
- **Propiedades**: `id`, `title`, `spaceKey`, `labels: readonly string[]`, `version: number`, `lastUpdated`

---

## Dependencias (imports)

### Internas

- None (leaf module)
