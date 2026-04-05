# [RB-029] OWASP Top 10

> Fuente: OWASP Top 10

## Reglas

### SEC-PRIV-251
**DEFINICION:** Toda entrada de usuario (query params, body, headers, URL path segments) debe ser validada y sanitizada contra un schema definido antes de ser procesada; prohibido pasar datos crudos del request directamente a queries, comandos shell, o respuestas HTML.
**VALOR:** La inyeccion (SQL, NoSQL, command, LDAP) ocurre cuando datos no confiables se concatenan directamente en un interprete. La validacion con schema previene inyeccion en la fuente, antes de que los datos alcancen la logica de negocio.
**IMPLEMENTACION:**
```typescript
import { z } from 'zod';

const WebhookPayloadSchema = z.object({
  issueKey: z.string().regex(/^[A-Z]+-\d+$/, 'Invalid issue key format'),
  event: z.enum(['created', 'updated', 'deleted']),
  data: z.record(z.unknown()),
});

function validatePayload(raw: unknown): WebhookPayload {
  return WebhookPayloadSchema.parse(raw); // throws ZodError on failure
}
```
Para Storage queries, usar parametros, nunca concatenacion de strings.
**AUDITORIA:** Ralph verifica que cada handler de endpoint/webhook valide su input contra un schema Zod (o equivalente) antes de cualquier operacion de negocio.

### SEC-PRIV-252
**DEFINICION:** Toda salida renderizada al usuario debe escapar contenido dinamico; prohibido usar `innerHTML`, `dangerouslySetInnerHTML`, o interpolacion sin escape en templates HTML.
**VALOR:** Cross-Site Scripting (XSS) permite a un atacante ejecutar JavaScript en el navegador de otro usuario, pudiendo robar tokens, realizar acciones en nombre de la victima, o redirigir a sitios maliciosos.
**IMPLEMENTACION:**
```typescript
// Prohibido
element.innerHTML = userInput;
React.createElement('div', { dangerouslySetInnerHTML: { __html: userInput } });

// Correcto: React escapa automaticamente
<div>{userInput}</div>

// Si HTML rico es necesario, sanitizar con DOMPurify
import DOMPurify from 'dompurify';
<div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(userInput) }} />
```
En Forge UI Kit, usar componentes nativos que escapan automaticamente.
**AUDITORIA:** Ralph busca `innerHTML`, `dangerouslySetInnerHTML`, y `document.write` en el codigo fuente y reporta cada ocurrencia. Las instancias con DOMPurify son aceptables.

### SEC-PRIV-253
**DEFINICION:** Toda operacion que modifique estado (write, delete, admin action) debe verificar autorizacion antes de ejecutar; prohibido confiar solo en que el usuario esta autenticado. Implementar checks de permisos granulares por recurso.
**VALOR:** Broken Access Control (OWASP #1 en 2021) ocurre cuando la aplicacion verifica identidad pero no permisos. Un usuario autenticado sin permisos de admin no debe poder acceder a endpoints de administracion.
**IMPLEMENTACION:**
```typescript
// Middleware de autorizacion por rol
function requirePermission(permission: string) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user.permissions.includes(permission)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}

// Uso
app.delete('/api/rules/:id', requirePermission('rules:delete'), handler);
```
Para Forge, verificar scopes del contexto en cada resolver.
**AUDITORIA:** Ralph verifica que cada endpoint POST/PUT/DELETE/PATCH tenga un middleware o check de autorizacion antes del handler principal.

### SEC-PRIV-254
**DEFINICION:** Toda solicitud que modifique estado debe incluir un token CSRF synchronizer o usar el patron Double Submit Cookie; las APIs stateless con JWT en header `Authorization` estan exentas si no usan cookies.
**VALOR:** Cross-Site Request Forgery engana al navegador del usuario para que envie requests autenticados a la aplicacion sin su conocimiento. Sin proteccion CSRF, un sitio malicioso puede hacer que un usuario admin elimine datos.
**IMPLEMENTACION:**
```typescript
import csrf from 'csurf';
const csrfProtection = csrf({ cookie: true });

// En forms que modifican estado
app.get('/api/csrf-token', csrfProtection, (req, res) => {
  res.json({ csrfToken: req.csrfToken() });
});

app.post('/api/rules', csrfProtection, handler);
```
Para APIs exclusivamente con Bearer tokens en headers, CSRF no aplica porque el navegador no envia automaticamente el header `Authorization`.
**AUDITORIA:** Ralph verifica que los formularios y endpoints de modificacion que usen cookie-based auth tengan proteccion CSRF, y que APIs con Bearer tokens documenten la exencion.

### SEC-PRIV-255
**DEFINICION:** Prohibido almacenar secretos, tokens, contrasenas o claves privadas en el codigo fuente; usar variables de entorno inyectadas en runtime y un vault (Forge Encrypted Storage, AWS Secrets Manager, HashiCorp Vault) para secretos persistentes.
**VALOR:** Los secretos en codigo fuente se filtran via git history, logs de CI, y repositorios publicos. Una vez en git, existen para siempre incluso si se borran del archivo. El costo de rotacion de un secreto filtrado es horas/dias de trabajo.
**IMPLEMENTACION:**
```typescript
// Correcto: leer de entorno
const apiKey = process.env.JIRA_API_KEY;
if (!apiKey) throw new Error('JIRA_API_KEY environment variable is required');

// Prohibido
const apiKey = 'AKIAIOSFODNN7EXAMPLE';
```
Agregar `*.env` a `.gitignore`. Usar `Forge SecureStorage` para datos sensibles en runtime.
**AUDITORIA:** Ralph busca patrones de strings hardcodeados que parezcan secrets: API keys, tokens JWT, passwords, AWS keys, y cadenas base64 de mas de 40 caracteres en archivos de codigo fuente (no `.env.example`).
