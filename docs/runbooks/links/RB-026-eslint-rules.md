# [RB-026] ESLint Rules

> Fuente: ESLint Rules

## Reglas

### ARCH-SOLID-221
**DEFINICION:** El archivo `.eslintrc` (o `eslint.config.ts` con flat config) debe extender `@typescript-eslint/recommended` y `@typescript-eslint/recommended-requiring-type-checking` para obtener reglas basadas en informacion de tipo del compilador.
**VALOR:** Las reglas con type-checking detectan errores que ESLint basico no puede ver: uso de promesas sin await, comparaciones inseguras, retorno implícito de async functions, y patrones de error no manejados.
**IMPLEMENTACION:** En `eslint.config.ts` (flat config) o `.eslintrc.json`:
```json
{
  "extends": [
    "plugin:@typescript-eslint/recommended",
    "plugin:@typescript-eslint/recommended-requiring-type-checking"
  ],
  "parserOptions": {
    "project": "./tsconfig.json"
  }
}
```
**AUDITORIA:** Ralph verifica que la configuracion ESLint incluya `recommended-requiring-type-checking` y que `parserOptions.project` apunte al `tsconfig.json` del proyecto.

### ARCH-SOLID-222
**DEFINICION:** La regla `@typescript-eslint/no-unused-vars` debe configurarse con `"argsIgnorePattern": "^_"` para permitir parametros prefijados con underscore, y `@typescript-eslint/no-explicit-any` debe estar en nivel `error`.
**VALOR:** `no-unused-vars` sin excepcion de underscore genera ruido en callbacks y overrides donde parametros posicionales no se usan. `no-explicit-any` en `error` (no `warn`) previene que `any` se filtre por costumbre.
**IMPLEMENTACION:** En ESLint config:
```json
{
  "rules": {
    "@typescript-eslint/no-unused-vars": ["error", {
      "argsIgnorePattern": "^_",
      "varsIgnorePattern": "^_"
    }],
    "@typescript-eslint/no-explicit-any": "error"
  }
}
```
Usar `_event` o `_index` para parametros no usados en callbacks.
**AUDITORIA:** Ralph verifica que `no-explicit-any` este en nivel `error` (no `warn` ni `off`) y que `no-unused-vars` tenga el patron de excepcion `^_`.

### ARCH-SOLID-223
**DEFINICION:** La regla `@typescript-eslint/explicit-function-return-type` debe aplicarse a todas las funciones y metodos exportados con la opcion `allowExpressions: true`; las arrow functions inline dentro de `map`/`filter` estan exentas.
**VALOR:** Forzar tipos de retorno en funciones exportadas crea un contrato explicito que los consumidores pueden verificar sin leer la implementacion. Las expresiones inline (callbacks) se eximen para mantener la fluidez.
**IMPLEMENTACION:** En ESLint config:
```json
{
  "rules": {
    "@typescript-eslint/explicit-function-return-type": ["error", {
      "allowExpressions": true,
      "allowTypedFunctionExpressions": true
    }]
  }
}
```
**AUDITORIA:** Ralph verifica que la regla `explicit-function-return-type` este activa y que las funciones exportadas en `src/` declaren su tipo de retorno.

### ARCH-SOLID-224
**DEFINICION:** Habilitar `@typescript-eslint/consistent-type-imports` con `prefer: type-imports` para separar imports de tipos de imports de valores; esto facilita la compilacion mas rapida y el tree-shaking.
**VALOR:** Mezclar type imports con value imports genera codigo muerto en el bundle cuando el bundler no puede distinguir que imports son solo de tipo. Separarlos con `import type` permite al compilador y al bundler optimizar correctamente.
**IMPLEMENTACION:** En ESLint config:
```json
{
  "rules": {
    "@typescript-eslint/consistent-type-imports": ["error", {
      "prefer": "type-imports",
      "fixStyle": "inline-type-imports"
    }]
  }
}
```
Resultado: `import { type ScoringInput, evaluate } from './scoring';`
**AUDITORIA:** Ralph verifica que `consistent-type-imports` este en `error` y que los archivos `*.ts` usen `import type` o `type` inline para imports que son solo de tipo.

### ARCH-SOLID-225
**DEFINICION:** Habilitar `@typescript-eslint/no-floating-promises` en nivel `error` para requerir que toda promesa sea await-ed, catch-ed, o asignada explicitamente a una variable; las promesas "flotantes" son la causa de errores silenciosos.
**VALOR:** Una promesa no await-ed que rechaza genera un `unhandledRejection` que en Node.js crashea el proceso, y en Forge Functions falla silenciosamente sin log ni respuesta al usuario.
**IMPLEMENTACION:** En ESLint config:
```json
{
  "rules": {
    "@typescript-eslint/no-floating-promises": "error"
  }
}
```
Para void returns intencionales, usar: `void someAsyncOperation();`. El `void` explicito documenta la intencion de ignorar la promesa.
**AUDITORIA:** Ralph verifica que `no-floating-promises` este en `error` y busca patrones de llamadas async sin `await`, `.catch()`, o `void` prefix.
