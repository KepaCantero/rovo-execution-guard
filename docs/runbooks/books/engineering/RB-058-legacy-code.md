# [RB-058] Working Effectively with Legacy Code

> Libro: Michael Feathers - Working Effectively with Legacy Code

## Reglas

### TEST-QA-054
**DEFINICION:** Antes de modificar cualquier logica existente de Quality Gates o enforcement, se deben crear tests de caracterizacion que capturen el comportamiento actual, incluso si ese comportamiento contiene bugs conocidos.
**VALOR:** Si se modifica el calculo del Consistency Score sin tests de caracterizacion, un cambio en la ponderacion de los ejes puede causar que tickets criticos pasen sin bloqueo o que tickets validos sean bloqueados masivamente.
**IMPLEMENTACION:** Para cada modulo a modificar en `/src/backend/services/scoring/`, crear tests que documenten el comportamiento actual: "Dado un issue con score 78 y threshold 80, el resultado es BLOCKED". Estos tests se escriben ANTES del cambio y se mantienen como regresion.
**AUDITORIA:** Ralph rechaza cualquier PR que modifique logica de dominio sin incluir tests de caracterizacion del comportamiento previo.

### ARCH-SOLID-063
**DEFINICION:** Utilizar "seams" (puntos de costura) para desacoplar dependencias externas de Forge APIs, Rovo, y GitHub antes de refactorizar, de modo que los cambios se puedan probar sin levantar infraestructura real.
**VALOR:** El runtime de Forge no permite ejecucion local directa. Sin seams que permitan inyectar mocks de `@forge/api`, cualquier refactor en un resolver requiere un deploy a development para verificar que funciona.
**IMPLEMENTACION:** Crear wrappers en `/src/backend/services/` que encapsulen las llamadas a `@forge/api`: `ForgeStorageClient`, `ForgeJiraClient`, `ForgeGitHubClient`. En tests, inyectar implementaciones mock. En produccion, las implementaciones concretas delegan a `@forge/api`.
**AUDITORIA:** Ralph verifica que ninguna funcion de dominio o logica de negocio haga llamadas directas a `@forge/api` sin pasar por un wrapper inyectable.

### TEST-QA-055
**DEFINICION:** Cuando se encuentre codigo sin tests, se debe crear un "sprout" (brote) de la nueva funcionalidad en una funcion separada con tests propios, en vez de anyadir logica al codigo existente no testeado.
**VALOR:** Si el resolver que maneja el webhook de GitHub no tiene tests y se le anyade logica de deteccion de inconsistencias inline, el resultado es un modulo mas grande y menos testeable que antes.
**IMPLEMENTACION:** Crear la nueva logica en una funcion pura separada (por ejemplo, `detectPRJiraInconsistency(prContext, issueContext)`) con sus tests completos. El resolver existente simplemente llama a la nueva funcion. La funcion antigua queda intacta y la nueva esta completamente cubierta.
**AUDITORIA:** Ralph revisa que las nuevas funcionalidades anyadidas a modulos sin cobertura se implementen como funciones nuevas separadas con tests, no como extensiones inline del codigo existente.
