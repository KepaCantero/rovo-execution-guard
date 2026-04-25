# TASK-031: Audit - Coverage Analysis (docs/ and info.txt)

## Objetivo
Realizar una auditoria integral para verificar que TODA la informacion en `info.txt` y `docs/` esta cubierta por al menos una tarea Ralph (RTASK-001 a RTASK-030). Identificar gaps, duplicaciones o archivos mal ubicados. Corregir todos los problemas encontrados para asegurar cero perdida de informacion y cero duplicacion.

## Contexto
El archivo `info.txt` contiene 81KB de datos de especificacion original. El directorio `docs/` contiene documentacion de arquitectura, specs de tareas, fuentes del rulebook y directorios placeholder. Esta tarea de auditoria debe cruzar cada pieza de informacion contra las tareas Ralph existentes y corregir discrepancias antes del desarrollo en produccion.

## Especificacion Tecnica

### 1. Cobertura de `info.txt`
- Leer todas las secciones de `info.txt` (2,469 lineas)
- Para cada seccion/tema, identificar que RTASK lo cubre
- Reportar temas NO cubiertos por ningun RTASK
- Temas clave a verificar:
  - Arquitectura de 6 capas
  - Quality Gates (3 gates: Definition, Execution, Delivery)
  - Scoring Engine (5 ejes, pesos, determinismo)
  - Inconsistency Detector (4 tipos, niveles de severidad)
  - Adaptadores: Jira, Rovo, GitHub, Confluence
  - Patrones de resiliencia (circuit breaker, retry, timeout)
  - Structured logger, Sentry, Health checks
  - Configuracion por proyecto (Forge Storage, caching, validacion)
  - CI/CD: GitHub Actions, Semantic Release
  - Hooks: Husky + commitlint + lint-staged
  - TypeScript strict, ESLint, Prettier
  - Estrategia de testing (unit, integration, E2E)
  - React Custom UI (issue panel con spider chart, admin dashboard)
  - PR comment templates
  - Forge manifest (modules, scopes, triggers)
  - Tipos de dominio (12 archivos de tipos)
  - Workflow triggers, GitHub webhook handler, Enforcement actions
  - Forge resolvers, Marketplace plan
  - Links tecnicos y libros referenciados

### 2. Auditoria del directorio `docs/`
- Verificar que cada archivo tiene un proposito claro
- Identificar directorios vacios (solo `.gitkeep`)
- Verificar que no hay contenido duplicado entre archivos
- Verificar que las ubicaciones coinciden con lo referenciado por los RTASK

### 3. Auditoria de ubicacion del Rulebook
- Ubicacion canonica: `docs/rulebook/RULEBOOK.md`
- Verificar que no existen archivos duplicados del rulebook
- Verificar que `docs/runbooks/` tiene contenido distinto o esta vacio

### 4. Auditoria de docs de arquitectura
- Verificar consistencia con `info.txt` y tareas:
  - `project-overview.md`, `architecture-model.md`, `quality-gates.md`
  - `rovo-github-integration.md`, `testing-strategy.md`, `cicd-deploy.md`
  - `gitflow-workflow.md`, `observability.md`, `agentic-process.md`
  - `deliverables.md`, `resilience-patterns.md`

### 5. Limpieza de duplicaciones
- Eliminar archivos duplicados encontrados
- Consolidar rulebook en ubicacion unica canonica
- Remover directorios vacios sin proposito o agregar README
- Asegurar que no existe informacion sin cobertura de tarea

## Artifacts de salida
1. **Coverage Matrix** — Tabla mapeando cada seccion de `info.txt` a cobertura RTASK
2. **Gap Report** — Lista de temas no cubiertos con recomendaciones
3. **Duplication Report** — Lista de archivos/contenido duplicado con acciones
4. **Fixes Applied** — Todas las correcciones aplicadas durante la auditoria

## Acceptance Criteria
- [ ] AC-01: Cada seccion de `info.txt` esta mapeada a al menos un RTASK
- [ ] AC-02: No existe informacion en `info.txt` sin cobertura de tarea
- [ ] AC-03: No existen archivos duplicados en `docs/`
- [ ] AC-04: Rulebook existe SOLO en `docs/rulebook/RULEBOOK.md`
- [ ] AC-05: `docs/runbooks/` tiene contenido distinto o es removido
- [ ] AC-06: Todos los docs de arquitectura son consistentes con las tareas
- [ ] AC-07: Directorios vacios en `docs/` tienen proposito documentado
- [ ] AC-08: Coverage matrix creada en `docs/audit/coverage-matrix.md`
- [ ] AC-09: Archivo `.reqs.md` sidecar creado

## Reglas del Rulebook
- **[FORGE-OPS-001]**: Respetar limits de ejecucion y latencia de Forge
- **[FORGE-OPS-002]**: Manejar permisos correctamente (Least Privilege)
- **[ARCH-SOLID-001]**: Separacion de capas estricta
- **[ARCH-SOLID-002]**: No dependencia hacia capas externas desde dominio
- **[ARCH-SOLID-003]**: TypeScript estricto obligatorio
- **[SEC-PRIV-001]**: Sin datos sensibles en logs ni codigo
- **[TEST-QA-001]**: Cobertura minima de tests
- **[GIT-CI-001]**: Convenciones de commits
- **[UI-ADS-001]**: UI sigue Atlassian Design System
- **[ROVO-INTEG-001]**: Integracion con Rovo API
- **[GH-INTEG-001]**: Integracion con GitHub API

## Estrategia de Test
- **Unit**: N/A (tarea de auditoria)
- **Integration**: Validacion por cross-reference de archivos
- **E2E**: Coverage matrix muestra 100% de cobertura de `info.txt`

## Dependencias
- TASK-002 (rulebook consolidado)

## Estado: PENDIENTE
