# RTASK-XXX: [Titulo]

> **Ralph Protocol Task** | Estado: `OPEN` | Prioridad: `[BLOCKER/HIGH/MEDIUM]`

---

## Metadatos

| Campo | Valor |
|-------|-------|
| **ID** | RTASK-XXX |
| **Ref** | docs/tickets/TASK-XXX |
| **Tipo** | `[DOMAIN/INTEGRATION/ORCHESTRATION/PRESENTATION/INFRASTRUCTURE]` |
| **Prioridad** | `[BLOCKER/HIGH/MEDIUM]` |
| **Esfuerzo estimado** | `[S/M/L]` |
| **Dependencias** | RTASK-XXX |
| **Asignado a** | GLM-5 (ejecucion) |
| **Auditado por** | Ralph |

---

## Hat: ARCHITECT (Claude)

### Decision de arquitectura
[Por que esta tarea existe y que decisiones tecnicas se tomaron]

### Riesgos identificados
| Riesgo | Impacto | Mitigacion |
|--------|---------|------------|
| [Riesgo 1] | [Impacto] | [Como mitigar] |

### Constraints
- [Constraint 1]
- [Constraint 2]

---

## Hat: EXECUTOR (GLM-5) - FLUJO DE EJECUCION

### PASO 0: Preparacion (OBLIGATORIO)

Antes de escribir una sola linea de codigo, GLM-5 DEBE:

1. **Leer esta tarea completa** (RTASK-XXX)
2. **Leer el ticket asociado** (`docs/tickets/TASK-XXX.md`)
3. **Leer el RULEBOOK.md** (reglas referenciadas en esta tarea)
4. **Leer los templates** en `.ralph/templates/`:
   - `module-template.ts` -> estructura del archivo .ts
   - `spec-template.ts` -> estructura del archivo .spec.ts
   - `reqs-template.md` -> estructura del archivo .reqs.md
5. **Leer los tipos** en `src/backend/types/` (si ya existen)
6. **Leer los archivos dependientes** (imports que este modulo necesitara)

### PASO 1: Generar archivos (3 por modulo)

Para cada modulo a crear, generar los 3 archivos:

```
src/[path]/[module-name].ts          # Codigo de produccion
src/[path]/[module-name].reqs.md     # Requisitos sidecar
tests/unit/[mirror-path]/[module-name].spec.ts  # Tests unitarios
```

**Regla**: Si un archivo .ts existe, su .reqs.md y .spec.ts DEBEN existir.
Si alguno falta, la tarea no pasa el Gate 3.

### PASO 2: Orden de generacion

1. **Primero**: `.reqs.md` (define el contrato)
2. **Segundo**: `.ts` (implementa el contrato)
3. **Tercero**: `.spec.ts` (valida el contrato)

### PASO 3: Verificacion (self-audit)

Despues de generar, ejecutar:
```bash
npm run typecheck    # TypeScript strict pasa
npm run lint         # ESLint zero warnings
npm run test:unit    # Tests unitarios pasan
```

Si alguno falla: corregir ANTES de entregar.

### Entregables

[Lista de archivos especificos a generar para esta tarea]

---

## Hat: SIMPLIFIER (Ralph)

### Simplificaciones aplicadas
- [Que se simplifica]

### Over-engineering warning
- NO [lo que no se debe hacer]

---

## Quality Gates

### Gate 1: [NOMBRE] (antes de ejecucion)
- [ ] **G1-01**: [check]
- [ ] **G1-02**: [check]

### Gate 2: [NOMBRE] (despues de implementar)
- [ ] **G2-01**: [check]
- [ ] **G2-02**: [check]

### Gate 3: [NOMBRE] (auditoria final)
- [ ] **G3-01**: [check]
- [ ] **G3-02**: [check]

---

## Definition of Done (DoD)

- [ ] Archivos generados: `.ts` + `.reqs.md` + `.spec.ts` para cada modulo
- [ ] `npm run typecheck` pasa
- [ ] `npm run lint` pasa
- [ ] `npm run test:unit` pasa (o no aplica si es tooling)
- [ ] `.reqs.md` tiene todos los AC y Reglas referenciados
- [ ] `.spec.ts` tiene tests para cada AC del `.reqs.md`
- [ ] Los 3 Quality Gates pasados
- [ ] Zero `any`
- [ ] Zero archivos extra no especificados

---

## Protocolo de Auditoria (Ralph)

### Pre-condiciones
1. [Que debe existir antes]

### Checks durante ejecucion
1. [Que verificar mientras]

### Checks post-ejecucion
1. [Que verificar despues]

### Criterio de rechazo
- [Motivo 1] -> RECHAZAR
- [Motivo 2] -> RECHAZAR

---

## Log de Ejecucion

| Fecha | Accion | Resultado |
|-------|--------|-----------|
| | Tarea creada por Ralph | OPEN |

---
