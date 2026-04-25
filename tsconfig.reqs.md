# REQUISITOS: tsconfig.json

> **Sidecar File** | Vinculado a: `tsconfig.json`

---

## Descripcion

TypeScript compiler configuration for Rovo Execution Guard. Establishes strict type checking, module resolution, JSX support, and path aliases for clean imports across backend, frontend, and shared code.

---

## Acceptance Criteria

- [x] **AC-03**: `strict: true` and `noUncheckedIndexedAccess: true` enabled
- [x] **AC-05**: `npm run typecheck` passes (zero errors)
- [x] **AC-10**: Sidecar `tsconfig.reqs.md` created

---

## Reglas del Rulebook

| ID Regla         | Categoria    | Descripcion breve                            |
| ---------------- | ------------ | -------------------------------------------- |
| [ARCH-SOLID-003] | Arquitectura | Strict typing, no any, explicit return types |
| [TEST-QA-010]    | Testing/QA   | Typecheck must pass before merge             |

---

## Configuration Details

### Compiler Options

| Option                           | Value     | Purpose                                        |
| -------------------------------- | --------- | ---------------------------------------------- |
| target                           | ES2022    | Modern JavaScript output                       |
| module                           | ESNext    | Latest module system                           |
| moduleResolution                 | bundler   | Resolve imports via bundler                    |
| jsx                              | react-jsx | React 18 JSX transform                         |
| strict                           | true      | Enable all strict checks                       |
| noUncheckedIndexedAccess         | true      | Force index access null checks                 |
| noImplicitReturns                | true      | All code paths must return                     |
| forceConsistentCasingInFileNames | true      | Case-sensitive imports                         |
| esModuleInterop                  | true      | ESM/CJS interop                                |
| skipLibCheck                     | true      | Skip .d.ts checks for speed                    |
| resolveJsonModule                | true      | Allow JSON imports                             |
| isolatedModules                  | true      | Ensure each file is independently transpilable |

### Path Aliases

| Alias         | Path                     | Usage                    |
| ------------- | ------------------------ | ------------------------ |
| @domain/\*    | src/backend/\*           | Domain types and models  |
| @services/\*  | src/backend/services/\*  | Business logic services  |
| @resolvers/\* | src/backend/resolvers/\* | Forge resolver functions |
| @frontend/\*  | src/frontend/\*          | UI components            |
| @shared/\*    | src/frontend/shared/\*   | Shared UI utilities      |

### Include/Exclude

| Setting | Value                  |
| ------- | ---------------------- |
| include | src/**/\*, tests/**/\* |
| exclude | node_modules, coverage |

---

## Estrategia de Test

- Validated by: `npm run typecheck` (tsc --noEmit)
- No unit tests — config file validation is tool-based

---

## Historial de Cambios

| Fecha      | Tarea Ralph | Cambio                                                                               |
| ---------- | ----------- | ------------------------------------------------------------------------------------ |
| 2026-04-05 | RTASK-003   | Updated from RTASK-001 base: added isolatedModules, updated include/exclude per spec |
