# REQUISITOS: github-webhook

> **Sidecar File** | Vinculado a: `src/backend/resolvers/github-webhook.ts`

---

## Descripcion

GitHub Webhook Handler for the Rovo Execution Guard system. Receives GitHub pull request events via webtrigger, validates HMAC-SHA256 signatures, extracts Jira ticket keys from PR title/body, and orchestrates quality gate evaluation via the evaluation pipeline. Dispatches enforcement actions (block/approve PR) and manages GitHub status checks based on evaluation results.

---

## Acceptance Criteria

- [ ] **AC-01**: HMAC-SHA256 signature validation with constant-time comparison (X-Hub-Signature-256 header)
- [ ] **AC-02**: Event routing: opened/synchronize -> Gate 2 (execution), closed/merged -> Gate 3 (delivery), edited -> re-extract Jira keys only
- [ ] **AC-03**: Jira key extraction from PR title/body using extractJiraKeysFromPR
- [ ] **AC-04**: For each Jira key: evaluateTicketForGate() then dispatch enforcement via blockPR/approvePR
- [ ] **AC-05**: GitHub status check created/updated per evaluation result (pending -> success/failure)
- [ ] **AC-06**: PRs without Jira keys gracefully ignored with warning log
- [ ] **AC-07**: Rate limiting to prevent webhook abuse
- [ ] **AC-08**: Structured logging with executionId across all stages
- [ ] **AC-09**: Fail-open: handler NEVER throws. All error paths return approved=true
- [ ] **AC-10**: Audit log entry written after evaluation
- [ ] **AC-11**: Configurable per project via getProjectConfig
- [ ] **AC-12**: Zero any, readonly interfaces, named exports only

---

## Reglas del Rulebook

Las siguientes reglas del RULEBOOK.md deben respetarse en este modulo:

| ID Regla          | Categoria    | Descripcion breve                                           |
| ----------------- | ------------ | ----------------------------------------------------------- |
| [FORGE-OPS-005]   | Forge Ops    | No invocation exceeds 10s                                   |
| [FORGE-OPS-0101]  | Forge Ops    | Complete critical work in max 8s                            |
| [FORGE-OPS-0105]  | Forge Ops    | Stateless functions, no module-level mutable state          |
| [FORGE-OPS-053]   | Forge Ops    | Failures must not leave inconsistent state                  |
| [FORGE-OPS-054]   | Forge Ops    | Graceful degradation when services unavailable              |
| [SEC-PRIV-002]    | Seguridad    | No sensitive data in logs or comments                       |
| [SEC-PRIV-004]    | Seguridad    | Validate all external input before processing               |
| [SEC-PRIV-008]    | Seguridad    | Data minimization                                           |
| [SEC-PRIV-010]    | Seguridad    | Audit log: who, what, when, resource                        |
| [SEC-PRIV-051]    | Seguridad    | Validate and sanitize all external input                    |
| [ARCH-SOLID-058]  | Arquitectura | Zero framework dependencies in domain                       |
| [ARCH-SOLID-202]  | Arquitectura | Zero any usage                                              |
| [ARCH-SOLID-006]  | Arquitectura | Handler -> Service -> Repository pattern                    |
| [ARCH-SOLID-232]  | Arquitectura | Named exports only                                          |
| [ARCH-SOLID-203]  | Arquitectura | Readonly interface properties                               |
| [ARCH-SOLID-061]  | Arquitectura | Bounded contexts defined                                    |
| [ARCH-SOLID-052]  | Arquitectura | Functions <= 20 lines, max 3 nesting                        |
| [GH-INTEG-306]    | GitHub       | Idempotent webhook handler (X-GitHub-Delivery dedup)        |
| [GH-INTEG-307]    | GitHub       | Filter by X-GitHub-Event header                             |
| [GH-INTEG-305]    | GitHub       | Status checks via POST /repos/{owner}/{repo}/statuses/{sha} |
| [GH-INTEG-302]    | GitHub       | Rate limiting for webhook abuse prevention                  |
| [ROVO-INTEG-004]  | Rovo         | Rovo context treated as untrusted data                      |
| [ROVO-INTEG-005]  | Rovo         | Rovo timeout max 5s, fallback graceful                      |
| [ROVO-INTEG-0915] | Rovo         | Rovo is enhancer, never requirement                         |

---

## Contrato Publico (API del modulo)

### Funciones exportadas

#### `onGitHubWebhook(request: GitHubWebhookRequest): Promise<GitHubWebhookResult>`

- **Proposito**: Main handler for GitHub webhook events. Validates HMAC, routes events, orchestrates evaluation and enforcement.
- **Pre-condiciones**: Request must contain valid GitHub webhook payload with appropriate headers.
- **Post-condiciones**: Returns result with approved/rejected status. Handler NEVER throws — all errors produce fail-open result.
- **Errores**: None thrown — all errors caught and returned as fail-open results.

#### `verifyHMACSignature(body: string, signature: string, secret: string): boolean`

- **Proposito**: Validates HMAC-SHA256 signature using constant-time comparison.
- **Pre-condiciones**: body is raw payload string, signature includes 'sha256=' prefix.
- **Post-condiciones**: Returns true if signature is valid, false otherwise.

#### `resolveGateForEvent(action: string, merged: boolean): GateType | undefined`

- **Proposito**: Maps PR event action to the appropriate gate type.
- **Pre-condiciones**: action is a valid PR action string.
- **Post-condiciones**: Returns GateType for gate evaluation, or undefined for edited/no-gate actions.

---

## Dependencias (imports)

### Internas (proyecto)

- `src/backend/types/quality-gate` -> `GateType`
- `src/backend/types/consistency-score` -> `ConsistencyScore`
- `src/backend/types/audit-log` -> `AuditLogEntry`
- `src/backend/types/project-config` -> `ProjectConfig`
- `src/backend/types/errors` -> `REGError`
- `src/backend/services/evaluation/evaluation-pipeline` -> `evaluateTicketForGate`, `EvaluationPipelineResult`
- `src/backend/services/enforcement/enforcement-actions` -> `blockPR`, `approvePR`, `addComment`
- `src/backend/services/github/github-adapter` -> `extractJiraKeysFromPR`, `getPRData`, `createStatusCheck`
- `src/backend/services/jira/jira-adapter` -> `getProjectConfig`

### Externas (npm)

- `crypto` -> `timingSafeEqual`, `createHmac` (Node.js built-in for HMAC validation)

---

## Estrategia de Test

### Unit Tests (`tests/unit/resolvers/github-webhook.spec.ts`)

| Test                                              | AC cubierto | Regla cubierta             |
| ------------------------------------------------- | ----------- | -------------------------- |
| should validate HMAC signature correctly          | AC-01       | SEC-PRIV-004, SEC-PRIV-051 |
| should reject invalid HMAC signature              | AC-01       | SEC-PRIV-004               |
| should reject missing HMAC signature              | AC-01       | SEC-PRIV-004               |
| should route opened event to execution gate       | AC-02       | GH-INTEG-307               |
| should route synchronize event to execution gate  | AC-02       | GH-INTEG-307               |
| should route closed/merged event to delivery gate | AC-02       | GH-INTEG-307               |
| should handle edited event (re-extract keys only) | AC-02       | GH-INTEG-307               |
| should ignore non-pull_request events             | AC-02       | GH-INTEG-307               |
| should extract Jira keys from PR title and body   | AC-03       | ARCH-SOLID-006             |
| should evaluate and block PR when gate fails      | AC-04       | ARCH-SOLID-006             |
| should evaluate and approve PR when gate passes   | AC-04       | ARCH-SOLID-006             |
| should create status checks per evaluation        | AC-05       | GH-INTEG-305               |
| should gracefully ignore PRs without Jira keys    | AC-06       | FORGE-OPS-054              |
| should rate limit webhook abuse                   | AC-07       | GH-INTEG-302               |
| should include executionId in all log entries     | AC-08       | TEST-QA-036-03             |
| should fail-open on evaluation error              | AC-09       | FORGE-OPS-053              |
| should fail-open on HMAC validation error         | AC-09       | FORGE-OPS-053              |
| should write audit log after evaluation           | AC-10       | SEC-PRIV-010               |
| should use project config for gate thresholds     | AC-11       | ARCH-SOLID-006             |
| should use constant-time HMAC comparison          | AC-01       | SEC-PRIV-004               |
| should deduplicate delivery IDs                   | AC-02       | GH-INTEG-306               |

---

## Historial de Cambios

| Fecha      | Tarea Ralph | Cambio         |
| ---------- | ----------- | -------------- |
| 2025-04-25 | RTASK-016   | Creado inicial |
