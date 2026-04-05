# TASK-004: Husky, Commitlint, lint-staged

## Objetivo
Configurar los Git Hooks para garantizar que ningun commit con codigo de baja calidad entre al repositorio.

## Contexto
Los hooks son la primera Quality Gate tecnica. Pre-commit para linting/testing, commit-msg para validacion de formato.

## Especificacion Tecnica

### Husky Hooks

#### pre-commit
- Ejecutar `lint-staged`:
  - `*.ts`, `*.tsx`: `eslint --fix` + `prettier --write`
  - Ejecutar unit tests de archivos afectados (si jest esta configurado)

#### commit-msg
- Validar formato Conventional Commits + [JIRA-ID]
- Regex: `^(feat|fix|chore|docs|style|refactor|perf|test|build|ci)(\(.+\))?:\s.{1,100}\s\[REG-\d+\]$`
- Mensaje de error descriptivo si el formato es incorrecto

#### pre-push
- `npm run typecheck` (verificacion de tipos TypeScript)
- `npm run test:unit` (tests unitarios criticos)

### commitlint.config.js
- Extends: `@commitlint/config-conventional`
- Regla custom: `references` para forzar JIRA-ID

### lint-staged (.lintstagedrc)
- Patrones de archivos y comandos a ejecutar

### npm scripts adicionales
- `prepare`: `husky`
- `test:unit`: `jest --coverage`
- `test:staged`: `jest --findRelatedTests`

## Acceptance Criteria
- [ ] AC-01: Un commit con mensaje invalido es rechazado
- [ ] AC-02: Un commit con archivos no linteados es rechazado
- [ ] AC-03: El pre-push ejecuta typecheck y tests unitarios
- [ ] AC-04: `npm run prepare` instala los hooks correctamente
- [ ] AC-05: Los mensajes de error son claros y accionables
- [ ] AC-06: Se genera archivo `.reqs.md` sidecar

## Reglas del Rulebook
- **[GIT-CI-001]**: Conventional Commits obligatorios
- **[GIT-CI-002]**: JIRA-ID obligatorio en cada commit
- **[GIT-CI-003]**: Pre-commit ejecuta lint + unit tests

## Estrategia de Test
- **Unit**: N/A (git hooks config)
- **Integration**: Simular commit invalido y verificar rechazo
- **E2E**: N/A

## Dependencias
- TASK-001 (package.json)
- TASK-003 (ESLint, Prettier configurados)

## Estado: PENDIENTE
