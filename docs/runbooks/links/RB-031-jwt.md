# [RB-031] JSON Web Tokens (JWT)

> Fuente: JSON Web Tokens (JWT)

## Reglas

### SEC-PRIV-271
**DEFINICION:** Todo JWT recibido debe ser validado en su totalidad antes de extraer claims: verificar firma con la clave publica/secreto correcto, verificar `exp` (expiracion), `nbf` (not before), `iss` (issuer) y `aud` (audience).
**VALOR:** Omitir cualquier paso de validacion permite ataques especificos: sin verificar `exp`, un token antiguo filtrado es valido para siempre; sin verificar `iss`, un token emitido por un sistema diferente es aceptado; sin verificar firma, el payload puede ser modificado por un atacante.
**IMPLEMENTACION:**
```typescript
import jwt from 'jsonwebtoken';

function validateToken(token: string, expectedIssuer: string, expectedAudience: string): JwtPayload {
  return jwt.verify(token, publicKey, {
    algorithms: ['RS256'],       // Nunca aceptar 'none'
    issuer: expectedIssuer,       // Verifica iss
    audience: expectedAudience,   // Verifica aud
    clockTimestamp: Math.floor(Date.now() / 1000),
  }) as JwtPayload;
}
```
Prohibido usar `jwt.decode()` sin `jwt.verify()`. `decode` solo parsea el base64 sin validar.
**AUDITORIA:** Ralph busca usos de `jwt.decode()` sin un `jwt.verify()` correspondiente y verifica que la llamada a `verify` incluya `algorithms`, `issuer` y `audience`.

### SEC-PRIV-272
**DEFINICION:** La expiracion del access token (`exp`) debe ser de 15 minutos maximo; la expiracion del refresh token debe ser de 7 dias con rotacion en cada uso; prohibido emitir tokens sin claim `exp`.
**VALOR:** Sin `exp`, un token es valido para siempre. Con `exp` de 15 minutos, un token comprometido solo es utilizable por 15 minutos. Refresh tokens de 7 dias con rotacion balancean seguridad con experiencia de usuario.
**IMPLEMENTACION:**
```typescript
const accessToken = jwt.sign({ sub: userId, scope: 'scoring:read' }, privateKey, {
  algorithm: 'RS256',
  expiresIn: '15m',
  issuer: 'rovo-execution-guard',
  audience: 'guard-api',
});

const refreshToken = crypto.randomBytes(48).toString('hex');
// Hash and store in DB: hash(refreshToken) -> { userId, expiresAt, family }
// Rotate on each use: invalidate old, issue new from same family
```
**AUDITORIA:** Ralph verifica que todas las llamadas a `jwt.sign()` incluyan `expiresIn` con valor <= 15 minutos para access tokens y que refresh tokens usen rotacion.

### SEC-PRIV-273
**DEFINICION:** Prohibido almacenar datos sensibles (PII, secretos, permisos detallados) en el payload del JWT; el payload es base64-encoded, no encriptado, y es legible por cualquier parte que intercepte el token.
**VALOR:** El payload de un JWT puede ser decodificado con `atob()` en cualquier navegador. Almacenar emails, roles detallados, o datos personales en el JWT los expone a cualquier sistema intermediario (proxies, logs de CDN, browser extensions).
**IMPLEMENTACION:**
```typescript
// Correcto: claims minimos
jwt.sign({
  sub: 'user-uuid-1234',  // Identificador opaco
  scope: 'scoring:read',  // Permiso de alto nivel
  iat: Math.floor(Date.now() / 1000),
}, secret, { expiresIn: '15m' });

// Prohibido: datos sensibles en payload
jwt.sign({
  email: 'user@company.com',
  role: 'admin',
  salary: 95000,
  permissions: ['delete:all', 'write:all'],
}, secret, { expiresIn: '15m' });
```
**AUDITORIA:** Ralph verifica que los payloads de JWT (buscando patrones `jwt.sign`) contengan solo claims estandar (`sub`, `iss`, `aud`, `exp`, `iat`, `scope`) y un identificador opaco de usuario.

### SEC-PRIV-274
**DEFINICION:** La firma del JWT debe usar RS256 (RSA + SHA-256) o ES256 (ECDSA + SHA-256); prohibido usar HS256 (HMAC simetrico) en sistemas distribuidos donde multiples servicios verifican tokens.
**VALOR:** Con HS256, todos los servicios que verifican el token comparten el mismo secreto. Si un servicio es comprometido, el atacante puede firmar tokens para todos los servicios. Con RS256, los servicios solo tienen la clave publica; solo el auth server tiene la clave privada para firmar.
**IMPLEMENTACION:**
```typescript
// Emisor (Auth Server): firma con clave privada
const token = jwt.sign(payload, privateKey, { algorithm: 'RS256' });

// Verificador (cualquier servicio): verifica con clave publica
jwt.verify(token, publicKey, { algorithms: ['RS256'] });

// Prohibido en sistemas multi-servicio
jwt.sign(payload, sharedSecret, { algorithm: 'HS256' });
```
**AUDITORIA:** Ralph verifica que `jwt.sign()` use `algorithm: 'RS256'` o `'ES256'` y que no existan llamadas con `'HS256'` en sistemas distribuidos.

### SEC-PRIV-275
**DEFINICION:** Implementar una lista de revocacion (token blacklist) para JWTs que deben ser invalidados antes de su expiracion (logout, cambio de password, deteccion de compromiso); verificar la lista en cada validacion.
**VALOR:** Los JWTs son stateless por diseno: una vez emitidos, son validos hasta que expiran. Sin mecanismo de revocacion, un usuario que cambia su contrasena o hace logout sigue teniendo acceso durante los 15 minutos restantes del token.
**IMPLEMENTACION:**
```typescript
// Opcion 1: Redis Set con TTL igual al exp del token
async function revokeToken(jti: string, expiresInSec: number): Promise<void> {
  await redis.set(`revoked:${jti}`, '1', 'EX', expiresInSec);
}

async function isTokenRevoked(jti: string): Promise<boolean> {
  return (await redis.exists(`revoked:${jti}`)) === 1;
}

// Opcion 2: Para Forge, usar Forge SecureStorage con TTL
```
Siempre incluir claim `jti` (JWT ID) unico (UUID v4) en cada token emitido para soportar revocacion individual.
**AUDITORIA:** Ralph verifica que cada `jwt.sign()` incluya un claim `jti` con UUID y que la funcion de validacion consulte la lista de revocacion antes de aceptar el token.
