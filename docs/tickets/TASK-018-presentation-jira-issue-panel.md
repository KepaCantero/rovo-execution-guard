# TASK-018: Presentation Layer - Jira Issue Panel (Spider Chart)

## Objetivo
Implementar el panel lateral en la vista de issue de Jira que muestra el Consistency Score con un Spider Chart (grafico radial) de 5 ejes, las inconsistencias detectadas y sugerencias accionables.

## Contexto
Este es el punto de interaccion principal del usuario con Rovo Execution Guard. Debe ser visualmente claro, informativo y accionable usando el Atlassian Design System.

## Especificacion Tecnica

### Ubicacion
`src/frontend/custom-ui/issue-panel/`

### Modulo Forge
`jira:issuePanel` en `manifest.yml`

### Componentes

#### `IssuePanelApp` (main entry)
- Invoca resolver `getConsistencyScore` al montar
- Invoca resolver `getInconsistencies`
- Invoca resolver `getQualityGateStatus`
- Gestiona estados: loading, error, data

#### `SpiderChart` (grafico radial)
- 5 ejes: Clarity, Consistency, Risk, Documentation, TechnicalDebt
- Visualizacion tipo radar/spider
- Colores: verde (>80), amarillo (60-80), rojo (<60)
- Score overall en el centro
- Usar libreria ligera (recharts) o SVG custom

#### `ScoreSummary`
- Badge con score overall (color coded)
- Indicador de Quality Gate (passed/failed)
- Timestamp de ultima evaluacion
- Boton "Revalidate"

#### `InconsistenciesList`
- Lista de inconsistencias con iconos de severidad
- Cada item muestra: tipo, severidad, descripcion
- Expandible para ver sugerencia
- Accion rapida: "Resolve" o "Dismiss"

#### `EnforcementStatus`
- Estado actual de los gates para este ticket
- Visualizacion de transiciones bloqueadas
- Link a PRs de GitHub asociados

### Stack
- React 18 (hooks nativos)
- Atlassian Design System (@atlaskit/*)
- Custom UI (no UI Kit)
- CSS-in-JS o estilos modulares

### Performance
- Carga inicial < 1 segundo
- Lazy loading de componentes pesados (SpiderChart)
- Cache de datos del resolver (no re-fetch innecesario)

## Acceptance Criteria
- [ ] AC-01: Panel visible en la vista de issue de Jira
- [ ] AC-02: Spider Chart muestra los 5 ejes con colores correctos
- [ ] AC-03: Score overall visible y color-coded
- [ ] AC-04: Lista de inconsistencias con severidad
- [ ] AC-05: Boton "Revalidate" funcional (invoca resolver)
- [ ] AC-06: Estados loading y error manejados con UI adecuada
- [ ] AC-07: Usa componentes de Atlassian Design System
- [ ] AC-08: Responsive y accesible
- [ ] AC-09: Tests unitarios de componentes > 85%
- [ ] AC-10: Archivo `.reqs.md` sidecar creado

## Reglas del Rulebook
- **[UI-ADS-001]**: Usar Atlassian Design System
- **[UI-ADS-002]**: React 18 hooks nativos
- **[FORGE-OPS-005]**: Minimizar llamadas al backend

## Estrategia de Test
- **Unit**: Componentes React con @testing-library/react
- **Integration**: Render con datos mock de resolvers
- **E2E**: Verificar panel en issue real de Jira

## Dependencias
- TASK-015 (resolvers para obtener datos)
- TASK-006 (scoring engine)
- TASK-007 (inconsistency detector)

## Estado: PENDIENTE
