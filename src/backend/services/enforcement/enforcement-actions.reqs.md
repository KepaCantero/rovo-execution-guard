# REQUISITOS: enforcement-actions

> **Sidecar File** | Vinculado a: `src/backend/services/enforcement/enforcement-actions.ts`

---

## Descripcion

Modulo de acciones de enforcement (cumplimiento) que ejecuta las decisiones del sistema de quality gates
sobre tickets de Jira y Pull Requests de GitHub. Traduce los resultados de evaluacion en acciones concretas:
bloquear transiciones, bloquear/aprobar PRs, publicar comentarios formateados, y registrar inconsistencias.
Capa SERVICE que delega a los adaptadores jira-adapter y github-adapter (capa REPOSITORY).

---

## Acceptance Criteria

- [ ] **AC-01**: `blockTransition` impide la transicion de Jira y publica un comentario explicando el bloqueo
- [ ] **AC-02**: `blockPR` crea un status check de fallo en el PR de GitHub y publica un comentario con razones
- [ ] **AC-03**: `addComment` publica comentarios en Jira (formato ADF/plano) o GitHub (Markdown) segun target
- [ ] **AC-04**: `flagInconsistency` registra la inconsistencia y publica un comentario en el ticket asociado
- [ ] **AC-05**: `approvePR` crea un status check de exito en el PR y publica un comentario con scores
- [ ] **AC-06**: `executeAction` despacha la accion correcta basada en el tipo discriminado de EnforcementAction
- [ ] **AC-07**: Todas las acciones generan entradas de audit log estructurado con executionId
- [ ] **AC-08**: Templates de comentarios (Jira y GitHub) incluyen score tables, indicadores visuales, y suggestions
- [ ] **AC-09**: Zero `any` usage — solo unknown, generics, y discriminated unions
- [ ] **AC-10**: Test coverage > 85%

---

## Reglas del Rulebook

Las siguientes reglas del RULEBOOK.md deben respetarse en este modulo:

| ID Regla          | Categoria    | Descripcion breve                                              |
| ----------------- | ------------ | -------------------------------------------------------------- |
| [FORGE-OPS-005]   | Forge Ops    | No exceder 10s de ejecucion por invocacion                     |
| [FORGE-OPS-0101]  | Forge Ops    | Completar trabajo critico en max 8s (2s margen)                |
| [FORGE-OPS-008]   | Forge Ops    | Max 100 network requests por invocacion                        |
| [FORGE-OPS-0105]  | Forge Ops    | Funciones stateless, sin estado mutable a nivel modulo         |
| [SEC-PRIV-002]    | Seguridad    | No incluir datos sensibles en logs o comentarios               |
| [SEC-PRIV-004]    | Seguridad    | Validar toda entrada externa antes de procesar                 |
| [SEC-PRIV-005]    | Seguridad    | Audit log con retencion y clasificacion                        |
| [SEC-PRIV-008]    | Seguridad    | Minimizacion de datos — solo metadatos necesarios              |
| [SEC-PRIV-010]    | Seguridad    | Audit log: quien, que, cuando, recurso                         |
| [GH-INTEG-305]    | GitHub       | Status checks usan contexto `rovo-execution-guard/consistency` |
| [GH-INTEG-306]    | GitHub       | Handlers idempotentes via X-GitHub-Delivery                    |
| [ARCH-SOLID-058]  | Arquitectura | Zero dependencias de framework en tipos de dominio             |
| [ARCH-SOLID-202]  | Arquitectura | Zero `any` — usar unknown, generics, discriminated unions      |
| [ARCH-SOLID-053]  | Arquitectura | Tipos de error de dominio para todos los caminos de fallo      |
| [ARCH-SOLID-006]  | Arquitectura | Patron Handler -> Service -> Repository                        |
| [ARCH-SOLID-232]  | Arquitectura | Named exports solo, no export default                          |
| [ARCH-SOLID-203]  | Arquitectura | Interfaces con propiedades readonly                            |
| [ARCH-SOLID-0912] | Arquitectura | Idempotente — misma entrada produce misma salida               |
| [ARCH-SOLID-052]  | Arquitectura | Helpers extraidos para funciones concisas                      |
| [TEST-QA-036-03]  | Testing      | Sentry events incluyen structured context con executionId      |

---

## Contrato Publico (API del modulo)

### Funciones exportadas

#### `blockTransition(issueKey: string, transitionId: string, reason: string, executionId?: string, timeoutMs?: number): Promise<AuditLogEntry>`

- **Proposito**: Prevenir una transicion de workflow de Jira publicando un comentario de bloqueo
- **Pre-condiciones**: issueKey valido, transitionId valido
- **Post-condiciones**: Comentario publicado en Jira, audit log generado
- **Errores**: `JiraApiError` si la API falla, `TimeoutError` si excede timeout
- **AC ref**: AC-01

#### `blockPR(repo: string, prNumber: number, commitSha: string, reason: string, token: string, details: Record<string, unknown>, executionId?: string, timeoutMs?: number): Promise<AuditLogEntry>`

- **Proposito**: Crear status check de fallo en PR y publicar comentario con razones de bloqueo
- **Pre-condiciones**: repo en formato owner/repo, token valido, commitSha valido
- **Post-condiciones**: Status check `failure` creado, comentario publicado, audit log generado
- **Errores**: `GitHubApiError` si la API falla, `TokenExpiredError` si token expirado, `TimeoutError` si excede timeout
- **AC ref**: AC-02

#### `addComment(target: 'jira' | 'github', identifier: string, body: string, executionId?: string, timeoutMs?: number, token?: string): Promise<AuditLogEntry>`

- **Proposito**: Publicar comentario generico en Jira o GitHub
- **Pre-condiciones**: target valido, identifier (issueKey o repo#pr), body no vacio
- **Post-condiciones**: Comentario publicado, audit log generado
- **Errores**: `JiraApiError` o `GitHubApiError` segun target, `TimeoutError` si excede timeout
- **AC ref**: AC-03

#### `flagInconsistency(inconsistency: Inconsistency, executionId?: string, timeoutMs?: number): Promise<AuditLogEntry>`

- **Proposito**: Registrar inconsistencia y publicar comentario en el ticket afectado
- **Pre-condiciones**: inconsistency con affectedTicketKey valido
- **Post-condiciones**: Comentario publicado en Jira, audit log generado
- **Errores**: `JiraApiError` si la API falla, `TimeoutError` si excede timeout
- **AC ref**: AC-04

#### `approvePR(repo: string, prNumber: number, commitSha: string, token: string, details: Record<string, unknown>, executionId?: string, timeoutMs?: number): Promise<AuditLogEntry>`

- **Proposito**: Crear status check de exito en PR y publicar comentario con scores
- **Pre-condiciones**: repo en formato owner/repo, token valido, commitSha valido
- **Post-condiciones**: Status check `success` creado, comentario publicado, audit log generado
- **Errores**: `GitHubApiError` si la API falla, `TokenExpiredError` si token expirado, `TimeoutError` si excede timeout
- **AC ref**: AC-05

#### `executeAction(action: EnforcementAction, context: EnforcementContext): Promise<AuditLogEntry>`

- **Proposito**: Despachar la accion correcta basada en el tipo discriminado de EnforcementAction
- **Pre-condiciones**: accion valida con tipo discriminado, contexto con campos requeridos
- **Post-condiciones**: Accion ejecutada, audit log generado
- **Errores**: El error correspondiente a la accion despachada
- **AC ref**: AC-06

---

## Dependencias (imports)

### Internas (proyecto)

- `src/backend/types/enforcement` -> `EnforcementAction` (discriminated union)
- `src/backend/types/inconsistency` -> `Inconsistency`
- `src/backend/types/audit-log` -> `AuditLogEntry`, `AuditAction`
- `src/backend/types/github-data` -> `GitHubStatusCheck`
- `src/backend/types/quality-gate` -> `QualityGateResult`
- `src/backend/types/errors` -> `REGError`, `JiraApiError`, `GitHubApiError`, `TimeoutError`
- `src/backend/services/jira/jira-adapter` -> `addComment` (Jira)
- `src/backend/services/github/github-adapter` -> `createStatusCheck`, `createPRComment`

### Externas (npm)

- Ninguna. Zero dependencias externas.

### NOTA: Capa de servicio

- Este archivo esta en `src/backend/services/enforcement/` -> SERVICE layer
- Delega a adapters (jira-adapter, github-adapter) -> REPOSITORY layer
- No hace llamadas HTTP directas

---

## Estrategia de Test

### Unit Tests (`tests/unit/services/enforcement/enforcement-actions.spec.ts`)

| Test                                                            | AC cubierto | Regla cubierta |
| --------------------------------------------------------------- | ----------- | -------------- |
| blockTransition should post comment and return audit entry      | AC-01       | SEC-PRIV-010   |
| blockTransition should throw JiraApiError on adapter failure    | AC-01       | ARCH-SOLID-053 |
| blockPR should create failure status check and comment          | AC-02       | GH-INTEG-305   |
| blockPR should throw GitHubApiError on adapter failure          | AC-02       | ARCH-SOLID-053 |
| addComment should delegate to jira-adapter when target=jira     | AC-03       | ARCH-SOLID-006 |
| addComment should delegate to github-adapter when target=github | AC-03       | ARCH-SOLID-006 |
| flagInconsistency should post severity-colored comment          | AC-04       | SEC-PRIV-010   |
| approvePR should create success status check and comment        | AC-05       | GH-INTEG-305   |
| executeAction should dispatch block_transition correctly        | AC-06       | ARCH-SOLID-006 |
| executeAction should dispatch block_pr correctly                | AC-06       | ARCH-SOLID-006 |
| executeAction should dispatch add_comment correctly             | AC-06       | ARCH-SOLID-006 |
| executeAction should dispatch flag_inconsistency correctly      | AC-06       | ARCH-SOLID-006 |
| all functions should include executionId in structured logs     | AC-07       | TEST-QA-036-03 |
| comment templates should include score tables and indicators    | AC-08       | -              |
| no any types in module                                          | AC-09       | ARCH-SOLID-202 |

---

## Historial de Cambios

| Fecha | Tarea Ralph | Cambio         |
| ----- | ----------- | -------------- |
|       | RTASK-017   | Creado inicial |
