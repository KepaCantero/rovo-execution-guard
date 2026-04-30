# REQUISITOS: agent-action resolver

> **Sidecar File** | Vinculado a: `src/backend/resolvers/agent-action.ts`

---

## Descripcion

Backend resolver for Rovo Agent actions. Routes incoming action payloads to the appropriate service based on `moduleKey`. This is a stub implementation — full routing logic is implemented in RTASK-034.

---

## Acceptance Criteria

- [ ] **AC-01**: Exports a `handler` function accepting `(payload, context)` arguments
- [ ] **AC-02**: Payload interface matches the Forge action contract (issueKey, prUrl, focusAxis, context)
- [ ] **AC-03**: Returns a string response (Forge action contract requirement)
- [ ] **AC-04**: Zero `any` usage — all types explicit

---

## Reglas del Rulebook

| ID Regla       | Categoria    | Descripcion breve                |
| -------------- | ------------ | -------------------------------- |
| ARCH-SOLID-058 | Arquitectura | HANDLER layer                    |
| ARCH-SOLID-006 | Arquitectura | Handler -> Service -> Repository |
| ARCH-SOLID-202 | Arquitectura | Zero any usage                   |
| ARCH-SOLID-232 | Arquitectura | Named exports only               |
| FORGE-OPS-005  | Forge Ops    | No invocation exceeds 10s        |
| FORGE-OPS-0105 | Forge Ops    | Stateless functions              |

---

## Contrato Publico (API del modulo)

### Funciones exportadas

#### `handler(payload: ActionPayload, context: ActionContext): string`

- **Proposito**: Routes Rovo Agent action payloads to the appropriate handler
- **Pre-condiciones**: Called by Forge when a Rovo Agent action is invoked
- **Post-condiciones**: Returns a string response for the agent to interpret
- **Errores**: None (stub always returns success)

---

## Dependencias (imports)

### Internas (proyecto)

- None (stub)

### Externas (npm)

- None

---

## Estrategia de Test

### Unit Tests (RTASK-034)

| Test                                     | AC cubierto | Regla cubierta |
| ---------------------------------------- | ----------- | -------------- |
| should route evaluate-issue action       | AC-01       | ARCH-SOLID-058 |
| should route check-pr-consistency action | AC-01       | ARCH-SOLID-058 |
| should handle unknown module key         | AC-01       | ARCH-SOLID-058 |
| should extract issueKey from payload     | AC-02       | FORGE-OPS-005  |

---

## Historial de Cambios

| Fecha      | Tarea Ralph | Cambio                                  |
| ---------- | ----------- | --------------------------------------- |
| 2026-04-30 | RTASK-033   | Created as stub for manifest validation |
