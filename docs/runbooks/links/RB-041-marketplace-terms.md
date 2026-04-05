# [RB-041] Atlassian Marketplace Terms - Distribution Rules, Licensing

> Fuente: Atlassian Marketplace Terms - Distribution rules, licensing

## Reglas

### SEC-PRIV-041-01
**DEFINICION:** El app descriptor (`manifest.yml`) debe declarar todos los scopes de API utilizados bajo el principio de minimo privilegio; ningun scope puede solicitarse sin evidencia de uso directo en el codigo.
**VALOR:** Los scopes excesivos violan las politicas de Marketplace y representan un riesgo de seguridad que puede resultar en rechazo de la app o revocacion de acceso.
**IMPLEMENTACION:** Auditar cada scope en `permissions.scopes` del manifest contra el codigo: si `read:jira-work` esta declarado, debe existir al menos una llamada a la API de Jira que lo requiera. Eliminar scopes no utilizados antes de cada release. Documentar la justificacion de cada scope en `docs/scopes-justification.md`.
**AUDITORIA:** Ralph verifica que cada scope en el manifest tiene al menos una referencia de uso en el codigo fuente y que existe el documento de justificacion de scopes.

### SEC-PRIV-041-02
**DEFINICION:** Ningun dato personal identificable (PII) de usuarios de Atlassian puede almacenarse en Forge Storage sin consentimiento explicito y sin aplicar ofuscacion o hash antes de la persistencia.
**VALOR:** El almacenamiento de PII sin proteccion viola las condiciones de Marketplace y regulaciones de privacidad (GDPR), pudiendo resultar en penalizaciones legales y expulsion del Marketplace.
**IMPLEMENTACION:** Implementar `sanitizeForStorage(data: UserData): StorageData` que reemplaze emails con hashes SHA-256, elimine campos de nombre completo, y solo conserve `accountId` como identificador. Nunca almacenar tokens OAuth o credenciales en Forge Storage; usar Forge Secret Storage exclusivamente.
**AUDITORIA:** Ralph escanea todas las escrituras a Forge Storage y verifica que no contienen campos de PII sin ofuscar (email, displayName, avatarUrl sin hash).

### SEC-PRIV-041-03
**DEFINICION:** La licencia de la app debe validarse via Forge Licensing API en cada invocation del handler principal; si la licencia es invalida o expiro, el handler debe retornar un mensaje de upgrade en vez de ejecutar la logica de negocio.
**VALOR:** La validacion de licencia en cada invocation previene uso no autorizado y cumple con los requisitos de monetizacion de Atlassian Marketplace.
**IMPLEMENTACION:** Anadir `checkLicense()` como primer paso en cada handler: `const license = await api.asApp().requestAtlassian(route`/api/v2/license/${context.license?.entitlementId}`); if (!license.valid) { return { body: { message: 'License expired. Please renew via Atlassian Marketplace.' }, statusCode: 403 } }`.
**AUDITORIA:** Ralph verifica que cada handler principal invoca `checkLicense()` antes de ejecutar logica de negocio y que retorna 403 con mensaje descriptivo cuando la licencia es invalida.

### SEC-PRIV-041-04
**DEFINICION:** La app debe cumplir con los requisitos de Data Residency de Atlassian: si el tenant tiene data residency configurado, los datos no deben salir de la region especificada, verificable mediante `context.region`.
**VALOR:** El incumplimiento de data residency puede resultar en violaciones regulatorias y rechazo de la app del Marketplace.
**IMPLEMENTACION:** Leer `context.region` en cada invocation y pasarlo a los adaptadores. Si un adaptador externo (ej. Datadog) esta fuera de la region del tenant, anonimizar o no enviar datos de usuario. Documentar las regiones soportadas en el manifest y en el listing del Marketplace.
**AUDITORIA:** Ralph verifica que el codigo consulta `context.region` y que los adaptadores respetan la restriccion de no enviar datos fuera de la region del tenant.

### SEC-PRIV-041-05
**DEFINICION:** El EULA y la politica de privacidad deben estar disponibles como URLs publicas accesibles y referenciadas en el `manifest.yml` antes de cada envio a Marketplace Review.
**VALOR:** Sin EULA y politica de privacidad accesibles, la app no puede pasar el proceso de Marketplace Review y no sera publicable.
**IMPLEMENTACION:** Hospedar `EULA.md` y `PRIVACY-POLICY.md` en el repositorio y publicarlos via GitHub Pages o URL publica. Referenciar en `manifest.yml`: `links: { eula: 'https://org.github.io/rovo-execution-guard/EULA', privacy: 'https://org.github.io/rovo-execution-guard/PRIVACY-POLICY' }`. Validar que ambas URLs retornan 200 en el pipeline CI.
**AUDITORIA:** Ralph verifica que `manifest.yml` contiene las URLs de EULA y privacy policy y que un check en CI valida que ambas URLs responden con HTTP 200.
