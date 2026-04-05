# TASK-030: Documentation - READMEs and Marketplace Plan

## Objetivo
Crear la documentacion completa del proyecto: README tecnico, README de producto y plan de publicacion en Atlassian Marketplace.

## Contexto
La documentacion es la puerta de entrada para desarrolladores y compradores potenciales. Debe ser clara, completa y accionable.

## Especificacion Tecnica

### 1. README.md (Tecnico)

#### Secciones
1. **Overview**: Que es Rovo Execution Guard, que problema resuelve
2. **Architecture**: Diagrama de capas (Domain -> Integration -> Orchestration -> Presentation)
3. **Prerequisites**:
   - Node.js 22.x (via nvm)
   - Forge CLI (`npm install -g @forge/cli`)
   - Cuenta de Atlassian con Forge habilitado
   - GitHub App con permisos configurados
4. **Quick Start**:
   - `nvm use 22`
   - `npm install`
   - `forge login`
   - `forge register`
   - `forge deploy -e development`
5. **Project Structure**: Arbol de carpetas con explicacion
6. **Configuration**: Como configurar ProjectConfig, thresholds, gates
7. **GitHub App Setup**: Paso a paso para configurar la GitHub App y webhooks
8. **Development**:
   - `npm run dev` (forge tunnel)
   - `npm run test`
   - `npm run lint`
9. **Deployment**: Flujo de entornos (dev -> staging -> production)
10. **Troubleshooting**: Problemas comunes y soluciones

### 2. README-product.md (Producto)

#### Secciones
1. **Value Proposition**: Reduce retrabajo, elimina tickets mal definidos, bloquea PRs inconsistentes
2. **Key Features**:
   - Consistency Score (Spider Chart)
   - 3 Quality Gates (Definition, Execution, Delivery)
   - Jira <-> GitHub bidirectional enforcement
   - Configurable per-project rules
   - Audit trail
3. **User Flows**: Diagramas de como interactuan los usuarios
4. **ROI Calculator**: Estimacion de ahorro por tickets bloqueados
5. **Screenshots**: Mocks del Issue Panel y Admin Dashboard
6. **Pricing**: Plan Free (5 proyectos) / Pro (ilimitado)

### 3. Plan de Marketplace

#### Requisitos de Atlassian Marketplace
- App CloudFortify compatible (security review)
- Data Privacy compliance
- Escalability tested
- Support channel definido

#### Estrategia
- **Free Tier**: Hasta 5 proyectos, Rovo basic, sin GitHub integration
- **Pro Tier**: Proyectos ilimitados, Rovo completo, GitHub integration, admin dashboard
- **Enterprise**: SSO, custom rules, priority support

#### Checklist de publicacion
- [ ] Security review aprobada por Atlassian
- [ ] Privacy policy publicada
- [ ] Terms of service definidos
- [ ] App tested en multiples instancias
- [ ] Support email configurado
- [ ] Marketplace listing con screenshots y video

## Acceptance Criteria
- [ ] AC-01: README.md con Quick Start funcional (< 10 minutos para developer)
- [ ] AC-02: Arquitectura documentada con diagrama
- [ ] AC-03: GitHub App setup documentado paso a paso
- [ ] AC-04: README-product.md con propuesta de valor clara
- [ ] AC-05: Plan de marketplace con tiers y pricing
- [ ] AC-06: Checklist de publicacion completo
- [ ] AC-07: Sin errores ortograficos ni links rotos

## Reglas del Rulebook
- **[GIT-CI-005]**: README actualizado en cada release

## Estrategia de Test
- **Unit**: N/A
- **Integration**: Quick Start ejecutable sin errores
- **E2E**: Developer externo puede seguir el Quick Start

## Dependencias
- Todas las tareas anteriores (documentacion refleja la implementacion)

## Estado: PENDIENTE
