# REQUISITOS: pr-comment-formatter

> **Sidecar File** | Vinculado a: `src/backend/services/github/pr-comment-formatter.ts`

---

## Descripcion

Modulo de formateo de comentarios de PR para GitHub. Capa de presentacion pura que consume tipos
`EvaluationPipelineResult` y `RovoContext` para producir GitHub Flavored Markdown (GFM) para tres
tipos de comentario: passed (aprobado), failed (bloqueado) y context (informacion contextual).

Este modulo es la capa de presentacion autoritativa para comentarios de PR — NO es un duplicado
de los templates internos `buildBlockPRComment`/`buildApprovePRComment` en enforcement-actions.ts
(que usan `Record<string, unknown>` y son templates de bajo nivel). El pr-comment-formatter consume
datos tipados del dominio y produce GFM rico y configurable.

---

## Acceptance Criteria

- [ ] **AC-01**: Rich Markdown format para los tres tipos de comentario (passed, failed, context) usando GFM valido
- [ ] **AC-02**: Template de aprobacion incluye overall score y desglose por ejes (clarity, consistency, risk, documentation, technicalDebt) en tabla Markdown
- [ ] **AC-03**: Template de bloqueo incluye razones especificas con niveles de severidad (critical/warning) y sugerencias accionables en formato checklist
- [ ] **AC-04**: Template de contexto incluye links a tickets de Jira relacionados y documentacion de Confluence
- [ ] **AC-05**: Ningun dato sensible (secrets, tokens, URLs internas) expuesto en ningun output de template
- [ ] **AC-06**: Templates configurables a traves de `CommentTemplateConfig` (custom header/footer, toggle de secciones)
- [ ] **AC-07**: Test coverage > 90% para todas las funciones de formateo
- [ ] **AC-08**: Archivo `.reqs.md` sidecar producido (este archivo)

---

## Reglas del Rulebook

Las siguientes reglas del RULEBOOK.md deben respetarse en este modulo:

| ID Regla          | Categoria    | Descripcion breve                                                                |
| ----------------- | ------------ | -------------------------------------------------------------------------------- |
| [SEC-PRIV-002]    | Seguridad    | No incluir datos sensibles en comentarios de PR ni logs                          |
| [SEC-PRIV-004]    | Seguridad    | Validar toda entrada externa antes de procesar (sanitizacion de Markdown)        |
| [SEC-PRIV-005]    | Seguridad    | Cumplir Forge Data Privacy Guidelines (clasificacion, eliminacion, minimizacion) |
| [SEC-PRIV-008]    | Seguridad    | Minimizacion de datos — solo metadatos necesarios en comentarios                 |
| [SEC-PRIV-051]    | Seguridad    | Toda entrada externa debe ser validada y saneada antes de procesar               |
| [SEC-PRIV-0914]   | Seguridad    | Asumir que los datos de entrada son hostiles (XSS, injection, exfiltration)      |
| [ARCH-SOLID-058]  | Arquitectura | Zero dependencias de framework en tipos de dominio                               |
| [ARCH-SOLID-202]  | Arquitectura | Zero `any` — usar unknown, generics, discriminated unions                        |
| [ARCH-SOLID-203]  | Arquitectura | Interfaces con propiedades readonly                                              |
| [ARCH-SOLID-205]  | Arquitectura | Tipos de retorno explicitos en todas las funciones publicas                      |
| [ARCH-SOLID-232]  | Arquitectura | Named exports solo, no export default                                            |
| [ARCH-SOLID-052]  | Arquitectura | Funciones < 20 lineas de logica efectiva, max 3 niveles de anidamiento           |
| [ARCH-SOLID-053]  | Arquitectura | Tipos de error de dominio para todos los caminos de fallo                        |
| [ARCH-SOLID-054]  | Arquitectura | No duplicar logica — no reimprimir buildBlockPRComment/buildApprovePRComment     |
| [ARCH-SOLID-056]  | Arquitectura | Dependencias solo hacia adentro (presentacion -> dominio, no al reves)           |
| [ARCH-SOLID-061]  | Arquitectura | Bounded context: PR Enforcement (GitHub-side)                                    |
| [ARCH-SOLID-069]  | Arquitectura | Composicion de funciones puras, sin estado mutable compartido                    |
| [ARCH-SOLID-0842] | Arquitectura | Nombres de funciones publicas autoexplicativos                                   |
| [GH-INTEG-305]    | GitHub       | Status checks usan contexto `rovo-execution-guard/consistency`                   |
| [TEST-QA-056]     | Testing      | TDD estricto: RED -> GREEN -> REFACTOR para toda nueva funcionalidad             |
| [TEST-QA-057]     | Testing      | Cubrir casos limite: score en threshold, payloads vacios, campos faltantes       |
| [TEST-QA-051]     | Testing      | Prohibidos comentarios explicativos en codigo de produccion                      |
| [UI-ADS-0821]     | UX           | Mensajes de enforcement explican por que y que accion tomar, sin jerga           |
| [UI-ADS-0862]     | UX           | Mostrar solo info esencial; datos adicionales requieren click para expandir      |

---

## Contrato Publico (API del modulo)

### Tipos exportados

#### `CommentTemplateConfig`

```typescript
interface CommentTemplateConfig {
  readonly headerText?: string;
  readonly footerText?: string;
  readonly showScoreBreakdown: boolean;
  readonly showSuggestions: boolean;
  readonly showRelatedTickets: boolean;
  readonly showDocumentationLinks: boolean;
  readonly showQuickActions: boolean;
}
```

- **Proposito**: Configuracion del template de comentario (secciones toggle, header/footer custom)
- **AC ref**: AC-06

### Funciones exportadas

#### `formatPassedComment(result: EvaluationPipelineResult, ticketKey: string, config?: CommentTemplateConfig): string`

- **Proposito**: Generar comentario GFM cuando el PR pasa todos los quality gates
- **Pre-condiciones**: `result` con `gateResult.passed === true`, score y axes presentes
- **Post-condiciones**: String con GFM valido conteniendo: header de aprobacion, tabla de scores, badge visual, collapsible details
- **Errores**: Nunca lanza — maneja datos faltantes con fallbacks graceful (muestra "N/A")
- **AC ref**: AC-01, AC-02, AC-05

#### `formatFailedComment(result: EvaluationPipelineResult, ticketKey: string, config?: CommentTemplateConfig): string`

- **Proposito**: Generar comentario GFM cuando el PR falla los quality gates
- **Pre-condiciones**: `result` con `gateResult.passed === false`, inconsistencies con severidades
- **Post-condiciones**: String con GFM valido conteniendo: razones con severidad, checklist de sugerencias, tabla de scores, guia de resolucion
- **Errores**: Nunca lanza — maneja datos faltantes con fallbacks graceful
- **AC ref**: AC-01, AC-03, AC-05

#### `formatContextComment(context: RovoContext, ticketKey: string, config?: CommentTemplateConfig): string`

- **Proposito**: Generar comentario GFM con informacion contextual (tickets relacionados, docs, PRs similares)
- **Pre-condiciones**: `context` con `relatedTickets` y/o `documents` presentes
- **Post-condiciones**: String con GFM valido conteniendo: links a tickets Jira, links a docs Confluence, quick actions
- **Errores**: Nunca lanza — maneja datos faltantes con secciones omitidas
- **AC ref**: AC-01, AC-04, AC-05

#### `sanitizeMarkdown(input: string): string`

- **Proposito**: Sanitizar contenido dinamico antes de insertarlo en templates Markdown para prevenir inyeccion
- **Pre-condiciones**: Cualquier string
- **Post-condiciones**: String sanitizado sin Markdown injection (escapes de `|`, `[`, `]`, etc.)
- **Errores**: Nunca lanza
- **AC ref**: AC-05

---

## Dependencias (imports)

### Internas (proyecto)

- `src/backend/services/evaluation/evaluation-pipeline` -> `EvaluationPipelineResult`
- `src/backend/types/rovo-context` -> `RovoContext`, `RovoDocument`, `HistoricalDecision`
- `src/backend/types/consistency-score` -> `ConsistencyScore`, `ScoreAxes`
- `src/backend/types/quality-gate` -> `QualityGateResult`, `GateType`
- `src/backend/types/inconsistency` -> `Inconsistency`, `Severity`

### Externas (npm)

- Ninguna. Zero dependencias externas.

### NOTA: Capa de presentacion pura

- Este archivo esta en `src/backend/services/github/` -> capa de presentacion/formato
- Consume tipos del dominio (EvaluationPipelineResult, RovoContext) — no hace llamadas HTTP
- No depende de enforcement-actions.ts (no reutiliza buildBlockPRComment/buildApprovePRComment)
- Es el formatter autoritativo y tipado; los templates en enforcement-actions.ts son legacy de bajo nivel

---

## Formato GFM Requerido

Todos los templates deben producir GFM valido con:

| Elemento         | Sintaxis GFM                                   |
| ---------------- | ---------------------------------------------- | ---- | ----- | ------ | --- |
| Headers          | `##`, `###`                                    |
| Tablas de scores | `                                              | Axis | Score | Status | `   |
| Checkboxes       | `- [ ]`, `- [x]`                               |
| Collapsible      | `<details><summary>...</summary>...</details>` |
| Emojis           | `:white_check_mark:`, `:x:`, `:warning:`       |
| Separadores      | `---`                                          |

---

## Seguridad: Sanitizacion

### Datos que NUNCA deben aparecer en output

- GitHub App private keys, installation tokens, API keys
- Jira webhook secrets
- URLs internas del sistema ( Forge runtime URLs, internal hostnames)
- Configuracion del sistema (thresholds internos, storage keys)
- User PII (accountIds, emails)

### Sanitizacion requerida

- Escapar caracteres especiales de Markdown en contenido dinamico: `|`, `[`, `]`, `<`, `>`, `` ` ``
- Validar que URLs generadas usen HTTPS y apunten a dominios confiables (atlassian.net, github.com)
- Truncar strings largos a max 500 caracteres para evitar comentarios desmesurados
- Si `ticketKey` no coincide patron `[A-Z]+-[0-9]+`, sanitizar o mostrar como texto plano

---

## Estrategia de Test

### Unit Tests (`tests/unit/services/github/pr-comment-formatter.spec.ts`)

| Test Category | Test Case                                                                                 | AC cubierto  | Regla cubierta              |
| ------------- | ----------------------------------------------------------------------------------------- | ------------ | --------------------------- |
| Happy path    | formatPassedComment produce GFM valido con score table                                    | AC-01, AC-02 | ARCH-SOLID-069              |
| Happy path    | formatFailedComment produce GFM valido con reasons + suggestions                          | AC-01, AC-03 | ARCH-SOLID-069              |
| Happy path    | formatContextComment produce GFM valido con ticket links                                  | AC-01, AC-04 | ARCH-SOLID-069              |
| Score table   | Tabla incluye overall + 5 axes (clarity, consistency, risk, documentation, technicalDebt) | AC-02        | ARCH-SOLID-061              |
| Severity      | Reasons mostradas con emoji de severidad correcto (critical/warning)                      | AC-03        | UI-ADS-0821                 |
| Suggestions   | Sugerencias formateadas como checklist `- [ ]`                                            | AC-03        | UI-ADS-0821                 |
| Config        | CommentTemplateConfig.headerText aparece en output                                        | AC-06        | -                           |
| Config        | CommentTemplateConfig.showScoreBreakdown = false oculta tabla                             | AC-06        | -                           |
| Config        | CommentTemplateConfig.showSuggestions = false oculta suggestions                          | AC-06        | -                           |
| Config        | CommentTemplateConfig.footerText aparece en output                                        | AC-06        | -                           |
| Sanitization  | sanitizeMarkdown escapa pipes, brackets, backticks                                        | AC-05        | SEC-PRIV-051, SEC-PRIV-0914 |
| Sanitization  | Ningun token/secret/URL interna en output de ningun template                              | AC-05        | SEC-PRIV-002                |
| Sanitization  | URLs generadas usan HTTPS                                                                 | AC-05        | SEC-PRIV-004                |
| Edge cases    | Score con overall=0 produce output valido                                                 | AC-01        | TEST-QA-057                 |
| Edge cases    | Inconsistencies vacias produce output valido (sin suggestions)                            | AC-01        | TEST-QA-057                 |
| Edge cases    | RovoContext con documents=[] y relatedTickets=[]                                          | AC-04        | TEST-QA-057                 |
| Edge cases    | Ticket key vacio o malformado sanitizado gracefully                                       | AC-05        | SEC-PRIV-004                |
| Snapshot      | Snapshot de formatPassedComment output completo                                           | AC-01        | -                           |
| Snapshot      | Snapshot de formatFailedComment output completo                                           | AC-01        | -                           |
| Snapshot      | Snapshot de formatContextComment output completo                                          | AC-01        | -                           |
| No any        | grep -r "any" en el archivo retorna cero resultados                                       | AC-07        | ARCH-SOLID-202              |

---

## Historial de Cambios

| Fecha | Tarea Ralph | Cambio         |
| ----- | ----------- | -------------- |
|       | RTASK-020   | Creado inicial |
