# [RB-010] Forge Runtime Reference

> Fuente: Forge Runtime Reference - https://developer.atlassian.com/platform/forge/runtime-reference/

## Reglas

### FORGE-OPS-015

**DEFINICION:** La memoria asignada a las funciones Forge debe configurarse explicitamente entre 128 MB y 1024 MB segun las necesidades reales, usando el default de 512 MB como punto de partida.

**VALOR:** La memoria influye directamente en el costo (en planes con billing) y el rendimiento. 128 MB es insuficiente para parsing de ADF o respuestas JSON grandes. 1024 MB desperdicia recursos para funciones simples. El default de 512 MB es adecuado para la mayoria de operaciones CRUD.

**IMPLEMENTACION:**
```yaml
# manifest.yml:
app:
  runtime:
    name: nodejs22.x
    memory: 512  # MB - ajustar segun perfilado
```
Para funciones que procesan grandes volumenes de datos (scoring, bulk validation), perfilar con `process.memoryUsage()` y ajustar:
```typescript
const mem = process.memoryUsage();
console.log('Memory usage:', {
  rss: Math.round(mem.rss / 1024 / 1024) + 'MB',
  heapUsed: Math.round(mem.heapUsed / 1024 / 1024) + 'MB',
});
```

**AUDITORIA:** Ralph verifica que `app.runtime.memory` este declarado en el manifest. Si no esta declarado, emite un warning sugiriendo un valor explicito. Si el valor es 128 MB y la funcion procesa respuestas de API, sugiere incrementar.

---

### FORGE-OPS-016

**DEFINICION:** Las funciones Forge deben ser stateless: no depender de estado en memoria entre invocaciones, ya que cada invocacion puede ejecutarse en una instancia diferente de Lambda.

**VALOR:** AWS Lambda recicla contenedores sin aviso. Variables globales en una invocacion no estaran disponibles en la siguiente. Depender de estado en memoria causa bugs intermitentes imposibles de reproducir.

**IMPLEMENTACION:**
```typescript
// INCORRECTO - estado global:
// let cache: Map<string, Score> = new Map();  // Se pierde entre invocaciones

// CORRECTO - estado persistente:
import { storage } from '@forge/api';

export async function handler(payload: TriggerPayload): Promise<void> {
  // Leer estado de Storage, no de memoria:
  const cachedScore = await storage.get(`cache:${payload.issueKey}`);
  if (cachedScore) {
    return cachedScore;
  }
  // ... procesar y guardar en Storage
}

// Variables fuera del handler se pueden usar como cache efimera:
let configCache: Config | null = null;  // OK solo como optimizacion, no como requisito
```

**AUDITORIA:** Ralph verifica que no existan variables `let` o `const` a nivel de modulo que acumulen estado entre invocaciones (ej. contadores, caches en Maps, arrays que crecen). Si las hay, deben tener un comentario `// efimero - puede perderse entre invocaciones`.

---

### ARCH-SOLID-006

**DEFINICION:** Las funciones Forge deben usar el patron Handler -> Service -> Repository, donde el handler es la funcion exportada, el service contiene la logica de negocio y el repository accede a datos.

**VALOR:** Separar las capas permite testear la logica de negocio sin depender de Forge Runtime ni de Storage. El handler es el unico punto de contacto con la plataforma, facilitando migraciones futuras. Cada capa tiene una unica responsabilidad.

**IMPLEMENTACION:**
```typescript
// handlers/pr-webhook.ts - Solo orquesta
import { handlePRWebhook } from '../services/pr-validation';

export async function handler(event: WebhookEvent): Promise<WebhookResponse> {
  try {
    const result = await handlePRWebhook(event);
    return { status: result.passed ? 'success' : 'fail' };
  } catch (error) {
    console.error('Webhook handler error:', error.message);
    return { status: 'error', message: 'Internal processing error' };
  }
}

// services/pr-validation.ts - Logica de negocio pura
export async function handlePRWebhook(event: WebhookEvent): Promise<ValidationResult> {
  const ticketKey = extractTicketKey(event.pull_request);
  const score = await calculateConsistencyScore(ticketKey);
  await saveScore(score);
  return score;
}

// repositories/score-repository.ts - Acceso a datos
```

**AUDITORIA:** Ralph verifica la estructura de archivos: handlers en `handlers/`, services en `services/`, repositories en `repositories/`. Verifica que los handlers no contengan logica de negocio ni llamadas a Storage directas.

---

### FORGE-OPS-017

**DEFINICION:** Las funciones Forge deben manejar correctamente el cold start inicializando dependencias pesadas dentro del handler, no a nivel de modulo.

**VALOR:** El cold start de Lambda incluye la carga del modulo. Inicializaciones pesadas a nivel de modulo (conexiones a DB, carga de configuraciones grandes) incrementan el cold start y pueden causar timeouts si el modulo es importado pero la funcion no se ejecuta inmediatamente.

**IMPLEMENTACION:**
```typescript
// INCORRECTO - inicializacion a nivel de modulo:
// const heavyConfig = loadHeavyConfig();  // Se ejecuta en cada cold start

// CORRECTO - lazy initialization dentro del handler:
let heavyConfig: Config | null = null;

export async function handler(payload: TriggerPayload): Promise<void> {
  if (!heavyConfig) {
    heavyConfig = await loadHeavyConfig();  // Solo cuando se necesita
  }
  // ... usar heavyConfig
}
```

**AUDITORIA:** Ralph verifica que no existan llamadas a funciones costosas (fetch, storage.get, parseo de archivos grandes) directamente en el cuerpo del modulo (fuera de funciones). Si las hay, deben estar dentro de una funcion de inicializacion lazy.
