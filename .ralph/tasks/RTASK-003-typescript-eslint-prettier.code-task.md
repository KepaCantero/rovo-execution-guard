---
id: RTASK-003
title: "TypeScript Config, ESLint, Prettier"
status: pending
priority: 2
type: infrastructure
dependencies: [RTASK-001]
rulebook_refs: [ARCH-SOLID-003, TEST-QA-010]
spec: docs/tickets/TASK-003-typescript-eslint-prettier.md
---

# RTASK-003: TypeScript Config, ESLint, Prettier

## Objective

Configure the quality tooling trio: TypeScript strict mode, ESLint with strict rules (zero `any`), and Prettier for consistent formatting. These are the foundation of code quality — every subsequent task depends on these tools being correctly configured.

## Context

RTASK-001 created `tsconfig.json` (base), `package.json`, and installed dependencies. Now we need to configure the actual tooling with strict settings. ESLint and Prettier must not conflict.

## Technical Specification

### 1. `tsconfig.json` (update from RTASK-001)
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitReturns": true,
    "forceConsistentCasingInFileNames": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "baseUrl": ".",
    "paths": {
      "@domain/*": ["src/backend/*"],
      "@services/*": ["src/backend/services/*"],
      "@resolvers/*": ["src/backend/resolvers/*"],
      "@frontend/*": ["src/frontend/*"],
      "@shared/*": ["src/frontend/shared/*"]
    }
  },
  "include": ["src/**/*", "tests/**/*"],
  "exclude": ["node_modules", "coverage"]
}
```

### 2. `.eslintrc.js`
- Parser: `@typescript-eslint/parser`
- Extends: `eslint:recommended`, `plugin:@typescript-eslint/recommended`, `plugin:@typescript-eslint/strict`, `plugin:react/recommended`, `plugin:react-hooks/recommended`, `prettier` (disables conflicting rules)
- Key rules: `no-explicit-any: error`, `complexity: [error, 10]`, `no-console: warn`, `explicit-function-return-type: [warn, {allowExpressions: true}]`
- Settings: `react: {version: detect}`, `import/resolver: {typescript: {}}`

### 3. `.prettierrc`
```json
{
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2,
  "semi": true,
  "arrowParens": "always"
}
```

### 4. Ignore files
- `.eslintignore`: `node_modules`, `coverage`
- `.prettierignore`: `node_modules`, `coverage`, `.git`

### 5. npm scripts (add to package.json)
- `lint`: `eslint 'src/**/*.{ts,tsx}'`
- `lint:fix`: `eslint 'src/**/*.{ts,tsx}' --fix`
- `format`: `prettier --write 'src/**/*.{ts,tsx,json,md}'`
- `format:check`: `prettier --check 'src/**/*.{ts,tsx,json,md}'`
- `typecheck`: `tsc --noEmit`

## Acceptance Criteria

- [ ] AC-01: `.eslintrc.js` exists and extends `prettier` (no conflicts)
- [ ] AC-02: `.prettierrc` exists with specified config
- [ ] AC-03: `tsconfig.json` has `strict: true` and `noUncheckedIndexedAccess: true`
- [ ] AC-04: `npm run lint` executes without crash
- [ ] AC-05: `npm run typecheck` passes
- [ ] AC-06: `npm run format:check` passes on existing code
- [ ] AC-07: No ESLint/Prettier conflicts (both pass together)
- [ ] AC-08: `@typescript-eslint/no-explicit-any` is `error` (not warn)
- [ ] AC-09: `eslint-config-prettier` in devDependencies
- [ ] AC-10: Sidecars created: `.eslintrc.reqs.md`, `tsconfig.reqs.md`

## Triple Deliverable

Config files get sidecars, not .spec.ts:

| File | Sidecar |
|------|---------|
| `.eslintrc.js` | `.eslintrc.reqs.md` |
| `.prettierrc` | (included in eslint sidecar) |
| `tsconfig.json` | `tsconfig.reqs.md` |

## Risks

| Risk | Mitigation |
|------|------------|
| ESLint + Prettier conflicts | `eslint-config-prettier` disables conflicting rules |
| Path aliases not resolved by ESLint | `eslint-import-resolver-typescript` configured |
| Too many strict errors initially | Only .gitkeep files exist, so no real code to error on |

## QA Gates

### Pre-Implementation Gates
- [ ] **GATE-READY**: All dependencies (RTASK-001) are completed
- [ ] **GATE-SPEC**: Rulebook sections ARCH-SOLID-003, TEST-QA-010 have been read and understood
- [ ] **GATE-DESIGN**: Implementation approach documented before coding

### Implementation Gates (per file/function)
- [ ] **GATE-RED**: Write failing test FIRST for each function/component
- [ ] **GATE-GREEN**: Write minimum code to make test pass
- [ ] **GATE-REFACTOR**: Clean up code while keeping tests green

### Post-Implementation Gates
- [ ] **GATE-TYPECHECK**: `npm run typecheck` passes with zero errors
- [ ] **GATE-LINT**: `npm run lint` passes with zero warnings
- [ ] **GATE-FORMAT**: `npm run format:check` passes
- [ ] **GATE-TEST**: `npm run test:unit` passes with coverage > N/A (config files)
- [ ] **GATE-REQS**: All `.reqs.md` sidecar files created and complete
- [ ] **GATE-ZERO-ANY**: `grep -r "any" src/` returns zero results (no `any` types)

## Requirements Creation Protocol

For each production file, the builder MUST create a `.reqs.md` sidecar:

1. **Before implementation**: Create `.reqs.md` listing all requirements from the spec
2. **Format**: Use `.ralph/templates/reqs-template.md` format
3. **Content**: Each requirement maps to an acceptance criterion and rulebook rule
4. **Traceability**: Every AC in the task maps to at least one section in the sidecar
5. **Location**: Sidecar lives adjacent to the production file (same directory)

## Implementation Protocol

### Step 1: Preparation
1. Read the full task spec (`docs/tickets/TASK-003-typescript-eslint-prettier.md`)
2. Read referenced rulebook sections (`docs/rulebook/RULEBOOK.md` → ARCH-SOLID-003, TEST-QA-010)
3. Read all dependency task outputs to understand available interfaces
4. Create `.reqs.md` sidecar files with requirements traceability

### Step 2: TDD Cycle (per function/component)
1. **RED**: Write a failing test that defines expected behavior
2. **GREEN**: Write the minimum code to make the test pass
3. **REFACTOR**: Clean up while keeping all tests green
4. Repeat for next function/component

### Step 3: Integration
1. Wire components together
2. Add integration-level tests if applicable
3. Verify all exports are accessible from barrel files

### Step 4: Validation
1. Run `npm run typecheck` — must pass
2. Run `npm run lint` — must pass with zero warnings
3. Run `npm run format:check` — must pass
4. Run `npm run test:unit` — must pass
5. Verify zero `any` usage

## Auditing Protocol

### Critic Review Checklist
- [ ] All acceptance criteria verified as implemented
- [ ] No `any` types anywhere in new code
- [ ] All interfaces use `readonly` properties
- [ ] Error handling follows hierarchy (REGError → domain errors)
- [ ] Structured logging with `executionId` on all operations
- [ ] No hardcoded secrets, tokens, or credentials
- [ ] Input validation on all external-facing functions
- [ ] Triple deliverable complete: `.ts` + `.reqs.md` + `.spec.ts`
- [ ] No code outside specified file locations
- [ ] Dependencies only on completed RTASK modules
- [ ] Rulebook rules ARCH-SOLID-003, TEST-QA-010 are satisfied

### Rejection Criteria
The critic MUST reject if:
- Any `any` type is present
- Coverage is below the required threshold (N/A — config files)
- A `.reqs.md` sidecar is missing
- A `.spec.ts` test file is missing (where applicable)
- Structured logging is absent
- Error handling is missing or generic (`catch (e) { }`)
- External dependencies were added without approval

## Testing Protocol

### Config Validation
- Config files: .eslintrc.js, .prettierrc, tsconfig.json (update)
- Validated by: `npm run lint`, `npm run typecheck`, `npm run format:check`
- Task type: infrastructure (config files)
- No unit tests required — validation is tool-based

### Validation Checklist
- [ ] `npm run lint` executes without crash
- [ ] `npm run typecheck` passes
- [ ] `npm run format:check` passes on existing code
- [ ] No ESLint/Prettier conflicts (both pass together)
- [ ] `@typescript-eslint/no-explicit-any` is `error` (not warn)
