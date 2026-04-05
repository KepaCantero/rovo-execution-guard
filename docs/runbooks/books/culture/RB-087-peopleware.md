# [RB-087] Peopleware

> Libro: Tom DeMarco - Peopleware: Productive Projects and Teams

## Reglas

### FORGE-OPS-0871
**DEFINICION:** Las funciones Forge que responden a triggers de UI (issue panel, admin dashboard) deben retornar en menos de 2 segundos para no interrumpir el flow state del usuario que trabaja en Jira.
**VALOR:** Peopleware demuestra que las interrupciones son el mayor enemigo de la productividad. Si el issue panel tarda 5 segundos en cargar, el usuario pierde el hilo de su trabajo. El flow state del desarrollador es sagrado.
**IMPLEMENTACION:** Medir el tiempo de respuesta de cada resolver con `performance.now()`. Si el resolver supera 2 segundos: 1) verificar si hay llamadas a APIs externas que puedan cachearse, 2) mover logica pesada a un trigger previo (pre-computar scores cuando el ticket se guarda, no cuando se abre el panel), 3) usar `@forge/react` con `useAction` para operaciones async sin bloquear la UI.
**AUDITORIA:** Ralph verifica que ningun resolver de UI supere los 2 segundos de tiempo de respuesta medido en staging y que los scores se pre-computen cuando el ticket cambia, no cuando se carga el panel.

### ARCH-SOLID-0872
**DEFINICION:** Los desarrolladores deben poder trabajar en un modulo (scoring, inconsistency, enforcement) sin necesidad de entender los otros dos. La interfaz entre modulos es el unico punto de contacto.
**VALOR:** Un equipo donde cada persona necesita entender todo el sistema es lento. Los modulos bien encapsulados permiten que alguien trabaje en deteccion de inconsistencias sin tocar el scoring engine, manteniendo el flow state individual.
**IMPLEMENTACION:** Cada modulo de dominio publica su interfaz en `index.ts`. Los tipos compartidos entre modulos viven en `src/backend/domain/shared/types.ts` y son tipos simples (data transfer objects), no logica. Los tests de integracion validan la interaccion entre modulos usando mocks de las interfaces publicas.
**AUDITORIA:** Ralph verifica que un desarrollador pueda implementar una nueva regla de scoring sin modificar archivos fuera de `src/backend/domain/scoring/`.

### UI-ADS-0873
**DEFINICION:** Las notificaciones del sistema (bloqueos, advertencias) deben ser no intrusivas: usar el issue panel y comentarios en PR, nunca emails ni popups. El usuario ve la informacion cuando decide mirarla.
**VALOR:** Las interrupciones forzadas (emails, popups) rompen el flow state. El desarrollador debe poder ignorar las advertencias cuando esta en modo concentracion y revisarlas cuando este listo. Peopleware demuestra que el ambiente de trabajo libre de interrupciones mejora la calidad.
**IMPLEMENTACION:** Toda la comunicacion de enforcement ocurre en los canales donde el usuario ya esta trabajando: Jira issue panel (visible al abrir el ticket) y GitHub PR comments (visible al revisar el PR). Nunca enviar emails ni crear notificaciones push. Usar `Lozenge` de color para indicar estado sin requerir accion inmediata.
**AUDITORIA:** Ralph verifica que el sistema no envie emails ni notificaciones push y que toda la informacion de enforcement este disponible en el issue panel y comentarios de PR.

### TEST-QA-0874
**DEFINICION:** Los tests automatizados son la red de seguridad que permite a los desarrolladores hacer refactorings con confianza. Ningun refactor se realiza sin una suite de tests previa que cubra el modulo afectado.
**VALOR:** Peopleware muestra que los equipos productivos tienen confianza para mejorar su codigo. Esa confianza viene de los tests automatizados. Si no hay tests, no hay refactor, y el codigo se degrada con el tiempo.
**IMPLEMENTACION:** Antes de refactorizar un modulo, verificar que la cobertura de tests sea >= 85%. Si no lo es, agregar tests primero. El refactor se realiza en tres pasos: 1) agregar tests al comportamiento actual, 2) refactorizar manteniendo los tests pasando, 3) agregar tests para los nuevos comportamientos. El Husky pre-commit asegura que los tests pasen antes de cada commit.
**AUDITORIA:** Ralph verifica que cada refactor documentado en commits de los ultimos 30 dias tenga tests previos y que la cobertura del modulo refactorizado no haya disminuido.

### GIT-CI-0875
**DEFINICION:** El entorno de desarrollo local debe poder levantarse con un unico comando (`npm run dev`) en menos de 60 segundos, incluyendo Forge tunnel, para no romper el flow state del desarrollador.
**VALOR:** Si levantar el entorno de desarrollo toma 15 minutos y 20 pasos manuales, los desarrolladores evitan hacer cambios pequenos. Un entorno que se levanta en 60 segundos fomenta la experimentacion y el flow state continuo.
**IMPLEMENTACION:** Crear un script `npm run dev` en `package.json` que: 1) verifica que Forge CLI este instalado, 2) ejecuta `forge tunnel` en background, 3) ejecuta `forge deploy --environment development`, 4) muestra la URL del tunnel. Documentar en README los prerequisitos (Forge CLI, Node 22, nvm). Los secrets y tokens se manejan via `forge settings` sin pasos manuales.
**AUDITORIA:** Ralph verifica que `npm run dev` funcione en un entorno limpio (sin configuracion previa) en menos de 60 segundos.
