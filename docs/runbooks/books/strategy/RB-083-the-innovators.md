# [RB-083] The Innovators

> Libro: Walter Isaacson - The Innovators: How a Group of Hackers, Geniuses, and Geeks Created the Digital Revolution

## Reglas

### ROVO-INTEG-0831
**DEFINICION:** La integracion con Rovo debe ser iterativa: la primera version usa solo campos basicos de tickets, la segunda agrega contexto de Confluence, la tercera incorpora patrones historicos del equipo. Cada iteracion agrega valor sin invalidar la anterior.
**VALOR:** La innovacion real ocurre en iteraciones colaborativas, no en grandes disenos upfront. Cada capa de contexto de Rovo mejora el scoring sin romper lo que ya funciona. El equipo puede aprender de cada iteracion.
**IMPLEMENTACION:** Implementar el acceso a Rovo como estrategias intercambiables: `RovoStrategyV1` (solo campos de Jira), `RovoStrategyV2` (Jira + Confluence), `RovoStrategyV3` (Jira + Confluence + patrones historicos). Cada estrategia implementa la misma interfaz `RovoContextProvider`. La activacion de cada version es gradual via feature flags.
**AUDITORIA:** Ralph verifica que cada version de RovoStrategy pase los mismos tests de interfaz y que las versiones anteriores sigan funcionando independientemente.

### ARCH-SOLID-0832
**DEFINICION:** Los adapters de APIs externas (Jira, GitHub, Confluence, Rovo) deben ser construidos colaborativamente: una persona define la interfaz, otra implementa el adapter, y una tercera escribe los tests de contrato.
**VALOR:** La colaboracion entre roles diferentes genera mejores abstracciones. El adapter de GitHub, por ejemplo, beneficia de alguien que piensa en la interfaz (que necesita el orchestration) y alguien que piensa en los detalles de la API (paginacion, rate limits).
**IMPLEMENTACION:** Para cada adapter en `src/backend/integration/`: primero definir la interfaz en `types.ts`, luego implementar en `adapter.ts`, y crear tests de contrato en `contract.test.ts`. Las interfaces se definen desde la perspectiva del consumidor (la capa de orchestration), no desde la API externa.
**AUDITORIA:** Ralph verifica que cada adapter tenga sus tres archivos (types.ts, adapter.ts, contract.test.ts) y que la interfaz este definida en terminos del dominio, no de la API externa.

### TEST-QA-0833
**DEFINICION:** Los tests deben evolucionar junto con el producto: tests unitarios en la iteracion 1, tests de integracion en la iteracion 2, tests E2E en la iteracion 3. No intentar escribir tests E2E antes de que los unitarios sean solidos.
**VALOR:** La innovacion exitosa construye sobre fundamentos solidos. Intentar E2E sin unitarios estables genera friccion y falsos negativos. Cada tipo de test se agrega cuando el modulo esta listo para ese nivel de validacion.
**IMPLEMENTACION:** Fase 1: cada modulo de dominio tiene tests unitarios con >90% coverage. Fase 2: los flujos entre dominio + integration tienen tests de integracion con APIs mockeadas. Fase 3: los flujos completos (trigger Jira -> enforcement GitHub) tienen tests E2E con Playwright contra un entorno de staging.
**AUDITORIA:** Ralph verifica que la proporcion de tests sea aproximadamente 70% unitarios, 20% integracion, 10% E2E y que no existan modulos sin tests unitarios que tengan tests de integracion.

### FORGE-OPS-0834
**DEFINICION:** Cada iteracion del producto debe poder desplegarse independientemente: un cambio en el scoring engine no requiere redeployar el admin dashboard, y viceversa.
**VALOR:** La iteracion rapida requiere deploy independiente. Si cada cambio requiere un deploy completo del Forge app, la velocidad de iteracion se reduce drasticamente. Los modulos deben ser desplegables de forma independiente dentro de los limites de Forge.
**IMPLEMENTACION:** Estructurar el Forge app con modulos independientes en el manifest.yml: cada modulo tiene sus propios handlers y puede actualizarse sin afectar otros. Usar `forge deploy --module <name>` cuando sea posible. Los modulos se comunican via Forge Storage, no via imports directos.
**AUDITORIA:** Ralph verifica que la estructura del manifest.yml permita deploy de modulos individuales y que no haya dependencias circulares entre modulos.

### GIT-CI-0835
**DEFINICION:** El historial de git debe reflejar la naturaleza colaborativa e iterativa del desarrollo: cada feature se desarrolla en una rama con commits frecuentes que muestran la evolucion del pensamiento, no un solo commit squash.
**VALOR:** El historial de git es la narrativa de la innovacion. Los commits frecuentes en una rama de feature muestran como se resolvieron problemas, que caminos se exploraron y descartaron, y como se llego a la solucion final.
**IMPLEMENTACION:** Las ramas de feature usan el formato `feat/TASK-XXX-descripcion`. Los commits en la rama son atomicos y frecuentes (no squash). Al mergear a main, usar merge commit (no squash) para preservar el historial. El PR description resume la evolucion de la feature.
**AUDITORIA:** Ralph verifica que las ramas de feature tengan commits frecuentes (al menos uno por dia de desarrollo activo) y que los merge commits a main no sean squash.
