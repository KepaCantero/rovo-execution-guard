# [RB-068] The DevOps Handbook

> Libro: Gene Kim, Patrick Debois, John Willis, Jez Humble - The DevOps Handbook: How to Create World-Class Agility, Reliability, and Security in Technology Organizations

## Reglas

### GIT-CI-056
**DEFINICION:** Todo cambio de codigo en Rovo Execution Guard debe pasar por el pipeline CI/CD completo en lotes pequenos y frecuentes, no en megabranches con semanas de trabajo acumulado.
**VALOR:** Un branch con 2 semanas de cambios genera conflictos de merge masivos y hace imposible identificar cual de los 50 commits introdujo un bug en el calculo del Consistency Score. Los lotes pequenos reducen el riesgo y facilitan la reversion.
**IMPLEMENTACION:** Limitar el tamano de las PRs a un maximo de 400 lineas de codigo cambiado. Las features grandes deben dividirse en sub-tareas de Ralph (TASK-XXX-A, TASK-XXX-B) que se integran incrementalmente. Cada PR debe poder mergearse en menos de 2 dias habiles.
**AUDITORIA:** Ralph mide el tamano de las PRs y rechaza aquellas que superen las 400 lineas de cambio sin una justificacion documentada en la tarea.

### GIT-CI-057
**DEFINICION:** Cuando un despliegue a produccion falle o cause un incidente, el equipo debe realizar una retrospective blameless documentada con causa raiz y accion correctiva en menos de 48 horas.
**VALOR:** Si un deploy introduce un bug que bloquea todos los tickets de un proyecto, la retrospective blameless permite identificar la causa (por ejemplo, falta de test de regresion en el threshold) sin apuntar a personas, previniendo la repeticion del error.
**IMPLEMENTACION:** Crear una plantilla de retrospective en `/docs/templates/postmortem.md` que incluya: timeline del incidente, causa raiz, impacto en usuarios (tickets bloqueados, PRs afectados), accion correctiva con Jira ID asignado, y mejora al pipeline propuesta.
**AUDITORIA:** Ralph verifica que cada incidente de produccion tenga su retrospective documentada y que las acciones correctivas tengan tareas de Jira asignadas.

### FORGE-OPS-063
**DEFINICION:** El sistema CI/CD debe implementar automated testing en multiples niveles: cada commit dispara unit tests, cada PR dispara integration tests, y cada deploy a staging dispara E2E tests completos.
**VALOR:** Confiar solo en un tipo de test deja brechas: los unit tests no detectan problemas de integracion con Rovo, los integration tests no detectan problemas en la UI del Spider Chart, y los E2E tests no detectan errores de calculo en funciones individuales.
**IMPLEMENTACION:** Niveles automatizados: (1) Pre-commit hook: unit tests del modulo afectado, (2) GitHub Actions PR check: unit + integration tests de todos los modulos + cobertura minima 85%, (3) Deploy a staging: Playwright E2E del flujo completo Jira-Rovo-GitHub, (4) Smoke test post-deploy: health check en produccion.
**AUDITORIA:** Ralph verifica que cada nivel de testing este configurado y que no sea posible saltarse un nivel sin aprobacion explicita.
