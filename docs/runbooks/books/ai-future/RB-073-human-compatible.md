# [RB-073] Human Compatible

> Libro: Stuart Russell - Human Compatible: Artificial Intelligence and the Problem of Control

## Reglas

### ROVO-INTEG-059
**DEFINICION:** El sistema debe tratar las preferencias del usuario como inciertas y actualizables: si un usuario override un bloqueo del Quality Gate, el sistema debe aprender de esa decision y ajustar su comportamiento futuro para ese tipo de tickets.
**VALOR:** Si el sistema bloquea repetidamente un tipo de ticket que el equipo considera valido (por ejemplo, tickets de tipo "Spike" que no necesitan criterios de aceptacion), el override manual del usuario es una senal de que la regla necesita ajuste.
**IMPLEMENTACION:** Registrar cada override de usuario en Forge Storage con: `issueKey`, `score`, `reason`, `userId`, `timestamp`. Cuando se acumulen mas de 3 overrides del mismo tipo en un proyecto, generar una sugerencia automatica para ajustar la regla o excluir el tipo de ticket. Mostrar las sugerencias en el Admin Dashboard.
**AUDITORIA:** Ralph verifica que el sistema registre los overrides y que las sugerencias de ajuste se generen automaticamente cuando el patron lo justifique.

### ROVO-INTEG-060
**DEFINICION:** El sistema nunca debe asumir que tiene informacion completa. Las validaciones deben manejar explicitamente la incertidumbre cuando Rovo no devuelve suficiente contexto o cuando los datos de Confluence estan desactualizados.
**VALOR:** Si Rovo no encuentra documentacion relevante para un proyecto nuevo y el sistema asume que la falta de contexto significa inconsistencia, bloqueara todos los tickets de un proyecto que simplemente no tiene documentacion todavia.
**IMPLEMENTACION:** Distinguir entre "inconsistencia confirmada" (Rovo encontro una contradiccion explicita) e "incertidumbre" (Rovo no encontro suficiente contexto). Las inconsistencias confirmadas contribuyen negativamente al score. La incertidumbre se refleja como un warning, no como un bloqueo, a menos que la configuracion del proyecto indique lo contrario.
**AUDITORIA:** Ralph verifica que el calculo del Consistency Score diferencie entre inconsistencias confirmadas y falta de contexto, y que la falta de contexto no cause bloqueos automaticos.

### ROVO-INTEG-061
**DEFINICION:** El sistema debe ser beneficioso por diseno: cada enforcement action debe estar orientada a reducir el retrabajo del equipo, no a maximizar el numero de tickets bloqueados.
**VALOR:** Si el sistema se optimiza para bloquear la mayor cantidad de tickets posible (maximizar "detecciones"), generara falsos positivos que aumentan el retrabajo en vez de reducirlo, contradiciendo la mision del producto.
**IMPLEMENTACION:** Medir el exito del sistema por metricas de valor: (1) reduccion de retrabajo reportado por equipos, (2) reduccion de PRs rechazados post-merge, (3) satisfaccion del usuario con las sugerencias del sistema. NO optimizar por: numero de tickets bloqueados, numero de inconsistencias detectadas. El Admin Dashboard debe mostrar metricas de valor, no metricas de volumen.
**AUDITORIA:** Ralph verifica que las metricas mostradas en el Admin Dashboard sean de valor (reduccion de retrabajo) y no de volumen (tickets bloqueados), y que no existan optimizaciones que maximicen bloqueos sobre valor.
