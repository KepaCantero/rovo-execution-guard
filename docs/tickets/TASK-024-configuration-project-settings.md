# TASK-024: Configuration Layer - Per-Project Settings and Toggles

## Objetivo
Implementar el sistema de configuracion por proyecto que permite a cada equipo personalizar los umbrales, gates activos y reglas de Rovo Execution Guard.

## Contexto
Cada equipo tiene necesidades diferentes. Un equipo puede querer un threshold de 70, otro de 90. Un proyecto puede no usar GitHub. La configuracion debe ser flexible sin sobreingenieria.

## Especificacion Tecnica

### Ubicacion
`src/backend/services/` o submodulo de config

### Almacenamiento
- Forge Storage API (`storage.set` / `storage.get`)
- Key: `project-config:{projectKey}`
- Value: JSON serializado de `ProjectConfig`

### Interfaz

#### `getProjectConfig(projectKey: string): Promise<ProjectConfig>`
- Obtiene config del storage
- Si no existe, retorna defaults:
  ```typescript
  const DEFAULT_CONFIG: ProjectConfig = {
    projectKey,
    enabled: true,
    scoreThreshold: 80,
    gates: { definition: true, execution: true, delivery: true },
    githubRepo: undefined,
    githubOwner: undefined,
  };
  ```

#### `saveProjectConfig(config: ProjectConfig): Promise<void>`
- Valida la config antes de guardar
- Registra cambio en audit log
- Solo usuarios con permisos de admin pueden guardar

#### `validateConfig(config: unknown): config is ProjectConfig`
- Valida que la config tiene la estructura correcta
- Valida rangos: scoreThreshold 0-100
- Retorna errores descriptivos si falla

### Configuracion global vs por proyecto
- Global: `app-config` en Forge Storage (features flags, Sentry DSN, etc.)
- Por proyecto: `project-config:{key}`
- El resolver de admin gestiona ambos

### Cache
- Cache en memoria para evitar lecturas frecuentes al storage
- TTL: 5 minutos
- Invalidacion manual via boton en admin

## Acceptance Criteria
- [ ] AC-01: Config por defecto funcional para proyectos nuevos
- [ ] AC-02: `getProjectConfig` retorna config valida o defaults
- [ ] AC-03: `saveProjectConfig` valida antes de guardar
- [ ] AC-04: Solo admins pueden modificar la config
- [ ] AC-05: Cache en memoria con TTL
- [ ] AC-06: Cambios registrados en audit log
- [ ] AC-07: Tests unitarios > 85%
- [ ] AC-08: Archivo `.reqs.md` sidecar creado

## Reglas del Rulebook
- **[FORGE-OPS-002]**: Minimizar lecturas al storage
- **[ARCH-SOLID-005]**: Configuracion centralizada
- **[SEC-PRIV-002]**: Validacion de permisos

## Estrategia de Test
- **Unit**: Mock de Forge Storage, test de defaults y validacion
- **Integration**: Flujo completo save -> cache -> get
- **E2E**: Cambiar config via admin dashboard y verificar efecto

## Dependencias
- TASK-005 (tipo ProjectConfig)

## Estado: PENDIENTE
