# [RB-090] Algorithms to Live By

> Libro: Brian Christian - Algorithms to Live By: The Computer Science of Human Decisions

## Reglas

### ARCH-SOLID-0901
**DEFINICION:** El scoring engine debe usar un algoritmo de cache LRU (Least Recently Used) para almacenar scores calculados, expulsando los scores mas antiguos cuando el cache alcanza el limite de Forge Storage.
**VALOR:** Los caches efectivos siguen principios de localidad temporal: un ticket validado hace 5 minutos probablemente se validara de nuevo pronto. LRU maximiza el hit rate del cache con memoria limitada, reduciendo llamadas a APIs externas.
**IMPLEMENTACION:** Implementar `LRUScoreCache` en `src/backend/infrastructure/cache/` con un maximo de 1000 entradas. Cada entrada: `{ key: issueKey, value: ScoreResult, accessedAt: timestamp }`. Al escribir una nueva entrada, si el cache esta lleno, eliminar la entrada con `accessedAt` mas antiguo. Actualizar `accessedAt` en cada lectura. Almacenar en Forge Storage con prefijo `cache:score:`.
**AUDITORIA:** Ralph verifica que el cache de scores use politica LRU, que el limite de entradas este configurado, y que las entradas expiradas se eliminen correctamente.

### ROVO-INTEG-0902
**DEFINICION:** El scheduling de validaciones (cuando se ejecutan los quality gates) debe seguir un algoritmo de "earliest deadline first": las validaciones mas urgentes (bloqueo de PR pendiente de merge) se ejecutan antes que las de baja prioridad (re-score periodico).
**VALOR:** No todas las validaciones tienen la misma urgencia. Un PR que esta esperando merge es mas urgente que un re-score de un ticket que nadie ha tocado en horas. Priorizar por deadline optimiza la experiencia del usuario.
**IMPLEMENTACION:** Implementar cola de prioridad en Forge Storage con formato `{ type: 'validation', priority: 'critical' | 'high' | 'low', deadline: timestamp, payload: ValidationRequest }`. `critical` = PR status check pendiente, `high` = ticket transition, `low` = re-score periodico. Los triggers de Jira/GitHub escriben en la cola con la prioridad correspondiente. El worker procesa en orden de prioridad y deadline.
**AUDITORIA:** Ralph verifica que las validaciones criticas (PR status checks) se procesen antes que las de baja prioridad y que la cola respete los deadlines.

### TEST-QA-0903
**DEFINICION:** La estrategia de testing debe seguir el principio de "explore-exploit": el 80% de los tests explotan caminos conocidos (regresion) y el 20% explora caminos nuevos (tests de edge case aleatorios, fuzzing de inputs).
**VALOR:** Los tests de regresion protegen lo que ya funciona (exploit), pero los tests exploratorios descubren bugs nuevos (explore). Un suite que solo tiene regresion protege contra bugs del pasado, no del futuro.
**IMPLEMENTACION:** El 80% de los tests son deterministas: dados inputs conocidos, verifican outputs esperados. El 20% usa property-based testing con `fast-check`: generar tickets aleatorios con campos variados (descripciones de 0 a 10000 caracteres, scores de 0 a 100, 0 a 50 labels) y verificar invariantes: el score siempre esta entre 0 y 100, el breakdown tiene al menos una regla, etc.
**AUDITORIA:** Ralph verifica que existan tests property-based para el scoring engine y que las invariantes (score en rango, breakdown no vacio) se cumplan para todos los inputs generados.

### FORGE-OPS-0904
**DEFINICION:** El sistema debe implementar "exponential backoff with jitter" para reintentos de llamadas a APIs externas fallidas, evitando el problema de thundering herd cuando un servicio se recupera.
**VALOR:** Cuando Jira o Rovo se recuperan de una interrupcion, todos los clientes que reintentan al mismo tiempo generan un segundo pico de carga. El jitter aleatorio distribuye los reintentos en el tiempo, evitando la avalancha.
**IMPLEMENTACION:** Implementar `retryWithBackoff` en `src/backend/integration/resilience/retry.ts`: esperar `min(2^attempt * 100ms + random(0, 100ms), maxBackoff)` entre reintentos. Maximo 3 reintentos. `maxBackoff` = 10 segundos. Usar `AbortController` para timeout por intento de 5 segundos.
**AUDITORIA:** Ralph verifica que todos los adapters usen `retryWithBackoff` para llamadas a APIs externas y que el jitter este implementado correctamente (no sea constante).

### GIT-CI-0905
**DEFINICION:** El pipeline de CI debe usar "sorting" eficiente: ejecutar primero los tests mas probables de fallar (tests del modulo modificado) y despues los menos probables (tests de modulos no relacionados).
**VALOR:** Si los tests mas probables de fallar se ejecutan primero, el desarrollador recibe feedback mas rapido. Ejecutar todos los tests en orden aleatorio desperdicia tiempo de espera cuando el fallo esta en un test que se ejecuta al final.
**IMPLEMENTACION:** Configurar Jest con `--findRelatedTests` para ejecutar primero los tests de los archivos modificados en el PR. Luego ejecutar el suite completo en paralelo. El Husky pre-commit solo ejecuta los tests relacionados. El CI ejecuta tests del modulo modificado primero, luego el suite completo.
**AUDITORIA:** Ralph verifica que el Husky pre-commit use `--findRelatedTests` y que el CI priorice los tests del modulo modificado antes del suite completo.
