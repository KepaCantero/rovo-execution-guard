# REQUISITOS: ErrorBoundary

> **Sidecar File** | Vinculado a: `src/frontend/components/ErrorBoundary.tsx`

---

## Descripcion

Componente React Error Boundary que captura errores no manejados en el arbol de componentes
hijo y los envia a Sentry con informacion del componente (`componentStack`). Degradacion
graceful: si Sentry no esta inicializado, el ErrorBoundary aun renderiza UI de fallback.

Este componente es infraestructura de UI transversal. Envuelve los componentes del Custom UI
(issue-panel, admin-dashboard) para garantizar que errores inesperados no rompan la interfaz
y sean reportados a Sentry para diagnostico.

### Nota sobre UI-ADS-0955 (Excepcion documentada)

**[UI-ADS-0955]** prohibe class components en el issue panel. Sin embargo, React Error Boundaries
**requieren** class components — el lifecycle method `componentDidCatch` solo existe en class
components. No existe un hook equivalente (el equipo de React ha declarado que es intencional).

**Resolucion**: ErrorBoundary MUST ser un class component. Esta es una restriccion de la API de
React, no una decision de diseno. La regla UI-ADS-0955 aplica a componentes del issue panel —
ErrorBoundary es infraestructura, no un componente de panel. El componente se exporta como
named export `ErrorBoundaryWrapper` para seguir la convencion del proyecto.

---

## Acceptance Criteria

- [ ] **AC-01**: `componentDidCatch` captura errores del arbol hijo y llama `captureException` desde `src/frontend/utils/sentry.ts` con contexto `componentStack` [TEST-QA-036-01]
- [ ] **AC-02**: `componentDidCatch` agrega breadcrumb con categoria `error-boundary` via `addErrorBreadcrumb` [TEST-QA-036-02]
- [ ] **AC-03**: Contexto enviado a Sentry incluye `componentStack` en la estructura `BrowserSentryContext` usando index signature [TEST-QA-036-03]
- [ ] **AC-04**: UI de fallback se renderiza cuando ocurre un error — accesible y minimal [FORGE-OPS-0104]
- [ ] **AC-05**: Fallback UI se renderiza correctamente incluso cuando Sentry no esta inicializado [AC-06 from RTASK-022, FORGE-OPS-0104]
- [ ] **AC-06**: Props aceptan `children`, `issueKey?`, `projectKey?`, y `fallback?` opcional para UI personalizada
- [ ] **AC-07**: Ningun tipo `any` — usar `unknown`, interfaces tipadas [ARCH-SOLID-202]
- [ ] **AC-08**: Todas las interfaces tienen propiedades `readonly` [ARCH-SOLID-203]
- [ ] **AC-09**: Named export `ErrorBoundaryWrapper` — seguir convencion del proyecto [ARCH-SOLID-232]
- [ ] **AC-10**: Archivo `.reqs.md` sidecar producido (este archivo)
- [ ] **AC-11**: No importa directamente desde `@sentry/browser` — solo desde `src/frontend/utils/sentry.ts` [ARCH-SOLID-058]

---

## Reglas del Rulebook

Las siguientes reglas del RULEBOOK.md deben respetarse en este modulo:

| ID Regla         | Categoria    | Descripcion breve                                                                |
| ---------------- | ------------ | -------------------------------------------------------------------------------- |
| [FORGE-OPS-009]  | Forge Ops    | Bundle <= 50 MB — solo imports desde React + sentry.ts, sin librerias pesadas    |
| [FORGE-OPS-0104] | Forge Ops    | Graceful degradation — fallback UI se renderiza siempre, Sentry es best-effort   |
| [SEC-PRIV-002]   | Seguridad    | No datos sensibles en contexto — DSN, tokens, PII nunca en contexto Sentry       |
| [SEC-PRIV-006]   | Seguridad    | Auth tokens de `@forge/bridge` nunca pasados como contexto/tags Sentry           |
| [SEC-PRIV-008]   | Seguridad    | Minimizacion de datos — solo `componentStack`, `issueKey`, `projectKey`          |
| [ARCH-SOLID-202] | Arquitectura | Zero `any` — usar `unknown`, type guards, interfaces tipadas                     |
| [ARCH-SOLID-203] | Arquitectura | Interfaces con propiedades `readonly`                                            |
| [ARCH-SOLID-232] | Arquitectura | Named exports — `ErrorBoundaryWrapper` para seguir convencion del proyecto       |
| [ARCH-SOLID-058] | Arquitectura | No importa tipos de `@sentry/browser` — usa interfaces de `sentry.ts`            |
| [ARCH-SOLID-205] | Arquitectura | Tipos de retorno explicitos: `render()` → `React.ReactNode`, `componentDidCatch` |
| [TEST-QA-036-01] | Testing      | Cada excepcion no capturada debe ir a Sentry                                     |
| [TEST-QA-036-02] | Testing      | Breadcrumb en paso significativo — error boundary catch                          |
| [TEST-QA-036-03] | Testing      | Contexto estructurado con `componentStack`                                       |
| [TEST-QA-056]    | Testing      | TDD estricto: RED -> GREEN -> REFACTOR                                           |

---

## Contrato Publico (API del modulo)

### Tipos exportados

#### `ErrorBoundaryProps`

```typescript
interface ErrorBoundaryProps {
  readonly children: React.ReactNode;
  readonly issueKey?: string;
  readonly projectKey?: string;
  readonly fallback?: React.ReactNode;
}
```

- **Proposito**: Props del ErrorBoundary — children a envolver, contexto opcional para Sentry, fallback UI opcional
- **Regla**: [ARCH-SOLID-203] propiedades readonly
- **Nota**: `fallback` permite personalizar la UI de error; si no se provee, se usa fallback por defecto

#### `ErrorBoundaryState`

```typescript
interface ErrorBoundaryState {
  readonly hasError: boolean;
  readonly error: Error | null;
}
```

- **Proposito**: Estado interno del ErrorBoundary
- **Regla**: [ARCH-SOLID-203] propiedades readonly

### Componente exportado

#### `ErrorBoundaryWrapper` (class component wrapping)

- **Proposito**: Componente React que envuelve hijos en un Error Boundary. Captura errores del arbol hijo, los envia a Sentry con contexto de componente, y renderiza UI de fallback.
- **Pre-condiciones**: Ninguna — funciona con o sin Sentry inicializado
- **Post-condiciones**:
  - Si un error ocurre en un hijo: `captureException` llamada con `componentStack`, breadcrumb agregado, fallback renderizado
  - Si Sentry no esta inicializado: fallback renderizado sin envio a Sentry (no-op)
  - Si no hay error: children renderizados normalmente
- **Errores**: Nunca lanza — `componentDidCatch` es el mecanismo de captura
- **Regla**: [FORGE-OPS-0104], [TEST-QA-036-01]

---

## Dependencias (imports)

### Internas (proyecto)

- `src/frontend/utils/sentry.ts` -> `captureException`, `addErrorBreadcrumb`, `BrowserSentryContext`, `BrowserSentryBreadcrumb` [ARCH-SOLID-058]

### Externas (npm)

- `react` -> `React.Component`, `React.ReactNode`, `React.ErrorInfo`

### NOTA: Sin dependencias directas de Sentry

- ErrorBoundary NO importa nada de `@sentry/browser` directamente [ARCH-SOLID-058]
- Todas las llamadas a Sentry pasan por `src/frontend/utils/sentry.ts`
- Esto garantiza que la logica de graceful degradation esta centralizada

---

## Comportamiento Detallado

### Ciclo de vida del Error Boundary

1. **Render normal**: Cuando `hasError === false`, renderiza `children`
2. **Error capturado**:
   a. `getDerivedStateFromError(error)` → actualiza estado a `{ hasError: true, error }`
   b. `componentDidCatch(error, errorInfo)` →
   - Construye `BrowserSentryContext` con `issueKey`, `projectKey`, `componentStack` via index signature
   - Llama `captureException(error, context)` — envio a Sentry (best-effort, no-op si no inicializado)
   - Llama `addErrorBreadcrumb` con categoria `error-boundary` — breadcrumb para trazabilidad
3. **Fallback render**: Cuando `hasError === true`, renderiza `props.fallback` o fallback por defecto

### Fallback UI por defecto

- Mensaje simple y accesible: "Something went wrong"
- Sin dependencias de UI libraries pesadas [FORGE-OPS-009]
- Si se provee `props.fallback`, se renderiza en lugar del por defecto

### Contexto enviado a Sentry

```typescript
const context: BrowserSentryContext = {
  issueKey: this.props.issueKey,
  projectKey: this.props.projectKey,
  componentStack: errorInfo.componentStack, // via index signature
};
```

- **Permitido**: `issueKey`, `projectKey`, `componentStack` [SEC-PRIV-008]
- **Prohibido**: DSN, tokens, PII, contenido de issues [SEC-PRIV-002], [SEC-PRIV-006]

---

## Estrategia de Test

### Unit Tests (`tests/unit/components/ErrorBoundary.spec.tsx`)

| Test Category    | Test Case                                                                      | AC cubierto | Regla cubierta |
| ---------------- | ------------------------------------------------------------------------------ | ----------- | -------------- |
| Error capture    | componentDidCatch llama captureException con error y contexto                  | AC-01       | TEST-QA-036-01 |
| Error capture    | Contexto incluye componentStack via BrowserSentryContext                       | AC-03       | TEST-QA-036-03 |
| Error capture    | captureException recibe issueKey cuando props.issueKey esta definido           | AC-03       | SEC-PRIV-008   |
| Error capture    | captureException recibe projectKey cuando props.projectKey esta definido       | AC-03       | SEC-PRIV-008   |
| Breadcrumb       | componentDidCatch agrega breadcrumb con categoria error-boundary               | AC-02       | TEST-QA-036-02 |
| Fallback UI      | Fallback por defecto se renderiza cuando ocurre error                          | AC-04       | FORGE-OPS-0104 |
| Fallback UI      | Fallback personalizado se renderiza cuando se provee via props                 | AC-04       | -              |
| Graceful degrad  | Fallback se renderiza correctamente cuando Sentry no esta inicializado         | AC-05       | FORGE-OPS-0104 |
| No Sentry call   | captureException no es llamada si error boundary atrapa error sin Sentry       | AC-05       | FORGE-OPS-0104 |
| Props            | Children se renderizan normalmente cuando no hay error                         | AC-06       | -              |
| Props            | issueKey y projectKey se pasan al contexto Sentry                              | AC-06       | TEST-QA-036-03 |
| Zero any         | grep de `any` en el archivo retorna cero resultados                            | AC-07       | ARCH-SOLID-202 |
| Readonly         | Interfaces ErrorBoundaryProps y ErrorBoundaryState tienen propiedades readonly | AC-08       | ARCH-SOLID-203 |
| Named export     | ErrorBoundaryWrapper es named export, no export default                        | AC-09       | ARCH-SOLID-232 |
| No direct import | No importa desde @sentry/browser directamente                                  | AC-11       | ARCH-SOLID-058 |

### Mock Strategy

- Mockear `src/frontend/utils/sentry` con `jest.mock()` — verificar llamadas a `captureException` y `addErrorBreadcrumb`
- Usar `@testing-library/react` para montar el componente y simular errores
- Usar `@jest-environment jsdom` docblock (mismo patron que ConfigurationTab.spec.tsx)
- Simular error lanzando desde un componente hijo: `throw new Error('test error')`
- NO mockear React — usar el Error Boundary real con componente hijo que lanza error

---

## Historial de Cambios

| Fecha | Tarea Ralph | Cambio         |
| ----- | ----------- | -------------- |
|       | RTASK-022   | Creado inicial |
