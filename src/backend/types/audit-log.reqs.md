# REQUISITOS: Audit Log

> **Sidecar File** | Vinculado a: `src/backend/types/audit-log.ts`

---

## Descripcion

Defines the `AuditLogEntry` interface and `AuditAction` union type for recording all enforcement actions and quality gate evaluations. Every significant action in the system produces an audit log entry for traceability, compliance, and debugging. The `details` field uses `Record<string, unknown>` to allow structured, action-specific metadata.

---

## Acceptance Criteria

- [ ] **AC-01**: `AuditAction` is a union of eight string literals covering all system actions
- [ ] **AC-02**: `AuditLogEntry` has `id`, `action`, `timestamp`, `executionId`, `projectKey`, optional `ticketKey`, optional `prNumber`, optional `userId`, `details`
- [ ] **AC-03**: `details` is typed as `Record<string, unknown>` (not `any`)
- [ ] **AC-04**: All interface properties are `readonly`
- [ ] **AC-05**: Zero external dependencies

---

## Reglas del Rulebook

| ID Regla         | Categoria    | Descripcion breve                                              |
| ---------------- | ------------ | -------------------------------------------------------------- |
| [ARCH-SOLID-058] | Arquitectura | Domain layer has zero framework dependencies                   |
| [ARCH-SOLID-202] | TypeScript   | Zero any usage                                                 |
| [ARCH-SOLID-203] | TypeScript   | Interfaces for public data structures                          |
| [SEC-PRIV-010]   | Seguridad    | Audit mechanism records who, what, when, and on which resource |

---

## Contrato Publico (API del modulo)

### Tipos exportados

#### `AuditAction`

- **Proposito**: Identifies the type of auditable action
- **Valores**: `'gate_evaluated' | 'ticket_blocked' | 'ticket_approved' | 'pr_blocked' | 'pr_approved' | 'config_updated' | 'inconsistency_flagged' | 'enforcement_executed'`

#### `AuditLogEntry`

- **Proposito**: Complete audit record for a single system action
- **Propiedades**: `id`, `action: AuditAction`, `timestamp`, `executionId`, `projectKey`, optional `ticketKey`, optional `prNumber`, optional `userId`, `details: Record<string, unknown>`

---

## Dependencias (imports)

### Internas

- None (leaf module)
