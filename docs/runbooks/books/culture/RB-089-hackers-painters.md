# [RB-089] Hackers & Painters

> Libro: Paul Graham - Hackers & Painters: Big Ideas from the Computer Age

## Reglas

### ARCH-SOLID-0891
**DEFINICION:** El codigo del dominio debe ser tan legible como prosa tecnica: cada funcion cuenta una historia, cada nombre es una palabra precisa, y la estructura del modulo revela la logica del negocio sin comentarios explicativos.
**VALOR:** Graham argumenta que los hackers son artesanos como los pintores. El codigo del scoring engine debe poder leerse de principio a fin como una narrativa: "calcular score -> evaluar reglas -> ponderar resultados -> determinar si aprueba". Los comentarios son para el "por que", no para el "que".
**IMPLEMENTACION:** En `src/backend/domain/scoring/engine.ts`, la funcion principal debe leerse como: `calculateScore(input) -> evaluateRules(input) -> weightResults(rules) -> determineVerdict(weightedScore)`. Cada subfuncion tiene un nombre autoexplicativo. Los comentarios solo existen para decisiones no obvias (ej: por que un peso es 0.3 y no 0.5).
**AUDITORIA:** Ralph verifica que el archivo principal del scoring engine pueda leerse de arriba a abajo como una narrativa y que no existan comentarios que expliquen "que hace" el codigo (solo "por que").

### UI-ADS-0892
**DEFINICION:** La UI del issue panel debe ser disenada iterativamente: version 1 con HTML basico funcional, version 2 con estilos ADS, version 3 con animaciones y micro-interacciones. La funcionalidad siempre precede a la estetica.
**VALOR:** Los pintores iteran desde el boceto al detalle. La UI del Forge app debe funcionar perfectamente antes de ser bonita. Un panel funcional con estilos basicos es preferible a un panel hermoso que no carga.
**IMPLEMENTACION:** Fase 1: issue panel con `Text`, `Lozenge`, y `Button` de ADS, sin estilos custom. Fase 2: agregar layout responsive con `Stack` y `Inline`. Fase 3: agregar transiciones con CSS-in-JS y estados de loading con `Spinner`. Cada fase es un deploy independiente que agrega valor.
**AUDITORIA:** Ralph verifica que la UI funcione correctamente sin JavaScript custom (solo componentes ADS) y que las iteraciones visuales no hayan introducido regresiones funcionales.

### ROVO-INTEG-0893
**DEFINICION:** La integracion con Rovo debe ser como una API bien disenada: simple por fuera, sofisticada por dentro. El consumidor (scoring engine) no necesita saber como Rovo obtiene el contexto, solo que recibe un `RovoContext` tipado y confiable.
**VALOR:** La simplicidad de la interfaz es el resultado de la sofisticacion de la implementacion. Graham valora las abstracciones que esconden complejidad sin ser magicas. El scoring engine no debe saber si Rovo usa GraphQL, REST o una base de datos.
**IMPLEMENTACION:** Definir `RovoContextProvider` como interfaz con un unico metodo: `getContext(issueKey: string, requiredTypes: ContextType[]): Promise<RovoContext>`. La implementacion (`RovoContextAdapter`) maneja caching, retries, circuit breaker y normalizacion internamente. El scoring engine solo ve la interfaz limpia.
**AUDITORIA:** Ralph verifica que el scoring engine no importe nada del paquete de integracion de Rovo excepto la interfaz `RovoContextProvider` y el tipo `RovoContext`.

### FORGE-OPS-0894
**DEFINICION:** El codigo debe ser refactory-friendly: la estructura permite cambiar la implementacion de cualquier modulo sin afectar los consumidores, como un pintor puede cambiar la paleta de colores sin rediseñar la composicion.
**VALOR:** La programacion creativa requiere libertad para experimentar. Si cambiar el algoritmo de scoring requiere modificar 10 archivos, el desarrollador no experimentara. La arquitectura debe fomentar la creatividad dentro de los boundaries.
**IMPLEMENTACION:** Usar dependency injection para los modulos clave: `ScoringEngine` recibe sus reglas via constructor, `EnforcementService` recibe los canales de enforcement via constructor, `RovoContextProvider` es inyectado en ambos. Esto permite cambiar implementaciones en los tests y en produccion sin tocar el codigo del consumidor.
**AUDITORIA:** Ralph verifica que las clases principales del dominio reciban sus dependencias via constructor y que no usen `import` directo a implementaciones concretas de adapters.

### TEST-QA-0895
**DEFINICION:** Los tests deben ser tan creativos como el codigo que validan: cada test debe ser un "ejemplo vivo" que documente el comportamiento esperado del sistema con datos del mundo real, no solo aserciones booleanas genericas.
**VALOR:** Un test como `expect(score).toBeGreaterThan(80)` dice poco. Un test como `given a ticket with 2 acceptance criteria, 100-word description, and linked epic, when scored, then returns score >= 80 with 'hasAcceptanceCriteria' and 'descriptionMinimumLength' passing` documenta la decision de negocio.
**IMPLEMENTACION:** Usar patron Given-When-Then en los tests: `given()` configura el contexto, `when()` ejecuta la accion, `then()` verifica el resultado. Cada test tiene un nombre descriptivo que explica el escenario. Usar `describe.each` con datos de ejemplo reales (tickets con campos realistas, no strings vacios).
**AUDITORIA:** Ralph verifica que los tests del dominio usen el patron Given-When-Then y que los nombres de los tests sean descriptivos del escenario de negocio, no tecnicos.
