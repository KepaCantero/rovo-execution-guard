# [RB-095] Eloquent JavaScript

> Libro: Marijn Haverbeke - Eloquent JavaScript: A Modern Introduction to Programming

## Reglas

### ARCH-SOLID-0951
**DEFINICION:** Todo el codigo del Forge app debe usar async/await con manejo explicito de errores (try/catch), prohibiendo el uso de `.then()/.catch()` encadenados y promesas flotantes sin manejo.
**VALOR:** El codigo async es la mayor fuente de bugs en aplicaciones Forge. Las promesas flotantes (sin `.catch()` ni `await`) causan errores silenciosos que son imposibles de debugear. Async/await con try/catch es secuencial, legible y siempre maneja errores.
**IMPLEMENTACION:** ESLint rule `@typescript-eslint/no-floating-promises` habilitada en `eslint.config.js`. Toda funcion async usa try/catch. Los errores se propagan con contexto usando clases de error custom: `class ScoringError extends Error { constructor(message, cause, context) { ... } }`. Nunca usar `.then()` cuando `await` es posible.
**AUDITORIA:** Ralph verifica que no existan `.then()/.catch()` en el codigo y que todas las funciones async tengan try/catch con manejo explicito de errores.

### FORGE-OPS-0952
**DEFINICION:** El codigo del Forge app debe aprovechar los features modernos de JavaScript/TypeScript: optional chaining (`?.`), nullish coalescing (`??`), destructuring, y template literals. Prohibir patrones legacy (verificacion manual de null, concatenacion de strings con `+`).
**VALOR:** El codigo moderno es mas seguro y legible. `ticket.fields?.summary ?? 'Untitled'` es inequivoco sobre el manejo de null/undefined, mientras que `ticket.fields && ticket.fields.summary ? ticket.fields.summary : 'Untitled'` es propenso a errores.
**IMPLEMENTACION:** Configurar ESLint con reglas: `prefer-template` (template literals sobre concatenacion), `prefer-nullish-coalescing`, `prefer-optional-chain`. TypeScript strict mode con `strictNullChecks: true`. Todo el codigo nuevo usa estos patrones. El CI bloquea PRs con patrones legacy.
**AUDITORIA:** Ralph verifica que no existan concatenaciones con `+` para strings ni verificaciones manuales de null/undefined donde optional chaining o nullish coalescing son aplicables.

### ROVO-INTEG-0953
**DEFINICION:** Las funciones que interactuan con APIs externas deben usar `async generators` o `for-await-of` cuando procesan respuestas paginadas, evitando cargar todos los datos en memoria simultaneamente.
**VALOR:** Las APIs de Jira y Confluence retornan datos paginados. Si el sistema carga todas las paginas en un array antes de procesar, consume memoria innecesaria. Los async generators procesan cada pagina tan pronto llega, manteniendo el footprint de memoria bajo dentro de los limites de Forge.
**IMPLEMENTACION:** Implementar `fetchPaginated()` como async generator: `async function* fetchPaginated(url) { let page = 1; while (hasMore) { const response = await fetch(url + page); yield response.data; page++; } }`. El consumidor usa `for await (const page of fetchPaginated(url)) { processPage(page); }`. Cada pagina se procesa y descarta antes de fetchear la siguiente.
**AUDITORIA:** Ralph verifica que las llamadas a APIs paginadas (Jira, Confluence, GitHub) usen async generators y que no existan llamadas que acumulen todas las paginas en memoria.

### TEST-QA-0954
**DEFINICION:** Los tests deben usar `async/await` consistentemente con helpers de Jest como `waitFor` para operaciones asincronas, prohibiendo el uso de `setTimeout` o `done()` callbacks.
**VALOR:** Los tests asincronos con `setTimeout` o `done()` son fragiles y producen falsos positivos (tests que pasan por timeout, no por logica). `waitFor` reintenta la asercion hasta que pasa o se agota el timeout, produciendo tests confiables.
**IMPLEMENTACION:** Para tests que involucran operaciones async: usar `await waitFor(() => expect(result).toBeDefined())` en lugar de `setTimeout(() => { expect(result).toBeDefined(); done(); }, 1000)`. Para tests de Forge resolvers: usar `await resolver.invoke({ payload })` directamente. Prohibir `done()` callback con ESLint rule `no-done-callback`.
**AUDITORIA:** Ralph verifica que no existan usos de `setTimeout` o `done()` en los tests y que todas las aserciones asincronas usen `await` o `waitFor`.

### UI-ADS-0955
**DEFINICION:** Los componentes React del issue panel deben usar functional components con hooks nativos (`useState`, `useEffect`, `useCallback`), prohibiendo class components y librerias de state management externas (Redux, MobX).
**VALOR:** El Forge UI Kit esta disenado para functional components. Los class components son mas verbosos y no se benefician de los hooks de Forge (`useAction`, `useProductContext`). Mantener el state local con `useState` es suficiente para un issue panel que muestra datos de un ticket.
**IMPLEMENTACION:** Todo componente en `src/frontend/` es un functional component. El state se maneja con `useState` (estado local) y `useAction` (llamadas al backend). Los datos derivados usan `useMemo`. Los efectos usan `useEffect` con cleanup. ESLint rule `react/prefer-stateless-function` habilitada. No importar librerias de state management.
**AUDITORIA:** Ralph verifica que no existan class components ni imports de librerias de state management en `src/frontend/`.
