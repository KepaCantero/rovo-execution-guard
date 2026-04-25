# Triple Deliverable Pattern

Every production `.ts` file in the Rovo Execution Guard project MUST produce three artifacts. This pattern ensures traceability from requirements through implementation to verification.

## The Three Artifacts

```mermaid
flowchart LR
    REQ[".reqs.md<br/>Requirements sidecar"]
    CODE[".ts<br/>Production code"]
    TEST[".spec.ts<br/>Test file"]

    REQ -.->|"traces ACs to rules"| CODE
    CODE -.->|"verified by"| TEST
    TEST -.->|"validates ACs from"| REQ

    style REQ fill:#9C27B0,color:#fff
    style CODE fill:#FF9800,color:#fff
    style TEST fill:#4CAF50,color:#fff
```

| Artifact        | Extension  | Purpose                                    | Template                              |
| --------------- | ---------- | ------------------------------------------ | ------------------------------------- |
| Requirements    | `.reqs.md` | Maps acceptance criteria to RULEBOOK rules | `.ralph/templates/reqs-template.md`   |
| Production Code | `.ts`      | The actual implementation                  | `.ralph/templates/module-template.ts` |
| Tests           | `.spec.ts` | Unit tests verifying behavior              | `.ralph/templates/spec-template.ts`   |

## Creation Order

The Builder must create artifacts in this specific order:

```mermaid
flowchart TD
    START["Builder receives task"] --> REQ["1. Create .reqs.md"]
    REQ --> CODE["2. Create .ts"]
    CODE --> TEST["3. Create .spec.ts"]
    TEST --> VERIFY["4. Verify"]
    VERIFY --> DONE["Emit review.ready"]

    style REQ fill:#9C27B0,color:#fff
    style CODE fill:#FF9800,color:#fff
    style TEST fill:#4CAF50,color:#fff
    style DONE fill:#607D8B,color:#fff
```

1. **`.reqs.md`** — List requirements from spec, map ACs to RULEBOOK rules
2. **`.ts`** — Implement production code, cite rule IDs in comments
3. **`.spec.ts`** — Write tests for all ACs, cover edge cases
4. **Verify** — Run typecheck + lint + test + format

## File Layout Example

For a module `src/backend/types/errors.ts`, the file structure is:

```
src/backend/types/
├── errors.ts          # Production code
├── errors.spec.ts     # Tests
└── errors.reqs.md     # Requirements sidecar
```

All three files live in the **same directory**.

## Validation Checkpoints

The triple deliverable is verified at multiple points in the pipeline:

```mermaid
flowchart TD
    B_CREATE["Builder: Creates all 3 files"]
    C_CHECK1["Critic: Every .ts has .reqs.md?"]
    C_CHECK2["Critic: Every .ts has .spec.ts?"]
    C_CHECK3["Critic: .reqs.md uses template format?"]
    F_CHECK["Finalizer: All sidecars and tests exist?"]

    B_CREATE --> C_CHECK1
    C_CHECK1 --> C_CHECK2
    C_CHECK2 --> C_CHECK3
    C_CHECK3 --> F_CHECK
    F_CHECK -->|"Yes"| DONE["LOOP_COMPLETE"]
    F_CHECK -->|"No"| REJECT["Reject / finalization.failed"]

    style DONE fill:#4CAF50,color:#fff
    style REJECT fill:#F44336,color:#fff
```

## .reqs.md Structure

Every `.reqs.md` sidecar follows this structure (from `.ralph/templates/reqs-template.md`):

```markdown
# REQUISITOS: [Module Name]

> **Sidecar File** | Vinculado a: [production file path]

## Descripcion

[What this module does]

## Acceptance Criteria

- [ ] **AC-XX**: [criterion description]

## Reglas del Rulebook

| ID Regla  | Categoria  | Descripcion breve |
| --------- | ---------- | ----------------- |
| [RULE-ID] | [Category] | [Description]     |

## Contrato Publico (API del modulo)

[Public interface documentation]

## Dependencias (imports)

### Internas (proyecto)

### Externas (npm)

## Estrategia de Test

### Unit Tests

### Integration Tests

### E2E Tests

## Historial de Cambios

| Fecha | Tarea Ralph | Cambio |
| ----- | ----------- | ------ |
```

## Infrastructure Task Exception

Infrastructure tasks (config files like `manifest.yml`, `package.json`, `tsconfig.json`) do not produce `.spec.ts` test files. Instead, validation is tool-based:

| File Type       | Sidecar             | Validation             |
| --------------- | ------------------- | ---------------------- |
| `manifest.yml`  | `manifest.reqs.md`  | `forge lint`           |
| `package.json`  | —                   | `npm install`          |
| `tsconfig.json` | —                   | `tsc --noEmit`         |
| `.eslintrc.js`  | `.eslintrc.reqs.md` | `npm run lint`         |
| `.prettierrc`   | —                   | `npm run format:check` |
