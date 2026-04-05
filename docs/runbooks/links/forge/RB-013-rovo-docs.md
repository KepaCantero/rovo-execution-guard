# [RB-013] Atlassian Rovo Documentation

> Fuente: Atlassian Rovo & Forge Rovo Agents - https://developer.atlassian.com/platform/forge/

## Reglas

### ROVO-INTEG-004

**DEFINICION:** El contexto extraido via Rovo debe ser tratado como datos no confiables y validado antes de ser usado en decisiones de scoring o blocking de PRs.

**VALOR:** Rovo agrega datos de multiples fuentes (Confluence, Jira, chat, drive) con diferentes niveles de precision y actualidad. Un documento desactualizado en Confluence puede causar un falso positivo en la deteccion de inconsistencias. Las decisiones de blocking basadas en datos invalidos erosionan la confianza del equipo en la herramienta.

**IMPLEMENTACION:**
```typescript
interface RovoContext {
  source: string;
  lastUpdated: string;
  confidence: number;
  content: string;
}

function validateRovoContext(context: RovoContext): ValidatedContext {
  const MAX_AGE_DAYS = 90;
  const MIN_CONFIDENCE = 0.6;

  const age = (Date.now() - new Date(context.lastUpdated).getTime()) / (1000 * 60 * 60 * 24);

  if (age > MAX_AGE_DAYS) {
    return { valid: false, reason: `Context too old: ${Math.round(age)} days` };
  }

  if (context.confidence < MIN_CONFIDENCE) {
    return { valid: false, reason: `Confidence too low: ${context.confidence}` };
  }

  return { valid: true, data: context.content };
}

// En scoring:
const validatedContexts = rovoContexts
  .map(validateRovoContext)
  .filter(c => c.valid);
```

**AUDITORIA:** Ralph verifica que toda funcion que consume datos de Rovo pase el resultado por una funcion de validacion que verifique antiguedad, confianza y formato antes de usarlo para scoring.

---

### ROVO-INTEG-005

**DEFINICION:** Las llamadas al API de Rovo deben implementar timeout propio (maximo 5 segundos) y fallback graceful cuando Rovo no esta disponible.

**VALOR:** Rovo es un servicio de IA con latencia variable. Sin timeout, una llamada a Rovo puede consumir la mayor parte del limite de 10 segundos de Forge. Sin fallback, la app bloquea PRs cuando Rovo esta down, causando friccion innecesaria al equipo de desarrollo.

**IMPLEMENTACION:**
```typescript
const ROVO_TIMEOUT_MS = 5000;

async function fetchRovoContextWithFallback(
  query: string,
  fallbackContext: CachedContext | null
): Promise<RovoResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ROVO_TIMEOUT_MS);

  try {
    const result = await invoke('queryRovo', { query }, { signal: controller.signal });
    clearTimeout(timeout);
    return result;
  } catch (error) {
    clearTimeout(timeout);

    if (error.name === 'AbortError') {
      console.warn('Rovo query timed out, using fallback');
    } else {
      console.warn('Rovo query failed:', error.message);
    }

    if (fallbackContext) {
      return {
        source: 'cache',
        data: fallbackContext,
        isFallback: true,
      };
    }

    // Sin fallback, permitir el PR con score neutral
    return {
      source: 'unavailable',
      data: null,
      isFallback: true,
    };
  }
}
```

**AUDITORIA:** Ralph verifica que toda llamada a funciones de Rovo (invoke de Rovo agents, queries de contexto) este envuelta en un timeout de maximo 5 segundos y que exista un camino de fallback que no bloquee el PR.

---

### ROVO-INTEG-006

**DEFINICION:** Los resultados de Rovo deben cachearse en Forge Storage con un TTL para evitar llamadas repetidas para el mismo contexto.

**VALOR:** Rovo queries son costosas en latencia y potencialmente en compute. Para la misma consulta sobre un ticket de Jira, el contexto no cambia frecuentemente. Cachear reduce la latencia total del check de PR de segundos a milisegundos.

**IMPLEMENTACION:**
```typescript
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 horas

interface CachedRovoResult {
  data: RovoResult;
  cachedAt: number;
  expiresAt: number;
}

async function getRovoContextWithCache(
  ticketKey: string,
  query: string
): Promise<RovoResult> {
  const cacheKey = `rovo:context:${ticketKey}`;
  const cached = await storage.get(cacheKey);

  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  const freshResult = await fetchRovoContextWithFallback(query, cached?.data ?? null);

  const cacheEntry: CachedRovoResult = {
    data: freshResult,
    cachedAt: Date.now(),
    expiresAt: Date.now() + CACHE_TTL_MS,
  };
  await storage.set(cacheKey, cacheEntry);

  return freshResult;
}
```

**AUDITORIA:** Ralph verifica que las funciones que invocan Rovo lean primero de un cache en Storage y que el cache tenga un TTL explicito (campo `expiresAt`). Verifica que los caches expirados sean sobreescritos con datos frescos.

---

### ARCH-SOLID-007

**DEFINICION:** La integracion con Rovo debe estar desacoplada del scoring engine mediante un adaptador, permitiendo mockear Rovo en tests y reemplazarlo si el API cambia.

**VALOR:** Rovo es un producto en evolucion con APIs que pueden cambiar. Acoplar directamente el scoring a la estructura de respuesta de Rovo hace que cualquier cambio en Rovo rompa el scoring. Un adaptador permite cambiar la fuente de contexto sin modificar la logica de scoring.

**IMPLEMENTACION:**
```typescript
// interfaces/context-provider.ts
export interface ContextProvider {
  query(request: ContextRequest): Promise<ContextResult[]>;
}

// adapters/rovo-context-provider.ts
export class RovoContextProvider implements ContextProvider {
  async query(request: ContextRequest): Promise<ContextResult[]> {
    const rovoResponse = await invoke('queryRovo', {
      query: request.query,
      sources: request.sources,
    });
    return rovoResponse.results.map(this.mapToContextResult);
  }

  private mapToContextResult(raw: any): ContextResult {
    return {
      source: raw.source,
      content: raw.content,
      confidence: raw.relevanceScore ?? 0.5,
      lastUpdated: raw.lastModifiedAt ?? new Date().toISOString(),
    };
  }
}

// adapters/mock-context-provider.ts (para tests)
export class MockContextProvider implements ContextProvider {
  constructor(private fixtures: ContextResult[]) {}
  async query(): Promise<ContextResult[]> {
    return this.fixtures;
  }
}
```

**AUDITORIA:** Ralph verifica que exista una interfaz `ContextProvider` y que el scoring engine la reciba como dependencia (inyeccion), no que instancie directamente el adaptador de Rovo. Verifica que exista un `MockContextProvider` para tests.
