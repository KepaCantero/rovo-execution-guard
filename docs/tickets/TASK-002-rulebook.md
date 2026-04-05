# TASK-002: Rulebook Consolidated

## Objetivo
Crear el archivo `RULEBOOK.md` que contenga todas las reglas extraidas de las 100 fuentes (50 links tecnicos + 50 libros de ingenieria). Este documento sera la unica fuente de verdad para auditar e implementar codigo.

## Contexto
Las reglas deben estar organizadas por categoria, deduplicadas, sin contradicciones y en formato accionable. Ralph usara este rulebook para auditar. GLM-5 lo usara como guia de implementacion.

## Especificacion Tecnica

### Categorias del Rulebook
1. **[FORGE-OPS]**: Limites de ejecucion, memoria, storage y runtime de Forge
2. **[SEC-PRIV]**: Seguridad, Scopes, OAuth, manejo de datos sensibles
3. **[ARCH-SOLID]**: Estructura de capas, patrones de diseno, desacoplamiento
4. **[TEST-QA]**: Cobertura, tipos de tests, estrategias de fallo
5. **[GIT-CI]**: Flujo de ramas, commits, automatizacion de despliegue
6. **[UI-ADS]**: Reglas del Atlassian Design System y UX
7. **[ROVO-INTEG]**: Logica de contexto, latencia, uso de IA
8. **[GH-INTEG]**: GitHub API, webhooks, status checks

### Formato de cada regla
```
ID-REGLA: [CATEGORIA]-[CORRELATIVO] (Ej: FORGE-OPS-001)
DEFINICION: Descripcion tecnica breve de la restriccion.
VALOR: Por que esta regla es AAA.
IMPLEMENTACION: Como escribir el codigo para cumplirla.
AUDITORIA: El check especifico que Ralph debe hacer.
```

### Prioridad de Verdad (resolucion de conflictos)
1. Limites y documentacion oficial de Atlassian Forge
2. Seguridad (OWASP) y APIs de GitHub
3. Principios de libros de Arquitectura/Clean Code

## Acceptance Criteria
- [ ] AC-01: Al menos 80 reglas accionables extraidas de las fuentes
- [ ] AC-02: Cada regla tiene ID unico, definicion, valor, implementacion y auditoria
- [ ] AC-03: No hay contradicciones entre reglas
- [ ] AC-04: Las 8 categorias estan cubiertas con al menos 5 reglas cada una
- [ ] AC-05: Indice de conflictos resueltos documentado al final
- [ ] AC-06: Formato consistente y parseable por IA

## Reglas del Rulebook
- **[ARCH-SOLID-001]**: Separacion de capas estricta
- **[TEST-QA-001]**: Cobertura >90% en capa de dominio

## Estrategia de Test
- **Unit**: Script que valide que cada regla tiene los campos requeridos
- **Integration**: Verificar que las reglas no se contradicen (cross-check)
- **E2E**: N/A

## Dependencias
- Ninguna (es la primera tarea de contenido)

## Estado: PENDIENTE
