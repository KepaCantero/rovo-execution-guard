# Forge Migration Rules

This directory contains comprehensive rules derived from the Atlassian App Migration Platform documentation for Forge migrations.

## Rule Files

Each file contains 25 rules covering different aspects of Forge migration:

1. **automated-migration-for-forge.mdc** - Overview of automated migration process, pre-migration setup, migration execution, and data management
2. **prepare-server-app-forge.mdc** - Server app preparation, listener implementation, data export, and mapping retrieval
3. **prepare-cloud-app-forge.mdc** - Cloud app preparation, event handling, migration API usage, and error handling
4. **forge-storage-key-value-custom-entity-store.mdc** - Forge Storage migration paths, auto-import, and data transformers
5. **forge-migration-api.mdc** - Migration API methods, mapping retrieval, app data access, and event acknowledgement
6. **export-app-data.mdc** - Data export strategies, cloud storage access, timing limits, and processing strategies
7. **report-progress-forge.mdc** - Progress reporting components, vendor messages, transfer settlement, and progress calculation
8. **data-transformers.mdc** - Data transformer usage, MriIdMapping transformer, and transformation best practices
9. **retrieve-data-mappings.mdc** - Mapping retrieval from server and cloud, namespaces, pagination, and error handling
10. **dev-mode.mdc** - Dev mode configuration, testing workflow, and production readiness
11. **trigger-app-migration.mdc** - Trigger method usage, scope restriction, and testing workflows
12. **migration-path-readiness-checklist.mdc** - Migration path types, progress reporting, publishing, and verification
13. **roa-migration-without-bps.mdc** - RoA-specific migration rules without BPS (Batch Processing Service)
14. **roa-data-migration-forge-native.mdc** - Comprehensive Forge-native implementation rules for RoA data migration (Async Events API, Migration Platform API, KVS, chunking, progressive acknowledgment, cyclic invocation)
15. **migration-implementation-requirements.mdc** - Additional implementation requirements covering migration types and transformations, rate limits and back pressure, DMS integration, status storage and visualization, real-time migration, and temporary solution considerations (MIG-IMP-001 through MIG-IMP-033)

## Usage

These rules are designed for:

- **Auditing**: Review migration implementations against best practices
- **Designing**: Guide migration architecture and implementation decisions
- **Implementing**: Ensure correct implementation of migration features

## Source Documentation

All rules are derived from: https://developer.atlassian.com/platform/app-migration/

## Rule Categories

Rules cover:

- Pre-migration setup and configuration
- RoA-specific constraints (no BPS availability)
- Large-scale processing without external infrastructure
- Migration execution and event handling
- Data export and import strategies
- Error handling and retry logic
- Progress reporting and status management
- Testing and validation approaches
- Production readiness and publishing
