# [RB-005] Confluence Cloud REST API v2

> Fuente: Confluence Cloud REST API v2 - https://developer.atlassian.com/cloud/confluence/rest/v2/

## Reglas

### ROVO-INTEG-001

**DEFINICION:** Toda llamada a la Confluence REST API v2 debe usar paginacion basada en cursores (`cursor` y `limit`), no paginacion offset-based.

**VALOR:** La API v2 usa cursor-based pagination exclusivamente. Intentar usar `start` o `offset` sera ignorado o causara resultados duplicados/faltantes. La paginacion por cursor es mas eficiente y consistente en datos que cambian frecuentemente (como contenido de Confluence).

**IMPLEMENTACION:**
```typescript
async function getAllConfluencePages(spaceId: string): Promise<Page[]> {
  const allPages: Page[] = [];
  let cursor: string | undefined;

  do {
    const params = new URLSearchParams({
      'space-id': spaceId,
      'limit': '250',           // Max permitido por la API v2
      ...(cursor ? { cursor } : {})
    });
    const response = await requestConfluence(`/api/v2/pages?${params}`);
    const data = await response.json();
    allPages.push(...data.results);
    // Extraer cursor del header Link o del body
    cursor = data._links?.next
      ? new URL(data._links.next, 'https://api.atlassian.com').searchParams.get('cursor') ?? undefined
      : undefined;
  } while (cursor);

  return allPages;
}
```

**AUDITORIA:** Ralph verifica que toda llamada a `/api/v2/` use los parametros `limit` y `cursor` (no `start` ni `offset`). Verifica que exista un loop que procese el cursor hasta que no haya mas resultados.

---

### ROVO-INTEG-002

**DEFINICION:** Las respuestas de la API v2 deben usar los `Link` headers para navegacion, no construir URLs manualmente.

**VALOR:** Los Link headers son la forma canonica de navegacion en la API v2. Construir URLs manualmente es fragil porque los query parameters, formato de cursor y endpoints pueden cambiar entre versiones de API sin previo aviso.

**IMPLEMENTACION:**
```typescript
function parseLinkHeader(response: Response): { next?: string; prev?: string } {
  const linkHeader = response.headers.get('Link') ?? '';
  const links: Record<string, string> = {};
  for (const part of linkHeader.split(',')) {
    const match = part.match(/<([^>]+)>;\s*rel="(\w+)"/);
    if (match) links[match[2]] = match[1];
  }
  return links;
}

// Uso:
const response = await requestConfluence('/api/v2/pages?limit=50');
const { next } = parseLinkHeader(response);
if (next) {
  const nextPage = await requestConfluence(next);
}
```

**AUDITORIA:** Ralph verifica que el codigo no concatene strings para construir URLs de paginacion de la API v2 (ej. `/api/v2/pages?cursor=${miCursorCalculado}`). Debe usar los Link headers de la response.

---

### ROVO-INTEG-003

**DEFINICION:** El parametro `limit` en endpoints de la API v2 no debe exceder 250.

**VALOR:** El limite maximo de resultados por pagina en la API v2 es 250 para la mayoria de endpoints. Si se envia un valor mayor, la API lo ignora y usa el default (25), lo que causa paginacion inesperada y mas requests de las necesarias.

**IMPLEMENTACION:**
```typescript
const MAX_CONFLUENCE_LIMIT = 250;

function buildConfluenceUrl(endpoint: string, limit: number): string {
  const safeLimit = Math.min(limit, MAX_CONFLUENCE_LIMIT);
  return `${endpoint}?limit=${safeLimit}`;
}
```

**AUDITORIA:** Ralph verifica que ningun `limit` pasado a `/api/v2/` endpoints sea mayor a 250. Si se encuentra un valor mayor, el check falla.

---

### ARCH-SOLID-003

**DEFINICION:** Las llamadas a la API v2 deben expandir unicamente los campos necesarios usando el parametro `body-format` o `expand`, nunca solicitar el body completo cuando solo se necesitan metadatos.

**VALOR:** Los bodies de paginas Confluence pueden ser muy grandes (ADF completo). Solicitarlos cuando solo se necesita el titulo o los metadatos desperdicia ancho de banda, incrementa el tiempo de parseo y puede causar timeouts en Forge.

**IMPLEMENTACION:**
```typescript
// Solo metadatos - sin body:
const meta = await requestConfluence(`/api/v2/pages/${pageId}`);

// Solo body en formato storage:
const withBody = await requestConfluence(
  `/api/v2/pages/${pageId}?body-format=storage`
);

// Solo body en formato plain text (para analisis):
const plainText = await requestConfluence(
  `/api/v2/pages/${pageId}?body-format=plain_text`
);
```

**AUDITORIA:** Ralph verifica que las llamadas a Confluence API no usen multiples `expand` simultaneos sin justificacion. Si se solicita `body.format=storage` pero el codigo solo lee `.title`, el check emite un warning.
