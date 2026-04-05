# [RB-092] Antifragile

> Libro: Nassim Nicholas Taleb - Antifragile: Things That Gain from Disorder

## Reglas

### ARCH-SOLID-0921
**DEFINICION:** El sistema debe mejorar automaticamente su precision de scoring cuando recibe feedback de false positives/negativos. Cada correction del usuario es una senal que fortalece el sistema, no solo un dato a registrar.
**VALOR:** Un sistema antifragil se fortalece con el desorden. Los false positives son "desorden" que, si se usan para ajustar los pesos automaticamente, hacen el scoring engine mas preciso con el tiempo. El sistema mejora cuanto mas se usa.
**IMPLEMENTACION:** Implementar `AdaptiveWeightEngine` en `src/backend/domain/scoring/adaptive/`. Cuando un usuario marca un bloqueo como false positive: 1) reducir el peso de la regla que causo el bloqueo un 5%, 2) registrar el ajuste en el audit log, 3) si una regla cae por debajo de peso 0.1, desactivarla automaticamente y notificar al admin. El ajuste es por proyecto, no global.
**AUDITORIA:** Ralph verifica que el peso de las reglas se ajuste automaticamente con los false positives reportados y que el sistema documente cada ajuste en el audit log.

### FORGE-OPS-0922
**DEFINICION:** Los despliegues deben ser autonomos: el sistema se auto-monitorea post-deploy y ejecuta un rollback automatico si los errores en Sentry aumentan mas de 3x en los 15 minutos posteriores al deploy.
**VALOR:** Un sistema antifragil se recupera solo de los problemas. Si un deploy introduce un bug, el sistema lo detecta y revierte sin intervencion humana. Cada fallo de deploy es informacion que mejora la confianza en el proceso de deploy.
**IMPLEMENTACION:** Implementar health check post-deploy: 1) deploy a produccion, 2) esperar 15 minutos, 3) comparar error rate en Sentry con el baseline de los 7 dias anteriores, 4) si error rate > 3x baseline, ejecutar `forge deploy production --version=previous` automaticamente, 5) notificar al equipo via log estructurado. El baseline se recalcula semanalmente.
**AUDITORIA:** Ralph verifica que el health check post-deploy este implementado y que existan tests que simulen un deploy fallido y confirmen el rollback automatico.

### TEST-QA-0923
**DEFINICION:** El test suite debe incluir "mutation testing": modificar aleatoriamente el codigo del dominio y verificar que al menos un test falla. Si ninguna mutacion es detectada, los tests son insuficientes.
**VALOR:** Un test suite que pasa a pesar de mutaciones en el codigo es fragil: da una falsa sensacion de seguridad. Los tests que detectan mutaciones son antifrágiles: se fortalecen porque garantizan que el codigo probado es correcto, no solo que no crashea.
**IMPLEMENTACION:** Ejecutar Stryker mutation testing como parte del CI en los modulos de dominio (`scoring/`, `inconsistency/`, `enforcement/`). La meta es un mutation score >= 80%. Las mutaciones tipicas: cambiar `>` por `>=`, reemplazar constantes, invertir condiciones booleanas. Los reportes se almacenan como artefactos del CI.
**AUDITORIA:** Ralph verifica que el mutation score de los modulos de dominio sea >= 80% y que el CI bloquee merges que reduzcan el score.

### ROVO-INTEG-0924
**DEFINICION:** Cuando Rovo cambia su API o formato de respuesta, el sistema debe detectar el cambio automaticamente (via schema validation fallida), adaptarse usando el modo degradado, y notificar al equipo para actualizar el adapter.
**VALOR:** Los cambios de API son "desorden" inevitable. Un sistema antifragil detecta el cambio, opera degradado temporalmente, y se recupera cuando el adapter se actualiza. No necesita saber de antemano que cambiara, solo como reaccionar al cambio.
**IMPLEMENTACION:** Cada respuesta de Rovo pasa por un Zod schema. Si la validacion falla: 1) loggear el error con el schema esperado vs el recibido, 2) activar modo degradado automaticamente, 3) registrar el evento como `RovoSchemaMismatch` en Forge Storage, 4) el admin dashboard muestra una alerta: "Formato de Rovo cambiado - operando en modo degradado - actualizacion requerida".
**AUDITORIA:** Ralph verifica que un cambio en el schema de Rovo active el modo degradado y genere una alerta visible en el admin dashboard.

### SEC-PRIV-0925
**DEFINICION:** El sistema debe gainar resiliencia con cada intento de ataque fallido: registrar patrones de inputs sospechosos y endurecer automaticamente las validaciones para esos patrones.
**VALOR:** Cada intento de XSS o injection es informacion que puede fortalecer el sistema. Si un payload sospechoso se detecta, el sistema endurece sus validaciones para patrones similares. El sistema se vuelve mas seguro cuanto mas lo atacan.
**IMPLEMENTACION:** Implementar `AdaptiveInputValidator` que mantiene un registro de patrones sospechosos en Forge Storage (con TTL de 30 dias). Cuando se detecta un input sospechoso: 1) loggear el patron, 2) agregar el patron a una blacklist temporal, 3) rechazar inmediatamente inputs futuros que coincidan con el patron. Limitar la blacklist a 100 patrones (LRU) para no consumir demasiado Storage.
**AUDITORIA:** Ralph verifica que los inputs sospechosos se registren y que el sistema rechace inputs que coincidan con patrones previamente detectados.
