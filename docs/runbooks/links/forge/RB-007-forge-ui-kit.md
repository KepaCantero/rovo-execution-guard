# [RB-007] Forge UI Kit Components

> Fuente: Forge UI Kit Components - https://developer.atlassian.com/platform/forge/ui-kit/

## Reglas

### UI-ADS-005

**DEFINICION:** Los componentes UI Kit deben usar `@forge/react` version 10 o superior con React hooks (`useState`, `useEffect`, `useAction`), no el API legacy de prop functions.

**VALOR:** `@forge/react` v10+ soporta el modelo completo de React hooks, permitiendo logica de estado reutilizable, efectos secundarios y custom hooks. El API legacy (prop functions como `onAction`) es mas limitada, no soporta composicion de logica y sera deprecada.

**IMPLEMENTACION:**
```tsx
import { useState, useEffect } from '@forge/react';
import { fetchConsistencyScore } from '../services/scoring';

export function ScorePanel() {
  const [score, setScore] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(async () => {
    const result = await fetchConsistencyScore();
    setScore(result.score);
    setLoading(false);
  }, []);

  if (loading) return <Text>Loading score...</Text>;
  return <Text>Score: {score}%</Text>;
}
```

**AUDITORIA:** Ralph verifica en `package.json` que la version de `@forge/react` sea `>=10.0.0`. Busca imports de `onAction`, `onSubmit` como props de nivel superior en lugar de hooks, e indica migracion a hooks.

---

### UI-ADS-006

**DEFINICION:** Los componentes UI Kit no deben acceder al DOM directamente (`document.querySelector`, `document.getElementById`, `refs`, `portals`).

**VALOR:** Forge UI Kit se renderiza en un entorno sandboxed sin acceso al DOM real. Las llamadas directas al DOM fallan silenciosamente o lanzan errores en produccion. Forge usa un React reconciler custom que no mapea a nodos DOM reales.

**IMPLEMENTACION:** Usar el modelo declarativo de React con `useState` para control de estado visual. Para efectos secundarios, usar `useEffect` con el API de Forge. No usar `useRef` para manipulacion del DOM.

**AUDITORIA:** Ralph escanea archivos `.tsx` y `.jsx` en busca de `document.`, `window.`, `useRef` (para acceso DOM), `createPortal`, y `dangerouslySetInnerHTML`. Si encuentra alguno, el check falla.

---

### UI-ADS-007

**DEFINICION:** Los componentes UI Kit no deben inyectar HTML arbitrario ni usar `dangerouslySetInnerHTML`.

**VALOR:** La inyeccion de HTML arbitrario en Forge UI Kit es un riesgo de XSS y no esta soportada por el reconciler de Forge. Todo el contenido debe pasar por los componentes de UI Kit que sanitizan automaticamente.

**IMPLEMENTACION:**
```tsx
// CORRECTO - contenido via componentes:
<Text>{markdownContent}</Text>
<Stack>
  {items.map(item => <Text key={item.id}>{item.label}</Text>)}
</Stack>

// INCORRECTO - nunca:
// <div dangerouslySetInnerHTML={{ __html: rawHtml }} />
```

**AUDITORIA:** Ralph busca `dangerouslySetInnerHTML` en todo el codigo fuente. Si encuentra una ocurrencia, el check falla inmediatamente sin excepciones.

---

### ARCH-SOLID-004

**DEFINICION:** La logica de negocio (scoring, validacion, llamadas API) debe residir en Forge Functions separadas, no en componentes UI Kit.

**VALOR:** Los componentes UI Kit se ejecutan en un entorno restringido con limites de tiempo y memoria mas estrictos. Poner logica de negocio en el UI dificulta el testing, viola SRP y puede causar timeouts en el renderizado.

**IMPLEMENTACION:**
```typescript
// services/scoring.ts (Forge Function):
export async function calculateScore(ticketKey: string): Promise<ScoreResult> {
  const jiraData = await fetchJiraTicket(ticketKey);
  const rovoContext = await fetchRovoContext(jiraData);
  return computeScore(jiraData, rovoContext);
}

// ui/ScorePanel.tsx (UI Kit):
import { invoke } from '@forge/bridge';
import { useState, useEffect } from '@forge/react';

export function ScorePanel() {
  const [score, setScore] = useState<ScoreResult | null>(null);

  useEffect(async () => {
    const result = await invoke('calculateScore', { ticketKey: 'PRJ-123' });
    setScore(result);
  }, []);

  return <Text>Score: {score?.percentage}%</Text>;
}
```

**AUDITORIA:** Ralph verifica que los archivos en directorios de UI (ui/, views/, components/) no contengan llamadas directas a `requestJira`, `requestConfluence`, `fetch`, ni logica de scoring/validacion. Estas deben estar en servicios invocados via `invoke()`.
