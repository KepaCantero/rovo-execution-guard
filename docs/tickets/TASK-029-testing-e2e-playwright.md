# TASK-029: Testing Layer - E2E Playwright Suite

## Objetivo
Crear la suite de tests end-to-end con Playwright que simula el flujo completo de un usuario: creacion de ticket, validacion por Rovo, intento de PR en GitHub y bloqueo/aprobacion.

## Contexto
Los tests E2E son la Quality Gate final. Ningun despliegue a produccion puede ocurrir si los E2E fallan. Validan que el sistema funciona como un todo integrado.

## Especificacion Tecnica

### Ubicacion
`tests/e2e/`

### Configuracion (playwright.config.ts)
- Timeout: 60 segundos por test
- Retries: 2 (en CI)
- Reporter: HTML + JSON
- Base URL configurable por entorno
- Containers aislados para cada test

### Flujos E2E

#### Flujo 1: Bloqueo de ticket por score bajo (Jira Panel)
1. Navegar a un ticket de Jira existente
2. Verificar que el Issue Panel carga
3. Verificar que muestra score < 80
4. Intentar mover ticket a "In Progress"
5. Verificar que la transicion es bloqueada
6. Verificar que el comentario de razon aparece

#### Flujo 2: Bloqueo de PR en GitHub (GitHub Checks)
1. Crear un PR en repo de test que referencia un ticket con score bajo
2. Verificar que el webhook es recibido
3. Verificar que el status check es `failure`
4. Verificar que el comentario de contexto aparece en el PR
5. Resolver inconsistencias en el ticket
6. Verificar que el status check cambia a `success`

#### Flujo 3: Aprobacion completa (Happy Path)
1. Crear/verificar un ticket con score >= 80
2. Mover a "In Progress" -> exito
3. Crear PR que referencia el ticket
4. Status check: `success`
5. Comentario con score y contexto
6. Mover a "Done" -> exito

#### Flujo 4: Admin Dashboard
1. Navegar al admin dashboard
2. Verificar que muestra metricas
3. Cambiar configuracion (threshold)
4. Verificar que el cambio tiene efecto en el proximo ticket evaluado

### Datos de test
- Tickets de test pre-creados en el entorno de staging
- Repo de GitHub de test con webhooks configurados
- Fixtures en `tests/e2e/fixtures/`

## Acceptance Criteria
- [ ] AC-01: Playwright configurado y ejecutandose
- [ ] AC-02: Flujo 1 (bloqueo de ticket) pasa
- [ ] AC-03: Flujo 2 (bloqueo de PR) pasa
- [ ] AC-04: Flujo 3 (happy path) pasa
- [ ] AC-05: Flujo 4 (admin dashboard) pasa
- [ ] AC-06: Tests ejecutados en CI (GitHub Actions staging)
- [ ] AC-07: Screenshots/videos en fallo para debugging
- [ ] AC-08: `npm run test:e2e` pasa sin errores

## Reglas del Rulebook
- **[TEST-QA-006]**: E2E con Playwright obligatorio
- **[GIT-CI-004]**: Ningun deploy a produccion sin E2E passing

## Estrategia de Test
- N/A (es la tarea de tests)

## Dependencias
- TASK-014 (Jira triggers)
- TASK-016 (GitHub webhooks)
- TASK-017 (enforcement)
- TASK-018 (Jira panel)
- TASK-019 (Admin dashboard)
- TASK-025 (GitHub Actions)

## Estado: PENDIENTE
