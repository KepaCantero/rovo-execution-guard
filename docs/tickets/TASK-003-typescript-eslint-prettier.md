# TASK-003: TypeScript Config, ESLint, Prettier

## Objetivo
Configurar el tooling de calidad de codigo: TypeScript estricto, ESLint con reglas exhaustivas y Prettier para formateo consistente.

## Contexto
Estas herramientas son la primera linea de defensa contra codigo de baja calidad. Deben configurarse antes de escribir cualquier linea de codigo de produccion.

## Especificacion Tecnica

### TypeScript (tsconfig.json)
- `strict: true` (habilita noImplicitAny, strictNullChecks, etc.)
- `target: ES2022`
- `moduleResolution: bundler`
- `jsx: react-jsx`
- Path aliases: `@domain/*`, `@services/*`, `@resolvers/*`, `@frontend/*`, `@shared/*`
- `noUncheckedIndexedAccess: true`
- `exactOptionalPropertyTypes: false` (pragmatico)
- `noImplicitReturns: true`
- `forceConsistentCasingInFileNames: true`

### ESLint (.eslintrc.js)
- Parser: `@typescript-eslint/parser`
- Extends:
  - `eslint:recommended`
  - `plugin:@typescript-eslint/recommended`
  - `plugin:@typescript-eslint/strict`
  - `plugin:react/recommended`
  - `plugin:react-hooks/recommended`
  - `plugin:forge/recommended` (si existe)
- Reglas custom:
  - `no-console: warn` (usar logger)
  - `no-any: error`
  - `max-complexity: 10`
  - `no-duplicate-imports: error`

### Prettier (.prettierrc)
- `singleQuote: true`
- `trailingComma: all`
- `printWidth: 100`
- `tabWidth: 2`
- `semi: true`

### npm scripts
- `lint`: Ejecutar ESLint en todo `src/`
- `lint:fix`: Autofix
- `format`: Prettier en todo `src/`
- `typecheck`: `tsc --noEmit`

## Acceptance Criteria
- [ ] AC-01: `npm run lint` ejecuta ESLint sin errores en el esqueleto
- [ ] AC-02: `npm run typecheck` pasa sin errores
- [ ] AC-03: `npm run format` formatea correctamente
- [ ] AC-04: ESLint bloquea uso de `any`
- [ ] AC-05: TypeScript strict mode habilitado y verificado
- [ ] AC-06: Zero warnings en `forge lint`

## Reglas del Rulebook
- **[ARCH-SOLID-003]**: TypeScript estricto obligatorio
- **[TEST-QA-010]**: Zero warnings en ESLint

## Estrategia de Test
- **Unit**: N/A (tooling config)
- **Integration**: `npm run lint` + `npm run typecheck` pasan
- **E2E**: N/A

## Dependencias
- TASK-001 (package.json con dependencias instaladas)

## Estado: PENDIENTE
