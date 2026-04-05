# [RB-071] Life 3.0

> Libro: Max Tegmark - Life 3.0: Being Human in the Age of Artificial Intelligence

## Reglas

### ROVO-INTEG-055
**DEFINICION:** Las respuestas de Rovo que alimentan el calculo del Consistency Score nunca deben ser aceptadas como verdad absoluta. El sistema debe incluir mecanismos de verificacion cruzada y fallback para cuando Rovo produzca resultados inconsistentes.
**VALOR:** Rovo, como sistema de IA, puede producir alucinaciones o interpretaciones incorrectas del contexto organizacional. Si el sistema acepta ciegamente una respuesta de Rovo que indica que un ticket es consistente cuando no lo es, se aprueban tickets defectuosos.
**IMPLEMENTACION:** Implementar verificabilidad: (1) comparar el resultado de Rovo contra reglas estructurales basicas (campos requeridos presentes), (2) si Rovo dice "consistente" pero faltan campos criticos (criterios de aceptacion, descripcion), el score se reduce automaticamente, (3) registrar la discrepancia entre Rovo y las reglas estructurales como una inconsistencia adicional.
**AUDITORIA:** Ralph verifica que el sistema nunca dependa exclusivamente de Rovo para aprobar un ticket sin verificacion cruzada contra reglas deterministas.

### SEC-PRIV-053
**DEFINICION:** El sistema debe mantener un control estricto sobre los datos que se envian a Rovo y los que se reciben, asegurando que la informacion sensible de los tickets (datos personales, credenciales, secretos) no se exponga en las consultas.
**VALOR:** Si un ticket de Jira contiene contrasenas o datos personales en su descripcion y estos se envian a Rovo como parte del contexto, se violan las politicas de privacidad y se crea un riesgo de seguridad.
**IMPLEMENTACION:** Implementar un sanitizador en la capa de integracion que filtre datos sensibles antes de enviar a Rovo: patrones de contrasenas, emails personales, numeros de tarjeta, tokens API. Usar regex patterns definidos en `/src/backend/utils/sanitizer.ts`. Registrar cada sanitizacion en el log de auditoria.
**AUDITORIA:** Ralph verifica que el sanitizador de datos este activo en todas las llamadas a Rovo y que los tests unitarios cubran los patrones de datos sensibles definidos.

### ROVO-INTEG-056
**DEFINICION:** Las decisiones de enforcement (bloquear un ticket o un PR) deben ser siempre explicable por el sistema. El usuario debe poder entender POR QUE se bloqueo su ticket en terminos de negocio, no en terminos de scoring algoritmico.
**VALOR:** Si un ticket es bloqueado con el mensaje "Consistency Score: 72%", el usuario no sabe que hacer. Si el mensaje dice "Bloqueado: el ticket no tiene criterios de aceptacion y contradice la decision ARCH-2024-003 en Confluence", el usuario puede actuar.
**IMPLEMENTACION:** Cada EnforcementAction debe incluir un campo `reason` con explicacion en lenguaje natural: que regla se violo, que evidencia la soporta (link a documento de Confluence, referencia a ticket historico), y que accion sugerida puede tomar el usuario. Las razones se generan a partir de las inconsistencias detectadas, no son mensajes genericos.
**AUDITORIA:** Ralph verifica que cada enforcement action tenga una razon especifica y accionable, y que no existan mensajes de bloqueo genericos sin contexto.
