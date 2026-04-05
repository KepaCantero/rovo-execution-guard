# [RB-001] Forge Manifest Reference

> Fuente: Forge Manifest Reference - https://developer.atlassian.com/platform/forge/manifest/

## Reglas

### FORGE-OPS-001

**DEFINICION:** El archivo manifest.yml debe contener exactamente las tres propiedades de nivel superior obligatorias: `app`, `modules` y `permissions`.

**VALOR:** Sin estas tres propiedades el deploy falla silenciosamente o con errores cripticos. `permissions` garantiza que la app no acceda a recursos sin autorizacion explicita (principio de menor privilegio).

**IMPLEMENTACION:**
```yaml
app:
  id: ari:cloud:ecosystem::app/your-app-id
modules:
  trigger:
    - handler: index.handler
      key: my-trigger
permissions:
  scopes:
    - read:jira-work
    - write:jira-work
  external:
    fetch:
      - https://api.github.com
```

**AUDITORIA:** Ralph verifica que el manifest.yml contenga las claves `app`, `modules` y `permissions` a nivel raiz. Si falta alguna, el check falla.

---

### FORGE-OPS-002

**DEFINICION:** El archivo manifest.yml no debe exceder 200 KB de tamano.

**VALOR:** Un manifest superior a 200 KB indica sobre-engineering: demasiados modulos, recursos inline o configuracion duplicada. El limite es硬 imposed por la plataforma Forge y el deploy sera rechazado.

**IMPLEMENTACION:** Mantener modulos granulares, externalizar configuracion a Forge Storage en lugar de embeber datos en el manifest. Usar `resources` para referencias externas, no para almacenar payloads.

**AUDITORIA:** Ralph ejecuta `wc -c < manifest.yml` y verifica que el resultado sea menor a 204800 bytes.

---

### FORGE-OPS-003

**DEFINICION:** La app no debe declarar mas de 100 modulos en el manifest.yml.

**VALOR:** El limite de 100 modulos por app es un limite de plataforma. Superarlo causa errores de deploy. Apps con mas de 100 modulos probablemente violan el principio de responsabilidad unica y deberian dividirse en multiples apps.

**IMPLEMENTACION:** Si se necesitan mas de 100 modulos, dividir la funcionalidad en apps Forge separadas comunicadas via Storage o product events. Cada app debe tener un dominio acotado.

**AUDITORIA:** Ralph cuenta las entradas bajo la clave `modules` en manifest.yml. Si el total supera 100, el check falla con un warning sugiriendo particion.

---

### FORGE-OPS-004

**DEFINICION:** La propiedad `permissions.external.fetch` debe listar unicamente los dominios que la app realmente necesita, sin wildcards.

**VALOR:** La allowlist de egress controla a que dominios puede llamar la app. Incluir dominios innecesarios amplifica la superficie de ataque. Forge bloquea toda request saliente que no este en esta lista.

**IMPLEMENTACION:**
```yaml
permissions:
  external:
    fetch:
      - https://api.github.com
      - https://your-tenant.atlassian.net
```
No usar patrones como `https://*.com` ni listar dominios de desarrollo en produccion.

**AUDITORIA:** Ralph extrae la lista `permissions.external.fetch` del manifest y verifica que cada entrada sea un dominio FQDN especifico (sin wildcards) y que sea referenciado en el codigo fuente.

---

### ARCH-SOLID-001

**DEFINICION:** El `runtime.name` en el manifest debe especificar explicitamente una version LTS de Node.js soportada (`nodejs20.x`, `nodejs22.x` o `nodejs24.x`).

**VALOR:** Forge ejecuta funciones en AWS Lambda con runtimes especificos. No declarar el runtime usa un default que puede cambiar sin aviso, rompiendo la app. La version recomendada es `nodejs22.x`.

**IMPLEMENTACION:**
```yaml
app:
  runtime:
    name: nodejs22.x
```

**AUDITORIA:** Ralph verifica que `app.runtime.name` exista y sea uno de: `nodejs20.x`, `nodejs22.x`, `nodejs24.x`. Si no existe o no es valido, el check falla.
