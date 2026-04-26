# REQUISITOS: sentry-browser (frontend)

> **Sidecar File** | Vinculado a: `src/frontend/utils/sentry.ts`

---

## Descripcion

Modulo de integracion Sentry para el frontend React (browser). Proporciona inicializacion
graceful del SDK `@sentry/browser`, captura de excepciones con contexto de issue/project,
breadcrumbs para trazabilidad, y captura de unhandled promise rejections.

Este modulo es una utilidad de infraestructura transversal consumida por los componentes
UI (ErrorBoundary) y hooks del frontend. Degradacion graceful: todas las funciones son
no-ops cuando Sentry no ha sido inicializado correctamente.

---

## Acceptance Criteria

- [ ] **AC-01**: `initSentryBrowser(dsn, environment)` solo inicializa Sentry si `dsn` es un string no vacio; si es undefined o vacio, retorna silenciosamente y todas las llamadas posteriores son no-ops
- [ ] **AC-02**: `captureException` enriquece excepciones con tags `issueKey`, `projectKey` usando `Sentry.setTag()`, y contexto estructurado via `Sentry.setContext()`
- [ ] **AC-03**: `initSentryBrowser` configura captura automatica de unhandled promise rejections (TEST-QA-036-01)
- [ ] **AC-04**: `addErrorBreadcrumb` agrega breadcrumbs al scope actual con categoria, mensaje, nivel y datos opcionales
- [ ] **AC-05**: `tracesSampleRate` parametrizado: 0.1 en production, 1.0 en otros environments (staging, development)
- [ ] **AC-06**: DSN nunca aparece en contexto Sentry ni breadcrumbs (SEC-PRIV-002)
- [ ] **AC-07**: Imports tree-shakeable: solo `init`, `captureException`, `addBreadcrumb`, `setTag` desde `@sentry/browser` [FORGE-OPS-009]
- [ ] **AC-08**: Modulo expone `isSentryInitialized(): boolean` para verificacion de estado
- [ ] **AC-09**: Ningun tipo `any` — usar `unknown` + type guards [ARCH-SOLID-202]
- [ ] **AC-10**: Archivo `.reqs.md` sidecar producido (este archivo)
- [ ] **AC-11**: Todas las funciones publicas son no-ops cuando Sentry no esta inicializado — nunca lanzan errores [FORGE-OPS-0104]

---

## Reglas del Rulebook

Las siguientes reglas del RULEBOOK.md deben respetarse en este modulo:

| ID Regla         | Categoria    | Descripcion breve                                                            |
| ---------------- | ------------ | ---------------------------------------------------------------------------- |
| [ARCH-SOLID-202] | Arquitectura | Zero `any` — usar `unknown`, type guards, generics                           |
| [ARCH-SOLID-203] | Arquitectura | Interfaces con propiedades `readonly`                                        |
| [ARCH-SOLID-232] | Arquitectura | Named exports solo, no `export default`                                      |
| [ARCH-SOLID-205] | Arquitectura | Tipos de retorno explicitos en todas las funciones publicas                  |
| [ARCH-SOLID-058] | Arquitectura | Tipos exportados sin dependencias de `@sentry/browser`                       |
| [SEC-PRIV-002]   | Seguridad    | No datos sensibles en logs ni respuestas; DSN nunca logueado ni en contexto  |
| [SEC-PRIV-006]   | Seguridad    | Auth tokens de `@forge/bridge` nunca pasados como contexto/tags Sentry       |
| [SEC-PRIV-008]   | Seguridad    | Minimizacion de datos — solo enviar a Sentry lo necesario para diagnostico   |
| [FORGE-OPS-009]  | Forge Ops    | Bundle <= 50 MB comprimido; usar tree-shaking imports                        |
| [FORGE-OPS-0104] | Forge Ops    | Graceful degradation — todas las funciones son no-ops cuando no inicializado |
| [TEST-QA-036-01] | Testing      | Captura de unhandled promise rejections                                      |
| [TEST-QA-036-02] | Testing      | Breadcrumbs en cada paso significativo del flujo UI                          |
| [TEST-QA-036-04] | Testing      | `tracesSampleRate` 0.05-0.2 en production, 1.0 en otros environments         |
| [TEST-QA-056]    | Testing      | TDD estricto: RED -> GREEN -> REFACTOR                                       |

---

## Contrato Publico (API del modulo)

### Tipos exportados

#### `BrowserSentryBreadcrumb`

```typescript
interface BrowserSentryBreadcrumb {
  readonly category: string;
  readonly message: string;
  readonly level: 'info' | 'warning' | 'error';
  readonly data?: Readonly<Record<string, unknown>>;
}
```

- **Proposito**: Estructura tipada para breadcrumbs enviados a Sentry desde el frontend
- **AC ref**: AC-04
- **Regla**: [ARCH-SOLID-203] propiedades readonly

#### `BrowserSentryContext`

```typescript
interface BrowserSentryContext {
  readonly issueKey?: string;
  readonly projectKey?: string;
  readonly [key: string]: unknown;
}
```

- **Proposito**: Contexto estructurado para enriquecer excepciones capturadas en el frontend
- **AC ref**: AC-02
- **Regla**: [TEST-QA-036-03], [SEC-PRIV-008] solo datos minimos para diagnostico
- **Nota**: Index signature `[key: string]: unknown` permite que ErrorBoundary pase `componentStack` como campo adicional

### Funciones exportadas

#### `initSentryBrowser(dsn: string, environment: string): void`

- **Proposito**: Inicializar Sentry Browser SDK con DSN explicito y entorno
- **Pre-condiciones**: Ninguna
- **Post-condiciones**: Si `dsn` es string no vacio, SDK inicializado con `captureUnhandledRejections`, `tracesSampleRate` parametrizado, y `beforeSend` passthrough. Si no, flag interna `isInitialized = false` y todas las llamadas posteriores son no-ops.
- **Errores**: Nunca lanza — falla silenciosamente si DSN ausente o invalido
- **AC ref**: AC-01, AC-03, AC-05, AC-11
- **Regla**: [TEST-QA-036-04], [TEST-QA-036-01]

#### `captureException(error: Error, context: BrowserSentryContext): void`

- **Proposito**: Capturar excepcion y enviarla a Sentry con contexto enriquecido
- **Pre-condiciones**: Ninguna (verifica `isInitialized` internamente)
- **Post-condiciones**: Se envia con tags `issueKey`, `projectKey` y contexto adicional. NO hay filtrado de errores — todos los errores del frontend son inesperados.
- **Errores**: Nunca lanza — envuelve todo en try/catch interno
- **AC ref**: AC-02, AC-11
- **Regla**: [TEST-QA-036-01], [SEC-PRIV-008]

#### `addErrorBreadcrumb(breadcrumb: BrowserSentryBreadcrumb): void`

- **Proposito**: Agregar breadcrumb al scope Sentry actual para trazabilidad de flujo UI
- **Pre-condiciones**: Ninguna (verifica `isInitialized` internamente)
- **Post-condiciones**: Breadcrumb agregado con categoria, mensaje, nivel y datos opcionales
- **Errores**: Nunca lanza
- **AC ref**: AC-04, AC-11
- **Regla**: [TEST-QA-036-02]

#### `isSentryInitialized(): boolean`

- **Proposito**: Verificar si Sentry fue inicializado exitosamente
- **Pre-condiciones**: Ninguna
- **Post-condiciones**: Retorna `true` si `initSentryBrowser` fue llamado con DSN valido, `false` en caso contrario
- **Errores**: Nunca lanza
- **AC ref**: AC-08

---

## Dependencias (imports)

### Internas (proyecto)

- Ninguna — modulo autocontenido. ErrorBoundary.tsx importa DESDE este modulo.

### Externas (npm)

- `@sentry/browser` -> `init`, `captureException` as `sentryCapture`, `addBreadcrumb`, `setTag`
  - Solo funciones necesarias (tree-shaking) [FORGE-OPS-009]
- **NOTA**: `@sentry/browser` debe ser una dependencia directa en `package.json` (actualmente solo transitoria via `@sentry/node`)

### NOTA: Capa de infraestructura

- Este archivo esta en `src/frontend/utils/` -> infraestructura transversal del frontend
- NO importa tipos de `@sentry/browser` en las interfaces exportadas [ARCH-SOLID-058]
- NO depende de `@forge/bridge` — los tokens de autenticacion NUNCA se pasan a Sentry [SEC-PRIV-006]

---

## Diferencias clave con el Backend sentry.ts

| Aspecto           | Backend (`@sentry/node`)                            | Frontend (`@sentry/browser`)                                       |
| ----------------- | --------------------------------------------------- | ------------------------------------------------------------------ |
| Fuente DSN        | `process.env.SENTRY_DSN`                            | Parametro explicito `initSentryBrowser(dsn, env)`                  |
| Scope tags        | `executionId`, `ticketKey`, `module`, `environment` | `issueKey`, `projectKey`                                           |
| Filtrado errores  | Si (`isExpectedError` filtra errores de dominio)    | No — todos los errores del frontend son inesperados                |
| Promise rejection | N/A                                                 | Captura automatica de unhandled rejections                         |
| Context type      | `SentryCaptureContext`                              | `BrowserSentryContext` (con index signature para `componentStack`) |
| Breadcrumb type   | `SentryBreadcrumb`                                  | `BrowserSentryBreadcrumb`                                          |

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

// [TEST-QA-036-01] Captura de unhandled promise rejections
// [FORGE-OPS-009] Tree-shakeable imports
Sentry.init({
  dsn,
  environment,
  tracesSampleRate: TRACES_SAMPLE_RATE[environment] ?? 0.1,
});
```

### Graceful Degradation

- Flag modulo-nivel: `let isInitialized = false`
- Si `dsn` es undefined o string vacio → no llamar `Sentry.init()`, flag permanece `false`
- Todas las funciones publicas verifican `isInitialized` antes de llamar al SDK
- Si `isInitialized === false` → retorno inmediato (no-op)
- Nunca se lanza error desde las funciones de este modulo [FORGE-OPS-0104]

---

## Seguridad

### Datos que NUNCA deben enviarse a Sentry

- Sentry DSN (no incluir en contexto ni breadcrumbs) [SEC-PRIV-002]
- Tokens de `@forge/bridge` (requestJira, requestConfluence, etc.) [SEC-PRIV-006]
- User PII (accountIds, emails, display names)
- Contenido completo de issues, descriptions, comments

### Datos permitidos en contexto Sentry

- `issueKey`: string (e.g., "PROJ-123")
- `projectKey`: string (e.g., "PROJ")
- `componentStack`: string (React error boundary stack trace)
- `error.message`: string (mensaje de error)

---

## Estrategia de Test

### Unit Tests (`tests/unit/utils/sentry-browser.spec.ts`)

| Test Category  | Test Case                                                           | AC cubierto | Regla cubierta |
| -------------- | ------------------------------------------------------------------- | ----------- | -------------- |
| Initialization | initSentryBrowser con DSN valido inicializa el SDK                  | AC-01       | -              |
| Initialization | initSentryBrowser con DSN vacio no inicializa (no-op)               | AC-01       | FORGE-OPS-0104 |
| Initialization | initSentryBrowser con DSN undefined no inicializa (no-op)           | AC-01       | FORGE-OPS-0104 |
| Initialization | tracesSampleRate correcto para production (0.1)                     | AC-05       | TEST-QA-036-04 |
| Initialization | tracesSampleRate correcto para staging (1.0)                        | AC-05       | TEST-QA-036-04 |
| Initialization | tracesSampleRate correcto para development (1.0)                    | AC-05       | TEST-QA-036-04 |
| Initialization | initSentryBrowser no lanza si la inicializacion falla               | AC-11       | FORGE-OPS-0104 |
| Initialization | initSentryBrowser configura captura de unhandled promise rejections | AC-03       | TEST-QA-036-01 |
| Error capture  | captureException envia error generico a Sentry                      | AC-02       | -              |
| Error capture  | captureException establece tag issueKey                             | AC-02       | -              |
| Error capture  | captureException establece tag projectKey                           | AC-02       | -              |
| Error capture  | captureException establece contexto estructurado                    | AC-02       | SEC-PRIV-008   |
| Error capture  | captureException es no-op cuando no inicializado                    | AC-11       | FORGE-OPS-0104 |
| Error capture  | captureException no lanza cuando SDK falla internamente             | AC-11       | FORGE-OPS-0104 |
| Breadcrumbs    | addErrorBreadcrumb agrega breadcrumb con categoria y mensaje        | AC-04       | TEST-QA-036-02 |
| Breadcrumbs    | addErrorBreadcrumb agrega breadcrumb con level                      | AC-04       | TEST-QA-036-02 |
| Breadcrumbs    | addErrorBreadcrumb incluye datos opcionales                         | AC-04       | TEST-QA-036-02 |
| Breadcrumbs    | addErrorBreadcrumb es no-op cuando no inicializado                  | AC-11       | FORGE-OPS-0104 |
| Breadcrumbs    | addErrorBreadcrumb no lanza cuando SDK falla internamente           | AC-11       | FORGE-OPS-0104 |
| State          | isSentryInitialized retorna true despues de init con DSN            | AC-08       | -              |
| State          | isSentryInitialized retorna false sin init                          | AC-08       | -              |
| State          | isSentryInitialized retorna false despues de init sin DSN           | AC-08       | -              |
| Security       | DSN no aparece en contexto Sentry                                   | AC-06       | SEC-PRIV-002   |
| Security       | DSN no aparece en breadcrumbs                                       | AC-06       | SEC-PRIV-002   |
| Security       | Contexto Sentry no incluye datos sensibles                          | AC-06       | SEC-PRIV-008   |
| Zero any       | grep de `any` en el archivo retorna cero resultados                 | AC-09       | ARCH-SOLID-202 |

### Mock Strategy

- Mockear `@sentry/browser` con `jest.mock()` — verificar llamadas a `init`, `captureException`, `addBreadcrumb`, `setTag`
- NO mockear los tipos de contexto — usar las interfaces reales `BrowserSentryContext` y `BrowserSentryBreadcrumb`
- Resetear flag `isInitialized` entre tests via `_resetForTesting()` exportada para testing
- Usar `jest.resetAllMocks()` en `beforeEach` (no `clearAllMocks`)

---

## Historial de Cambios

| Fecha | Tarea Ralph | Cambio         |
| ----- | ----------- | -------------- |
|       | RTASK-022   | Creado inicial |
