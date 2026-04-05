# Índice de Reglas BPS In-Place Migration

**Total de Reglas Extraídas:** 36 reglas (MIG-BPS-001 a MIG-BPS-036)

**Fuente:** Análisis del documento GitHub README `migration/cof/README.md`

## Resumen por Categoría

### Migration Strategy Rules (5 reglas)
- **MIG-BPS-001:** In-Place Migration Approach
- **MIG-BPS-002:** Zero Data Migration Requirement
- **MIG-BPS-003:** Versioning Strategy
- **MIG-BPS-004:** Parallel Support Period
- **MIG-BPS-005:** New Installations Policy

### Idempotency Rules (1 regla)
- **MIG-BPS-006:** Idempotency Requirement (CRITICAL)

### Batch Migration Rules (4 reglas)
- **MIG-BPS-007:** Batch Migration Prerequisites
- **MIG-BPS-008:** Batch Migration Iteration Strategy
- **MIG-BPS-009:** BPS for Batch Migration
- **MIG-BPS-010:** Manual Control and Retry

### On-Change Migration Rules (3 reglas)
- **MIG-BPS-011:** On-Change Migration Strategy
- **MIG-BPS-012:** Change Capture Process
- **MIG-BPS-013:** Migration Queue Architecture

### Web Trigger Rules (4 reglas)
- **MIG-BPS-014:** Hourly Scheduled Trigger (URL Registration)
- **MIG-BPS-015:** Static Webtrigger (No Data Egress)
- **MIG-BPS-016:** Dynamic Webtrigger (With Data Egress)
- **MIG-BPS-017:** URL Registration Flow

### Migration Architecture Rules (4 reglas)
- **MIG-BPS-018:** CoF Application Database Writes
- **MIG-BPS-019:** Batch Migration Flow
- **MIG-BPS-020:** On-Change Migration Flow
- **MIG-BPS-021:** Validation Flow

### Entity Migration Rules (3 reglas)
- **MIG-BPS-022:** Entities to be Migrated
- **MIG-BPS-023:** Data Sources for Migration
- **MIG-BPS-024:** Data Transformations Required

### SQL Table Provisioning Rules (1 regla)
- **MIG-BPS-025:** SQL Table Provisioning in CoF

### Migration Monitoring Rules (2 reglas)
- **MIG-BPS-026:** Migration Monitoring & Iteration
- **MIG-BPS-027:** Logging and Monitoring Setup

### Testing Rules (1 regla)
- **MIG-BPS-028:** Idempotency Testing

### Strategy Coordination Rules (1 regla)
- **MIG-BPS-029:** Batch and On-Change Strategy Coordination

### Web Trigger Constraints (1 regla)
- **MIG-BPS-030:** Static Webtrigger Constraints

### Versioning Constraints (1 regla)
- **MIG-BPS-031:** Minor Version Constraints

### Migration Phases (1 regla)
- **MIG-BPS-032:** Migration Phase Requirements

### Risk Mitigation Rules (2 reglas)
- **MIG-BPS-033:** Technical Risk Mitigation
- **MIG-BPS-034:** Business Risk Mitigation

### Data Residency Rules (1 regla)
- **MIG-BPS-035:** Data Residency Support

### Data Egress Control Rules (1 regla)
- **MIG-BPS-036:** Data Egress Control

## Reglas Críticas (Prioridad Alta)

1. **MIG-BPS-006:** Idempotency Requirement (CRITICAL)
2. **MIG-BPS-030:** Static Webtrigger Constraints (5s timeout, ~1MB payload)
3. **MIG-BPS-002:** Zero Data Migration Requirement
4. **MIG-BPS-001:** In-Place Migration Approach
5. **MIG-BPS-008:** Batch Migration Iteration Strategy (exhaustive iteration)

## Referencias

- **Archivo Completo:** `.cursor/rules/forge/migration/bps-in-place-migration-rules.mdc`
- **Análisis Comparativo:** `.cursor/ANALYSIS-migration-approaches.md`
- **Fuente Original:** GitHub README `migration/cof/README.md`
