# [RB-057] Domain-Driven Design

> Libro: Eric Evans - Domain-Driven Design: Tackling Complexity in the Heart of Software

## Reglas

### ARCH-SOLID-061
**DEFINICION:** El sistema debe definir bounded contexts claros: "Ticket Validation" (Jira-side), "PR Enforcement" (GitHub-side), y "Context Analysis" (Rovo-side), cada uno con su propio modelo de datos y vocabulario.
**VALOR:** Mezclar el modelo de datos de un issue de Jira con el de un Pull Request de GitHub en una sola entidad genera confusion y acoplamiento. Un cambio en la estructura del PR de GitHub no debe afectar como se valida un ticket en Jira.
**IMPLEMENTACION:** Crear contextos separados en `/src/backend/services/`: `jira/` con tipos como `JiraIssue`, `TransitionEvent`, `JiraProjectConfig`; `github/` con tipos como `PullRequest`, `CheckStatus`, `PRComment`; `rovo/` con tipos como `OrganizationalContext`, `KnowledgeEntry`. El contexto de scoring (`scoring/`) actua como contexto compartido con tipos como `ConsistencyReport`, `QualityGateResult`.
**AUDITORIA:** Ralph verifica que los tipos de un contexto no filtren hacia otro (por ejemplo, que `PullRequest` de GitHub no aparezca como tipo de retorno en funciones del contexto de Jira).

### ARCH-SOLID-062
**DEFINICION:** Los valores del dominio como `ConsistencyScore`, `IssueKey`, `PRUrl`, y `ThresholdPercentage` deben modelarse como Value Objects inmutables, no como tipos primitivos.
**VALOR:** Usar `number` para un Consistency Score permite pasar cualquier valor numerico sin validacion. Un Value Object `ConsistencyScore` encapsula la validacion (0-100), la comparacion contra thresholds, y la serializacion, previniendo errores en toda la cadena.
**IMPLEMENTACION:** Definir Value Objects en `/src/backend/types/` como clases inmutables o tipos branded: `ConsistencyScore.create(85)`, `IssueKey.from('PROJ-123')`, `ThresholdPercentage.of(80)`. Cada Value Object debe validar su invariante en la creacion y lanzar un error de dominio si es invalido.
**AUDITORIA:** Ralph busca usos de tipos primitivos (`string`, `number`) para conceptos de dominio que deberian ser Value Objects y rechaza codigo que use primitivos sin wrapping.

### ROVO-INTEG-052
**DEFINICION:** El equipo debe usar un lenguaje ubicuo consistente en codigo, tests, documentacion, y comunicacion, definido en un glosario central que Ralph audita.
**VALOR:** Si el backend llama "Consistency Score" a la metrica pero el frontend la muestra como "Quality Index", la comunicacion entre desarrolladores y con stakeholders se degrada. Los tests deben usar los mismos terminos que la UI.
**IMPLEMENTACION:** Mantener un glosario en `/docs/glossary.md` con terminos obligatorios: `Consistency Score`, `Quality Gate`, `Enforcement Action`, `Inconsistency`, `Issue Context`, `PR Validation`. Los nombres de funciones, tipos, componentes React, y textos de UI deben usar exactamente estos terminos.
**AUDITORIA:** Ralph compara los nombres en el codigo contra el glosario y senala desviaciones terminologicas en PRs.
