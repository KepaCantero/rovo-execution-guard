# [RB-034] Snyk Security Scanning

> Fuente: Snyk Security Scanning

## Reglas

### SEC-PRIV-281
**DEFINICION:** El escaneo de vulnerabilidades de Snyk debe ejecutarse en cada pull request como un check obligatorio; el PR no puede ser mergeado si existen vulnerabilidades con severidad `high` o `critical` sin una mitigacion documentada.
**VALOR:** Las vulnerabilidades en dependencias son la causa de compromise mas comun en aplicaciones modernas. Un escaneo en PR atrapa la introduccion de una dependencia vulnerable antes de que llegue a la rama principal, donde el costo de remedicion es mayor.
**IMPLEMENTACION:** Configurar en `.github/workflows/security.yml`:
```yaml
- name: Run Snyk to check for vulnerabilities
  uses: snyk/actions/node@master
  with:
    args: --severity-threshold=high --fail-on=all
  env:
    SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
```
Configurar como required status check en la proteccion de la rama `main`.
**AUDITORIA:** Ralph verifica que el workflow de CI incluya un step de Snyk con `--severity-threshold=high` y que el status check sea obligatorio en la configuracion de proteccion de la rama main.

### SEC-PRIV-282
**DEFINICION:** Ejecutar `snyk test` y `snyk monitor` semanalmente en la rama main para detectar vulnerabilidades descubiertas en dependencias ya instaladas; el resultado de `monitor` mantiene un inventario actualizado en el dashboard de Snyk.
**VALOR:** Las vulnerabilidades se descubren en dependencias existentes despues de que fueron instaladas. Un escaneo semanal detecta CVEs nuevos en paquetes que no han cambiado de version. Sin monitoreo continuo, una dependencia segura hoy se convierte en vulnerable manana.
**IMPLEMENTACION:** Configurar un workflow programado:
```yaml
on:
  schedule:
    - cron: '0 6 * * 1' # Lunes a las 06:00 UTC

jobs:
  snyk-monitor:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - uses: snyk/actions/node@master
        with:
          command: monitor
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
```
Configurar notificaciones (Slack/email) para alertar cuando se detectan nuevas vulnerabilidades.
**AUDITORIA:** Ralph verifica que exista un workflow programado (con `schedule.cron`) que ejecute `snyk monitor` al menos una vez por semana.

### SEC-PRIV-283
**DEFINICION:** Todo CVE con severidad `critical` debe ser parchado en un maximo de 48 horas; severidad `high` en 7 dias; severidad `medium` en 30 dias; las vulnerabilidades aceptadas deben tener un risk acceptance documentado con fecha de revision.
**VALOR:** Sin SLAs de remedicion, las vulnerabilidades se acumulan indefinidamente. Los atacantes automatizan la explotacion de CVEs publicos en horas; 48 horas para critical es el estandar de la industria.
**IMPLEMENTACION:** Usar las politicas de Snyk para clasificar y asignar:
```bash
# Verificar vulnerabilidades abiertas con sus edades
snyk test --json | jq '.vulnerabilities[] | {id: .id, severity: .severity, days_open: .days}'

# Priorizar: critical > high > medium
# Para cada CVE:
# 1. Evaluar si la dependencia es explotable en nuestro contexto
# 2. Si si: parchear (npm update) o buscar alternativa
# 3. Si no: documentar razon en .snyk policy file con fecha de revision
```
**AUDITORIA:** Ralph verifica que no existan vulnerabilidades `critical` con mas de 48 horas de antiguedad ni `high` con mas de 7 dias sin un risk acceptance documentado en `.snyk` policy file.

### SEC-PRIV-284
**DEFINICION:** Mantener un archivo `.snyk` policy file versionado que documente las vulnerabilidades aceptadas con: ID del CVE, razon de aceptacion, fecha de revision, y responsable; toda exclusion debe tener una fecha de expiracion.
**VALOR:** Ignorar vulnerabilidades sin documentacion crea deuda de seguridad invisible. Una exclusion con fecha de revision asegura que la decision se reevalua periodicamente y que no se olvida.
**IMPLEMENTACION:** En `.snyk`:
```yaml
# Snyk (https://snyk.io) policy file
version: v1.25.0
ignore:
  'npm:lodash:2024-1234':
    - '*':
        reason: 'Not exploitable - we do not use the affected merge function'
        expires: '2026-07-01'
        created: '2026-04-01'
        createdBy: 'team-lead'
patch: {}
```
La fecha `expires` debe ser un maximo de 90 dias desde `created`.
**AUDITORIA:** Ralph verifica que el archivo `.snyk` exista, que cada exclusion tenga `reason`, `expires` (no mas de 90 dias), y `createdBy`.

### SEC-PRIV-285
**DEFINICION:** Prohibido instalar dependencias con licencias copyleft (GPL, AGPL, LGPL) sin aprobacion legal; configurar Snyk para bloquear PRs que introduzcan dependencias con licencias no aprobadas.
**VALOR:** Las licencias copyleft pueden obligar a liberar el codigo fuente de la aplicacion completa. En un producto comercial (Atlassian Marketplace), esto puede violar los terminos de licencia y generar responsabilidad legal.
**IMPLEMENTACION:** En `.snyk` o configuracion del proyecto:
```yaml
# snyk policy para licencias
license:
  allow:
    - MIT
    - Apache-2.0
    - BSD-2-Clause
    - BSD-3-Clause
    - ISC
    - 0BSD
    - Unlicense
  deny:
    - GPL-*
    - AGPL-*
    - LGPL-*
    - SSPL-*
```
Alternativamente, usar `snyk test --org=team-id --policy-path=./.snyk` en CI.
**AUDITORIA:** Ralph verifica que la configuracion de Snyk incluya una politica de licencias con lista de licencias permitidas y que el workflow de CI verifique licencias en cada PR.
