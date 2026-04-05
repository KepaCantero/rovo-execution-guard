# TASK-023: Observability Layer - Health Checks Post-Deploy

## Objetivo
Implementar el sistema de health checks que verifica que la app responde correctamente tras cada despliegue y que puede ejecutar un rollback automatico si falla.

## Contexto
Los health checks son el ultimo eslabon del pipeline CD. Si la app no responde correctamente tras un deploy, el rollback debe ejecutarse automaticamente.

## Especificacion Tecnica

### Ubicacion
`scripts/health-check.ts` o workflow en GitHub Actions

### Health Check Script

#### `runHealthCheck(environment: string): Promise<HealthCheckResult>`
```typescript
interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: {
    forgeApp: 'up' | 'down';
    jiraAPI: 'up' | 'down';
    rovoAPI: 'up' | 'down';
    githubAPI: 'up' | 'down';
  };
  timestamp: string;
  version: string;
}
```

#### Verificaciones
1. **Forge App**: El resolver principal responde (invoke test resolver)
2. **Jira API**: Se puede leer un ticket de test
3. **Rovo API**: Se puede obtener contexto basico
4. **GitHub API**: Se puede verificar estado de la conexion

### Flujo post-deploy
1. GitHub Actions ejecuta `forge deploy`
2. Espera 30 segundos para estabilizacion
3. Ejecuta health check script
4. Si unhealthy: dispara workflow de rollback
5. Si healthy: marca deploy como exitoso
6. Registra version en `.forge-versions.json`

### `.forge-versions.json`
```json
{
  "current": "1.2.0",
  "lastStable": "1.1.5",
  "environments": {
    "development": "1.2.1-dev",
    "staging": "1.2.0",
    "production": "1.1.5"
  }
}
```

## Acceptance Criteria
- [ ] AC-01: Health check verifica los 4 servicios criticos
- [ ] AC-02: Resultado clasificado como healthy/degraded/unhealthy
- [ ] AC-03: Script ejecutable desde GitHub Actions
- [ ] AC-04: Si unhealthy, dispara rollback automaticamente
- [ ] AC-05: Version registrada en `.forge-versions.json`
- [ ] AC-06: Timeout en cada check individual (5s)
- [ ] AC-07: Tests del script de health check
- [ ] AC-08: Archivo `.reqs.md` sidecar creado

## Reglas del Rulebook
- **[FORGE-OPS-007]**: Health check post-deploy obligatorio
- **[GIT-CI-010]**: Rollback automatico si health check falla

## Estrategia de Test
- **Unit**: Test del script con servicios mock
- **Integration**: Ejecutar health check contra entorno de staging
- **E2E**: Deploy + health check + rollback (si aplica)

## Dependencias
- TASK-025 (GitHub Actions pipeline)
- TASK-026 (versioning)

## Estado: PENDIENTE
