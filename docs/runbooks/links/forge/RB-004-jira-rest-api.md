# [RB-004] Jira Cloud REST API v3

> Fuente: Jira Cloud REST API v3 - https://developer.atlassian.com/cloud/jira/platform/rest/v3/

## Reglas

### GH-INTEG-001

**DEFINICION:** Toda llamada a la Jira REST API v3 debe implementar paginacion usando `startAt` y `maxResults`, procesando resultados en lotes.

**VALOR:** Los endpoints de Jira retornan un maximo de 50-100 resultados por pagina por defecto. Ignorar la paginacion causa resultados incompletos y logica de negocio erronea (ej. missing duplicates, scores incompletos).

**IMPLEMENTACION:**
```typescript
async function getAllJiraIssues(jql: string, fields: string[]): Promise<Issue[]> {
  const allIssues: Issue[] = [];
  let startAt = 0;
  const maxResults = 50;
  let total = Infinity;

  while (startAt < total) {
    const response = await requestJira(
      `/rest/api/3/search?jql=${encodeURIComponent(jql)}&fields=${fields.join(',')}&startAt=${startAt}&maxResults=${maxResults}`
    );
    const data = await response.json();
    total = data.total;
    allIssues.push(...data.issues);
    startAt += maxResults;
  }
  return allIssues;
}
```

**AUDITORIA:** Ralph verifica que toda llamada a `/rest/api/3/search` o endpoints de lista incluya los parametros `startAt` y `maxResults`, y que exista un loop de paginacion cuando se espera mas de una pagina de resultados.

---

### ARCH-SOLID-002

**DEFINICION:** El contenido de campos de Jira debe leerse como documentos ADF (Atlassian Document Format), no como texto plano.

**VALOR:** Jira v3 usa ADF para todos los campos de texto rico (descripcion, comentarios). Acceder al texto directamente via `.body` retorna una estructura JSON, no un string. Ignorar ADF causa parseo incorrecto y perdida de formato/contenido.

**IMPLEMENTACION:**
```typescript
function extractTextFromADF(node: ADFNode): string {
  if (node.type === 'text') return node.text || '';
  if (!node.content) return '';
  return node.content.map(extractTextFromADF).join('');
}

// Uso:
const description = issue.fields.description;
const plainText = description ? extractTextFromADF(description) : '';
```

**AUDITORIA:** Ralph verifica que ningun codigo acceda directamente a `issue.fields.description` como string (ej. `.toLowerCase()`, `.includes()`) sin pasar antes por una funcion de parseo ADF.

---

### GH-INTEG-002

**DEFINICION:** Las llamadas a la Jira API deben usar el parametro `fields` para solicitar unicamente los campos necesarios, nunca `fields=*all`.

**VALOR:** Solicitar todos los campos incrementa el tamano de la response, el tiempo de ejecucion y puede causar que la funcion supere el limite de 10 segundos. Jira puede retornar cientos de campos custom por issue.

**IMPLEMENTACION:**
```typescript
// CORRECTO - solo campos necesarios:
const response = await requestJira(
  `/rest/api/3/search?jql=${jql}&fields=summary,description,status,assignee,labels`
);

// INCORRECTO - nunca usar *all:
// const response = await requestJira(`/rest/api/3/search?jql=${jql}&fields=*all`);
```

**AUDITORIA:** Ralph escanea las llamadas a `requestJira` y verifica que no contengan `fields=*all` ni `fields=*navigable`. Si no se especifica `fields`, emite un warning sugiriendo listar campos explicitos.

---

### FORGE-OPS-010

**DEFINICION:** Las operaciones asincronas de Jira que retornan HTTP 303 deben ser manejadas con polling hasta obtener el resultado final.

**VALOR:** Algunas operaciones de Jira (ej. export, bulk operations) retornan 303 See Other con una URL de polling. Ignorar este patron causa perdida del resultado y la operacion queda en estado indefinido.

**IMPLEMENTACION:**
```typescript
async function pollAsyncTask(resultUrl: string, maxAttempts = 10): Promise<any> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const response = await requestJira(resultUrl);
    if (response.status === 200) {
      return await response.json();
    }
    if (response.status === 303) {
      const delay = Math.min(1000 * Math.pow(2, attempt), 5000);
      await new Promise(r => setTimeout(r, delay));
      continue;
    }
    throw new Error(`Unexpected status: ${response.status}`);
  }
  throw new Error('Async task polling exceeded max attempts');
}
```

**AUDITORIA:** Ralph verifica que si el codigo usa endpoints que documentan respuestas 303 (ej. `/rest/api/3/task/`), exista una funcion de polling que maneje redirecciones asincronas con retry.
