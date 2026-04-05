# TASK-020: Presentation Layer - GitHub PR Comments (Automated)

## Objetivo
Implementar el sistema de comentarios automatizados en GitHub PRs que inyecta contexto validado, scores y estado de los Quality Gates.

## Contexto
Los comentarios en PRs son la interfaz visible para los desarrolladores que trabajan en GitHub. Deben ser informativos, claros y accionables.

## Especificacion Tecnica

### Ubicacion
Parte del enforcement en `src/backend/services/github/` + templates

### Templates de comentarios

#### Comment: Gate 2 Passed (PR puede mergear)
```markdown
## Rovo Execution Guard - Quality Check Passed

**Ticket:** [REG-123](link-to-jira)
**Score:** 92/100
**Gate:** Execution

| Axis | Score |
|------|-------|
| Clarity | 95 |
| Consistency | 88 |
| Risk | 90 |
| Documentation | 95 |
| Technical Debt | 92 |

No inconsistencies detected. This PR is clear to merge.
```

#### Comment: Gate 2 Failed (PR bloqueado)
```markdown
## Rovo Execution Guard - Quality Check Failed

**Ticket:** [REG-123](link-to-jira)
**Score:** 65/100
**Gate:** Execution

### Blocked Reasons:
1. **[CRITICAL]** Missing acceptance criteria in ticket
2. **[WARNING]** Documentation in Confluence is outdated (last updated 6 months ago)

### Suggestions:
- Add acceptance criteria to the ticket description
- Update the architecture doc before proceeding

Resolve these issues in the Jira ticket to unblock this PR.
```

#### Comment: Context Injection (informative)
```markdown
## Context from Rovo

This PR is linked to [REG-123] which relates to:
- **Related tickets:** REG-100, REG-110
- **Documentation:** [Architecture Decisions](link)
- **Last similar PR:** #456 (merged 2 weeks ago)

Make sure this PR aligns with the decisions documented above.
```

### Funciones
- `formatPassedComment(result: QualityGateResult, ticketKey: string): string`
- `formatFailedComment(result: QualityGateResult, ticketKey: string): string`
- `formatContextComment(context: RovoContext, ticketKey: string): string`

## Acceptance Criteria
- [ ] AC-01: Comentarios con formato Markdown rico y legible
- [ ] AC-02: Template de aprobacion incluye score y ejes
- [ ] AC-03: Template de bloqueo incluye razones y sugerencias
- [ ] AC-04: Template de contexto incluye links a Jira y Confluence
- [ ] AC-05: No expone datos sensibles en comentarios
- [ ] AC-06: Templates configurables
- [ ] AC-07: Tests unitarios de formateo > 90%
- [ ] AC-08: Archivo `.reqs.md` sidecar creado

## Reglas del Rulebook
- **[GH-INTEG-001]**: Comentarios via GitHub API
- **[SEC-PRIV-005]**: No exponer datos sensibles

## Estrategia de Test
- **Unit**: Verificar output de cada template con datos mock
- **Integration**: Publicar comentario en PR de test (mock)
- **E2E**: Verificar comentario real en PR de GitHub

## Dependencias
- TASK-011 (GitHub adapter)
- TASK-008 (Quality Gate results)

## Estado: PENDIENTE
