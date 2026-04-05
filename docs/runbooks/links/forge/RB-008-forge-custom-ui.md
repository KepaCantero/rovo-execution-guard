# [RB-008] Forge Custom UI

> Fuente: Forge Custom UI - https://developer.atlassian.com/platform/forge/custom-ui/

## Reglas

### UI-ADS-008

**DEFINICION:** Las apps Custom UI deben comunicarse con Forge Functions exclusivamente a traves del `@forge/bridge` API (`invoke`, `requestJira`, etc.), nunca mediante HTTP directo al host.

**VALOR:** Custom UI se ejecuta en un iframe sandboxed con CSP estricto. Las llamadas HTTP directas al host Atlassian son bloqueadas por CORS y CSP. `@forge/bridge` es el unico canal autorizado que proporciona autenticacion automatica y manejo de tokens.

**IMPLEMENTACION:**
```typescript
import { invoke } from '@forge/bridge';

// CORRECTO - via bridge:
const score = await invoke('getConsistencyScore', { ticketKey: 'PRJ-123' });

// CORRECTO - via bridge para APIs de Atlassian:
import { requestJira } from '@forge/bridge';
const response = await requestJira('/rest/api/3/myself');

// INCORRECTO - nunca:
// fetch('https://your-tenant.atlassian.net/rest/api/3/myself')
```

**AUDITORIA:** Ralph verifica que en directorios de Custom UI no existan llamadas `fetch()` o `XMLHttpRequest` que apunten a dominios de Atlassian. Las unnicas llamadas permitidas deben usar funciones de `@forge/bridge`.

---

### UI-ADS-009

**DEFINICION:** Las apps Custom UI deben cumplir con la CSP de Forge: no cargar scripts externos, no usar eval(), no usar inline styles que ejecuten JavaScript, y no cargar estilos de dominios externos no declarados.

**VALOR:** La CSP de Forge bloquea `unsafe-eval`, `unsafe-inline` y sources de scripts externos. Cualquier violacion causa que el recurso sea bloqueado por el navegador silenciosamente, rompiendo la funcionalidad sin errores visibles en produccion.

**IMPLEMENTACION:**
```typescript
// CORRECTO - CSS modules o styled-components:
import styles from './panel.module.css';

// INCORRECTO - scripts externos:
// <script src="https://cdn.example.com/lib.js"></script>

// INCORRECTO - eval:
// const fn = new Function('return ' + code);
```
Bundlear todas las dependencias con webpack/esbuild en el build step. No usar CDNs en produccion.

**AUDITORIA:** Ralph escanea archivos HTML y TSX en directorios Custom UI en busca de `<script src="http`, `eval(`, `new Function(`, y `<link href="http`. Si encuentra alguno, el check falla.

---

### FORGE-OPS-011

**DEFINICION:** El bundle de recursos estaticos de Custom UI no debe exceder 150 MB ni 500 archivos para apps en plan paid (o los limites del plan correspondiente).

**VALOR:** Los recursos estaticos se almacenan en un CDN con cuotas. Superar la cuota causa que el deploy falle. El recurso quota se resetea semanalmente para planes paid, pero los recursos legacy permanecen hasta ser eliminados.

**IMPLEMENTACION:** Usar tree-shaking, code splitting y lazy loading. Comprimir imagenes y assets. Usar `forge build` para verificar el tamano del bundle antes de deployar. Limpiar recursos no utilizados con `forge resources cleanup`.

**AUDITORIA:** Ralph verifica que el output de `forge build` no supere 150 MB. Si existe un `webpack.config.js`, verifica que tenga `optimization.splitChunks` configurado y que los assets estaticos (imagenes, fuentes) esten comprimidos.

---

### SEC-PRIV-006

**DEFINICION:** Los tokens de autenticacion obtenidos via `@forge/bridge` no deben almacenarse en localStorage, sessionStorage, ni en variables globales.

**VALOR:** Los tokens de Forge son de corta duracion y se refrescan automaticamente por el bridge. Almacenarlos expone el token a XSS (si existe) y a acceso por extensiones del navegador. El token puede estar expirado cuando se reutiliza.

**IMPLEMENTACION:**
```typescript
// CORRECTO - usar el bridge para cada llamada:
import { requestJira } from '@forge/bridge';
const response = await requestJira('/rest/api/3/myself');

// INCORRECTO - nunca cachear tokens:
// const token = await getAuthToken();
// localStorage.setItem('forge-token', token);
```

**AUDITORIA:** Ralph escanea el codigo de Custom UI en busca de `localStorage`, `sessionStorage`, `window.__`, y variables globales que contengan "token", "auth", o "jwt". Si encuentra almacenamiento de tokens, el check falla.
