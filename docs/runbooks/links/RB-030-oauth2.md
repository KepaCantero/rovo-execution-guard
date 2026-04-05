# [RB-030] OAuth 2.0 Simplified

> Fuente: OAuth 2.0 Simplified

## Reglas

### SEC-PRIV-261
**DEFINICION:** Toda integracion OAuth 2.0 debe usar el flujo Authorization Code con PKCE (`code_challenge_method: S256`); prohibido usar Implicit Grant, Resource Owner Password Credentials, o Client Credentials para flujos con interaccion de usuario.
**VALOR:** El Implicit Grant expone el token en la URL (visible en logs y history). Password Credentials envia credenciales al cliente. Authorization Code + PKCE es el unico flujo que protege el token en un canal backend y previene code interception attacks.
**IMPLEMENTACION:**
```typescript
import { generateCodeVerifier, generateCodeChallenge } from 'crypto';

const verifier = generateCodeVerifier();
const challenge = await generateCodeChallenge(verifier, 'S256');

const authUrl = new URL(authorizationEndpoint);
authUrl.searchParams.set('response_type', 'code');
authUrl.searchParams.set('code_challenge', challenge);
authUrl.searchParams.set('code_challenge_method', 'S256');
// ... redirect user to authUrl
```
En Forge, el framework maneja OAuth internamente con Authorization Code.
**AUDITORIA:** Ralph verifica que las configuraciones OAuth en el proyecto usen `response_type: 'code'` y que no existan configuraciones con `response_type: 'token'` (Implicit Grant).

### SEC-PRIV-262
**DEFINICION:** Los access tokens deben almacenarse exclusivamente en memoria o en httpOnly+Secure cookies con `SameSite=Strict`; prohibido almacenar tokens en `localStorage`, `sessionStorage`, o cookies sin httpOnly.
**VALOR:** `localStorage` es accesible por cualquier JavaScript en la pagina, incluyendo dependencias de terceros comprometidas y ataques XSS. Una cookie httpOnly+Secure+SameSite solo puede ser enviada por el navegador en requests al mismo sitio y no es accesible desde JavaScript.
**IMPLEMENTACION:**
```typescript
// Correcto: cookie segura
res.cookie('access_token', token, {
  httpOnly: true,
  secure: true,
  sameSite: 'strict',
  maxAge: 15 * 60 * 1000, // 15 minutos
});
// Correcto: en memoria (SPA)
let accessToken: string | null = null;
// Prohibido
localStorage.setItem('access_token', token);
```
**AUDITORIA:** Ralph busca `localStorage.setItem`, `sessionStorage.setItem` y cookies sin `httpOnly: true` en el codigo del cliente/frontend.

### SEC-PRIV-263
**DEFINICION:** Los scopes OAuth deben solicitar el minimo privilegio necesario para la operacion actual; cada scope debe estar documentado con su justificacion de uso. Si una operacion no necesita write access, no solicitarlo.
**VALOR:** El principio de menor privilegio limita el dano si un token es comprometido. Un token con `read:jira-work` no puede modificar issues si es interceptado; un token con `write:jira-work` si puede.
**IMPLEMENTACION:** Documentar scopes en el manifiesto de Forge o configuracion OAuth:
```yaml
# manifest.yml
permissions:
  scopes:
    - read:jira-work          # Lectura de issues para scoring
    - read:confluence-content # Lectura de documentacion vinculada
    # NO incluir write:jira-work si solo se lee
```
Para APIs personalizadas, definir scopes granulares: `scoring:read`, `scoring:write`, `admin:config`.
**AUDITORIA:** Ralph verifica que los scopes OAuth declarados en la configuracion (Forge manifest, OAuth config) esten documentados con su justificacion y que no incluyan permisos de escritura cuando la operacion es solo lectura.

### SEC-PRIV-264
**DEFINICION:** Todo access token debe tener una expiracion maxima de 15 minutos (900 segundos); usar refresh tokens con rotacion (cada uso invalida el anterior) para mantener la sesion.
**VALOR:** Un token con expiracion larga (horas/dias) que es comprometido da al atacante una ventana amplia de acceso. Con 15 minutos, la ventana se reduce drasticamente. La rotacion de refresh tokens detecta robo: si un refresh token usado es reusado, la revocacion de toda la familia de tokens indica compromiso.
**IMPLEMENTACION:**
```typescript
const accessToken = jwt.sign(payload, secret, { expiresIn: '15m' });
const refreshToken = crypto.randomBytes(32).toString('hex');
// Almacenar hash del refresh token en base de datos
// Al usar un refresh token, invalidar el anterior y emitir uno nuevo
```
**AUDITORIA:** Ralph verifica que la configuracion de emision de tokens use `expiresIn: '15m'` o `900` segundos y que los refresh tokens usen rotacion.

### SEC-PRIV-265
**DEFINICION:** Toda redireccion OAuth debe validar que la URL de redirect URI este en una whitelist estricta; prohibido usar redirect URI parametrico que acepte cualquier dominio o path dinamico.
**VALOR:** Un redirect URI abierto permite al atacante redirigir el codigo de autorizacion a un servidor controlado, completando el flujo OAuth y obteniendo acceso a la cuenta de la victima (Open Redirect Attack).
**IMPLEMENTACION:**
```typescript
const ALLOWED_REDIRECT_URIS = [
  'https://app.example.com/oauth/callback',
  'https://app.example.com/admin/oauth/callback',
];

function validateRedirectUri(uri: string): boolean {
  return ALLOWED_REDIRECT_URIS.includes(uri);
}
// En el endpoint de callback
if (!validateRedirectUri(req.query.redirect_uri)) {
  throw new Error('Invalid redirect URI');
}
```
**AUDITORIA:** Ralph verifica que la validacion de redirect URI use una lista de valores exactos (no regex permisiva ni wildcard) y que la lista este definida como constante o variable de entorno.
