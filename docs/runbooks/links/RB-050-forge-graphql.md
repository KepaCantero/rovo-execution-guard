# [RB-050] Forge GraphQL API - Query Efficiency, Field Selection

> Fuente: Forge GraphQL API - Query efficiency, field selection

## Reglas

### FORGE-OPS-050-01
**DEFINICION:** Toda query GraphQL debe especificar explicitamente los campos requeridos usando fragments; nunca usar fields querying sin seleccion (`... on Node { }` vacio o queries sin field list).
**VALOR:** La seleccion de campos reduce el tamano de la respuesta y el tiempo de ejecucion, critico en Forge Runtime donde el timeout es de 25 segundos y la memoria esta limitada a 512 MB.
**IMPLEMENTACION:** Usar fragments tipados: `const ISSUE_FRAGMENT = gql` fragment IssueFields on Issue { id key summary status { name } priority { id name } } `; const GET_ISSUE = gql` query getIssue($key: String!) { issue(key: $key) { ...IssueFields } } `. Centralizar fragments en `src/graphql/fragments.ts` y reutilizarlos entre queries.
**AUDITORIA:** Ralph verifica que todas las queries GraphQL usan fragments con campos explicitos y que no existen queries sin seleccion de campos.

### FORGE-OPS-050-02
**DEFINICION:** Las queries GraphQL deben limitar la profundidad de nesting a 3 niveles maximos y el numero de campos por query a 15; para datos anidados profundos, usar queries separadas con DataLoader pattern.
**VALOR:** Las queries profundas causan timeouts y exceden los limites de complejidad de la API de Jira/Confluence; la limitacion previene queries N+1 que degradan el rendimiento.
**IMPLEMENTACION:** Ejemplo valido (3 niveles): `query { issue(key: $key) { id status { name } comments(first: 10) { edges { node { body } } } } }`. Para datos de proyecto y assignee en batch: usar DataLoader que agrupa requests: `const loader = new DataLoader(async (keys) => { const result = await batchQuery(keys); return keys.map(k => result[k]); })`.
**AUDITORIA:** Ralph verifica que ninguna query GraphQL supera 3 niveles de profundidad y que las consultas batch usan el patron DataLoader en vez de queries anidadas.

### FORGE-OPS-050-03
**DEFINICION:** Las mutations GraphQL deben ser idempotentes: incluir un `clientMutationId` o `idempotencyKey` unico por operacion y verificar si la mutacion ya se ejecuto antes de proceder.
**VALOR:** La idempotencia protege contra duplicaciones causadas por reintentos automaticos de Forge Runtime cuando hay timeouts intermitentes.
**IMPLEMENTACION:** Anadir `idempotencyKey` como argumento de mutacion: `mutation updateIssue($key: String!, $data: IssueInput!, $idempotencyKey: String!) { updateIssue(key: $key, input: $data, idempotencyKey: $idempotencyKey) { ...IssueFields } }`. En el resolver (si aplica) o en el handler: verificar en Forge Storage si `idempotencyKey` ya existe antes de ejecutar.
**AUDITORIA:** Ralph verifica que todas las mutations GraphQL aceptan un `idempotencyKey` y que existe verificacion de duplicados antes de ejecutar la mutacion.

### FORGE-OPS-050-04
**DEFINICION:** Las queries GraphQL que retornan colecciones deben usar paginacion basada en cursores (`first/after` o `last/before`) con `pageInfo { hasNextPage endCursor }`; nunca usar paginacion por offset (`skip/take`).
**VALOR:** La paginacion por cursores es estable ante inserciones concurrentes y es el patron soportado nativamente por las APIs GraphQL de Atlassian.
**IMPLEMENTACION:** Query: `query getIssues($projectKey: String!, $first: Int!, $after: String) { issues(query: $projectKey, first: $first, after: $after) { edges { cursor node { ...IssueFields } } pageInfo { hasNextPage endCursor } } }`. Iterar con: `let cursor = null; do { const result = await query({ first: 50, after: cursor }); cursor = result.pageInfo.hasNextPage ? result.pageInfo.endCursor : null; } while (cursor)`.
**AUDITORIA:** Ralph verifica que todas las queries de colecciones usan `first/after` y retornan `pageInfo`, y que no existen queries con paginacion por offset.

### FORGE-OPS-050-05
**DEFINICION:** Las operaciones GraphQL deben envolverse en un timeout configurable (default 10000ms) y un retry con backoff exponencial (maximo 3 reintentos, backoff base 1000ms) para manejar degradacion transitoria de la API.
**VALOR:** Los timeouts previenen que una query lenta consuma todo el tiempo de ejecucion de Forge; los retries con backoff manejan degradacion transitoria sin sobrecargar la API.
**IMPLEMENTACION:** Implementar wrapper: `async function resilientQuery<T>(query: string, variables: Record<string, unknown>, timeoutMs = 10000, maxRetries = 3): Promise<T>`. Usar `Promise.race([client.query(query, variables), sleep(timeoutMs).then(() => throw new TimeoutError('GraphQL'))])`. En retry: `const delay = Math.min(1000 * Math.pow(2, attempt), 8000)`. Registrar cada intento como breadcrumb en Sentry.
**AUDITORIA:** Ralph verifica que todas las llamadas GraphQL usan el wrapper con timeout y retry, que el timeout por defecto es 10000ms, y que el backoff exponencial tiene un maximo de 3 reintentos.
