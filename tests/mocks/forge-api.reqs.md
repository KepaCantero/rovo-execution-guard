# REQUISITOS: Forge API Mock Helpers

> **Sidecar File** | Vinculado a: `tests/mocks/forge-api.ts`

---

## Descripcion

Typed mock factories for `@forge/api` functions used in integration tests. Since Forge runtime functions go through the Forge platform proxy, `nock` cannot intercept them. These helpers provide typed jest.Mock factories for `requestJira`, `requestConfluence`, `fetch`, and `route` from `@forge/api`.

---

## Acceptance Criteria

- [x] **AC-01**: `createMockResponse()` produces a `MockAPIResponse` with `json()`, `text()`, `arrayBuffer()`, `ok`, `status`, `statusText`, and `headers` matching `@forge/api`'s `APIResponse` type
- [x] **AC-02**: Convenience builders (`okResponse`, `notFoundResponse`, `rateLimitedResponse`, `serverErrorResponse`, `forbiddenResponse`, `createdResponse`, `noContentResponse`) create pre-configured responses
- [x] **AC-03**: `createMockRequestJira()`, `createMockRequestConfluence()`, `createMockForgeFetch()` return fully typed jest.Mock functions
- [x] **AC-04**: `createMockRoute()` returns a tag template function that interpolates parameters into a `MockRoute`
- [x] **AC-05**: `createForgeApiMockSet()` returns a complete set of all mock functions
- [x] **AC-06**: Zero `any` — all types are explicit or `unknown` with type narrowing [ARCH-SOLID-202]

---

## Reglas del Rulebook

| ID Regla         | Categoria    | Descripcion breve                                        |
| ---------------- | ------------ | -------------------------------------------------------- |
| [TEST-QA-202]    | Testing      | Exception: @forge/api is external SDK, jest.mock allowed |
| [TEST-QA-204]    | Testing      | afterEach cleanup mandatory                              |
| [TEST-QA-0764]   | Testing      | Tests run in isolation                                   |
| [ARCH-SOLID-202] | Arquitectura | Zero any, fully typed mocks                              |

---

## Contrato Publico (API del modulo)

### Funciones exportadas

#### `createMockResponse(options?: MockResponseOptions): MockAPIResponse`

- **Proposito**: Creates a typed mock API response
- **Pre-condiciones**: None
- **Post-condiciones**: Returns MockAPIResponse with all required fields
- **Errores**: None

#### `okResponse(body: unknown, headers?: MockHeaders): MockAPIResponse`

- **Proposito**: Creates a 200 OK response with JSON body
- **Pre-condiciones**: None
- **Post-condiciones**: Returns MockAPIResponse with status 200

#### `notFoundResponse(message?: string): MockAPIResponse`

- **Proposito**: Creates a 404 Not Found response
- **Pre-condiciones**: None
- **Post-condiciones**: Returns MockAPIResponse with status 404

#### `rateLimitedResponse(retryAfter?: number): MockAPIResponse`

- **Proposito**: Creates a 429 Too Many Requests response
- **Pre-condiciones**: None
- **Post-condiciones**: Returns MockAPIResponse with status 429, optional Retry-After header

#### `createMockRequestJira(defaultResponse?: MockAPIResponse): jest.Mock`

- **Proposito**: Creates a mock requestJira function
- **Pre-condiciones**: None
- **Post-condiciones**: Returns jest.Mock that resolves with the provided response

#### `createMockRequestConfluence(defaultResponse?: MockAPIResponse): jest.Mock`

- **Proposito**: Creates a mock requestConfluence function
- **Pre-condiciones**: None
- **Post-condiciones**: Returns jest.Mock that resolves with the provided response

#### `createMockForgeFetch(defaultResponse?: MockAPIResponse): jest.Mock`

- **Proposito**: Creates a mock fetch function for GitHub adapter
- **Pre-condiciones**: None
- **Post-condiciones**: Returns jest.Mock that resolves with the provided response

#### `createMockRoute(): (template, ...params) => MockRoute`

- **Proposito**: Creates a tag template function matching @forge/api's route()
- **Pre-condiciones**: None
- **Post-condiciones**: Returns function that interpolates params into MockRoute

#### `createForgeApiMockSet(defaultResponse?: MockAPIResponse): ForgeApiMockSet`

- **Proposito**: Creates a complete set of all @forge/api mock functions
- **Pre-condiciones**: None
- **Post-condiciones**: Returns object with all mock functions

#### `createForgeApiModuleMock(defaultResponse?: MockAPIResponse): Record<string, unknown>`

- **Proposito**: Creates the full mock module object for jest.mock('@forge/api', ...)
- **Pre-condiciones**: None
- **Post-condiciones**: Returns object compatible with jest.mock factory

---

## Dependencias (imports)

### Externas (npm)

- `jest` — jest.Mock types

### NOTA: Capa de test

- This file is in `tests/mocks/` — test infrastructure, not production code

---

## Estrategia de Test

### Unit Tests (`tests/mocks/forge-api.spec.ts`)

| Test                                               | AC cubierto | Regla cubierta |
| -------------------------------------------------- | ----------- | -------------- |
| createMockResponse returns correct defaults        | AC-01       | -              |
| createMockResponse returns JSON body via json()    | AC-01       | -              |
| createMockResponse returns text body via text()    | AC-01       | -              |
| createMockResponse headers get/has/forEach work    | AC-01       | -              |
| okResponse creates 200 response                    | AC-02       | -              |
| notFoundResponse creates 404 response              | AC-02       | -              |
| rateLimitedResponse creates 429 with Retry-After   | AC-02       | -              |
| serverErrorResponse creates 500                    | AC-02       | -              |
| forbiddenResponse creates 403                      | AC-02       | -              |
| createMockRequestJira returns jest.Mock            | AC-03       | -              |
| createMockRequestConfluence returns jest.Mock      | AC-03       | -              |
| createMockForgeFetch returns jest.Mock             | AC-03       | -              |
| createMockRoute interpolates params into MockRoute | AC-04       | -              |
| createForgeApiMockSet returns all mock functions   | AC-05       | -              |
| No any types exported                              | AC-06       | ARCH-SOLID-202 |

---

## Historial de Cambios

| Fecha      | Tarea Ralph | Cambio         |
| ---------- | ----------- | -------------- |
| 2026-04-26 | RTASK-028   | Creado inicial |
