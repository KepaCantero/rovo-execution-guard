# [RB-066] The Phoenix Project

> Libro: Gene Kim, Kevin Behr, George Spafford - The Phoenix Project: A Novel about IT, DevOps, and Helping Your Business Win

## Reglas

### GIT-CI-054
**DEFINICION:** El flujo de validacion de Rovo Execution Guard debe optimizarse para que el tiempo entre la edicion de un ticket en Jira y la respuesta del enforcement (bloqueo o aprobacion) sea el minimo posible, eliminando cuellos de botella.
**VALOR:** Si la validacion de Rovo tarda 15 segundos y el usuario tiene que esperar para mover el ticket, la friccion genera evasion del sistema. El objetivo es que el enforcement sea rapido y transparente.
**IMPLEMENTACION:** Medir el tiempo de cada etapa del pipeline (Rovo query, score calculation, Jira enforcement, GitHub check) con logs estructurados. Identificar el cuello de botella y optimizar primero el mas lento. Usar cache de resultados de Rovo para evitar re-consultas. Target: tiempo total de validacion menor a 3 segundos para el caso feliz.
**AUDITORIA:** Ralph monitorea los tiempos de ejecucion de los triggers de Forge y genera alertas si la latencia P95 supera 5 segundos.

### GIT-CI-055
**DEFINICION:** Cada enforcement action (bloqueo de ticket, fallo de PR check, comentario automatico) debe generar un evento de auditoria observable en tiempo real para que el equipo pueda detectar anomalias.
**VALOR:** Si el sistema empieza a bloquear mas tickets de lo normal, el equipo necesita visibilidad inmediata para detectar si es un problema del sistema (Rovo degradado) o un problema real de calidad de tickets.
**IMPLEMENTACION:** Cada enforcement action emite un evento estructurado con: `executionId`, `issueKey`, `prId` (si aplica), `action` (BLOCK/WARN/APPROVE), `score`, `timestamp`. Estos eventos se almacenan en Forge Storage y se exponen en el Admin Dashboard. Configurar alertas en Sentry para picos de bloqueo superiores al 20% del promedio.
**AUDITORIA:** Ralph verifica que cada enforcement action tenga su evento de auditoria correspondiente y que el Admin Dashboard muestre el feed en tiempo real.

### FORGE-OPS-061
**DEFINICION:** El equipo debe establecer ciclos de feedback rapidos: cada cambio en el sistema de Quality Gates debe ser validado por un stakeholder dentro de las 24 horas siguientes al deploy a staging.
**VALOR:** Si un nuevo eje de validacion (por ejemplo, "verificacion de criterios de aceptacion") se implementa y deploya sin feedback, puede bloquear tickets validos durante semanas antes de que alguien lo reporte.
**IMPLEMENTACION:** Despues de cada deploy a staging, notificar al Product Owner con un resumen de las nuevas reglas activas. El Admin Dashboard debe incluir un modo "preview" donde los nuevos Quality Gates solo generan warnings sin bloquear. Solo despues de validacion se activa el modo "enforce".
**AUDITORIA:** Ralph verifica que cada nuevo Quality Gate pase por un periodo de "shadow mode" (warning only) antes de activarse en modo bloqueo.
