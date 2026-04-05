---
id: RTASK-002
title: "Rulebook Consolidated — Merge books/, links/ and rules/ into docs/rulebook/"
status: pending
priority: 1
type: documentation
dependencies: []
rulebook_refs: []
spec: docs/tickets/TASK-002-rulebook.md
sources:
  - docs/runbooks/books/ (50 books, RB-XXX codes)
  - docs/runbooks/links/ (50+ links, RB-XXX codes)
  - docs/runbooks/rules/ (rules from similar Forge project, .mdc format)
---

# RTASK-002: Rulebook Consolidated — Merge books/, links/ and rules/ into docs/rulebook/

## Objective

Consolidate three existing rule sources (`books/`, `links/`, `rules/`) into a single canonical rulebook under `docs/rulebook/`. The result must be one unified structure using the folder organization from `rules/` and the code system (`RB-XXX`) from `books/` and `links/`. After consolidation, `docs/runbooks/` must be eliminated — zero duplication, single source of truth.

## Context

Three independent rule collections exist in `docs/runbooks/`:

1. **`books/`** — 50 book-derived rules organized by category (engineering, devops, strategy, culture, ai-future). Each file uses `RB-XXX` codes. Format: `DEFINICION / VALOR / IMPLEMENTACION / AUDITORIA`.
2. **`links/`** — 50+ link-derived rules organized by topic (forge, github-devops, root). Each file uses `RB-XXX` codes. Same format as books.
3. **`rules/`** — Rules from a similar Atlassian Forge project, in `.mdc` format (YAML frontmatter `alwaysApply: true`). Organized by thematic folders (forge/, engineering/, typescript/, javascript/, api-design/, oop-design/, error-handling-logging/, integration-testing/, technical-specifications/, confluence-api/, team/roles/, team/workflows/). These rules do NOT have `RB-XXX` codes.

The canonical `docs/rulebook/RULEBOOK.md` is currently a skeleton with 0 rules and 8 empty categories.

## Technical Specification

### Phase 1: Restructure — Move and Merge Files

Move ALL content from `docs/runbooks/` into `docs/rulebook/` following the folder system from `rules/`. Target structure:

```
docs/rulebook/
  RULEBOOK.md                          ← Master index (updated with all rules)
  sources/
    books/                             ← From docs/runbooks/books/
      engineering/                     ← RB-051 to RB-065
        RB-051-clean-code.md
        RB-052-pragmatic-programmer.md
        ...
      devops/                          ← RB-066 to RB-070
      strategy/                        ← RB-076 to RB-085, RB-100
      culture/                         ← RB-086 to RB-096
      ai-future/                       ← RB-071 to RB-075, RB-097 to RB-099
    links/                             ← From docs/runbooks/links/
      forge/                           ← RB-001 to RB-013
      github-devops/                   ← RB-014 to RB-020
      general/                         ← RB-021 to RB-050, RB-SEC-001, forge-platform-limits
    rules/                             ← From docs/runbooks/rules/ (converted to .md)
      forge/                           ← Forge platform rules
        getting-started/
        migration/
      engineering/                     ← Software engineering rules
      typescript/                      ← TypeScript-specific rules
      javascript/                      ← JavaScript rules
      api-design/                      ← API design rules
      oop-design/                      ← OOP/Design pattern rules
      error-handling-logging/          ← Error handling and logging rules
      integration-testing/             ← Integration testing rules
      technical-specifications/        ← Tech spec writing rules
      confluence-api/                  ← Confluence API rules
      team/                            ← Team roles and workflows
        roles/
        workflows/
```

### Phase 2: Convert .mdc → .md and Apply RB-XXX Codes

Every `.mdc` file from `rules/` must be:
1. Converted to `.md` format
2. Strip YAML frontmatter (`alwaysApply: true`) — not needed in rulebook
3. Assigned a `RB-XXX` code following the existing numbering scheme:
   - `RB-001` to `RB-013`: Forge links (already assigned)
   - `RB-014` to `RB-020`: GitHub/DevOps links (already assigned)
   - `RB-021` to `RB-050`: General links (already assigned)
   - `RB-051` to `RB-065`: Engineering books (already assigned)
   - `RB-066` to `RB-070`: DevOps books (already assigned)
   - `RB-071` to `RB-100`: Remaining books (already assigned)
   - `RB-101+`: NEW codes for rules from `rules/` that don't overlap with existing content
4. If a rule from `rules/` duplicates content already covered by a `books/` or `links/` rule, merge into the existing `RB-XXX` file — do NOT create a duplicate
5. Rules from `rules/` that are specific to the OTHER project (Confluence workflow automation) must be ADAPTED to Rovo Execution Guard context, or discarded if not applicable

### Phase 3: Update RULEBOOK.md Master Index

Rewrite `docs/rulebook/RULEBOOK.md` as the master index containing:
1. **Header** — Project name, last update date, total rule count
2. **Priority Hierarchy** — Conflict resolution order (same as current)
3. **Rule Format Definition** — DEFINICION / VALOR / IMPLEMENTACION / AUDITORIA
4. **Table of Contents** — 8 categories with links to source files
5. **Category Sections** — Each category lists:
   - Source files (books, links, rules) with RB-XXX codes
   - Extracted top-level rules with IDs in `[CATEGORY]-[NUM]` format
   - Cross-references to source files for full detail
6. **Conflict Resolution Index** — Document any contradictions found during merge
7. **Statistics Table** — Updated counts per category

### Phase 4: Cleanup

1. Delete entire `docs/runbooks/` directory
2. Update any references to `docs/runbooks/` in:
   - `ralph.yml` (guardrails, hat instructions)
   - All RTASK files that reference `docs/runbooks/`
   - Architecture docs in `docs/architecture/`
3. Verify no broken references remain

### Deduplication Rules

When merging, apply these principles:
- **Exact duplicate**: Keep the version with richer IMPLEMENTACION/AUDITORIA detail, discard the other
- **Partial overlap**: Merge into single file, combine unique elements from both
- **Complementary**: Keep both, assign to appropriate category folder
- **Project-specific** (from the other Forge project): Adapt to Rovo Execution Guard context, or discard if not relevant

### What to Keep from `rules/`

Keep and adapt rules that apply to Rovo Execution Guard:
- Forge platform rules (forge/, forge/getting-started/, forge/migration/)
- TypeScript standards (typescript/)
- JavaScript standards (javascript/)
- Engineering patterns (engineering/)
- API design (api-design/)
- OOP/Design patterns (oop-design/)
- Error handling and logging (error-handling-logging/)
- Integration testing (integration-testing/)
- Technical specifications (technical-specifications/)

Discard or heavily adapt rules that are ONLY about:
- Confluence workflow automation specifics (not our domain)
- DMS Backoffice App (not our app)
- Forge SQL / TiDB (we use Forge Storage KVS)

### What to Keep from `team/roles/` and `team/workflows/`

The `team/` folder contains role definitions (implementer, planner, critic, etc.) and workflow rules from the other project. Review and:
- Keep general-purpose role definitions that align with Ralph's hat system
- Discard role definitions that conflict with our Ralph configuration
- Keep workflow patterns that apply to our TDD cycle

## Acceptance Criteria

- [ ] AC-01: All content from `docs/runbooks/` moved to `docs/rulebook/` — nothing lost
- [ ] AC-02: Folder structure follows `rules/` organization (thematic folders)
- [ ] AC-03: All files use `RB-XXX` code system — no file lacks a code
- [ ] AC-04: All `.mdc` files converted to `.md` format
- [ ] AC-05: `RULEBOOK.md` populated as master index with all rules referenced
- [ ] AC-06: Statistics table updated with actual rule counts (not all zeros)
- [ ] AC-07: Zero duplicate content — no rule exists in two files
- [ ] AC-08: Zero references to `docs/runbooks/` anywhere in the project
- [ ] AC-09: `docs/runbooks/` directory deleted
- [ ] AC-10: Rules from other project adapted to Rovo Execution Guard context
- [ ] AC-11: `RULEBOOK.reqs.md` sidecar created
- [ ] AC-12: Validation script `scripts/validate-rulebook.ts` updated for new structure

## Triple Deliverable

| Production | Sidecar | Test |
|------------|---------|------|
| `docs/rulebook/RULEBOOK.md` | `docs/rulebook/RULEBOOK.reqs.md` | `scripts/validate-rulebook.ts` |
| `docs/rulebook/sources/**/*` | — | Validated by directory structure check |

## Risks

| Risk | Mitigation |
|------|------------|
| Rules from other project not applicable | Discard or adapt — do not force-fit irrelevant rules |
| Duplicate rules across books/links/rules | Dedup by content comparison, keep richer version |
| RB-XXX code collisions | New rules from `rules/` start at RB-101+ |
| Breaking references in RTASK files | Grep all references and update before deleting runbooks/ |
| MDC format incompatibility | Convert to standard markdown, strip YAML frontmatter |

## QA Gates

### Pre-Implementation Gates
- [ ] **GATE-READY**: No dependencies (root task)
- [ ] **GATE-SPEC**: Current content of books/, links/, rules/ fully cataloged
- [ ] **GATE-DESIGN**: Target folder structure documented (this file serves as design)

### Implementation Gates (per phase)
- [ ] **GATE-PHASE1**: All files moved to correct folders under `docs/rulebook/`
- [ ] **GATE-PHASE2**: All .mdc converted, all RB-XXX codes assigned
- [ ] **GATE-PHASE3**: RULEBOOK.md master index complete and accurate
- [ ] **GATE-PHASE4**: docs/runbooks/ deleted, all references updated

### Post-Implementation Gates
- [ ] **GATE-TYPECHECK**: `npm run typecheck` passes (if validation script exists)
- [ ] **GATE-LINT**: `npm run lint` passes with zero warnings
- [ ] **GATE-FORMAT**: `npm run format:check` passes
- [ ] **GATE-TEST**: `scripts/validate-rulebook.ts` passes all checks
- [ ] **GATE-REQS**: `docs/rulebook/RULEBOOK.reqs.md` sidecar created
- [ ] **GATE-ZERO-DUP**: No duplicate content across any rulebook files
- [ ] **GATE-ZERO-REFS**: `grep -r "docs/runbooks" .ralph/ docs/ ralph.yml` returns zero results

## Requirements Creation Protocol

1. **Before implementation**: Create `docs/rulebook/RULEBOOK.reqs.md` with all requirements
2. **Format**: Use `.ralph/templates/reqs-template.md` format
3. **Content**: Each AC maps to a verifiable requirement
4. **Traceability**: Every source file (books, links, rules) tracked in the sidecar

## Implementation Protocol

### Step 1: Catalog
1. Read ALL files in `docs/runbooks/books/` — catalog every RB-XXX code
2. Read ALL files in `docs/runbooks/links/` — catalog every RB-XXX code
3. Read ALL files in `docs/runbooks/rules/` — catalog every rule and its applicability
4. Build a complete inventory: code, title, category, applicable (yes/no/adaptive)

### Step 2: Plan Folder Mapping
1. Map each `books/` file to target location in `docs/rulebook/sources/books/`
2. Map each `links/` file to target location in `docs/rulebook/sources/links/`
3. Map each `rules/` file to target location in `docs/rulebook/sources/rules/`
4. Assign RB-101+ codes to `rules/` files that need new codes
5. Identify duplicates and plan merges

### Step 3: Execute Move and Convert
1. Create target directory structure under `docs/rulebook/sources/`
2. Move `books/` files (keep format, keep RB-XXX codes)
3. Move `links/` files (keep format, keep RB-XXX codes)
4. Convert and move `rules/` files (.mdc → .md, assign RB-XXX codes)
5. Merge duplicate content — keep richer version

### Step 4: Update RULEBOOK.md
1. Rewrite master index with all categories populated
2. Add cross-references to source files
3. Update statistics table with actual counts
4. Add Conflict Resolution Index entries for any contradictions found

### Step 5: Cleanup
1. Delete `docs/runbooks/` directory
2. Update all references in project files
3. Run validation script
4. Verify zero broken references

## Auditing Protocol

### Critic Review Checklist
- [ ] No content lost during migration (compare file counts before/after)
- [ ] No duplicate files or content remain
- [ ] All RB-XXX codes are unique across the entire rulebook
- [ ] RULEBOOK.md accurately indexes all source files
- [ ] Statistics table matches actual file/rule counts
- [ ] No references to `docs/runbooks/` remain
- [ ] Rules from other project properly adapted (not copy-pasted)
- [ ] Folder structure matches the specification above
- [ ] All .mdc files converted to .md

### Rejection Criteria
The critic MUST reject if:
- Any file from `docs/runbooks/` was lost without explicit documentation
- Duplicate content exists in multiple files
- RULEBOOK.md still shows 0 rules
- `docs/runbooks/` still exists
- Any reference to `docs/runbooks/` remains in project files
- RB-XXX code collisions exist

## Testing Protocol

### Structure Validation
- [ ] `docs/rulebook/sources/books/` exists with all 5 subcategories
- [ ] `docs/rulebook/sources/links/` exists with 3 subcategories
- [ ] `docs/rulebook/sources/rules/` exists with thematic folders
- [ ] Total file count >= original count minus discarded files (documented)

### Content Validation
- [ ] Every .md file under `docs/rulebook/sources/` has an RB-XXX code in filename
- [ ] No `.mdc` files remain anywhere under `docs/rulebook/`
- [ ] RULEBOOK.md statistics table has non-zero counts
- [ ] `scripts/validate-rulebook.ts` passes

### Reference Validation
- [ ] `grep -r "docs/runbooks" .ralph/ docs/ ralph.yml` returns nothing
- [ ] `grep -r "docs/runbooks" src/ tests/ scripts/` returns nothing
