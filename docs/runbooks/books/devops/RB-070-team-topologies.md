# [RB-070] Team Topologies

> Libro: Matthew Skelton, Manuel Pais - Team Topologies: Organizing Business and Technology Teams for Fast Flow of Change

## Reglas

### ARCH-SOLID-072
**DEFINICION:** Las interacciones entre los modulos de Rovo Execution Guard deben seguir el modelo stream-aligned: el modulo de "Ticket Validation" (Jira-side) y el modulo de "PR Enforcement" (GitHub-side) son streams independientes que se comunican via eventos, no via llamadas sincronas.
**VALOR:** Si la validacion de un ticket de Jira llama sincronamente al modulo de GitHub para actualizar el status check, un fallo en GitHub bloquea la experiencia del usuario en Jira. La comunicacion via eventos desacopla la latencia de ambos sistemas.
**IMPLEMENTACION:** Usar Forge Storage como event bus interno: la validacion de Jira escribe un `ValidationCompletedEvent` con `issueKey`, `score`, `timestamp`. El modulo de GitHub lee estos eventos y actualiza los status checks de forma independiente. Si GitHub esta caido, los eventos se acumulan y se procesan cuando se recupera.
**AUDITORIA:** Ralph verifica que los modulos de Jira y GitHub no tengan llamadas sincronas directas entre ellos y que la comunicacion sea via eventos en Forge Storage.

### FORGE-OPS-065
**DEFINICION:** La carga cognitiva del equipo de desarrollo debe gestionarse limitando el numero de dominios tecnicos que un desarrollador necesita dominar simultaneamente. Cada modulo debe tener una interfaz simplificada que oculte su complejidad interna.
**VALOR:** Si un desarrollador necesita entender Forge runtime, Rovo API, GitHub webhooks, Jira transitions, scoring algorithms y Sentry para hacer un cambio simple en el threshold del Quality Gate, la carga cognitiva reduce la velocidad y aumenta los errores.
**IMPLEMENTACION:** Cada modulo debe tener un archivo README en su carpeta que explique: que hace, como se usa (interfaz publica), y como se testea. Un desarrollador que trabaje en scoring no necesita entender los detalles de la API de GitHub, solo la interfaz `IValidationRequest` e `IValidationResponse`.
**AUDITORIA:** Ralph verifica que cada modulo en `/src/backend/services/` tenga documentacion de su interfaz publica y que los desarrolladores puedan trabajar en un modulo sin conocer los detalles internos de los demas.

### ARCH-SOLID-073
**DEFINICION:** Los modulos shared (tipos, utilidades, constantes) deben ser propiedad de un equipo explicito y tener interfaces estables que minimicen el impacto de cambios en los consumidores.
**VALOR:** Si un cambio en el tipo `ConsistencyScore` en `/src/backend/types/` rompe simultaneamente el modulo de scoring, los resolvers, y la UI del Spider Chart, la carga de coordinacion impide iterar rapidamente.
**IMPLEMENTACION:** Designar ownership explicito para cada modulo shared. Los tipos compartidos deben ser backward compatible: anyadir nuevos campos opcionales en vez de cambiar los existentes. Usar deprecation con un periodo de gracia de 2 sprints antes de eliminar campos.
**AUDITORIA:** Ralph verifica que los cambios en modulos shared sean backward compatible y que los campos deprecados tengan un timeline de eliminacion documentado.
