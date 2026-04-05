# [RB-019] GitHub Apps Authentication

> Fuente: GitHub Apps Authentication - https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app

## Reglas

### SEC-PRIV-304

**DEFINICION:** La autenticacion como GitHub App debe generar un JWT (JSON Web Token) firmado con la clave privada de la App (RSA-SHA256), con un `iat` (issued at) de 60 segundos en el pasado y una `exp` (expiration) de maximo 10 minutos. El JWT nunca debe cachearse mas de 8 minutos.

**VALOR:** GitHub rechaza JWTs con `iat` en el futuro o `exp` mayor a 10 minutos. El offset de 60 segundos para `iat` previene rechazos por clock drift entre los servidores de Forge y GitHub. Para Rovo Execution Guard, un JWT expirado significa que los status checks no se pueden publicar, dejando PRs en estado pending.

**IMPLEMENTACION:**
```typescript
import jwt from 'jsonwebtoken';

interface GitHubAppJwtPayload {
  iat: number; // issued at - 60s ago
  exp: number; // expiration - max 10min
  iss: number; // app_id
}

function generateAppJwt(appId: string, privateKey: string): string {
  const now = Math.floor(Date.now() / 1000);

  const payload: GitHubAppJwtPayload = {
    iat: now - 60,        // 60 seconds in the past
    exp: now + (10 * 60), // 10 minutes max
    iss: parseInt(appId, 10),
  };

  return jwt.sign(payload, privateKey, { algorithm: 'RS256' });
}

// Nota: el JWT se usa SOLO para obtener un installation token,
// no para llamadas directas al API.
```

**AUDITORIA:** Ralph verifica que la funcion de generacion de JWT use `iat: now - 60` y `exp: now + 600` (maximo 10 minutos). Verifica que el algoritmo sea RS256. Si el `exp` es mayor a 600 segundos o no existe offset de `iat`, el check falla.

---

### SEC-PRIV-305

**DEFINICION:** Para interactuar con recursos de un repositorio, se debe obtener un installation token via `POST /app/installations/{installation_id}/access_tokens`, usando el JWT de la App. El installation token tiene una vida util de 1 hora y debe refrescarse antes de expirar. El token debe cachearse con el campo `expires_at` de la respuesta.

**VALOR:** El JWT de la App no permite acceder a recursos del repositorio. El installation token si. Pero generar un installation token por cada llamada desperdicia rate limit y anade latencia. Cacheando el token hasta `expires_at - 5min` (margen de seguridad) reduce las llamadas de autenticacion de N por minuto a 1 cada 55 minutos.

**IMPLEMENTACION:**
```typescript
interface InstallationToken {
  token: string;
  expiresAt: Date;
  repositorySelection: string;
}

const SAFETY_MARGIN_MS = 5 * 60 * 1000; // 5 minutos antes de expirar

class GitHubAppAuth {
  private tokenCache = new Map<number, InstallationToken>();

  constructor(
    private appId: string,
    private privateKey: string,
    private octokit: Octokit,
  ) {}

  async getInstallationToken(installationId: number): Promise<string> {
    const cached = this.tokenCache.get(installationId);

    if (cached && cached.expiresAt.getTime() - SAFETY_MARGIN_MS > Date.now()) {
      return cached.token;
    }

    const appJwt = generateAppJwt(this.appId, this.privateKey);

    const response = await this.octokit.rest.apps.createInstallationAccessToken({
      installation_id: installationId,
      headers: {
        authorization: `Bearer ${appJwt}`,
      },
    });

    const token: InstallationToken = {
      token: response.data.token,
      expiresAt: new Date(response.data.expires_at),
      repositorySelection: response.data.repository_selection,
    };

    this.tokenCache.set(installationId, token);
    return token.token;
  }
}
```

**AUDITORIA:** Ralph verifica que exista un mecanismo de cacheo de installation tokens que respete el campo `expires_at`. Verifica que el token se refresque cuando queden menos de 5 minutos para expirar. Si se genera un nuevo token por cada llamada o si el cache no verifica la expiracion, el check falla.

---

### SEC-PRIV-306

**DEFINICION:** Los permisos de la GitHub App deben configurarse con el principio de menor privilegio: unicamente los permisos necesarios para la funcionalidad de Rovo Execution Guard. Los permisos requeridos son: `checks:write` (publicar status checks), `pull_requests:write` (postear comentarios), `contents:read` (leer commits), `metadata:read` (obligatorio). No solicitar permisos adicionales como `administration`, `issues` o `repository_hooks`.

**VALOR:** Cada permiso adicional incrementa la superficie de ataque. Si el token de la app se compromete, los permisos excesivos permiten al atacante hacer mas danio. Ademas, los admins de la organizacion deben aprobar cada permiso; permisos innecesarios causan rechazo de la instalacion.

**IMPLEMENTACION:**
```yaml
# En el registro de la GitHub App (configuracion web o via API):
permissions:
  checks: write           # Publicar status checks en commits
  pull_requests: write    # Postear comentarios en PRs
  contents: read          # Leer SHA de commits y archivos
  metadata: read          # Permiso base obligatorio

# Permisos sobre eventos webhook:
events:
  - pull_request
  - pull_request_review
  - status

# NO solicitar estos permisos:
# administration: write   # No es necesario
# issues: write           # La app opera sobre PRs, no issues de GitHub
# repository_hooks: write # No se gestionan webhooks programaticamente
# repository_projects: write # No se usan projects de GitHub
```

```typescript
// Verificacion en startup:
const REQUIRED_PERMISSIONS = {
  checks: 'write',
  pull_requests: 'write',
  contents: 'read',
  metadata: 'read',
} as const;

function validatePermissions(installation: { permissions: Record<string, string> }): boolean {
  for (const [perm, level] of Object.entries(REQUIRED_PERMISSIONS)) {
    if (!installation.permissions[perm]) {
      console.error(`Missing required permission: ${perm}`);
      return false;
    }
  }

  const extraPerms = Object.keys(installation.permissions)
    .filter(p => !(p in REQUIRED_PERMISSIONS));
  if (extraPerms.length > 0) {
    console.warn(`Extra permissions detected: ${extraPerms.join(', ')}`);
  }

  return true;
}
```

**AUDITORIA:** Ralph verifica que la configuracion de la GitHub App declare unicamente los permisos `checks:write`, `pull_requests:write`, `contents:read` y `metadata:read`. Si se encuentran permisos adicionales no justificados en un archivo de configuracion, emite un warning. Si faltan permisos requeridos, el check falla.

---

### SEC-PRIV-307

**DEFINICION:** La clave privada RSA de la GitHub App debe rotarse cada 90 dias maximo, almacenarse exclusivamente como secret en Forge Storage o GitHub Secrets (nunca en el codigo fuente ni en archivos `.env`), y la rotacion debe generar un nuevo par de claves de al menos 2048 bits.

**VALOR:** La clave privada permite impersonar a la GitHub App y acceder a todos los repositorios donde esta instalada. Una clave comprometida da acceso de escritura a PRs en todos los repos de la organizacion. La rotacion periodica limita la ventana de exposicion si la clave se filtra. Forge Storage con encryption at rest es el unico almacenamiento aceptable en el contexto de la plataforma.

**IMPLEMENTACION:**
```typescript
// 1. Generar nueva clave (ejecutar localmente cada 90 dias):
// ssh-keygen -t rsa -b 4096 -m PEM -f github-app-private-key.pem
// (NO commitear el archivo .pem)

// 2. Almacenar en Forge Storage (encrypted):
import { storage } from '@forge/api';

async function storePrivateKey(keyVersion: string, privateKey: string): Promise<void> {
  await storage.setSecret('github:app:private_key', {
    key: privateKey,
    version: keyVersion,
    rotatedAt: new Date().toISOString(),
  });
}

// 3. Verificar antiguedad de la clave:
async function isKeyRotationDue(): Promise<boolean> {
  const keyData = await storage.getSecret('github:app:private_key');
  if (!keyData) return true;

  const rotatedAt = new Date(keyData.rotatedAt);
  const ageDays = (Date.now() - rotatedAt.getTime()) / (1000 * 60 * 60 * 24);
  return ageDays > 90;
}

// 4. Health check que alerta sobre rotacion pendiente:
async function reportKeyAge(): Promise<{ ageDays: number; rotationDue: boolean }> {
  const keyData = await storage.getSecret('github:app:private_key');
  const ageDays = keyData
    ? (Date.now() - new Date(keyData.rotatedAt).getTime()) / (1000 * 60 * 60 * 24)
    : Infinity;

  return {
    ageDays: Math.round(ageDays),
    rotationDue: ageDays > 90,
  };
}
```

**AUDITORIA:** Ralph verifica que la clave privada no aparezca en ningun archivo del repositorio (`.pem`, `.key`, archivos de config con contenido base64). Verifica que el health check de la app reporte la antiguedad de la clave y alerte si supera 90 dias. Si se encuentra la clave en el codigo fuente, el check falla. Si la clave tiene mas de 90 dias sin rotacion, emite un warning critico.
