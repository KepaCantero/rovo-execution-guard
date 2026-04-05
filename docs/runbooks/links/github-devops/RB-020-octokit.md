# [RB-020] Octokit.js SDK - Official GitHub SDK for JavaScript

> Fuente: Octokit.js - https://github.com/octokit/octokit.js

## Reglas

### GH-INTEG-308

**DEFINICION:** Toda interaccion programatica con la GitHub API debe realizarse a traves de Octokit.js (no fetch manual ni axios), instanciando un cliente autenticado con el installation token de la GitHub App, usando los plugins oficiales `@octokit/plugin-retry` y `@octokit/plugin-throttling` para manejo automatico de rate limiting.

**VALOR:** Octokit.js maneja automaticamente la construccion de URLs, serializacion, parseo de respuestas, paginacion y autenticacion. Los plugins de retry y throttling evitan que Rovo Execution Guard agote el rate limit de 5000 req/hr y reintenten automaticamente errores transitorios (500, 502, 503) con exponential backoff. Usar fetch directamente requiere reimprimir toda esta logica, con riesgo de bugs.

**IMPLEMENTACION:**
```typescript
import { Octokit } from 'octokit';
import { retry } from '@octokit/plugin-retry';
import { throttling } from '@octokit/plugin-throttling';

const CustomOctokit = Octokit.plugin(retry, throttling);

async function createOctokitClient(installationToken: string): Promise<Octokit> {
  return new CustomOctokit({
    auth: installationToken,
    retry: {
      maxRetries: 3,
      doNotRetry: [400, 401, 403, 404, 422], // no reintentar errores de cliente
    },
    throttle: {
      onRateLimit: (retryAfter: number, options: any) => {
        console.warn(
          `Rate limit hit for ${options.method} ${options.url}. Retrying after ${retryAfter}s.`
        );
        return true; // auto-retry
      },
      onSecondaryRateLimit: (retryAfter: number, options: any) => {
        console.warn(
          `Secondary rate limit hit for ${options.method} ${options.url}. Retrying after ${retryAfter}s.`
        );
        return true; // auto-retry
      },
    },
    userAgent: 'rovo-execution-guard/v1.0.0',
  });
}
```

**AUDITORIA:** Ralph verifica que toda llamada a la GitHub API use una instancia de Octokit (no fetch, no axios, no http.request). Verifica que la instancia tenga los plugins `retry` y `throttling` configurados. Si se encuentra una llamada directa a la API sin Octokit, el check falla. Si la instancia no tiene los plugins, emite un warning.

---

### GH-INTEG-309

**DEFINICION:** Las llamadas a la GitHub API a traves de Octokit deben usar retry con exponential backoff configurado a maximo 3 reintentos, con delays de 1s, 4s y 16s (base 4), y un jitter aleatorio de +-500ms. Los errores de cliente (400, 401, 403, 404, 422) no deben reintentarse.

**VALOR:** Los errores 5xx de GitHub son transitorios y se resuelven con retry. Pero reintentar un 404 (recurso eliminado) o un 422 (validacion fallida) desperdicia rate limit y delay. Para Rovo Execution Guard, un retry innecesario en un PR que ya fue cerrado puede causar que el status check se publique en un SHA que ya no existe, generando un error en cascada.

**IMPLEMENTACION:**
```typescript
import { retry } from '@octokit/plugin-retry';

const retryConfig = {
  maxRetries: 3,
  doNotRetry: [400, 401, 403, 404, 422],
  // El plugin retry usa exponential backoff por defecto
  // con jitter. Para personalizar:
  retryAfterBaseValue: 1000, // base de 1 segundo
};

// Para llamadas criticas (status checks), wrapper adicional:
async function retryCriticalOperation<T>(
  operation: () => Promise<T>,
  maxAttempts = 3
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;

      // No reintentar errores de cliente
      if (error.status >= 400 && error.status < 500) {
        throw error;
      }

      // Backoff exponencial con jitter
      const baseDelay = Math.pow(4, attempt) * 1000;
      const jitter = (Math.random() - 0.5) * 1000;
      const delay = baseDelay + jitter;

      console.warn(
        `Attempt ${attempt + 1}/${maxAttempts} failed (${error.status}). ` +
        `Retrying in ${Math.round(delay)}ms.`
      );

      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

// Uso:
const statusCheck = await retryCriticalOperation(() =>
  octokit.rest.repos.createCommitStatus({
    owner,
    repo,
    sha,
    state: 'success',
    context: 'rovo-execution-guard/consistency',
    description: 'Score: 85/100',
  })
);
```

**AUDITORIA:** Ralph verifica que la configuracion de retry en Octokit tenga `maxRetries` <= 3, que `doNotRetry` incluya los codigos 400, 401, 403, 404, 422, y que exista log de reintentos. Si `maxRetries` es mayor a 5 o no se excluyen errores de cliente, el check falla.

---

### GH-INTEG-310

**DEFINICION:** Los errores de Octokit deben capturarse usando `RequestError` de `@octokit/request-error` y clasificarse en tres categorias con acciones distintas: (1) errores transitorios (5xx, rate limit) para retry automatico, (2) errores de recurso no encontrado (404) para skip silencioso con log, (3) errores de validacion (422) para log con contexto y alerta al admin.

**VALOR:** Un error 404 al publicar un status check significa que el commit fue force-pushed y el SHA ya no existe; reintentar es inutil y genera ruido. Un error 422 puede significar que el context del status check ya fue publicado por una ejecucion anterior. Distinguir estos casos evita log spam, reintentos inutiles y falsas alertas.

**IMPLEMENTACION:**
```typescript
import { RequestError } from '@octokit/request-error';

interface ErrorClassification {
  category: 'transient' | 'not_found' | 'validation' | 'auth' | 'unknown';
  action: 'retry' | 'skip' | 'alert' | 'abort';
  retryable: boolean;
}

function classifyOctokitError(error: unknown): ErrorClassification {
  if (!(error instanceof RequestError)) {
    return { category: 'unknown', action: 'abort', retryable: false };
  }

  const { status, message } = error;

  switch (true) {
    case status === 401:
      return { category: 'auth', action: 'abort', retryable: false };

    case status === 403:
      // Podria ser rate limit o permisos insuficientes
      const isRateLimit = error.headers?.['x-ratelimit-remaining'] === '0';
      if (isRateLimit) {
        return { category: 'transient', action: 'retry', retryable: true };
      }
      return { category: 'auth', action: 'alert', retryable: false };

    case status === 404:
      return { category: 'not_found', action: 'skip', retryable: false };

    case status === 422:
      return { category: 'validation', action: 'skip', retryable: false };

    case status >= 500:
      return { category: 'transient', action: 'retry', retryable: true };

    default:
      return { category: 'unknown', action: 'abort', retryable: false };
  }
}

// Uso en el flujo de validacion:
try {
  await publishStatusCheck(octokit, checkPayload);
} catch (error) {
  const classification = classifyOctokitError(error);

  switch (classification.action) {
    case 'skip':
      console.info(`Skipping: ${(error as RequestError).message}`);
      break;
    case 'alert':
      console.error(`Admin alert required: ${(error as RequestError).message}`);
      await notifyAdmin({ error: (error as RequestError).message, status: (error as RequestError).status });
      break;
    case 'retry':
      throw error; // handled by retry plugin
    case 'abort':
      throw error;
  }
}
```

**AUDITORIA:** Ralph verifica que exista una funcion de clasificacion de errores que distinga entre transitorio (retry), not_found (skip), validacion (alert) y auth (abort). Verifica que los catches en el codigo de integracion con GitHub usen esta clasificacion. Si se encuentra un catch que no clasifica el error, emite un warning.

---

### GH-INTEG-311

**DEFINICION:** La paginacion con Octokit debe usar el metodo `octokit.paginate()` o el iterador `octokit.paginate.iterator()` en lugar de paginacion manual. Nunca usar `autoPaginate` (deprecated) ni implementar paginacion propia con llamadas GET sucesivas.

**VALOR:** `octokit.paginate()` maneja automaticamente el parsing del header `Link`, la acumulacion de resultados, y respeta el rate limiting entre paginas. Implementar paginacion manual introduce bugs (off-by-one, paginas perdidas) y no respeta los throttling plugins. Para Rovo Execution Guard, que lista commits y checks de un PR, usar `paginate()` reduce el codigo y garantiza resultados completos.

**IMPLEMENTACION:**
```typescript
// CORRECTO: usar octokit.paginate()
async function getPRCommits(
  octokit: Octokit,
  owner: string,
  repo: string,
  pullNumber: number
): Promise<Commit[]> {
  return octokit.paginate('GET /repos/{owner}/{repo}/pulls/{pull_number}/commits', {
    owner,
    repo,
    pull_number: pullNumber,
    per_page: 100,
  });
}

// CORRECTO: usar iterator para procesamiento en streaming
async function getPRFiles(
  octokit: Octokit,
  owner: string,
  repo: string,
  pullNumber: number
): Promise<PRFile[]> {
  const files: PRFile[] = [];

  for await (const response of octokit.paginate.iterator(
    'GET /repos/{owner}/{repo}/pulls/{pull_number}/files',
    {
      owner,
      repo,
      pull_number: pullNumber,
      per_page: 100,
    }
  )) {
    // Procesar pagina por pagina (memoria eficiente para PRs grandes)
    files.push(...response.data);

    // Early exit si se cumple una condicion
    const hasLockFile = response.data.some(f => f.filename === 'package-lock.json');
    if (hasLockFile) break;
  }

  return files;
}

// INCORRECTO: nunca hacer paginacion manual
// let page = 1;
// while (true) {
//   const res = await octokit.rest.pulls.listFiles({ ..., page });
//   if (res.data.length === 0) break;
//   allFiles.push(...res.data);
//   page++;
// }
```

**AUDITORIA:** Ralph verifica que toda operacion que requiere paginacion use `octokit.paginate()` o `octokit.paginate.iterator()`. Si se encuentra paginacion manual (loops con `page` o `startAt` sobre endpoints de Octokit), el check falla. Si se encuentra `autoPaginate: true` (deprecated), emite un warning.
