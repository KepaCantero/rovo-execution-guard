# [RB-072] Superintelligence

> Libro: Nick Bostrom - Superintelligence: Paths, Dangers, Strategies

## Reglas

### ROVO-INTEG-057
**DEFINICION:** El sistema debe implementar controles de capacidad sobre las acciones que Rovo puede desencadenar: ninguna accion de enforcement puede ejecutarse sin pasar por un conjunto de reglas deterministas que actuen como guardrails.
**VALOR:** Si una actualizacion de Rovo cambia su comportamiento y empieza a clasificar todos los tickets como inconsistentes, los guardrails deterministas deben detectar la anomalia y activar el modo degradado antes de que el sistema bloquee masivamente.
**IMPLEMENTACION:** Implementar capas de control: (1) reglas deterministas previas a la consulta de Rovo (validacion estructural obligatoria), (2) validacion de la respuesta de Rovo (verificar que el score esta en rango 0-100, que las inconsistencias tienen formato valido), (3) sanity check post-calculo (si mas del 30% de tickets de un proyecto son bloqueados en 1 hora, activar modo degradado automaticamente).
**AUDITORIA:** Ralph verifica que existan guardrails deterministas tanto antes como despues de la consulta a Rovo y que el sistema de deteccion de anomalias este activo.

### SEC-PRIV-054
**DEFINICION:** Los permisos de la integracion con GitHub y Jira deben seguir el principio de minimo privilegio: el sistema solo puede realizar las acciones estrictamente necesarias para el enforcement, y cualquier permiso adicional debe justificarse explicitamente.
**VALOR:** Si el sistema tiene permisos de `repo:write` completo en GitHub cuando solo necesita crear status checks y comentarios, un bug en el codigo podria teoricamente modificar codigo o mergear PRs, causando dano catastrofico.
**IMPLEMENTACION:** En el `manifest.yml` de Forge, declarar unicamente los scopes necesarios: `read:jira-work`, `write:jira-work` (solo para transiciones), `read:confluence`, y para GitHub: solo los endpoints de checks y comments. Documentar cada scope requerido con su justificacion. Revisar permisos en cada release.
**AUDITORIA:** Ralph revisa los scopes declarados en `manifest.yml` y alerta si se anyaden permisos nuevos sin justificacion documentada en el changelog.

### ROVO-INTEG-058
**DEFINICION:** El sistema debe implementar un "kill switch" configurable por proyecto que permita desactivar completamente la integracion con Rovo y el enforcement, manteniendo la app funcional en modo observacion (sin bloqueo).
**VALOR:** Si se detecta un comportamiento anomalo en el sistema (por ejemplo, Rovo esta devolviendo respuestas corruptas), los administradores del proyecto deben poder desactivar el enforcement inmediatamente sin esperar a un deploy.
**IMPLEMENTACION:** Implementar toggle por proyecto en la configuracion (`/config/project-rules.json`): `enforcementMode: "enforce" | "warn" | "observe" | "disabled"`. En modo "observe", el sistema calcula scores y registra eventos pero no ejecuta ninguna accion de bloqueo. En modo "disabled", las consultas a Rovo se omiten completamente. El toggle se puede cambiar desde el Admin Dashboard sin deploy.
**AUDITORIA:** Ralph verifica que el kill switch exista, que los tres modos funcionen correctamente, y que los tests cubran cada modo de operacion.
