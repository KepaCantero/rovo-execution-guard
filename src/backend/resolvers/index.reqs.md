# REQUISITOS: Custom UI Resolvers (Forge Bridge)

> **Sidecar File** | Vinculado a: `src/backend/resolvers/index.ts`

---

## Descripcion

Forge Custom UI resolvers que conectan el frontend (React Custom UI) con los servicios del backend.
Expone 8 funciones invocables desde Custom UI via `@forge/resolver` para consultar scores,
inconsistencias, quality gates, configuracion, audit log, y disparar enriquecimiento y revalidacion.
Capa HANDLER que delega al SERVICE layer (scoring-engine, inconsistency-detector, quality-gate-rules,
evaluation-pipeline, jira-adapter, rovo-adapter).

---

## Acceptance Criteria

- [ ] **AC-01**: All resolvers work via `@forge/resolver` `resolver.define()`
- [ ] **AC-02**: Resolvers are invocable from Custom UI with proper name mapping
- [ ] **AC-03**: Permission validation on each resolver (admin-only for write ops)
- [ ] **AC-04**: Basic rate limiting implemented (in-memory sliding window)
- [ ] **AC-05**: Input sanitization on all string parameters
- [ ] **AC-06**: Structured logging on each invocation with executionId
- [ ] **AC-07**: Unit test coverage > 85%
- [ ] **AC-08**: `.reqs.md` sidecar created

---

## Reglas del Rulebook

Las siguientes reglas del RULEBOOK.md deben respetarse en este modulo:

| ID Regla         | Categoria    | Descripcion breve                                                 |
| ---------------- | ------------ | ----------------------------------------------------------------- |
| [FORGE-OPS-003]  | Forge Ops    | No declarar mas de 100 modulos en manifest.yml                    |
| [FORGE-OPS-005]  | Forge Ops    | Ninguna invocacion exceder 10 segundos                            |
| [FORGE-OPS-0101] | Forge Ops    | Completar trabajo critico en max 8s (2s margen)                   |
| [FORGE-OPS-0105] | Forge Ops    | Funciones stateless, sin estado mutable a nivel modulo            |
| [FORGE-OPS-053]  | Forge Ops    | Fallos no deben dejar el sistema en estado inconsistente          |
| [FORGE-OPS-054]  | Forge Ops    | Degradacion graceful cuando servicios unavailable                 |
| [SEC-PRIV-002]   | Seguridad    | No incluir datos sensibles en logs o respuestas                   |
| [SEC-PRIV-003]   | Seguridad    | Token lifecycle: obtener token fresco, nunca cachear              |
| [SEC-PRIV-004]   | Seguridad    | Validar toda entrada externa antes de procesar                    |
| [SEC-PRIV-008]   | Seguridad    | Minimizacion de datos — solo metadatos necesarios                 |
| [SEC-PRIV-010]   | Seguridad    | Audit log: quien, que, cuando, recurso                            |
| [ARCH-SOLID-004] | Arquitectura | Logica de negocio en Forge Functions, no en UI Kit                |
| [ARCH-SOLID-006] | Arquitectura | Patron Handler -> Service -> Repository                           |
| [ARCH-SOLID-052] | Arquitectura | Funciones <= 20 lineas de logica, max 3 niveles de anidamiento    |
| [ARCH-SOLID-053] | Arquitectura | Tipos de error de dominio para todos los caminos de fallo         |
| [ARCH-SOLID-058] | Arquitectura | Solo resolvers importan @forge/resolver; servicios framework-free |
| [ARCH-SOLID-061] | Arquitectura | Bounded contexts: Custom UI Query, Ticket Validation              |
| [ARCH-SOLID-202] | Arquitectura | Zero `any` — usar unknown, generics, discriminated unions         |
| [ARCH-SOLID-203] | Arquitectura | Interfaces con propiedades readonly                               |
| [ARCH-SOLID-232] | Arquitectura | Named exports solo, no export default                             |
| [TEST-QA-036-03] | Testing      | Sentry events incluyen structured context con executionId         |

---

## Contrato Publico (API del modulo)

### Resolver Names (registered via resolver.define)

| Resolver Name          | Handler Signature                                                   | Returns                               |
| ---------------------- | ------------------------------------------------------------------- | ------------------------------------- |
| `getConsistencyScore`  | `(payload: { issueKey: string })`                                   | `ResolverResponse<ConsistencyScore>`  |
| `getInconsistencies`   | `(payload: { issueKey: string })`                                   | `ResolverResponse<Inconsistency[]>`   |
| `getQualityGateStatus` | `(payload: { issueKey: string; gateType: GateType })`               | `ResolverResponse<QualityGateResult>` |
| `getProjectConfig`     | `(payload: { projectKey: string })`                                 | `ResolverResponse<ProjectConfig>`     |
| `updateProjectConfig`  | `(payload: { projectKey: string; config: Partial<ProjectConfig> })` | `ResolverResponse<void>`              |
| `getAuditLog`          | `(payload: { projectKey: string; limit?: number })`                 | `ResolverResponse<AuditLogEntry[]>`   |
| `enrichTicket`         | `(payload: { issueKey: string })`                                   | `ResolverResponse<void>`              |
| `revalidateTicket`     | `(payload: { issueKey: string })`                                   | `ResolverResponse<ConsistencyScore>`  |

### Funciones exportadas

#### `registerResolvers(): void`

- **Proposito**: Registra todos los resolvers via `resolver.define()`. Debe llamarse en el entry point de la app.
- **Pre-condiciones**: `@forge/resolver` disponible
- **Post-condiciones**: Todos los 8 resolvers registrados y accesibles desde Custom UI

### Tipos exportados

#### `ResolverResponse<T>`

- `success: boolean` — indica si la operacion fue exitosa
- `data?: T` — datos de respuesta (si success)
- `error?: string` — mensaje de error (si no success)
- `executionId: string` — ID unico de la ejecucion

#### `RateLimiterConfig`

- `maxRequests: number` — maximo de requests por ventana
- `windowMs: number` — tamano de la ventana en milisegundos

---

## Flujo por Resolver

### getConsistencyScore

1. Validar issueKey (non-empty, sanitized)
2. Verificar permisos (read access)
3. Fetch ticket data via jira-adapter
4. Calculate score via scoring-engine
5. Retornar score con executionId

### getInconsistencies

1. Validar issueKey
2. Verificar permisos (read access)
3. Fetch ticket data via jira-adapter
4. Detect inconsistencies via inconsistency-detector
5. Retornar lista con executionId

### getQualityGateStatus

1. Validar issueKey, gateType
2. Verificar permisos (read access)
3. Fetch ticket data + project config
4. Run evaluation pipeline
5. Retornar gate result con executionId

### getProjectConfig

1. Validar projectKey
2. Verificar permisos (read access)
3. Fetch config via jira-adapter
4. Retornar config con executionId

### updateProjectConfig

1. Validar projectKey, config
2. Verificar permisos (admin-only)
3. Sanitize config input
4. Save config via jira-adapter
5. Write audit log
6. Retornar void con executionId

### getAuditLog

1. Validar projectKey, limit
2. Verificar permisos (read access)
3. Fetch audit entries
4. Retornar entries con executionId

### enrichTicket

1. Validar issueKey
2. Verificar permisos (write access)
3. Fetch Rovo context via rovo-adapter
4. Graceful fallback if Rovo unavailable
5. Retornar void con executionId

### revalidateTicket

1. Validar issueKey
2. Verificar permisos (write access)
3. Run full evaluation pipeline
4. Retornar score con executionId

---

## Dependencias (imports)

### Internas (proyecto)

- `src/backend/types/consistency-score` -> `ConsistencyScore`
- `src/backend/types/inconsistency` -> `Inconsistency`
- `src/backend/types/quality-gate` -> `QualityGateResult`, `GateType`
- `src/backend/types/project-config` -> `ProjectConfig`
- `src/backend/types/audit-log` -> `AuditLogEntry`
- `src/backend/types/errors` -> `REGError`
- `src/backend/services/scoring/scoring-engine` -> `calculateScore`
- `src/backend/services/scoring/inconsistency-detector` -> `detectInconsistencies`
- `src/backend/services/scoring/quality-gate-rules` -> `evaluateGate`
- `src/backend/services/evaluation/evaluation-pipeline` -> `evaluateTicketForGate`
- `src/backend/services/jira/jira-adapter` -> `getTicketData`, `getProjectConfig`, `saveProjectConfig`
- `src/backend/services/rovo/rovo-adapter` -> `getContext`

### Externas (npm)

- `@forge/resolver` -> `resolver` (unica dependencia Forge en este modulo)

### NOTA: Capa de handler

- Este archivo esta en `src/backend/resolvers/` -> HANDLER layer
- Solo este modulo importa `@forge/resolver`
- Delega al SERVICE layer, no contiene logica de negocio
- Todos los servicios permanecen framework-free [ARCH-SOLID-058]

---

## Estrategia de Test

### Unit Tests (`tests/unit/resolvers/index.spec.ts`)

| Test                                                        | AC cubierto  | Regla cubierta |
| ----------------------------------------------------------- | ------------ | -------------- |
| registerResolvers calls resolver.define for all 8 resolvers | AC-01, AC-02 | ARCH-SOLID-058 |
| getConsistencyScore returns score for valid issueKey        | AC-01        | ARCH-SOLID-006 |
| getConsistencyScore rejects empty issueKey                  | AC-05        | SEC-PRIV-004   |
| getInconsistencies returns list for valid issueKey          | AC-01        | ARCH-SOLID-006 |
| getQualityGateStatus returns result for valid input         | AC-01        | ARCH-SOLID-006 |
| getProjectConfig returns config for valid projectKey        | AC-01        | ARCH-SOLID-006 |
| updateProjectConfig requires admin permission               | AC-03        | SEC-PRIV-004   |
| updateProjectConfig saves and audits on valid input         | AC-01        | SEC-PRIV-010   |
| getAuditLog returns entries for valid projectKey            | AC-01        | SEC-PRIV-008   |
| enrichTicket triggers enrichment with graceful fallback     | AC-01        | FORGE-OPS-054  |
| revalidateTicket runs full evaluation pipeline              | AC-01        | ARCH-SOLID-006 |
| Rate limiter blocks excessive requests                      | AC-04        | FORGE-OPS-0105 |
| Input sanitization strips malicious content                 | AC-05        | SEC-PRIV-004   |
| Structured logging includes executionId                     | AC-06        | TEST-QA-036-03 |
| All resolvers return ResolverResponse structure             | AC-02        | ARCH-SOLID-203 |
| Service errors return error response, never throw           | -            | FORGE-OPS-053  |
| Invalid gateType returns validation error                   | AC-05        | SEC-PRIV-004   |

---

## Historial de Cambios

| Fecha | Tarea Ralph | Cambio         |
| ----- | ----------- | -------------- |
|       | RTASK-015   | Creado inicial |
