# [RB-091] The Black Swan

> Libro: Nassim Nicholas Taleb - The Black Swan: The Impact of the Highly Improbable

## Reglas

### FORGE-OPS-0911
**DEFINICION:** El sistema debe estar disenado para sobrevivir eventos de cola pesada: un pico de 1000 tickets creados simultaneamente, una interrupcion de 6 horas de la API de Jira, o una respuesta de Rovo con 50MB de datos no deben causar perdida de datos ni estados corruptos.
**VALOR:** Los black swans en software son inevitables. Un Forge app que funciona en condiciones normales pero colapsa ante picos inesperados es fragil. El sistema debe ser robusto ante lo improbable porque lo improbable siempre ocurre en produccion.
**IMPLEMENTACION:** Implementar bulkhead pattern: cada tipo de operacion (scoring, enforcement, context fetch) tiene un pool limitado de recursos. Si el pool de scoring esta lleno, nuevas solicitudes se encolan en Forge Storage con TTL de 1 hora, no se rechazan. Las respuestas de APIs externas se validan con tamanho maximo (reject si body > 5MB). Todos los writes son idempotentes.
**AUDITORIA:** Ralph verifica que existan tests de carga con escenarios de cola pesada (1000+ tickets, timeouts prolongados, respuestas gigantes) y que el sistema no pierda datos ni entre en estados corruptos.

### ARCH-SOLID-0912
**DEFINICION:** Cada operacion de escritura (actualizar score, registrar enforcement, guardar contexto) debe ser idempotente: ejecutar la misma operacion dos veces produce el mismo resultado que ejecutarla una vez.
**VALOR:** Los reintentos automaticos (por timeouts, network errors) pueden causar escrituras duplicadas. Si registrar un enforcement dos veces bloquea un ticket permanentemente, el sistema es fragil ante black swans de red. La idempotencia es la defensa contra operaciones duplicadas.
**IMPLEMENTACION:** Cada operacion de escritura incluye un `operationId` unico (UUID) que se almacena en Forge Storage. Antes de escribir, verificar si `operationId` ya existe. Si existe, retornar el resultado anterior sin reescribir. Los `operationId` se generan deterministicamente cuando es posible: `score:{issueKey}:{hash(ticketSnapshot)}`.
**AUDITORIA:** Ralph verifica que cada operacion de escritura tenga su `operationId` y que los tests confirmen la idempotencia (misma operacion ejecutada N veces produce mismo resultado).

### TEST-QA-0913
**DEFINICION:** Los tests deben incluir escenarios "improbables": respuestas de API con encoding incorrecto, payloads JSON con campos null inesperados, webhooks con timestamps del futuro, y tokens OAuth expirados.
**VALOR:** Los bugs mas graves vienen de escenarios que nadie considero posible. Si los tests solo cubren respuestas "normales", el sistema es fragil ante lo inesperado. Los chaos tests son el seguro contra black swans de datos.
**IMPLEMENTACION:** Crear `tests/chaos/` con generadores de payloads aleatorios usando `fast-check`: `fc.record()` con campos que pueden ser `null`, `undefined`, tipos incorrectos, o strings con caracteres unicode. Cada adapter debe sobrevivir 10000 iteraciones de inputs aleatorios sin lanzar excepciones no manejadas.
**AUDITORIA:** Ralph verifica que existan chaos tests para cada adapter y que los adapters nunca lancen excepciones no manejadas ante inputs aleatorios.

### SEC-PRIV-0914
**DEFINICION:** Las decisiones de seguridad deben asumir que los datos de entrada son hostiles: cada campo de un ticket, cada payload de webhook, y cada respuesta de Rovo puede contener datos maliciosos (XSS, injection, data exfiltration).
**VALOR:** El black swan de seguridad es el ataque que nadie anticipo. Si el sistema confia en que Jira siempre envia datos limpios, es fragil ante un ticket con payloads maliciosos que se renderizan en el issue panel. La defensiva extrema es la unica postura segura.
**IMPLEMENTACION:** Sanitizar todo output que se renderiza en la UI: usar `DOMPurify` o equivalente para cualquier HTML dinámico en Custom UI. Validar inputs con Zod schemas antes de procesar. Nunca interpolar datos de tickets directamente en SQL-like queries o comandos de Forge Storage. Los webhooks de GitHub se validan con HMAC signature antes de procesar.
**AUDITORIA:** Ralph verifica que todo output renderizado en la UI pase por sanitizacion y que los webhooks de GitHub se validen con HMAC antes de procesarse.

### ROVO-INTEG-0915
**DEFINICION:** El sistema nunca debe depender de que Rovo este disponible para tomar decisiones de enforcement criticas. Rovo es un enhancer, nunca un requerimiento obligatorio para el funcionamiento basico.
**VALOR:** Si Rovo es un requisito para bloquear tickets, una interrupcion de Rovo es un black swan que desactiva todo el enforcement. El sistema debe funcionar sin Rovo (con menor precision) y usar Rovo como enhancement cuando este disponible.
**IMPLEMENTACION:** El `ScoringEngine` recibe el `RovoContext` como opcional: `calculateScore(input: ScoringInput, context?: RovoContext)`. Sin contexto Rovo, ejecuta las reglas que no requieren contexto (5 reglas basicas). Con contexto Rovo, agrega las reglas avanzadas. El admin dashboard muestra claramente cuando el sistema opera sin contexto Rovo.
**AUDITORIA:** Ralph verifica que el scoring engine funcione correctamente con `context` como `undefined` y que produzca un score valido con solo las reglas basicas.
