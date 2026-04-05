# TASK-005: Domain Layer - Types and Models

## Objetivo
Definir todos los tipos, interfaces y modelos de datos del dominio de Rovo Execution Guard.

## Contexto
La capa de dominio es el corazon de la app. Define los contratos que todas las demas capas respetan. Sin tipos solidos, el resto de la app no puede construirse con seguridad.

## Especificacion Tecnica

### Tipos core a definir en `src/backend/types/`

#### ConsistencyScore
```typescript
interface ConsistencyScore {
  overall: number; // 0-100
  axes: {
    clarity: number;      // Claridad del ticket
    consistency: number;  // Consistencia con documentacion
    risk: number;         // Riesgo tecnico
    documentation: number; // Cobertura de documentacion
    technicalDebt: number; // Deuda tecnica detectada
  };
  timestamp: string;
  executionId: string;
}
```

#### Inconsistency
```typescript
interface Inconsistency {
  id: string;
  type: 'contradiction' | 'duplicate' | 'missing_context' | 'ambiguity';
  severity: 'critical' | 'warning' | 'info';
  source: 'rovo' | 'jira' | 'confluence' | 'github';
  description: string;
  affectedTicketKey: string;
  relatedDocs?: string[];
  suggestion?: string;
}
```

#### QualityGateResult
```typescript
interface QualityGateResult {
  gate: 'definition' | 'execution' | 'delivery';
  passed: boolean;
  score: ConsistencyScore;
  inconsistencies: Inconsistency[];
  blockedTransitions: string[];
  executionId: string;
}
```

#### ProjectConfig
```typescript
interface ProjectConfig {
  projectKey: string;
  enabled: boolean;
  scoreThreshold: number; // default: 80
  gates: {
    definition: boolean;
    execution: boolean;
    delivery: boolean;
  };
  githubRepo?: string;
  githubOwner?: string;
}
```

#### EnforcementAction
```typescript
type EnforcementAction =
  | { type: 'block_transition'; transitionId: string; reason: string }
  | { type: 'block_pr'; prNumber: number; repo: string; reason: string }
  | { type: 'add_comment'; target: 'jira' | 'github'; body: string }
  | { type: 'flag_inconsistency'; inconsistency: Inconsistency };
```

### Tipos adicionales
- `RovoContext`: Contexto extraido de Rovo
- `JiraTicketData`: Datos del ticket de Jira
- `GitHubPRData`: Datos del Pull Request
- `ConfluencePageData`: Datos de pagina de Confluence
- `AuditLogEntry`: Entrada de log de auditoria

## Acceptance Criteria
- [ ] AC-01: Todos los tipos definidos con TypeScript strict (no `any`)
- [ ] AC-02: Tipos exportados desde un barrel file (`index.ts`)
- [ ] AC-03: Documentacion JSDoc en cada tipo e interface
- [ ] AC-04: Tipos cubren los 3 Quality Gates (definition, execution, delivery)
- [ ] AC-05: `ConsistencyScore` tiene los 5 ejes del Spider Chart
- [ ] AC-06: Archivo `.reqs.md` sidecar creado
- [ ] AC-07: `npm run typecheck` pasa sin errores

## Reglas del Rulebook
- **[ARCH-SOLID-001]**: Separacion de capas estricta
- **[ARCH-SOLID-002]**: No dependencia hacia capas externas desde dominio
- **[ARCH-SOLID-003]**: TypeScript estricto obligatorio

## Estrategia de Test
- **Unit**: Validar que los tipos se usan correctamente (compile-time)
- **Integration**: N/A
- **E2E**: N/A

## Dependencias
- TASK-001 (estructura de carpetas)
- TASK-003 (tsconfig.json)

## Estado: PENDIENTE
