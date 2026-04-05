# [RB-100] The Innovator's Dilemma

> Libro: Clayton Christensen - The Innovator's Dilemma: When New Technologies Cause Great Firms to Fail

## Reglas

### ARCH-SOLID-1001
**DEFINICION:** Rovo Execution Guard debe mantener un "dual-track" arquitectural: el track principal (scoring basico, enforcement activo, validacion local) y el track disruptivo (contexto Rovo avanzado, IA, cross-project patterns), donde el track disruptivo puede fallar sin afectar al principal.
**VALOR:** Christensen muestra que la innovacion disruptiva requiere recursos protegidos separados del negocio principal. Si la integracion con Rovo (track disruptivo) falla, el scoring basico (track principal) debe seguir funcionando perfectamente. Los dos tracks no pueden compartir puntos de fallo.
**IMPLEMENTACION:** Track principal en `src/backend/domain/scoring/engines/basic.engine.ts` usa solo datos de Jira, sin dependencias externas. Track disruptivo en `src/backend/domain/scoring/engines/enhanced.engine.ts` usa Rovo + IA. El `ScoringEngineFacade` intenta el track disruptivo primero, si falla (timeout, error, sin contexto), cae al track principal. El track principal nunca importa nada del paquete de Rovo.
**AUDITORIA:** Ralph verifica que el track principal funcione completamente sin las dependencias del track disruptivo y que no existan imports del paquete Rovo en el track principal.

### ROVO-INTEG-1002
**DEFINICION:** Las nuevas capacidades de Rovo (nuevos tipos de contexto, nuevas APIs) deben integrarse como features opt-in con valor incremental, no como cambios obligatorios que reescriben la funcionalidad existente.
**VALOR:** Christensen demuestra que los clientes adoptan innovaciones incrementalmente, no de una vez. Si Rovo agrega una nueva capacidad de contexto, los proyectos existentes deben poder usarla solo cuando esten listos. Forzar la adopcion destruye la base instalada.
**IMPLEMENTACION:** Cada nueva capacidad de Rovo se implementa como un `RovoCapabilityModule` que se registra en un catalogo. Los proyectos activan capacidades individualmente en su configuracion: `{ enabledCapabilities: ['basic-context', 'confluence-search', 'cross-project-patterns'] }`. Las capacidades no activadas no se ejecutan ni consumen recursos. El valor de cada capacidad se mide independientemente.
**AUDITORIA:** Ralph verifica que las nuevas capacidades de Rovo sean opt-in por proyecto y que desactivar una capacidad no afecte a las demas.

### FORGE-OPS-1003
**DEFINICION:** El producto debe tener una estrategia de "mercado emergente": disenar las features de enforcement para un segmento inicial (equipos de 5-15 desarrolladores con Jira Cloud + GitHub) y optimizar agresivamente para ese segmento antes de expandirse.
**VALOR:** Christensen muestra que las innovaciones exitosas dominan un nicho antes de expandirse. Rovo Execution Guard debe ser el mejor producto para equipos de software que usan Jira + GitHub, no un producto mediocre para todos los casos de uso de Atlassian.
**IMPLEMENTACION:** Los defaults de configuracion, los thresholds de scoring, y las reglas de enforcement estan optimizados para el workflow de un equipo de software (sprints, stories, PRs, code reviews). Documentar las decisiones de diseno en `docs/architecture/decisions/` con el contexto del segmento objetivo. Expandir a otros segmentos (equipos de marketing, soporte) requiere un nuevo set de defaults, no modificar los existentes.
**AUDITORIA:** Ralph verifica que los defaults esten optimizados para equipos de software y que las decisiones de diseno para el segmento inicial esten documentadas.

### TEST-QA-1004
**DEFINICION:** Las nuevas features deben validarse contra el mercado existente: cada feature nueva se mide por su impacto en la metrica principal (rework reduction) antes de ser promovida de experimental a estable.
**VALOR:** Christensen advierte sobre agregar features que nadie pidio. Cada feature de Rovo Execution Guard debe demostrar que reduce rework antes de ser permanente. Una feature experimental que no mejora la metrica principal se elimina, no se mantiene "por si acaso".
**IMPLEMENTACION:** Cada feature nueva se despliega como experimental (feature flag activado solo para proyectos piloto). Despues de 2 sprints, medir: 1) adopcion (cuantos proyectos la activaron), 2) impacto en rework reduction, 3) false positive rate. Si la feature no mejora la metrica principal en al menos 5%, se marca para deprecacion. Las features experimentales tienen un TTL maximo de 4 sprints.
**AUDITORIA:** Ralph verifica que cada feature experimental tenga su metrica de impacto definida y que las features que no mejoran la metrica principal se deprequen despues del periodo de evaluacion.

### GIT-CI-1005
**DEFINICION:** El pipeline de CI/CD debe soportar "canary deploys": desplegar nuevas versiones del Forge app al 10% de los proyectos primero, medir el impacto en errores y rendimiento, y expandir gradualmente al 100% si no hay regresiones.
**VALOR:** La innovacion disruptiva requiere despliegues cuidadosos. Un deploy al 100% de golpe que introduce un bug afecta a todos los usuarios. Los canary deploys limitan el impacto de los problemas a un subconjunto de proyectos, permitiendo deteccion temprana.
**IMPLEMENTACION:** Implementar `CanaryDeploymentService` que: 1) mantiene una lista de proyectos "canary" (los primeros en recibir actualizaciones), 2) despues de deploy, monitoriza error rate y latencia de los proyectos canary vs el baseline, 3) si no hay regresiones en 24 horas, expande al 50% de proyectos, 4) si no hay regresiones en otras 24 horas, expande al 100%. Si se detectan regresiones, rollback automatico.
**AUDITORIA:** Ralph verifica que el proceso de canary deploy este implementado y que existan proyectos canary configurados para cada nueva version.
