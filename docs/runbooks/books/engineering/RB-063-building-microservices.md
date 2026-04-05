# [RB-063] Building Microservices

> Libro: Sam Newman - Building Microservices: Designing Fine-Grained Systems

## Reglas

### ROVO-INTEG-054
**DEFINICION:** Los contratos de comunicacion entre los modulos de Jira, GitHub, y Rovo deben estar definidos explicitamente como interfaces TypeScript versionadas, no como implementaciones compartidas.
**VALOR:** Si la interfaz entre el modulo de GitHub y el de scoring cambia sin coordinacion, el enforcement falla silenciosamente. Un contrato versionado permite que ambos modulos evolucionen independientemente.
**IMPLEMENTACION:** Definir interfaces en `/src/backend/types/contracts/`: `IValidationRequest`, `IValidationResponse`, `IEnforcementCommand`. Versionar los contratos: `ValidationRequestV1`, `ValidationRequestV2`. Los adaptadores deben declarar que version del contrato implementan.
**AUDITORIA:** Ralph verifica que las interfaces entre modulos esten versionadas y que los cambios en un contrato generen una nueva version en vez de modificar la existente.

### FORGE-OPS-060
**DEFINICION:** Un fallo en la integracion con GitHub o Rovo no debe propagarse y causar un fallo cascada en los demas modulos del sistema.
**VALOR:** Si la API de GitHub esta caida y el sistema no puede actualizar el status check, esto no debe impedir que las validaciones de Jira funcionen normalmente. El aislamiento de fallos permite que el sistema siga operativo parcialmente.
**IMPLEMENTACION:** Implementar timeouts independientes por modulo con `AbortController`: el timeout para Rovo puede ser de 10s, el de GitHub de 8s. Envolver cada llamada a API externa en un try-catch con fallback especifico. Si GitHub falla, registrar el fallo y continuar con la validacion de Jira usando un check "pending" en GitHub.
**AUDITORIA:** Ralph verifica que cada modulo de integracion tenga su propio timeout, su propio circuit breaker, y un fallback definido que no dependa del modulo fallido.

### ARCH-SOLID-070
**DEFINICION:** Cada modulo funcional (Jira validation, GitHub enforcement, Rovo context, Scoring) debe poder ser deployado, testeado y reemplazado de forma independiente sin afectar a los demas.
**VALOR:** Si se necesita cambiar la estrategia de scoring de un proyecto (por ejemplo, ajustar los pesos de los ejes del Consistency Score), esto no debe requerir un redeploy de la integracion con GitHub ni cambios en la UI.
**IMPLEMENTACION:** Cada modulo en `/src/backend/services/` debe tener sus propios tests, su propio archivo `.reqs.md`, y sus propias constantes de configuracion. Los modulos se comunican exclusivamente a traves de las interfaces definidas en `/src/backend/types/`. La configuracion de cada modulo se carga de forma independiente desde Forge Storage.
**AUDITORIA:** Ralph verifica que un cambio en un solo modulo pueda ser deployado sin requerir cambios en los archivos de otros modulos.
