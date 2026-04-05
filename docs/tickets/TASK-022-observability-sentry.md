# TASK-022: Observability Layer - Sentry Integration

## Objetivo
Integrar Sentry para captura de excepciones en tiempo real tanto en el frontend (Custom UI) como en el backend (Forge triggers y resolvers).

## Contexto
Sentry permite detectar y diagnosticar errores en produccion. Cada error debe estar vinculado al `executionId` y al ticket de Jira afectado para trazabilidad completa.

## Especificacion Tecnica

### Configuracion

#### Backend (Forge Node.js)
- Sentry Node SDK
- DSN almacenado como environment variable en Forge
- Scope tags: `executionId`, `ticketKey`, `module`, `environment`
- Captura de excepciones no manejadas

#### Frontend (Custom UI - React)
- Sentry Browser SDK
- Captura de React Error Boundaries
- Scope tags: `issueKey`, `projectKey`

### Funcionalidades

#### `initSentry(environment: string): void`
- Inicializa Sentry con DSN y configuracion
- Configura tags globales (app version, environment)
- Solo inicializa si DSN esta configurado (graceful degradation)

#### `captureException(error: Error, context: SentryContext): void`
- Captura excepcion con contexto enriquecido
- Incluye: executionId, ticketKey, module, accion
- No captura errores esperados (ej: TicketNotFoundError)

#### `addErrorBreadcrumb(breadcrumb: Breadcrumb): void`
- Anade breadcrumbs para trazar el flujo antes del error
- Ej: "Fetching Rovo context for REG-123", "Score calculated: 65"

### Alertas
- Configurar alertas en Sentry:
  - Error rate > 5% en 5 minutos
  - Cualquier `CircuitOpenError`
  - Cualquier `TimeoutError` en Rovo adapter

## Acceptance Criteria
- [ ] AC-01: Sentry inicializa solo si DSN esta configurado
- [ ] AC-02: Excepciones capturadas con executionId y ticketKey
- [ ] AC-03: React Error Boundaries envian errores a Sentry
- [ ] AC-04: Breadcrumbs permiten reconstruir el flujo
- [ ] AC-05: Errores esperados no se envian a Sentry
- [ ] AC-06: Graceful degradation si Sentry no esta disponible
- [ ] AC-07: Tests unitarios de captura de errores
- [ ] AC-08: Archivo `.reqs.md` sidecar creado

## Reglas del Rulebook
- **[FORGE-OPS-006]**: Error monitoring obligatorio
- **[SEC-PRIV-006]**: No enviar datos sensibles a Sentry

## Estrategia de Test
- **Unit**: Mock de Sentry SDK, verificar llamadas
- **Integration**: Verificar breadcrumbs y tags en eventos
- **E2E**: N/A

## Dependencias
- TASK-021 (structured logger)

## Estado: PENDIENTE
