# [RB-085] The Hard Thing About Hard Things

> Libro: Ben Horowitz - The Hard Thing About Hard Things: Building a Business When There Are No Easy Answers

## Reglas

### FORGE-OPS-0851
**DEFINICION:** El sistema debe operar en dos modos: "peacetime" (validacion suave, sugerencias, learning) y "wartime" (enforcement estricto, bloqueo inmediato). El modo se configura por proyecto y se cambia cuando el equipo necesita mas o menos control.
**VALOR:** Los equipos maduros con tickets de alta calidad necesitan validacion ligera (peacetime). Los equipos con muchos reworks necesitan enforcement estricto (wartime). Un sistema que solo tiene un modo no sirve para ambos contextos.
**IMPLEMENTACION:** Definir enum `EnforcementMode { ADVISORY, STRICT, BLOCKING }` en `src/backend/config/types.ts`. El modo `ADVISORY` solo muestra advertencias sin bloquear. `STRICT` bloquea transiciones criticas. `BLOCKING` bloquea toda transicion hasta que el score supere el threshold. El admin dashboard permite cambiar el modo por proyecto con un toggle que requiere confirmacion.
**AUDITORIA:** Ralph verifica que cada proyecto tenga un modo de enforcement configurado y que los gates se comporten diferente segun el modo (advisory no bloquea, strict bloquea solo criticos, blocking bloquea todo).

### ARCH-SOLID-0852
**DEFINICION:** Cada adapter de API externa debe implementar circuit breaker: si la API falla 3 veces consecutivas en 60 segundos, el circuito se abre y todas las llamadas posteriores se redirigen al fallback por 5 minutos.
**VALOR:** Cuando las cosas dificiles pasan (API de Jira caida, Rovo con latencia alta), el sistema no debe agravar el problema con reintentos infinitos. El circuit breaker protege tanto al Forge app como a las APIs externas.
**IMPLEMENTACION:** Implementar `CircuitBreaker` generico en `src/backend/integration/resilience/circuit-breaker.ts` con parametros configurables: `failureThreshold: 3`, `resetTimeout: 300000` (5 min), `monitorInterval: 60000`. Cada adapter envuelve sus llamadas HTTP en `circuitBreaker.execute(() => apiCall())`. Cuando el circuito esta abierto, ejecuta el fallback definido por el adapter.
**AUDITORIA:** Ralph verifica que cada adapter en `src/backend/integration/` use el `CircuitBreaker` y tenga una funcion de fallback definida y testeada.

### TEST-QA-0853
**DEFINICION:** Los tests deben cubrir los peores escenarios: APIs que retornan datos malformados, timeouts, respuestas vacias, y estados inconsistentes entre Jira y GitHub. Estos "chaos tests" son obligatorios para cada adapter.
**VALOR:** Las cosas dificiles en produccion nunca son los caminos felices. Si el sistema solo esta testeado para respuestas correctas, fallara cuando Jira retorne un ticket sin campos o GitHub envie un webhook con datos incompletos.
**IMPLEMENTACION:** Para cada adapter, crear tests en `__tests__/chaos/`: `malformed-response.test.ts`, `timeout.test.ts`, `empty-response.test.ts`, `inconsistent-state.test.ts`. Usar Nock para simular respuestas malformadas. Verificar que el adapter nunca crashee y siempre produzca un resultado (error o fallback, nunca exception no manejada).
**AUDITORIA:** Ralph verifica que cada adapter tenga tests de chaos y que ningun adapter lance exceptions no manejadas ante respuestas malformadas o timeouts.

### SEC-PRIV-0854
**DEFINICION:** Cuando se detecta una vulnerabilidad de seguridad (Snyk alert, dependencia comprometida), el fix tiene prioridad absoluta sobre cualquier feature en curso. El deploy del fix es inmediato a produccion sin esperar al ciclo normal de release.
**VALOR:** Las cosas dificiles en seguridad no pueden esperar. Una vulnerabilidad en el Forge app que maneja tokens de GitHub y datos organizacionales es un riesgo critico que debe resolverse en horas, no en sprints.
**IMPLEMENTACION:** Configurar Snyk para que falle el CI en vulnerabilidades altas o criticas. Cuando se detecta una vulnerabilidad: 1) Crear rama hotfix, 2) Actualizar dependencia con `npm audit fix`, 3) Ejecutar tests completos, 4) Deploy directo a produccion via `forge deploy production`, 5) Verificar en Sentry que no hay nuevos errores.
**AUDITORIA:** Ralph verifica que no existan vulnerabilidades altas o criticas abiertas en el proyecto por mas de 48 horas y que el proceso de hotfix este documentado.

### ROVO-INTEG-0855
**DEFINICION:** Si la integracion con Rovo falla completamente (API no disponible por mas de 30 minutos), el sistema debe notificar al administrador del proyecto y operar en modo degradado usando solo validacion local (sin contexto organizacional).
**VALOR:** La dependencia de Rovo es el "hard thing" mas grande del producto. Si Rovo no esta disponible, Rovo Execution Guard no debe dejar de funcionar, sino operar con capacidades reducidas y comunicarlo claramente.
**IMPLEMENTACION:** Implementar `DegradedModeService` en `src/backend/orchestration/` que detecta cuando Rovo no responde (via circuit breaker). En modo degradado: usar `BasicScoringEngine` sin contexto de Rovo, loggear un warning visible en el admin dashboard, y mostrar un banner en el issue panel indicando "Validacion en modo degradado - sin contexto organizacional".
**AUDITORIA:** Ralph verifica que el modo degradado funcione correctamente y que la UI muestre indicadores visuales cuando el sistema esta operando sin contexto de Rovo.
