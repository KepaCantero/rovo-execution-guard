# Rovo Execution Guard - Rulebook Consolidado

> Single Source of Truth para auditar e implementar codigo.
> Extraido de 50 links tecnicos + 50 libros de ingenieria.
> Ultima actualizacion: 2026-04-04

---

## Prioridad de Verdad (Resolucion de Conflictos)

1. **Prioridad 1**: Limites y documentacion oficial de Atlassian Forge
2. **Prioridad 2**: Seguridad (OWASP) y APIs de GitHub
3. **Prioridad 3**: Principios de libros de Arquitectura/Clean Code

---

## Formato de Regla

```
ID: [CATEGORIA]-[CORRELATIVO]
DEFINICION: Descripcion tecnica breve de la restriccion.
VALOR: Por que esta regla es AAA.
IMPLEMENTACION: Como escribir el codigo para cumplirla.
AUDITORIA: El check especifico que Ralph debe hacer.
```

---

## Tabla de Contenidos

1. [FORGE-OPS - Limites de Ejecucion, Memoria, Storage y Runtime](#forge-ops)
2. [SEC-PRIV - Seguridad, Scopes, OAuth y Datos Sensibles](#sec-priv)
3. [ARCH-SOLID - Estructura de Capas, Patrones y Desacoplamiento](#arch-solid)
4. [TEST-QA - Cobertura, Tests y Estrategias de Fallo](#test-qa)
5. [GIT-CI - Ramas, Commits y Automatizacion de Despliegue](#git-ci)
6. [UI-ADS - Atlassian Design System y UX](#ui-ads)
7. [ROVO-INTEG - Logica de Contexto, Latencia y Uso de IA](#rovo-integ)
8. [GH-INTEG - GitHub API, Webhooks y Status Checks](#gh-integ)
9. [Indice de Conflictos Resueltos](#conflictos)

---

<a id="forge-ops"></a>
## [FORGE-OPS] Limites de Ejecucion, Memoria, Storage y Runtime

> **Links:** Forge Manifest Reference, Platform Limits, Forge Runtime Reference, Forge Storage API, Forge Tunneling, Node.js Best Practices, Twelve-Factor App, CloudEvents Spec
>
> **Libros:** The Pragmatic Programmer (Hunt & Thomas), Clean Architecture (Robert C. Martin), Designing Data-Intensive Applications (Kleppmann), Continuous Delivery (Humble & Farley), Site Reliability Engineering (Murphy et al.), Accelerate (Forsgren), Building Microservices (Sam Newman), The Phoenix Project (Gene Kim), The Unicorn Project (Gene Kim), The DevOps Handbook (Gene Kim & Debois), Peopleware (DeMarco)

---

<a id="sec-priv"></a>
## [SEC-PRIV] Seguridad, Scopes, OAuth y Datos Sensibles

> **Links:** Forge Security Guide, OWASP Top 10, OAuth 2.0 Simplified, JSON Web Tokens (JWT), Data Privacy Guidelines, GitHub Apps Authentication, Snyk Security Scanning, Atlassian Marketplace Terms, HTTP Status Codes, OpenAPI Specification
>
> **Libros:** Clean Code (Robert C. Martin), The Clean Coder (Robert C. Martin), The Pragmatic Programmer (Hunt & Thomas), The Mythical Man-Month (Fred Brooks), Code Complete (Steve McConnell), The Hard Thing About Hard Things (Ben Horowitz)

---

<a id="arch-solid"></a>
## [ARCH-SOLID] Estructura de Capas, Patrones y Desacoplamiento

> **Links:** SOLID Principles (DigitalOcean), Twelve-Factor App, Node.js Best Practices, Airbnb JavaScript Style Guide, OpenAPI Specification, REST API Design (Microsoft), Forge GraphQL API, Confluence Cloud REST API v2
>
> **Libros:** Clean Architecture (Robert C. Martin), Clean Code (Robert C. Martin), The Pragmatic Programmer (Hunt & Thomas), Domain-Driven Design (Eric Evans), Refactoring (Martin Fowler), Code Complete (Steve McConnell), Designing Data-Intensive Applications (Kleppmann), Patterns of Enterprise Application Architecture (Martin Fowler), Building Microservices (Sam Newman), Structure and Interpretation of Computer Programs (SICP), Working Effectively with Legacy Code (Michael Feathers), Hackers & Painters (Paul Graham), The Art of Computer Programming (Donald Knuth), Essentialism (Greg McKeown), Antifragile (Nassim Taleb)

---

<a id="test-qa"></a>
## [TEST-QA] Cobertura, Tests y Estrategias de Fallo

> **Links:** Jest Testing Framework, Playwright E2E Docs, TypeScript Handbook, Snyk Security Scanning, Dependabot Config, Datadog API Docs
>
> **Libros:** Test Driven Development: By Example (Kent Beck), Continuous Delivery (Humble & Farley), Site Reliability Engineering (Murphy et al.), Clean Code (Robert C. Martin), Code Complete (Steve McConnell), Accelerate (Nicole Forsgren), The DevOps Handbook (Gene Kim & Debois), Introduction to Algorithms (CLRS)

---

<a id="git-ci"></a>
## [GIT-CI] Ramas, Commits y Automatizacion de Despliegue

> **Links:** Conventional Commits, Semantic Versioning (SemVer), GitFlow Workflow, Husky Git Hooks, Commitlint, GitHub Actions Documentation, Prettier Docs, Keep A Changelog, Dependabot Config, Atlassian Developer Community
>
> **Libros:** Continuous Delivery (Humble & Farley), The Phoenix Project (Gene Kim), The Unicorn Project (Gene Kim), The DevOps Handbook (Gene Kim & Debois), Accelerate (Nicole Forsgren), Team Topologies (Skelton & Pais), Extreme Ownership (Jocko Willink), High Output Management (Andrew Grove), Atomic Habits (James Clear), Deep Work (Cal Newport), The Lean Startup (Eric Ries)

---

<a id="ui-ads"></a>
## [UI-ADS] Atlassian Design System y UX

> **Links:** Atlassian Design System (ADS), Forge UI Kit Components, Forge Custom UI, React 18 Best Practices, Forge Manifest Reference, Prettier Docs, Markdown Guide
>
> **Libros:** Clean Code (Robert C. Martin), The Pragmatic Programmer (Hunt & Thomas), Designing Data-Intensive Applications (Kleppmann), Eloquent JavaScript (Marijn Haverbeke), Algorithms to Live By (Brian Christian), The Soul of a New Machine (Tracy Kidder)

---

<a id="rovo-integ"></a>
## [ROVO-INTEG] Logica de Contexto, Latencia y Uso de IA

> **Links:** Atlassian Rovo Documentation, Forge Runtime Reference, Platform Limits, Jira Cloud REST API v3, Forge Storage API, Confluence Cloud REST API v2, CloudEvents Spec, Datadog API Docs
>
> **Libros:** Co-Intelligence (Ethan Mollick), Human Compatible (Stuart Russell), Artificial Intelligence: A Modern Approach (Russell & Norvig), Life 3.0 (Max Tegmark), Superintelligence (Nick Bostrom), Thinking, Fast and Slow (Daniel Kahneman), The Master Algorithm (Pedro Domingos), Godel, Escher, Bach (Douglas Hofstadter), The Pragmatic Programmer (Hunt & Thomas), Designing Data-Intensive Applications (Kleppmann)

---

<a id="gh-integ"></a>
## [GH-INTEG] GitHub API, Webhooks y Status Checks

> **Links:** GitHub REST API Docs, GitHub Webhooks Guide, GitHub Actions Documentation, GitHub Apps Authentication, Octokit.js, OpenAPI Specification, HTTP Status Codes, REST API Design (Microsoft)
>
> **Libros:** Building Microservices (Sam Newman), Designing Data-Intensive Applications (Kleppmann), The Phoenix Project (Gene Kim), The DevOps Handbook (Gene Kim & Debois), Site Reliability Engineering (Murphy et al.), Continuous Delivery (Humble & Farley), Team Topologies (Skelton & Pais), Patterns of Enterprise Application Architecture (Martin Fowler), The Pragmatic Programmer (Hunt & Thomas), Antifragile (Nassim Taleb)

---

<a id="conflictos"></a>
## Indice de Conflictos Resueltos

> Documentacion de reglas descartadas o fusionadas por contradiccion.

| Conflicto | Reglas Involucradas | Resolucion | Justificacion |
|-----------|-------------------|------------|---------------|
| *(Se completara tras la deduplicacion)* | | | |

---

## Estadisticas del Rulebook

| Categoria | Reglas | Estado |
|-----------|--------|--------|
| FORGE-OPS | 0 | Pendiente |
| SEC-PRIV | 0 | Pendiente |
| ARCH-SOLID | 0 | Pendiente |
| TEST-QA | 0 | Pendiente |
| GIT-CI | 0 | Pendiente |
| UI-ADS | 0 | Pendiente |
| ROVO-INTEG | 0 | Pendiente |
| GH-INTEG | 0 | Pendiente |
| **TOTAL** | **0** | **En progreso** |
