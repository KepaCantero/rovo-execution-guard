# Forge Platform Rules

This directory contains comprehensive rules derived from the Atlassian Forge platform documentation.

## Rule Files

Each file contains 25 rules covering different aspects of Forge development:

### Getting Started

- **getting-started/getting-started-with-forge.mdc** - Setup, CLI installation, authentication, and development workflow

### Platform Overview

- **about-forge-platform.mdc** - Platform overview, security, UI options, storage, and adoption

### Manifest and Modules

- **manifest-reference.mdc** - Manifest structure, required/optional properties, runtime configuration, packaging
- **function-module.mdc** - Function definition, timeout configuration, provider setup, implementation
- **trigger-module.mdc** - Event-based triggers, filtering, error handling, event types

### Storage

- **key-value-store.mdc** - Key-value storage basics, queries, consistency, key design, security
- **custom-entities.mdc** - Custom entity definition, attributes, indexes, deployment, management
- **forge-storage-sdk.mdc** - Appfire Forge Storage SDK usage for KVS and Custom Entity Store in native and remote environments

### Product APIs

- **forge-backend-product-apis.mdc** - Appfire Forge Backend SDK for Product APIs (Confluence v1/v2, Jira v2/v3, JSM, Jira Software) with authentication contexts, error handling, and best practices

### Workflow Orchestration

- **forge-fork-join-sdk.mdc** - Appfire Forge Fork-Join SDK for workflow orchestration, long-running task management, DAG processing, queue-based and direct execution modes, retry mechanisms, and rate limiting

### Data Migration Service

- **dms-backoffice-app.mdc** - Data Migration Service (DMS) Backoffice App rules for Jira Forge app with global screen UI, including app registration, migration management, tenant installations management, migration details display, and integration with Installation Service, Token Repository Service, and Migration Service

### Platform Updates

- **forge-changelog.mdc** - Changelog rules, breaking changes, new features, deprecations, EAP features

## Usage

These rules are designed for:

- **Auditing**: Review Forge implementations against best practices
- **Designing**: Guide Forge app architecture and implementation decisions
- **Implementing**: Ensure correct implementation of Forge features

## Source Documentation

All rules are derived from:

- https://developer.atlassian.com/platform/forge/getting-started/
- https://developer.atlassian.com/platform/forge/
- https://developer.atlassian.com/platform/forge/manifest-reference/
- https://developer.atlassian.com/platform/forge/runtime-reference/
- https://developer.atlassian.com/platform/forge/changelog/

## Rule Categories

Rules cover:

- Development environment setup
- CLI installation and authentication
- Manifest configuration
- Function and trigger modules
- Storage options (KVS, Custom Entities)
- Security and best practices
- Deployment and management
- Platform updates and changelog tracking
- Breaking changes and deprecations
- EAP and Preview features
