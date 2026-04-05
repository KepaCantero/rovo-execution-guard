# [RB-054] Clean Architecture

> Libro: Robert C. Martin - Clean Architecture: A Craftsman's Guide to Software Structure and Design

## Reglas

### ARCH-SOLID-056
**DEFINICION:** Las dependencias entre capas del proyecto solo pueden apuntar hacia adentro: la capa de presentacion depende de la capa de orquestacion, que depende de la capa de dominio. Nunca al reves.
**VALOR:** Si la capa de dominio (calculo de Consistency Score) importa algo de la capa de integracion (cliente HTTP de GitHub), un cambio en la API de GitHub rompe la logica de scoring. Esto convierte un cambio de infraestructura en un riesgo de negocio.
**IMPLEMENTACION:** Estructura de carpetas estricta: `/src/backend/services/scoring/` (dominio, sin dependencias externas) -> `/src/backend/services/rovo/`, `/src/backend/services/jira/`, `/src/backend/services/github/` (integracion, implementan interfaces del dominio) -> `/src/backend/resolvers/` (orquestacion) -> `/src/frontend/` (presentacion). El dominio define interfaces como `IContextProvider`, `IIssueRepository`, `IPREnforcer`.
**AUDITORIA:** Ralph ejecuta un analisis de imports y falla el pipeline si detecta que un archivo en `/services/scoring/` importa desde `/services/github/`, `/services/rovo/`, o cualquier modulo de presentacion.

### ARCH-SOLID-057
**DEFINICION:** Los boundaries entre la integracion con Forge APIs, Rovo, GitHub y Jira deben estar definidos por interfaces del dominio, no por implementaciones concretas.
**VALOR:** Esto permite simular (mock) completamente las APIs externas en tests unitarios sin tocar infraestructura real, y permite cambiar el proveedor de IA (Rovo a otro) sin alterar la logica de Quality Gates.
**IMPLEMENTACION:** Definir interfaces en `/src/backend/types/`: `IConsistencyScorer`, `IIssueFetcher`, `IPRStatusUpdater`, `IContextRetriever`. Los adaptadores en `/services/` implementan estas interfaces. Los resolvers reciben las interfaces via inyeccion, nunca instancias concretas.
**AUDITORIA:** Ralph verifica que ningun resolver o servicio de dominio tenga un `import` directo de un adaptador concreto en vez de su interfaz correspondiente.

### ARCH-SOLID-058
**DEFINICION:** La capa de dominio no debe conocer nada sobre Forge, React, HTTP, ni ningun framework. Las entidades de negocio como `ConsistencyScore`, `InconsistencyReport`, y `QualityGateResult` deben ser clases puras de TypeScript sin decoradores ni dependencias de framework.
**VALOR:** Si las entidades de dominio estan acopladas a Forge, no se pueden testear sin levantar el runtime de Forge, lo que hace los tests unitarios lentos y fragiles.
**IMPLEMENTACION:** Todas las entidades en `/src/backend/services/scoring/` deben ser archivos `.ts` con tipos e interfaces puras, sin importar nada de `@forge/api`, `@forge/react`, ni paquetes npm externos. Solo se permite importar tipos de `/src/backend/types/` y utilidades puras de `/src/backend/utils/`.
**AUDITORIA:** Ralph inspecciona los archivos en `/services/scoring/` y rechaza cualquier import de paquetes externos o de framework.
