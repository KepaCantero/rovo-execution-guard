# [RB-012] Forge Tunneling

> Fuente: Forge Tunneling - https://developer.atlassian.com/platform/forge/tunneling/

## Reglas

### FORGE-OPS-018

**DEFINICION:** El tunneling de Forge (`forge tunnel`) solo debe usarse para desarrollo local; nunca para produccion ni para tests de integracion que validen limits.

**VALOR:** Forge Tunnel usa Cloudflare para crear un tunnel entre la maquina local y la plataforma Forge. Los timeouts de tunnel son mayores que en produccion (las funciones pueden tardar mas sin ser terminadas). Las llamadas a Storage y APIs atraviesan la red del desarrollador, introduciendo latencia variable. Las pruebas en tunnel no reflejan el comportamiento real en produccion.

**IMPLEMENTACION:**
```bash
# Desarrollo local - OK:
forge tunnel

# Tests de integracion - usar deploy real:
forge deploy --environment staging
forge install --environment staging

# Verificar que no se ejecutan tests contra tunnel:
# En CI, el step de test usa `forge deploy` a environment de staging
```

**AUDITORIA:** Ralph verifica que los scripts de CI (`scripts/test.sh`, `.github/workflows/*.yml`) no usen `forge tunnel`. Verifica que los test scripts de integracion usen un environment real (`staging` o `development` deployado).

---

### TEST-QA-001

**DEFINICION:** Los cambios en el manifest.yml requieren redeploy completo (`forge deploy`); el tunnel no aplica cambios de manifest en caliente.

**VALOR:** Forge Tunnel solo sincroniza cambios en el codigo fuente (handlers, UI). Los cambios en manifest (nuevos modulos, permisos, resources) requieren un deploy completo. Probar cambios de manifest via tunnel da la falsa impresion de que funcionan cuando en realidad el manifest anterior sigue activo.

**IMPLEMENTACION:**
```bash
# Despues de cualquier cambio en manifest.yml:
forge deploy --environment development

# Solo cambios en codigo fuente se reflejan en tunnel:
# - Modificaciones en src/**/*.ts
# - Cambios en UI components
# - Cambios en static resources de Custom UI
```

**AUDITORIA:** Ralph verifica que la documentacion de desarrollo o los CONTRIBUTING.md del proyecto documenten que cambios en manifest requieren redeploy. Si existe un script de setup de desarrollo, verifica que incluya un paso de `forge deploy`.

---

### FORGE-OPS-019

**DEFINICION:** El entorno de desarrollo via tunnel debe usar las mismas variables de entorno y configuracion que staging/produccion, gestionadas via `forge variables:set`.

**VALOR:** Las diferencias de configuracion entre entornos causan bugs que solo aparecen en produccion. Las variables de entorno en Forge se almacenan por environment y no se sincronizan. Si un desarrollador usa un endpoint de API diferente en su tunnel, el comportamiento no es representativo.

**IMPLEMENTACION:**
```bash
# Configurar variables por environment:
forge variables:set --environment development GITHUB_APP_ID my-app-id
forge variables:set --environment staging GITHUB_APP_ID my-staging-app-id
forge variables:set --environment production GITHUB_APP_ID my-prod-app-id

# Verificar que todos los environments tienen las mismas keys:
forge variables:list --environment development
forge variables:list --environment staging
forge variables:list --environment production
```

**AUDITORIA:** Ralph verifica que exista un script o documentacion que liste las variables de entorno requeridas. Si el codigo usa `process.env.VARIABLE` que no esta configurada en algun environment, el check emite un warning.

---

### TEST-QA-002

**DEFINICION:** Los tests de integracion que validen timeouts, throttling o limits de plataforma deben ejecutarse en un environment deployado, nunca contra tunnel local.

**VALOR:** Los limites de ejecucion (10 segundos), throttling de Storage y rate limits se comportan diferente en tunnel vs produccion. Los tests de resiliencia ejecutados en tunnel pueden pasar cuando deberian fallar, dando una falsa sensacion de seguridad.

**IMPLEMENTACION:**
```yaml
# .github/workflows/integration-tests.yml:
jobs:
  integration-tests:
    steps:
      - name: Deploy to staging
        run: forge deploy --environment staging
      - name: Run integration tests against staging
        run: npm run test:integration -- --base-url=https://staging.example.com
        env:
          FORGE_ENV: staging
```

**AUDITORIA:** Ralph verifica que los tests etiquetados como `@integration` o en archivos `*.integration.test.ts` no usen URLs de tunnel (`localhost` o `*.trycloudflare.com`). Si se encuentran, el check falla.
