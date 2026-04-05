# [RB-043] Dependabot Config - Automated Dependency Updates, Security Patches

> Fuente: Dependabot Config - Automated dependency updates, security patches

## Reglas

### GIT-CI-043-01
**DEFINICION:** Dependabot debe configurarse en `.github/dependabot.yml` para escanear `npm` con frecuencia `daily`, `github-actions` con frecuencia `weekly`, y habilitar `allow: [security]` como prioridad.
**VALOR:** Las actualizaciones diarias de seguridad minimizan la ventana de exposicion a vulnerabilidades conocidas; las actualizaciones de Actions previene supply-chain attacks en el pipeline CI/CD.
**IMPLEMENTACION:** Crear `.github/dependabot.yml` con: `version: 2; updates: [{ package-ecosystem: 'npm', directory: '/', schedule: { interval: 'daily' }, open-pull-requests-limit: 10, labels: ['dependencies', 'automated'], reviewers: ['team-lead'] }, { package-ecosystem: 'github-actions', directory: '/', schedule: { interval: 'weekly' } }]`.
**AUDITORIA:** Ralph verifica que `.github/dependabot.yml` existe, que configura npm con frecuencia daily, que incluye github-actions, y que tiene labels y reviewers asignados.

### GIT-CI-043-02
**DEFINICION:** Los pull requests de Dependabot de seguridad (CVE) deben mergearse dentro de las 72 horas de apertura; los de actualizacion de version menor dentro de 7 dias; los de version mayor requieren revision manual y planificacion.
**VALOR:** Los SLAs de merge evitan acumulacion de deuda tecnica y vulnerabilidades mientras que las versiones mayores reciben la atencion que merecen por riesgo de breaking changes.
**IMPLEMENTACION:** Configurar `auto-merge` solo para patches de seguridad via GitHub: `gh api repos/:owner/:repo/pulls/:number/merge --method PUT` cuando los checks pasan. Para major: anadir `commit-message: { prefix: 'deps(major)' }` y revisar manualmente. Medir tiempo de merge con metrica `dependabot_merge_time_hours`.
**AUDITORIA:** Ralph verifica que los PRs de seguridad se mergearon dentro de las 72 horas y que existe un proceso automatizado o semi-automatizado para patches de seguridad.

### GIT-CI-043-03
**DEFINICION:** El archivo `.github/dependabot.yml` debe incluir `ignore` rules para paquetes que requieren actualizacion coordinada (ej. `@atlassian/forge-*` packages) y `versioning-strategy: increase-if-necessary` para evitar bumps innecesarios de version en lockfile.
**VALOR:** Las ignore rules previenen que Dependabot abra PRs que rompen la compatibilidad con Forge Runtime, que solo soporta versiones especificas del SDK.
**IMPLEMENTACION:** Anadir en config: `ignore: [{ dependency-name: '@atlassian/forge-*', update-types: ['version-update:semver-major'] }, { dependency-name: 'typescript', update-types: ['version-update:semver-major'] }]`. Usar `versioning-strategy: increase-if-necessary` para minimizar ruido.
**AUDITORIA:** Ralph verifica que las ignore rules cubren los paquetes criticos de Forge y TypeScript y que el `versioning-strategy` esta configurado.

### GIT-CI-043-04
**DEFINICION:** Todo PR de Dependabot debe pasar el suite completo de CI (lint, test, build) antes de ser elegible para merge; si el CI falla, el equipo debe investigar y resolver dentro del mismo SLA.
**VALOR:** Los PRs de Dependabot que rompen CI indican incompatibilidades reales que, si se mergean a ciegas, romperan la rama principal y bloquearan a todo el equipo.
**IMPLEMENTACION:** Configurar branch protection en `main` que requiera status checks: `test`, `lint`, `build`, `type-check`. Dependabot PRs automaticamente ejecutan estos checks via GitHub Actions. Si fallan, anadir label `ci-failed` y notificar al reviewer asignado.
**AUDITORIA:** Ralph verifica que los branch protection rules requieren todos los checks de CI y que ningun PR de Dependabot se mergeo sin checks verdes.

### GIT-CI-043-05
**DEFINICION:** Las dependencias con licencias copyleft (GPL, AGPL, LGPL) deben bloquearse automaticamente mediante un step en CI que ejecute `license-checker` y falle si detecta licencias no aprobadas.
**VALOR:** Las licencias copyleft pueden obligar a liberar el codigo propietario, un riesgo legal inaceptable para una app de Marketplace comercial.
**IMPLEMENTACION:** Anadir `npm install -g license-checker` en CI y step: `license-checker --summary --failOn 'GPL;AGPL;LGPL' --excludePrivatePackages`. Configurar `allowedLicenses` en `config/license-whitelist.json` con MIT, Apache-2.0, BSD-2/3-Clause, ISC, 0BSD. Documentar decisiones de licencias excepcionales en `docs/license-exceptions.md`.
**AUDITORIA:** Ralph verifica que el pipeline CI contiene el step de verificacion de licencias, que la lista de licencias bloqueadas incluye GPL/AGPL/LGPL, y que existe un whitelist de licencias aprobadas.
