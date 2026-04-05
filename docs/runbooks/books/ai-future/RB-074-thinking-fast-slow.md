# [RB-074] Thinking, Fast and Slow

> Libro: Daniel Kahneman - Thinking, Fast and Slow

## Reglas

### ROVO-INTEG-062
**DEFINICION:** El calculo del Consistency Score debe evitar sesgos de anclaje: el score no debe estar influenciado artificialmente por el primer eje evaluado ni por el orden de presentacion de las senales de Rovo.
**VALOR:** Si el eje "Claridad" se evalua primero y recibe un peso desproporcionado en la evaluacion mental del sistema, un ticket con descripcion clara pero con inconsistencias profundas con Confluence puede recibir un score incorrectamente alto.
**IMPLEMENTACION:** Evaluar cada eje de calidad de forma independiente usando funciones puras separadas que no comparten estado: `evaluateClarity()`, `evaluateConsistency()`, `evaluateRisk()`, `evaluateDocumentation()`, `evaluateTechnicalDebt()`. El score final es una suma ponderada de los resultados independientes, donde los pesos estan configurados en `/config/project-rules.json` y son iguales por defecto.
**AUDITORIA:** Ralph verifica que el calculo de cada eje sea independiente y que los pesos por defecto sean iguales, y que cualquier desviacion de pesos este justificada y documentada.

### ROVO-INTEG-063
**DEFINICION:** Las notificaciones de enforcement al usuario deben estar disenadas para mitigar el sesgo de confirmacion: deben presentar evidencia tanto a favor como en contra del bloqueo, no solo las razones para bloquear.
**VALOR:** Si el sistema solo muestra las inconsistencias encontradas, el usuario tiende a confirmar el bloqueo sin revisar si el ticket es realmente valido. Mostrar tambien los aspectos positivos del ticket permite una decision mas equilibrada.
**IMPLEMENTACION:** En el panel de Jira y en los comentarios de GitHub, incluir una seccion "Aspectos validados" que liste los criterios que el ticket SI cumple, junto con las inconsistencias detectadas. Por ejemplo: "3 de 5 criterios cumplidos. Bloqueado por: falta de criterios de aceptacion y contradiccion con ARCH-2024-003."
**AUDITORIA:** Ralph verifica que cada notificacion de enforcement incluya tanto los aspectos cumplidos como las inconsistencias, y que no existan notificaciones que solo presenten informacion negativa.

### ROVO-INTEG-064
**DEFINICION:** Las decisiones de configuracion del sistema (thresholds, pesos de ejes, reglas de bloqueo) deben tomarse con datos y evidencia, no basandose en intuicion o preferencia personal del configurador.
**VALOR:** Si un Project Manager configura el threshold de Consistency Score en 95% "porque suena bien" sin datos que respalden esa decision, el sistema bloqueara la mayoria de tickets validos y los equipos abandonaran la herramienta.
**IMPLEMENTACION:** El Admin Dashboard debe mostrar el impacto proyectado de cada cambio de configuracion: "Si cambia el threshold de 80% a 95%, el 72% de los tickets actuales serian bloqueados". Toda configuracion debe pasar por un periodo de "shadow mode" donde se simulan los efectos sin aplicarlos.
**AUDITORIA:** Ralph verifica que el sistema de configuracion muestre impacto proyectado antes de aplicar cambios y que exista un modo de simulacion para nuevas configuraciones.
