# [RB-014] GitHub REST API - PRs, Checks, Rate Limiting

> Fuente: GitHub REST API Docs - https://docs.github.com/en/rest

## Reglas

### GH-INTEG-301

**DEFINICION:** Toda llamada a la GitHub REST API debe implementar paginacion usando el header `Link` relacional, solicitando maximo 100 items por pagina (`per_page=100`), y nunca asumir que una unica pagina contiene todos los resultados.

**VALOR:** Los endpoints de GitHub (list PRs, list commits, list checks) retornan 30 items por pagina por defecto. Ignorar la paginacion produce resultados incompletos: un PR podria no tener sus commits validados, o checks statuses podrian quedar sin evaluar, generando falsos positivos en el scoring de Rovo Execution Guard.

**IMPLEMENTACION:**
```typescript
interface GitHubPage<T> {
  data: T[];
  nextUrl: string | null;
}

function parseLinkHeader(linkHeader: string | null): Record<string, string> {
  if (!linkHeader) return {};
  const links: Record<string, string> = {};
  for (const part of linkHeader.split(',')) {
    const match = part.match(/<([^>]+)>;\s*rel="([^"]+)"/);
    if (match) links[match[2]] = match[1];
  }
  return links;
}

async function paginateGitHub<T>(
  octokit: Octokit,
  endpoint: string,
  params: Record<string, unknown> = {}
): Promise<T[]> {
  const allResults: T[] = [];
  let url: string | null = `${endpoint}?per_page=100`;

  for (const [key, value] of Object.entries(params)) {
    url += `&${key}=${encodeURIComponent(String(value))}`;
  }

  while (url) {
    const response = await octokit.request(`GET ${url}`);
    const items = Array.isArray(response.data) ? response.data : [response.data];
    allResults.push(...items);

    const links = parseLinkHeader(response.headers.link as string);
    url = links['next'] || null;
  }

  return allResults;
}
```

**AUDITORIA:** Ralph verifica que toda llamada a endpoints de lista de GitHub (`/pulls`, `/commits`, `/statuses`, `/check-suites`) incluya `per_page=100` y que exista un mecanismo de paginacion basado en el header `Link`. Si se encuentra un endpoint de lista sin paginacion, el check falla.

---

### GH-INTEG-302

**DEFINICION:** Toda llamada a la GitHub REST API debe respetar los limites de rate limiting (5000 req/hr para authenticated requests con token de GitHub App) y debe leer los headers `X-RateLimit-Remaining`, `X-RateLimit-Limit` y `X-RateLimit-Reset` antes de cada llamada para anticipar throttling.

**VALOR:** Rovo Execution Guard procesa webhooks de PR en tiempo real. Si el rate limit se agota, los status checks no se pueden publicar y los PRs quedan en estado "pending" indefinidamente, bloqueando merges legitimos. El rate limit de 5000 req/hr se comparte entre todos los endpoints de la instalacion de la GitHub App.

**IMPLEMENTACION:**
```typescript
interface RateLimitInfo {
  remaining: number;
  limit: number;
  resetAt: Date;
}

function extractRateLimit(headers: Record<string, string>): RateLimitInfo {
  return {
    remaining: parseInt(headers['x-ratelimit-remaining'] || '0', 10),
    limit: parseInt(headers['x-ratelimit-limit'] || '5000', 10),
    resetAt: new Date(parseInt(headers['x-ratelimit-reset'] || '0', 10) * 1000),
  };
}

async function callWithRateLimitAwareness(
  octokit: Octokit,
  endpoint: string,
  params: Record<string, unknown> = {}
): Promise<any> {
  const rateLimit = await octokit.rateLimit.get();
  const remaining = rateLimit.data.resources.core.remaining;

  if (remaining < 50) {
    const resetAt = new Date(rateLimit.data.resources.core.reset * 1000);
    const waitMs = Math.max(resetAt.getTime() - Date.now(), 0) + 1000;
    console.warn(`Rate limit low (${remaining} remaining). Waiting ${waitMs}ms until reset.`);
    await new Promise(resolve => setTimeout(resolve, Math.min(waitMs, 60000)));
  }

  return octokit.request(endpoint, params);
}
```

**AUDITORIA:** Ralph verifica que el modulo de integracion con GitHub lea los headers de rate limiting (`x-ratelimit-remaining`) en las respuestas y que exista logica de backoff o espera cuando el remaining sea menor a un umbral (50 requests). Si no existe manejo de rate limit, el check falla.

---

### GH-INTEG-303

**DEFINICION:** Las llamadas GET a la GitHub REST API deben usar conditional requests con los headers `If-None-Match` (ETag) e `If-Modified-Since` para aprovechar cache hits (HTTP 304) y reducir consumo de rate limit.

**VALOR:** Cada request condicional que retorna 304 no consume rate limit. Para Rovo Execution Guard, que re-verifica PRs en cada push, los datos del PR raramente cambian entre checks consecutivos. Los conditional requests pueden reducir el consumo de rate limit en un 60-80% en repos con actividad moderada.

**IMPLEMENTACION:**
```typescript
interface CachedResponse<T> {
  etag: string;
  lastModified: string;
  data: T;
  cachedAt: number;
}

async function conditionalGet<T>(
  octokit: Octokit,
  endpoint: string,
  cache: Map<string, CachedResponse<T>>,
  params: Record<string, unknown> = {}
): Promise<T> {
  const cacheKey = `${endpoint}:${JSON.stringify(params)}`;
  const cached = cache.get(cacheKey);

  const headers: Record<string, string> = {};
  if (cached) {
    headers['If-None-Match'] = cached.etag;
    headers['If-Modified-Since'] = cached.lastModified;
  }

  const response = await octokit.request(`GET ${endpoint}`, { ...params, headers });

  if (response.status === 304 && cached) {
    return cached.data;
  }

  const newCached: CachedResponse<T> = {
    etag: response.headers.etag as string,
    lastModified: response.headers['last-modified'] as string,
    data: response.data,
    cachedAt: Date.now(),
  };
  cache.set(cacheKey, newCached);

  return response.data;
}
```

**AUDITORIA:** Ralph verifica que las llamadas GET recurrentes a GitHub incluyan los headers `If-None-Match` o `If-Modified-Since` y manejen correctamente el status 304 (Not Modified). Si se encuentran llamadas GET sin conditional headers en endpoints que soportan ETags, emite un warning.

---

### GH-INTEG-304

**DEFINICION:** Las respuestas de error de la GitHub REST API deben clasificarse por status code semantico: 400 (bad request, retry sin修正), 403 (rate limit o forbidden, backoff), 404 (recurso no encontrado, skip), 422 (validacion fallida, log y skip), 500/502/503 (error transitorio, retry con exponential backoff).

**VALOR:** GitHub retorna codigos semantigos especificos. Un 422 en un status check indica que el SHA ya no existe (el PR fue force-pushed). Un 403 puede ser rate limit o permisos insuficientes. Tratar todos los errores igual genera reintentos inutiles o silenciamiento de errores reales. Rovo Execution Guard necesita distinguir entre "el PR ya no existe" (skip) y "GitHub esta down" (retry).

**IMPLEMENTACION:**
```typescript
class GitHubApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly retryAfter: number | null,
    message: string
  ) {
    super(message);
  }

  get isRetryable(): boolean {
    return this.status >= 500 || this.status === 403;
  }

  get isClientError(): boolean {
    return this.status >= 400 && this.status < 500;
  }

  get isNotFound(): boolean {
    return this.status === 404;
  }

  get isRateLimited(): boolean {
    return this.status === 403 && this.retryAfter !== null;
  }
}

function handleGitHubError(error: any): never {
  const status = error.status ?? 500;
  const retryAfter = error.headers?.['retry-after']
    ? parseInt(error.headers['retry-after'], 10)
    : null;

  switch (true) {
    case status === 404:
      throw new GitHubApiError(404, null, `Resource not found: ${error.message}`);
    case status === 403 && retryAfter:
      throw new GitHubApiError(403, retryAfter, `Rate limited. Retry after ${retryAfter}s`);
    case status === 403:
      throw new GitHubApiError(403, null, `Forbidden: ${error.message}`);
    case status === 422:
      throw new GitHubApiError(422, null, `Validation failed: ${error.message}`);
    case status >= 500:
      throw new GitHubApiError(status, null, `GitHub server error: ${error.message}`);
    default:
      throw new GitHubApiError(status, null, `Unexpected error: ${error.message}`);
  }
}
```

**AUDITORIA:** Ralph verifica que el modulo de integracion con GitHub tenga una funcion de manejo de errores que distinga entre los status codes 400, 403, 404, 422 y 5xx, y que aplique estrategias diferentes (retry, skip, fail) segun el codigo. Si se encuentra un catch generico que no discrimina por status, el check falla.

---

### GH-INTEG-305

**DEFINICION:** Los status checks de Rovo Execution Guard deben publicarse usando el endpoint `POST /repos/{owner}/{repo}/statuses/{sha}` con un `context` unico (ej. `rovo-execution-guard/consistency`) y un `target_url` que enlace al detalle del score en el panel de Jira.

**VALOR:** GitHub permite multiples status checks por commit. Sin un `context` unico, Rovo Execution Guard puede sobreescribir otros checks o ser sobreescrito. El `target_url` permite a los desarrolladores navegar directamente al detalle del scoring desde la UI de GitHub, cerrando el loop de feedback.

**IMPLEMENTACION:**
```typescript
type CheckStatus = 'pending' | 'success' | 'failure' | 'error';

interface StatusCheckPayload {
  owner: string;
  repo: string;
  sha: string;
  state: CheckStatus;
  targetUrl: string;
  description: string;
  context: string;
}

async function publishStatusCheck(
  octokit: Octokit,
  payload: StatusCheckPayload
): Promise<void> {
  await octokit.rest.repos.createCommitStatus({
    owner: payload.owner,
    repo: payload.repo,
    sha: payload.sha,
    state: payload.state,
    target_url: payload.targetUrl,
    description: payload.description.slice(0, 140), // GitHub limit
    context: 'rovo-execution-guard/consistency',
  });
}

// Uso en el flujo de validacion:
await publishStatusCheck(octokit, {
  owner: pr.base.repo.owner.login,
  repo: pr.base.repo.name,
  sha: pr.head.sha,
  state: score.passes ? 'success' : 'failure',
  targetUrl: `https://${jiraTenant}.atlassian.net/browse/${ticketKey}?rovo-guard=detail`,
  description: score.passes
    ? `Score: ${score.value}/100 - All checks passed`
    : `Score: ${score.value}/100 - ${score.failures.length} issue(s) found`,
  context: 'rovo-execution-guard/consistency',
});
```

**AUDITORIA:** Ralph verifica que toda llamada a `repos.createCommitStatus` use el context `rovo-execution-guard/consistency`, incluya un `target_url` y que el `description` no exceda 140 caracteres. Si se encuentra un status check sin context o sin target_url, el check falla.
