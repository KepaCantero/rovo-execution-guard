# [RB-021] TypeScript Handbook

> Fuente: TypeScript Handbook

## Reglas

### ARCH-SOLID-201
**DEFINICION:** `"strict": true` debe estar habilitado en `tsconfig.json`; esto activa `strictNullChecks`, `strictFunctionTypes`, `strictBindCallApply`, `strictPropertyInitialization`, `noImplicitAny`, `noImplicitThis` y `alwaysStrict` simultaneamente.
**VALOR:** Elimina clases completas de errores en tiempo de ejecucion (acceso a propiedades de `undefined`, asignaciones inseguras) antes de que lleguen a produccion.
**IMPLEMENTACION:** En `tsconfig.json` establecer `"compilerOptions": { "strict": true }`. No deshabilitar sub-flags individuales sin una justificacion documentada en un comentario `// @ts-expect-error - razon`.
**AUDITORIA:** Ralph verifica que `tsconfig.json` contenga `"strict": true` y que no existan overrides como `"strictNullChecks": false` en el mismo archivo.

### ARCH-SOLID-202
**DEFINICION:** El tipo `any` esta prohibido; usar `unknown` cuando el tipo no se conoce en tiempo de compilacion y aplicar type guards para estrecharlo.
**VALOR:** `any` desactiva el sistema de tipos por completo, convirtiendo TypeScript en JavaScript sin validacion. `unknown` obliga al desarrollador a verificar el tipo antes de usarlo.
**IMPLEMENTACION:** Habilitar `"no-explicit-any"` en ESLint. Reemplazar `any` con `unknown` y usar type guards (`typeof`, `instanceof`, user-defined type predicates). Para datos externos (API responses), definir schemas con zod o io-ts.
**AUDITORIA:** Ralph busca ocurrencias de `: any`, `as any` y `<any>` en archivos `.ts`/`.tsx`. Cero tolerancia salvo en archivos de declaracion `*.d.ts` de terceros.

### ARCH-SOLID-203
**DEFINICION:** Toda estructura de datos publica debe definirse mediante `interface`; reservar `type` para uniones, intersecciones, mapeos condicionales y utility types.
**VALOR:** Las interfaces son extensibles por declaracion merging (util para plugins), son mas legibles en mensajes de error del compilador, y permiten `extends`/`implements` de forma natural.
**IMPLEMENTACION:** Definir contratos de dominio como `export interface ScoringResult { score: number; violations: string[]; }`. Usar `type` solo para `type Status = 'pass' | 'fail' | 'warn';` o `type Nullable<T> = T | null;`.
**AUDITORIA:** Ralph verifica que los archivos de tipos de dominio en `src/domain/types/` usen `interface` para entidades y value objects, y `type` solo para alias y uniones.

### ARCH-SOLID-204
**DEFINICION:** Toda funcion que opera sobre tipos parametrizados debe usar generics con constraints explícitos (`<T extends Entity>`) en lugar de `any` o castings.
**VALOR:** Los generics preservan la informacion de tipo a traves de abstracciones, permitiendo reutilizacion segura sin perder seguridad en tiempo de compilacion.
**IMPLEMENTACION:** `function findByField<T extends Record<string, unknown>>(items: T[], field: keyof T, value: T[keyof T]): T | undefined`. Los parametros genericos deben tener constraints que reflejen el uso real; nunca `<T>` sin constraint cuando el cuerpo accede a propiedades especificas.
**AUDITORIA:** Ralph busca funciones genericas sin constraint (`<T>`) que accedan a propiedades concretas dentro del cuerpo de la funcion y reporta la ausencia de `extends`.

### ARCH-SOLID-205
**DEFINICION:** Toda funcion publica y metodo de clase debe declarar tipos de retorno explicitos; nunca depender de inferencia para la firma exportada.
**VALOR:** Los tipos de retorno explicitos actuan como documentacion viva, previenen refactors que cambien accidentalmente el contrato publico, y producen mejores mensajes de error cuando el contrato se rompe.
**IMPLEMENTACION:** `export function calculateScore(input: ScoringInput): ScoringResult { ... }`. En callbacks internos y funciones privadas la inferencia es aceptable.
**AUDITORIA:** Ralph verifica que las funciones exportadas y los metodos publicos de clases tengan anotacion `: ReturnType` explicita en su firma.
