# [RB-059] The Mythical Man-Month

> Libro: Fred Brooks - The Mythical Man-Month: Essays on Software Engineering

## Reglas

### ARCH-SOLID-064
**DEFINICION:** La arquitectura de Rovo Execution Guard debe mantener integridad conceptual: un unico arquitecto (Claude) define las decisiones de diseno fundamentales y ningun modulo las contradice.
**VALOR:** Sin integridad conceptual, un desarrollador puede implementar el enforcement de GitHub con un modelo de datos incompatible con el de Jira, generando integraciones fragiles que fallan en produccion de formas impredecibles.
**IMPLEMENTACION:** Todas las decisiones arquitectonicas (modelo de datos de dominio, interfaces entre capas, estrategia de errores, formato de logs) deben estar documentadas en `/docs/architecture/` y ser aprobadas por el arquitecto antes de la implementacion. Ralph verifica conformidad en cada PR.
**AUDITORIA:** Ralph verifica que cada nuevo modulo siga los patrones arquitectonicos documentados y rechaza implementaciones que los contradigan.

### FORGE-OPS-055
**DEFINICION:** No existe una solucion tecnica unica que resuelva todos los problemas de calidad de tickets. El sistema debe disenarse como capas incrementales de validacion, no como una bala de plata.
**VALOR:** Intentar resolver la validacion de tickets con una sola consulta magica a Rovo genera falsos positivos y una solucion fragil. El sistema real necesita capas: validacion estructural, validacion contextual, validacion cruzada con GitHub.
**IMPLEMENTACION:** Disenar el pipeline de validacion como etapas independientes y acumulativas: (1) validacion estructural del ticket (campos requeridos), (2) validacion contextual via Rovo (consistencia con documentacion), (3) validacion cruzada Jira-GitHub (PR vs ticket). Cada etapa puede pasar o fallar independientemente y contribuir al Consistency Score final.
**AUDITORIA:** Ralph verifica que el sistema de scoring no dependa de una unica fuente de validacion y que cada capa contribuya de forma independiente al resultado final.

### FORGE-OPS-056
**DEFINICION:** Las estimaciones de esfuerzo para nuevas features deben basarse en evidencia historica de tareas anteriores, no en optimismo. Los plazos se ajustan al agregar personas, no se reducen proporcionalmente.
**VALOR:** Anyadir una nueva integracion (por ejemplo, Bitbucket ademas de GitHub) no es simplemente "el doble de trabajo" porque la coordinacion entre las integraciones y las pruebas cruzadas crean complejidad adicional.
**IMPLEMENTACION:** Cada tarea de Ralph (TASK-XXX.md) debe incluir una estimacion basada en tareas anteriores completadas. Mantener un registro de tiempos reales vs estimados en `/docs/metrics/`. Ralph usa este historial para ajustar el scope del MVP.
**AUDITORIA:** Ralph compara las estimaciones de las nuevas tareas contra el historial de tareas completadas y ajusta el scope si la evidencia indica que la estimacion es optimista.
