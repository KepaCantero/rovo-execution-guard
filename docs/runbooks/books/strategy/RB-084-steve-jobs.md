# [RB-084] Steve Jobs

> Libro: Walter Isaacson - Steve Jobs

## Reglas

### UI-ADS-0841
**DEFINICION:** El Jira issue panel de Rovo Execution Guard debe mostrar exactamente tres estados visuales (verde: aprobado, rojo: bloqueado, amarillo: advertencia) con un score numerico y una lista de acciones requeridas. Nada mas.
**VALOR:** La simplicidad extrema en la UI permite al usuario entender el estado de su ticket en menos de 3 segundos. Los paneles sobrecargados de informacion generan fatiga y son ignorados, derrotando el proposito del enforcement.
**IMPLEMENTACION:** Usar los componentes de Atlassian Design System (ADS): `Lozenge` para el estado, `ProgressBar` para el score, y `Checkbox` para las acciones requeridas. El panel ocupa un maximo de 300px de alto. Cualquier informacion adicional (detalles de inconsistencias, contexto de Rovo) esta oculta detras de un expandible.
**AUDITORIA:** Ralph verifica que el issue panel renderice en menos de 3 segundos y que el viewport inicial contenga solo los tres elementos: estado, score, acciones.

### ARCH-SOLID-0842
**DEFINICION:** Cada funcion publica en el dominio debe tener un nombre que describa exactamente que hace sin necesidad de leer el cuerpo. Si el nombre no es autoexplicativo, la funcion hace demasiadas cosas.
**VALOR:** La simplicidad de Jobs aplicada al codigo: si necesitas leer la implementacion para entender que hace, el diseno es incorrecto. En un sistema de enforcement, la claridad es critica para la confianza.
**IMPLEMENTACION:** Nombres de funciones deben seguir el patron `verbo + objeto + contexto`: `calculateConsistencyScore()`, `detectDocumentationInconsistencies()`, `blockTicketTransition()`, `failGitHubStatusCheck()`. Cada funcion tiene maximo 40 lineas. Si excede, extraer subfunciones con nombres descriptivos.
**AUDITORIA:** Ralph verifica que no existan funciones publicas en `src/backend/domain/` con mas de 40 lineas y que cada nombre de funcion sea autoexplicativo sin leer el cuerpo.

### FORGE-OPS-0843
**DEFINICION:** El flujo de validacion debe ejecutarse en el menor numero posible de pasos secuenciales, eliminando cualquier llamada a API externa que no sea estrictamente necesaria para la decision de enforcement.
**VALOR:** La simplicidad no es estetica, es rendimiento. Cada llamada a API innecesaria agrega latencia y puntos de fallo. El enforcement debe ser rapido y confiable, o los usuarios lo desactivaran.
**IMPLEMENTACION:** El flujo de validacion sigue una secuencia estricta: 1) Leer datos cacheados del ticket, 2) Si no hay cache, fetch de Jira (unico fetch), 3) Calcular score con datos locales, 4) Ejecutar enforcement. El contexto de Rovo se obtiene de cache (pre-calculado por un trigger previo) y nunca se fetcha sincronicamente durante la validacion.
**AUDITORIA:** Ralph verifica que el flujo de validacion no contenga mas de 2 llamadas a APIs externas secuenciales y que el cache de Rovo este pre-poblado por triggers.

### SEC-PRIV-0844
**DEFINICION:** Los permisos del Forge app deben ser los minimos absolutos necesarios: cada scope en el manifest.yml debe tener un comentario explicando por que es necesario y que funcionalidad lo requiere.
**VALOR:** Jobs no aceptaba features innecesarias. Los permisos innecesarios son una feature innecesaria que incrementa la superficie de ataque y reduce la confianza del administrador que instala el app.
**IMPLEMENTACION:** En el `manifest.yml`, cada scope tiene un comentario: `# Required for: reading issue fields in quality gate validation`. Si un scope se usa solo en una feature experimental, se marca con `# Experimental: [feature name]` y se protege con feature flag.
**AUDITORIA:** Ralph verifica que cada scope en el manifest.yml tenga su comentario de justificacion y que no existan scopes que se puedan eliminar sin romper funcionalidad en produccion.

### ROVO-INTEG-0845
**DEFINICION:** La configuracion por proyecto debe tener defaults que funcionen correctamente sin personalizacion, de modo que un equipo nuevo instale el Forge app y obtenga valor inmediato sin configurar nada.
**VALOR:** La experiencia de usuario perfecta es zero configuracion. Si el app requiere configuracion manual extensiva antes de funcionar, la mayoria de equipos nunca lo completara. Los defaults deben ser "magicos" por que estan bien elegidos.
**IMPLEMENTACION:** Implementar `DefaultProjectConfig` en `src/backend/config/defaults.ts` con valores optimizados para equipos de software: score threshold 80%, required fields (summary, description, acceptance criteria), enforcement activado. El primer trigger en un proyecto sin configuracion usa los defaults y los almacena en Forge Storage para personalizacion futura.
**AUDITORIA:** Ralph verifica que el Forge app funcione correctamente con la configuracion por defecto en un proyecto nuevo sin ninguna personalizacion manual.
