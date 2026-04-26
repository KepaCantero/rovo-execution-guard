# REQUISITOS: sentry (backend)

> **Sidecar File** | Vinculado a: `src/backend/utils/sentry.ts`

---

## Descripcion

Modulo de integracion Sentry para el backend Forge (Node.js). Proporciona inicializacion
graceful del SDK `@sentry/node`, captura de excepciones con contexto de ejecucion enriquecido,
filtrado de errores esperados del dominio, y breadcrumbs para trazabilidad de flujo.

Este modulo es una utilidad de infraestructura transversal (cross-cutting concern) consumida
por los servicios de la aplicacion (adapters, scoring, enforcement). Degradacion graceful:
todas las funciones son no-ops cuando `SENTRY_DSN` no esta configurado.

---

## Acceptance Criteria

- [ ] **AC-01**: `initSentry` solo inicializa Sentry si la variable de entorno `SENTRY_DSN` esta configurada; si no, retorna silenciosamente y todas las llamadas posteriores son no-ops
- [ ] **AC-02**: `captureException` enriquece excepciones con tags `executionId`, `ticketKey`, `module`, `environment` usando `Sentry.setContext()` y `Sentry.setTag()`
- [ ] **AC-03**: `captureException` NO envia errores esperados: `TicketNotFoundError`, `InsufficientDataError`, o errores con propiedad `{ expected: true }`
- [ ] **AC-04**: `addErrorBreadcrumb` agrega breadcrumbs al scope actual con categoria, mensaje, nivel y datos opcionales
- [ ] **AC-05**: El filtrado de errores usa `instanceof` contra la jerarquia `REGError` — nunca string matching
- [ ] **AC-06**: `tracesSampleRate` parametrizado: 0.1 en production, 1.0 en staging/development
- [ ] **AC-07**: DSN nunca aparece en logs ni en contexto Sentry (SEC-PRIV-002)
- [ ] \*\*AC-08`: Imports tree-shakeable: solo `init`, `captureException`, `addBreadcrumb`, `setContext`, `setTag`desde`@sentry/node`
- [ ] **AC-09**: Modulo expone `isSentryInitialized(): boolean` para verificacion de estado
- [ ] **AC-10**: Ningun tipo `any` — usar `unknown` + type guards
- [ ] **AC-11**: Archivo `.reqs.md` sidecar producido (este archivo)

---

## Reglas del Rulebook

Las siguientes reglas del RULEBOOK.md deben respetarse en este modulo:

| ID Regla         | Categoria    | Descripcion breve                                                                |
| ---------------- | ------------ | -------------------------------------------------------------------------------- |
| [ARCH-SOLID-202] | Arquitectura | Zero `any` — usar `unknown`, type guards, generics                               |
| [ARCH-SOLID-058] | Arquitectura | Dominio sin dependencias de framework; sentry.ts vive en utils (infraestructura) |
| [ARCH-SOLID-053] | Arquitectura | Tipos de error de dominio — filtrado via `instanceof` contra REGError            |
| [ARCH-SOLID-232] | Arquitectura | Named exports solo, no `export default`                                          |
| [ARCH-SOLID-205] | Arquitectura | Tipos de retorno explicitos en todas las funciones publicas                      |
| [ARCH-SOLID-006] | Arquitectura | Handler -> Service -> Repository; sentry.ts es utility, llamado FROM services    |
| [SEC-PRIV-002]   | Seguridad    | No datos sensibles en logs ni respuestas; DSN nunca logueado                     |
| [SEC-PRIV-008]   | Seguridad    | Minimizacion de datos — solo enviar a Sentry lo necesario para diagnostico       |
| [FORGE-OPS-009]  | Forge Ops    | Bundle <= 50 MB comprimido; usar tree-shaking imports                            |
| [FORGE-OPS-005]  | Forge Ops    | Ninguna Forge function excede 10s; init sincrono y ligero                        |
| [FORGE-OPS-006]  | Forge Ops    | Forge Storage max 100 MB; breadcrumbs NO se almacenan en Forge Storage           |
| [TEST-QA-036-01] | Testing      | Todas las excepciones no filtradas deben enviarse via `captureException`         |
| [TEST-QA-036-02] | Testing      | Breadcrumbs en cada paso significativo del flujo de evaluacion                   |
| [TEST-QA-036-03] | Testing      | Eventos Sentry con contexto estructurado: executionId, ticketKey, module         |
| [TEST-QA-036-04] | Testing      | `tracesSampleRate` 0.05-0.2 en production, 1.0 en staging                        |
| [TEST-QA-036-05] | Testing      | Filtros de error versionados en `config/sentry-filters.ts`                       |
| [TEST-QA-056]    | Testing      | TDD estricto: RED -> GREEN -> REFACTOR                                           |

---

## Contrato Publico (API del modulo)

### Tipos exportados

#### `SentryBreadcrumb`

```typescript
interface SentryBreadcrumb {
  readonly category: string;
  readonly message: string;
  readonly level: 'info' | 'warning' | 'error';
  readonly data?: Readonly<Record<string, unknown>>;
}
```

- **Proposito**: Estructura tipada para breadcrumbs enviados a Sentry
- **AC ref**: AC-04
- **Regla**: [ARCH-SOLID-203] propiedades readonly

#### `SentryCaptureContext`

```typescript
interface SentryCaptureContext {
  readonly executionId?: string;
  readonly ticketKey?: string;
  readonly module?: string;
  readonly environment?: string;
  readonly [key: string]: unknown;
}
```

- **Proposito**: Contexto estructurado para enriquecer excepciones capturadas
- **AC ref**: AC-02
- **Regla**: [TEST-QA-036-03], [SEC-PRIV-008] solo datos minimos para diagnostico

### Funciones exportadas

#### `initSentry(environment: string): void`

- **Proposito**: Inicializar Sentry Node SDK con DSN desde variable de entorno `SENTRY_DSN`
- **Pre-condiciones**: Ninguna
- **Post-condiciones**: Si `SENTRY_DSN` esta configurado, SDK inicializado con `beforeSend` filter y `tracesSampleRate` parametrizado. Si no, flag interna `isInitialized = false` y todas las llamadas posteriores son no-ops.
- **Errores**: Nunca lanza — falla silenciosamente si DSN ausente o invalido
- **AC ref**: AC-01, AC-06
- **Regla**: [FORGE-OPS-005], [TEST-QA-036-04]

#### `captureException(error: Error, context: SentryCaptureContext): void`

- **Proposito**: Capturar excepcion y enviarla a Sentry con contexto enriquecido
- **Pre-condiciones**: Ninguna (verifica `isInitialized` internamente)
- **Post-condiciones**:
  - Si `error` es instancia de `TicketNotFoundError` o `InsufficientDataError` → NO se envia
  - Si `error` tiene propiedad `expected === true` → NO se envia
  - En otro caso → se envia con tags `executionId`, `ticketKey`, `module` y contexto adicional
- **Errores**: Nunca lanza — envuelve todo en try/catch interno
- **AC ref**: AC-02, AC-03, AC-05
- **Regla**: [TEST-QA-036-01], [ARCH-SOLID-053], [SEC-PRIV-008]

#### `addErrorBreadcrumb(breadcrumb: SentryBreadcrumb): void`

- **Proposito**: Agregar breadcrumb al scope Sentry actual para trazabilidad de flujo
- **Pre-condiciones**: Ninguna (verifica `isInitialized` internamente)
- **Post-condiciones**: Breadcrumb agregado con categoria, mensaje, nivel y datos opcionales
- **Errores**: Nunca lanza
- **AC ref**: AC-04
- **Regla**: [TEST-QA-036-02]

#### `isSentryInitialized(): boolean`

- **Proposito**: Verificar si Sentry fue inicializado exitosamente
- **Pre-condiciones**: Ninguna
- **Post-condiciones**: Retorna `true` si `initSentry` fue llamado con DSN valido, `false` en caso contrario
- **Errores**: Nunca lanza
- **AC ref**: AC-09

---

## Dependencias (imports)

### Internas (proyecto)

- `src/backend/types/errors` -> `REGError`, `TicketNotFoundError`, `InsufficientDataError` (para `instanceof` checks)

### Externas (npm)

- `@sentry/node` -> `init`, `captureException` as `sentryCapture`, `addBreadcrumb`, `setContext`, `setTag`
  - Solo funciones necesarias (tree-shaking) [FORGE-OPS-009]

### NOTA: Capa de infraestructura

- Este archivo esta en `src/backend/utils/` → infraestructura transversal
- NO importa tipos de dominio mas alla de la jerarquia de errores (que es read-only)
- NO depende del logger estructurado (RTASK-021) directamente — los servicios llaman a ambos

---

## Filtrado de Errores (beforeSend)

### Errores que NO se envian a Sentry

| Error Type              | Jerarquia                             | Razon                                             |
| ----------------------- | ------------------------------------- | ------------------------------------------------- |
| `TicketNotFoundError`   | extends JiraApiError extends REGError | Escenario de dominio valido (ticket no existe)    |
| `InsufficientDataError` | extends ScoringError extends REGError | Escenario de dominio valido (datos insuficientes) |
| `{ expected: true }`    | Cualquier Error con esta propiedad    | Marcado como esperado por el llamador             |

### Implementacion del filtro

```typescript
// [ARCH-SOLID-053] Filtrado via instanceof, nunca string matching
function isExpectedError(error: Error): boolean {
  if (error instanceof TicketNotFoundError) return true;
  if (error instanceof InsufficientDataError) return true;
  if ('expected' in error && (error as { expected: unknown }).expected === true) return true;
  return false;
}
```

### Configuracion externalizada

- [TEST-QA-036-05] Los filtros de error deben estar versionados en `config/sentry-filters.ts`
- La funcion `isExpectedError` delega a la configuracion en `config/sentry-filters.ts`

---

## Inicializacion

### Parametros de inicializacion

```typescript
// [TEST-QA-036-04] tracesSampleRate parametrizado por environment
const TRACES_SAMPLE_RATE: Readonly<Record<string, number>> = {
  production: 0.1,
  staging: 1.0,
  development: 1.0,
} as const;

// [FORGE-OPS-005] Init sincrono, sin await
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment,
  tracesSampleRate: TRACES_SAMPLE_RATE[environment] ?? 0.1,
  beforeSend(event) {
    // Filtrar errores esperados via config/sentry-filters.ts
    return event; // o null para descartar
  },
});
```

### Graceful Degradation

- Flag modulo-nivel: `let isInitialized = false`
- Si `process.env.SENTRY_DSN` es undefined/vacio → no llamar `Sentry.init()`, flag permanece `false`
- Todas las funciones publicas verifican `isInitialized` antes de llamar al SDK
- Si `isInitialized === false` → retorno inmediato (no-op)
- Nunca se lanza error desde las funciones de este modulo

---

## Seguridad

### Datos que NUNCA deben enviarse a Sentry

- Sentry DSN (no incluir en contexto ni breadcrumbs)
- Tokens de Forge API, GitHub App tokens, Jira tokens
- Contenido completo de tickets (body, description, comments)
- Respuestas completas de APIs externas
- User PII (accountIds, emails, display names)

### Datos permitidos en contexto Sentry

- `executionId`: string UUID
- `ticketKey`: string (e.g., "PROJ-123")
- `module`: string (e.g., "scoring", "jira-adapter")
- `environment`: string (e.g., "production", "staging")
- `error.message`: string (mensaje de error, no stack trace completo con datos)

---

## Estrategia de Test

### Unit Tests (`tests/unit/utils/sentry.spec.ts`)

| Test Category   | Test Case                                                       | AC cubierto | Regla cubierta |
| --------------- | --------------------------------------------------------------- | ----------- | -------------- |
| Initialization  | initSentry con DSN valido inicializa el SDK                     | AC-01       | FORGE-OPS-005  |
| Initialization  | initSentry sin DSN no inicializa el SDK (no-op)                 | AC-01       | -              |
| Initialization  | initSentry configura tracesSampleRate correcto por environment  | AC-06       | TEST-QA-036-04 |
| Initialization  | initSentry registra beforeSend filter                           | AC-03       | TEST-QA-036-01 |
| Error capture   | captureException envia error generico a Sentry con tags         | AC-02       | TEST-QA-036-03 |
| Error capture   | captureException con executionId establece tag correcto         | AC-02       | TEST-QA-036-03 |
| Error capture   | captureException con ticketKey establece tag correcto           | AC-02       | TEST-QA-036-03 |
| Error capture   | captureException con module establece tag correcto              | AC-02       | TEST-QA-036-03 |
| Error filtering | captureException NO envia TicketNotFoundError                   | AC-03       | ARCH-SOLID-053 |
| Error filtering | captureException NO envia InsufficientDataError                 | AC-03       | ARCH-SOLID-053 |
| Error filtering | captureException NO envia error con { expected: true }          | AC-03       | ARCH-SOLID-053 |
| Error filtering | captureException SI envia RovoApiError                          | AC-03       | TEST-QA-036-01 |
| Error filtering | captureException SI envia TimeoutError                          | AC-03       | TEST-QA-036-01 |
| Error filtering | captureException SI envia CircuitOpenError                      | AC-03       | TEST-QA-036-01 |
| Error filtering | Filtrado usa instanceof, no string matching                     | AC-05       | ARCH-SOLID-053 |
| Breadcrumbs     | addErrorBreadcrumb agrega breadcrumb con categoria y mensaje    | AC-04       | TEST-QA-036-02 |
| Breadcrumbs     | addErrorBreadcrumb agrega breadcrumb con level error            | AC-04       | TEST-QA-036-02 |
| Breadcrumbs     | addErrorBreadcrumb agrega breadcrumb con data adicional         | AC-04       | TEST-QA-036-02 |
| No-op behavior  | Todas las funciones son no-op cuando DSN no configurado         | AC-01       | -              |
| No-op behavior  | captureException no lanza cuando Sentry no inicializado         | AC-01       | -              |
| No-op behavior  | addErrorBreadcrumb no lanza cuando Sentry no inicializado       | AC-01       | -              |
| State           | isSentryInitialized retorna true despues de init con DSN        | AC-09       | -              |
| State           | isSentryInitialized retorna false sin init                      | AC-09       | -              |
| State           | isSentryInitialized retorna false despues de init sin DSN       | AC-09       | -              |
| Security        | DSN no aparece en ningun contexto o breadcrumb enviado a Sentry | AC-07       | SEC-PRIV-002   |
| Security        | Contexto Sentry no incluye datos de tickets completos           | AC-07       | SEC-PRIV-008   |
| Zero any        | grep -r "any" en el archivo retorna cero resultados             | AC-10       | ARCH-SOLID-202 |

### Mock Strategy

- Mockear `@sentry/node` con `jest.mock()` — verificar llamadas a `init`, `captureException`, `addBreadcrumb`, `setContext`, `setTag`
- Mockear `process.env.SENTRY_DSN` con `delete`/`assign` en beforeEach/afterEach
- NO mockear tipos de error del dominio — usar las clases reales desde `src/backend/types/errors`
- Resetear flag `isInitialized` entre tests (requiere funcion interna de reset o re-importar modulo)

---

## Historial de Cambios

| Fecha | Tarea Ralph | Cambio         |
| ----- | ----------- | -------------- |
|       | RTASK-022   | Creado inicial |
