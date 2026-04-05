# TASK-008: Domain Layer - Quality Gate Rules Engine

## Objetivo
Implementar el motor de reglas de Quality Gates que orquesta las decisiones de bloqueo/aprobacion basadas en los scores y las inconsistencias detectadas.

## Contexto
Este modulo es el que decide si un ticket puede transicionar o si un PR puede mergearse. Combina los resultados del Scoring Engine y el Inconsistency Detector para emitir veredictos.

## Especificacion Tecnica

### Ubicacion
`src/backend/services/scoring/`

### Funciones principales

#### `evaluateGate(gate: 'definition' | 'execution' | 'delivery', data: GateEvaluationInput): QualityGateResult`
- **Gate 1 (Definition)**:
  - Input: ticket data + rovo context
  - Regla: `ConsistencyScore.overall >= threshold` (default 80)
  - Si falla: bloquear transicion a "In Progress"
- **Gate 2 (Execution)**:
  - Input: ticket data + PR data
  - Regla: No inconsistencias `critical` no resueltas en el ticket
  - Si falla: PR status check = failure + comentario con razones
- **Gate 3 (Delivery)**:
  - Input: PR description + rovo context + ticket data
  - Regla: Validacion cruzada final PR vs contexto historico
  - Si falla: Bloquear merge

#### `determineEnforcementActions(result: QualityGateResult): EnforcementAction[]`
- Traduce el resultado del gate en acciones concretas
- Ejemplos: bloquear transicion, comentar en PR, flaggear inconsistencia

#### `canTransition(ticketKey: string, targetStatus: string, config: ProjectConfig): Promise<boolean>`
- Evalua si un ticket puede transicionar al estado objetivo
- Invoca los gates necesarios segun la configuracion del proyecto

### Reglas configurables
- `scoreThreshold`: Umbral minimo (default 80)
- `blockOnCritical`: Bloquear si hay inconsistencias criticas (default true)
- `requireDocumentation`: Requerir doc en Confluence (default false)
- `enabledGates`: Gates activos por proyecto

## Acceptance Criteria
- [ ] AC-01: Los 3 Quality Gates de negocio estan implementados
- [ ] AC-02: `evaluateGate` retorna `QualityGateResult` con passed/blocked info
- [ ] AC-03: `determineEnforcementActions` genera acciones correctas
- [ ] AC-04: Las reglas son configurables via `ProjectConfig`
- [ ] AC-05: Gate 1 bloquea transicion si score < threshold
- [ ] AC-06: Gate 2 bloquea PR si hay inconsistencias criticas
- [ ] AC-07: Zero dependencias externas (puro dominio)
- [ ] AC-08: Cobertura de tests unitarios > 90%
- [ ] AC-09: Archivo `.reqs.md` sidecar creado

## Reglas del Rulebook
- **[ARCH-SOLID-002]**: Sin dependencias externas en dominio
- **[ROVO-INTEG-001]**: Score threshold por defecto 80%
- **[GH-INTEG-001]**: PR status check refleja estado del ticket

## Estrategia de Test
- **Unit**: Tests exhaustivos para cada gate con datos de entrada mock
- **Integration**: Verificar flujo gate -> enforcement action
- **E2E**: Simular bloqueo real de transicion en Jira y PR en GitHub

## Dependencias
- TASK-005 (tipos y modelos)
- TASK-006 (scoring engine)
- TASK-007 (inconsistency detector)

## Estado: PENDIENTE
