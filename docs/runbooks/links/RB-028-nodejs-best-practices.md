# [RB-028] Node.js Best Practices

> Fuente: Node.js Best Practices

## Reglas

### ARCH-SOLID-241
**DEFINICION:** Toda funcion asincrona debe envolver su cuerpo en try/catch o delegar el manejo de errores a un middleware de alto nivel; prohibido permitir que promesas no manejadas lleguen al runtime.
**VALOR:** En Node.js, un `unhandledRejection` crashea el proceso con codigo de salida 1. En Forge Functions, una excepcion no capturada retorna un 500 generico sin contexto, impidiendo diagnostico.
**IMPLEMENTACION:**
```typescript
// Patron en handlers
export async function handleWebhook(req: Request, res: Response): Promise<void> {
  try {
    const result = await processWebhook(req.body);
    res.json(result);
  } catch (error) {
    logger.error('Webhook processing failed', { error, body: req.body });
    res.status(500).json({ error: 'Internal processing error' });
  }
}
```
Para errores operacionales esperados, usar la clase `AppError` con `isOperational = true` para distinguirlos de bugs.
**AUDITORIA:** Ralph verifica que las funciones async exportadas en `src/` que actuan como handlers tengan un try/catch o que el error sea manejado por un middleware/envoltorio centralizado.

### ARCH-SOLID-242
**DEFINICION:** Prohibido usar callbacks anidados; todo codigo asincrono debe usar `async/await`. Si se necesita paralelismo, usar `Promise.all()` con un limite de concurrencia de 5 operaciones simultaneas para no saturar el event loop.
**VALOR:** Callbacks anidados (callback hell) imposibilitan el manejo de errores consistente y producen codigo ilegible. Sin limite de concurrencia, `Promise.all()` con 100+ promesas bloquea el event loop y agota memoria.
**IMPLEMENTACION:**
```typescript
import pLimit from 'p-limit';
const limit = pLimit(5);

async function processBatch(items: Item[]): Promise<Result[]> {
  return Promise.all(
    items.map(item => limit(() => processItem(item)))
  );
}
```
Para Forge, mantener la concurrencia en 3 porque el runtime tiene un solo thread con 25s de timeout.
**AUDITORIA:** Ralph busca patrones de callbacks anidados (`function(err, result)` dentro de otra funcion callback) y reporta como violacion.

### SEC-PRIV-241
**DEFINICION:** Toda respuesta HTTP debe incluir los headers de seguridad: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Strict-Transport-Security: max-age=31536000; includeSubDomains`, y `Content-Security-Policy` configurado para el contexto.
**VALOR:** Sin estos headers, la aplicacion es vulnerable a clickjacking, MIME-type sniffing, y downgrade attacks. Son la primera linea de defensa con zero impacto en funcionalidad.
**IMPLEMENTACION:** Usar el middleware `helmet` en Express o establecer headers manualmente en Forge Custom UI:
```typescript
import helmet from 'helmet';
app.use(helmet({ contentSecurityPolicy: { directives: { defaultSrc: ["'self'"] } } }));
```
En Forge Functions, establecer headers en la respuesta del resolver.
**AUDITORIA:** Ralph verifica que las respuestas HTTP del proyecto incluyan los 4 headers de seguridad basicos, ya sea via middleware `helmet` o manualmente.

### ARCH-SOLID-243
**DEFINICION:** Toda operacion de I/O (llamadas API, acceso a storage, queries) debe tener un timeout explicito con un valor maximo definido por operacion: 5000ms para reads, 10000ms para writes, 25000ms para operaciones externas (Jira/GitHub API).
**VALOR:** Sin timeout, una operacion de I/O puede colgar indefinidamente, consumiendo conexiones y memoria. En Forge, las funciones tienen un timeout hard de 25s; si una llamada API toma 20s, solo quedan 5s para logica de negocio.
**IMPLEMENTACION:**
```typescript
async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}
```
**AUDITORIA:** Ralph verifica que las llamadas HTTP (`fetch`, `axios`, `got`) en `src/` usen un mecanismo de timeout y que los valores no excedan 25000ms.

### ARCH-SOLID-244
**DEFINICION:** La aplicacion debe implementar health checks en `/health` (basico) y `/health/detailed` (con dependencias) que verifiquen conectividad con Jira API, GitHub API, Forge Storage y estado de la funcion.
**VALOR:** Sin health checks, los monitores de infraestructura no pueden detectar degradacion parcial (ej. la app funciona pero la API de Jira esta caida). Forge no tiene health check nativo, asi que es responsabilidad de la aplicacion.
**IMPLEMENTACION:**
```typescript
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/health/detailed', async (_req, res) => {
  const checks = await Promise.allSettled([
    checkJiraConnectivity(),
    checkGitHubConnectivity(),
    checkForgeStorage(),
  ]);
  const healthy = checks.every(c => c.status === 'fulfilled');
  res.status(healthy ? 200 : 503).json({ checks });
});
```
**AUDITORIA:** Ralph verifica la existencia de un endpoint `/health` y que el endpoint `/health/detailed` verifique al menos 2 dependencias externas.
