# [RB-093] Soft Skills

> Libro: John Sonmez - Soft Skills: The Software Developer's Life Manual

## Reglas

### GIT-CI-0931
**DEFINICION:** Cada desarrollador debe poder configurar el entorno de desarrollo completo en menos de 30 minutos, con documentacion paso a paso en el README que incluya: instalacion, configuracion de Forge CLI, setup de secrets, y primer deploy local.
**VALOR:** El "marketing" del proyecto interno comienza con la experiencia de onboarding. Si un nuevo desarrollador no puede levantar el Forge app en 30 minutos, el proyecto pierde contribuidores potenciales. La documentacion de setup es la primera impresion.
**IMPLEMENTACION:** El README.md debe tener seccion "Quick Start" con pasos exactos: 1) `nvm install 22`, 2) `npm install`, 3) `forge login`, 4) `npm run dev`. Cada paso debe funcionar copy-paste. Incluir troubleshooting para errores comunes (Forge CLI no instalado, Node version incorrecta, permisos de API). Verificar con un nuevo clon que el README funciona.
**AUDITORIA:** Ralph verifica que el README.md tenga la seccion "Quick Start" con pasos que funcionen en un entorno limpio y que el primer deploy local se complete en menos de 30 minutos.

### UI-ADS-0932
**DEFINICION:** El Forge app debe "venderse" a los usuarios en los primeros 30 segundos de uso: el issue panel debe mostrar valor inmediato (score del ticket + accion prioritaria) sin requerir configuracion ni tutorial.
**VALOR:** El marketing del producto ocurre en la primera interaccion. Si el usuario abre el issue panel y ve un spinner o un mensaje "configure su proyecto", perdio interes. Si ve "Score: 92% - Aprobado" o "Score: 45% - Agrega acceptance criteria", entiende el valor inmediatamente.
**IMPLEMENTACION:** El issue panel renderiza en dos fases: fase 1 (< 1s) muestra el ultimo score cacheado (si existe) o "Calculando..." con el spinner. Fase 2 (< 3s) muestra el score actualizado. Nunca mostrar un estado vacio o "configure algo". Los defaults hacen que el app funcione desde el primer ticket sin configuracion.
**AUDITORIA:** Ralph verifica que el issue panel muestre informacion util en los primeros 3 segundos de carga y que nunca muestre un estado vacio que requiera configuracion.

### ARCH-SOLID-0933
**DEFINICION:** El codigo debe estar escrito para que un desarrollador junior pueda entender el flujo principal en 15 minutos. Los nombres de funciones, variables y archivos deben usar vocabulario del dominio de negocio, no jerga tecnica interna.
**VALOR:** La legibilidad del codigo es una soft skill tecnica. Si un nuevo miembro del equipo necesita 2 horas para entender el flujo de validacion, el codigo es una barrera de entrada. Los nombres del dominio de negocio (ticket, score, enforcement, inconsistency) son universales.
**IMPLEMENTACION:** Nomenclatura consistente en todo el proyecto: `ticket` (no `issue` o `item`), `score` (no `rating` o `grade`), `enforcement` (no `action` o `constraint`), `inconsistency` (no `error` o `violation`). Glosario en `docs/architecture/glossary.md`. ESLint rule custom para verificar que no se usen sinonimos de los terminos definidos.
**AUDITORIA:** Ralph verifica que exista un glosario y que los nombres en el codigo sean consistentes con el glosario (no se usen sinonimos).

### TEST-QA-0934
**DEFINICION:** Los tests deben servir como documentacion viva del comportamiento del sistema. Un desarrollador nuevo debe poder entender "que hace el scoring engine" leyendo sus tests, no solo su codigo.
**VALOR:** Los tests son la documentacion que nunca se desactualiza. Si los tests del scoring engine explican claramente los escenarios de negocio (ticket con AC pasa, ticket sin AC falla, ticket con AC pero descripcion vacia obtiene score parcial), son mas utiles que cualquier wiki.
**IMPLEMENTACION:** Cada test suite tiene un `describe` principal que describe el modulo y `describe` anidados que describen los escenarios: `describe('ScoringEngine', () => { describe('when ticket has all required fields', ...) describe('when ticket is missing acceptance criteria', ...) })`. Los asserts usan `expect(result.score).toEqual(expected)` con valores explicitos, no calculados dinamicamente.
**AUDITORIA:** Ralph verifica que los tests del dominio esten organizados por escenario de negocio y que un desarrollador nuevo pueda entender el comportamiento del modulo leyendo solo los tests.

### FORGE-OPS-0935
**DEFINICION:** Cada desarrollador debe poder ejecutar el Forge app en modo local con `forge tunnel` y ver sus cambios reflejados en Jira en menos de 10 segundos despues de guardar un archivo, manteniendo un ciclo de feedback rapido durante el desarrollo.
**VALOR:** El flujo de desarrollo es como la "fitness" del programador: si el ciclo de feedback es lento (esperar 2 minutos por cada cambio), la productividad cae. El hot-reload via Forge tunnel es la base de un desarrollo eficiente.
**IMPLEMENTACION:** Configurar `forge tunnel` con `--watch` para que los cambios en `src/` se reflejen automaticamente. El `webpack.config.js` optimiza para velocidad de rebuild (< 5s). El desarrollador trabaja en su IDE, guarda, y ve el resultado en Jira sin pasos manuales intermedios. Documentar el workflow en el README.
**AUDITORIA:** Ralph verifica que `forge tunnel --watch` detecte cambios en menos de 5 segundos y que el rebuild complete en menos de 10 segundos.
