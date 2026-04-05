# TASK-007: Domain Layer - Inconsistency Detector

## Objetivo
Implementar el detector de inconsistencias que cruza datos de Jira, Confluence y Rovo para identificar contradicciones, duplicados, falta de contexto y ambiguedades.

## Contexto
Este modulo es el cerebro analitico. No genera contenido, solo detecta problemas reales. Es la diferencia entre un "asistente" y una "capa de control".

## Especificacion Tecnica

### Ubicacion
`src/backend/services/scoring/` (o submodulo dedicado)

### Funciones principales

#### `detectInconsistencies(ticket: JiraTicketData, context: RovoContext): Inconsistency[]`
- Tipos de deteccion:
  1. **Contradiction**: El ticket contradice documentacion existente o decisiones previas
  2. **Duplicate**: Existe un ticket previo con el mismo objetivo funcional
  3. **Missing Context**: Faltan datos criticos (sin asignatario, sin acceptance criteria, sin tipo)
  4. **Ambiguity**: Lenguaje ambiguo o impreciso en la descripcion

#### `classifySeverity(inconsistency: Inconsistency): 'critical' | 'warning' | 'info'`
- `critical`: Bloquea workflow (contradiccion directa, duplicado exacto)
- `warning`: No bloquea pero requiere atencion (contexto parcial, ambiguedad)
- `info`: Informativo (sugerencia de mejora)

#### `generateSuggestion(inconsistency: Inconsistency): string`
- Genera una sugerencia accionable para resolver la inconsistencia
- Sin IA (fallback determinista). IA es opcional para mejoras.

### Reglas de deteccion (sin IA)
- Contradiccion: Comparar texto del ticket con keywords extraidos de Rovo
- Duplicado: Buscar tickets con titulo similar (>70% overlap) en el mismo proyecto
- Missing Context: Checkeo de campos requeridos (summary, description, assignee, priority)
- Ambiguedad: Detectar palabras clave ambiguas ("mejorar", "optimizar", "arreglar" sin especificar)

## Acceptance Criteria
- [ ] AC-01: `detectInconsistencies` retorna array de `Inconsistency` con tipo y severidad
- [ ] AC-02: Se detectan los 4 tipos de inconsistencia
- [ ] AC-03: `classifySeverity` clasifica correctamente segun reglas definidas
- [ ] AC-04: `generateSuggestion` produce sugerencias accionables sin IA
- [ ] AC-05: Zero dependencias externas (puro dominio)
- [ ] AC-06: Cobertura de tests unitarios > 90%
- [ ] AC-07: Archivo `.reqs.md` sidecar creado

## Reglas del Rulebook
- **[ARCH-SOLID-002]**: Sin dependencias externas en dominio
- **[ROVO-INTEG-002]**: Deteccion sin IA como baseline, IA como mejora opcional
- **[ROVO-INTEG-003]**: Fallback determinista obligatorio

## Estrategia de Test
- **Unit**: Tests con tickets mock y contexto mock para cada tipo de inconsistencia
- **Integration**: N/A (puro dominio)
- **E2E**: Validar que un ticket duplicado es detectado y bloqueado

## Dependencias
- TASK-005 (tipos y modelos del dominio)

## Estado: PENDIENTE
