# REQUISITOS: evaluation-pipeline

> **Sidecar File** | Vinculado a: `src/backend/services/evaluation/evaluation-pipeline.ts`

---

## Descripcion

Pipeline compartido de evaluacion que orquesta el flujo completo de quality gate para un ticket:
fetch ticket data -> fetch Rovo context -> detect inconsistencies -> calculate score -> evaluate quality gate -> determine enforcement actions.
Usado por ambos triggers (Jira workflow transition en RTASK-014 y GitHub webhook en RTASK-016) para evitar duplicacion de logica de orquestacion.
Capa SERVICE que coordina adapters (jira-adapter, rovo-adapter), scoring services (scoring-engine, inconsistency-detector, quality-gate-rules),
y enforcement (enforcement-actions) en una unica funcion cohesionada.

---

## Acceptance Criteria

- [ ] **AC-EP-01**: `evaluateTicketForGate` orquesta el flujo completo: fetch ticket -> get context -> detect inconsistencies -> calculate score -> evaluate gate -> determine enforcement actions
- [ ] **AC-EP-02**: Retorna un resultado tipado (`EvaluationPipelineResult`) con score, inconsistencies, gate result, enforcement actions, y executionId
- [ ] **AC-EP-03**: Fail-open: si la evaluacion falla (API error, timeout), retorna resultado con `passed=true` y error registrado
- [ ] **AC-EP-04**: Timeout total de 5s (FORGE-OPS-005 con margen): cada paso respeta su propio timeout y el pipeline aborta si excede el total
- [ ] **AC-EP-05**: Usa `canTransition` de quality-gate-rules para mapear status destino a gate type
- [ ] **AC-EP-06**: Rovo context es opcional (graceful degradation): si falla, continua con solo rule-based detection
- [ ] **AC-EP-07**: Genera executionId unico para cada evaluacion, propagado a todos los servicios
- [ ] **AC-EP-08**: Structured logging en cada paso del pipeline con executionId
- [ ] **AC-EP-09**: Zero `any` usage — solo unknown, generics, y discriminated unions
- [ ] **AC-EP-10**: Test coverage > 85%
- [ ] **AC-EP-11**: Audit log entry generado para cada evaluacion (gate_evaluated action)

---

## Reglas del Rulebook

Las siguientes reglas del RULEBOOK.md deben respetarse en este modulo:

| ID Regla          | Categoria    | Descripcion breve                                                        |
| ----------------- | ------------ | ------------------------------------------------------------------------ |
| [FORGE-OPS-005]   | Forge Ops    | No exceder 10s de ejecucion por invocacion                               |
| [FORGE-OPS-0101]  | Forge Ops    | Completar trabajo critico en max 8s (2s margen)                          |
| [FORGE-OPS-008]   | Forge Ops    | Max 100 network requests por invocacion                                  |
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
| [ARCH-SOLID-061]  | Arquitectura | Bounded contexts: Ticket Validation, PR Enforcement, Context Analysis    |
| [ARCH-SOLID-052]  | Arquitectura | Funciones <= 20 lineas de logica, max 3 niveles de anidamiento           |
| [ARCH-SOLID-0912] | Arquitectura | Idempotente — misma entrada produce misma salida                         |
| [ROVO-INTEG-004]  | Rovo         | Contexto de Rovo tratado como datos no confiables, validado antes de uso |
| [ROVO-INTEG-005]  | Rovo         | Timeout propio max 5s, fallback graceful cuando Rovo unavailable         |
| [ROVO-INTEG-0915] | Rovo         | Rovo es enhancer, nunca requerimiento obligatorio                        |
| [TEST-QA-036-03]  | Testing      | Sentry events incluyen structured context con executionId                |

---

## Contrato Publico (API del modulo)

### Funciones exportadas

#### `evaluateTicketForGate(ticketKey: string, targetStatus: string, projectConfig: ProjectConfig, executionId?: string): Promise<EvaluationPipelineResult>`

- **Proposito**: Orquestar la evaluacion completa de un ticket contra un quality gate para un target status
- **Pre-condiciones**: ticketKey no vacio, targetStatus no vacio, projectConfig con gates configurados
- **Post-condiciones**: Retorna EvaluationPipelineResult con score, gate result, enforcement actions, y audit entry
- **Errores**: Nunca lanza — fail-open retorna resultado con error registrado y `passed=true`
- **AC ref**: AC-EP-01, AC-EP-02, AC-EP-03

### Tipos exportados

#### `EvaluationPipelineResult`

- `executionId: string` — ID unico de la evaluacion
- `ticketKey: string` — ticket evaluado
- `gateType: GateType` — gate evaluado (definition, execution, delivery)
- `score: ConsistencyScore` — score calculado
- `inconsistencies: readonly Inconsistency[]` — inconsistencias detectadas
- `gateResult: QualityGateResult` — resultado de la evaluacion del gate
- `enforcementActions: readonly EnforcementAction[]` — acciones de enforcement a ejecutar
- `auditEntry: AuditLogEntry` — entrada de audit log
- `error?: string` — mensaje de error si fail-open occurió

---

## Dependencias (imports)

### Internas (proyecto)

- `src/backend/types/jira-data` -> `JiraTicketData`
- `src/backend/types/quality-gate` -> `GateType`, `QualityGateResult`
- `src/backend/types/consistency-score` -> `ConsistencyScore`
- `src/backend/types/inconsistency` -> `Inconsistency`
- `src/backend/types/enforcement` -> `EnforcementAction`
- `src/backend/types/audit-log` -> `AuditLogEntry`, `AuditAction`
- `src/backend/types/project-config` -> `ProjectConfig`
- `src/backend/types/errors` -> `REGError`
- `src/backend/services/jira/jira-adapter` -> `getTicketData`
- `src/backend/services/rovo/rovo-adapter` -> `getContext`
- `src/backend/services/scoring/inconsistency-detector` -> `detectInconsistencies`
- `src/backend/services/scoring/scoring-engine` -> `calculateScore`, `ScoringInput`
- `src/backend/services/scoring/quality-gate-rules` -> `evaluateGate`, `GateEvaluationInput`, `determineEnforcementActions`

### Externas (npm)

- Ninguna. Zero dependencias externas.

### NOTA: Capa de servicio

- Este archivo esta en `src/backend/services/evaluation/` -> SERVICE layer
- Delega a adapters (jira-adapter, rovo-adapter) -> REPOSITORY layer
- Delega a domain services (scoring-engine, inconsistency-detector, quality-gate-rules) -> DOMAIN layer
- No hace llamadas HTTP directas

---

## Estrategia de Test

### Unit Tests (`tests/unit/services/evaluation/evaluation-pipeline.spec.ts`)

| Test                                                                | AC cubierto | Regla cubierta  |
| ------------------------------------------------------------------- | ----------- | --------------- |
| evaluateTicketForGate happy path: score above threshold passes gate | AC-EP-01    | ARCH-SOLID-006  |
| evaluateTicketForGate returns complete EvaluationPipelineResult     | AC-EP-02    | ARCH-SOLID-203  |
| evaluateTicketForGate fail-open on jira-adapter error               | AC-EP-03    | FORGE-OPS-054   |
| evaluateTicketForGate fail-open on rovo-adapter error (graceful)    | AC-EP-06    | ROVO-INTEG-0915 |
| evaluateTicketForGate timeout aborts and fail-opens                 | AC-EP-04    | FORGE-OPS-0101  |
| evaluateTicketForGate maps target status to correct gate type       | AC-EP-05    | ARCH-SOLID-061  |
| evaluateTicketForGate continues without Rovo context (degradation)  | AC-EP-06    | ROVO-INTEG-005  |
| evaluateTicketForGate generates unique executionId                  | AC-EP-07    | -               |
| evaluateTicketForGate logs structured entries with executionId      | AC-EP-08    | TEST-QA-036-03  |
| evaluateTicketForGate generates audit log entry                     | AC-EP-11    | SEC-PRIV-010    |
| evaluateTicketForGate score below threshold fails gate              | AC-EP-01    | -               |
| evaluateTicketForGate critical inconsistencies block execution gate | AC-EP-01    | -               |
| evaluateTicketForGate disabled gate auto-passes                     | AC-EP-05    | -               |
| evaluateTicketForGate empty ticketKey throws validation error       | -           | SEC-PRIV-004    |
| evaluateTicketForGate empty targetStatus throws validation error    | -           | SEC-PRIV-004    |

---

## Historial de Cambios

| Fecha      | Tarea Ralph | Cambio                                                                                                                                                                                                          |
| ---------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
|            | RTASK-014   | Creado inicial                                                                                                                                                                                                  |
| 2026-05-02 | RTASK-041   | AC-EP-12: Pipeline fetches RelationshipContext with graceful degradation. AC-EP-14: documentationRefs populated from RelationshipContext.documentation. BUG FIX: documentationRefs delivery gate now functional |
