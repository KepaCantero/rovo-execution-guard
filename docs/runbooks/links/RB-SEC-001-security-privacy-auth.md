# [RB-SEC-001] Forge Security, Data Privacy, and GitHub Apps Auth

> Fuentes: Forge Security Guide + OWASP Top 10, Forge Data Privacy Guidelines, GitHub Apps Authentication
> Categoria: SEC-PRIV - Seguridad, Scopes, OAuth y Datos Sensibles
> Prioridad de verdad: 1. Limites Forge > 2. Seguridad (OWASP) > 3. Mantenibilidad

## Contexto de las Fuentes

### Fuente A: Forge Security Guide + OWASP Top 10
La guia de seguridad de Forge establece que las apps se ejecutan en un entorno sandboxed en infraestructura de Atlassian, sin acceso directo a base de datos, y que todas las llamadas API estan sujetas a permission scopes declarados en `manifest.yml`. OWASP Top 10 define las 10 categorias de riesgo mas criticas en aplicaciones web: Broken Access Control, Cryptographic Failures, Injection, Insecure Design, Security Misconfiguration, Vulnerable Components, Authentication Failures, Data Integrity Failures, Logging Failures, y SSRF.

### Fuente B: Forge Data Privacy Guidelines
Las directrices de privacidad de datos de Forge clasifican la informacion en niveles (Public, Internal, Sensitive, Restricted) y exigen que las apps manejen datos personales conforme a GDPR y regulaciones aplicables. Los desarrolladores son responsables de que sus apps cumplan las leyes de privacidad, incluyendo soporte para solicitudes de eliminacion de datos de usuarios.

### Fuente C: GitHub Apps Authentication
La autenticacion de GitHub Apps usa tokens de corta duracion (1 hora) obtenidos via installation access token flow, firmados con JWT RS256 usando una clave privada registrada en la app. Los permisos deben ser de minimo privilegio, las claves privadas deben rotarse periodicamente, y los secrets deben almacenarse en GitHub Secrets o un secrets manager externo.

## Reglas

### SEC-PRIV-001
**DEFINICION:** Todos los scopes de API declarados en `manifest.yml` deben corresponder exactamente a las operaciones que el modulo realiza, sin scopes sobrantes. El principio de least privilege aplica tanto a Jira scopes, Confluence scopes, como a GitHub App permissions.
**VALOR:** Un scope sobrante como `manage:jira-configuration` en una app que solo lee tickets otorga permisos destructivos innecesarios. Si la app es comprometida via SSRF (OWASP A10), el atacante puede explotar cada scope declarado. Atlassian y GitHub pueden rechazar la app del Marketplace por scopes excesivos.
**IMPLEMENTACION:** Auditar `manifest.yml` y eliminar cualquier scope que no sea utilizado directamente por un resolver, trigger o funcion de backend. Para GitHub, declarar solo los `permissions` necesarios en la instalacion de la GitHub App (por ejemplo, `checks: write`, `pull_requests: read`, `statuses: write`). Documentar cada scope con un comentario que indique cual modulo lo usa.
**AUDITORIA:** Ralph parsea `manifest.yml` y lo cruza con los imports de `@forge/api` y las llamadas a Octokit.js en el codigo. Si un scope declarado no tiene uso correspondiente en el codigo, el PR se rechaza.

### SEC-PRIV-002
**DEFINICION:** Ningun dato sensible (GitHub App private key, installation tokens, API keys, Jira webhook secrets, user PII) puede aparecer en el codigo fuente, logs estructurados, respuestas de Custom UI, ni en Forge Storage sin encriptar.
**VALOR:** El OWASP A02 (Cryptographic Failures) y las Forge Data Privacy Guidelines clasifican las claves privadas y PII como datos Restricted. Una private key de GitHub App expuesta en un log permite a un atacante generar tokens de instalacion validos y manipular status checks de cualquier PR en los repositorios donde la app esta instalada.
**IMPLEMENTACION:** Usar `forge config set` para secretos de Forge y GitHub Secrets para CI/CD. En el backend, leer secrets exclusivamente via `process.env` o `forge/storage` encriptado. En logs estructurados, sanitizar cualquier campo que contenga `token`, `key`, `secret`, `password`, `email`, o `accountId` antes de enviar a Sentry. En Custom UI, nunca exponer datos de configuracion del backend al frontend.
**AUDITORIA:** Ralph escanea todos los archivos `.ts` y `.tsx` en busca de patrones de secretos hardcodeados (strings que parezcan tokens JWT, claves PEM, URLs con query params de autenticacion). Tambien verifica que las llamadas a `console.log` o `forge/log` no incluyan campos de datos sensibles sin sanitizacion.

### SEC-PRIV-003
**DEFINICION:** La autenticacion de la GitHub App debe implementar un ciclo de vida completo de tokens: obtener un installation access token fresco antes de cada operacion, nunca cachear tokens mas alla de su expiracion de 1 hora, y rotar la private key periodicamente soportando multiples claves registradas simultaneamente.
**VALOR:** Los GitHub App installation tokens expiran en 1 hora por diseno. Si el sistema cachea un token expirado y lo usa para actualizar un status check, la llamada falla con 401 y el PR queda sin el feedback del Quality Gate. Si la private key se compromete y no hay rotacion, el atacante tiene acceso perpetuo. OWASP A07 (Identification and Authentication Failures) penaliza la falta de gestion de sesiones y tokens.
**IMPLEMENTACION:** Crear un `GitHubTokenManager` en `/src/backend/services/github/` que: (1) genere un JWT firmado con RS256 usando la private key almacenada en secrets, con `iat` actual y `exp` a +10 minutos, (2) llame a `POST /app/installations/{installation_id}/access_tokens` para obtener el token, (3) lo cachee en memoria con un TTL de 55 minutos (margen de seguridad), (4) lo renueve automaticamente cuando expire. Para rotacion, soportar que el secret contenga multiples claves separadas y probar cada una.
**AUDITORIA:** Ralph verifica que el `GitHubTokenManager` no almacene tokens en Forge Storage, que el JWT tenga `exp` no mayor a 10 minutos desde `iat`, y que exista un test de integracion que simule la expiracion del token y verifique la renovacion automatica.

### SEC-PRIV-004
**DEFINICION:** Toda entrada externa (Jira webhook payloads, GitHub webhook events, datos de formularios del Admin Dashboard, parametros de resolvers) debe ser validada y sanitizada antes de ser procesada, usando esquemas estrictos que rechacen datos inesperados.
**VALOR:** OWASP A03 (Injection) y OWASP A04 (Insecure Design) exigen validacion de entrada como linea de defensa primaria. Un payload de webhook de GitHub maliciosamente construido podria inyectar datos en el log estructurado que comprometan la integridad del audit trail, o podria explotar un fallo en el parser del evento para evadir un Quality Gate.
**IMPLEMENTACION:** Definir esquemas de validacion con Zod o tipos estrictos de TypeScript en `/src/backend/types/` para cada fuente de entrada: `JiraWebhookPayload`, `GitHubWebhookEvent`, `AdminConfigInput`, `ResolverParams`. Cada resolver y trigger debe validar su entrada contra el esquema antes de procesarla. Rechazar con error estructurado si la validacion falla, incluyendo el `executionId` en el error.
**AUDITORIA:** Ralph verifica que cada resolver y trigger en `/src/backend/resolvers/` tenga una llamada a validacion de esquema antes de la primera linea de logica de negocio, y que los tests unitarios cubran el caso de payload invalido.

### SEC-PRIV-005
**DEFINICION:** El sistema debe cumplir con las Forge Data Privacy Guidelines implementando: (1) clasificacion de datos por nivel de sensibilidad, (2) soporte para solicitudes de eliminacion de datos de usuarios, (3) minimizacion de datos almacenados en Forge Storage eliminando registros de auditoria mas antiguos de lo necesario.
**VALOR:** El no cumplimiento de GDPR y las Forge Data Privacy Guidelines puede resultar en la remocion de la app del Atlassian Marketplace y sanciones legales. Los datos de validacion de tickets (scores, inconsistencias, contextos de Rovo) pueden contener informacion personal de los autores de los tickets. Mantener estos datos indefinidamente en Forge Storage viola el principio de minimizacion de datos.
**IMPLEMENTACION:** En `/src/backend/constants/` definir un `DATA_RETENTION_POLICY` con TTLs por tipo de dato: `validationRecords: 90 dias`, `auditLogs: 180 dias`, `rovoCache: 5 minutos`. Crear un scheduled trigger en Forge que ejecute diariamente la limpieza de datos expirados. Para solicitudes de eliminacion, implementar un endpoint que reciba un `accountId` y elimine todos los registros asociados de Forge Storage.
**AUDITORIA:** Ralph verifica la existencia del scheduled trigger de limpieza, que los TTLs esten configurados, y que los tests de integracion cubran el escenario de eliminacion de datos por `accountId`.
