# TASK-021: Observability Layer - Structured Logger

## Objetivo
Implementar el sistema de logging estructurado centralizado que permite trazabilidad entre Jira, Rovo y GitHub mediante un `executionId` unico.

## Contexto
Los logs son la base de la observabilidad. Cada operacion debe generar logs con contexto suficiente para reconstruir el flujo completo de una evaluacion.

## Especificacion Tecnica

### Ubicacion
`src/backend/utils/logger.ts`

### Interfaz

#### `createLogger(context: LogContext): Logger`
```typescript
interface LogContext {
  executionId: string;
  module: string;
  ticketKey?: string;
  prNumber?: number;
  projectKey?: string;
}

interface Logger {
  info(message: string, data?: Record<string, unknown>): void;
  warn(message: string, data?: Record<string, unknown>): void;
  error(message: string, error?: Error, data?: Record<string, unknown>): void;
  debug(message: string, data?: Record<string, unknown>): void;
}
```

### Formato de log (JSON estructurado)
```json
{
  "timestamp": "2025-01-15T10:30:00Z",
  "level": "info",
  "executionId": "exec-abc123",
  "module": "scoring-engine",
  "ticketKey": "REG-123",
  "message": "Score calculated",
  "data": {
    "overall": 85,
    "axes": { "clarity": 90, "consistency": 80 }
  }
}
```

### Reglas
- `executionId` unico por flujo de evaluacion (generado al inicio)
- `executionId` se propaga a todos los logs del flujo
- Logs en Forge via `console.log` (Forge los captura)
- Nivel configurable (dev: debug, staging: info, prod: warn)
- No logear datos sensibles (tokens, passwords)

### Integracion
- Cada adapter usa el logger
- Cada resolver crea un `executionId` y lo propaga
- Los triggers generan el `executionId` inicial

## Acceptance Criteria
- [ ] AC-01: Logger genera JSON estructurado con executionId
- [ ] AC-02: Nivel de log configurable por entorno
- [ ] AC-03: No logea datos sensibles
- [ ] AC-04: executionId se propaga a traves de todo el flujo
- [ ] AC-05: Todos los adapters usan el logger
- [ ] AC-06: Zero dependencias externas
- [ ] AC-07: Tests unitarios > 90%
- [ ] AC-08: Archivo `.reqs.md` sidecar creado

## Reglas del Rulebook
- **[FORGE-OPS-005]**: Logs estructurados obligatorios
- **[SEC-PRIV-006]**: No logear datos sensibles

## Estrategia de Test
- **Unit**: Verificar formato de output, nivel de log, filtrado de sensibles
- **Integration**: Verificar propagacion de executionId
- **E2E**: N/A

## Dependencias
- TASK-005 (tipos)

## Estado: PENDIENTE
