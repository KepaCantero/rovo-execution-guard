# [RB-0100] Forge Platform Limits - Runtime, Storage, Node.js & Twelve-Factor

> Fuente: Forge Platform Quotas and Limits - https://developer.atlassian.com/platform/forge/platform-quotas-and-limits/
> Fuente: Forge Runtime Reference - https://developer.atlassian.com/platform/forge/runtime-reference/
> Fuente: Forge Storage API - https://developer.atlassian.com/platform/forge/storage/
> Fuente: The Twelve-Factor App - https://12factor.net/
> Fuente: Node.js Best Practices - https://github.com/goldbergyoni/nodebestpractices

## Reglas

### FORGE-OPS-0101

**DEFINICION:** Toda funcion Forge debe completar su trabajo critico (calculo de score, decision de enforcement, persistencia de estado) en un maximo de 8 segundos, reservando 2 segundos de margen contra el hard limit de 10 segundos de la plataforma.

**VALOR:** El limite de 10 segundos por invocacion es un hard limit impuesto por Forge. Superarlo causa terminacion forzosa sin response, dejando al usuario sin feedback y el sistema en estado inconsistente. Un ticket bloqueado sin explicacion o un PR con status check pendiente degradan la confianza de los equipos en el sistema de Quality Gates.

**IMPLEMENTACION:**
```typescript
// En cada resolver, medir y cortar antes del limite:
import { storage } from '@forge/api';

const ENFORCEMENT_BUDGET_MS = 8000;

export async function validateIssueHandler(payload: TriggerPayload): Promise<HandlerResult> {
  const start = Date.now();
  const executionId = payload.executionId;

  try {
    // 1. Recuperar contexto cacheado (rapido)
    const cached = await storage.get(`ctx:${payload.issueKey}`);
    if (cached) {
      return await enforceWithBudget(cached, start);
    }

    // 2. Fetch + score solo si queda presupuesto
    const elapsed = Date.now() - start;
    if (elapsed > 5000) {
      // No queda tiempo para fetch + score + enforce
      await persistDeferred(executionId, payload.issueKey, 'DEFERRED_TIMEOUT');
      return { status: 'deferred', reason: 'budget_exceeded' };
    }

    const context = await fetchRovoContext(payload.issueKey);
    const score = calculateScore(context);
    return await enforceWithBudget({ score, context }, start);
  } catch (error) {
    if (error.name === 'AbortError') {
      await persistDeferred(executionId, payload.issueKey, 'DEFERRED_ABORT');
    }
    throw error;
  }
}

async function enforceWithBudget(data: ValidationData, start: number): Promise<HandlerResult> {
  const remaining = ENFORCEMENT_BUDGET_MS - (Date.now() - start);
  if (remaining < 1500) {
    // Persistir para procesamiento diferido via scheduled trigger
    await storage.set(`deferred:${data.context.issueKey}`, data);
    return { status: 'deferred' };
  }
  return executeEnforcement(data);
}
```

Ademas, toda llamada `fetch` externa debe incluir `AbortController` con timeout de 3 segundos:
```typescript
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 3000);
try {
  const response = await fetch(url, { signal: controller.signal });
} finally {
  clearTimeout(timeout);
}
```

**AUDITORIA:** Ralph verifica que cada handler de resolver y trigger contenga: (1) medicion de `Date.now()` al inicio, (2) comprobacion de presupuesto antes de llamadas costosas, (3) logica de defer cuando el presupuesto se agota, y (4) `AbortController` en toda llamada `fetch` con timeout explicito.

---

### FORGE-OPS-0102

**DEFINICION:** El acceso a Forge Storage debe respetar los limites de throughput por instalacion (50 reads/s, 10 writes/s, 10 queries/s, 10 deletes/s) implementando backoff exponencial con jitter en toda operacion de escritura, y no debe exceder la cuota total de 100 MB por app.

**VALOR:** Superar los limites de throughput genera errores HTTP 429 que causan fallos transitorios en cascada. En un flujo de validacion que involucra leer contexto, calcular score y persistir resultado, un throttle en la escritura del score puede dejar el sistema sin registro de la validacion, causando re-ejecuciones innecesarias o duplicadas. Superar 100 MB causa errores de escritura irreversibles hasta que se libere espacio.

**IMPLEMENTACION:**
```typescript
// utils/resilient-storage.ts
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 100;
const JITTER_MAX_MS = 50;

function jitter(): number {
  return Math.floor(Math.random() * JITTER_MAX_MS);
}

export async function resilientStorageSet(key: string, value: unknown): Promise<void> {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      await storage.set(key, value);
      return;
    } catch (err) {
      if (err?.statusCode === 429 && attempt < MAX_RETRIES) {
        const delay = Math.pow(2, attempt) * BASE_DELAY_MS + jitter();
        await new Promise(r => setTimeout(r, delay));
      } else {
        throw new ForgeStorageError(`storage.set failed after ${attempt} attempts`, {
          key,
          cause: err,
        });
      }
    }
  }
}

// Para lecturas en batch, usar batch-get cuando este disponible
// o espaciar lecturas para no superar 50/s:
export async function batchGet(keys: string[]): Promise<Map<string, unknown>> {
  const results = new Map<string, unknown>();
  const BATCH_INTERVAL_MS = 25; // 40 reads/s, por debajo del limite
  for (const key of keys) {
    const value = await storage.get(key);
    if (value !== undefined) results.set(key, value);
    await new Promise(r => setTimeout(r, BATCH_INTERVAL_MS));
  }
  return results;
}
```

Para el control de cuota, implementar monitoreo en scheduled trigger:
```typescript
export async function monitorStorageQuota(): Promise<void> {
  const usage = await storage.query()
    .where('key', 'startsWith', 'score:')
    .limit(1)
    .getMany();

  // Estimar tamano iterando y sumando JSON.stringify().length
  // Si se acerca al 80% (80 MB), emitir alerta
  // Si supera 90% (90 MB), activar limpieza agresiva
}
```

**AUDITORIA:** Ralph verifica que: (1) toda llamada a `storage.set`, `storage.delete`, y operaciones de entity store este envuelta en backoff exponencial con jitter, (2) no existan llamadas directas sin retry en handlers de produccion, (3) exista un scheduled trigger que monitoree la cuota de Storage, y (4) las escrituras en Storage incluyan logica de rotacion o TTL para registros temporales.

---

### ARCH-SOLID-0103

**DEFINICION:** La configuracion de la aplicacion (thresholds de scoring, URLs de APIs, flags de feature, modo degradado) debe almacenarse exclusivamente en Forge Storage como key-value pairs con el prefijo `config:`, nunca hardcoded en el codigo fuente ni en variables de entorno del runtime.

**VALOR:** Los principios Twelve-Factor App establecen que la configuracion debe estar estrictamente separada del codigo. En Forge no existen variables de entorno tradicionales; Forge Storage es el mecanismo correcto. Hardcodear el threshold del Consistency Score (80%) en el codigo significa que cualquier ajuste requiere un redeploy completo, que en Forge implica pasar por staging y produccion con window de downtime. Un flag de modo degradado hardcoded no puede activarse en emergencias sin deploy.

**IMPLEMENTACION:**
```typescript
// config/app-config.ts
import { storage } from '@forge/api';

const CONFIG_PREFIX = 'config:';

export interface AppConfig {
  consistencyThreshold: number;     // Default: 80
  rovoCacheTtlSeconds: number;      // Default: 300
  degradedMode: boolean;            // Default: false
  maxConsecutiveFailures: number;   // Default: 3
  failureWindowMinutes: number;     // Default: 5
  githubCheckNeutral: boolean;      // Default: false
}

const DEFAULTS: AppConfig = {
  consistencyThreshold: 80,
  rovoCacheTtlSeconds: 300,
  degradedMode: false,
  maxConsecutiveFailures: 3,
  failureWindowMinutes: 5,
  githubCheckNeutral: false,
};

let configCache: AppConfig | null = null;
let configCacheExpiry = 0;
const CACHE_TTL_MS = 60_000; // 1 minuto en memoria

export async function getConfig(): Promise<AppConfig> {
  if (configCache && Date.now() < configCacheExpiry) {
    return configCache;
  }
  const stored = await storage.get(`${CONFIG_PREFIX}app`);
  configCache = stored ? { ...DEFAULTS, ...stored } : { ...DEFAULTS };
  configCacheExpiry = Date.now() + CACHE_TTL_MS;
  return configCache;
}

// Solo para admin o scripts de emergencia:
export async function updateConfig(patch: Partial<AppConfig>): Promise<void> {
  const current = await getConfig();
  const updated = { ...current, ...patch };
  await storage.set(`${CONFIG_PREFIX}app`, updated);
  configCache = null; // Invalidar cache efimero
}
```

El manifest.yml solo contiene configuracion de infraestructura (app ID, modulos, permisos), nunca de negocio:
```yaml
# CORRECTO en manifest:
app:
  runtime:
    name: nodejs22.x
permissions:
  scopes:
    - read:jira-work

# INCORRECTO - no poner config de negocio:
# const THRESHOLD = 80;  // Debe estar en Storage
```

**AUDITORIA:** Ralph verifica que: (1) no existan constantes numericas de negocio (thresholds, timeouts, umbrales) en archivos `.ts` fuera de un archivo `DEFAULTS` o `config/`, (2) toda lectura de configuracion pase por `getConfig()`, y (3) los valores por defecto esten centralizados en un unico objeto `DEFAULTS`.

---

### FORGE-OPS-0104

**DEFINICION:** La app debe implementar graceful degradation como primer mecanismo de resiliencia: cuando Rovo o GitHub esten unavailable, el sistema debe operar en modo reducido (validacion estructural unicamente) en vez de fallar completamente o bloquear todos los flujos.

**VALOR:** Los limites de Forge (10s runtime, 100 network requests) y la naturaleza multi-tenant del entorno hacen que las dependencias externas fallen con frecuencia. Si Rovo esta caido y todos los Quality Gates fallan, los equipos quedan imposibilitados de trabajar. Un sistema de enforcement que bloquea todo cuando falla es peor que no tener enforcement. La degradation graceful es consistente con los principios de Twelve-Factor sobre disposability y robustez.

**IMPLEMENTACION:**
```typescript
// services/degradation-manager.ts
import { storage } from '@forge/api';

interface FailureTracker {
  consecutiveFailures: number;
  lastFailureAt: number;
  degradedSince: number | null;
}

const FAILURE_KEY = 'state:degradation';

export async function recordFailure(service: 'rovo' | 'github'): Promise<void> {
  const tracker: FailureTracker = (await storage.get(`${FAILURE_KEY}:${service}`)) || {
    consecutiveFailures: 0,
    lastFailureAt: 0,
    degradedSince: null,
  };

  tracker.consecutiveFailures += 1;
  tracker.lastFailureAt = Date.now();

  const config = await getConfig();
  if (tracker.consecutiveFailures >= config.maxConsecutiveFailures && !tracker.degradedSince) {
    tracker.degradedSince = Date.now();
    await storage.set(`${FAILURE_KEY}:${service}`, tracker);
    // Emitir metrica de activacion de modo degradado
    console.warn(`DEGRADED_MODE activated for ${service}`, {
      consecutiveFailures: tracker.consecutiveFailures,
    });
    return;
  }

  await storage.set(`${FAILURE_KEY}:${service}`, tracker);
}

export async function recordSuccess(service: 'rovo' | 'github'): Promise<void> {
  await storage.set(`${FAILURE_KEY}:${service}`, {
    consecutiveFailures: 0,
    lastFailureAt: 0,
    degradedSince: null,
  });
}

export async function isDegraded(service: 'rovo' | 'github'): Promise<boolean> {
  const tracker: FailureTracker = await storage.get(`${FAILURE_KEY}:${service}`);
  if (!tracker?.degradedSince) return false;

  // Auto-recovery: si paso 1 hora desde degradacion, intentar recuperarse
  const ONE_HOUR = 60 * 60 * 1000;
  if (Date.now() - tracker.degradedSince > ONE_HOUR) {
    await storage.set(`${FAILURE_KEY}:${service}`, {
      consecutiveFailures: 0,
      lastFailureAt: 0,
      degradedSince: null,
    });
    return false;
  }

  return true;
}
```

Uso en el flujo de validacion:
```typescript
export async function validateIssue(issueKey: string): Promise<ValidationResult> {
  const rovoDegraded = await isDegraded('rovo');

  if (rovoDegraded) {
    // Modo reducido: solo validacion estructural sin contexto Rovo
    return {
      score: calculateStructuralScore(issueKey),
      mode: 'DEGRADED',
      warnings: ['Rovo unavailable - structural validation only'],
    };
  }

  try {
    const context = await fetchRovoContext(issueKey);
    await recordSuccess('rovo');
    return calculateFullScore(issueKey, context);
  } catch (error) {
    await recordFailure('rovo');
    return {
      score: calculateStructuralScore(issueKey),
      mode: 'DEGRADED_FALLBACK',
      warnings: ['Rovo failure - falling back to structural validation'],
    };
  }
}
```

**AUDITORIA:** Ralph verifica que: (1) exista un modulo `degradation-manager` con `recordFailure`, `recordSuccess`, e `isDegraded`, (2) todo flujo que dependa de Rovo o GitHub tenga un path alternativo cuando `isDegraded()` retorna true, (3) los tests de integracion cubran el escenario de modo degradado, y (4) el modo degradado nunca bloquee permanentemente un ticket (solo warnings o bloqueos parciales).

---

### FORGE-OPS-0105

**DEFINICION:** Las funciones Forge deben ser stateless y disposables: sin estado mutable a nivel de modulo entre invocaciones, sin depender de warm instances, y capaces de ser terminadas y reiniciadas en cualquier momento sin perder datos de negocio.

**VALOR:** Forge ejecuta funciones en AWS Lambda, que recicla contenedores sin aviso. Variables globales mutables (caches en Map, contadores, arrays acumulativos) se pierden entre invocaciones y causan bugs intermitentes imposibles de reproducir. Doce-Factor establece que los procesos deben ser disposables: arranque rapido y parada graceful. En Forge, una funcion que depende de estado en memoria no puede escalar ni recuperarse de fallos.

**IMPLEMENTACION:**
```typescript
// INCORRECTO - estado mutable global:
// let scoreCache = new Map<string, number>();  // Se pierde entre invocaciones
// let requestCount = 0;                         // Se reinicia sin aviso

// CORRECTO - stateless con persistencia:

// Cache efimera (solo optimizacion dentro de una invocacion):
export async function handler(payload: TriggerPayload): Promise<void> {
  const invocationCache = new Map<string, unknown>(); // Local al handler

  const score = await getOrCompute(invocationCache, payload.issueKey, async () => {
    return calculateScore(payload.issueKey);
  });

  await persistScore(score); // Estado en Forge Storage, no en memoria
}

// Variables de modulo solo para caches efimeros con comentario explicito:
let ephemeralConfigCache: AppConfig | null = null; // EFIMERO - puede perderse entre invocaciones
let ephemeralCacheExpiry = 0;

// Para estado durable, SIEMPRE usar Forge Storage:
export async function getProcessingState(issueKey: string): Promise<ProcessingState> {
  return await storage.get(`state:${issueKey}`) || { status: 'PENDING', attempts: 0 };
}

export async function updateProcessingState(issueKey: string, state: ProcessingState): Promise<void> {
  await resilientStorageSet(`state:${issueKey}`, state);
}

// Shutdown graceful: guardar progreso antes de responder
export async function processWithCheckpoint(issueKey: string): Promise<void> {
  const steps = ['fetch', 'score', 'enforce', 'notify'];

  for (const step of steps) {
    // Guardar checkpoint antes de cada paso
    await updateProcessingState(issueKey, { currentStep: step, status: 'IN_PROGRESS' });

    try {
      await executeStep(step, issueKey);
    } catch (error) {
      // Estado persistido permite reanudar desde el ultimo checkpoint
      await updateProcessingState(issueKey, { currentStep: step, status: 'FAILED', error: error.message });
      throw error;
    }
  }

  await updateProcessingState(issueKey, { currentStep: 'complete', status: 'DONE' });
}
```

**AUDITORIA:** Ralph verifica que: (1) no existan variables `let` a nivel de modulo que acumulen estado entre invocaciones sin el comentario `// EFIMERO`, (2) ningun handler dependa de estado global para su correcto funcionamiento (tests unitarios deben pasar sin inicializacion previa), (3) las operaciones multi-paso persistan checkpoints en Storage entre pasos, y (4) los tests unitarios validen que el handler funciona correctamente desde cero (sin estado previo).
