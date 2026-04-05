# [RB-023] Playwright E2E Docs

> Fuente: Playwright E2E Docs

## Reglas

### TEST-QA-211
**DEFINICION:** Todo test E2E debe usar selectores resilientes en este orden de prioridad: (1) `getByRole`, (2) `getByTestId`, (3) `getByText`; prohibido usar selectores CSS o XPath acoplados a la implementacion.
**VALOR:** Los selectores basados en roles reflejan como interactua el usuario real y sobreviven a refactorings de CSS/HTML. Los selectores por clase o XPath se rompen con cualquier cambio visual.
**IMPLEMENTACION:**
```typescript
// Correcto: basado en rol accesible
await page.getByRole('button', { name: 'Submit' }).click();
// Correcto: basado en test-id estable
await page.getByTestId('quality-gate-status').textContent();
// Incorrecto: acoplado a estructura DOM
await page.locator('div.card > button.primary').click();
```
Agregar `data-testid` a componentes criticos en la capa de presentacion.
**AUDITORIA:** Ralph busca en archivos `*.spec.ts` de E2E el uso de `locator(` con selectores CSS o `xpath` y lo reporta como violacion.

### TEST-QA-212
**DEFINICION:** Toda asercion Playwright debe usar web-first assertions (`await expect(locator).toBeVisible()`) en lugar de aserciones manuales con `expect(await locator.isVisible()).toBe(true)`.
**VALOR:** Las web-first assertions integran auto-retry con el timeout de Playwright, eliminando flakiness por timing. Las aserciones manuales capturan un punto en el tiempo fijo que puede fallar si el DOM aun no se actualizo.
**IMPLEMENTACION:**
```typescript
// Correcto: auto-retry hasta timeout
await expect(page.getByTestId('score-value')).toHaveText('85');
// Incorrecto: sin retry
const text = await page.getByTestId('score-value').textContent();
expect(text).toBe('85');
```
**AUDITORIA:** Ralph verifica que en archivos E2E no se use `expect(` con un `await` dentro del argumento que no sea un locator (patron: `expect(await ...).toBe`).

### TEST-QA-213
**DEFINICION:** Los tests E2E deben organizarse en Page Object Models (POM) con una clase por pagina/flujo; el archivo de test solo contiene `test()` y llama a metodos del POM.
**VALOR:** Los POM centralizan la logica de interaccion con la UI, haciendo que los cambios en la interfaz requieran actualizacion en un solo lugar. Sin POM, un cambio de UI rompe decenas de tests.
**IMPLEMENTACION:** Crear `tests/e2e/pages/AdminDashboardPage.ts` con metodos como `async setThreshold(value: number): Promise<void>` y `async getQualityStatus(): Promise<string>`. Los archivos `*.spec.ts` importan el POM y solo contienen orquestacion de pasos y aserciones.
**AUDITORIA:** Ralph verifica que cada archivo `*.spec.ts` en `tests/e2e/` importe al menos un Page Object y que ningun `page.locator` o `page.getByRole` aparezca directamente en el spec.

### TEST-QA-214
**DEFINICION:** Configurar `trace: 'on-first-retry'` en `playwright.config.ts` y establecer `retries: 2` para capturar trazas solo en fallos, sin penalizar la ejecucion en exito.
**VALOR:** Las trazas de Playwright contienen snapshots del DOM, consola, red y acciones por cada paso; son esenciales para diagnosticar fallos flaky en CI donde no hay interfaz visual.
**IMPLEMENTACION:**
```typescript
// playwright.config.ts
use: { trace: 'on-first-retry' },
retries: 2,
```
En CI, subir el directorio `test-results/` como artefacto. Nunca usar `trace: 'on'` porque genera trazas para tests exitosos y duplica el tiempo de ejecucion.
**AUDITORIA:** Ralph verifica que `playwright.config.ts` contenga `trace: 'on-first-retry'` y `retries: 2`, y que no contenga `trace: 'on'`.

### TEST-QA-215
**DEFINICION:** Prohibido usar `page.waitForTimeout()`; todo wait debe ser basado en una condicion (`waitForSelector`, `waitForResponse`, web-first assertions) con un timeout maximo de 15000ms.
**VALOR:** Los waits fijos (`waitForTimeout(5000)`) son la causa principal de flakiness y lentitud en suites E2E. Un wait fijo de 5s en 100 tests agrega 500s innecesarios; un wait condicional pasa instantaneamente cuando la condicion se cumple.
**IMPLEMENTACION:** Reemplazar `await page.waitForTimeout(3000)` con `await expect(page.getByTestId('status')).toBeVisible({ timeout: 15000 })`. Paraesperar respuestas API: `await page.waitForResponse(resp => resp.url().includes('/api/score') && resp.status() === 200)`.
**AUDITORIA:** Ralph busca `waitForTimeout` en archivos de test E2E y reporta cada ocurrencia como violacion.
