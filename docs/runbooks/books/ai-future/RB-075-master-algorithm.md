# [RB-075] The Master Algorithm

> Libro: Pedro Domingos - The Master Algorithm: How the Quest for the Ultimate Learning Machine Will Remake Our World

## Reglas

### ROVO-INTEG-065
**DEFINICION:** El sistema de scoring de Rovo Execution Guard debe permitir la seleccion y ajuste del modelo de evaluacion segun el contexto del proyecto, reconociendo que diferentes equipos pueden requerir diferentes enfoques de validacion.
**VALOR:** Un equipo de infraestructura necesita validar tickets diferentes a un equipo de producto. Un modelo unico de scoring que funciona para equipos de producto puede generar falsos positivos masivos para equipos de operaciones cuyos tickets tienen estructura diferente.
**IMPLEMENTACION:** Implementar perfiles de evaluacion en `/config/project-rules.json`: cada proyecto puede seleccionar que ejes de calidad son relevantes y sus pesos. Proveer perfiles predefinidos: "software-development", "infrastructure", "research", "bug-fix". Los equipos pueden personalizar basandose en los predefinidos. El Admin Dashboard permite la seleccion visual.
**AUDITORIA:** Ralph verifica que el sistema soporte multiples perfiles de evaluacion y que los perfiles predefinidos esten testeados con datos representativos de cada tipo de equipo.

### ROVO-INTEG-066
**DEFINICION:** El sistema debe combinar multiples senales de validacion (estructural, contextual, historica) como un ensemble, donde cada senal contribuye al score final de forma ponderada y configurable, en vez de depender de un unico criterio.
**VALOR:** Confiar solo en la validacion estructural (campos presentes) o solo en la validacion contextual (Rovo) deja brechas. Un ticket puede tener todos los campos pero ser inconsistente con Confluence, o puede faltar un campo pero ser perfectamente consistente con el contexto historico.
**IMPLEMENTACION:** Implementar el scoring como un ensemble: (1) validacion estructural (campos requeridos presentes): peso 25%, (2) validacion contextual via Rovo (consistencia con documentacion): peso 35%, (3) validacion historica (consistencia con tickets previos del mismo tipo): peso 25%, (4) validacion cruzada GitHub (alineacion PR-ticket): peso 15%. Los pesos son configurables por proyecto.
**AUDITORIA:** Ralph verifica que el sistema de scoring combine multiples senales con pesos configurables y que ninguna senal individual pueda determinar el score final por si sola.

### ROVO-INTEG-067
**DEFINICION:** El sistema debe evaluar la calidad de sus propias predicciones y ajustar su comportamiento en base a la precision historica, manteniendo metricas de efectividad por proyecto y por tipo de ticket.
**VALOR:** Si el sistema bloquea consistentemente tickets que despues son aprobados por override del usuario, su precision es baja y las reglas necesitan ajuste. Sin metricas de autoevaluacion, el sistema no mejora.
**IMPLEMENTACION:** Mantener metricas de efectividad en Forge Storage: (1) tasa de acierto (tickets bloqueados que fueron confirmados como problematicos), (2) tasa de falso positivo (tickets bloqueados que fueron desbloqueados por override), (3) tasa de falso negativo (tickets aprobados que generaron retrabajo). Mostrar estas metricas en el Admin Dashboard con tendencias temporales.
**AUDITORIA:** Ralph verifica que las metricas de autoevaluacion existan, se actualicen con cada validacion, y que el Admin Dashboard las muestre con tendencias claras.
