# [RB-039] CloudEvents Spec - Event Structure, Context Attributes

> Fuente: CloudEvents Spec - Event structure, context attributes

## Reglas

### ARCH-SOLID-039-01
**DEFINICION:** Todo evento interno debe cumplir el formato CloudEvents v1.0 con los atributos obligatorios: `specversion`, `type`, `source`, `id`, `time`, y `datacontenttype`.
**VALOR:** La estandarizacion del formato de eventos permite que cualquier consumidor procese eventos sin conocimiento del productor, facilitando la adicion de nuevos suscriptores sin acoplamiento.
**IMPLEMENTACION:** Definir un type `CloudEvent<T>` con los campos obligatorios: `interface CloudEvent<T> { specversion: '1.0'; type: string; source: string; id: string; time: string; datacontenttype: 'application/json'; data: T }`. Crear factory `createEvent<T>(type: string, source: string, data: T): CloudEvent<T>` que genera `id` con UUID v4 y `time` con ISO 8601.
**AUDITORIA:** Ralph verifica que todos los eventos emitidos en el sistema usan la interfaz `CloudEvent<T>` y que el factory genera los 6 atributos obligatorios.

### ARCH-SOLID-039-02
**DEFINICION:** El atributo `type` debe seguir el patron `com.atlassian.execution_guard.<domain>.<action>.<version>` donde action es uno de: `created`, `updated`, `deleted`, `scored`, `enforced`.
**VALOR:** Los tipos jerarquicos y versionados permiten a los consumidores filtrar y enrutar eventos sin inspeccionar el payload, y evolucionar esquemas sin romper suscriptores.
**IMPLEMENTACION:** Definir constantes: `const EventTypes = { SCORING_COMPLETED: 'com.atlassian.execution_guard.scoring.scored.v1', INCONSISTENCY_DETECTED: 'com.atlassian.execution_guard.inconsistency.created.v1', ENFORCEMENT_TRIGGERED: 'com.atlassian.execution_guard.enforcement.enforced.v1' }` en `src/types/events.ts`. Nunca usar strings literales fuera de esta constante.
**AUDITORIA:** Ralph verifica que todos los valores de `type` en eventos siguen el patron de nomenclatura y que existen en `EventTypes`.

### ARCH-SOLID-039-03
**DEFINICION:** El atributo `source` debe identificar univocamente el modulo productor usando el formato `/execution-guard/<module>/<adapter>`; nunca usar URLs de dominio externo.
**VALOR:** Permite rastrear el origen exacto de cada evento dentro del sistema sin depender de infraestructura externa, facilitando debugging y auditoria.
**IMPLEMENTACION:** Usar `source: '/execution-guard/orchestration/jira-trigger'` para eventos del trigger de Jira, `source: '/execution-guard/scoring/engine'` para scoring, etc. Centralizar en `const EventSources = { JIRA_TRIGGER: '/execution-guard/orchestration/jira-trigger', SCORING_ENGINE: '/execution-guard/scoring/engine', GITHUB_WEBHOOK: '/execution-guard/orchestration/github-webhook' }`.
**AUDITORIA:** Ralph verifica que cada evento usa un `source` definido en `EventSources` y que el formato sigue `/execution-guard/<module>/<adapter>`.

### ARCH-SOLID-039-04
**DEFINICION:** El campo `data` de cada evento debe estar tipado con una interfaz TypeScript especifica por tipo de evento; nunca usar `any` o `Record<string, unknown>` como tipo de data.
**VALOR:** La tipificacion estricta previene errores en tiempo de ejecucion donde un consumidor asume campos que no existen, y genera errores de compilacion ante cambios de esquema.
**IMPLEMENTACION:** Definir interfaces como `interface ScoringCompletedData { executionId: string; issueKey: string; score: number; gateResult: GateResult; timestamp: string }`. Usar `CloudEvent<ScoringCompletedData>` como tipo completo del evento. Exportar todas las interfaces desde `src/types/event-data.ts`.
**AUDITORIA:** Ralph verifica que ningun evento usa `any` en su campo `data` y que cada tipo de evento tiene su interfaz correspondiente en `src/types/event-data.ts`.

### ARCH-SOLID-039-05
**DEFINICION:** Los atributos de extension customizados deben usar el prefijo `xeg-` (execution-guard) y documentarse en `docs/event-extensions.md`; nunca anadir extensiones sin documentacion.
**VALOR:** Evita colisiones de nombres con extensiones futuras del estandar CloudEvents y mantiene la trazabilidad de por que existe cada extension.
**IMPLEMENTACION:** Ejemplo: `event['xeg-tenant-cloud-id'] = tenantCloudId; event['xeg-correlation-id'] = correlationId`. Documentar en `docs/event-extensions.md` con formato: nombre, tipo, descripcion, ejemplo, modulo productor.
**AUDITORIA:** Ralph verifica que todos los atributos de extension usan el prefijo `xeg-` y que cada uno esta documentado en `docs/event-extensions.md`.
