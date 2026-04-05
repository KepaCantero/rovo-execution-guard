# TASK-014: Orchestration Layer - Jira Triggers (Workflow Validator)

## Objetivo
Implementar los triggers de Jira que interceptan transiciones de workflow y ejecutan las Quality Gates antes de permitir o bloquear el cambio de estado.

## Contexto
Este es el punto de entrada principal para el enforcement en Jira. Cuando un usuario intenta mover un ticket, el trigger evalua si la transicion esta permitida.

## Especificacion Tecnica

### Ubicacion
Configurado en `manifest.yml` como `trigger: onJiraWorkflowTransition`
Logica en handlers dedicados

### Trigger: `onJiraWorkflowTransition`

#### Flujo
1. Jira dispara evento de transicion
2. El handler obtiene datos del ticket via Jira adapter
3. Obtiene contexto via Rovo adapter
4. Ejecuta Quality Gate correspondiente (Gate 1 para "In Progress")
5. Si falla: bloquea la transicion y anade comentario con razones
6. Si pasa: permite la transicion
7. Registra en audit log

#### Transiciones interceptadas
- `To Do` -> `In Progress`: Gate 1 (Definition) - score >= threshold
- `In Progress` -> `In Review`: Gate 2 (Execution) - sin inconsistencias criticas
- `In Review` -> `Done`: Gate 3 (Delivery) - validacion cruzada final

#### Performance
- El trigger debe responder en menos de 5 segundos (Forge limit)
- Si la evaluacion tarda mas, permitir la transicion y evaluar async
- Priorizar: bloqueo sincrono si es posible, evaluacion async como fallback

### Error handling
- Si falla la evaluacion (error de API, timeout): permitir transicion (fail-open)
- Logear el fallo para investigacion
- Notificar al equipo via comentario en el ticket

## Acceptance Criteria
- [ ] AC-01: El trigger se ejecuta en transiciones de workflow configuradas
- [ ] AC-02: Gate 1 bloquea transicion si score < threshold
- [ ] AC-03: Comentario en ticket explica razones del bloqueo
- [ ] AC-04: Si la evaluacion falla, fail-open con logging
- [ ] AC-05: Response time < 5 segundos
- [ ] AC-06: Audit log generado en cada evaluacion
- [ ] AC-07: Configurable por proyecto (gates activos/inactivos)
- [ ] AC-08: Tests unitarios > 85%
- [ ] AC-09: Archivo `.reqs.md` sidecar creado

## Reglas del Rulebook
- **[FORGE-OPS-001]**: Response < 5s
- **[FORGE-OPS-004]**: Fail-open en caso de error del sistema
- **[ROVO-INTEG-001]**: Gate 1 threshold por defecto 80%

## Estrategia de Test
- **Unit**: Mock de adapters, test de flujo de decision
- **Integration**: Simular evento de transicion completo
- **E2E**: Mover ticket en Jira y verificar bloqueo/aprobacion

## Dependencias
- TASK-008 (Quality Gate rules engine)
- TASK-009 (Jira adapter)
- TASK-010 (Rovo adapter)
- TASK-013 (resilience)
- TASK-021 (structured logger)

## Estado: PENDIENTE
