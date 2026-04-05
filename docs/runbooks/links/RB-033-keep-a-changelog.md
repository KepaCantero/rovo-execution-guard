# [RB-033] Keep A Changelog

> Fuente: Keep A Changelog

## Reglas

### GIT-CI-231
**DEFINICION:** El archivo `CHANGELOG.md` debe existir en la raiz del proyecto y mantenerse actualizado con cada release; esta prohibido generar changelogs automaticamente sin revision humana.
**VALOR:** Un changelog curado comunica el impacto real de los cambios a los consumidores de la API/app. Los changelogs generados automaticamente a partir de commits son ruidosos (incluyen chores, refactorings internos) y no explican el "por que" de los cambios.
**IMPLEMENTACION:** Estructura del archivo:
```markdown
# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]
### Added
- New scoring algorithm for documentation coverage (RG-456)

## [1.2.0] - 2026-04-01
### Added
- Quality gate integration with GitHub PR status checks
### Fixed
- Scoring engine now correctly handles empty Jira descriptions
```
**AUDITORIA:** Ralph verifica que `CHANGELOG.md` exista en la raiz del repositorio y que contenga al menos las secciones `## [Unreleased]` y una version liberada.

### GIT-CI-232
**DEFINICION:** Cada entrada en el changelog debe clasificarse bajo una de estas secciones: `Added` (nuevas funcionalidades), `Changed` (cambios en comportamiento existente), `Deprecated` (funcionalidades que seran removidas), `Removed` (funcionalidades removidas), `Fixed` (correcciones de bugs), `Security` (vulnerabilidades corregidas).
**VALOR:** Las secciones estandarizadas permiten a los consumidores escanear rapidamente el tipo de cambio que les afecta. Un consumidor puede saltar directamente a `Breaking` o `Security` sin leer toda la lista.
**IMPLEMENTACION:** Cada entry en el changelog debe iniciar con una de las seis categorias. El orden de las secciones debe ser consistente: Added, Changed, Deprecated, Removed, Fixed, Security. Las entradas deben ser comprensibles sin leer el commit original.
```markdown
## [1.1.0] - 2026-03-15
### Added
- Support for custom quality gate thresholds per project (RG-789)
### Fixed
- Webhook handler now retries on transient Jira API 503 errors
### Security
- Updated lodash dependency to patch prototype pollution (CVE-2026-1234)
```
**AUDITORIA:** Ralph verifica que las secciones en cada version del changelog usen exclusivamente los 6 nombres permitidos y que no existan secciones personalizadas como `Updates` o `Misc`.

### GIT-CI-233
**DEFINICION:** Cada version liberada en el changelog debe seguir el formato `[X.Y.Z] - YYYY-MM-DD` donde X.Y.Z es semantic version y la fecha esta en ISO 8601; la version `Unreleased` no lleva fecha.
**VALOR:** El formato consistente permite a herramientas automatizadas (semantic-release, standard-version) parsear el changelog. La fecha ISO 8601 evita ambiguedad entre formatos regionales (MM/DD vs DD/MM).
**IMPLEMENTACION:**
```markdown
## [Unreleased]
### Added
- Feature in development

## [2.0.0] - 2026-04-01
### Changed
- Breaking: API response format changed (see migration guide)
```
Las versiones deben aparecer en orden descendente (la mas reciente primero). Cada version debe tener un enlace al diff en GitHub si el formato extended se usa.
**AUDITORIA:** Ralph verifica que las versiones liberadas sigan el patron `## [X.Y.Z] - YYYY-MM-DD` y que las fechas sean validas y esten en orden descendente.

### GIT-CI-234
**DEFINICION:** La seccion `[Unreleased]` debe acumular todos los cambios desde la ultima version liberada; al momento de release, el contenido de `[Unreleased]` se mueve a la nueva version con su fecha.
**VALOR:** Mantener `[Unreleased]` permite que los desarrolladores documenten cambios en el momento en que los hacen (no semanas despues), y que los consumidores del main branch puedan ver que viene en la proxima version.
**IMPLEMENTACION:** Al hacer un release:
1. Renombrar `## [Unreleased]` a `## [X.Y.Z] - YYYY-MM-DD`
2. Agregar una nueva seccion `## [Unreleased]` vacia al inicio
3. Commit + tag con la version
```bash
# Flujo de release
# 1. Mover contenido de [Unreleased] a nueva version
# 2. Crear nueva seccion [Unreleased] vacia
# 3. git commit -m "chore(release): 1.3.0"
# 4. git tag -a v1.3.0 -m "Release 1.3.0"
```
**AUDITORIA:** Ralph verifica que la seccion `## [Unreleased]` exista y sea la primera seccion de versiones, y que las versiones liberadas no contengan cambios futuros (fechas posteriores a hoy).

### GIT-CI-235
**DEFINICION:** Prohibido incluir entradas en el changelog que sean exclusivamente internas y sin impacto para consumidores: refactorings sin cambio de comportamiento, actualizaciones de herramientas de desarrollo, cambios en CI/CD que no afectan la API.
**VALOR:** Un changelog es un documento de comunicacion con consumidores, no un historial de git. Incluir ruido interno obliga a los lectores a filtrar manualmente, reduciendo la efectividad del changelog como herramienta de comunicacion.
**IMPLEMENTACION:** Preguntarse antes de agregar una entrada: "Si yo fuera un usuario de esta API, cambiaria mi comportamiento al leer esto?" Si la respuesta es no, no incluirlo. Excepcion: cambios de seguridad (CVE patches) siempre se incluyen incluso si son internos.
```markdown
# Incluir
### Fixed
- Scoring engine now correctly handles edge case with empty ticket lists

# No incluir
### Changed
- Refactored scoring engine to use strategy pattern (internal change)
- Updated ESLint config to enforce stricter rules
```
**AUDITORIA:** Ralph revisa las entradas del changelog y reporta las que contengan palabras como "refactor", "restructure", "internal", "tooling" sin un impacto observable para consumidores.
