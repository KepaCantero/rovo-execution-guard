# [RB-002] Forge Platform Limits

> Fuente: Forge Platform Limits - https://developer.atlassian.com/platform/forge/platform-limits/

## Reglas

### FORGE-OPS-005

**DEFINICION:** Ninguna invocacion de funcion Forge debe exceder 10 segundos de ejecucion.

**VALOR:** El limite de 10 segundos es un hard limit de la plataforma. Las funciones que lo exceden son terminadas forzosamente sin response, dejando al usuario sin feedback y potencialmente en un estado inconsistente.

**IMPLEMENTACION:** Dividir operaciones largas en pasos mas cortos usando product events o scheduled triggers. Para procesamiento de datos pesado, usar paginacion y procesar en lotes. Para llamadas a APIs externas, implementar timeout propio con margen:
```typescript
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 8000); // 8s margen
try {
  const response = await fetch(url, { signal: controller.signal });
} finally {
  clearTimeout(timeout);
}
```

**AUDITORIA:** Ralph verifica que no existan funciones con caminos de ejecucion que puedan exceder 8 segundos (dejando 2s de margen). Busca loops sin limite, recursiones profundas y llamadas API secuenciales sin timeout.

---

### FORGE-OPS-006

**DEFINICION:** El uso de Forge Storage por app no debe exceder 100 MB.

**VALOR:** El limite de 100 MB es compartido entre key-value store y entity store. Superarlo causa errores de escritura y potencial perdida de datos. Este almacenamiento es para estado de la app, no para datos de negocio bulk.

**IMPLEMENTACION:** Usar Forge Storage para configuracion y estado de sesion. Para datos voluminosos (historial de PRs, logs), usar Confluence pages o el API de Jira como persistencia. Implementar limpieza periodica de registros temporales via scheduled triggers.

**AUDITORIA:** Ralph revisa que las funciones de escritura en Storage incluyan logica de limpieza o rotacion. Verifica que no se almacenen blobs grandes (ej. respuestas completas de API) sin compresion o truncamiento.

---

### FORGE-OPS-007

**DEFINICION:** Las operaciones de Storage deben respetar los limites de throughput: 50 reads/segundo, 10 writes/segundo, 10 queries/segundo, 10 deletes/segundo.

**VALOR:** Superar estos limites resulta en throttling (HTTP 429) que causa fallos transitorios en cascada. En un entorno multi-tenant, una app con bursts de escritura puede degradar la experiencia de todos los usuarios.

**IMPLEMENTACION:** Implementar backoff exponencial en toda operacion de Storage:
```typescript
async function storageWrite(key: string, value: unknown, retries = 3): Promise<void> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await storage.set(key, value);
      return;
    } catch (err) {
      if (err.status === 429 && attempt < retries) {
        await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 100));
      } else {
        throw err;
      }
    }
  }
}
```

**AUDITORIA:** Ralph verifica que toda llamada a `storage.set`, `storage.setAsync`, o metodos de entity store este envuelta en logica de retry con backoff para HTTP 429.

---

### FORGE-OPS-008

**DEFINICION:** Ninguna invocacion de funcion Forge debe realizar mas de 100 network requests.

**VALOR:** El limite de 100 requests por invocacion es un hard limit. Las funciones que lo exceden son terminadas. Esto previene abusos y asegura que las funciones sean eficientes en sus comunicaciones externas.

**IMPLEMENTACION:** Consolidar llamadas API usando batch endpoints donde sea posible. Para GitHub, usar el GraphQL API para obtener datos compuestos en una sola request en lugar de multiples REST calls. Implementar cache en Storage para datos que no cambian frecuentemente.

**AUDITORIA:** Ralph cuenta las llamadas a `fetch`, `requestJira`, `requestConfluence`, y `requestGraphql` en cada handler. Si un handler contiene mas de 50 llamadas directas (sin contar loops condicionales), emite un warning.

---

### FORGE-OPS-009

**DEFINICION:** El bundle de la app no debe exceder 50 MB comprimido ni contener mas de 10000 archivos.

**VALOR:** Bundles grandes incrementan el tiempo de cold start y pueden causar timeouts en el deploy. El limite de 10000 archivos evita ataques de zip-bomb y asegura tiempos de extraccion razonables.

**IMPLEMENTACION:** Usar tree-shaking agresivo, excluir node_modules completos que no se usen, y usar `forge build` con analisis de bundle. Evitar incluir assets estaticos grandes; usar URLs externas para recursos pesados.

**AUDITORIA:** Ralph verifica que el output de `forge build` no supere 50 MB. Si el proyecto tiene un `webpack.config.js` o similar, verifica que incluya `optimization.minimize: true` y que no bundlee `node_modules` completos.
