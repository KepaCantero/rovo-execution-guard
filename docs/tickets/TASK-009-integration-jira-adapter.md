# TASK-009: Integration Layer - Jira API Adapter

## Objetivo
Implementar el adaptador para la API de Jira Cloud que permite leer y modificar tickets, gestionar transiciones de workflow y obtener datos del proyecto.

## Contexto
Este adaptador es la interfaz entre la capa de dominio y Jira. Debe manejar autenticacion via Forge APIs, rate limiting y errores de forma transparente.

## Especificacion Tecnica

### Ubicacion
`src/backend/services/jira/`

### Funciones principales

#### `getTicketData(issueKey: string): Promise<JiraTicketData>`
- Obtiene datos completos del ticket: summary, description, status, assignee, labels, priority, issuetype
- Usa `@forge/api` => `requestJira`

#### `getProjectConfig(projectKey: string): Promise<ProjectConfig>`
- Lee la configuracion del proyecto desde Forge Storage
- Si no existe, retorna config por defecto

#### `saveProjectConfig(config: ProjectConfig): Promise<void>`
- Guarda la configuracion en Forge Storage

#### `transitionIssue(issueKey: string, transitionId: string): Promise<void>`
- Ejecuta una transicion de workflow
- Usado solo por enforcement (bloqueo)

#### `getTransitions(issueKey: string): Promise<JiraTransition[]>`
- Obtiene transiciones disponibles para un ticket

#### `addComment(issueKey: string, body: string): Promise<void>`
- Anade comentario al ticket con formato Atlassian Document Format (ADF)

#### `getIssueStatus(issueKey: string): Promise<string>`
- Obtiene el status actual del ticket

### Autenticacion
- Via `@forge/api` (no necesita tokens manuales)
- Scopes requeridos: `read:jira-work`, `write:jira-work`

### Manejo de errores
- `JiraApiError`: Error base de comunicacion con Jira
- `TicketNotFoundError`: Ticket no existe
- `PermissionDeniedError`: Sin permisos para la operacion
- `TransitionBlockedError`: Transicion bloqueada por el sistema

## Acceptance Criteria
- [ ] AC-01: Todas las funciones usan `@forge/api` para autenticacion
- [ ] AC-02: Manejo de errores con tipos custom
- [ ] AC-03: Logging estructurado en cada llamada (con executionId)
- [ ] AC-04: Rate limiting respetado (no exceder limits de Forge)
- [ ] AC-05: Timeout en llamadas API (AbortController)
- [ ] AC-06: Cobertura de tests unitarios > 85%
- [ ] AC-07: Tests de integracion con mocks de API
- [ ] AC-08: Archivo `.reqs.md` sidecar creado

## Reglas del Rulebook
- **[FORGE-OPS-001]**: Respetar limits de ejecucion y latencia
- **[FORGE-OPS-003]**: Usar Forge API para autenticacion (no tokens manuales)
- **[SEC-PRIV-001]**: Scopes minimos necesarios (Least Privilege)

## Estrategia de Test
- **Unit**: Mock de `@forge/api` y test de cada funcion
- **Integration**: Mock de respuestas HTTP de Jira API
- **E2E**: Crear ticket en Jira y verificar lectura via adapter

## Dependencias
- TASK-005 (tipos JiraTicketData, ProjectConfig)
- TASK-013 (resilience: AbortController)

## Estado: PENDIENTE
