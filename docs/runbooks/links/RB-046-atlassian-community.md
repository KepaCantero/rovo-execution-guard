# [RB-046] Atlassian Developer Community - Known Issues, Patterns

> Fuente: Atlassian Developer Community - Known issues, patterns

## Reglas

### FORGE-OPS-046-01
**DEFINICION:** Antes de implementar cualquier funcionalidad que dependa de APIs de Forge, se debe consultar el foro de Atlassian Developer Community para verificar known issues y workarounds publicados en los ultimos 90 dias.
**VALOR:** Los known issues no documentados en la referencia oficial de Forge aparecen primero en la comunidad; implementar sin consultar puede resultar en horas perdidas debuggeando problemas ya conocidos y resueltos.
**IMPLEMENTACION:** Anadir paso en el template de tarea: `1. Buscar en https://community.developer.atlassian.com/ por keywords relevantes. 2. Documentar hallazgos en la tarea como "Community Findings". 3. Si existe workaround, implementarlo y anadir link al post.` Mantener un registro en `docs/known-issues.md` con formato: `| Issue | Workaround | Source URL | Date Verified |`.
**AUDITORIA:** Ralph verifica que el archivo `docs/known-issues.md` existe y que esta actualizado con verificaciones dentro de los ultimos 90 dias para los modulos activos.

### FORGE-OPS-046-02
**DEFINICION:** Los patrones de Forge documentados como `recommended` o `best practice` por el equipo de Atlassian en la comunidad deben seguirse como obligatorios a menos que exista una razon tecnica documentada en `docs/exceptions.md`.
**VALOR:** Los patrones recomendados por Atlassian suelen prevenir problemas de rendimiento y limites de plataforma que solo se manifiestan en produccion con carga real.
**IMPLEMENTACION:** Ejemplos de patrones a seguir: usar `asApp()` en vez de `asUser()` cuando no se necesita contexto de usuario; preferir Forge Storage sobre External Entity Properties para datos de configuracion; usar `queue.event()` para operaciones que exceden el timeout de invocation. Documentar desviaciones con justificacion tecnica.
**AUDITORIA:** Ralph verifica que el codigo usa los patrones recomendados y que cualquier desviacion esta documentada en `docs/exceptions.md` con justificacion tecnica y fecha.

### FORGE-OPS-046-03
**DEFINICION:** Las degradaciones de plataforma reportadas en el foro (ej. latencia elevada en Forge Storage, timeouts en Custom UI) deben incorporarse como tests de resiliencia en el suite de integracion.
**VALOR:** Las degradaciones recurrentes de plataforma se convierten en problemas de produccion si no se testean; los tests de resiliencia catchan estos problemas antes del deploy.
**IMPLEMENTACION:** Para cada degradacion reportada, crear un test: `it('should handle Forge Storage latency spikes > 5s', async () => { mockStorage.delay(5000); const result = await handler.execute(mockContext); expect(result.status).not.toBe(500); })`. Etiquetar como `@resilience` y ejecutar en cada deploy.
**AUDITORIA:** Ralph verifica que por cada degradacion documentada en `docs/known-issues.md` con severidad alta, existe al menos un test de resiliencia etiquetado `@resilience`.

### ROVO-INTEG-046-04
**DEFINICION:** Antes de abrir un ticket de soporte a Atlassian, se debe buscar en la comunidad si el issue ya fue reportado; si existe, anadir el contexto especifico del proyecto como reply en vez de duplicar.
**VALOR:** Anadir contexto a issues existentes aumenta la prioridad que Atlassian asigna al bug y evita la fragmentacion de informacion sobre el mismo problema.
**IMPLEMENTACION:** Workflow: `1. Buscar por terminos clave en community.developer.atlassian.com. 2. Si existe thread: anadir reply con "We are experiencing the same in [context] with Forge Runtime [version]. Impact: [description]. Workaround attempted: [details]". 3. Si no existe: crear nuevo thread con titulo descriptivo, version de Forge, pasos para reproducir, y logs.` Linkar el thread en la tarea interna.
**AUDITORIA:** Ralph verifica que los tickets de soporte interno referencian un thread de la comunidad y que no existen tickets duplicados para el mismo issue conocido.

### ROVO-INTEG-046-05
**DEFINICION:** Las soluciones y workarounds descubiertos durante el desarrollo deben contribuirse de vuelta a la comunidad Atlassian dentro de los 15 dias posteriores a su implementacion exitosa.
**VALOR:** La contribucion reciproca mantiene el ecosistema saludable, genera buena voluntad con el equipo de Atlassian, y puede resultar en soporte prioritario para issues futuros.
**IMPLEMENTACION:** Despues de resolver un issue con un workaround propio: `1. Crear post en la categoria correcta del foro. 2. Incluir: problema, solucion, version de Forge, snippet de codigo. 3. Anadir tag "workaround".` Registrar la contribucion en `docs/community-contributions.md` con fecha y URL del post.
**AUDITORIA:** Ralph verifica que `docs/community-contributions.md` existe y que las contribuciones estan registradas dentro de los 15 dias posteriores a la resolucion del issue.
