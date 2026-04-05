# [RB-003] Forge Security Guide

> Fuente: Forge Security Guide - https://developer.atlassian.com/platform/forge/security/

## Reglas

### SEC-PRIV-001

**DEFINICION:** Toda app Forge debe declarar scopes OAuth 2.0 minimos en el manifest y solicitarlos solo cuando el usuario realiza una accion que los requiere.

**VALOR:** El principio de menor privilegio reduce el blast radius de una vulnerabilidad. Solicitar `write:jira-work` cuando solo se necesita `read:jira-work` expone datos a escritura no autorizada si la app es comprometida.

**IMPLEMENTACION:**
```yaml
permissions:
  scopes:
    - read:jira-work        # Solo lectura, no write
    - read:confluence-content
```
Solicitar scopes en el manifest a nivel de app, no por modulo. Revisar periodicamente si algun scope declarado ya no es necesario.

**AUDITORIA:** Ralph compara los scopes declarados en `permissions.scopes` contra las operaciones reales del codigo. Si el codigo solo usa `requestJira(route).then(r => r.json())` (lectura) pero el scope es `write:jira-work`, el check falla.

---

### SEC-PRIV-002

**DEFINICION:** Ningun dato sensible (tokens API, contrasenas, PII) debe almacenarse en Forge Storage sin cifrado ni loguearse en Forge Logs.

**VALOR:** Forge Storage esta cifrado en reposo por Atlassian, pero los logs son accesibles para el desarrollador en texto plano. Filtrar PII a logs viola GDPR/CCPA y expone datos en herramientas de debugging.

**IMPLEMENTACION:**
```typescript
// NUNCA:
console.log(`User ${user.email} triggered action`);

// CORRECTO:
console.log(`User ${user.accountId} triggered action`);

// Para Storage, sanitizar antes de guardar:
function sanitizeForStorage(data: Record<string, unknown>): Record<string, unknown> {
  const { email, displayName, ...safe } = data as any;
  return { ...safe, accountId: data.accountId };
}
```

**AUDITORIA:** Ralph escanea todas las llamadas a `console.log`, `console.info`, `console.warn`, `console.error` en busca de patrones de email, nombre de usuario, o keys que contengan "password", "token", "secret". Tambien verifica que los writes a Storage no incluyan campos de PII.

---

### SEC-PRIV-003

**DEFINICION:** Toda comunicacion saliente debe usar HTTPS y estar en la allowlist de egress del manifest.

**VALOR:** Forge bloquea por defecto toda request saliente. La allowlist es el mecanismo de defensa perimetral. Permitir HTTP (sin S) expone datos en transito y es rechazado por Forge. Cada dominio en la allowlist es un punto de confianza.

**IMPLEMENTACION:**
```yaml
permissions:
  external:
    fetch:
      - https://api.github.com          # HTTPS obligatorio
      - https://your-api.example.com    # HTTPS obligatorio
```
```typescript
// Verificar en runtime:
const url = new URL(endpoint);
if (url.protocol !== 'https:') {
  throw new Error('Solo se permiten endpoints HTTPS');
}
```

**AUDITORIA:** Ralph extrae la lista de `permissions.external.fetch` y verifica que: (1) todas empiecen con `https://`, (2) no contengan wildcards (`*`), (3) cada dominio sea referenciado en al menos una llamada `fetch()` en el codigo.

---

### SEC-PRIV-004

**DEFINICION:** Las funciones Forge deben validar y sanitizar toda input proveniente de Jira/Confluence antes de procesarla o enviarla a APIs externas.

**VALOR:** Los datos de Jira y Confluence son user-generated y pueden contener XSS, inyecciones, o payloads maliciosos. Forge Functions se ejecutan en un entorno compartido; una vulnerabilidad de inyeccion puede afectar a otros tenants.

**IMPLEMENTACION:**
```typescript
import { sanitize } from 'dompurify';

function validateJiraPayload(payload: unknown): ValidatedPayload {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Invalid payload: expected object');
  }
  const { issue, user } = payload as any;
  if (!issue?.key || typeof issue.key !== 'string') {
    throw new Error('Invalid payload: missing issue.key');
  }
  // Validar formato de issue key
  if (!/^[A-Z]+-\d+$/.test(issue.key)) {
    throw new Error('Invalid issue key format');
  }
  return { issueKey: issue.key, accountId: user?.accountId };
}
```

**AUDITORIA:** Ralph verifica que toda funcion handler que recibe `payload` o `request.body` pase los datos por una funcion de validacion antes de usarlos. Busca accesos directos a `payload.*` sin validacion previa.

---

### SEC-PRIV-005

**DEFINICION:** La app debe implementar manejo de errores que no exponga stack traces ni detalles internos al usuario final.

**VALOR:** Los stack traces revelan estructura de codigo, nombres de funciones y rutas de archivos que un atacante puede usar para planificar un ataque dirigido. En Forge, los errores del runtime se propagan al UI si no se capturan.

**IMPLEMENTACION:**
```typescript
export async function handler(payload: TriggerPayload): Promise<void> {
  try {
    await processEvent(payload);
  } catch (error) {
    // Log completo para debugging del desarrollador
    console.error('Handler error:', error.message, { stack: error.stack });
    // Response sanitizado para el usuario
    throw new Error('Processing failed. Please try again or contact support.');
  }
}
```

**AUDITORIA:** Ralph verifica que todos los handlers tengan bloques try/catch de nivel superior y que los errores lanzados al UI no contengan `error.stack`, `error.message` original (del sistema), ni referencias a rutas de archivos.
