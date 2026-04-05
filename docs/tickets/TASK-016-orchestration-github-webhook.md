# TASK-016: Orchestration Layer - GitHub Webhook Handler

## Objetivo
Implementar el handler para webhooks de GitHub que escucha eventos de PRs y dispara re-evaluaciones de tickets de Jira asociados.

## Contexto
La integracion bidireccional requiere que cambios en GitHub (nuevos PRs, commits, cambios de estado) desencadenen re-evaluaciones en Jira. Esto cierra el loop Jira <-> GitHub.

## Especificacion Tecnica

### Ubicacion
Configurado en `manifest.yml` como webhook endpoint
Logica en handlers dedicados

### Eventos a escuchar

#### `pull_request` events
- **opened**: Nuevo PR creado
  - Extraer Jira keys del titulo/body
  - Para cada ticket: evaluar Quality Gate 2 (Execution)
  - Crear status check en el PR (pass/fail)
  - Comentar en el PR con contexto validado

- **synchronize**: Nuevos commits en el PR
  - Re-evaluar tickets asociados
  - Actualizar status check

- **closed** (merged): PR mergeado
  - Evaluar Quality Gate 3 (Delivery)
  - Actualizar estado del ticket si corresponde

- **edited**: Titulo o body del PR modificado
  - Re-extraer Jira keys
  - Re-evaluar si las keys cambiaron

### Seguridad del Webhook
- Validar signature del webhook (HMAC-SHA256)
- Verificar que el evento viene de GitHub
- Rate limiting para prevenir abuso

### Flujo de procesamiento
1. Recibir webhook de GitHub
2. Validar signature
3. Parsear evento y extraer datos relevantes
4. Extraer Jira keys del PR
5. Para cada key: obtener ticket + contexto Rovo
6. Ejecutar Quality Gate correspondiente
7. Actualizar status check en GitHub
8. Registrar en audit log

## Acceptance Criteria
- [ ] AC-01: Webhook valida signature HMAC-SHA256
- [ ] AC-02: Evento `pull_request.opened` dispara evaluacion de Gate 2
- [ ] AC-03: Jira keys extraidas correctamente del PR
- [ ] AC-04: Status check creado/actualizado en GitHub tras evaluacion
- [ ] AC-05: Manejo de PRs sin Jira keys (ignorar silenciosamente)
- [ ] AC-06: Rate limiting implementado
- [ ] AC-07: Logging estructurado con executionId
- [ ] AC-08: Tests unitarios > 85%
- [ ] AC-09: Archivo `.reqs.md` sidecar creado

## Reglas del Rulebook
- **[GH-INTEG-001]**: GitHub REST API v3
- **[GH-INTEG-004]**: Webhook signature validation obligatoria
- **[SEC-PRIV-004]**: Validar origen de webhooks

## Estrategia de Test
- **Unit**: Mock de webhook payloads, test de flujo de procesamiento
- **Integration**: Enviar webhook mock y verificar respuesta
- **E2E**: Crear PR en repo de test y verificar status check

## Dependencias
- TASK-008 (Quality Gates)
- TASK-011 (GitHub adapter)
- TASK-009 (Jira adapter)
- TASK-010 (Rovo adapter)
- TASK-013 (resilience)

## Estado: PENDIENTE
