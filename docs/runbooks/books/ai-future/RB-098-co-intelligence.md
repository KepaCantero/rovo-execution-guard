# [RB-098] Co-Intelligence

> Libro: Ethan Mollick - Co-Intelligence: Living and Working with AI

## Reglas

### ROVO-INTEG-0981
**DEFINICION:** Las funciones de IA en Rovo Execution Guard (sugerencias de reescritura, explicacion de inconsistencias) deben tratar a la IA como co-piloto, no como piloto: la IA sugiere, el humano decide, el sistema ejecuta.
**VALOR:** Mollick demuestra que la IA es mas efectiva como co-inteligencia que como automatizacion completa. Una sugerencia de reescritura de ticket que el usuario puede aceptar, modificar o rechazar es mas valiosa que una reescritura automatica que puede ser incorrecta.
**IMPLEMENTACION:** Cuando el scoring engine detecta que un ticket tiene score bajo, la IA genera una sugerencia de mejora que se muestra como un draft en el issue panel. El usuario puede: 1) aceptar la sugerencia (se actualiza el ticket), 2) editar la sugerencia antes de aceptar, 3) rechazarla. El sistema nunca modifica un ticket sin aprobacion explicita del usuario.
**AUDITORIA:** Ralph verifica que ninguna funcion de IA modifique datos de Jira o GitHub sin aprobacion explicita del usuario y que las sugerencias se presenten como drafts editables.

### ARCH-SOLID-0982
**DEFINICION:** Las llamadas a modelos de IA deben estar encapsuladas en un `AIService` con una interfaz que permita intercambiar el proveedor (OpenAI, Anthropic, Rovo AI) sin cambiar el codigo del dominio.
**VALOR:** Los modelos de IA cambian rapidamente. Hoy se usa un proveedor, manana otro. Si la logica de negocio esta acoplada a la API de un proveedor especifico, cambiar de modelo requiere refactorizar el dominio. La co-inteligencia requiere flexibilidad en la eleccion del modelo.
**IMPLEMENTACION:** Definir interfaz `AIProvider { generateSuggestion(prompt: string, context: TicketContext): Promise<Suggestion>; }`. Implementar adapters: `OpenAIProvider`, `AnthropicProvider`, `RovoAIProvider`. El `AIService` recibe el provider via inyeccion de dependencias. La configuracion del proyecto especifica que provider usar. Si el provider falla, el sistema opera sin IA (fallback a sugerencias basadas en reglas).
**AUDITORIA:** Ralph verifica que el dominio no importe directamente ningun SDK de IA y que el `AIService` use la interfaz `AIProvider` inyectada.

### FORGE-OPS-0983
**DEFINICION:** Las llamadas a IA deben tener costos controlados: cada llamada se registra con el numero de tokens usados, el costo estimado, y se agrega a un contador mensual por proyecto que bloquea nuevas llamadas si se excede el presupuesto configurado.
**VALOR:** Los costos de IA pueden escalar rapidamente si no se controlan. Mollick advierte sobre la confianza ciega en IA sin considerar los costos. Un proyecto con miles de tickets puede generar cientos de dolares mensuales en llamadas a IA si no hay presupuesto.
**IMPLEMENTACION:** Implementar `AICostTracker` en `src/backend/observability/ai-costs/`. Cada llamada a IA registra: `{ projectId, tokens, estimatedCost, timestamp }`. El costo se acumula en Forge Storage con clave `budget:ai:{projectKey}:{month}`. Si el acumulado supera el presupuesto configurado (default: $50/mes), las llamadas a IA se desactivan automaticamente y el sistema opera con sugerencias basadas en reglas.
**AUDITORIA:** Ralph verifica que cada llamada a IA se registre con tokens y costo, y que el presupuesto mensual se respete con bloqueo automatico al excederse.

### TEST-QA-0984
**DEFINICION:** Los tests de las funciones de IA deben usar snapshots de respuestas esperadas (golden files) en lugar de llamar a la API en cada test, garantizando reproducibilidad y eliminando dependencia de red en CI.
**VALOR:** Las respuestas de IA no son deterministas: la misma pregunta puede generar respuestas diferentes. Los tests que llaman a la API directamente son fragiles (flaky). Los golden files permiten validar que la integracion funciona sin depender del servicio externo.
**IMPLEMENTACION:** Almacenar respuestas de IA esperadas en `tests/fixtures/ai-responses/` como archivos JSON. Los tests usan estos fixtures como mocks. Cuando se cambia el prompt, se regeneran los golden files manualmente con un script `npm run update:ai-fixtures` que llama a la API real una vez y almacena la respuesta.
**AUDITORIA:** Ralph verifica que los tests de IA usen golden files y que no existan tests que llamen a APIs de IA directamente en el CI.

### SEC-PRIV-0985
**DEFINICION:** Los prompts enviados a modelos de IA nunca deben contener datos personales identificables (nombres de usuarios, emails, contenido sensible de tickets). Los datos se anonimizan antes de enviar al modelo.
**VALOR:** Mollick enfatiza la responsabilidad en el uso de IA. Enviar datos de tickets a un modelo externo puede violar politicas de privacidad de la empresa. Los prompts deben contener solo la informacion necesaria para la tarea, anonimizada.
**IMPLEMENTACION:** Implementar `PromptSanitizer` en `src/backend/integration/ai/` que: 1) reemplace nombres de usuarios con `[USER_1]`, `[USER_2]`, 2) reemplace emails con `[EMAIL]`, 3) reemplace URLs internas con `[URL]`, 4) mantenga solo la estructura del ticket necesaria para la sugerencia. El sanitizer se aplica antes de construir el prompt. Los prompts se loggean (sanitizados) para auditoria.
**AUDITORIA:** Ralph verifica que los prompts enviados a IA no contengan datos personales y que el `PromptSanitizer` este aplicado en todas las llamadas.
