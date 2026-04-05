# [RB-015] GitHub Webhooks - Signature Verification & Event Handling

> Fuente: GitHub Webhooks Guide - https://docs.github.com/en/webhooks

## Reglas

### SEC-PRIV-301

**DEFINICION:** Todo webhook recibido desde GitHub debe ser verificado usando HMAC-SHA256 con el secret configurado en la GitHub App antes de procesar cualquier payload. La verificacion debe comparar el header `X-Hub-Signature-256` con el hash computado sobre el raw body (no el parsed JSON).

**VALOR:** Sin verificacion de firma, cualquier actor puede enviar payloads falsos al endpoint de Rovo Execution Guard, causando que se aprueben o bloqueen PRs de forma maliciosa. Un payload falso que simule un PR aprobado podria bypassar el scoring de consistencia y permitir merges de codigo no validado.

**IMPLEMENTACION:**
```typescript
import { createHmac, timingSafeEqual } from 'crypto';

function verifyWebhookSignature(
  rawBody: string | Buffer,
  signatureHeader: string,
  webhookSecret: string
): boolean {
  if (!signatureHeader || !signatureHeader.startsWith('sha256=')) {
    return false;
  }

  const expectedSignature = signatureHeader.slice(7); // remove 'sha256=' prefix
  const computed = createHmac('sha256', webhookSecret)
    .update(rawBody)
    .digest('hex');

  // timing-safe comparison to prevent timing attacks
  const expected = Buffer.from(expectedSignature, 'hex');
  const actual = Buffer.from(computed, 'hex');

  if (expected.length !== actual.length) {
    return false;
  }

  return timingSafeEqual(expected, actual);
}

// Uso en el handler:
async function handleWebhook(request: Request): Promise<Response> {
  const rawBody = await request.text();
  const signature = request.headers.get('x-hub-signature-256') ?? '';

  if (!verifyWebhookSignature(rawBody, signature, WEBHOOK_SECRET)) {
    return new Response('Invalid signature', { status: 401 });
  }

  const payload = JSON.parse(rawBody);
  // ... procesar payload verificado
}
```

**AUDITORIA:** Ralph verifica que todo webhook handler use `crypto.timingSafeEqual` (no `===`) para comparar firmas HMAC-SHA256, que compare contra `X-Hub-Signature-256` (no `X-Hub-Signature`), y que la verificacion ocurra antes de cualquier parsing o procesamiento del payload. Si se encuentra una comparacion de firma con `===` o sin timing-safe, el check falla.

---

### GH-INTEG-306

**DEFINICION:** Los webhook handlers deben ser idempotentes: procesar el mismo evento multiples veces debe producir el mismo resultado final. Esto se logra usando el header `X-GitHub-Delivery` (UUID) como clave de deduplicacion con un TTL de al menos 5 minutos.

**VALOR:** GitHub puede entregar el mismo webhook hasta 3 veces en caso de timeout o error de red. Sin idempotencia, un PR podria recibir multiples comentarios duplicados, o el scoring podria ejecutarse multiples veces consumiendo rate limit y recursos de Forge innecesariamente.

**IMPLEMENTACION:**
```typescript
import { storage } from '@forge/api';

const DEDUP_TTL_SECONDS = 300; // 5 minutos

async function isDuplicateDelivery(deliveryId: string): Promise<boolean> {
  const cacheKey = `webhook:dedup:${deliveryId}`;
  const existing = await storage.get(cacheKey);

  if (existing) {
    return true; // ya procesado
  }

  // Marcar como procesado
  await storage.set(cacheKey, { processedAt: Date.now() });
  // Nota: Forge Storage no tiene TTL nativo, limpiar via scheduled job
  return false;
}

// Uso en el handler:
async function handleWebhook(request: Request): Promise<Response> {
  // ... verificacion de firma ...

  const deliveryId = request.headers.get('x-github-delivery') ?? '';
  if (!deliveryId || await isDuplicateDelivery(deliveryId)) {
    return new Response('Already processed', { status: 200 });
  }

  // ... procesar evento ...
}
```

**AUDITORIA:** Ralph verifica que todo webhook handler lea el header `X-GitHub-Delivery` y lo use como clave de deduplicacion antes de procesar el payload. Verifica que exista un mecanismo de almacenamiento (Storage o cache) para tracking de delivery IDs. Si no se encuentra deduplicacion, el check falla.

---

### GH-INTEG-307

**DEFINICION:** Los webhook handlers deben filtrar eventos por tipo usando el header `X-GitHub-Event` y procesar unicamente los eventos relevantes para Rovo Execution Guard: `pull_request` (acciones: opened, synchronize, reopened), `pull_request_review` (acciones: submitted) y `status`. Los demas eventos deben ser descartados inmediatamente con HTTP 200.

**VALOR:** GitHub envia webhooks para docenas de eventos (push, issues, label, etc.). Procesar eventos irrelevantes consume recursos de Forge (limite 25 sec) y puede causar timeouts en eventos que si importan. Filtrar por tipo y accion reduce la carga de procesamiento en un 80%+.

**IMPLEMENTACION:**
```typescript
const SUPPORTED_EVENTS = new Set([
  'pull_request',
  'pull_request_review',
  'status',
]);

const SUPPORTED_PR_ACTIONS = new Set([
  'opened',
  'synchronize',
  'reopened',
]);

function shouldProcessEvent(
  eventType: string,
  payload: Record<string, any>
): { process: boolean; reason: string } {
  if (!SUPPORTED_EVENTS.has(eventType)) {
    return { process: false, reason: `Unsupported event: ${eventType}` };
  }

  if (eventType === 'pull_request') {
    const action = payload.action;
    if (!SUPPORTED_PR_ACTIONS.has(action)) {
      return { process: false, reason: `Unsupported PR action: ${action}` };
    }
  }

  return { process: true, reason: 'Event accepted' };
}

// Uso:
async function handleWebhook(request: Request): Promise<Response> {
  // ... verificacion y deduplicacion ...

  const eventType = request.headers.get('x-github-event') ?? '';
  const result = shouldProcessEvent(eventType, payload);

  if (!result.process) {
    console.info(`Webhook filtered: ${result.reason}`);
    return new Response('Filtered', { status: 200 });
  }

  // ... procesar evento relevante ...
}
```

**AUDITORIA:** Ralph verifica que el webhook handler lea el header `X-GitHub-Event` y filtre eventos no soportados antes de cualquier logica de negocio. Verifica que para `pull_request` solo se procesen las acciones `opened`, `synchronize` y `reopened`. Si se procesan eventos de tipos no listados, emite un warning.

---

### SEC-PRIV-302

**DEFINICION:** Los webhooks de GitHub deben ser recibidos exclusivamente sobre HTTPS y el endpoint debe retornar HTTP 200 dentro de los primeros 5 segundos de procesamiento, delegando el trabajo pesado (scoring, llamadas a Rovo, publicacion de status checks) a un proceso asincrono o cola.

**VALOR:** GitHub espera una respuesta en menos de 10 segundos. Si el endpoint no responde en 10 segundos, GitHub reintenta la entrega. Rovo Execution Guard debe llamar a Rovo AI, Jira API y GitHub API durante la validacion, lo que puede superar 10 segundos facilmente. Delegar a async evita reintentos y payloads duplicados.

**IMPLEMENTACION:**
```typescript
import { queue } from '@forge/api';

async function handleWebhook(request: Request): Promise<Response> {
  // 1. Verificar firma (< 1ms)
  // 2. Deduplicar (< 100ms via Storage)
  // 3. Filtrar evento (< 1ms)
  // 4. Encolar trabajo pesado

  const rawBody = await request.text();
  // ... verificacion, deduplicacion, filtrado ...

  // Encolar para procesamiento asincrono
  await queue.push('process-pr-validation', {
    deliveryId,
    eventType,
    payload,
    receivedAt: Date.now(),
  });

  // Responder inmediatamente
  return new Response('Accepted', { status: 200 });
}

// Handler asincrono que procesa la cola
export async function processValidation(payload: ValidationJob): Promise<void> {
  const { prData } = payload;
  const score = await scoringEngine.evaluate(prData);
  await publishStatusCheck(octokit, score);
  await postPRComment(octokit, score);
}
```

**AUDITORIA:** Ralph verifica que el webhook handler responda HTTP 200 antes de ejecutar llamadas a APIs externas (Rovo, Jira, GitHub). Verifica que el trabajo pesado se delegue a un mecanismo async (queue, scheduled trigger). Si se encuentran llamadas bloqueantes a APIs externas antes de la respuesta HTTP, el check falla.
