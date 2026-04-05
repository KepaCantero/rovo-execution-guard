# [RB-040] REST API Design (Microsoft) - Naming, Versioning, Error Responses, Pagination

> Fuente: REST API Design (Microsoft) - Naming, versioning, error responses, pagination

## Reglas

### ARCH-SOLID-040-01
**DEFINICION:** Los endpoints deben usar sustantivos en plural para colecciones (`/quality-gates`, `/executions`, `/enforcements`) y kebab-case para nombres compuestos; nunca verbos en la URL.
**VALOR:** Las URLs predecibles y consistentes reducen la friccion de integracion y permiten a los consumidores deducir la estructura de la API sin leer documentacion exhaustiva.
**IMPLEMENTACION:** Definir rutas en el manifest de Forge o router como: `GET /quality-gates`, `GET /quality-gates/{id}`, `POST /quality-gates/{id}/executions` (sub-recurso). Para acciones no-CRUD: `POST /quality-gates/{id}/activate` como endpoint de accion con documentacion clara.
**AUDITORIA:** Ralph verifica que todas las rutas definidas usan sustantivos plurales en kebab-case y que ninguna contiene verbos HTTP en la URL (excepto acciones especificas documentadas).

### ARCH-SOLID-040-02
**DEFINICION:** La version de API debe especificarse en la URL como `/v1/` y cada version mayor debe mantener compatibilidad hacia atras durante al menos 6 meses tras su depreciacion.
**VALOR:** La version en URL es explicita y cacheable; el periodo de gracia da tiempo a los consumidores para migrar sin rupturas de servicio.
**IMPLEMENTACION:** Estructurar handlers como `api/v1/quality-gates.ts` y `api/v2/quality-gates.ts`. Anadir header `Deprecation: true; sunset="2026-10-01"` en respuestas de versiones deprecadas. Documentar el calendario de depreciacion en `docs/api-changelog.md`.
**AUDITORIA:** Ralph verifica que todas las rutas publicas incluyen el prefijo de version `/vN/`, que las versiones deprecadas emiten el header `Deprecation`, y que existe un changelog de API.

### ARCH-SOLID-040-03
**DEFINICION:** Los errores deben retornar un objeto JSON estandarizado con campos: `error.code` (string machine-readable), `error.message` (human-readable), `error.target` (campo o recurso causante), y `error.details` (array de errores anidados si aplica).
**VALOR:** La estructura de error consistente permite a los clientes parsear y mostrar errores de forma uniforme, y a los operadores diagnosticar problemas sin inspeccionar logs.
**IMPLEMENTACION:** Definir `interface ApiError { code: string; message: string; target?: string; details?: ApiError[] }` y factory `createErrorResponse(statusCode: number, code: string, message: string, target?: string): { status: number; body: { error: ApiError } }`. Usar codigos como `SCORING_TIMEOUT`, `GATE_NOT_FOUND`, `RATE_LIMIT_EXCEEDED`.
**AUDITORIA:** Ralph verifica que todos los endpoints de error retornan el formato estandarizado y que los codigos de error usan UPPER_SNAKE_CASE descriptivo.

### ARCH-SOLID-040-04
**DEFINICION:** Las colecciones que retornan mas de 20 items deben implementar paginacion con los parametros `limit` (max 100, default 20) y `cursor` (token opaco), retornando `nextCursor` y `hasMore` en la respuesta.
**VALOR:** La paginacion basada en cursor es estable ante inserciones y eliminaciones concurrentes, a diferencia de la paginacion por offset que puede duplicar o perder items.
**IMPLEMENTACION:** Implementar `interface PaginatedResponse<T> { data: T[]; pagination: { nextCursor?: string; hasMore: boolean; limit: number } }`. En el query: `if (cursor) { where: { id: { greaterThan: decodeCursor(cursor) } } } limit: limit + 1` para detectar `hasMore`. Codificar cursor como Base64 del ultimo ID.
**AUDITORIA:** Ralph verifica que los endpoints de lista aceptan `limit` y `cursor`, que `limit` tiene un maximo de 100, y que la respuesta incluye `nextCursor` y `hasMore`.

### ARCH-SOLID-040-05
**DEFINICION:** Los endpoints deben aceptar `?fields=field1,field2` para seleccion parcial de campos y `?expand=relatedEntity` para incluir entidades relacionadas, reduciendo el tamano del payload cuando el cliente no necesita la representacion completa.
**VALOR:** La seleccion de campos reduce el ancho de banda y el tiempo de deserializacion, especialmente critico en el entorno serverless de Forge con limites de memoria.
**IMPLEMENTACION:** Parsear `fields` como `const selectedFields = req.query.fields?.split(',') ?? defaultFields` y aplicar en la consulta: `storage.query().select(selectedFields)`. Para expand: `if (req.query.expand?.includes('rules')) { include: ['rules'] }`. Documentar campos disponibles y expands soportados en el schema OpenAPI.
**AUDITORIA:** Ralph verifica que los endpoints de lista soportan el parametro `fields` y `expand`, y que la seleccion de campos se aplica antes de la serializacion.
