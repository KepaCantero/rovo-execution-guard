# TASK-028: Testing Layer - Integration Tests with Mocks

## Objetivo
Crear la suite de tests de integracion que verifica los contratos con las APIs de Jira, Confluence, Rovo y GitHub usando mocks estandarizados.

## Contexto
Los tests de integracion validan que los adapters se comunican correctamente con las APIs externas, manejan respuestas y errores apropiadamente.

## Especificacion Tecnica

### Ubicacion
`tests/integration/`

### Estructura
```
tests/integration/
  fixtures/        # Datos mock estandarizados
  jira/            # Tests de integracion con Jira API
  rovo/            # Tests de integracion con Rovo API
  github/          # Tests de integracion con GitHub API
```

### Fixtures (datos mock)
- `jira-ticket-full.json`: Ticket completo de Jira
- `jira-ticket-minimal.json`: Ticket con datos minimos
- `rovo-context-full.json`: Contexto completo de Rovo
- `github-pr-full.json`: PR completo de GitHub
- `confluence-pages.json`: Paginas de Confluence

### Tests de integracion

#### Jira Adapter Integration
- `getTicketData` con ticket existente -> datos correctos
- `getTicketData` con ticket inexistente -> `TicketNotFoundError`
- `transitionIssue` con transicion valida -> exito
- `transitionIssue` con transicion invalida -> error
- `addComment` con formato ADF -> exito
- Rate limiting simulado -> retry

#### Rovo Adapter Integration
- `getContext` con query valida -> contexto estructurado
- `getContext` con Rovo no disponible -> fallback
- `getRelatedTickets` -> tickets relacionados
- Cuota excedida -> `QuotaExceededError`

#### GitHub Adapter Integration
- `createStatusCheck` -> check creado
- `createPRComment` -> comentario publicado
- `extractJiraKeysFromPR` -> keys extraidas
- Token expirado -> `TokenExpiredError`
- Rate limiting -> retry

### Mock strategy
- Usar `nock` para interceptar HTTP requests
- Fixtures centralizados en `tests/integration/fixtures/`
- Cada test es independiente (setup/teardown)

## Acceptance Criteria
- [ ] AC-01: Fixtures mock estandarizados para todas las APIs
- [ ] AC-02: Tests de contrato para Jira adapter (6+ tests)
- [ ] AC-03: Tests de contrato para Rovo adapter (4+ tests)
- [ ] AC-04: Tests de contrato para GitHub adapter (5+ tests)
- [ ] AC-05: Tests de manejo de errores (timeout, rate limit, 404)
- [ ] AC-06: Cada test es independiente y repetible
- [ ] AC-07: `npm run test:integration` pasa sin errores
- [ ] AC-08: Mocks via `nock` o similar

## Reglas del Rulebook
- **[TEST-QA-004]**: Integration tests con mocks estandarizados
- **[TEST-QA-005]**: Contratos de API verificados

## Estrategia de Test
- N/A (es la tarea de tests)

## Dependencias
- TASK-009 (Jira adapter)
- TASK-010 (Rovo adapter)
- TASK-011 (GitHub adapter)
- TASK-012 (Confluence adapter)
- TASK-013 (resilience)

## Estado: PENDIENTE
