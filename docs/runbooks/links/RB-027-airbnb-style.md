# [RB-027] Airbnb JavaScript Style Guide

> Fuente: Airbnb JavaScript Style Guide

## Reglas

### ARCH-SOLID-231
**DEFINICION:** Usar `camelCase` para variables, funciones y metodos; `PascalCase` para clases, interfaces, types y componentes React; `UPPER_SNAKE_CASE` para constantes globales inmutables; prefijo `I` prohibido en interfaces.
**VALOR:** Una convencion de nombres consistente permite entender el tipo de entidad sin leer su definicion. El prefijo `I` en interfaces es un patron de C# que no pertenece al ecosistema TypeScript donde `type` e `interface` se usan ambos.
**IMPLEMENTACION:**
```typescript
// Variables y funciones
const qualityScore = 85;
function calculatePenalty() {}
// Clases, interfaces, types
interface ScoringResult {}
type GateStatus = 'pass' | 'fail';
class ScoringEngine {}
// Constantes globales
const MAX_RETRIES = 3;
```
Configurar ESLint con `@typescript-eslint/naming-convention` para aplicar automaticamente.
**AUDITORIA:** Ralph verifica que los archivos en `src/` sigan las convenciones de nombres y reporta interfaces con prefijo `I` (ej. `IScoringResult`) como violacion.

### ARCH-SOLID-232
**DEFINICION:** Usar exports nombrados (`export function`, `export class`) como default; reservar `export default` unicamente para componentes React y el entry point principal del modulo.
**VALOR:** Los exports nombrados permiten tree-shaking preciso, facilitan el auto-import del IDE, y hacen que los refactors sean seguros (renombrar un export nombrado rompe la compilacion; renombrar un default no). Los defaults tambien dificultan la busqueda de usos.
**IMPLEMENTACION:**
```typescript
// Correcto: named exports
export function calculateScore(input: ScoringInput): ScoringResult { ... }
export class ScoringEngine { ... }
// Aceptable: default solo para componentes React
export default function QualityGatePanel() { ... }
```
**AUDITORIA:** Ralph busca `export default` en archivos que no sean componentes React (`*.tsx`) o archivos `index.ts` de entry point y lo reporta como violacion.

### ARCH-SOLID-233
**DEFINICION:** Toda funcion que devuelva una Promise debe marcarse con `async`; prohibido usar `.then()/.catch()` para control de flujo cuando `async/await` es posible; encadenar `.then()` solo cuando se necesita stream processing.
**VALOR:** `async/await` produce stack traces completos y codigo secuencial legible. Las cadenas `.then()` pierden el contexto del stack trace, anidan logica en closures y dificultan el debugging.
**IMPLEMENTACION:**
```typescript
// Correcto
async function fetchScore(ticketId: string): Promise<ScoringResult> {
  const data = await jiraClient.get(`/issue/${ticketId}`);
  return evaluate(data);
}
// Incorrecto
function fetchScore(ticketId: string): Promise<ScoringResult> {
  return jiraClient.get(`/issue/${ticketId}`).then(data => evaluate(data));
}
```
**AUDITORIA:** Ralph busca patrones `.then(` en archivos `.ts` y reporta cuando existe una alternativa directa con `async/await` (es decir, la funcion ya devuelve Promise).

### ARCH-SOLID-234
**DEFINICION:** Prohibido usar constructores `new Error()` sin mensaje; toda excepcion lanzada debe ser una instancia de `Error` (o subclase) con un mensaje descriptivo que incluya contexto operacional.
**VALOR:** Un `throw 'something went wrong'` pierde el stack trace. Un `throw new Error('Scoring failed for ticket RG-1234: threshold not found in config')` permite diagnostico inmediato desde los logs sin reproducir el error.
**IMPLEMENTACION:**
```typescript
// Correcto
throw new Error(`Scoring failed for ticket ${ticketId}: ${reason}`);
// Correcto: custom error class
class ScoringError extends Error {
  constructor(public readonly ticketId: string, reason: string) {
    super(`Scoring failed for ticket ${ticketId}: ${reason}`);
    this.name = 'ScoringError';
  }
}
// Incorrecto
throw 'scoring failed';
throw { message: 'scoring failed' };
```
**AUDITORIA:** Ralph busca `throw` seguido de un string literal u objeto plano (no instancia de `Error`) y reporta como violacion.

### ARCH-SOLID-235
**DEFINICION:** Un archivo no debe tener mas de una exportacion de clase o funcion principal; el archivo se nombra igual que la exportacion principal en `camelCase` (funcion) o `PascalCase` (clase).
**VALOR:** Un archivo por clase/funcion principal facilita la navegacion (el nombre del archivo indica su contenido), reduce conflictos de merge, y hace que el arbol de directorios sea un mapa del dominio.
**IMPLEMENTACION:**
```
src/domain/scoring/
  scoring-engine.ts        -> export class ScoringEngine
  calculate-score.ts       -> export function calculateScore
  scoring-result.ts        -> export interface ScoringResult
  index.ts                 -> barrel re-exports
```
Los archivos `index.ts` son la unica excepcion: pueden re-exportar multiples entidades.
**AUDITORIA:** Ralph verifica que cada archivo `.ts` en `src/` (excluyendo `index.ts` y `*.types.ts`) exporte una unica clase o funcion como exportacion principal.
