# [RB-052] The Pragmatic Programmer

> Libro: Andrew Hunt & David Thomas - The Pragmatic Programmer: Your Journey to Mastery

## Reglas

### ARCH-SOLID-054
**DEFINICION:** Ningun fragmento de logica de negocio, configuracion de API o patron de validacion debe estar duplicado en dos o mas archivos del proyecto.
**VALOR:** Si el calculo del Consistency Score se duplica entre el trigger de Jira y el webhook de GitHub, un cambio en la formula produce inconsistencias en el enforcement y tickets bloqueados incorrectamente.
**IMPLEMENTACION:** Centralizar la logica de scoring en `/src/backend/services/scoring/`. Centralizar la configuracion de thresholds en `/src/backend/constants/`. Usar funciones compartidas en `/src/frontend/shared/` para la logica de presentacion del Spider Chart.
**AUDITORIA:** Ralph ejecuta deteccion de duplicacion de codigo y rechaza PRs donde la cobertura de duplicados supere el 3% en la capa de dominio.

### ARCH-SOLID-055
**DEFINICION:** Los modulos de integracion con Rovo, Jira, Confluence y GitHub deben ser ortogonales: un cambio en el adaptador de GitHub no debe afectar la logica de validacion de Rovo ni la UI del Issue Panel.
**VALOR:** La ortogonalidad permite modificar el cliente de GitHub API (por ejemplo, cambiar de REST a GraphQL) sin tocar la capa de scoring o la capa de presentacion. Esto reduce el riesgo en los deploys a Forge production.
**IMPLEMENTACION:** Separar en capas estrictas: `/src/backend/services/github/` solo contiene llamadas HTTP y transformacion de datos. `/src/backend/services/scoring/` solo contiene logica de dominio. Los resolvers en `/src/backend/resolvers/` orquestan ambas sin logica propia.
**AUDITORIA:** Ralph verifica que ningun archivo en `/services/github/` importe directamente desde `/services/scoring/` y viceversa, y que los resolvers no contengan logica de negocio inline.

### FORGE-OPS-052
**DEFINICION:** Cada feature nueva del MVP debe implementarse como una "tracing bullet": un end-to-end slice vertical minimo que conecte trigger, validacion, y enforcement antes de agregar complejidad.
**VALOR:** En lugar de construir toda la capa de integracion de Rovo de una vez, una tracing bullet permite validar que un ticket de Jira bloqueado realmente impide un merge en GitHub con el minimo de codigo posible.
**IMPLEMENTACION:** Para cada Quality Gate (Gate 1, Gate 2, Gate 3), implementar primero el flujo completo mas simple: trigger Jira -> llamada basica a Rovo -> calculo de score -> bloqueo de transicion. Luego iterar agregando deteccion de inconsistencias, comentarios en PR, y Spider Chart.
**AUDITORIA:** Ralph verifica que cada feature branch contenga un flujo end-to-end funcional antes de aceptar anyadidos horizontales (como nuevos tipos de inconsistencia o mejoras de UI).
