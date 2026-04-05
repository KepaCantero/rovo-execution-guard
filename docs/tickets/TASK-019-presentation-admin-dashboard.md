# TASK-019: Presentation Layer - Admin Dashboard

## Objetivo
Implementar el dashboard de administracion en Jira para que los Project Managers configuren la app, vean metricas de ROI y revisen logs de auditoria.

## Contexto
El Admin Dashboard es la vista de gestion. Permite configurar reglas por proyecto, ver estadisticas de bloqueo y estimar ahorro de retrabajo.

## Especificacion Tecnica

### Ubicacion
`src/frontend/custom-ui/admin-dashboard/`

### Modulo Forge
`jira:adminPage` en `manifest.yml`

### Componentes

#### `AdminDashboardApp` (main entry)
- Tabs: Overview, Configuration, Audit Log
- Solo visible para usuarios con permisos de admin

#### `OverviewTab`
- Metricas principales:
  - Tickets evaluados (total, periodo)
  - Tickets bloqueados (total, porcentaje)
  - PRs bloqueados en GitHub
  - Inconsistencias detectadas por tipo
  - Score promedio del proyecto
- ROI estimado: horas ahorradas por tickets bloqueados antes de ejecucion
- Grafico de tendencias (evaluaciones vs bloqueos en el tiempo)

#### `ConfigurationTab`
- Formulario de configuracion por proyecto:
  - Score threshold (slider: 0-100)
  - Gates activos/inactivos (toggles)
  - Repositorio GitHub vinculado
  - Espacios de Confluence relevantes
- Boton "Save" que invoca resolver `updateProjectConfig`
- Preview de impacto del cambio

#### `AuditLogTab`
- Tabla de auditoria con:
  - Timestamp
  - Ticket key
  - Accion realizada
  - Resultado (blocked/approved)
  - Score
  - Usuario que disparo la accion
- Filtros: fecha, resultado, usuario
- Exportable (futuro)

### Stack
- React 18 + @atlaskit/*
- Custom UI

## Acceptance Criteria
- [ ] AC-01: Dashboard accesible desde Jira admin page
- [ ] AC-02: Overview muestra metricas reales (via resolvers)
- [ ] AC-03: Configuration permite editar y guardar ProjectConfig
- [ ] AC-04: Audit Log muestra entradas filtrables
- [ ] AC-05: Solo accesible para admins del proyecto
- [ ] AC-06: Estados loading y error manejados
- [ ] AC-07: Usa Atlassian Design System
- [ ] AC-08: Tests unitarios de componentes > 80%
- [ ] AC-09: Archivo `.reqs.md` sidecar creado

## Reglas del Rulebook
- **[UI-ADS-001]**: Usar Atlassian Design System
- **[SEC-PRIV-002]**: Validacion de permisos de admin

## Estrategia de Test
- **Unit**: Componentes React con datos mock
- **Integration**: Flujo de guardar configuracion
- **E2E**: Navegar al dashboard y verificar datos

## Dependencias
- TASK-015 (resolvers)
- TASK-024 (project config)

## Estado: PENDIENTE
