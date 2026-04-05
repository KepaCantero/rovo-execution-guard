# TASK-012: Integration Layer - Confluence API Adapter

## Objetivo
Implementar el adaptador para la API de Confluence Cloud que permite buscar y leer documentacion relevante para la validacion de tickets.

## Contexto
Confluence es la fuente de documentacion organizacional. El adapter permite buscar paginas, extraer contenido y cruzarlo con los datos de tickets de Jira.

## Especificacion Tecnica

### Ubicacion
`src/backend/services/jira/` (o modulo confluence dedicado)

### Funciones principales

#### `searchPages(query: string, spaceKeys?: string[]): Promise<ConfluencePageData[]>`
- Busca paginas por texto en Confluence
- Filtra por espacios si se especifican
- Usa `@forge/api` => `requestConfluence`

#### `getPageContent(pageId: string): Promise<string>`
- Obtiene el contenido de una pagina en formato texto/plano
- Maneja formato Atlassian Document Format (ADF)

#### `getPageMetadata(pageId: string): Promise<ConfluencePageMetadata>`
- Obtiene metadata: titulo, espacio, ultima edicion, labels

#### `getSpacePages(spaceKey: string, limit?: number): Promise<ConfluencePageData[]>`
- Obtiene paginas de un espacio especifico
- Paginacion controlada

### Autenticacion
- Via `@forge/api` (no necesita tokens manuales)
- Scopes: `read:confluence-content`, `write:confluence-content`

### Manejo de errores
- `ConfluenceApiError`: Error base
- `PageNotFoundError`: Pagina no existe
- `SpaceNotFoundError`: Espacio no existe

## Acceptance Criteria
- [ ] AC-01: Todas las funciones usan `@forge/api` para autenticacion
- [ ] AC-02: Busqueda funcional con y sin filtro de espacios
- [ ] AC-03: Manejo de ADF en respuesta de contenido
- [ ] AC-04: Paginacion correcta en resultados grandes
- [ ] AC-05: Timeout en llamadas API (AbortController)
- [ ] AC-06: Logging estructurado con executionId
- [ ] AC-07: Cobertura de tests unitarios > 85%
- [ ] AC-08: Archivo `.reqs.md` sidecar creado

## Reglas del Rulebook
- **[FORGE-OPS-001]**: Respetar limits de ejecucion
- **[FORGE-OPS-003]**: Usar Forge API para autenticacion
- **[SEC-PRIV-001]**: Scopes minimos

## Estrategia de Test
- **Unit**: Mock de `@forge/api` => `requestConfluence`
- **Integration**: Contrato con Confluence API (mockeada)
- **E2E**: N/A (cubierto por flujo E2E general)

## Dependencias
- TASK-005 (tipos ConfluencePageData)
- TASK-013 (resilience)

## Estado: PENDIENTE
