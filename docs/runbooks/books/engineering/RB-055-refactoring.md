# [RB-055] Refactoring

> Libro: Martin Fowler - Refactoring: Improving the Design of Existing Code

## Reglas

### ARCH-SOLID-059
**DEFINICION:** Antes de anyadir nueva funcionalidad al sistema de Quality Gates, el codigo existente debe ser refactorizado para que la nueva feature se integre limpiamente sin aumentar la complejidad ciclomatica del modulo afectado.
**VALOR:** Anyadir un nuevo eje de validacion al Consistency Score (por ejemplo, "Technical Debt") sobre un modulo acoplado genera regresiones en los ejes existentes y puede bloquear tickets que antes pasaban correctamente.
**IMPLEMENTACION:** Aplicar "Extract Method" antes de extender: si la funcion `validateIssue()` maneja scoring y enforcement juntos, extraer `calculateScore()` y `enforceAction()` primero, luego anyadir el nuevo eje solo en `calculateScore()`. Cada refactor debe pasar los tests existentes antes de escribir nueva logica.
**AUDITORIA:** Ralph verifica que cada PR que introduce nueva funcionalidad contenga al menos un commit previo de refactor puro (sin cambio de comportamiento) y que los tests existentes pasen intactos tras el refactor.

### TEST-QA-052
**DEFINICION:** Ningun refactoring se ejecuta sin que los tests unitarios existentes cubran el comportamiento actual del codigo a refactorizar. Si la cobertura es insuficiente, primero se escriben tests caracterizacion antes de tocar el codigo.
**VALOR:** Refactorizar el calculo del Consistency Score sin tests que capturen el comportamiento actual puede cambiar silenciosamente el threshold de bloqueo del 80%, permitiendo que tickets inconsistentes pasen a "In Progress".
**IMPLEMENTACION:** Antes de refactorizar cualquier funcion en `/services/scoring/`, verificar que los tests unitarios cubren todos los branches. Si no, escribir tests que capturen el comportamiento actual (tests de caracterizacion). Solo despues proceder con el refactor.
**AUDITORIA:** Ralph bloquea cualquier PR de refactor que no incluya tests de caracterizacion previos cuando la cobertura del modulo afectado sea inferior al 90%.

### TEST-QA-053
**DEFINICION:** Todo refactoring debe realizarse en pasos atomicos y verificables: un solo tipo de transformacion por commit, con tests verdes entre cada paso.
**VALOR:** Un refactor masivo del sistema de enforcement que toque scoring, integracion con GitHub y UI simultaneamente hace imposible revertir el cambio si falla en staging sin afectar los otros componentes.
**IMPLEMENTACION:** Commits de refactor: (1) extraer funcion, (2) renombrar variables, (3) mover metodo, (4) simplificar condicional. Un commit por transformacion. Ejecutar `jest` entre cada paso. Solo despues de todos los refactors, introducir el nuevo comportamiento.
**AUDITORIA:** Ralph analiza el historial de commits del PR y rechaza refactors que combinen multiples transformaciones en un solo commit.
