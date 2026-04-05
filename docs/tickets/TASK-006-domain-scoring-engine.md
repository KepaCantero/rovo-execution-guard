# TASK-006: Domain Layer - Scoring Engine

## Objetivo
Implementar el motor de puntuacion de consistencia (Consistency Score) que evalua tickets de Jira contra el contexto organizacional extraido por Rovo.

## Contexto
El Scoring Engine es la pieza central del dominio. Recibe datos de Jira y contexto de Rovo, y produce un `ConsistencyScore` con 5 ejes. Este score determina si un ticket puede progresar en el workflow.

## Especificacion Tecnica

### Ubicacion
`src/backend/services/scoring/`

### Funciones principales

#### `calculateScore(ticket: JiraTicketData, context: RovoContext): ConsistencyScore`
- Calcula los 5 ejes del score:
  1. **Clarity** (0-100): El ticket tiene descripcion clara, acceptance criteria, tipo correcto?
  2. **Consistency** (0-100): Contradice documentacion existente o tickets previos?
  3. **Risk** (0-100): Tiene dependencias no resueltas o riesgos tecnicos?
  4. **Documentation** (0-100): Tiene documentacion de referencia en Confluence?
  5. **TechnicalDebt** (0-100): Se asocia a areas con deuda tecnica conocida?
- Score overall = media ponderada de los 5 ejes
- Genera `executionId` unico para trazabilidad

#### `evaluateQualityGate(score: ConsistencyScore, config: ProjectConfig): QualityGateResult`
- Gate 1 (Definition): `score.overall >= config.scoreThreshold`
- Gate 2 (Execution): No hay inconsistencias con severidad `critical`
- Gate 3 (Delivery): Score + validacion cruzada con PR de GitHub

### Reglas de ponderacion
- Pesos por defecto: Clarity 25%, Consistency 25%, Risk 20%, Documentation 15%, TechnicalDebt 15%
- Pesos configurables por proyecto via `ProjectConfig`

### Errores custom
- `ScoringError`: Error base del motor de scoring
- `InsufficientDataError`: No hay suficientes datos para calcular score

## Acceptance Criteria
- [ ] AC-01: `calculateScore` produce un score entre 0-100 en cada eje
- [ ] AC-02: El score overall es la media ponderada configurable
- [ ] AC-03: `evaluateQualityGate` aplica los 3 gates correctamente
- [ ] AC-04: Se genera `executionId` unico en cada evaluacion
- [ ] AC-05: Manejo de errores con tipos custom (`ScoringError`, `InsufficientDataError`)
- [ ] AC-06: Zero dependencias externas (puro dominio)
- [ ] AC-07: Cobertura de tests unitarios > 90%
- [ ] AC-08: Archivo `.reqs.md` sidecar creado

## Reglas del Rulebook
- **[ARCH-SOLID-001]**: Separacion de capas estricta
- **[ARCH-SOLID-002]**: Sin dependencias externas en dominio
- **[TEST-QA-001]**: Cobertura > 90% en capa de dominio
- **[ROVO-INTEG-001]**: Score threshold por defecto 80%

## Estrategia de Test
- **Unit**: Tests exhaustivos de `calculateScore` y `evaluateQualityGate` con datos mock
- **Integration**: N/A (puro dominio)
- **E2E**: Validar que un ticket con score < 80 es bloqueado

## Dependencias
- TASK-005 (tipos y modelos del dominio)

## Estado: PENDIENTE
