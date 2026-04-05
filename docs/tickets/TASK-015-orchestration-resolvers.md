# TASK-015: Orchestration Layer - Resolvers (Forge Bridge)

## Objetivo
Implementar los resolvers de Forge que conectan el frontend (Custom UI) con el backend, permitiendo que la UI consulte scores, inconsistencias y configuracion.

## Contexto
Los resolvers son la interfaz entre el Custom UI de React y la logica de backend en Forge. Usan `@forge/resolver` para exponer funciones invocables desde el frontend.

## Especificacion Tecnica

### Ubicacion
`src/backend/resolvers/`

### Resolvers a implementar

#### `getConsistencyScore(issueKey: string): Promise<ConsistencyScore>`
- Retorna el score actual del ticket
- Lo calcula en tiempo real o retorna el cacheado (si es reciente)

#### `getInconsistencies(issueKey: string): Promise<Inconsistency[]>`
- Retorna las inconsistencias detectadas para el ticket

#### `getQualityGateStatus(issueKey: string): Promise<QualityGateResult>`
- Retorna el estado actual de los Quality Gates para el ticket

#### `getProjectConfig(projectKey: string): Promise<ProjectConfig>`
- Retorna la configuracion del proyecto

#### `updateProjectConfig(projectKey: string, config: Partial<ProjectConfig>): Promise<void>`
- Actualiza la configuracion del proyecto (solo admin)

#### `getAuditLog(projectKey: string, limit?: number): Promise<AuditLogEntry[]>`
- Retorna las ultimas entradas del audit log

#### `enrichTicket(issueKey: string): Promise<void>`
- Dispara enriquecimiento del ticket con contexto de Rovo (manual)

#### `revalidateTicket(issueKey: string): Promise<ConsistencyScore>`
- Fuerza re-validacion del ticket

### Seguridad
- Validar permisos del usuario que invoca el resolver
- Rate limiting para prevenir abuso
- Sanitizar inputs

## Acceptance Criteria
- [ ] AC-01: Todos los resolvers funcionan via `@forge/resolver`
- [ ] AC-02: Los resolvers son invocables desde Custom UI
- [ ] AC-03: Validacion de permisos en cada resolver
- [ ] AC-04: Rate limiting basico implementado
- [ ] AC-05: Input sanitization en todos los parametros
- [ ] AC-06: Logging estructurado en cada invocacion
- [ ] AC-07: Tests unitarios > 85%
- [ ] AC-08: Archivo `.reqs.md` sidecar creado

## Reglas del Rulebook
- **[FORGE-OPS-003]**: Usar Forge resolver para Custom UI
- **[SEC-PRIV-002]**: Validacion de permisos en resolvers
- **[SEC-PRIV-003]**: Input sanitization obligatoria

## Estrategia de Test
- **Unit**: Mock de servicios internos, test de cada resolver
- **Integration**: Invocacion real de resolver via Forge runtime
- **E2E**: UI llama al resolver y muestra datos correctamente

## Dependencias
- TASK-006 (scoring engine)
- TASK-007 (inconsistency detector)
- TASK-008 (Quality Gates)
- TASK-009 (Jira adapter)
- TASK-024 (project config)

## Estado: PENDIENTE
