# [RB-047] HTTP Status Codes - Proper Semantic Response Codes

> Fuente: HTTP Status Codes - Proper semantic response codes

## Reglas

### ARCH-SOLID-047-01
**DEFINICION:** Los endpoints deben usar codigos HTTP semanticamente correctos: `200` para exito con body, `201` para creacion, `204` para exito sin body, `400` para errores de validacion del cliente, `401` para no autenticado, `403` para no autorizado, `404` para recurso no encontrado, `409` para conflicto, `422` para entidad no procesable, `429` para rate limit, y `500`/`502`/`503` para errores de servidor.
**VALOR:** Los codigos HTTP semanticamente correctos permiten a los clientes manejar errores de forma programatica sin parsear mensajes, y a los monitores de infraestructura detectar problemas por patron de codigos.
**IMPLEMENTACION:** Crear helper `respond(status: number, body?: unknown)` y constantes: `const HTTP = { OK: 200, CREATED: 201, NO_CONTENT: 204, BAD_REQUEST: 400, UNAUTHORIZED: 401, FORBIDDEN: 403, NOT_FOUND: 404, CONFLICT: 409, UNPROCESSABLE: 422, RATE_LIMITED: 429, INTERNAL_ERROR: 500, BAD_GATEWAY: 502, SERVICE_UNAVAILABLE: 503 }` en `src/utils/http.ts`. Nunca retornar `200` con un body de error.
**AUDITORIA:** Ralph verifica que todos los handlers usan los codigos del objeto `HTTP` y que no existen respuestas `200` con bodies que contengan campos de error.

### ARCH-SOLID-047-02
**DEFINICION:** Los errores 4xx deben diferenciar entre `400` (sintaxis invalida del request), `401` (falta o token invalido), `403` (token valido pero sin permisos), y `422` (sintaxis valida pero semantica incorrecta); nunca usar `400` como catch-all para todos los errores de cliente.
**VALOR:** La diferenciacion precisa permite a los clientes implementar logica de reintento correcta: reautenticar en 401, solicitar permisos en 403, corregir datos en 422.
**IMPLEMENTACION:** `400`: schema validation falla (missing fields, wrong types). `401`: `Sentry.getCurrentScope().getUser() === null` o token expirado. `403`: `checkLicense()` falla o scope insuficiente. `404`: `storage.query().where(...).getOne() === null`. `422`: datos validos por tipo pero con regla de negocio violada (ej. score fuera de rango 0-100).
**AUDITORIA:** Ralph verifica que los handlers diferencian correctamente entre 400, 401, 403, y 422 segun la semantica definida y que ningun handler usa 400 como catch-all generico.

### ARCH-SOLID-047-03
**DEFINICION:** Los errores 5xx deben incluir un header `Retry-After` con valor en segundos cuando la causa es transitoria (rate limit externo, timeout de Forge Storage) y nunca incluir stack traces ni detalles internos en la respuesta.
**VALOR:** El header `Retry-After` permite a los clientes reintentar inteligentemente sin agregar carga al sistema degradado; los stack traces en respuestas exponen detalles de implementacion que facilitan ataques.
**IMPLEMENTACION:** Para errores transitorios: `return respond(HTTP.SERVICE_UNAVAILABLE, { error: { code: 'TEMPORARILY_UNAVAILABLE', message: 'Service temporarily unavailable. Please retry later.' } }, { 'Retry-After': '30' })`. Para errores permanentes (500): retornar sin Retry-After. Registrar stack trace solo en logs/Sentry, nunca en el response body.
**AUDITORIA:** Ralph verifica que las respuestas 503 y 429 incluyen el header `Retry-After`, que ningun response body contiene stack traces, y que los errores 5xx se registran internamente con contexto completo.

### ARCH-SOLID-047-04
**DEFINICION:** Los endpoints de creacion (`POST`) deben retornar `201 Created` con el header `Location` apuntando al recurso creado y el body con la representacion completa del recurso.
**VALOR:** El patron `201 + Location` es el estandar REST que permite a los clientes obtener la URL del recurso creado sin conocimiento previo de la estructura de rutas.
**IMPLEMENTACION:** Al crear un recurso: `const resource = await service.create(data); return { status: HTTP.CREATED, headers: { Location: `/v1/quality-gates/${resource.id}` }, body: resource }`. Verificar que el `Location` header usa la URL completa del recurso y que el body contiene la representacion con ID generado y timestamps.
**AUDITORIA:** Ralph verifica que los endpoints POST de creacion retornan 201, incluyen el header `Location`, y que el body contiene el recurso completo con ID.

### ARCH-SOLID-047-05
**DEFINICION:** Los endpoints DELETE deben retornar `204 No Content` sin body cuando la eliminacion es inmediata, o `202 Accepted` con body `{ status: 'pending', cancellationUrl: '...' }` cuando la eliminacion es asincrona.
**VALOR:** La diferenciacion entre eliminacion sincrona y asincrona permite a los clientes saber si deben consultar estado o si la operacion ya se completo.
**IMPLEMENTACION:** Eliminacion sincrona: `await service.delete(id); return { status: HTTP.NO_CONTENT }`. Eliminacion asincrona: `const jobId = await queueDelete(id); return { status: HTTP.ACCEPTED, body: { status: 'pending', jobId, statusUrl: `/v1/quality-gates/${id}/delete-status/${jobId}` } }`.
**AUDITORIA:** Ralph verifica que los endpoints DELETE retornan 204 sin body o 202 con status pendiente y URL de consulta, y que nunca retornan 200 con body en operaciones de eliminacion.
