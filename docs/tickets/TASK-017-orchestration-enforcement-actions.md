# TASK-017: Orchestration Layer - Enforcement Actions (Block, Comment)

## Objetivo
Implementar el modulo de enforcement que traduce los resultados de los Quality Gates en acciones concretas: bloqueo de transiciones, comentarios automatizados, status checks en GitHub y flaggeo de inconsistencias.

## Contexto
Este modulo es el que "actua" (no solo sugiere). Es la diferencia entre un dashboard informativo y una capa de control operativo real.

## Especificacion Tecnica

### Ubicacion
`src/backend/services/` o submodulo en orquestacion

### Acciones implementadas

#### `blockTransition(issueKey: string, transitionId: string, reason: string): Promise<void>`
- Bloquea una transicion de workflow en Jira
- Anade comentario al ticket explicando el bloqueo
- Formato ADF con secciones: razon, score, sugerencias

#### `blockPR(repo: string, prNumber: number, reason: string, details: QualityGateResult): Promise<void>`
- Crea status check `failure` en el PR de GitHub
- Publica comentario detallado con:
  - Score del ticket asociado
  - Inconsistencias detectadas
  - Sugerencias de resolucion
  - Link al panel de Jira

#### `addComment(target: 'jira' | 'github', identifier: string, body: string): Promise<void>`
- Anade comentario formateado en Jira (ADF) o GitHub (Markdown)
- Template de comentario configurable

#### `flagInconsistency(inconsistency: Inconsistency): Promise<void>`
- Registra la inconsistencia en Forge Storage
- Actualiza UI del panel con la nueva inconsistencia
- Notifica si es severity `critical`

#### `approvePR(repo: string, prNumber: number, details: QualityGateResult): Promise<void>`
- Crea status check `success` en el PR
- Comentario con resumen del score y estado

### Templates de comentarios
- Jira: Formato ADF con badges de color (verde/rojo), tabla de ejes
- GitHub: Markdown con emojis de estado, detalles colapsables

## Acceptance Criteria
- [ ] AC-01: `blockTransition` impide transicion y comenta razones
- [ ] AC-02: `blockPR` crea status check `failure` en GitHub
- [ ] AC-03: Comentarios con formato rico (ADF en Jira, Markdown en GitHub)
- [ ] AC-04: `approvePR` crea status check `success`
- [ ] AC-05: `flagInconsistency` registra y notifica
- [ ] AC-06: Templates de comentarios configurables
- [ ] AC-07: Logging de cada accion de enforcement
- [ ] AC-08: Tests unitarios > 85%
- [ ] AC-09: Archivo `.reqs.md` sidecar creado

## Reglas del Rulebook
- **[GH-INTEG-001]**: Status checks reflejan estado real del ticket
- **[ROVO-INTEG-001]**: Comentarios incluyen contexto de Rovo
- **[SEC-PRIV-005]**: No exponer datos sensibles en comentarios

## Estrategia de Test
- **Unit**: Mock de adapters, verificar formato de comentarios
- **Integration**: Verificar creacion real de status checks (mock)
- **E2E**: Flujo completo: ticket falla gate -> PR bloqueado

## Dependencias
- TASK-009 (Jira adapter)
- TASK-011 (GitHub adapter)
- TASK-008 (Quality Gates)

## Estado: PENDIENTE
