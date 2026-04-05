---
id: RTASK-026
title: "CI/CD - Semantic Release and Versioning"
status: pending
priority: 3
type: infrastructure
dependencies: [RTASK-004, RTASK-025]
rulebook_refs: [GIT-CI-007, GIT-CI-001]
spec: docs/tickets/TASK-026-cicd-semantic-release.md
---

# RTASK-026: CI/CD - Semantic Release and Versioning

## Objective
Implement automated semantic versioning and release management using semantic-release, ensuring consistent version bumping based on conventional commits and automated changelog generation.

## Context
The project needs a fully automated release pipeline that eliminates manual version management. Semantic release will analyze commit messages following conventional commits specification to determine the next version number, generate changelogs, create GitHub releases, and update all relevant version files across the project.

## Technical Specification

### Configuration File
- `.releaserc.json` at project root

### Plugins
- `@semantic-release/commit-analyzer` - Analyzes commits to determine version bump
- `@semantic-release/release-notes-generator` - Generates release notes from commits
- `@semantic-release/changelog` - Generates and updates `CHANGELOG.md`
- `@semantic-release/npm` - Updates `package.json` version field
- `@semantic-release/github` - Creates GitHub Release with auto-generated notes
- Custom plugin - Updates `manifest.yml` version to match the released version

### Version Rules
- `feat:` commit type triggers a **MINOR** version bump
- `fix:` commit type triggers a **PATCH** version bump
- `BREAKING CHANGE:` in footer triggers a **MAJOR** version bump
- `chore:`, `docs:`, `style:`, `refactor:` commit types trigger **no release**

### Version Tracking
- `.forge-versions.json` file tracking:
  - `current` - the latest released version
  - `lastStable` - the last known stable version
  - Per-environment versions (`dev`, `staging`, `prod`)

## Acceptance Criteria
- [ ] Semantic Release is configured via `.releaserc.json`
- [ ] `feat:` commits generate a MINOR version bump
- [ ] `fix:` commits generate a PATCH version bump
- [ ] `BREAKING CHANGE:` footer generates a MAJOR version bump
- [ ] `CHANGELOG.md` is auto-generated and kept up to date
- [ ] GitHub Release is created with generated release notes
- [ ] `manifest.yml` version is updated on each release
- [ ] `.forge-versions.json` is updated with new version and per-environment tracking
- [ ] `.reqs.md` sidecar file is maintained

## Triple Deliverable
1. **Source**: `.releaserc.json`, custom plugin for `manifest.yml` version sync, `.forge-versions.json` template
2. **Tests**: Verification that commit analysis produces correct version bumps; integration test for full release flow
3. **Documentation**: Release process documentation in `docs/tickets/TASK-026-cicd-semantic-release.md`; updated `.reqs.md` sidecar

## Risks
- Custom plugin for `manifest.yml` may need Forge-specific handling if manifest schema changes
- Breaking change detection depends on strict adherence to conventional commits by all contributors
- `.forge-versions.json` could drift from actual deployed versions if CI pipeline fails mid-release
- GitHub token permissions must allow release creation and tagging

## QA Gates

### Pre-Implementation Gates
- [ ] **GATE-READY**: All dependencies ([RTASK-004, RTASK-025]) are completed
- [ ] **GATE-SPEC**: Rulebook sections GIT-CI-007, GIT-CI-001 have been read and understood
- [ ] **GATE-DESIGN**: Implementation approach documented before coding

### Implementation Gates (per configuration)
- [ ] **GATE-VALIDATE**: Configuration syntax validated before committing
- [ ] **GATE-SECURITY**: No secrets hardcoded in configuration
- [ ] **GATE-IDEMPOTENT**: Release process produces same result on re-run

### Post-Implementation Gates
- [ ] **GATE-LINT**: Configuration files pass validation
- [ ] **GATE-REQS**: All `.reqs.md` sidecar files created and complete
- [ ] **GATE-DRY-RUN**: Semantic release dry-run produces expected version bump

## Requirements Creation Protocol

For each configuration file, the builder MUST create a `.reqs.md` sidecar:

1. **Before implementation**: Create `.reqs.md` listing all requirements from the spec
2. **Format**: Use `.ralph/templates/reqs-template.md` format
3. **Content**: Each requirement maps to an acceptance criterion and rulebook rule
4. **Traceability**: Every AC in the task maps to at least one section in the sidecar
5. **Location**: Sidecar lives adjacent to the configuration file (same directory)

## Implementation Protocol

### Step 1: Preparation
1. Read the full task spec (`docs/tickets/TASK-026-cicd-semantic-release.md`)
2. Read referenced rulebook sections (`docs/rulebook/RULEBOOK.md` → GIT-CI-007, GIT-CI-001)
3. Read all dependency task outputs to understand available interfaces
4. Create `.reqs.md` sidecar files with requirements traceability

### Step 2: Configuration Creation
1. Create `.releaserc.json` with proper plugins and version rules
2. Create custom plugin for `manifest.yml` version sync
3. Create `.forge-versions.json` template
4. Validate JSON syntax

### Step 3: Integration
1. Wire semantic-release into CI/CD pipeline (RTASK-025)
2. Verify version tracking integrates with deploy workflow
3. Ensure `manifest.yml` version is updated on each release

### Step 4: Validation
1. Validate JSON configuration syntax — must pass
2. Run semantic-release dry-run — must produce expected version bump
3. Verify `CHANGELOG.md` generation
4. Confirm GitHub Release creation flow

## Auditing Protocol

### Critic Review Checklist
- [ ] All acceptance criteria verified as implemented
- [ ] No secrets hardcoded in configuration files
- [ ] Version bump rules match conventional commits specification
- [ ] `CHANGELOG.md` auto-generation is configured
- [ ] `manifest.yml` version sync is implemented
- [ ] `.forge-versions.json` template is provided
- [ ] Triple deliverable complete: config + `.reqs.md` + validation
- [ ] No code outside specified file locations (project root)
- [ ] Dependencies only on completed RTASK modules
- [ ] Rulebook rules GIT-CI-007, GIT-CI-001 are satisfied

### Rejection Criteria
The critic MUST reject if:
- Any secret is hardcoded in configuration
- A `.reqs.md` sidecar is missing
- Version bump rules are incorrect
- `CHANGELOG.md` generation is not configured
- `manifest.yml` version sync is missing
- External dependencies were added without approval

## Testing Protocol

### Release Configuration Validation
- **No unit tests for configuration files** — validated by dry-run
- Location: Project root (`.releaserc.json`)
- Validation approach: Semantic release dry-run

### Validation Categories Required
- [ ] **feat:** commits generate a MINOR version bump
- [ ] **fix:** commits generate a PATCH version bump
- [ ] **BREAKING CHANGE:** footer generates a MAJOR version bump
- [ ] **chore/docs/style/refactor:** commit types trigger no release
- [ ] `CHANGELOG.md` is auto-generated
- [ ] GitHub Release is created with generated release notes
- [ ] `manifest.yml` version is updated on each release
