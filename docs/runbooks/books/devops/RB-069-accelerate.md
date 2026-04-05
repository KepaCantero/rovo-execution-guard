# [RB-069] Accelerate

> Libro: Nicole Forsgren, Jez Humble, Gene Kim - Accelerate: The Science of Lean Software and DevOps

## Reglas

### GIT-CI-058
**DEFINICION:** El equipo debe medir y optimizar las cuatro metricas DORA aplicadas a Rovo Execution Guard: Lead Time (tiempo desde commit hasta produccion), Deploy Frequency (deploys a produccion por semana), Change Failure Rate (porcentaje de deploys que causan incidentes), y MTTR (tiempo medio para restaurar servicio).
**VALOR:** Sin metricas DORA, es imposible saber si el equipo esta mejorando o empeorando. Si el Lead Time crece de 1 dia a 5 dias, los fixes criticos (por ejemplo, un falso positivo masivo en el Quality Gate) tardan demasiado en llegar a los usuarios.
**IMPLEMENTACION:** Configurar un dashboard de DORA metrics en el Admin Dashboard: (1) Lead Time: medir desde el primer commit en la branch hasta el deploy exitoso a produccion, (2) Deploy Frequency: contar deploys a produccion por semana, (3) Change Failure Rate: ratio de deploys que requieren rollback o hotfix, (4) MTTR: tiempo desde la deteccion del incidente hasta la resolucion exitosa. Recopilar datos desde GitHub Actions y Sentry.
**AUDITORIA:** Ralph registra las metricas DORA semanalmente y genera alertas si alguna metrica se degrada respecto a la linea base.

### GIT-CI-059
**DEFINICION:** La frecuencia de despliegue a produccion debe ser de al menos una vez por semana durante el desarrollo activo del MVP, preferiblemente con cada merge a `main`.
**VALOR:** Deployar poco frecuente acumula riesgo. Si se acumulan 3 features sin deploy y la tercera rompe el calculo del Consistency Score, es dificil saber cual de las tres causo el problema y el rollback pierde las otras dos features.
**IMPLEMENTACION:** Configurar el pipeline para que cada merge a `main` elegible para deploy a produccion tras pasar staging. Usar feature flags en `/config/` para desactivar features no listas sin bloquear el deploy. Target: al menos 1 deploy por semana, idealmente con cada merge.
**AUDITORIA:** Ralph mide la frecuencia de deploys y alerta si pasan mas de 7 dias sin un deploy a produccion durante periodos de desarrollo activo.

### FORGE-OPS-064
**DEFINICION:** El Change Failure Rate del sistema debe mantenerse por debajo del 10%. Si supera el 15%, se detiene el desarrollo de nuevas features hasta estabilizar.
**VALOR:** Si 3 de cada 10 deploys causan incidentes (por ejemplo, tickets bloqueados incorrectamente o checks de GitHub fallando sin razon), la confianza de los usuarios en el sistema se destruye y los equipos desactivan la app.
**IMPLEMENTACION:** Monitorear el ratio de fallos post-deploy usando Sentry y los smoke tests. Si el ratio supera 15% en un periodo de 2 semanas: (1) congelar nuevas features, (2) dedicar 100% del esfuerzo a estabilizacion, (3) revisar la estrategia de testing y agregar tests de regresion para los patrones de fallo detectados.
**AUDITORIA:** Ralph calcula el Change Failure Rate mensualmente y genera un informe accionable con las causas principales de fallo.
