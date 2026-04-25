# REQUISITOS: workflow-transition

> **Sidecar File** | Vinculado a: `src/backend/resolvers/workflow-transition.ts`

---

## Descripcion

Handler para el Jira workflow trigger que intercepta transiciones de tickets y ejecuta Quality Gates
antes de permitir o bloquear el cambio de estado. Es el primary enforcement entry point del sistema
desde el lado de Jira. Delegado por manifest.yml como `trigger: onJiraWorkflowTransition`.
Capa HANDLER que orquesta el evaluation pipeline (SERVICE) y ejecuta enforcement actions (SERVICE).

---

## Acceptance Criteria

- [ ] **AC-01**: Trigger ejecuta en las transiciones de workflow configuradas (To Do->In Progress, In Progress->In Review, In Review->Done)
- [ ] **AC-02**: Gate 1 (Definition) bloquea transicion si score < threshold
- [ ] **AC-03**: Comentario en ticket explica razones del bloqueo con score breakdown y suggestions
- [ ] **AC-04**: Fail-open en error de evaluacion: permite transicion y registra el error en log + comentario
- [ ] **AC-05**: Tiempo de respuesta < 5 segundos (Forge limit)
- [ ] **AC-06**: Audit log generado para cada evaluacion con gate_evaluated action
- [ ] **AC-07**: Configurable por proyecto (gates activos/inactivos via ProjectConfig)
- [ ] **AC-08**: Unit test coverage > 85%
- [ ] **AC-09**: `.reqs.md` sidecar creado

---

## Reglas del Rulebook

Las siguientes reglas del RULEBOOK.md deben respetarse en este modulo:

| ID Regla          | Categoria    | Descripcion breve                                                        |
| ----------------- | ------------ | ------------------------------------------------------------------------ |
| [FORGE-OPS-001]   | Forge Ops    | manifest.yml con app, modules, permissions                               |
| [FORGE-OPS-004]   | Forge Ops    | permissions.external.fetch solo dominios necesarios, sin wildcards       |
| [FORGE-OPS-005]   | Forge Ops    | No exceder 10s de ejecucion por invocacion                               |
| [FORGE-OPS-0101]  | Forge Ops    | Completar trabajo critico en max 8s (2s margen)                          |
| [FORGE-OPS-0105]  | Forge Ops    | Funciones stateless, sin estado mutable a nivel modulo                   |
| [FORGE-OPS-053]   | Forge Ops    | Fallos no deben dejar el sistema en estado inconsistente                 |
| [FORGE-OPS-054]   | Forge Ops    | Degradacion graceful cuando Rovo/GitHub unavailable                      |
| [SEC-PRIV-002]    | Seguridad    | No incluir datos sensibles en logs o comentarios                         |
| [SEC-PRIV-004]    | Seguridad    | Validar toda entrada externa antes de procesar                           |
| [SEC-PRIV-008]    | Seguridad    | Minimizacion de datos — solo metadatos necesarios                        |
| [SEC-PRIV-010]    | Seguridad    | Audit log: quien, que, cuando, recurso                                   |
| [ARCH-SOLID-058]  | Arquitectura | Zero dependencias de framework en tipos de dominio                       |
| [ARCH-SOLID-202]  | Arquitectura | Zero `any` — usar unknown, generics, discriminated unions                |
| [ARCH-SOLID-053]  | Arquitectura | Tipos de error de dominio para todos los caminos de fallo                |
| [ARCH-SOLID-006]  | Arquitectura | Patron Handler -> Service -> Repository                                  |
| [ARCH-SOLID-232]  | Arquitectura | Named exports solo, no export default                                    |
| [ARCH-SOLID-203]  | Arquitectura | Interfaces con propiedades readonly                                      |
| [ARCH-SOLID-061]  | Arquitectura | Bounded contexts: Ticket Validation (Jira-side)                          |
| [ARCH-SOLID-052]  | Arquitectura | Funciones <= 20 lineas de logica, max 3 niveles de anidamiento           |
| [ROVO-INTEG-001]  | Rovo         | Confluence API v2 usa paginacion basada en cursores                      |
| [ROVO-INTEG-004]  | Rovo         | Contexto de Rovo tratado como datos no confiables, validado antes de uso |
| [ROVO-INTEG-005]  | Rovo         | Timeout propio max 5s, fallback graceful cuando Rovo unavailable         |
| [ROVO-INTEG-0915] | Rovo         | Rovo es enhancer, nunca requerimiento obligatorio                        |
| [TEST-QA-036-03]  | Testing      | Sentry events incluyen structured context con executionId                |

---

## Contrato Publico (API del modulo)

### Funciones exportadas

#### `onJiraWorkflowTransition(event: JiraWorkflowTransitionEvent): Promise<JiraWorkflowTransitionResult>`

- **Proposito**: Handler principal del Jira workflow trigger. Intercepta transiciones, evalua quality gates, y bloquea/permite el cambio de estado.
- **Pre-condiciones**: Evento de transicion valido con issueKey y transitionId
- **Post-condiciones**: Retorna resultado indicando si la transicion debe proceder o bloquearse, con audit log generado
- **Errores**: Nunca lanza — fail-open permite transicion en caso de error
- **AC ref**: AC-01, AC-02, AC-03, AC-04

### Tipos exportados

#### `JiraWorkflowTransitionEvent`

- `issueKey: string` — clave del ticket (e.g., "PROJ-123")
- `transitionId: string` — ID de la transicion
- `fromStatus: string` — status origen
- `toStatus: string` — status destino
- `projectKey: string` — clave del proyecto

#### `JiraWorkflowTransitionResult`

- `allowed: boolean` — si la transicion debe proceder
- `reason?: string` — razon del bloqueo (si bloqueado)
- `executionId: string` — ID de la ejecucion
- `score?: ConsistencyScore` — score calculado (si evaluacion exitosa)

---

## Flujo del Handler

1. Parsear evento de transicion (issueKey, fromStatus, toStatus, projectKey)
2. Obtener ProjectConfig via jira-adapter
3. Verificar si la gate correspondiente esta habilitada (si no, auto-permitir)
4. Llamar `evaluateTicketForGate(ticketKey, toStatus, projectConfig)`
5. Si evaluacion falla (fail-open): permitir transicion, loggear error, publicar comentario
6. Si evaluacion pasa: permitir transicion
7. Si evaluacion no pasa: ejecutar enforcement actions via `executeAction`
8. Escribir audit log entry a Forge Storage
9. Retornar resultado

### Transition-to-Gate Mapping

| From Status | To Status   | Gate Type  | Description                      |
| ----------- | ----------- | ---------- | -------------------------------- |
| To Do       | In Progress | definition | Gate 1: Definition quality check |
| In Progress | In Review   | execution  | Gate 2: Execution quality check  |
| In Review   | Done        | delivery   | Gate 3: Delivery quality check   |

---

## Dependencias (imports)

### Internas (proyecto)

- `src/backend/types/quality-gate` -> `GateType`, `QualityGateResult`
- `src/backend/types/consistency-score` -> `ConsistencyScore`
- `src/backend/types/audit-log` -> `AuditLogEntry`, `AuditAction`
- `src/backend/types/project-config` -> `ProjectConfig`
- `src/backend/types/errors` -> `REGError`, `JiraApiError`
- `src/backend/services/evaluation/evaluation-pipeline` -> `evaluateTicketForGate`, `EvaluationPipelineResult`
- `src/backend/services/enforcement/enforcement-actions` -> `blockTransition`, `addComment`, `executeAction`
- `src/backend/services/jira/jira-adapter` -> `getProjectConfig`, `addComment` (for fail-open notification)

### Externas (npm)

- `@forge/api` -> `storage` (para escribir audit log entries)

### NOTA: Capa de handler

- Este archivo esta en `src/backend/resolvers/` -> HANDLER layer
- Delega al evaluation pipeline (SERVICE layer)
- Delega a enforcement-actions (SERVICE layer)
- No contiene logica de negocio — solo parseo, dispatch, y error handling

---

## Estrategia de Test

### Unit Tests (`tests/unit/resolvers/workflow-transition.spec.ts`)

| Test                                                                         | AC cubierto  | Regla cubierta |
| ---------------------------------------------------------------------------- | ------------ | -------------- |
| onJiraWorkflowTransition happy path: score above threshold allows transition | AC-01, AC-02 | ARCH-SOLID-006 |
| onJiraWorkflowTransition score below threshold blocks and comments           | AC-02, AC-03 | SEC-PRIV-010   |
| onJiraWorkflowTransition fail-open on evaluation error                       | AC-04        | FORGE-OPS-054  |
| onJiraWorkflowTransition completes within 5s                                 | AC-05        | FORGE-OPS-0101 |
| onJiraWorkflowTransition generates audit log entry                           | AC-06        | SEC-PRIV-010   |
| onJiraWorkflowTransition respects disabled gates in project config           | AC-07        | -              |
| onJiraWorkflowTransition maps To Do->In Progress to definition gate          | AC-01        | ARCH-SOLID-061 |
| onJiraWorkflowTransition maps In Progress->In Review to execution gate       | AC-01        | ARCH-SOLID-061 |
| onJiraWorkflowTransition maps In Review->Done to delivery gate               | AC-01        | ARCH-SOLID-061 |
| onJiraWorkflowTransition unknown status transition auto-allows               | AC-01        | -              |
| onJiraWorkflowTransition publishes explanatory comment on block              | AC-03        | SEC-PRIV-002   |
| onJiraWorkflowTransition publishes comment on fail-open error                | AC-04        | SEC-PRIV-002   |
| onJiraWorkflowTransition invalid event data fails gracefully                 | -            | SEC-PRIV-004   |
| onJiraWorkflowTransition enforcement actions dispatched correctly            | AC-02        | ARCH-SOLID-006 |

---

## Historial de Cambios

| Fecha | Tarea Ralph | Cambio         |
| ----- | ----------- | -------------- |
|       | RTASK-014   | Creado inicial |
