# [RB-088] The Soul of a New Machine

> Libro: Tracy Kidder - The Soul of a New Machine

## Reglas

### ARCH-SOLID-0881
**DEFINICION:** El scoring engine debe ser trazeable: cada score producido debe poder descomponerse en las reglas individuales que lo generaron, con el peso y resultado de cada una, permitiendo auditoria completa.
**VALOR:** La dedicacion al detalle significa que cada decision del sistema es explicable. Si un ticket fue bloqueado con score 65, el equipo debe poder ver exactamente que reglas fallaron y cuanto contribuyo cada una al score final. Sin trazabilidad, el sistema es una caja negra.
**IMPLEMENTACION:** El `ScoreResult` incluye un campo `breakdown: Array<{ ruleId: string; passed: boolean; score: number; weight: number; reason: string }>`. El scoring engine calcula cada regla independientemente y almacena el resultado. El issue panel muestra el breakdown en el nivel 2 (expandible). El audit log almacena cada score calculado con su breakdown completo.
**AUDITORIA:** Ralph verifica que cada score almacenado en Forge Storage o mostrado en la UI tenga su breakdown completo con ruleId, passed, score, weight y reason.

### TEST-QA-0882
**DEFINICION:** Las iteraciones de desarrollo deben producir software funcional en cada ciclo. Al final de cada sprint, el Forge app debe estar deployable a staging con todas las features completas, no "90% terminado".
**VALOR:** El equipo de Kidder entrego hardware funcional en cada iteracion. El software "90% terminado" es 0% util. Cada sprint debe producir una version del Forge app que se pueda usar y probar, incluso si tiene menos features de las planeadas.
**IMPLEMENTACION:** Al final de cada sprint: 1) todas las features en la rama `develop` deben pasar tests E2E, 2) el deploy a staging es automatico, 3) el equipo hace una demo funcional contra staging, 4) las features incompletas se remueven del sprint y se reprograman, no se dejan "casi listas".
**AUDITORIA:** Ralph verifica que cada sprint cierre con un deploy exitoso a staging y que no existan features "incompletas" en la rama `develop`.

### FORGE-OPS-0883
**DEFINICION:** Cada trigger de Forge debe estar disenado para manejar la carga maxima esperada (100 tickets simultaneos) sin degradar el rendimiento, priorizando la deduccion sobre la velocidad bruta.
**VALOR:** La dedicacion al detalle incluye pensar en los limites desde el diseno. Un trigger que funciona con 1 ticket pero falla con 100 no esta listo. El sistema debe ser robusto ante la carga real de un equipo de desarrollo activo.
**IMPLEMENTACION:** Implementar batch processing en los triggers: si se reciben multiples eventos (ej: transicion masiva de tickets), procesar en lotes de 10 con una cola en Forge Storage. Cada lote se procesa secuencialmente para no exceder los limites de la API de Jira/Rovo. Agregar tests de carga con multiples tickets simultaneos.
**AUDITORIA:** Ralph verifica que existan tests de carga con al menos 100 tickets simultaneos y que el tiempo de procesamiento por ticket no degrade linealmente con la carga.

### ROVO-INTEG-0884
**DEFINICION:** El proceso de obtener contexto de Rovo debe iterar hasta que la precision del scoring sea >= 90% (medido por false positive rate), dedicando el tiempo necesario a calibrar las senales.
**VALOR:** La dedicacion obsesiva a la calidad del contexto es lo que separa un producto util de uno que genera ruido. Si el contexto de Rovo no es preciso, los enforcement son incorrectos y el producto pierde confianza.
**IMPLEMENTACION:** Medir la precision del scoring con la metrica `false_positive_rate = false_positives / total_blocked`. Si el rate es > 10%, ajustar los pesos de las senales de Rovo. Implementar un proceso de calibracion donde los false positives reportados por usuarios alimentan un ajuste automatico de pesos. Documentar la precision actual en el admin dashboard.
**AUDITORIA:** Ralph verifica que el false positive rate se muestre en el admin dashboard y que el proceso de calibracion este activo.

### GIT-CI-0885
**DEFINICION:** El historial de commits debe reflejar la dedicacion del equipo: cada commit debe compilar, pasar tests y dejar el sistema en estado funcional. No hay commits "WIP" que rompan el build.
**VALOR:** El equipo de Kidder no aceptaba compromisos en la calidad del hardware. Un commit que rompe el build es una falta de respeto al equipo. Cada commit es una entrega funcional minima.
**IMPLEMENTACION:** Husky pre-commit ejecuta `tsc --noEmit` + `jest --bail --findRelatedTests` antes de permitir el commit. Si algun test falla o hay errores de tipo, el commit se bloquea. Para guardar trabajo en progreso sin romper el build, usar `git stash` en lugar de commits WIP.
**AUDITORIA:** Ralph verifica que no existan commits en `main` o `develop` que rompan el build y que el Husky pre-commit este configurado correctamente.
