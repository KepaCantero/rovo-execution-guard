# [RB-042] OpenAPI Specification - API Contracts, Schema Validation

> Fuente: OpenAPI Specification - API contracts, schema validation

## Reglas

### ARCH-SOLID-042-01
**DEFINICION:** Todo endpoint HTTP expuesto debe estar definido en un archivo OpenAPI 3.1 en `docs/api/openapi.yaml` con operationId, request body schema, response schemas (2xx y 4xx/5xx), y descripciones de cada campo.
**VALOR:** El contrato OpenAPI es la fuente de verdad para la API; sin el, no hay forma de validar que la implementacion coincide con la documentacion ni de generar clientes tipados.
**IMPLEMENTACION:** Definir cada endpoint con estructura: `paths: { '/v1/quality-gates': { get: { operationId: 'listQualityGates', parameters: [...], responses: { '200': { description: '...', content: { 'application/json': { schema: { $ref: '#/components/schemas/PaginatedQualityGates' } } } }, '400': { $ref: '#/components/responses/BadRequest' } } } } }`. Usar `$ref` para reutilizar schemas.
**AUDITORIA:** Ralph verifica que cada ruta HTTP en el codigo tiene su entrada correspondiente en `docs/api/openapi.yaml` con operationId unico y schemas de request/response definidos.

### ARCH-SOLID-042-02
**DEFINICION:** La validacion de request bodies y query parameters debe generarse automaticamente desde el schema OpenAPI usando una libreria como `openapi-validator`; nunca duplicar schemas de validacion a mano.
**VALOR:** La generacion automatica elimina la divergencia entre el contrato y la validacion runtime, que es una fuente comun de bugs de seguridad cuando la validacion es mas permisiva que el contrato.
**IMPLEMENTACION:** Usar un middleware de validacion generado: `import { createValidator } from 'openapi-validator'; const validate = createValidator(openApiSpec); app.use(validate)`. Esto valida automaticamente cada request contra el schema OpenAPI y retorna 400 con detalles del error de validacion.
**AUDITORIA:** Ralph verifica que no existen schemas de validacion duplicados (Zod/Joi manuales que repiten lo del OpenAPI) y que la validacion se deriva del archivo OpenAPI.

### ARCH-SOLID-042-03
**DEFINICION:** Los schemas OpenAPI deben usar `required` para campos obligatorios, `nullable: true` solo cuando un campo puede ser explicitamente null, y restricciones de formato (`format: date-time`, `pattern`, `minLength`, `maxLength`) para todos los campos de tipo string.
**VALOR:** Las restricciones de schema previenen datos malformados de llegar a la logica de negocio y generan errores 400 claros en vez de errores 500 por datos inesperados.
**IMPLEMENTACION:** Para cada propiedad string: `type: string, format: 'date-time', minLength: 1, maxLength: 255`. Para enums: `type: string, enum: ['ACTIVE', 'INACTIVE', 'DEPRECATED']`. Para IDs: `type: string, pattern: '^[A-Z]+-[0-9]+$'`. Para numeros: `type: integer, minimum: 0, maximum: 100`.
**AUDITORIA:** Ralph verifica que todos los campos string en el OpenAPI spec tienen al menos `maxLength` definido y que los campos obligatorios estan en el array `required`.

### ARCH-SOLID-042-04
**DEFINICION:** Los breaking changes en el schema (eliminar campos, cambiar tipos, anadir campos required) deben detectarse automaticamente en CI comparando contra la version anterior del spec.
**VALOR:** La deteccion automatica de breaking changes evita desplegar cambios que rompen clientes existentes, protegiendo la compatibilidad hacia atras sin revision manual.
**IMPLEMENTACION:** Anadir step en CI: `npx oasdiff breaking docs/api/openapi.yaml docs/api/openapi-prev.yaml --format markdown`. Guardar la version anterior como `openapi-prev.yaml` en cada release exitoso. Fallar el pipeline si se detectan breaking changes sin bump de version mayor.
**AUDITORIA:** Ralph verifica que el pipeline CI/CD contiene el step de `oasdiff` y que falla ante breaking changes que no acompanan un bump de version mayor.

### ARCH-SOLID-042-05
**DEFINICION:** Los tipos TypeScript del dominio deben generarse desde el OpenAPI spec usando `openapi-typescript` y reexportarse desde `src/types/api-generated.ts`; nunca mantener tipos de API a mano.
**VALOR:** La generacion desde el contrato elimina la posibilidad de que los tipos en codigo difieran del spec, que causaria errores de serializacion/deserializacion en produccion.
**IMPLEMENTACION:** Anadir script en `package.json`: `"generate:types": "openapi-typescript docs/api/openapi.yaml -o src/types/api-generated.ts"`. Ejecutar en pre-commit hook y en CI. Los handlers importan desde `src/types/api-generated.ts` en vez de definir interfaces de API manualmente.
**AUDITORIA:** Ralph verifica que `src/types/api-generated.ts` existe, que tiene un header de autogeneracion, y que los handlers importan tipos desde este archivo y no de definiciones manuales.
