# [RB-022] Jest Testing Framework

> Fuente: Jest Testing Framework

## Reglas

### TEST-QA-201
**DEFINICION:** Cada archivo de test debe seguir la estructura AAA (Arrange-Act-Assert) con secciones separadas por comentarios o bloques `describe`/`it` que evidencien el flujo.
**VALOR:** La estructura AAA hace que cada test sea legible como documentacion viva, reduce la curva de onboarding y facilita la revision de codigo.
**IMPLEMENTACION:** Organizar el cuerpo de cada `it()` en tres bloques visuales: (1) preparacion de datos y dependencias, (2) invocacion del sujeto bajo prueba, (3) verificacion de resultados. Ejemplo:
```typescript
it('returns violation when score is below threshold', () => {
  // Arrange
  const input = { score: 30, threshold: 80 };
  // Act
  const result = evaluate(input);
  // Assert
  expect(result.status).toBe('fail');
  expect(result.violations).toHaveLength(1);
});
```
**AUDITORIA:** Ralph revisa que cada bloque `it()` contenga al menos un `expect` y que la distancia entre la invocacion y la asercion no exceda 10 lineas.

### TEST-QA-202
**DEFINICION:** Prohibido usar `jest.mock()` a nivel de archivo para dependencias internas del proyecto; usar inyeccion de dependencias o constructor injection para aislar unidades.
**VALOR:** Los mocks a nivel de archivo con `jest.mock()` rompen el grafo de dependencias, ocultan errores de refactoring y generan falsos positivos cuando las firmas cambian.
**IMPLEMENTACION:** Inyectar dependencias via parametros del constructor o factory functions. Para dependencias externas (HTTP clients, SDKs), es aceptable `jest.mock()` con un `__mocks__/` explicito. Ejemplo preferido:
```typescript
const mockScorer = { calculate: jest.fn() };
const service = new QualityGateService(mockScorer);
```
**AUDITORIA:** Ralph busca `jest.mock(` en archivos de test y verifica que el primer argumento sea un modulo externo (node_modules), no una ruta interna (`src/` o `../`).

### TEST-QA-203
**DEFINICION:** Los umbrales de cobertura minima deben ser: 80% branches, 80% functions, 80% lines, 80% statements en `jest.config.ts` bajo `coverageThreshold.global`.
**VALOR:** Un umbral del 80% equilibra la confianza en la suite con la viabilidad del desarrollo. Subir al 100% frecuentemente genera tests fragiles que prueban la implementacion en lugar del comportamiento.
**IMPLEMENTACION:** Configurar en `jest.config.ts`:
```typescript
coverageThreshold: {
  global: { branches: 80, functions: 80, lines: 80, statements: 80 }
}
```
Ejecutar `jest --coverage` en CI. El build falla si cualquier metrica cae por debajo del umbral.
**AUDITORIA:** Ralph verifica que `jest.config.ts` contenga los umbrales y que el workflow de CI ejecute `jest --coverage` con `--coverageReporters=text-summary`.

### TEST-QA-204
**DEFINICION:** Cada test debe limpiar su estado despues de ejecutarse usando `afterEach(() => { jest.clearAllMocks(); })` o `jest.restoreAllMocks()`; nunca compartir estado mutado entre tests.
**VALOR:** Los tests con estado compartido generan flakiness: pasan o fallan dependiendo del orden de ejecucion, haciendo que los fallos sean irreproducibles.
**IMPLEMENTACION:** Usar `beforeEach` para crear instancias frescas del SUT (Subject Under Test). Llamar `jest.clearAllMocks()` en `afterEach` o configurar `clearMocks: true` en `jest.config.ts`. Para timers, usar `jest.useFakeTimers()` con `afterEach(() => jest.useRealTimers())`.
**AUDITORIA:** Ralph verifica que no existan variables fuera de `describe`/`it` que sean mutadas dentro de un test sin restaurarse en `afterEach`.

### TEST-QA-205
**DEFINICION:** Prohibido usar `any` en matchers de Jest; los snapshots deben ser minimos y usar `toMatchInlineSnapshot()` para cambios revisables.
**VALOR:** Los snapshots grandes oscurecen el proposito del test y se actualizan ciegamente con `--updateSnapshot`. Los snapshots inline obligan al revisor a ver el cambio en el diff del PR.
**IMPLEMENTACION:** Reemplazar `expect(result).toMatchSnapshot()` con `expect(result.status).toMatchInlineSnapshot('"pass"');`. Limitar snapshots a estructuras de menos de 20 lineas. Para respuestas API completas, extraer y testear campos especificos en lugar del objeto entero.
**AUDITORIA:** Ralph busca archivos `*.snap` en el repositorio y reporta cualquier snapshot que exceda 20 lineas. Tambien verifica que no exista `as any` en test files.
