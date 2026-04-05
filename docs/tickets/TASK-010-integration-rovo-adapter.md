# TASK-010: Integration Layer - Rovo API Adapter

## Objetivo
Implementar el adaptador para obtener contexto organizacional a traves de Rovo: documentacion relevante, tickets historicos, decisiones previas y patrones de comportamiento.

## Contexto
Rovo es la fuente de "verdad organizacional". El adapter extrae contexto que el Scoring Engine usa para validar tickets. Este modulo es critico para la diferenciacion del producto.

## Especificacion Tecnica

### Ubicacion
`src/backend/services/rovo/`

### Funciones principales

#### `getContext(query: string, projectKey: string): Promise<RovoContext>`
- Busca contexto relevante en el espacio organizacional
- Retorna: documentos relacionados, tickets historicos, decisiones previas
- Parametros de busqueda configurables

#### `getRelatedTickets(issueKey: string): Promise<JiraTicketData[]>`
- Obtiene tickets relacionados con el issue actual
- Usa Rovo para busqueda semantica (si disponible) o por keywords

#### `getDocumentation(query: string, spaceKeys?: string[]): Promise<ConfluencePageData[]>`
- Busca documentacion relevante en Confluence via Rovo
- Filtra por espacios si se especifican

#### `getHistoricalDecisions(projectKey: string): Promise<HistoricalDecision[]>`
- Obtiene decisiones de arquitectura o producto previas
- Permite validar si un ticket contradice decisiones pasadas

#### `validateConsistency(ticketData: JiraTicketData, context: RovoContext): Promise<ConsistencyReport>`
- Cruza datos del ticket con el contexto extraido
- Retorna puntos de consistencia e inconsistencia

### Autenticacion
- Via Atlassian Rovo API (si disponible) o Forge extension API
- Manejo de cuota: no exceder limites de queries por minuto

### Fallback sin IA
- Si Rovo no esta disponible, usar busqueda basica por keywords en Jira/Confluence
- El sistema debe funcionar sin Rovo, pero con funcionalidad reducida

## Acceptance Criteria
- [ ] AC-01: `getContext` retorna contexto relevante estructurado
- [ ] AC-02: Fallback funcional cuando Rovo no esta disponible
- [ ] AC-03: Control de cuota de queries implementado
- [ ] AC-04: Timeout en llamadas (AbortController)
- [ ] AC-05: Logging estructurado con executionId
- [ ] AC-06: Manejo de errores con tipos custom (`RovoApiError`, `QuotaExceededError`)
- [ ] AC-07: Cobertura de tests unitarios > 85%
- [ ] AC-08: Tests de integracion con mocks
- [ ] AC-09: Archivo `.reqs.md` sidecar creado

## Reglas del Rulebook
- **[ROVO-INTEG-001]**: Control de cuota de queries
- **[ROVO-INTEG-002]**: Fallback sin IA obligatorio
- **[ROVO-INTEG-003]**: No dependencia critica de IA
- **[FORGE-OPS-001]**: Respetar limits de ejecucion

## Estrategia de Test
- **Unit**: Mock de Rovo API responses
- **Integration**: Contrato con API real (mockeada)
- **E2E**: Flujo completo: ticket -> contexto Rovo -> score

## Dependencias
- TASK-005 (tipos RovoContext, JiraTicketData)
- TASK-013 (resilience: retry, circuit breaker)

## Estado: PENDIENTE
