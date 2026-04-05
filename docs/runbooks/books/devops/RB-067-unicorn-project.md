# [RB-067] The Unicorn Project

> Libro: Gene Kim - The Unicorn Project: A Novel about Developers, Digital Disruption, and Thriving in the Age of Data

## Reglas

### FORGE-OPS-062
**DEFINICION:** Los desarrolladores de Rovo Execution Guard deben poder ejecutar, depurar y testear localmente todo el flujo de validacion sin necesidad de un deploy a Forge, usando mocks de las APIs externas.
**VALOR:** Si cada iteracion de desarrollo requiere un `forge deploy` para probar un cambio, el ciclo de feedback se mide en minutos en vez de segundos, reduciendo drasticamente la productividad.
**IMPLEMENTACION:** Crear un entorno de desarrollo local con: (1) mocks de `@forge/api` que simulen Forge Storage y Jira API, (2) fixtures de respuestas de Rovo y GitHub en `/tests/fixtures/`, (3) un script `npm run dev:local` que levante los triggers de forma local con datos de prueba. Documentar el setup en `/docs/development.md`.
**AUDITORIA:** Ralph verifica que el setup de desarrollo local este documentado y que los nuevos desarrolladores puedan ejecutar el primer test local en menos de 10 minutos.

### ARCH-SOLID-071
**DEFINICION:** El codigo y la configuracion de Rovo Execution Guard deben ser tratables como codigo versionado: todas las reglas de Quality Gates, thresholds, y configuraciones de proyecto deben vivir en archivos JSON/YAML versionados, no en configuraciones manuales en Forge Storage.
**VALOR:** Si un administrador cambia manualmente el threshold del Consistency Score de 80% a 60% directamente en Forge Storage sin registro, el sistema se comporta diferente sin que nadie pueda rastrear el cambio. Esto rompe la trazabilidad.
**IMPLEMENTACION:** Toda configuracion de proyecto debe cargarse desde un archivo `/config/project-rules.json` versionado en Git. Forge Storage se usa solo para cache de sesion y estado temporal. Los cambios de configuracion pasan por PR con review, igual que el codigo.
**AUDITORIA:** Ralph verifica que ninguna configuracion critica de negocio (thresholds, reglas de bloqueo, configuracion de Quality Gates) se almacene exclusivamente en Forge Storage sin respaldo en archivos versionados.

### TEST-QA-059
**DEFINICION:** Todo el tooling de desarrollo (linters, formatters, test runners, scripts de deploy) debe funcionar de forma fiable y rapida. Si una herramienta falla intermitentemente, se fixea o se reemplaza inmediatamente.
**VALOR:** Si los tests de Jest fallan de forma intermitente ("flaky tests") en el CI, los desarrolladores pierden la confianza en el pipeline y empiezan a ignorar los fallos, lo que permite que codigo defectuoso llegue a produccion.
**IMPLEMENTACION:** Identificar y eliminar tests flaky: usar `retry` de Jest solo como medida temporal, no permanente. Cada test flaky debe ser fixeado dentro de la semana o eliminado. Monitorear la tasa de fallos del CI en el Admin Dashboard.
**AUDITORIA:** Ralph rastrea la tasa de fallos intermitentes del CI y genera alertas si supera el 2% de las ejecuciones.
