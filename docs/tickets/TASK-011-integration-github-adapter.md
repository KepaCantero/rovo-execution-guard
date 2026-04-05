# TASK-011: Integration Layer - GitHub API Adapter

## Objetivo
Implementar el adaptador para la GitHub REST API v3 que permite gestionar Status Checks en PRs, crear comentarios automatizados y escuchar webhooks.

## Contexto
La integracion con GitHub es bidireccional: la app inyecta contexto validado en PRs y escucha webhooks para re-evaluar tickets. Es la pieza clave del "enforcement transversal".

## Especificacion Tecnica

### Ubicacion
`src/backend/services/github/`

### Funciones principales

#### `createStatusCheck(params: GitHubStatusCheck): Promise<void>`
- Crea/actualiza un Status Check en un PR
- Estados: `success`, `failure`, `pending`
- Incluye URL de detalle (link al panel de Jira)

#### `createPRComment(repo: string, prNumber: number, body: string): Promise<void>`
- Publica un comentario en el PR con contexto validado
- Formato Markdown con score, inconsistencias y sugerencias

#### `getPRData(repo: string, prNumber: number): Promise<GitHubPRData>`
- Obtiene datos del PR: titulo, descripcion, branch, commits, files changed
- Busca referencia al ticket de Jira en titulo/body del PR

#### `extractJiraKeysFromPR(pr: GitHubPRData): string[]`
- Extrae IDs de tickets de Jira del titulo y descripcion del PR
- Regex: `[A-Z]+-\d+`

#### `updateStatusCheck(checkId: string, params: Partial<GitHubStatusCheck>): Promise<void>`
- Actualiza un check existente (para re-evaluacion)

#### `listPRFiles(repo: string, prNumber: number): Promise<PRFile[]>`
- Lista archivos modificados en el PR (para analisis de contexto)

### Autenticacion
- GitHub App Token o Personal Access Token
- Token almacenado de forma segura en Forge Storage (encriptado)
- Scopes minimos: `repo:status`, `pull_requests:read`

### Seguridad
- Tokens encriptados en Forge Storage
- Rotacion de tokens soportada
- Audit log de cada uso de token

## Acceptance Criteria
- [ ] AC-01: `createStatusCheck` crea checks que bloquean el merge en GitHub
- [ ] AC-02: `createPRComment` publica comentarios con contexto valido
- [ ] AC-03: `extractJiraKeysFromPR` extrae IDs correctamente
- [ ] AC-04: Tokens almacenados de forma segura (encriptados)
- [ ] AC-05: Timeout en llamadas (AbortController)
- [ ] AC-06: Logging estructurado con executionId
- [ ] AC-07: Manejo de errores con tipos custom (`GitHubApiError`, `TokenExpiredError`)
- [ ] AC-08: Cobertura de tests unitarios > 85%
- [ ] AC-09: Tests de integracion con mocks de GitHub API
- [ ] AC-10: Archivo `.reqs.md` sidecar creado

## Reglas del Rulebook
- **[GH-INTEG-001]**: GitHub REST API v3 obligatorio
- **[GH-INTEG-002]**: Tokens encriptados en Forge Storage
- **[GH-INTEG-003]**: Scopes minimos (Least Privilege)
- **[SEC-PRIV-001]**: Encriptacion de datos sensibles

## Estrategia de Test
- **Unit**: Mock de Octokit/GitHub API
- **Integration**: Contrato con GitHub API (mockeada)
- **E2E**: Crear PR en repo de test y verificar status check

## Dependencias
- TASK-005 (tipos GitHubPRData)
- TASK-013 (resilience)

## Estado: PENDIENTE
