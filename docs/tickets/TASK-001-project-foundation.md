# TASK-001: Project Foundation and Forge Manifest

## Objetivo
Establecer la base del proyecto Rovo Execution Guard: configurar el `manifest.yml` de Forge multi-entorno, el `package.json` con todas las dependencias, y la estructura de carpetas validada.

## Contexto
El proyecto ya tiene una estructura de carpetas creada (con `.gitkeep`). Esta tarea convierte ese esqueleto en una app Forge funcional con el manifest correcto, dependencias instaladas y configuración base de TypeScript.

## Especificacion Tecnica

### manifest.yml
- App name: `rovo-execution-guard`
- App ID: generar con `forge register`
- Entornos: `development`, `staging`, `production`
- Permissions/Scopes necesarios:
  - `read:jira-work`, `write:jira-work`
  - `read:confluence-content`, `write:confluence-content`
  - `storage:app`
  - Scopes para GitHub (via external auth)
- Modules:
  - `jira:issuePanel` (Issue Panel)
  - `jira:adminPage` (Admin Dashboard)
  - Triggers: `onJiraWorkflowTransition`
  - Webhook listener para GitHub events

### package.json
- Node.js 22.x (LTS)
- Dependencias principales:
  - `@forge/react` v10
  - `react` 18.x
  - `@forge/api`
  - `@forge/resolver`
- DevDependencies:
  - `typescript` (strict)
  - `jest`
  - `@testing-library/react`
  - `eslint` + plugins
  - `prettier`
  - `husky`
  - `commitlint`
  - `lint-staged`
  - `playwright`
  - `semantic-release`

### tsconfig.json
- `strict: true`
- `target: ES2022`
- `module: ESNext`
- `jsx: react-jsx`
- Paths absolutos para `@domain`, `@services`, `@resolvers`, `@frontend`

## Acceptance Criteria
- [ ] AC-01: `manifest.yml` existe con scopes, modules y permissions correctos
- [ ] AC-02: `package.json` tiene todas las dependencias listadas
- [ ] AC-03: `tsconfig.json` configurado en modo strict
- [ ] AC-04: Estructura de carpetas validada (sin `.gitkeep` residuales innecesarios)
- [ ] AC-05: `npm install` se ejecuta sin errores
- [ ] AC-06: `forge lint` no reporta errores en el manifest
- [ ] AC-07: Archivo `.reqs.md` sidecar para `manifest.yml` creado

## Reglas del Rulebook
- **[FORGE-OPS-001]**: Respetar limits de ejecucion y latencia de Forge
- **[FORGE-OPS-002]**: Manejar permisos correctamente (Least Privilege)
- **[ARCH-SOLID-001]**: Separacion de capas estricta

## Estrategia de Test
- **Unit**: Verificar que el manifest parsea correctamente (schema validation)
- **Integration**: `forge lint` pasa sin errores
- **E2E**: `forge deploy -e development` exitoso

## Estado: PENDIENTE
