# [RB-097] Godel, Escher, Bach

> Libro: Douglas Hofstadter - Godel, Escher, Bach: An Eternal Golden Braid

## Reglas

### ARCH-SOLID-0971
**DEFINICION:** El sistema de scoring debe soportar composicion recursiva: una regla de scoring puede contener sub-reglas que a su vez pueden contener sub-reglas, permitiendo arboles de decision de profundidad arbitraria sin cambios en el engine.
**VALOR:** Hofstadter demuestra que los sistemas con autorreferencia son los mas poderosos. Un scoring engine donde una regla "complejidad del epic" puede contener sub-reglas ("numero de tickets hijos", "consistencia entre tickets hijos") es mas expresivo que un sistema plano. La recursion permite modelar la complejidad real de la validacion de tickets.
**IMPLEMENTACION:** Definir tipo `ScoringRule` como union: `type ScoringRule = LeafRule | CompositeRule`. `LeafRule` evalua directamente. `CompositeRule` contiene un array de `ScoringRule` y una funcion de aggregation (AND, OR, WEIGHTED_AVG). El `ScoringEngine` procesa el arbol recursivamente. La profundidad maxima es 5 niveles (configurable). Ejemplo: `epicConsistencyRule` contiene `ticketCountRule` + `crossReferenceRule` con aggregation WEIGHTED_AVG.
**AUDITORIA:** Ralph verifica que el tipo `ScoringRule` soporte composicion recursiva y que existan tests con reglas de profundidad >= 3 niveles.

### ROVO-INTEG-0972
**DEFINICION:** El sistema debe poder evaluar su propia precision: un meta-score que mida la confiabilidad del scoring engine comparando sus predicciones (score alto = ticket valido) con los resultados reales (ticket genero rework o no).
**VALOR:** La autorreferencia de Godel aplicada al producto: el sistema debe poder hablar sobre si mismo. Si el meta-score indica que la precision esta bajando, el equipo puede intervenir antes de que los usuarios pierdan confianza en el enforcement.
**IMPLEMENTACION:** Implementar `MetaScoringService` en `src/backend/observability/meta/`. Despues de que un ticket se cierra (estado Done), verificar si genero rework (reaperturas, comentarios de confusion, PRs rechazados). Comparar con el score original. Calcular `metaScore = correlacion(score_original, genero_rework)`. Si `metaScore < 0.7`, generar alerta. Reportar semanalmente en el admin dashboard.
**AUDITORIA:** Ralph verifica que el meta-score se calcule para tickets cerrados y que el admin dashboard muestre la correlacion entre scores y outcomes reales.

### TEST-QA-0973
**DEFINICION:** Los tests del sistema deben incluir tests sobre tests: los fixtures de test deben validarse automaticamente para asegurar que representan datos realistas y que no se han degradado con el tiempo.
**VALOR:** Un fixture de test que representa un "ticket valido" puede volverse obsoleto si cambian los requerimientos del proyecto. Los tests sobre tests aseguran que los fixtures sigan siendo representativos del mundo real.
**IMPLEMENTACION:** Crear `tests/fixtures/validation/` que contiene tests que verifican: 1) cada fixture tiene los campos obligatorios de un ticket real, 2) los fixtures "validos" pasarian las reglas basicas de scoring, 3) los fixtures "invalidos" efectivamente fallarian las reglas. Estos tests se ejecutan antes de los tests unitarios en el CI.
**AUDITORIA:** Ralph verifica que los fixtures de test sean validados automaticamente y que no existan fixtures que contradigan las reglas de scoring actuales.

### FORGE-OPS-0974
**DEFINICION:** Los patrones de deteccion de inconsistencias deben poder aprender de si mismos: el sistema debe detectar cuando dos detectores producen resultados contradictorios para el mismo ticket y generar una alerta para resolucion.
**VALOR:** En un sistema con multiples detectores de inconsistencias, es posible que uno diga "el ticket es consistente con la documentacion" y otro diga "el ticket contradice el epic". El sistema debe ser consciente de estas contradicciones internas y resolverlas, no ignorarlas.
**IMPLEMENTACION:** Despues de ejecutar todos los detectores, el `InconsistencyPipeline` verifica si hay resultados contradictorios (un detector dice "consistente" y otro dice "inconsistente" para el mismo aspecto). Si los hay: loggear con nivel "warn", aplicar un desempate configurado (peso del detector, confianza), y registrar la contradiccion en el audit log para revision manual.
**AUDITORIA:** Ralph verifica que el pipeline detecte contradicciones entre detectores y que las registre en el audit log con los IDs de los detectores involucrados.

### UI-ADS-0975
**DEFINICION:** La UI del issue panel debe poder mostrar informacion sobre si misma: un modo "debug" que muestre que reglas se evaluaron, cuanto tiempo tomo cada una, y que datos se usaron, accesible solo para administradores del proyecto.
**VALOR:** La autorreferencia en la UI permite que los administradores entiendan por que el sistema tomo una decision. Si un ticket fue bloqueado, el modo debug muestra el arbol de evaluacion completo, similar a como Godel construyo pruebas sobre pruebas.
**IMPLEMENTACION:** Agregar un boton "Debug" (visible solo si el usuario tiene permisos de admin) en el issue panel que expande una vista con: arbol de reglas evaluadas (con colores verde/rojo por resultado), tiempo de ejecucion por regla, datos de entrada usados (ticket snapshot, contexto Rovo), y version del scoring engine. Los datos se obtienen del audit log almacenado en Forge Storage.
**AUDITORIA:** Ralph verifica que el modo debug muestre el arbol completo de evaluacion y que solo sea accesible para usuarios con permisos de administrador del proyecto.
