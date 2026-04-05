# REQUISITOS: [ModuleName]

> **Sidecar File** | Vinculado a: `src/[path]/[filename].ts`

---

## Descripcion
[Por que existe este modulo. Que problema resuelve. Que valor aporta al Rovo Execution Guard.]

---

## Acceptance Criteria

- [ ] **AC-01**: [Criterio de aceptacion 1 - especifico y verificable]
- [ ] **AC-02**: [Criterio de aceptacion 2]
- [ ] **AC-03**: [Criterio de aceptacion 3]
- [ ] **AC-04**: [Criterio de aceptacion 4]
- [ ] **AC-05**: [Criterio de aceptacion 5]

---

## Reglas del Rulebook

Las siguientes reglas del RULEBOOK.md deben respetarse en este modulo:

| ID Regla | Categoria | Descripcion breve |
|----------|-----------|-------------------|
| [ARCH-SOLID-001] | Arquitectura | Separacion de capas estricta |
| [ARCH-SOLID-002] | Arquitectura | Sin dependencias externas en dominio |
| [FORGE-OPS-001] | Forge Ops | Respetar limits de ejecucion y latencia |
| [SEC-PRIV-001] | Seguridad | Scopes minimos (Least Privilege) |

---

## Contrato Publico (API del modulo)

### Funciones exportadas

#### `functionName(param1: Type1, param2: Type2): ReturnType`
- **Proposito**: [Que hace]
- **Pre-condiciones**: [Que debe cumplirse antes de llamar]
- **Post-condiciones**: [Que se garantiza despues]
- **Errores**: [Que errores puede lanzar y cuando]

#### `anotherFunction(param: Type): Promise<Result>`
- **Proposito**: [Que hace]
- **Pre-condiciones**: [Que debe cumplirse]
- **Post-condiciones**: [Que se garantiza]
- **Errores**: [Que errores puede lanzar]

---

## Dependencias (imports)

### Internas (proyecto)
- `src/backend/types` -> `[Tipos usados]`

### Externas (npm)
- [lista de dependencias externas, si las hay]

### NOTA: Capa de dominio
- Si este archivo esta en `src/backend/services/scoring/` -> ZERO dependencias externas
- Si este archivo esta en `src/backend/services/jira/` -> puede usar `@forge/api`

---

## Estrategia de Test

### Unit Tests (`tests/unit/[mirror-path].spec.ts`)
| Test | AC cubierto | Regla cubierta |
|------|------------|----------------|
| should return correct result for valid input | AC-01 | - |
| should handle edge case | AC-02 | RULE-ID |
| should throw on invalid input | - | RULE-ID |

### Integration Tests (`tests/integration/[mirror-path].spec.ts`)
- [Que se prueba a nivel de integracion, si aplica]

### E2E Tests
- [Que flujo E2E cubre este modulo, si aplica]

---

## Historial de Cambios

| Fecha | Tarea Ralph | Cambio |
|-------|-------------|--------|
| | RTASK-XXX | Creado inicial |
