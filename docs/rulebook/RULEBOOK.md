# RULEBOOK - Rovo Execution Guard

> Fuente unica de verdad para auditoria de codigo por Ralph.
> Generado a partir de 102 runbooks extraidos de 100 fuentes (50 links + 50 libros).

---

## Formato de Regla

Cada regla sigue este formato:

- **ID**: [CATEGORIA]-[CORRELATIVO] (ej: FORGE-OPS-001)
- **DEFINICION**: Descripcion tecnica de la restriccion.
- **VALOR**: Por que esta regla existe.
- **IMPLEMENTACION**: Como debe escribirse el codigo para cumplirla.
- **AUDITORIA**: Que verifica Ralph.

El detalle completo (VALOR, IMPLEMENTACION, AUDITORIA) de cada regla esta en el archivo
de runbook individual referenciado en `docs/runbooks/`.

---

## Estadisticas

| Categoria                    | Reglas  |
| ---------------------------- | ------- |
| Forge Runtime & Platform     | 69      |
| Seguridad, Privacidad & Auth | 56      |
| Arquitectura & SOLID         | 104     |
| Testing & QA                 | 59      |
| Git & CI/CD                  | 69      |
| Atlassian Design System & UX | 22      |
| Rovo & IA Integration        | 48      |
| GitHub Integration           | 13      |
| **Total**                    | **440** |

---

## FORGE-OPS - Forge Runtime & Platform

> 69 reglas

### FORGE-OPS-001

**DEFINICION:** El archivo manifest.yml debe contener exactamente las tres propiedades de nivel superior obligatorias: `app`, `modules` y `permissions`.

Fuente: [`runbooks/links/forge/RB-001-forge-manifest.md`](runbooks/links/forge/RB-001-forge-manifest.md)

---

### FORGE-OPS-002

**DEFINICION:** El archivo manifest.yml no debe exceder 200 KB de tamano.

Fuente: [`runbooks/links/forge/RB-001-forge-manifest.md`](runbooks/links/forge/RB-001-forge-manifest.md)

---

### FORGE-OPS-003

**DEFINICION:** La app no debe declarar mas de 100 modulos en el manifest.yml.

Fuente: [`runbooks/links/forge/RB-001-forge-manifest.md`](runbooks/links/forge/RB-001-forge-manifest.md)

---

### FORGE-OPS-004

**DEFINICION:** La propiedad `permissions.external.fetch` debe listar unicamente los dominios que la app realmente necesita, sin wildcards.

Fuente: [`runbooks/links/forge/RB-001-forge-manifest.md`](runbooks/links/forge/RB-001-forge-manifest.md)

---

### FORGE-OPS-005

**DEFINICION:** Ninguna invocacion de funcion Forge debe exceder 10 segundos de ejecucion.

Fuente: [`runbooks/links/forge/RB-002-forge-platform-limits.md`](runbooks/links/forge/RB-002-forge-platform-limits.md)

---

### FORGE-OPS-006

**DEFINICION:** El uso de Forge Storage por app no debe exceder 100 MB.

Fuente: [`runbooks/links/forge/RB-002-forge-platform-limits.md`](runbooks/links/forge/RB-002-forge-platform-limits.md)

---

### FORGE-OPS-007

**DEFINICION:** Las operaciones de Storage deben respetar los limites de throughput: 50 reads/segundo, 10 writes/segundo, 10 queries/segundo, 10 deletes/segundo.

Fuente: [`runbooks/links/forge/RB-002-forge-platform-limits.md`](runbooks/links/forge/RB-002-forge-platform-limits.md)

---

### FORGE-OPS-008

**DEFINICION:** Ninguna invocacion de funcion Forge debe realizar mas de 100 network requests.

Fuente: [`runbooks/links/forge/RB-002-forge-platform-limits.md`](runbooks/links/forge/RB-002-forge-platform-limits.md)

---

### FORGE-OPS-009

**DEFINICION:** El bundle de la app no debe exceder 50 MB comprimido ni contener mas de 10000 archivos.

Fuente: [`runbooks/links/forge/RB-002-forge-platform-limits.md`](runbooks/links/forge/RB-002-forge-platform-limits.md)

---

### FORGE-OPS-010

**DEFINICION:** Las operaciones asincronas de Jira que retornan HTTP 303 deben ser manejadas con polling hasta obtener el resultado final.

Fuente: [`runbooks/links/forge/RB-004-jira-rest-api.md`](runbooks/links/forge/RB-004-jira-rest-api.md)

---

### FORGE-OPS-0101

**DEFINICION:** Toda funcion Forge debe completar su trabajo critico (calculo de score, decision de enforcement, persistencia de estado) en un maximo de 8 segundos, reservando 2 segundos de margen contra el hard limit de 10 segundos de la plataforma.

Fuente: [`runbooks/links/forge-platform-limits.md`](runbooks/links/forge-platform-limits.md)

---

### FORGE-OPS-0102

**DEFINICION:** El acceso a Forge Storage debe respetar los limites de throughput por instalacion (50 reads/s, 10 writes/s, 10 queries/s, 10 deletes/s) implementando backoff exponencial con jitter en toda operacion de escritura, y no debe exceder la cuota total de 100 MB por app.

Fuente: [`runbooks/links/forge-platform-limits.md`](runbooks/links/forge-platform-limits.md)

---

### FORGE-OPS-0104

**DEFINICION:** La app debe implementar graceful degradation como primer mecanismo de resiliencia: cuando Rovo o GitHub esten unavailable, el sistema debe operar en modo reducido (validacion estructural unicamente) en vez de fallar completamente o bloquear todos los flujos.

Fuente: [`runbooks/links/forge-platform-limits.md`](runbooks/links/forge-platform-limits.md)

---

### FORGE-OPS-0105

**DEFINICION:** Las funciones Forge deben ser stateless y disposables: sin estado mutable a nivel de modulo entre invocaciones, sin depender de warm instances, y capaces de ser terminadas y reiniciadas en cualquier momento sin perder datos de negocio.

Fuente: [`runbooks/links/forge-platform-limits.md`](runbooks/links/forge-platform-limits.md)

---

### FORGE-OPS-011

**DEFINICION:** El bundle de recursos estaticos de Custom UI no debe exceder 150 MB ni 500 archivos para apps en plan paid (o los limites del plan correspondiente).

Fuente: [`runbooks/links/forge/RB-008-forge-custom-ui.md`](runbooks/links/forge/RB-008-forge-custom-ui.md)

---

### FORGE-OPS-012

**DEFINICION:** Los keys del key-value store deben tener un formato jerarquico usando separadores `:` (ej. `tenant:PRJ-123:score`) y no exceder 500 caracteres.

Fuente: [`runbooks/links/forge/RB-009-forge-storage-api.md`](runbooks/links/forge/RB-009-forge-storage-api.md)

---

### FORGE-OPS-013

**DEFINICION:** Los valores almacenados en Forge Storage no deben exceder 4 KB para el key-value store. Para datos mayores, usar el Entity Store con entidades custom.

Fuente: [`runbooks/links/forge/RB-009-forge-storage-api.md`](runbooks/links/forge/RB-009-forge-storage-api.md)

---

### FORGE-OPS-014

**DEFINICION:** La app debe implementar limpieza periodica de datos temporales en Storage usando scheduled triggers, aprovechando la ventana de 28 dias para datos eliminados accidentalmente.

Fuente: [`runbooks/links/forge/RB-009-forge-storage-api.md`](runbooks/links/forge/RB-009-forge-storage-api.md)

---

### FORGE-OPS-015

**DEFINICION:** La memoria asignada a las funciones Forge debe configurarse explicitamente entre 128 MB y 1024 MB segun las necesidades reales, usando el default de 512 MB como punto de partida.

Fuente: [`runbooks/links/forge/RB-010-forge-runtime.md`](runbooks/links/forge/RB-010-forge-runtime.md)

---

### FORGE-OPS-016

**DEFINICION:** Las funciones Forge deben ser stateless: no depender de estado en memoria entre invocaciones, ya que cada invocacion puede ejecutarse en una instancia diferente de Lambda.

Fuente: [`runbooks/links/forge/RB-010-forge-runtime.md`](runbooks/links/forge/RB-010-forge-runtime.md)

---

### FORGE-OPS-017

**DEFINICION:** Las funciones Forge deben manejar correctamente el cold start inicializando dependencias pesadas dentro del handler, no a nivel de modulo.

Fuente: [`runbooks/links/forge/RB-010-forge-runtime.md`](runbooks/links/forge/RB-010-forge-runtime.md)

---

### FORGE-OPS-018

**DEFINICION:** El tunneling de Forge (`forge tunnel`) solo debe usarse para desarrollo local; nunca para produccion ni para tests de integracion que validen limits.

Fuente: [`runbooks/links/forge/RB-012-forge-tunneling.md`](runbooks/links/forge/RB-012-forge-tunneling.md)

---

### FORGE-OPS-019

**DEFINICION:** El entorno de desarrollo via tunnel debe usar las mismas variables de entorno y configuracion que staging/produccion, gestionadas via `forge variables:set`.

Fuente: [`runbooks/links/forge/RB-012-forge-tunneling.md`](runbooks/links/forge/RB-012-forge-tunneling.md)

---

### FORGE-OPS-046-01

**DEFINICION:** Antes de implementar cualquier funcionalidad que dependa de APIs de Forge, se debe consultar el foro de Atlassian Developer Community para verificar known issues y workarounds publicados en los ultimos 90 dias.

Fuente: [`runbooks/links/RB-046-atlassian-community.md`](runbooks/links/RB-046-atlassian-community.md)

---

### FORGE-OPS-046-02

**DEFINICION:** Los patrones de Forge documentados como `recommended` o `best practice` por el equipo de Atlassian en la comunidad deben seguirse como obligatorios a menos que exista una razon tecnica documentada en `docs/exceptions.md`.

Fuente: [`runbooks/links/RB-046-atlassian-community.md`](runbooks/links/RB-046-atlassian-community.md)

---

### FORGE-OPS-046-03

**DEFINICION:** Las degradaciones de plataforma reportadas en el foro (ej. latencia elevada en Forge Storage, timeouts en Custom UI) deben incorporarse como tests de resiliencia en el suite de integracion.

Fuente: [`runbooks/links/RB-046-atlassian-community.md`](runbooks/links/RB-046-atlassian-community.md)

---

### FORGE-OPS-050-01

**DEFINICION:** Toda query GraphQL debe especificar explicitamente los campos requeridos usando fragments; nunca usar fields querying sin seleccion (`... on Node { }` vacio o queries sin field list).

Fuente: [`runbooks/links/RB-050-forge-graphql.md`](runbooks/links/RB-050-forge-graphql.md)

---

### FORGE-OPS-050-02

**DEFINICION:** Las queries GraphQL deben limitar la profundidad de nesting a 3 niveles maximos y el numero de campos por query a 15; para datos anidados profundos, usar queries separadas con DataLoader pattern.

Fuente: [`runbooks/links/RB-050-forge-graphql.md`](runbooks/links/RB-050-forge-graphql.md)

---

### FORGE-OPS-050-03

**DEFINICION:** Las mutations GraphQL deben ser idempotentes: incluir un `clientMutationId` o `idempotencyKey` unico por operacion y verificar si la mutacion ya se ejecuto antes de proceder.

Fuente: [`runbooks/links/RB-050-forge-graphql.md`](runbooks/links/RB-050-forge-graphql.md)

---

### FORGE-OPS-050-04

**DEFINICION:** Las queries GraphQL que retornan colecciones deben usar paginacion basada en cursores (`first/after` o `last/before`) con `pageInfo { hasNextPage endCursor }`; nunca usar paginacion por offset (`skip/take`).

Fuente: [`runbooks/links/RB-050-forge-graphql.md`](runbooks/links/RB-050-forge-graphql.md)

---

### FORGE-OPS-050-05

**DEFINICION:** Las operaciones GraphQL deben envolverse en un timeout configurable (default 10000ms) y un retry con backoff exponencial (maximo 3 reintentos, backoff base 1000ms) para manejar degradacion transitoria de la API.

Fuente: [`runbooks/links/RB-050-forge-graphql.md`](runbooks/links/RB-050-forge-graphql.md)

---

### FORGE-OPS-052

**DEFINICION:** Cada feature nueva del MVP debe implementarse como una "tracing bullet": un end-to-end slice vertical minimo que conecte trigger, validacion, y enforcement antes de agregar complejidad.

Fuente: [`runbooks/books/engineering/RB-052-pragmatic-programmer.md`](runbooks/books/engineering/RB-052-pragmatic-programmer.md)

---

### FORGE-OPS-053

**DEFINICION:** Toda llamada a la API de Rovo, Jira, Confluence o GitHub debe manejar fallos de forma que el sistema nunca quede en un estado inconsistente entre las plataformas.

Fuente: [`runbooks/books/engineering/RB-053-designing-data-intensive-apps.md`](runbooks/books/engineering/RB-053-designing-data-intensive-apps.md)

---

### FORGE-OPS-054

**DEFINICION:** El sistema debe degradarse gracefulmente cuando Rovo o GitHub esten unavailable, sin bloquear permanentemente los flujos de trabajo de los usuarios.

Fuente: [`runbooks/books/engineering/RB-053-designing-data-intensive-apps.md`](runbooks/books/engineering/RB-053-designing-data-intensive-apps.md)

---

### FORGE-OPS-055

**DEFINICION:** No existe una solucion tecnica unica que resuelva todos los problemas de calidad de tickets. El sistema debe disenarse como capas incrementales de validacion, no como una bala de plata.

Fuente: [`runbooks/books/engineering/RB-059-mythical-man-month.md`](runbooks/books/engineering/RB-059-mythical-man-month.md)

---

### FORGE-OPS-056

**DEFINICION:** Las estimaciones de esfuerzo para nuevas features deben basarse en evidencia historica de tareas anteriores, no en optimismo. Los plazos se ajustan al agregar personas, no se reducen proporcionalmente.

Fuente: [`runbooks/books/engineering/RB-059-mythical-man-month.md`](runbooks/books/engineering/RB-059-mythical-man-month.md)

---

### FORGE-OPS-057

**DEFINICION:** Las operaciones que modifican estado en multiples sistemas (Jira + GitHub + Forge Storage) deben ejecutarse como una unidad logica de trabajo con compensacion en caso de fallo parcial.

Fuente: [`runbooks/books/engineering/RB-060-enterprise-patterns.md`](runbooks/books/engineering/RB-060-enterprise-patterns.md)

---

### FORGE-OPS-058

**DEFINICION:** Ningun algoritmo de calculo de Consistency Score o deteccion de inconsistencias debe tener complejidad peor que O(n log n) donde n es el numero de elementos de contexto consultados desde Rovo.

Fuente: [`runbooks/books/engineering/RB-061-introduction-algorithms.md`](runbooks/books/engineering/RB-061-introduction-algorithms.md)

---

### FORGE-OPS-059

**DEFINICION:** Las operaciones de busqueda y filtrado sobre resultados de Rovo deben usar estructuras de datos indexadas (Map, Set) en vez de busqueda lineal sobre arrays.

Fuente: [`runbooks/books/engineering/RB-061-introduction-algorithms.md`](runbooks/books/engineering/RB-061-introduction-algorithms.md)

---

### FORGE-OPS-060

**DEFINICION:** Un fallo en la integracion con GitHub o Rovo no debe propagarse y causar un fallo cascada en los demas modulos del sistema.

Fuente: [`runbooks/books/engineering/RB-063-building-microservices.md`](runbooks/books/engineering/RB-063-building-microservices.md)

---

### FORGE-OPS-061

**DEFINICION:** El equipo debe establecer ciclos de feedback rapidos: cada cambio en el sistema de Quality Gates debe ser validado por un stakeholder dentro de las 24 horas siguientes al deploy a staging.

Fuente: [`runbooks/books/devops/RB-066-phoenix-project.md`](runbooks/books/devops/RB-066-phoenix-project.md)

---

### FORGE-OPS-062

**DEFINICION:** Los desarrolladores de Rovo Execution Guard deben poder ejecutar, depurar y testear localmente todo el flujo de validacion sin necesidad de un deploy a Forge, usando mocks de las APIs externas.

Fuente: [`runbooks/books/devops/RB-067-unicorn-project.md`](runbooks/books/devops/RB-067-unicorn-project.md)

---

### FORGE-OPS-063

**DEFINICION:** El sistema CI/CD debe implementar automated testing en multiples niveles: cada commit dispara unit tests, cada PR dispara integration tests, y cada deploy a staging dispara E2E tests completos.

Fuente: [`runbooks/books/devops/RB-068-devops-handbook.md`](runbooks/books/devops/RB-068-devops-handbook.md)

---

### FORGE-OPS-064

**DEFINICION:** El Change Failure Rate del sistema debe mantenerse por debajo del 10%. Si supera el 15%, se detiene el desarrollo de nuevas features hasta estabilizar.

Fuente: [`runbooks/books/devops/RB-069-accelerate.md`](runbooks/books/devops/RB-069-accelerate.md)

---

### FORGE-OPS-065

**DEFINICION:** La carga cognitiva del equipo de desarrollo debe gestionarse limitando el numero de dominios tecnicos que un desarrollador necesita dominar simultaneamente. Cada modulo debe tener una interfaz simplificada que oculte su complejidad interna.

Fuente: [`runbooks/books/devops/RB-070-team-topologies.md`](runbooks/books/devops/RB-070-team-topologies.md)

---

### FORGE-OPS-0762

**DEFINICION:** Las funciones Forge que orquestan validaciones (triggers, resolvers) deben ejecutar toda la logica de negocio en menos de 5 segundos, delegando trabajo superficial (notificaciones, logging) a funciones pospuestas o queues.

Fuente: [`runbooks/books/strategy/RB-076-deep-work.md`](runbooks/books/strategy/RB-076-deep-work.md)

---

### FORGE-OPS-0774

**DEFINICION:** Cada iteracion del sistema debe dejar al menos una metrica de observabilidad nueva o mejorada: un nuevo log estructurado, un counter, o un timer.

Fuente: [`runbooks/books/strategy/RB-077-atomic-habits.md`](runbooks/books/strategy/RB-077-atomic-habits.md)

---

### FORGE-OPS-0783

**DEFINICION:** Las features experimentales (como sugerencias de reescritura de tickets con IA) deben estar protegidas por feature flags almacenadas en Forge Storage, con valores por defecto desactivados.

Fuente: [`runbooks/books/strategy/RB-078-lean-startup.md`](runbooks/books/strategy/RB-078-lean-startup.md)

---

### FORGE-OPS-0791

**DEFINICION:** Cada modulo del Forge app debe tener un unico owner responsable definido en un archivo `OWNERS.md` en la raiz del modulo, responsable de la calidad, seguridad y rendimiento de su codigo.

Fuente: [`runbooks/books/strategy/RB-079-extreme-ownership.md`](runbooks/books/strategy/RB-079-extreme-ownership.md)

---

### FORGE-OPS-0803

**DEFINICION:** El producto debe capturar un nicho inicial (equipos de desarrollo usando Jira + GitHub) antes de expandirse a otros casos de uso, y la arquitectura debe reflejar esta verticalizacion.

Fuente: [`runbooks/books/strategy/RB-080-zero-to-one.md`](runbooks/books/strategy/RB-080-zero-to-one.md)

---

### FORGE-OPS-0812

**DEFINICION:** Las reuniones de sincronizacion entre modulos (scoring -> enforcement -> observability) se reemplazan por eventos asincronos via Forge Event Bridge, donde cada modulo publica su resultado y los modulos downstream reaccionan.

Fuente: [`runbooks/books/strategy/RB-081-high-output-management.md`](runbooks/books/strategy/RB-081-high-output-management.md)

---

### FORGE-OPS-0834

**DEFINICION:** Cada iteracion del producto debe poder desplegarse independientemente: un cambio en el scoring engine no requiere redeployar el admin dashboard, y viceversa.

Fuente: [`runbooks/books/strategy/RB-083-the-innovators.md`](runbooks/books/strategy/RB-083-the-innovators.md)

---

### FORGE-OPS-0843

**DEFINICION:** El flujo de validacion debe ejecutarse en el menor numero posible de pasos secuenciales, eliminando cualquier llamada a API externa que no sea estrictamente necesaria para la decision de enforcement.

Fuente: [`runbooks/books/strategy/RB-084-steve-jobs.md`](runbooks/books/strategy/RB-084-steve-jobs.md)

---

### FORGE-OPS-0851

**DEFINICION:** El sistema debe operar en dos modos: "peacetime" (validacion suave, sugerencias, learning) y "wartime" (enforcement estricto, bloqueo inmediato). El modo se configura por proyecto y se cambia cuando el equipo necesita mas o menos control.

Fuente: [`runbooks/books/strategy/RB-085-hard-things.md`](runbooks/books/strategy/RB-085-hard-things.md)

---

### FORGE-OPS-0864

**DEFINICION:** Las reglas de scoring por defecto deben ser las 5 que generan mayor impacto medible en la calidad de tickets. No incluir reglas "por completitud" que no tengan evidencia de impacto.

Fuente: [`runbooks/books/culture/RB-086-essentialism.md`](runbooks/books/culture/RB-086-essentialism.md)

---

### FORGE-OPS-0871

**DEFINICION:** Las funciones Forge que responden a triggers de UI (issue panel, admin dashboard) deben retornar en menos de 2 segundos para no interrumpir el flow state del usuario que trabaja en Jira.

Fuente: [`runbooks/books/culture/RB-087-peopleware.md`](runbooks/books/culture/RB-087-peopleware.md)

---

### FORGE-OPS-0883

**DEFINICION:** Cada trigger de Forge debe estar disenado para manejar la carga maxima esperada (100 tickets simultaneos) sin degradar el rendimiento, priorizando la deduccion sobre la velocidad bruta.

Fuente: [`runbooks/books/culture/RB-088-soul-new-machine.md`](runbooks/books/culture/RB-088-soul-new-machine.md)

---

### FORGE-OPS-0894

**DEFINICION:** El codigo debe ser refactory-friendly: la estructura permite cambiar la implementacion de cualquier modulo sin afectar los consumidores, como un pintor puede cambiar la paleta de colores sin rediseñar la composicion.

Fuente: [`runbooks/books/culture/RB-089-hackers-painters.md`](runbooks/books/culture/RB-089-hackers-painters.md)

---

### FORGE-OPS-0904

**DEFINICION:** El sistema debe implementar "exponential backoff with jitter" para reintentos de llamadas a APIs externas fallidas, evitando el problema de thundering herd cuando un servicio se recupera.

Fuente: [`runbooks/books/culture/RB-090-algorithms-live-by.md`](runbooks/books/culture/RB-090-algorithms-live-by.md)

---

### FORGE-OPS-0911

**DEFINICION:** El sistema debe estar disenado para sobrevivir eventos de cola pesada: un pico de 1000 tickets creados simultaneamente, una interrupcion de 6 horas de la API de Jira, o una respuesta de Rovo con 50MB de datos no deben causar perdida de datos ni estados corruptos.

Fuente: [`runbooks/books/culture/RB-091-black-swan.md`](runbooks/books/culture/RB-091-black-swan.md)

---

### FORGE-OPS-0922

**DEFINICION:** Los despliegues deben ser autonomos: el sistema se auto-monitorea post-deploy y ejecuta un rollback automatico si los errores en Sentry aumentan mas de 3x en los 15 minutos posteriores al deploy.

Fuente: [`runbooks/books/culture/RB-092-antifragile.md`](runbooks/books/culture/RB-092-antifragile.md)

---

### FORGE-OPS-0935

**DEFINICION:** Cada desarrollador debe poder ejecutar el Forge app en modo local con `forge tunnel` y ver sus cambios reflejados en Jira en menos de 10 segundos despues de guardar un archivo, manteniendo un ciclo de feedback rapido durante el desarrollo.

Fuente: [`runbooks/books/culture/RB-093-soft-skills.md`](runbooks/books/culture/RB-093-soft-skills.md)

---

### FORGE-OPS-0944

**DEFINICION:** Todas las operaciones de Forge Storage deben optimizar el numero de llamadas: batch reads en una unica llamada, y usar queries con prefijo para evitar escaneos completos.

Fuente: [`runbooks/books/culture/RB-094-art-computer-programming.md`](runbooks/books/culture/RB-094-art-computer-programming.md)

---

### FORGE-OPS-0952

**DEFINICION:** El codigo del Forge app debe aprovechar los features modernos de JavaScript/TypeScript: optional chaining (`?.`), nullish coalescing (`??`), destructuring, y template literals. Prohibir patrones legacy (verificacion manual de null, concatenacion de strings con `+`).

Fuente: [`runbooks/books/culture/RB-095-eloquent-javascript.md`](runbooks/books/culture/RB-095-eloquent-javascript.md)

---

### FORGE-OPS-0964

**DEFINICION:** El equipo debe mantener un horario sostenible de desarrollo. Si el sprint requiere horas extra recurrentes para completarse, el sprint esta mal estimado, no el equipo es lento.

Fuente: [`runbooks/books/culture/RB-096-clean-coder.md`](runbooks/books/culture/RB-096-clean-coder.md)

---

### FORGE-OPS-0974

**DEFINICION:** Los patrones de deteccion de inconsistencias deben poder aprender de si mismos: el sistema debe detectar cuando dos detectores producen resultados contradictorios para el mismo ticket y generar una alerta para resolucion.

Fuente: [`runbooks/books/ai-future/RB-097-godel-escher-bach.md`](runbooks/books/ai-future/RB-097-godel-escher-bach.md)

---

### FORGE-OPS-0983

**DEFINICION:** Las llamadas a IA deben tener costos controlados: cada llamada se registra con el numero de tokens usados, el costo estimado, y se agrega a un contador mensual por proyecto que bloquea nuevas llamadas si se excede el presupuesto configurado.

Fuente: [`runbooks/books/ai-future/RB-098-co-intelligence.md`](runbooks/books/ai-future/RB-098-co-intelligence.md)

---

### FORGE-OPS-0994

**DEFINICION:** El razonamiento del sistema sobre un ticket (evaluacion de reglas, deteccion de inconsistencias) debe ser completamente trazeable: cada paso de la cadena de razonamiento se registra como un nodo en un arbol de decision auditable.

Fuente: [`runbooks/books/ai-future/RB-099-ai-modern-approach.md`](runbooks/books/ai-future/RB-099-ai-modern-approach.md)

---

### FORGE-OPS-1003

**DEFINICION:** El producto debe tener una estrategia de "mercado emergente": disenar las features de enforcement para un segmento inicial (equipos de 5-15 desarrolladores con Jira Cloud + GitHub) y optimizar agresivamente para ese segmento antes de expandirse.

Fuente: [`runbooks/books/strategy/RB-100-innovators-dilemma.md`](runbooks/books/strategy/RB-100-innovators-dilemma.md)

---

## SEC-PRIV - Seguridad, Privacidad & Auth

> 56 reglas

### SEC-PRIV-001

**DEFINICION:** Todos los scopes de API declarados en `manifest.yml` deben corresponder exactamente a las operaciones que el modulo realiza, sin scopes sobrantes. El principio de least privilege aplica tanto a Jira scopes, Confluence scopes, como a GitHub App permissions.

Fuente: [`runbooks/links/RB-SEC-001-security-privacy-auth.md`](runbooks/links/RB-SEC-001-security-privacy-auth.md)

---

### SEC-PRIV-002

**DEFINICION:** Ningun dato sensible (GitHub App private key, installation tokens, API keys, Jira webhook secrets, user PII) puede aparecer en el codigo fuente, logs estructurados, respuestas de Custom UI, ni en Forge Storage sin encriptar.

Fuente: [`runbooks/links/RB-SEC-001-security-privacy-auth.md`](runbooks/links/RB-SEC-001-security-privacy-auth.md)

---

### SEC-PRIV-003

**DEFINICION:** La autenticacion de la GitHub App debe implementar un ciclo de vida completo de tokens: obtener un installation access token fresco antes de cada operacion, nunca cachear tokens mas alla de su expiracion de 1 hora, y rotar la private key periodicamente soportando multiples claves registradas simu...

Fuente: [`runbooks/links/RB-SEC-001-security-privacy-auth.md`](runbooks/links/RB-SEC-001-security-privacy-auth.md)

---

### SEC-PRIV-004

**DEFINICION:** Toda entrada externa (Jira webhook payloads, GitHub webhook events, datos de formularios del Admin Dashboard, parametros de resolvers) debe ser validada y sanitizada antes de ser procesada, usando esquemas estrictos que rechacen datos inesperados.

Fuente: [`runbooks/links/RB-SEC-001-security-privacy-auth.md`](runbooks/links/RB-SEC-001-security-privacy-auth.md)

---

### SEC-PRIV-005

**DEFINICION:** El sistema debe cumplir con las Forge Data Privacy Guidelines implementando: (1) clasificacion de datos por nivel de sensibilidad, (2) soporte para solicitudes de eliminacion de datos de usuarios, (3) minimizacion de datos almacenados en Forge Storage eliminando registros de auditoria mas antiguo...

Fuente: [`runbooks/links/RB-SEC-001-security-privacy-auth.md`](runbooks/links/RB-SEC-001-security-privacy-auth.md)

---

### SEC-PRIV-006

**DEFINICION:** Los tokens de autenticacion obtenidos via `@forge/bridge` no deben almacenarse en localStorage, sessionStorage, ni en variables globales.

Fuente: [`runbooks/links/forge/RB-008-forge-custom-ui.md`](runbooks/links/forge/RB-008-forge-custom-ui.md)

---

### SEC-PRIV-007

**DEFINICION:** La app no debe procesar ni almacenar categorias de datos sensibles (datos de salud, financieros, de menores de edad, biometricos) sin un Data Protection Impact Assessment (DPIA) documentado.

Fuente: [`runbooks/links/forge/RB-011-data-privacy.md`](runbooks/links/forge/RB-011-data-privacy.md)

---

### SEC-PRIV-008

**DEFINICION:** La app debe implementar data minimization: solo recopilar y retener los datos estrictamente necesarios para la funcion de consistency scoring.

Fuente: [`runbooks/links/forge/RB-011-data-privacy.md`](runbooks/links/forge/RB-011-data-privacy.md)

---

### SEC-PRIV-009

**DEFINICION:** La app debe respetar el modelo de responsabilidad compartida: el desarrollador es responsable de la seguridad de la logica de la app, el cifrado de datos en transito y el manejo correcto de errores.

Fuente: [`runbooks/links/forge/RB-011-data-privacy.md`](runbooks/links/forge/RB-011-data-privacy.md)

---

### SEC-PRIV-010

**DEFINICION:** La app debe implementar un mecanismo de auditoria que registre quien (accountId) ejecuto que accion (accion), cuando (timestamp) y sobre que recurso (issueKey/PR URL).

Fuente: [`runbooks/links/forge/RB-011-data-privacy.md`](runbooks/links/forge/RB-011-data-privacy.md)

---

### SEC-PRIV-041-01

**DEFINICION:** El app descriptor (`manifest.yml`) debe declarar todos los scopes de API utilizados bajo el principio de minimo privilegio; ningun scope puede solicitarse sin evidencia de uso directo en el codigo.

Fuente: [`runbooks/links/RB-041-marketplace-terms.md`](runbooks/links/RB-041-marketplace-terms.md)

---

### SEC-PRIV-041-02

**DEFINICION:** Ningun dato personal identificable (PII) de usuarios de Atlassian puede almacenarse en Forge Storage sin consentimiento explicito y sin aplicar ofuscacion o hash antes de la persistencia.

Fuente: [`runbooks/links/RB-041-marketplace-terms.md`](runbooks/links/RB-041-marketplace-terms.md)

---

### SEC-PRIV-041-03

**DEFINICION:** La licencia de la app debe validarse via Forge Licensing API en cada invocation del handler principal; si la licencia es invalida o expiro, el handler debe retornar un mensaje de upgrade en vez de ejecutar la logica de negocio.

Fuente: [`runbooks/links/RB-041-marketplace-terms.md`](runbooks/links/RB-041-marketplace-terms.md)

---

### SEC-PRIV-041-04

**DEFINICION:** La app debe cumplir con los requisitos de Data Residency de Atlassian: si el tenant tiene data residency configurado, los datos no deben salir de la region especificada, verificable mediante `context.region`.

Fuente: [`runbooks/links/RB-041-marketplace-terms.md`](runbooks/links/RB-041-marketplace-terms.md)

---

### SEC-PRIV-041-05

**DEFINICION:** El EULA y la politica de privacidad deben estar disponibles como URLs publicas accesibles y referenciadas en el `manifest.yml` antes de cada envio a Marketplace Review.

Fuente: [`runbooks/links/RB-041-marketplace-terms.md`](runbooks/links/RB-041-marketplace-terms.md)

---

### SEC-PRIV-051

**DEFINICION:** Toda entrada externa (payload de webhook de GitHub, respuesta de Rovo, datos de Jira API) debe ser validada y saneada antes de ser procesada por la capa de dominio.

Fuente: [`runbooks/books/engineering/RB-056-code-complete.md`](runbooks/books/engineering/RB-056-code-complete.md)

---

### SEC-PRIV-052

**DEFINICION:** Ningun assertion interno debe ser omitido o deshabilitado. Las precondiciones y postcondiciones de las funciones criticas de Quality Gate deben ser verificadas en runtime.

Fuente: [`runbooks/books/engineering/RB-056-code-complete.md`](runbooks/books/engineering/RB-056-code-complete.md)

---

### SEC-PRIV-053

**DEFINICION:** El sistema debe mantener un control estricto sobre los datos que se envian a Rovo y los que se reciben, asegurando que la informacion sensible de los tickets (datos personales, credenciales, secretos) no se exponga en las consultas.

Fuente: [`runbooks/books/ai-future/RB-071-life-3.md`](runbooks/books/ai-future/RB-071-life-3.md)

---

### SEC-PRIV-054

**DEFINICION:** Los permisos de la integracion con GitHub y Jira deben seguir el principio de minimo privilegio: el sistema solo puede realizar las acciones estrictamente necesarias para el enforcement, y cualquier permiso adicional debe justificarse explicitamente.

Fuente: [`runbooks/books/ai-future/RB-072-superintelligence.md`](runbooks/books/ai-future/RB-072-superintelligence.md)

---

### SEC-PRIV-0792

**DEFINICION:** Ningun bloque try-catch debe tragarse errores silenciosamente. Todo error debe ser loggeado con contexto suficiente (modulo, operacion, issueKey) y propagado o manejado explicitamente.

Fuente: [`runbooks/books/strategy/RB-079-extreme-ownership.md`](runbooks/books/strategy/RB-079-extreme-ownership.md)

---

### SEC-PRIV-0804

**DEFINICION:** Los datos de contexto organizacional obtenidos via Rovo nunca deben almacenarse fuera de Forge Storage ni exponerse en logs. El diferenciador del producto (el contexto) es tambien el activo mas sensible.

Fuente: [`runbooks/books/strategy/RB-080-zero-to-one.md`](runbooks/books/strategy/RB-080-zero-to-one.md)

---

### SEC-PRIV-0825

**DEFINICION:** Las decisiones de seguridad (que datos se loggean, que se almacena en cache, que se envia al cliente) deben documentarse explicitamente en un archivo `SECURITY-DECISIONS.md` con la justificacion de cada una.

Fuente: [`runbooks/books/strategy/RB-082-radical-candor.md`](runbooks/books/strategy/RB-082-radical-candor.md)

---

### SEC-PRIV-0844

**DEFINICION:** Los permisos del Forge app deben ser los minimos absolutos necesarios: cada scope en el manifest.yml debe tener un comentario explicando por que es necesario y que funcionalidad lo requiere.

Fuente: [`runbooks/books/strategy/RB-084-steve-jobs.md`](runbooks/books/strategy/RB-084-steve-jobs.md)

---

### SEC-PRIV-0854

**DEFINICION:** Cuando se detecta una vulnerabilidad de seguridad (Snyk alert, dependencia comprometida), el fix tiene prioridad absoluta sobre cualquier feature en curso. El deploy del fix es inmediato a produccion sin esperar al ciclo normal de release.

Fuente: [`runbooks/books/strategy/RB-085-hard-things.md`](runbooks/books/strategy/RB-085-hard-things.md)

---

### SEC-PRIV-0914

**DEFINICION:** Las decisiones de seguridad deben asumir que los datos de entrada son hostiles: cada campo de un ticket, cada payload de webhook, y cada respuesta de Rovo puede contener datos maliciosos (XSS, injection, data exfiltration).

Fuente: [`runbooks/books/culture/RB-091-black-swan.md`](runbooks/books/culture/RB-091-black-swan.md)

---

### SEC-PRIV-0925

**DEFINICION:** El sistema debe gainar resiliencia con cada intento de ataque fallido: registrar patrones de inputs sospechosos y endurecer automaticamente las validaciones para esos patrones.

Fuente: [`runbooks/books/culture/RB-092-antifragile.md`](runbooks/books/culture/RB-092-antifragile.md)

---

### SEC-PRIV-0963

**DEFINICION:** Los desarrolladores son responsables de la seguridad del codigo que escriben. Cada PR debe incluir una auto-revision de seguridad: ¿esta funcion expone datos sensibles? ¿esta consulta es vulnerable a injection? ¿este token se almacena correctamente?

Fuente: [`runbooks/books/culture/RB-096-clean-coder.md`](runbooks/books/culture/RB-096-clean-coder.md)

---

### SEC-PRIV-0985

**DEFINICION:** Los prompts enviados a modelos de IA nunca deben contener datos personales identificables (nombres de usuarios, emails, contenido sensible de tickets). Los datos se anonimizan antes de enviar al modelo.

Fuente: [`runbooks/books/ai-future/RB-098-co-intelligence.md`](runbooks/books/ai-future/RB-098-co-intelligence.md)

---

### SEC-PRIV-241

**DEFINICION:** Toda respuesta HTTP debe incluir los headers de seguridad: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Strict-Transport-Security: max-age=31536000; includeSubDomains`, y `Content-Security-Policy` configurado para el contexto.

Fuente: [`runbooks/links/RB-028-nodejs-best-practices.md`](runbooks/links/RB-028-nodejs-best-practices.md)

---

### SEC-PRIV-251

**DEFINICION:** Toda entrada de usuario (query params, body, headers, URL path segments) debe ser validada y sanitizada contra un schema definido antes de ser procesada; prohibido pasar datos crudos del request directamente a queries, comandos shell, o respuestas HTML.

Fuente: [`runbooks/links/RB-029-owasp-top10.md`](runbooks/links/RB-029-owasp-top10.md)

---

### SEC-PRIV-252

**DEFINICION:** Toda salida renderizada al usuario debe escapar contenido dinamico; prohibido usar `innerHTML`, `dangerouslySetInnerHTML`, o interpolacion sin escape en templates HTML.

Fuente: [`runbooks/links/RB-029-owasp-top10.md`](runbooks/links/RB-029-owasp-top10.md)

---

### SEC-PRIV-253

**DEFINICION:** Toda operacion que modifique estado (write, delete, admin action) debe verificar autorizacion antes de ejecutar; prohibido confiar solo en que el usuario esta autenticado. Implementar checks de permisos granulares por recurso.

Fuente: [`runbooks/links/RB-029-owasp-top10.md`](runbooks/links/RB-029-owasp-top10.md)

---

### SEC-PRIV-254

**DEFINICION:** Toda solicitud que modifique estado debe incluir un token CSRF synchronizer o usar el patron Double Submit Cookie; las APIs stateless con JWT en header `Authorization` estan exentas si no usan cookies.

Fuente: [`runbooks/links/RB-029-owasp-top10.md`](runbooks/links/RB-029-owasp-top10.md)

---

### SEC-PRIV-255

**DEFINICION:** Prohibido almacenar secretos, tokens, contrasenas o claves privadas en el codigo fuente; usar variables de entorno inyectadas en runtime y un vault (Forge Encrypted Storage, AWS Secrets Manager, HashiCorp Vault) para secretos persistentes.

Fuente: [`runbooks/links/RB-029-owasp-top10.md`](runbooks/links/RB-029-owasp-top10.md)

---

### SEC-PRIV-261

**DEFINICION:** Toda integracion OAuth 2.0 debe usar el flujo Authorization Code con PKCE (`code_challenge_method: S256`); prohibido usar Implicit Grant, Resource Owner Password Credentials, o Client Credentials para flujos con interaccion de usuario.

Fuente: [`runbooks/links/RB-030-oauth2.md`](runbooks/links/RB-030-oauth2.md)

---

### SEC-PRIV-262

**DEFINICION:** Los access tokens deben almacenarse exclusivamente en memoria o en httpOnly+Secure cookies con `SameSite=Strict`; prohibido almacenar tokens en `localStorage`, `sessionStorage`, o cookies sin httpOnly.

Fuente: [`runbooks/links/RB-030-oauth2.md`](runbooks/links/RB-030-oauth2.md)

---

### SEC-PRIV-263

**DEFINICION:** Los scopes OAuth deben solicitar el minimo privilegio necesario para la operacion actual; cada scope debe estar documentado con su justificacion de uso. Si una operacion no necesita write access, no solicitarlo.

Fuente: [`runbooks/links/RB-030-oauth2.md`](runbooks/links/RB-030-oauth2.md)

---

### SEC-PRIV-264

**DEFINICION:** Todo access token debe tener una expiracion maxima de 15 minutos (900 segundos); usar refresh tokens con rotacion (cada uso invalida el anterior) para mantener la sesion.

Fuente: [`runbooks/links/RB-030-oauth2.md`](runbooks/links/RB-030-oauth2.md)

---

### SEC-PRIV-265

**DEFINICION:** Toda redireccion OAuth debe validar que la URL de redirect URI este en una whitelist estricta; prohibido usar redirect URI parametrico que acepte cualquier dominio o path dinamico.

Fuente: [`runbooks/links/RB-030-oauth2.md`](runbooks/links/RB-030-oauth2.md)

---

### SEC-PRIV-271

**DEFINICION:** Todo JWT recibido debe ser validado en su totalidad antes de extraer claims: verificar firma con la clave publica/secreto correcto, verificar `exp` (expiracion), `nbf` (not before), `iss` (issuer) y `aud` (audience).

Fuente: [`runbooks/links/RB-031-jwt.md`](runbooks/links/RB-031-jwt.md)

---

### SEC-PRIV-272

**DEFINICION:** La expiracion del access token (`exp`) debe ser de 15 minutos maximo; la expiracion del refresh token debe ser de 7 dias con rotacion en cada uso; prohibido emitir tokens sin claim `exp`.

Fuente: [`runbooks/links/RB-031-jwt.md`](runbooks/links/RB-031-jwt.md)

---

### SEC-PRIV-273

**DEFINICION:** Prohibido almacenar datos sensibles (PII, secretos, permisos detallados) en el payload del JWT; el payload es base64-encoded, no encriptado, y es legible por cualquier parte que intercepte el token.

Fuente: [`runbooks/links/RB-031-jwt.md`](runbooks/links/RB-031-jwt.md)

---

### SEC-PRIV-274

**DEFINICION:** La firma del JWT debe usar RS256 (RSA + SHA-256) o ES256 (ECDSA + SHA-256); prohibido usar HS256 (HMAC simetrico) en sistemas distribuidos donde multiples servicios verifican tokens.

Fuente: [`runbooks/links/RB-031-jwt.md`](runbooks/links/RB-031-jwt.md)

---

### SEC-PRIV-275

**DEFINICION:** Implementar una lista de revocacion (token blacklist) para JWTs que deben ser invalidados antes de su expiracion (logout, cambio de password, deteccion de compromiso); verificar la lista en cada validacion.

Fuente: [`runbooks/links/RB-031-jwt.md`](runbooks/links/RB-031-jwt.md)

---

### SEC-PRIV-281

**DEFINICION:** El escaneo de vulnerabilidades de Snyk debe ejecutarse en cada pull request como un check obligatorio; el PR no puede ser mergeado si existen vulnerabilidades con severidad `high` o `critical` sin una mitigacion documentada.

Fuente: [`runbooks/links/RB-034-snyk-security.md`](runbooks/links/RB-034-snyk-security.md)

---

### SEC-PRIV-282

**DEFINICION:** Ejecutar `snyk test` y `snyk monitor` semanalmente en la rama main para detectar vulnerabilidades descubiertas en dependencias ya instaladas; el resultado de `monitor` mantiene un inventario actualizado en el dashboard de Snyk.

Fuente: [`runbooks/links/RB-034-snyk-security.md`](runbooks/links/RB-034-snyk-security.md)

---

### SEC-PRIV-283

**DEFINICION:** Todo CVE con severidad `critical` debe ser parchado en un maximo de 48 horas; severidad `high` en 7 dias; severidad `medium` en 30 dias; las vulnerabilidades aceptadas deben tener un risk acceptance documentado con fecha de revision.

Fuente: [`runbooks/links/RB-034-snyk-security.md`](runbooks/links/RB-034-snyk-security.md)

---

### SEC-PRIV-284

**DEFINICION:** Mantener un archivo `.snyk` policy file versionado que documente las vulnerabilidades aceptadas con: ID del CVE, razon de aceptacion, fecha de revision, y responsable; toda exclusion debe tener una fecha de expiracion.

Fuente: [`runbooks/links/RB-034-snyk-security.md`](runbooks/links/RB-034-snyk-security.md)

---

### SEC-PRIV-285

**DEFINICION:** Prohibido instalar dependencias con licencias copyleft (GPL, AGPL, LGPL) sin aprobacion legal; configurar Snyk para bloquear PRs que introduzcan dependencias con licencias no aprobadas.

Fuente: [`runbooks/links/RB-034-snyk-security.md`](runbooks/links/RB-034-snyk-security.md)

---

### SEC-PRIV-301

**DEFINICION:** Todo webhook recibido desde GitHub debe ser verificado usando HMAC-SHA256 con el secret configurado en la GitHub App antes de procesar cualquier payload. La verificacion debe comparar el header `X-Hub-Signature-256` con el hash computado sobre el raw body (no el parsed JSON).

Fuente: [`runbooks/links/github-devops/RB-015-github-webhooks.md`](runbooks/links/github-devops/RB-015-github-webhooks.md)

---

### SEC-PRIV-302

**DEFINICION:** Los webhooks de GitHub deben ser recibidos exclusivamente sobre HTTPS y el endpoint debe retornar HTTP 200 dentro de los primeros 5 segundos de procesamiento, delegando el trabajo pesado (scoring, llamadas a Rovo, publicacion de status checks) a un proceso asincrono o cola.

Fuente: [`runbooks/links/github-devops/RB-015-github-webhooks.md`](runbooks/links/github-devops/RB-015-github-webhooks.md)

---

### SEC-PRIV-303

**DEFINICION:** Los secrets de GitHub Actions (`FORGE_API_TOKEN`, `GITHUB_APP_PRIVATE_KEY`, `WEBHOOK_SECRET`) deben accederse exclusivamente via `${{ secrets.SECRET_NAME }}` y nunca imprimirse en logs. Los workflows deben incluir `echo "::add-mask::<value>"` para cualquier valor sensible derivado.

Fuente: [`runbooks/links/github-devops/RB-016-github-actions.md`](runbooks/links/github-devops/RB-016-github-actions.md)

---

### SEC-PRIV-304

**DEFINICION:** La autenticacion como GitHub App debe generar un JWT (JSON Web Token) firmado con la clave privada de la App (RSA-SHA256), con un `iat` (issued at) de 60 segundos en el pasado y una `exp` (expiration) de maximo 10 minutos. El JWT nunca debe cachearse mas de 8 minutos.

Fuente: [`runbooks/links/github-devops/RB-019-github-apps-auth.md`](runbooks/links/github-devops/RB-019-github-apps-auth.md)

---

### SEC-PRIV-305

**DEFINICION:** Para interactuar con recursos de un repositorio, se debe obtener un installation token via `POST /app/installations/{installation_id}/access_tokens`, usando el JWT de la App. El installation token tiene una vida util de 1 hora y debe refrescarse antes de expirar. El token debe cachearse con el ca...

Fuente: [`runbooks/links/github-devops/RB-019-github-apps-auth.md`](runbooks/links/github-devops/RB-019-github-apps-auth.md)

---

### SEC-PRIV-306

**DEFINICION:** Los permisos de la GitHub App deben configurarse con el principio de menor privilegio: unicamente los permisos necesarios para la funcionalidad de Rovo Execution Guard. Los permisos requeridos son: `checks:write` (publicar status checks), `pull_requests:write` (postear comentarios), `contents:rea...

Fuente: [`runbooks/links/github-devops/RB-019-github-apps-auth.md`](runbooks/links/github-devops/RB-019-github-apps-auth.md)

---

### SEC-PRIV-307

**DEFINICION:** La clave privada RSA de la GitHub App debe rotarse cada 90 dias maximo, almacenarse exclusivamente como secret en Forge Storage o GitHub Secrets (nunca en el codigo fuente ni en archivos `.env`), y la rotacion debe generar un nuevo par de claves de al menos 2048 bits.

Fuente: [`runbooks/links/github-devops/RB-019-github-apps-auth.md`](runbooks/links/github-devops/RB-019-github-apps-auth.md)

---

## ARCH-SOLID - Arquitectura & SOLID

> 104 reglas

### ARCH-SOLID-001

**DEFINICION:** El `runtime.name` en el manifest debe especificar explicitamente una version LTS de Node.js soportada (`nodejs20.x`, `nodejs22.x` o `nodejs24.x`).

Fuente: [`runbooks/links/forge/RB-001-forge-manifest.md`](runbooks/links/forge/RB-001-forge-manifest.md)

---

### ARCH-SOLID-002

**DEFINICION:** El contenido de campos de Jira debe leerse como documentos ADF (Atlassian Document Format), no como texto plano.

Fuente: [`runbooks/links/forge/RB-004-jira-rest-api.md`](runbooks/links/forge/RB-004-jira-rest-api.md)

---

### ARCH-SOLID-003

**DEFINICION:** Las llamadas a la API v2 deben expandir unicamente los campos necesarios usando el parametro `body-format` o `expand`, nunca solicitar el body completo cuando solo se necesitan metadatos.

Fuente: [`runbooks/links/forge/RB-005-confluence-rest-api.md`](runbooks/links/forge/RB-005-confluence-rest-api.md)

---

### ARCH-SOLID-004

**DEFINICION:** La logica de negocio (scoring, validacion, llamadas API) debe residir en Forge Functions separadas, no en componentes UI Kit.

Fuente: [`runbooks/links/forge/RB-007-forge-ui-kit.md`](runbooks/links/forge/RB-007-forge-ui-kit.md)

---

### ARCH-SOLID-005

**DEFINICION:** El acceso a Forge Storage debe estar encapsulado en un repositorio (Data Access Layer), no esparcido en la logica de negocio.

Fuente: [`runbooks/links/forge/RB-009-forge-storage-api.md`](runbooks/links/forge/RB-009-forge-storage-api.md)

---

### ARCH-SOLID-006

**DEFINICION:** Las funciones Forge deben usar el patron Handler -> Service -> Repository, donde el handler es la funcion exportada, el service contiene la logica de negocio y el repository accede a datos.

Fuente: [`runbooks/links/forge/RB-010-forge-runtime.md`](runbooks/links/forge/RB-010-forge-runtime.md)

---

### ARCH-SOLID-007

**DEFINICION:** La integracion con Rovo debe estar desacoplada del scoring engine mediante un adaptador, permitiendo mockear Rovo en tests y reemplazarlo si el API cambia.

Fuente: [`runbooks/links/forge/RB-013-rovo-docs.md`](runbooks/links/forge/RB-013-rovo-docs.md)

---

### ARCH-SOLID-0103

**DEFINICION:** La configuracion de la aplicacion (thresholds de scoring, URLs de APIs, flags de feature, modo degradado) debe almacenarse exclusivamente en Forge Storage como key-value pairs con el prefijo `config:`, nunca hardcoded en el codigo fuente ni en variables de entorno del runtime.

Fuente: [`runbooks/links/forge-platform-limits.md`](runbooks/links/forge-platform-limits.md)

---

### ARCH-SOLID-039-01

**DEFINICION:** Todo evento interno debe cumplir el formato CloudEvents v1.0 con los atributos obligatorios: `specversion`, `type`, `source`, `id`, `time`, y `datacontenttype`.

Fuente: [`runbooks/links/RB-039-cloudevents.md`](runbooks/links/RB-039-cloudevents.md)

---

### ARCH-SOLID-039-02

**DEFINICION:** El atributo `type` debe seguir el patron `com.atlassian.execution_guard.<domain>.<action>.<version>` donde action es uno de: `created`, `updated`, `deleted`, `scored`, `enforced`.

Fuente: [`runbooks/links/RB-039-cloudevents.md`](runbooks/links/RB-039-cloudevents.md)

---

### ARCH-SOLID-039-03

**DEFINICION:** El atributo `source` debe identificar univocamente el modulo productor usando el formato `/execution-guard/<module>/<adapter>`; nunca usar URLs de dominio externo.

Fuente: [`runbooks/links/RB-039-cloudevents.md`](runbooks/links/RB-039-cloudevents.md)

---

### ARCH-SOLID-039-04

**DEFINICION:** El campo `data` de cada evento debe estar tipado con una interfaz TypeScript especifica por tipo de evento; nunca usar `any` o `Record<string, unknown>` como tipo de data.

Fuente: [`runbooks/links/RB-039-cloudevents.md`](runbooks/links/RB-039-cloudevents.md)

---

### ARCH-SOLID-039-05

**DEFINICION:** Los atributos de extension customizados deben usar el prefijo `xeg-` (execution-guard) y documentarse en `docs/event-extensions.md`; nunca anadir extensiones sin documentacion.

Fuente: [`runbooks/links/RB-039-cloudevents.md`](runbooks/links/RB-039-cloudevents.md)

---

### ARCH-SOLID-040-01

**DEFINICION:** Los endpoints deben usar sustantivos en plural para colecciones (`/quality-gates`, `/executions`, `/enforcements`) y kebab-case para nombres compuestos; nunca verbos en la URL.

Fuente: [`runbooks/links/RB-040-rest-api-design.md`](runbooks/links/RB-040-rest-api-design.md)

---

### ARCH-SOLID-040-02

**DEFINICION:** La version de API debe especificarse en la URL como `/v1/` y cada version mayor debe mantener compatibilidad hacia atras durante al menos 6 meses tras su depreciacion.

Fuente: [`runbooks/links/RB-040-rest-api-design.md`](runbooks/links/RB-040-rest-api-design.md)

---

### ARCH-SOLID-040-03

**DEFINICION:** Los errores deben retornar un objeto JSON estandarizado con campos: `error.code` (string machine-readable), `error.message` (human-readable), `error.target` (campo o recurso causante), y `error.details` (array de errores anidados si aplica).

Fuente: [`runbooks/links/RB-040-rest-api-design.md`](runbooks/links/RB-040-rest-api-design.md)

---

### ARCH-SOLID-040-04

**DEFINICION:** Las colecciones que retornan mas de 20 items deben implementar paginacion con los parametros `limit` (max 100, default 20) y `cursor` (token opaco), retornando `nextCursor` y `hasMore` en la respuesta.

Fuente: [`runbooks/links/RB-040-rest-api-design.md`](runbooks/links/RB-040-rest-api-design.md)

---

### ARCH-SOLID-040-05

**DEFINICION:** Los endpoints deben aceptar `?fields=field1,field2` para seleccion parcial de campos y `?expand=relatedEntity` para incluir entidades relacionadas, reduciendo el tamano del payload cuando el cliente no necesita la representacion completa.

Fuente: [`runbooks/links/RB-040-rest-api-design.md`](runbooks/links/RB-040-rest-api-design.md)

---

### ARCH-SOLID-042-01

**DEFINICION:** Todo endpoint HTTP expuesto debe estar definido en un archivo OpenAPI 3.1 en `docs/api/openapi.yaml` con operationId, request body schema, response schemas (2xx y 4xx/5xx), y descripciones de cada campo.

Fuente: [`runbooks/links/RB-042-openapi-spec.md`](runbooks/links/RB-042-openapi-spec.md)

---

### ARCH-SOLID-042-02

**DEFINICION:** La validacion de request bodies y query parameters debe generarse automaticamente desde el schema OpenAPI usando una libreria como `openapi-validator`; nunca duplicar schemas de validacion a mano.

Fuente: [`runbooks/links/RB-042-openapi-spec.md`](runbooks/links/RB-042-openapi-spec.md)

---

### ARCH-SOLID-042-03

**DEFINICION:** Los schemas OpenAPI deben usar `required` para campos obligatorios, `nullable: true` solo cuando un campo puede ser explicitamente null, y restricciones de formato (`format: date-time`, `pattern`, `minLength`, `maxLength`) para todos los campos de tipo string.

Fuente: [`runbooks/links/RB-042-openapi-spec.md`](runbooks/links/RB-042-openapi-spec.md)

---

### ARCH-SOLID-042-04

**DEFINICION:** Los breaking changes en el schema (eliminar campos, cambiar tipos, anadir campos required) deben detectarse automaticamente en CI comparando contra la version anterior del spec.

Fuente: [`runbooks/links/RB-042-openapi-spec.md`](runbooks/links/RB-042-openapi-spec.md)

---

### ARCH-SOLID-042-05

**DEFINICION:** Los tipos TypeScript del dominio deben generarse desde el OpenAPI spec usando `openapi-typescript` y reexportarse desde `src/types/api-generated.ts`; nunca mantener tipos de API a mano.

Fuente: [`runbooks/links/RB-042-openapi-spec.md`](runbooks/links/RB-042-openapi-spec.md)

---

### ARCH-SOLID-047-01

**DEFINICION:** Los endpoints deben usar codigos HTTP semanticamente correctos: `200` para exito con body, `201` para creacion, `204` para exito sin body, `400` para errores de validacion del cliente, `401` para no autenticado, `403` para no autorizado, `404` para recurso no encontrado, `409` para conflicto, `42...

Fuente: [`runbooks/links/RB-047-http-status-codes.md`](runbooks/links/RB-047-http-status-codes.md)

---

### ARCH-SOLID-047-02

**DEFINICION:** Los errores 4xx deben diferenciar entre `400` (sintaxis invalida del request), `401` (falta o token invalido), `403` (token valido pero sin permisos), y `422` (sintaxis valida pero semantica incorrecta); nunca usar `400` como catch-all para todos los errores de cliente.

Fuente: [`runbooks/links/RB-047-http-status-codes.md`](runbooks/links/RB-047-http-status-codes.md)

---

### ARCH-SOLID-047-03

**DEFINICION:** Los errores 5xx deben incluir un header `Retry-After` con valor en segundos cuando la causa es transitoria (rate limit externo, timeout de Forge Storage) y nunca incluir stack traces ni detalles internos en la respuesta.

Fuente: [`runbooks/links/RB-047-http-status-codes.md`](runbooks/links/RB-047-http-status-codes.md)

---

### ARCH-SOLID-047-04

**DEFINICION:** Los endpoints de creacion (`POST`) deben retornar `201 Created` con el header `Location` apuntando al recurso creado y el body con la representacion completa del recurso.

Fuente: [`runbooks/links/RB-047-http-status-codes.md`](runbooks/links/RB-047-http-status-codes.md)

---

### ARCH-SOLID-047-05

**DEFINICION:** Los endpoints DELETE deben retornar `204 No Content` sin body cuando la eliminacion es inmediata, o `202 Accepted` con body `{ status: 'pending', cancellationUrl: '...' }` cuando la eliminacion es asincrona.

Fuente: [`runbooks/links/RB-047-http-status-codes.md`](runbooks/links/RB-047-http-status-codes.md)

---

### ARCH-SOLID-049-01

**DEFINICION:** Cada modulo debe tener una unica razon para cambiar (SRP): los adapters manejan solo comunicacion externa, los services solo logica de negocio, y los repositories solo acceso a datos; ningun archivo puede importar de mas de una capa superior.

Fuente: [`runbooks/links/RB-049-solid-principles.md`](runbooks/links/RB-049-solid-principles.md)

---

### ARCH-SOLID-049-02

**DEFINICION:** Los services deben estar abiertos para extension pero cerrados para modificacion (OCP): usar el patron Strategy para variantes de scoring y el patron Factory para creacion de adaptadores, anadiendo nuevas variantes sin modificar codigo existente.

Fuente: [`runbooks/links/RB-049-solid-principles.md`](runbooks/links/RB-049-solid-principles.md)

---

### ARCH-SOLID-049-03

**DEFINICION:** Las implementaciones de adaptadores deben ser sustituibles por sus interfaces sin alterar el comportamiento (LSP): `JiraAdapter` y `ConfluenceAdapter` deben ser reemplazables por mocks o fakes en tests sin cambiar el comportamiento del service.

Fuente: [`runbooks/links/RB-049-solid-principles.md`](runbooks/links/RB-049-solid-principles.md)

---

### ARCH-SOLID-049-04

**DEFINICION:** Los clients de API externa deben definir interfaces especificas para cada consumidor (ISP): un servicio que solo lee issues no debe depender de metodos de escritura; crear interfaces `IssueReader` y `IssueWriter` segregadas.

Fuente: [`runbooks/links/RB-049-solid-principles.md`](runbooks/links/RB-049-solid-principles.md)

---

### ARCH-SOLID-049-05

**DEFINICION:** Las dependencias deben inyectarse por interfaz, no por implementacion concreta (DIP): los services reciben adaptadores y repositories via constructor o factory, nunca instancian dependencias directamente.

Fuente: [`runbooks/links/RB-049-solid-principles.md`](runbooks/links/RB-049-solid-principles.md)

---

### ARCH-SOLID-051

**DEFINICION:** Todo nombre de funcion, variable, tipo o constante en el proyecto debe revelar su intencion sin necesidad de comentarios adicionales.

Fuente: [`runbooks/books/engineering/RB-051-clean-code.md`](runbooks/books/engineering/RB-051-clean-code.md)

---

### ARCH-SOLID-052

**DEFINICION:** Ninguna funcion en el backend de Forge debe superar las 20 lineas de logica efectiva ni tener mas de 3 niveles de anidamiento.

Fuente: [`runbooks/books/engineering/RB-051-clean-code.md`](runbooks/books/engineering/RB-051-clean-code.md)

---

### ARCH-SOLID-053

**DEFINICION:** El manejo de errores en toda la app debe usar tipos de error especificos del dominio, nunca `catch` vacios ni lanzamiento de `Error` generico.

Fuente: [`runbooks/books/engineering/RB-051-clean-code.md`](runbooks/books/engineering/RB-051-clean-code.md)

---

### ARCH-SOLID-054

**DEFINICION:** Ningun fragmento de logica de negocio, configuracion de API o patron de validacion debe estar duplicado en dos o mas archivos del proyecto.

Fuente: [`runbooks/books/engineering/RB-052-pragmatic-programmer.md`](runbooks/books/engineering/RB-052-pragmatic-programmer.md)

---

### ARCH-SOLID-055

**DEFINICION:** Los modulos de integracion con Rovo, Jira, Confluence y GitHub deben ser ortogonales: un cambio en el adaptador de GitHub no debe afectar la logica de validacion de Rovo ni la UI del Issue Panel.

Fuente: [`runbooks/books/engineering/RB-052-pragmatic-programmer.md`](runbooks/books/engineering/RB-052-pragmatic-programmer.md)

---

### ARCH-SOLID-056

**DEFINICION:** Las dependencias entre capas del proyecto solo pueden apuntar hacia adentro: la capa de presentacion depende de la capa de orquestacion, que depende de la capa de dominio. Nunca al reves.

Fuente: [`runbooks/books/engineering/RB-054-clean-architecture.md`](runbooks/books/engineering/RB-054-clean-architecture.md)

---

### ARCH-SOLID-057

**DEFINICION:** Los boundaries entre la integracion con Forge APIs, Rovo, GitHub y Jira deben estar definidos por interfaces del dominio, no por implementaciones concretas.

Fuente: [`runbooks/books/engineering/RB-054-clean-architecture.md`](runbooks/books/engineering/RB-054-clean-architecture.md)

---

### ARCH-SOLID-058

**DEFINICION:** La capa de dominio no debe conocer nada sobre Forge, React, HTTP, ni ningun framework. Las entidades de negocio como `ConsistencyScore`, `InconsistencyReport`, y `QualityGateResult` deben ser clases puras de TypeScript sin decoradores ni dependencias de framework.

Fuente: [`runbooks/books/engineering/RB-054-clean-architecture.md`](runbooks/books/engineering/RB-054-clean-architecture.md)

---

### ARCH-SOLID-059

**DEFINICION:** Antes de anyadir nueva funcionalidad al sistema de Quality Gates, el codigo existente debe ser refactorizado para que la nueva feature se integre limpiamente sin aumentar la complejidad ciclomatica del modulo afectado.

Fuente: [`runbooks/books/engineering/RB-055-refactoring.md`](runbooks/books/engineering/RB-055-refactoring.md)

---

### ARCH-SOLID-060

**DEFINICION:** Las variables en el dominio de Rovo Execution Guard deben usar nomenclatura basada en el vocabulario del negocio: `issueKey`, `consistencyScore`, `enforcementAction`, `inconsistencySeverity`, nunca `x`, `temp`, `val`, `obj`.

Fuente: [`runbooks/books/engineering/RB-056-code-complete.md`](runbooks/books/engineering/RB-056-code-complete.md)

---

### ARCH-SOLID-061

**DEFINICION:** El sistema debe definir bounded contexts claros: "Ticket Validation" (Jira-side), "PR Enforcement" (GitHub-side), y "Context Analysis" (Rovo-side), cada uno con su propio modelo de datos y vocabulario.

Fuente: [`runbooks/books/engineering/RB-057-domain-driven-design.md`](runbooks/books/engineering/RB-057-domain-driven-design.md)

---

### ARCH-SOLID-062

**DEFINICION:** Los valores del dominio como `ConsistencyScore`, `IssueKey`, `PRUrl`, y `ThresholdPercentage` deben modelarse como Value Objects inmutables, no como tipos primitivos.

Fuente: [`runbooks/books/engineering/RB-057-domain-driven-design.md`](runbooks/books/engineering/RB-057-domain-driven-design.md)

---

### ARCH-SOLID-063

**DEFINICION:** Utilizar "seams" (puntos de costura) para desacoplar dependencias externas de Forge APIs, Rovo, y GitHub antes de refactorizar, de modo que los cambios se puedan probar sin levantar infraestructura real.

Fuente: [`runbooks/books/engineering/RB-058-legacy-code.md`](runbooks/books/engineering/RB-058-legacy-code.md)

---

### ARCH-SOLID-064

**DEFINICION:** La arquitectura de Rovo Execution Guard debe mantener integridad conceptual: un unico arquitecto (Claude) define las decisiones de diseno fundamentales y ningun modulo las contradice.

Fuente: [`runbooks/books/engineering/RB-059-mythical-man-month.md`](runbooks/books/engineering/RB-059-mythical-man-month.md)

---

### ARCH-SOLID-065

**DEFINICION:** Todo acceso a datos de Jira, GitHub, y Forge Storage debe realizarse a traves de una capa Repository que encapsule las llamadas a la API y devuelva entidades de dominio.

Fuente: [`runbooks/books/engineering/RB-060-enterprise-patterns.md`](runbooks/books/engineering/RB-060-enterprise-patterns.md)

---

### ARCH-SOLID-066

**DEFINICION:** La orquestacion de las operaciones de validacion (consultar Rovo, calcular score, bloquear transicion, actualizar PR) debe centralizarse en una capa Service que coordine los repositorios sin contener logica de dominio.

Fuente: [`runbooks/books/engineering/RB-060-enterprise-patterns.md`](runbooks/books/engineering/RB-060-enterprise-patterns.md)

---

### ARCH-SOLID-067

**DEFINICION:** Toda funcion de dominio que procese colecciones de inconsistencias debe tener documentada su complejidad temporal esperada en el archivo `.reqs.md` correspondiente.

Fuente: [`runbooks/books/engineering/RB-061-introduction-algorithms.md`](runbooks/books/engineering/RB-061-introduction-algorithms.md)

---

### ARCH-SOLID-068

**DEFINICION:** Las capas del sistema deben comunicarse exclusivamente a traves de interfaces que oculten los detalles de implementacion, creando barreras de abstraccion estrictas entre dominio, integracion y presentacion.

Fuente: [`runbooks/books/engineering/RB-062-sicp.md`](runbooks/books/engineering/RB-062-sicp.md)

---

### ARCH-SOLID-069

**DEFINICION:** Las operaciones de validacion deben construirse como composicion de funciones puras de orden superior, evitando estado mutable compartido entre las etapas del pipeline de Quality Gate.

Fuente: [`runbooks/books/engineering/RB-062-sicp.md`](runbooks/books/engineering/RB-062-sicp.md)

---

### ARCH-SOLID-070

**DEFINICION:** Cada modulo funcional (Jira validation, GitHub enforcement, Rovo context, Scoring) debe poder ser deployado, testeado y reemplazado de forma independiente sin afectar a los demas.

Fuente: [`runbooks/books/engineering/RB-063-building-microservices.md`](runbooks/books/engineering/RB-063-building-microservices.md)

---

### ARCH-SOLID-071

**DEFINICION:** El codigo y la configuracion de Rovo Execution Guard deben ser tratables como codigo versionado: todas las reglas de Quality Gates, thresholds, y configuraciones de proyecto deben vivir en archivos JSON/YAML versionados, no en configuraciones manuales en Forge Storage.

Fuente: [`runbooks/books/devops/RB-067-unicorn-project.md`](runbooks/books/devops/RB-067-unicorn-project.md)

---

### ARCH-SOLID-072

**DEFINICION:** Las interacciones entre los modulos de Rovo Execution Guard deben seguir el modelo stream-aligned: el modulo de "Ticket Validation" (Jira-side) y el modulo de "PR Enforcement" (GitHub-side) son streams independientes que se comunican via eventos, no via llamadas sincronas.

Fuente: [`runbooks/books/devops/RB-070-team-topologies.md`](runbooks/books/devops/RB-070-team-topologies.md)

---

### ARCH-SOLID-073

**DEFINICION:** Los modulos shared (tipos, utilidades, constantes) deben ser propiedad de un equipo explicito y tener interfaces estables que minimicen el impacto de cambios en los consumidores.

Fuente: [`runbooks/books/devops/RB-070-team-topologies.md`](runbooks/books/devops/RB-070-team-topologies.md)

---

### ARCH-SOLID-0761

**DEFINICION:** Cada modulo del dominio (scoring engine, inconsistency detector, quality gate rules) debe poder desarrollarse en un bloque de enfoque continuo sin cambiar archivos fuera de su directorio.

Fuente: [`runbooks/books/strategy/RB-076-deep-work.md`](runbooks/books/strategy/RB-076-deep-work.md)

---

### ARCH-SOLID-0773

**DEFINICION:** El sistema de scoring debe estar disenado como un pipeline de reglas independientes donde cada regla es un archivo unico que implementa una interfaz `ScoringRule` comun.

Fuente: [`runbooks/books/strategy/RB-077-atomic-habits.md`](runbooks/books/strategy/RB-077-atomic-habits.md)

---

### ARCH-SOLID-0784

**DEFINICION:** El sistema de inconsistency detection debe implementarse como un pipeline donde cada detector es un modulo independiente que puede agregarse o removerse sin afectar los demas.

Fuente: [`runbooks/books/strategy/RB-078-lean-startup.md`](runbooks/books/strategy/RB-078-lean-startup.md)

---

### ARCH-SOLID-0802

**DEFINICION:** El scoring engine debe usar un algoritmo propietario de weighting que combine senales de multiples fuentes (Jira fields, Rovo context, PR diffs) en un score unificado que no sea replicable por reglas simples de Jira Automation.

Fuente: [`runbooks/books/strategy/RB-080-zero-to-one.md`](runbooks/books/strategy/RB-080-zero-to-one.md)

---

### ARCH-SOLID-0811

**DEFINICION:** Cada modulo del Forge app debe tener una interfaz publica documentada que defina sus inputs, outputs y side effects, actuando como un "contracto" similar a los OKRs de Grove: lo que el modulo entrega debe ser medible e inequivoco.

Fuente: [`runbooks/books/strategy/RB-081-high-output-management.md`](runbooks/books/strategy/RB-081-high-output-management.md)

---

### ARCH-SOLID-0822

**DEFINICION:** El sistema de feedback de usuarios (cuando un ticket es bloqueado incorrectamente) debe fluir directamente al modulo de scoring como senal de false positive, ajustando los pesos automaticamente si el volumen supera un umbral.

Fuente: [`runbooks/books/strategy/RB-082-radical-candor.md`](runbooks/books/strategy/RB-082-radical-candor.md)

---

### ARCH-SOLID-0832

**DEFINICION:** Los adapters de APIs externas (Jira, GitHub, Confluence, Rovo) deben ser construidos colaborativamente: una persona define la interfaz, otra implementa el adapter, y una tercera escribe los tests de contrato.

Fuente: [`runbooks/books/strategy/RB-083-the-innovators.md`](runbooks/books/strategy/RB-083-the-innovators.md)

---

### ARCH-SOLID-0842

**DEFINICION:** Cada funcion publica en el dominio debe tener un nombre que describa exactamente que hace sin necesidad de leer el cuerpo. Si el nombre no es autoexplicativo, la funcion hace demasiadas cosas.

Fuente: [`runbooks/books/strategy/RB-084-steve-jobs.md`](runbooks/books/strategy/RB-084-steve-jobs.md)

---

### ARCH-SOLID-0852

**DEFINICION:** Cada adapter de API externa debe implementar circuit breaker: si la API falla 3 veces consecutivas en 60 segundos, el circuito se abre y todas las llamadas posteriores se redirigen al fallback por 5 minutos.

Fuente: [`runbooks/books/strategy/RB-085-hard-things.md`](runbooks/books/strategy/RB-085-hard-things.md)

---

### ARCH-SOLID-0861

**DEFINICION:** El dominio del Forge app contiene exactamente tres capacidades esenciales: scoring, deteccion de inconsistencias y enforcement. Cualquier logica que no contribuya directamente a una de estas tres no pertenece al dominio.

Fuente: [`runbooks/books/culture/RB-086-essentialism.md`](runbooks/books/culture/RB-086-essentialism.md)

---

### ARCH-SOLID-0872

**DEFINICION:** Los desarrolladores deben poder trabajar en un modulo (scoring, inconsistency, enforcement) sin necesidad de entender los otros dos. La interfaz entre modulos es el unico punto de contacto.

Fuente: [`runbooks/books/culture/RB-087-peopleware.md`](runbooks/books/culture/RB-087-peopleware.md)

---

### ARCH-SOLID-0881

**DEFINICION:** El scoring engine debe ser trazeable: cada score producido debe poder descomponerse en las reglas individuales que lo generaron, con el peso y resultado de cada una, permitiendo auditoria completa.

Fuente: [`runbooks/books/culture/RB-088-soul-new-machine.md`](runbooks/books/culture/RB-088-soul-new-machine.md)

---

### ARCH-SOLID-0891

**DEFINICION:** El codigo del dominio debe ser tan legible como prosa tecnica: cada funcion cuenta una historia, cada nombre es una palabra precisa, y la estructura del modulo revela la logica del negocio sin comentarios explicativos.

Fuente: [`runbooks/books/culture/RB-089-hackers-painters.md`](runbooks/books/culture/RB-089-hackers-painters.md)

---

### ARCH-SOLID-0901

**DEFINICION:** El scoring engine debe usar un algoritmo de cache LRU (Least Recently Used) para almacenar scores calculados, expulsando los scores mas antiguos cuando el cache alcanza el limite de Forge Storage.

Fuente: [`runbooks/books/culture/RB-090-algorithms-live-by.md`](runbooks/books/culture/RB-090-algorithms-live-by.md)

---

### ARCH-SOLID-0912

**DEFINICION:** Cada operacion de escritura (actualizar score, registrar enforcement, guardar contexto) debe ser idempotente: ejecutar la misma operacion dos veces produce el mismo resultado que ejecutarla una vez.

Fuente: [`runbooks/books/culture/RB-091-black-swan.md`](runbooks/books/culture/RB-091-black-swan.md)

---

### ARCH-SOLID-0921

**DEFINICION:** El sistema debe mejorar automaticamente su precision de scoring cuando recibe feedback de false positives/negativos. Cada correction del usuario es una senal que fortalece el sistema, no solo un dato a registrar.

Fuente: [`runbooks/books/culture/RB-092-antifragile.md`](runbooks/books/culture/RB-092-antifragile.md)

---

### ARCH-SOLID-0933

**DEFINICION:** El codigo debe estar escrito para que un desarrollador junior pueda entender el flujo principal en 15 minutos. Los nombres de funciones, variables y archivos deben usar vocabulario del dominio de negocio, no jerga tecnica interna.

Fuente: [`runbooks/books/culture/RB-093-soft-skills.md`](runbooks/books/culture/RB-093-soft-skills.md)

---

### ARCH-SOLID-0941

**DEFINICION:** Los algoritmos criticos del scoring engine (calculos de score ponderado, deteccion de inconsistencias por similitud de texto, merge de senales) deben documentar su complejidad temporal y espacial con notacion Big-O.

Fuente: [`runbooks/books/culture/RB-094-art-computer-programming.md`](runbooks/books/culture/RB-094-art-computer-programming.md)

---

### ARCH-SOLID-0951

**DEFINICION:** Todo el codigo del Forge app debe usar async/await con manejo explicito de errores (try/catch), prohibiendo el uso de `.then()/.catch()` encadenados y promesas flotantes sin manejo.

Fuente: [`runbooks/books/culture/RB-095-eloquent-javascript.md`](runbooks/books/culture/RB-095-eloquent-javascript.md)

---

### ARCH-SOLID-0962

**DEFINICION:** Un desarrollador profesional debe poder decir "no" a estimaciones irreales. En el contexto del Forge app, esto significa: si una feature no se puede implementar con calidad en el tiempo estimado, se reduce el scope, no se salta los tests.

Fuente: [`runbooks/books/culture/RB-096-clean-coder.md`](runbooks/books/culture/RB-096-clean-coder.md)

---

### ARCH-SOLID-0971

**DEFINICION:** El sistema de scoring debe soportar composicion recursiva: una regla de scoring puede contener sub-reglas que a su vez pueden contener sub-reglas, permitiendo arboles de decision de profundidad arbitraria sin cambios en el engine.

Fuente: [`runbooks/books/ai-future/RB-097-godel-escher-bach.md`](runbooks/books/ai-future/RB-097-godel-escher-bach.md)

---

### ARCH-SOLID-0982

**DEFINICION:** Las llamadas a modelos de IA deben estar encapsuladas en un `AIService` con una interfaz que permita intercambiar el proveedor (OpenAI, Anthropic, Rovo AI) sin cambiar el codigo del dominio.

Fuente: [`runbooks/books/ai-future/RB-098-co-intelligence.md`](runbooks/books/ai-future/RB-098-co-intelligence.md)

---

### ARCH-SOLID-0992

**DEFINICION:** La busqueda de contexto relevante en Confluence (via Rovo) debe usar un algoritmo de busqueda informada (heuristic search) que priorice documentos relacionados con el proyecto y epic del ticket, no una busqueda lineal de todo el espacio.

Fuente: [`runbooks/books/ai-future/RB-099-ai-modern-approach.md`](runbooks/books/ai-future/RB-099-ai-modern-approach.md)

---

### ARCH-SOLID-1001

**DEFINICION:** Rovo Execution Guard debe mantener un "dual-track" arquitectural: el track principal (scoring basico, enforcement activo, validacion local) y el track disruptivo (contexto Rovo avanzado, IA, cross-project patterns), donde el track disruptivo puede fallar sin afectar al principal.

Fuente: [`runbooks/books/strategy/RB-100-innovators-dilemma.md`](runbooks/books/strategy/RB-100-innovators-dilemma.md)

---

### ARCH-SOLID-201

**DEFINICION:** `"strict": true` debe estar habilitado en `tsconfig.json`; esto activa `strictNullChecks`, `strictFunctionTypes`, `strictBindCallApply`, `strictPropertyInitialization`, `noImplicitAny`, `noImplicitThis` y `alwaysStrict` simultaneamente.

Fuente: [`runbooks/links/RB-021-typescript-handbook.md`](runbooks/links/RB-021-typescript-handbook.md)

---

### ARCH-SOLID-202

**DEFINICION:** El tipo `any` esta prohibido; usar `unknown` cuando el tipo no se conoce en tiempo de compilacion y aplicar type guards para estrecharlo.

Fuente: [`runbooks/links/RB-021-typescript-handbook.md`](runbooks/links/RB-021-typescript-handbook.md)

---

### ARCH-SOLID-203

**DEFINICION:** Toda estructura de datos publica debe definirse mediante `interface`; reservar `type` para uniones, intersecciones, mapeos condicionales y utility types.

Fuente: [`runbooks/links/RB-021-typescript-handbook.md`](runbooks/links/RB-021-typescript-handbook.md)

---

### ARCH-SOLID-204

**DEFINICION:** Toda funcion que opera sobre tipos parametrizados debe usar generics con constraints explícitos (`<T extends Entity>`) en lugar de `any` o castings.

Fuente: [`runbooks/links/RB-021-typescript-handbook.md`](runbooks/links/RB-021-typescript-handbook.md)

---

### ARCH-SOLID-205

**DEFINICION:** Toda funcion publica y metodo de clase debe declarar tipos de retorno explicitos; nunca depender de inferencia para la firma exportada.

Fuente: [`runbooks/links/RB-021-typescript-handbook.md`](runbooks/links/RB-021-typescript-handbook.md)

---

### ARCH-SOLID-221

**DEFINICION:** El archivo `.eslintrc` (o `eslint.config.ts` con flat config) debe extender `@typescript-eslint/recommended` y `@typescript-eslint/recommended-requiring-type-checking` para obtener reglas basadas en informacion de tipo del compilador.

Fuente: [`runbooks/links/RB-026-eslint-rules.md`](runbooks/links/RB-026-eslint-rules.md)

---

### ARCH-SOLID-222

**DEFINICION:** La regla `@typescript-eslint/no-unused-vars` debe configurarse con `"argsIgnorePattern": "^_"` para permitir parametros prefijados con underscore, y `@typescript-eslint/no-explicit-any` debe estar en nivel `error`.

Fuente: [`runbooks/links/RB-026-eslint-rules.md`](runbooks/links/RB-026-eslint-rules.md)

---

### ARCH-SOLID-223

**DEFINICION:** La regla `@typescript-eslint/explicit-function-return-type` debe aplicarse a todas las funciones y metodos exportados con la opcion `allowExpressions: true`; las arrow functions inline dentro de `map`/`filter` estan exentas.

Fuente: [`runbooks/links/RB-026-eslint-rules.md`](runbooks/links/RB-026-eslint-rules.md)

---

### ARCH-SOLID-224

**DEFINICION:** Habilitar `@typescript-eslint/consistent-type-imports` con `prefer: type-imports` para separar imports de tipos de imports de valores; esto facilita la compilacion mas rapida y el tree-shaking.

Fuente: [`runbooks/links/RB-026-eslint-rules.md`](runbooks/links/RB-026-eslint-rules.md)

---

### ARCH-SOLID-225

**DEFINICION:** Habilitar `@typescript-eslint/no-floating-promises` en nivel `error` para requerir que toda promesa sea await-ed, catch-ed, o asignada explicitamente a una variable; las promesas "flotantes" son la causa de errores silenciosos.

Fuente: [`runbooks/links/RB-026-eslint-rules.md`](runbooks/links/RB-026-eslint-rules.md)

---

### ARCH-SOLID-231

**DEFINICION:** Usar `camelCase` para variables, funciones y metodos; `PascalCase` para clases, interfaces, types y componentes React; `UPPER_SNAKE_CASE` para constantes globales inmutables; prefijo `I` prohibido en interfaces.

Fuente: [`runbooks/links/RB-027-airbnb-style.md`](runbooks/links/RB-027-airbnb-style.md)

---

### ARCH-SOLID-232

**DEFINICION:** Usar exports nombrados (`export function`, `export class`) como default; reservar `export default` unicamente para componentes React y el entry point principal del modulo.

Fuente: [`runbooks/links/RB-027-airbnb-style.md`](runbooks/links/RB-027-airbnb-style.md)

---

### ARCH-SOLID-233

**DEFINICION:** Toda funcion que devuelva una Promise debe marcarse con `async`; prohibido usar `.then()/.catch()` para control de flujo cuando `async/await` es posible; encadenar `.then()` solo cuando se necesita stream processing.

Fuente: [`runbooks/links/RB-027-airbnb-style.md`](runbooks/links/RB-027-airbnb-style.md)

---

### ARCH-SOLID-234

**DEFINICION:** Prohibido usar constructores `new Error()` sin mensaje; toda excepcion lanzada debe ser una instancia de `Error` (o subclase) con un mensaje descriptivo que incluya contexto operacional.

Fuente: [`runbooks/links/RB-027-airbnb-style.md`](runbooks/links/RB-027-airbnb-style.md)

---

### ARCH-SOLID-235

**DEFINICION:** Un archivo no debe tener mas de una exportacion de clase o funcion principal; el archivo se nombra igual que la exportacion principal en `camelCase` (funcion) o `PascalCase` (clase).

Fuente: [`runbooks/links/RB-027-airbnb-style.md`](runbooks/links/RB-027-airbnb-style.md)

---

### ARCH-SOLID-241

**DEFINICION:** Toda funcion asincrona debe envolver su cuerpo en try/catch o delegar el manejo de errores a un middleware de alto nivel; prohibido permitir que promesas no manejadas lleguen al runtime.

Fuente: [`runbooks/links/RB-028-nodejs-best-practices.md`](runbooks/links/RB-028-nodejs-best-practices.md)

---

### ARCH-SOLID-242

**DEFINICION:** Prohibido usar callbacks anidados; todo codigo asincrono debe usar `async/await`. Si se necesita paralelismo, usar `Promise.all()` con un limite de concurrencia de 5 operaciones simultaneas para no saturar el event loop.

Fuente: [`runbooks/links/RB-028-nodejs-best-practices.md`](runbooks/links/RB-028-nodejs-best-practices.md)

---

### ARCH-SOLID-243

**DEFINICION:** Toda operacion de I/O (llamadas API, acceso a storage, queries) debe tener un timeout explicito con un valor maximo definido por operacion: 5000ms para reads, 10000ms para writes, 25000ms para operaciones externas (Jira/GitHub API).

Fuente: [`runbooks/links/RB-028-nodejs-best-practices.md`](runbooks/links/RB-028-nodejs-best-practices.md)

---

### ARCH-SOLID-244

**DEFINICION:** La aplicacion debe implementar health checks en `/health` (basico) y `/health/detailed` (con dependencias) que verifiquen conectividad con Jira API, GitHub API, Forge Storage y estado de la funcion.

Fuente: [`runbooks/links/RB-028-nodejs-best-practices.md`](runbooks/links/RB-028-nodejs-best-practices.md)

---

### ARCH-SOLID-251

**DEFINICION:** Toda configuracion que varie entre entornos (desarrollo, staging, produccion) debe leerse de variables de entorno (`process.env`); prohibido usar archivos de configuracion hardcodeados o constantes en codigo para valores que cambian por entorno.

Fuente: [`runbooks/links/RB-032-twelve-factor.md`](runbooks/links/RB-032-twelve-factor.md)

---

### ARCH-SOLID-252

**DEFINICION:** La aplicacion debe ser stateless: toda la sesion y estado debe almacenarse en un backing store (Redis, Forge Storage, base de datos); prohibido depender de estado en memoria local que se pierde entre requests o invocaciones.

Fuente: [`runbooks/links/RB-032-twelve-factor.md`](runbooks/links/RB-032-twelve-factor.md)

---

### ARCH-SOLID-253

**DEFINICION:** Los procesos deben ser disposables: deben poder ser iniciados y detenidos en cualquier momento sin corrupcion de datos; implementar graceful shutdown que complete requests en vuelo, cierre conexiones, y flush logs antes de terminar.

Fuente: [`runbooks/links/RB-032-twelve-factor.md`](runbooks/links/RB-032-twelve-factor.md)

---

### ARCH-SOLID-254

**DEFINICION:** Separar la aplicacion en procesos con responsabilidad unica: proceso web para HTTP, proceso worker para jobs en background, proceso scheduler para tareas periodicas; cada tipo de proceso escala independientemente.

Fuente: [`runbooks/links/RB-032-twelve-factor.md`](runbooks/links/RB-032-twelve-factor.md)

---

### ARCH-SOLID-255

**DEFINICION:** Los logs deben ser tratados como event streams: escribir en stdout/stderr en formato JSON estructurado; prohibido escribir logs a archivos, usar formato no parseable, o incluir datos sensibles en el output.

Fuente: [`runbooks/links/RB-032-twelve-factor.md`](runbooks/links/RB-032-twelve-factor.md)

---

## TEST-QA - Testing & QA

> 59 reglas

### TEST-QA-001

**DEFINICION:** Los cambios en el manifest.yml requieren redeploy completo (`forge deploy`); el tunnel no aplica cambios de manifest en caliente.

Fuente: [`runbooks/links/forge/RB-012-forge-tunneling.md`](runbooks/links/forge/RB-012-forge-tunneling.md)

---

### TEST-QA-002

**DEFINICION:** Los tests de integracion que validen timeouts, throttling o limits de plataforma deben ejecutarse en un environment deployado, nunca contra tunnel local.

Fuente: [`runbooks/links/forge/RB-012-forge-tunneling.md`](runbooks/links/forge/RB-012-forge-tunneling.md)

---

### TEST-QA-036-01

**DEFINICION:** Toda excepcion no capturada y rechazo de promesa no manejado debe enviarse a Sentry mediante `Sentry.captureException()` antes de cualquier fallback generico.

Fuente: [`runbooks/links/RB-036-sentry-docs.md`](runbooks/links/RB-036-sentry-docs.md)

---

### TEST-QA-036-02

**DEFINICION:** Cada flujo de usuario critico debe registrar breadcrumbs con `Sentry.addBreadcrumb()` en cada paso significativo (llamada API, transformacion de datos, decision de negocio).

Fuente: [`runbooks/links/RB-036-sentry-docs.md`](runbooks/links/RB-036-sentry-docs.md)

---

### TEST-QA-036-03

**DEFINICION:** Los eventos de Sentry deben incluir contexto estructurado con `Sentry.setContext()` que contenga: `executionId`, `jiraIssueKey` o `githubPrId`, `tenantId`, y `scoringResult` cuando aplique.

Fuente: [`runbooks/links/RB-036-sentry-docs.md`](runbooks/links/RB-036-sentry-docs.md)

---

### TEST-QA-036-04

**DEFINICION:** El `tracesSampleRate` en produccion debe estar entre 0.05 y 0.2; en staging debe ser 1.0 para capturar el 100% de las trazas.

Fuente: [`runbooks/links/RB-036-sentry-docs.md`](runbooks/links/RB-036-sentry-docs.md)

---

### TEST-QA-036-05

**DEFINICION:** Toda regla de filtro de errores en Sentry debe estar versionada en el repositorio dentro de `config/sentry-filters.ts` y desplegada via Sentry API en el pipeline CI/CD.

Fuente: [`runbooks/links/RB-036-sentry-docs.md`](runbooks/links/RB-036-sentry-docs.md)

---

### TEST-QA-037-01

**DEFINICION:** El sistema debe definir un SLO de disponibilidad del 99.5% para las operaciones de scoring y un SLO de latencia P99 inferior a 3000ms para respuestas de adaptadores externos.

Fuente: [`runbooks/links/RB-037-google-sre.md`](runbooks/links/RB-037-google-sre.md)

---

### TEST-QA-037-02

**DEFINICION:** El error budget se consume proporcionalmente a los fallos; cuando se agota al 100%, todo deploy a produccion debe bloquearse automaticamente hasta que el budget se renueve.

Fuente: [`runbooks/links/RB-037-google-sre.md`](runbooks/links/RB-037-google-sre.md)

---

### TEST-QA-037-03

**DEFINICION:** Toda incidencia que supere 15 minutos de duracion o afecte a mas de 1 tenant debe generar un postmortem sin culpabilidad documentado en `docs/postmortems/` dentro de las 72 horas siguientes.

Fuente: [`runbooks/links/RB-037-google-sre.md`](runbooks/links/RB-037-google-sre.md)

---

### TEST-QA-037-04

**DEFINICION:** Las alertas deben clasificarse en 3 niveles: P1 (pagina inmediata, SLO violado), P2 (ticket automatico, tendencia degradante), P3 (dashboard only, informativo).

Fuente: [`runbooks/links/RB-037-google-sre.md`](runbooks/links/RB-037-google-sre.md)

---

### TEST-QA-037-05

**DEFINICION:** Cada servicio debe exponer un endpoint `/health` que verifique dependencias criticas (Forge Storage, API Jira, API GitHub) y retorne estado `degraded` si alguna dependencia no critica falla, o `unhealthy` si una critica falla.

Fuente: [`runbooks/links/RB-037-google-sre.md`](runbooks/links/RB-037-google-sre.md)

---

### TEST-QA-038-01

**DEFINICION:** Toda metrica custom debe seguir la convencion de nombrado `execution_guard.<namespace>.<metric_name>` con tags obligatorios: `environment`, `adapter`, `tenant_cloud_id`.

Fuente: [`runbooks/links/RB-038-datadog-api.md`](runbooks/links/RB-038-datadog-api.md)

---

### TEST-QA-038-02

**DEFINICION:** Los dashboards deben definirse como codigo en `config/datadog-dashboards/` usando la API de Datadog y desplegarse automaticamente en el pipeline CI/CD.

Fuente: [`runbooks/links/RB-038-datadog-api.md`](runbooks/links/RB-038-datadog-api.md)

---

### TEST-QA-038-03

**DEFINICION:** Las metricas de histograma deben usarse para distribuciones (latencia, tamano de payload) y las metricas de gauge para valores puntuales (conexiones activas, items en cola); nunca usar counters para lo que es un histograma.

Fuente: [`runbooks/links/RB-038-datadog-api.md`](runbooks/links/RB-038-datadog-api.md)

---

### TEST-QA-038-04

**DEFINICION:** Toda alerta debe incluir un runbook vinculado en el campo `message` con la URL al archivo correspondiente en `docs/runbooks/`, y las alertas sin runbook asociado se consideran tecnicamente endeudas.

Fuente: [`runbooks/links/RB-038-datadog-api.md`](runbooks/links/RB-038-datadog-api.md)

---

### TEST-QA-038-05

**DEFINICION:** El client de Datadog debe inicializarse con `bufferSize: 8192` y `flushInterval: 10000` y apagarse gracefulmente en el lifecycle de Forge para evitar perdida de metricas.

Fuente: [`runbooks/links/RB-038-datadog-api.md`](runbooks/links/RB-038-datadog-api.md)

---

### TEST-QA-051

**DEFINICION:** Queda prohibido el uso de comentarios explicativos en el codigo de produccion; si el codigo necesita comentarios, debe ser refactorizado.

Fuente: [`runbooks/books/engineering/RB-051-clean-code.md`](runbooks/books/engineering/RB-051-clean-code.md)

---

### TEST-QA-052

**DEFINICION:** Ningun refactoring se ejecuta sin que los tests unitarios existentes cubran el comportamiento actual del codigo a refactorizar. Si la cobertura es insuficiente, primero se escriben tests caracterizacion antes de tocar el codigo.

Fuente: [`runbooks/books/engineering/RB-055-refactoring.md`](runbooks/books/engineering/RB-055-refactoring.md)

---

### TEST-QA-053

**DEFINICION:** Todo refactoring debe realizarse en pasos atomicos y verificables: un solo tipo de transformacion por commit, con tests verdes entre cada paso.

Fuente: [`runbooks/books/engineering/RB-055-refactoring.md`](runbooks/books/engineering/RB-055-refactoring.md)

---

### TEST-QA-054

**DEFINICION:** Antes de modificar cualquier logica existente de Quality Gates o enforcement, se deben crear tests de caracterizacion que capturen el comportamiento actual, incluso si ese comportamiento contiene bugs conocidos.

Fuente: [`runbooks/books/engineering/RB-058-legacy-code.md`](runbooks/books/engineering/RB-058-legacy-code.md)

---

### TEST-QA-055

**DEFINICION:** Cuando se encuentre codigo sin tests, se debe crear un "sprout" (brote) de la nueva funcionalidad en una funcion separada con tests propios, en vez de anyadir logica al codigo existente no testeado.

Fuente: [`runbooks/books/engineering/RB-058-legacy-code.md`](runbooks/books/engineering/RB-058-legacy-code.md)

---

### TEST-QA-056

**DEFINICION:** Toda nueva funcionalidad en la capa de dominio de Rovo Execution Guard debe implementarse siguiendo el ciclo estricto: escribir un test que falle (RED), escribir el minimo codigo para que pase (GREEN), y luego mejorar el diseno (REFACTOR).

Fuente: [`runbooks/books/engineering/RB-064-tdd-by-example.md`](runbooks/books/engineering/RB-064-tdd-by-example.md)

---

### TEST-QA-057

**DEFINICION:** Los tests unitarios deben cubrir los casos limite del sistema de Quality Gates: score exactamente en el threshold (80%), payloads vacios, respuestas de Rovo con campos faltantes, y timeouts de API.

Fuente: [`runbooks/books/engineering/RB-064-tdd-by-example.md`](runbooks/books/engineering/RB-064-tdd-by-example.md)

---

### TEST-QA-058

**DEFINICION:** Los tests de integracion deben simular las respuestas reales de las APIs de Jira, GitHub y Rovo usando contratos grabados, no datos inventados.

Fuente: [`runbooks/books/engineering/RB-064-tdd-by-example.md`](runbooks/books/engineering/RB-064-tdd-by-example.md)

---

### TEST-QA-059

**DEFINICION:** Todo el tooling de desarrollo (linters, formatters, test runners, scripts de deploy) debe funcionar de forma fiable y rapida. Si una herramienta falla intermitentemente, se fixea o se reemplaza inmediatamente.

Fuente: [`runbooks/books/devops/RB-067-unicorn-project.md`](runbooks/books/devops/RB-067-unicorn-project.md)

---

### TEST-QA-0764

**DEFINICION:** Los tests de cada modulo de dominio deben poder ejecutarse de forma aislada sin levantar dependencias externas (Jira API, GitHub API, Rovo), usando mocks que simulen respuestas de Forge Storage.

Fuente: [`runbooks/books/strategy/RB-076-deep-work.md`](runbooks/books/strategy/RB-076-deep-work.md)

---

### TEST-QA-0771

**DEFINICION:** Cada nuevo modulo de dominio debe incrementar la cobertura de tests en al menos un test por funcion publica, escrita antes o inmediatamente despues de la implementacion.

Fuente: [`runbooks/books/strategy/RB-077-atomic-habits.md`](runbooks/books/strategy/RB-077-atomic-habits.md)

---

### TEST-QA-0782

**DEFINICION:** Cada feature del Forge app debe tener una metrica de adopcion medible (quantitative) y un mecanismo de feedback cualitativo antes de considerarse completa.

Fuente: [`runbooks/books/strategy/RB-078-lean-startup.md`](runbooks/books/strategy/RB-078-lean-startup.md)

---

### TEST-QA-0794

**DEFINICION:** Cuando un bug se descubre en produccion, el primer paso es escribir un test que reproduzca el fallo antes de corregir el codigo. El fix no se mergea sin el test de regresion.

Fuente: [`runbooks/books/strategy/RB-079-extreme-ownership.md`](runbooks/books/strategy/RB-079-extreme-ownership.md)

---

### TEST-QA-0805

**DEFINICION:** Las pruebas de integracion deben validar el flujo completo end-to-end: trigger de Jira -> scoring -> deteccion de inconsistencias -> enforcement en GitHub, usando datos de prueba que simulen el mundo real de un equipo de software.

Fuente: [`runbooks/books/strategy/RB-080-zero-to-one.md`](runbooks/books/strategy/RB-080-zero-to-one.md)

---

### TEST-QA-0815

**DEFINICION:** Cada test de integracion debe documentar que output del sistema valida, creando una relacion directa entre el test y el KPI de negocio que protege.

Fuente: [`runbooks/books/strategy/RB-081-high-output-management.md`](runbooks/books/strategy/RB-081-high-output-management.md)

---

### TEST-QA-0823

**DEFINICION:** Los code reviews deben incluir una seccion especifica para dar feedback sobre la claridad del codigo, no solo sobre su correccion. Los PRs deben ser una oportunidad de aprendizaje, no solo un checkpoint.

Fuente: [`runbooks/books/strategy/RB-082-radical-candor.md`](runbooks/books/strategy/RB-082-radical-candor.md)

---

### TEST-QA-0833

**DEFINICION:** Los tests deben evolucionar junto con el producto: tests unitarios en la iteracion 1, tests de integracion en la iteracion 2, tests E2E en la iteracion 3. No intentar escribir tests E2E antes de que los unitarios sean solidos.

Fuente: [`runbooks/books/strategy/RB-083-the-innovators.md`](runbooks/books/strategy/RB-083-the-innovators.md)

---

### TEST-QA-0853

**DEFINICION:** Los tests deben cubrir los peores escenarios: APIs que retornan datos malformados, timeouts, respuestas vacias, y estados inconsistentes entre Jira y GitHub. Estos "chaos tests" son obligatorios para cada adapter.

Fuente: [`runbooks/books/strategy/RB-085-hard-things.md`](runbooks/books/strategy/RB-085-hard-things.md)

---

### TEST-QA-0874

**DEFINICION:** Los tests automatizados son la red de seguridad que permite a los desarrolladores hacer refactorings con confianza. Ningun refactor se realiza sin una suite de tests previa que cubra el modulo afectado.

Fuente: [`runbooks/books/culture/RB-087-peopleware.md`](runbooks/books/culture/RB-087-peopleware.md)

---

### TEST-QA-0882

**DEFINICION:** Las iteraciones de desarrollo deben producir software funcional en cada ciclo. Al final de cada sprint, el Forge app debe estar deployable a staging con todas las features completas, no "90% terminado".

Fuente: [`runbooks/books/culture/RB-088-soul-new-machine.md`](runbooks/books/culture/RB-088-soul-new-machine.md)

---

### TEST-QA-0895

**DEFINICION:** Los tests deben ser tan creativos como el codigo que validan: cada test debe ser un "ejemplo vivo" que documente el comportamiento esperado del sistema con datos del mundo real, no solo aserciones booleanas genericas.

Fuente: [`runbooks/books/culture/RB-089-hackers-painters.md`](runbooks/books/culture/RB-089-hackers-painters.md)

---

### TEST-QA-0903

**DEFINICION:** La estrategia de testing debe seguir el principio de "explore-exploit": el 80% de los tests explotan caminos conocidos (regresion) y el 20% explora caminos nuevos (tests de edge case aleatorios, fuzzing de inputs).

Fuente: [`runbooks/books/culture/RB-090-algorithms-live-by.md`](runbooks/books/culture/RB-090-algorithms-live-by.md)

---

### TEST-QA-0913

**DEFINICION:** Los tests deben incluir escenarios "improbables": respuestas de API con encoding incorrecto, payloads JSON con campos null inesperados, webhooks con timestamps del futuro, y tokens OAuth expirados.

Fuente: [`runbooks/books/culture/RB-091-black-swan.md`](runbooks/books/culture/RB-091-black-swan.md)

---

### TEST-QA-0923

**DEFINICION:** El test suite debe incluir "mutation testing": modificar aleatoriamente el codigo del dominio y verificar que al menos un test falla. Si ninguna mutacion es detectada, los tests son insuficientes.

Fuente: [`runbooks/books/culture/RB-092-antifragile.md`](runbooks/books/culture/RB-092-antifragile.md)

---

### TEST-QA-0934

**DEFINICION:** Los tests deben servir como documentacion viva del comportamiento del sistema. Un desarrollador nuevo debe poder entender "que hace el scoring engine" leyendo sus tests, no solo su codigo.

Fuente: [`runbooks/books/culture/RB-093-soft-skills.md`](runbooks/books/culture/RB-093-soft-skills.md)

---

### TEST-QA-0942

**DEFINICION:** Los tests del scoring engine deben incluir mediciones de rendimiento: cada regla de scoring debe ejecutarse en menos de 1ms, y el scoring completo de un ticket en menos de 50ms, medidos en el entorno de Forge.

Fuente: [`runbooks/books/culture/RB-094-art-computer-programming.md`](runbooks/books/culture/RB-094-art-computer-programming.md)

---

### TEST-QA-0954

**DEFINICION:** Los tests deben usar `async/await` consistentemente con helpers de Jest como `waitFor` para operaciones asincronas, prohibiendo el uso de `setTimeout` o `done()` callbacks.

Fuente: [`runbooks/books/culture/RB-095-eloquent-javascript.md`](runbooks/books/culture/RB-095-eloquent-javascript.md)

---

### TEST-QA-0961

**DEFINICION:** Todo el codigo del dominio (scoring, inconsistency, enforcement) debe desarrollarse con TDD: escribir el test fallido primero, luego la implementacion minima que pase el test, y finalmente refactorizar. Ninguna funcion del dominio se escribe sin un test previo.

Fuente: [`runbooks/books/culture/RB-096-clean-coder.md`](runbooks/books/culture/RB-096-clean-coder.md)

---

### TEST-QA-0973

**DEFINICION:** Los tests del sistema deben incluir tests sobre tests: los fixtures de test deben validarse automaticamente para asegurar que representan datos realistas y que no se han degradado con el tiempo.

Fuente: [`runbooks/books/ai-future/RB-097-godel-escher-bach.md`](runbooks/books/ai-future/RB-097-godel-escher-bach.md)

---

### TEST-QA-0984

**DEFINICION:** Los tests de las funciones de IA deben usar snapshots de respuestas esperadas (golden files) en lugar de llamar a la API en cada test, garantizando reproducibilidad y eliminando dependencia de red en CI.

Fuente: [`runbooks/books/ai-future/RB-098-co-intelligence.md`](runbooks/books/ai-future/RB-098-co-intelligence.md)

---

### TEST-QA-0993

**DEFINICION:** El rendimiento del detector de inconsistencias debe medirse con metricas de information retrieval: precision, recall, y F1-score, usando un dataset etiquetado de tickets con inconsistencias conocidas.

Fuente: [`runbooks/books/ai-future/RB-099-ai-modern-approach.md`](runbooks/books/ai-future/RB-099-ai-modern-approach.md)

---

### TEST-QA-1004

**DEFINICION:** Las nuevas features deben validarse contra el mercado existente: cada feature nueva se mide por su impacto en la metrica principal (rework reduction) antes de ser promovida de experimental a estable.

Fuente: [`runbooks/books/strategy/RB-100-innovators-dilemma.md`](runbooks/books/strategy/RB-100-innovators-dilemma.md)

---

### TEST-QA-201

**DEFINICION:** Cada archivo de test debe seguir la estructura AAA (Arrange-Act-Assert) con secciones separadas por comentarios o bloques `describe`/`it` que evidencien el flujo.

Fuente: [`runbooks/links/RB-022-jest-testing.md`](runbooks/links/RB-022-jest-testing.md)

---

### TEST-QA-202

**DEFINICION:** Prohibido usar `jest.mock()` a nivel de archivo para dependencias internas del proyecto; usar inyeccion de dependencias o constructor injection para aislar unidades.

Fuente: [`runbooks/links/RB-022-jest-testing.md`](runbooks/links/RB-022-jest-testing.md)

---

### TEST-QA-203

**DEFINICION:** Los umbrales de cobertura minima deben ser: 80% branches, 80% functions, 80% lines, 80% statements en `jest.config.ts` bajo `coverageThreshold.global`.

Fuente: [`runbooks/links/RB-022-jest-testing.md`](runbooks/links/RB-022-jest-testing.md)

---

### TEST-QA-204

**DEFINICION:** Cada test debe limpiar su estado despues de ejecutarse usando `afterEach(() => { jest.clearAllMocks(); })` o `jest.restoreAllMocks()`; nunca compartir estado mutado entre tests.

Fuente: [`runbooks/links/RB-022-jest-testing.md`](runbooks/links/RB-022-jest-testing.md)

---

### TEST-QA-205

**DEFINICION:** Prohibido usar `any` en matchers de Jest; los snapshots deben ser minimos y usar `toMatchInlineSnapshot()` para cambios revisables.

Fuente: [`runbooks/links/RB-022-jest-testing.md`](runbooks/links/RB-022-jest-testing.md)

---

### TEST-QA-211

**DEFINICION:** Todo test E2E debe usar selectores resilientes en este orden de prioridad: (1) `getByRole`, (2) `getByTestId`, (3) `getByText`; prohibido usar selectores CSS o XPath acoplados a la implementacion.

Fuente: [`runbooks/links/RB-023-playwright-e2e.md`](runbooks/links/RB-023-playwright-e2e.md)

---

### TEST-QA-212

**DEFINICION:** Toda asercion Playwright debe usar web-first assertions (`await expect(locator).toBeVisible()`) en lugar de aserciones manuales con `expect(await locator.isVisible()).toBe(true)`.

Fuente: [`runbooks/links/RB-023-playwright-e2e.md`](runbooks/links/RB-023-playwright-e2e.md)

---

### TEST-QA-213

**DEFINICION:** Los tests E2E deben organizarse en Page Object Models (POM) con una clase por pagina/flujo; el archivo de test solo contiene `test()` y llama a metodos del POM.

Fuente: [`runbooks/links/RB-023-playwright-e2e.md`](runbooks/links/RB-023-playwright-e2e.md)

---

### TEST-QA-214

**DEFINICION:** Configurar `trace: 'on-first-retry'` en `playwright.config.ts` y establecer `retries: 2` para capturar trazas solo en fallos, sin penalizar la ejecucion en exito.

Fuente: [`runbooks/links/RB-023-playwright-e2e.md`](runbooks/links/RB-023-playwright-e2e.md)

---

### TEST-QA-215

**DEFINICION:** Prohibido usar `page.waitForTimeout()`; todo wait debe ser basado en una condicion (`waitForSelector`, `waitForResponse`, web-first assertions) con un timeout maximo de 15000ms.

Fuente: [`runbooks/links/RB-023-playwright-e2e.md`](runbooks/links/RB-023-playwright-e2e.md)

---

## GIT-CI - Git & CI/CD

> 69 reglas

### GIT-CI-043-01

**DEFINICION:** Dependabot debe configurarse en `.github/dependabot.yml` para escanear `npm` con frecuencia `daily`, `github-actions` con frecuencia `weekly`, y habilitar `allow: [security]` como prioridad.

Fuente: [`runbooks/links/RB-043-dependabot.md`](runbooks/links/RB-043-dependabot.md)

---

### GIT-CI-043-02

**DEFINICION:** Los pull requests de Dependabot de seguridad (CVE) deben mergearse dentro de las 72 horas de apertura; los de actualizacion de version menor dentro de 7 dias; los de version mayor requieren revision manual y planificacion.

Fuente: [`runbooks/links/RB-043-dependabot.md`](runbooks/links/RB-043-dependabot.md)

---

### GIT-CI-043-03

**DEFINICION:** El archivo `.github/dependabot.yml` debe incluir `ignore` rules para paquetes que requieren actualizacion coordinada (ej. `@atlassian/forge-*` packages) y `versioning-strategy: increase-if-necessary` para evitar bumps innecesarios de version en lockfile.

Fuente: [`runbooks/links/RB-043-dependabot.md`](runbooks/links/RB-043-dependabot.md)

---

### GIT-CI-043-04

**DEFINICION:** Todo PR de Dependabot debe pasar el suite completo de CI (lint, test, build) antes de ser elegible para merge; si el CI falla, el equipo debe investigar y resolver dentro del mismo SLA.

Fuente: [`runbooks/links/RB-043-dependabot.md`](runbooks/links/RB-043-dependabot.md)

---

### GIT-CI-043-05

**DEFINICION:** Las dependencias con licencias copyleft (GPL, AGPL, LGPL) deben bloquearse automaticamente mediante un step en CI que ejecute `license-checker` y falle si detecta licencias no aprobadas.

Fuente: [`runbooks/links/RB-043-dependabot.md`](runbooks/links/RB-043-dependabot.md)

---

### GIT-CI-044-01

**DEFINICION:** La configuracion de Prettier debe estar centralizada en un unico archivo `.prettierrc` en la raiz del proyecto con: `printWidth: 100`, `singleQuote: true`, `trailingComma: 'all'`, `semi: true`, `tabWidth: 2`, `arrowParens: 'always'`.

Fuente: [`runbooks/links/RB-044-prettier.md`](runbooks/links/RB-044-prettier.md)

---

### GIT-CI-044-02

**DEFINICION:** Prettier debe ejecutarse como pre-commit hook via lint-staged, formateando solo los archivos staged; nunca ejecutar Prettier manualmente sobre todo el proyecto como parte del flujo normal.

Fuente: [`runbooks/links/RB-044-prettier.md`](runbooks/links/RB-044-prettier.md)

---

### GIT-CI-044-03

**DEFINICION:** El pipeline CI debe incluir un step `prettier --check` que falle si algun archivo no esta formateado; este check es no-negociable y no se puede deshabilitar con `--no-verify`.

Fuente: [`runbooks/links/RB-044-prettier.md`](runbooks/links/RB-044-prettier.md)

---

### GIT-CI-044-04

**DEFINICION:** Las reglas de ESLint que conflictuan con Prettier (indentacion, comillas, punto y coma, trailing commas) deben deshabilitarse usando `eslint-config-prettier`; las decisiones de formato son dominio exclusivo de Prettier.

Fuente: [`runbooks/links/RB-044-prettier.md`](runbooks/links/RB-044-prettier.md)

---

### GIT-CI-044-05

**DEFINICION:** Los archivos generados automaticamente (`src/types/api-generated.ts`, `coverage/`, `dist/`) deben excluirse del formateo en `.prettierignore` y marcarse con un header de autogeneracion para evitar ediciones manuales accidentales.

Fuente: [`runbooks/links/RB-044-prettier.md`](runbooks/links/RB-044-prettier.md)

---

### GIT-CI-045-01

**DEFINICION:** Todo archivo Markdown debe comenzar con un heading H1 unico que identifique el documento, seguido de una descripcion de una linea en bloquequote (`>`), y una tabla de contenidos con anchors si el documento supera 100 lineas.

Fuente: [`runbooks/links/RB-045-markdown-guide.md`](runbooks/links/RB-045-markdown-guide.md)

---

### GIT-CI-045-02

**DEFINICION:** Los bloques de codigo deben especificar siempre el lenguaje (``typescript`, ``yaml`, ````bash`) y los bloques sin lenguaje especificado se consideran violaciones de formato.

Fuente: [`runbooks/links/RB-045-markdown-guide.md`](runbooks/links/RB-045-markdown-guide.md)

---

### GIT-CI-045-03

**DEFINICION:** Las listas deben usar `-` para listas no ordenadas y `1.` para listas ordenadas (sin numeros secuenciales manuales); nunca mezclar marcadores de lista (`-`, `*`, `+`) en el mismo archivo.

Fuente: [`runbooks/links/RB-045-markdown-guide.md`](runbooks/links/RB-045-markdown-guide.md)

---

### GIT-CI-045-04

**DEFINICION:** Las URLs en Markdown deben usar el formato de referencia (`[texto][ref]`) cuando la URL tiene mas de 80 caracteres o aparece mas de una vez en el documento; las URLs cortas y unicas pueden usarse inline.

Fuente: [`runbooks/links/RB-045-markdown-guide.md`](runbooks/links/RB-045-markdown-guide.md)

---

### GIT-CI-045-05

**DEFINICION:** Todo archivo Markdown debe pasar `markdownlint-cli` con la configuracion del proyecto en CI; las reglas deshabilitadas deben estar documentadas con justificacion en `.markdownlint.json`.

Fuente: [`runbooks/links/RB-045-markdown-guide.md`](runbooks/links/RB-045-markdown-guide.md)

---

### GIT-CI-048-01

**DEFINICION:** El repositorio debe usar las ramas permanentes `main` (produccion) y `develop` (integracion); las ramas temporales siguen el patron `<type>/<ticket-id>-<short-desc>` donde type es `feature`, `bugfix`, `hotfix`, o `release`.

Fuente: [`runbooks/links/RB-048-gitflow.md`](runbooks/links/RB-048-gitflow.md)

---

### GIT-CI-048-02

**DEFINICION:** Los merges a `main` solo se permiten desde ramas `hotfix/*` o `release/*`; los merges a `develop` solo desde `feature/*` o `bugfix/*`; nunca mergear feature directamente a `main`.

Fuente: [`runbooks/links/RB-048-gitflow.md`](runbooks/links/RB-048-gitflow.md)

---

### GIT-CI-048-03

**DEFINICION:** Las ramas de feature deben eliminarse dentro de las 24 horas posteriores al merge; las ramas de release se eliminan tras verificar que el deploy a produccion fue exitoso; no deben existir mas de 5 ramas de feature activas simultaneamente.

Fuente: [`runbooks/links/RB-048-gitflow.md`](runbooks/links/RB-048-gitflow.md)

---

### GIT-CI-048-04

**DEFINICION:** Las ramas `hotfix/*` deben crearse desde `main`, solucionar un unico issue critico, mergearse de vuelta a `main` y `develop` simultaneamente, y generar un tag `vX.Y.Z` con patch bump inmediato.

Fuente: [`runbooks/links/RB-048-gitflow.md`](runbooks/links/RB-048-gitflow.md)

---

### GIT-CI-048-05

**DEFINICION:** Las ramas `release/*` deben congelarse para nuevas funcionalidades tras su creacion; solo se aceptan bugfixes de ultimo minuto y actualizaciones de documentacion; la duracion de una rama release no debe exceder 7 dias.

Fuente: [`runbooks/links/RB-048-gitflow.md`](runbooks/links/RB-048-gitflow.md)

---

### GIT-CI-051

**DEFINICION:** Todo cambio de codigo debe pasar por un pipeline de despliegue automatizado con stages secuenciales: lint + security scan, tests unitarios, tests de integracion, tests E2E, deploy a staging, y deploy a produccion con aprobacion manual.

Fuente: [`runbooks/books/engineering/RB-065-continuous-delivery.md`](runbooks/books/engineering/RB-065-continuous-delivery.md)

---

### GIT-CI-052

**DEFINICION:** Cada commit en `main` debe ser desplegable a produccion en cualquier momento. Si un commit rompe el pipeline, es la maxima prioridad del equipo arreglarlo o revertirlo.

Fuente: [`runbooks/books/engineering/RB-065-continuous-delivery.md`](runbooks/books/engineering/RB-065-continuous-delivery.md)

---

### GIT-CI-053

**DEFINICION:** Los tests de humo (smoke tests) deben ejecutarse automaticamente despues de cada deploy a cualquier entorno de Forge para verificar que la app responde correctamente.

Fuente: [`runbooks/books/engineering/RB-065-continuous-delivery.md`](runbooks/books/engineering/RB-065-continuous-delivery.md)

---

### GIT-CI-054

**DEFINICION:** El flujo de validacion de Rovo Execution Guard debe optimizarse para que el tiempo entre la edicion de un ticket en Jira y la respuesta del enforcement (bloqueo o aprobacion) sea el minimo posible, eliminando cuellos de botella.

Fuente: [`runbooks/books/devops/RB-066-phoenix-project.md`](runbooks/books/devops/RB-066-phoenix-project.md)

---

### GIT-CI-055

**DEFINICION:** Cada enforcement action (bloqueo de ticket, fallo de PR check, comentario automatico) debe generar un evento de auditoria observable en tiempo real para que el equipo pueda detectar anomalias.

Fuente: [`runbooks/books/devops/RB-066-phoenix-project.md`](runbooks/books/devops/RB-066-phoenix-project.md)

---

### GIT-CI-056

**DEFINICION:** Todo cambio de codigo en Rovo Execution Guard debe pasar por el pipeline CI/CD completo en lotes pequenos y frecuentes, no en megabranches con semanas de trabajo acumulado.

Fuente: [`runbooks/books/devops/RB-068-devops-handbook.md`](runbooks/books/devops/RB-068-devops-handbook.md)

---

### GIT-CI-057

**DEFINICION:** Cuando un despliegue a produccion falle o cause un incidente, el equipo debe realizar una retrospective blameless documentada con causa raiz y accion correctiva en menos de 48 horas.

Fuente: [`runbooks/books/devops/RB-068-devops-handbook.md`](runbooks/books/devops/RB-068-devops-handbook.md)

---

### GIT-CI-058

**DEFINICION:** El equipo debe medir y optimizar las cuatro metricas DORA aplicadas a Rovo Execution Guard: Lead Time (tiempo desde commit hasta produccion), Deploy Frequency (deploys a produccion por semana), Change Failure Rate (porcentaje de deploys que causan incidentes), y MTTR (tiempo medio para restaurar ...

Fuente: [`runbooks/books/devops/RB-069-accelerate.md`](runbooks/books/devops/RB-069-accelerate.md)

---

### GIT-CI-059

**DEFINICION:** La frecuencia de despliegue a produccion debe ser de al menos una vez por semana durante el desarrollo activo del MVP, preferiblemente con cada merge a `main`.

Fuente: [`runbooks/books/devops/RB-069-accelerate.md`](runbooks/books/devops/RB-069-accelerate.md)

---

### GIT-CI-0763

**DEFINICION:** Las sesiones de desarrollo deben producir commits atomicos donde cada commit representa una unidad completa de deep work: una feature de dominio, un adapter, o un test suite completo.

Fuente: [`runbooks/books/strategy/RB-076-deep-work.md`](runbooks/books/strategy/RB-076-deep-work.md)

---

### GIT-CI-0772

**DEFINICION:** Cada commit debe representar la mejora mas pequena posible que deja el codigo en estado funcional y con tests pasando.

Fuente: [`runbooks/books/strategy/RB-077-atomic-habits.md`](runbooks/books/strategy/RB-077-atomic-habits.md)

---

### GIT-CI-0785

**DEFINICION:** Los deploys a staging deben ocurrir automaticamente en cada merge a `main`, y los deploys a produccion requieren una metrica de calidad explicita (score de coverage, zero security vulns) como gate manual.

Fuente: [`runbooks/books/strategy/RB-078-lean-startup.md`](runbooks/books/strategy/RB-078-lean-startup.md)

---

### GIT-CI-0793

**DEFINICION:** Cada PR debe explicar en su descripcion que problema resuelve, como se valido, y que riesgos introduce. El autor es responsable de que el PR este completo antes de solicitar review.

Fuente: [`runbooks/books/strategy/RB-079-extreme-ownership.md`](runbooks/books/strategy/RB-079-extreme-ownership.md)

---

### GIT-CI-0814

**DEFINICION:** Los OKRs del sprint deben traducirse a gates en el CI/CD: si el objetivo es 90% coverage, el CI bloquea merges por debajo de ese umbral; si el objetivo es zero vulns criticas, Snyk falla el pipeline.

Fuente: [`runbooks/books/strategy/RB-081-high-output-management.md`](runbooks/books/strategy/RB-081-high-output-management.md)

---

### GIT-CI-0835

**DEFINICION:** El historial de git debe reflejar la naturaleza colaborativa e iterativa del desarrollo: cada feature se desarrolla en una rama con commits frecuentes que muestran la evolucion del pensamiento, no un solo commit squash.

Fuente: [`runbooks/books/strategy/RB-083-the-innovators.md`](runbooks/books/strategy/RB-083-the-innovators.md)

---

### GIT-CI-0865

**DEFINICION:** El CI pipeline solo ejecuta los checks esenciales para la calidad del codigo: lint, type-check, unit tests, y security scan. Checks complementarios (coverage report, bundle analysis) se ejecutan en paralelo sin bloquear el merge.

Fuente: [`runbooks/books/culture/RB-086-essentialism.md`](runbooks/books/culture/RB-086-essentialism.md)

---

### GIT-CI-0875

**DEFINICION:** El entorno de desarrollo local debe poder levantarse con un unico comando (`npm run dev`) en menos de 60 segundos, incluyendo Forge tunnel, para no romper el flow state del desarrollador.

Fuente: [`runbooks/books/culture/RB-087-peopleware.md`](runbooks/books/culture/RB-087-peopleware.md)

---

### GIT-CI-0885

**DEFINICION:** El historial de commits debe reflejar la dedicacion del equipo: cada commit debe compilar, pasar tests y dejar el sistema en estado funcional. No hay commits "WIP" que rompan el build.

Fuente: [`runbooks/books/culture/RB-088-soul-new-machine.md`](runbooks/books/culture/RB-088-soul-new-machine.md)

---

### GIT-CI-0905

**DEFINICION:** El pipeline de CI debe usar "sorting" eficiente: ejecutar primero los tests mas probables de fallar (tests del modulo modificado) y despues los menos probables (tests de modulos no relacionados).

Fuente: [`runbooks/books/culture/RB-090-algorithms-live-by.md`](runbooks/books/culture/RB-090-algorithms-live-by.md)

---

### GIT-CI-0931

**DEFINICION:** Cada desarrollador debe poder configurar el entorno de desarrollo completo en menos de 30 minutos, con documentacion paso a paso en el README que incluya: instalacion, configuracion de Forge CLI, setup de secrets, y primer deploy local.

Fuente: [`runbooks/books/culture/RB-093-soft-skills.md`](runbooks/books/culture/RB-093-soft-skills.md)

---

### GIT-CI-0945

**DEFINICION:** Las optimizaciones de rendimiento deben basarse en mediciones (profiling), no en suposiciones. Ningun refactor "por rendimiento" se aprueba sin un benchmark antes y despues que demuestre la mejora.

Fuente: [`runbooks/books/culture/RB-094-art-computer-programming.md`](runbooks/books/culture/RB-094-art-computer-programming.md)

---

### GIT-CI-0965

**DEFINICION:** Ningun codigo se mergea sin al menos una revision por un par. Los reviewers son tan responsables del codigo como el autor. Un "LGTM" sin leer el codigo es una falta profesional.

Fuente: [`runbooks/books/culture/RB-096-clean-coder.md`](runbooks/books/culture/RB-096-clean-coder.md)

---

### GIT-CI-1005

**DEFINICION:** El pipeline de CI/CD debe soportar "canary deploys": desplegar nuevas versiones del Forge app al 10% de los proyectos primero, medir el impacto en errores y rendimiento, y expandir gradualmente al 100% si no hay regresiones.

Fuente: [`runbooks/books/strategy/RB-100-innovators-dilemma.md`](runbooks/books/strategy/RB-100-innovators-dilemma.md)

---

### GIT-CI-201

**DEFINICION:** El hook `pre-commit` debe ejecutar `lint-staged` configurado para ESLint con `--fix` y Prettier con `--write` unicamente sobre archivos staged; prohibido ejecutar lint sobre todo el proyecto.

Fuente: [`runbooks/links/RB-024-husky-hooks.md`](runbooks/links/RB-024-husky-hooks.md)

---

### GIT-CI-202

**DEFINICION:** El hook `pre-push` debe ejecutar la suite de tests unitarios con `jest --changedSince=origin/main --coverage --passWithNoTests` y fallar si cualquier umbral de cobertura no se cumple.

Fuente: [`runbooks/links/RB-024-husky-hooks.md`](runbooks/links/RB-024-husky-hooks.md)

---

### GIT-CI-203

**DEFINICION:** Los hooks de Husky deben ser instalados automaticamente via el script `prepare` en `package.json` con `"prepare": "husky"` para que `npm install` los configure sin pasos manuales.

Fuente: [`runbooks/links/RB-024-husky-hooks.md`](runbooks/links/RB-024-husky-hooks.md)

---

### GIT-CI-204

**DEFINICION:** Prohibido usar `--no-verify` o `git commit --no-verify` en cualquier flujo de trabajo documentado; cualquier bypass de hooks debe requerir aprobacion de un segundo desarrollador.

Fuente: [`runbooks/links/RB-024-husky-hooks.md`](runbooks/links/RB-024-husky-hooks.md)

---

### GIT-CI-205

**DEFINICION:** El hook `commit-msg` debe invocar `commitlint` con la configuracion extendida de conventional commits y reglas de scope del proyecto; este hook es el unico responsable de validar el formato del mensaje.

Fuente: [`runbooks/links/RB-024-husky-hooks.md`](runbooks/links/RB-024-husky-hooks.md)

---

### GIT-CI-211

**DEFINICION:** Todo commit message debe seguir el formato Conventional Commits: `type(scope): descripcion` donde type es uno de `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`.

Fuente: [`runbooks/links/RB-025-commitlint.md`](runbooks/links/RB-025-commitlint.md)

---

### GIT-CI-212

**DEFINICION:** El scope del commit debe corresponder a un modulo valido del proyecto: `domain`, `scoring`, `inconsistency`, `jira`, `rovo`, `github`, `confluence`, `forge`, `ui`, `api`, `config`, `ci`, `deps`, `docs`.

Fuente: [`runbooks/links/RB-025-commitlint.md`](runbooks/links/RB-025-commitlint.md)

---

### GIT-CI-213

**DEFINICION:** La descripcion del commit debe contener un ID de Jira en formato `PROJECTKEY-NNN` cuando el scope es un modulo funcional (`feat`, `fix`, `refactor`, `perf`); los commits de infraestructura (`ci`, `chore`, `build`, `deps`) estan exentos.

Fuente: [`runbooks/links/RB-025-commitlint.md`](runbooks/links/RB-025-commitlint.md)

---

### GIT-CI-214

**DEFINICION:** La linea de asunto (subject) del commit no debe exceder 72 caracteres y la linea en blanco entre subject y body es obligatoria si el body existe.

Fuente: [`runbooks/links/RB-025-commitlint.md`](runbooks/links/RB-025-commitlint.md)

---

### GIT-CI-215

**DEFINICION:** Prohibido usar `BREAKING CHANGE!` sin un body que describa (1) que cambia, (2) por que, y (3) como migrar; el footer `BREAKING CHANGE:` debe incluir instrucciones de migracion.

Fuente: [`runbooks/links/RB-025-commitlint.md`](runbooks/links/RB-025-commitlint.md)

---

### GIT-CI-231

**DEFINICION:** El archivo `CHANGELOG.md` debe existir en la raiz del proyecto y mantenerse actualizado con cada release; esta prohibido generar changelogs automaticamente sin revision humana.

Fuente: [`runbooks/links/RB-033-keep-a-changelog.md`](runbooks/links/RB-033-keep-a-changelog.md)

---

### GIT-CI-232

**DEFINICION:** Cada entrada en el changelog debe clasificarse bajo una de estas secciones: `Added` (nuevas funcionalidades), `Changed` (cambios en comportamiento existente), `Deprecated` (funcionalidades que seran removidas), `Removed` (funcionalidades removidas), `Fixed` (correcciones de bugs), `Security` (vul...

Fuente: [`runbooks/links/RB-033-keep-a-changelog.md`](runbooks/links/RB-033-keep-a-changelog.md)

---

### GIT-CI-233

**DEFINICION:** Cada version liberada en el changelog debe seguir el formato `[X.Y.Z] - YYYY-MM-DD` donde X.Y.Z es semantic version y la fecha esta en ISO 8601; la version `Unreleased` no lleva fecha.

Fuente: [`runbooks/links/RB-033-keep-a-changelog.md`](runbooks/links/RB-033-keep-a-changelog.md)

---

### GIT-CI-234

**DEFINICION:** La seccion `[Unreleased]` debe acumular todos los cambios desde la ultima version liberada; al momento de release, el contenido de `[Unreleased]` se mueve a la nueva version con su fecha.

Fuente: [`runbooks/links/RB-033-keep-a-changelog.md`](runbooks/links/RB-033-keep-a-changelog.md)

---

### GIT-CI-235

**DEFINICION:** Prohibido incluir entradas en el changelog que sean exclusivamente internas y sin impacto para consumidores: refactorings sin cambio de comportamiento, actualizaciones de herramientas de desarrollo, cambios en CI/CD que no afectan la API.

Fuente: [`runbooks/links/RB-033-keep-a-changelog.md`](runbooks/links/RB-033-keep-a-changelog.md)

---

### GIT-CI-301

**DEFINICION:** Los workflows de GitHub Actions para Rovo Execution Guard deben estructurarse con jobs explicitos: `lint`, `test`, `build`, `deploy` (en ese orden), donde cada job depende del anterior via `needs` y falla rapido si un job anterior falla.

Fuente: [`runbooks/links/github-devops/RB-016-github-actions.md`](runbooks/links/github-devops/RB-016-github-actions.md)

---

### GIT-CI-302

**DEFINICION:** El workflow de deploy a produccion debe requerir un environment `production` con `required reviewers` (minimo 1 approver) y un `deployment gate` que verifique que los tests de integracion pasaron en el commit exacto que se va a deployar.

Fuente: [`runbooks/links/github-devops/RB-016-github-actions.md`](runbooks/links/github-devops/RB-016-github-actions.md)

---

### GIT-CI-303

**DEFINICION:** Los workflows deben usar matrix builds para ejecutar tests en las versiones de Node.js soportadas por Forge (`nodejs20.x`, `nodejs22.x`) y en las plataformas relevantes (`ubuntu-latest`), con `fail-fast: false` para detectar problemas de compatibilidad.

Fuente: [`runbooks/links/github-devops/RB-016-github-actions.md`](runbooks/links/github-devops/RB-016-github-actions.md)

---

### GIT-CI-304

**DEFINICION:** Toda version publicada de Rovo Execution Guard debe seguir el formato SemVer estricto `MAJOR.MINOR.PATCH` (ej. `1.4.2`), donde MAJOR indica cambios incompatibles en el scoring o la API de webhooks, MINOR indica funcionalidad nueva retrocompatible, y PATCH indica correcciones de bugs retrocompatib...

Fuente: [`runbooks/links/github-devops/RB-017-semantic-versioning.md`](runbooks/links/github-devops/RB-017-semantic-versioning.md)

---

### GIT-CI-305

**DEFINICION:** Los breaking changes (cambios en la estructura del scoring, formato de webhook, o configuracion de admin) deben incrementar la version MAJOR y documentarse en CHANGELOG.md con una seccion "BREAKING CHANGES" que describa la migracion requerida.

Fuente: [`runbooks/links/github-devops/RB-017-semantic-versioning.md`](runbooks/links/github-devops/RB-017-semantic-versioning.md)

---

### GIT-CI-306

**DEFINICION:** El CHANGELOG.md debe generarse automaticamente a partir de los conventional commits usando `semantic-release` o `conventional-changelog`, sin edicion manual. Cada entrada debe incluir el tipo (feat/fix/chore), el scope (scoring/webhook/admin), y opcionalmente el ID de ticket de Jira.

Fuente: [`runbooks/links/github-devops/RB-017-semantic-versioning.md`](runbooks/links/github-devops/RB-017-semantic-versioning.md)

---

### GIT-CI-307

**DEFINICION:** La version `0.x.x` esta reservada para desarrollo inicial (fase de construccion). El primer release estable debe ser `1.0.0` y solo debe publicarse cuando el scoring engine, la integracion con GitHub y la integracion con Rovo esten completos y con tests de integracion pasando.

Fuente: [`runbooks/links/github-devops/RB-017-semantic-versioning.md`](runbooks/links/github-devops/RB-017-semantic-versioning.md)

---

### GIT-CI-308

**DEFINICION:** Todo commit en el repositorio debe seguir el formato Conventional Commits: `<type>(<scope>): <description>`, donde `type` es uno de `feat`, `fix`, `perf`, `refactor`, `test`, `docs`, `chore`, `ci`, `build`; `scope` es el modulo afectado (`scoring`, `github`, `jira`, `rovo`, `webhook`, `admin`, `u...

Fuente: [`runbooks/links/github-devops/RB-018-conventional-commits.md`](runbooks/links/github-devops/RB-018-conventional-commits.md)

---

### GIT-CI-309

**DEFINICION:** Los commits que introducen breaking changes deben incluir un footer `BREAKING CHANGE:` con una descripcion del cambio y la migracion requerida, o bien usar el sufijo `!` despues del tipo (ej. `feat(scoring)!:`).

Fuente: [`runbooks/links/github-devops/RB-018-conventional-commits.md`](runbooks/links/github-devops/RB-018-conventional-commits.md)

---

### GIT-CI-310

**DEFINICION:** Los commits que corresponden a trabajo tracked en Jira deben incluir el ID del ticket de Jira en el footer del commit en el formato `Jira: <PROJECT>-<NUMBER>` (ej. `Jira: ROVO-042`). Para PRs que afectan multiples tickets, listar todos los IDs separados por coma.

Fuente: [`runbooks/links/github-devops/RB-018-conventional-commits.md`](runbooks/links/github-devops/RB-018-conventional-commits.md)

---

### GIT-CI-311

**DEFINICION:** El `husky` pre-commit hook debe ejecutar `commitlint` para validar el mensaje antes de que el commit se cree, y el `commit-msg` hook debe rechazar commits que no cumplan el formato. En CI, un step adicional debe validar todos los commits del PR.

Fuente: [`runbooks/links/github-devops/RB-018-conventional-commits.md`](runbooks/links/github-devops/RB-018-conventional-commits.md)

---

## UI-ADS - Atlassian Design System & UX

> 22 reglas

### UI-ADS-001

**DEFINICION:** Todo componente visual debe usar design tokens de Atlassian (`@atlaskit/tokens`) en lugar de valores hexadecimales, RGB o colores hardcodeados.

Fuente: [`runbooks/links/forge/RB-006-atlassian-design-system.md`](runbooks/links/forge/RB-006-atlassian-design-system.md)

---

### UI-ADS-002

**DEFINICION:** Todo texto visible debe pasar los criterios WCAG 2.1 nivel AA: ratio de contraste minimo de 4.5:1 para texto normal y 3:1 para texto grande (18px+ o 14px+ bold).

Fuente: [`runbooks/links/forge/RB-006-atlassian-design-system.md`](runbooks/links/forge/RB-006-atlassian-design-system.md)

---

### UI-ADS-003

**DEFINICION:** La internacionalizacion (i18n) debe usar el componente `I18nProvider` de `@forge/react` o el framework i18n de ADS, nunca concatenar strings para formar mensajes.

Fuente: [`runbooks/links/forge/RB-006-atlassian-design-system.md`](runbooks/links/forge/RB-006-atlassian-design-system.md)

---

### UI-ADS-004

**DEFINICION:** Todo componente interactivo (botones, links, inputs) debe tener labels accesibles, estados de foco visibles y ser navegable por teclado.

Fuente: [`runbooks/links/forge/RB-006-atlassian-design-system.md`](runbooks/links/forge/RB-006-atlassian-design-system.md)

---

### UI-ADS-005

**DEFINICION:** Los componentes UI Kit deben usar `@forge/react` version 10 o superior con React hooks (`useState`, `useEffect`, `useAction`), no el API legacy de prop functions.

Fuente: [`runbooks/links/forge/RB-007-forge-ui-kit.md`](runbooks/links/forge/RB-007-forge-ui-kit.md)

---

### UI-ADS-006

**DEFINICION:** Los componentes UI Kit no deben acceder al DOM directamente (`document.querySelector`, `document.getElementById`, `refs`, `portals`).

Fuente: [`runbooks/links/forge/RB-007-forge-ui-kit.md`](runbooks/links/forge/RB-007-forge-ui-kit.md)

---

### UI-ADS-007

**DEFINICION:** Los componentes UI Kit no deben inyectar HTML arbitrario ni usar `dangerouslySetInnerHTML`.

Fuente: [`runbooks/links/forge/RB-007-forge-ui-kit.md`](runbooks/links/forge/RB-007-forge-ui-kit.md)

---

### UI-ADS-008

**DEFINICION:** Las apps Custom UI deben comunicarse con Forge Functions exclusivamente a traves del `@forge/bridge` API (`invoke`, `requestJira`, etc.), nunca mediante HTTP directo al host.

Fuente: [`runbooks/links/forge/RB-008-forge-custom-ui.md`](runbooks/links/forge/RB-008-forge-custom-ui.md)

---

### UI-ADS-009

**DEFINICION:** Las apps Custom UI deben cumplir con la CSP de Forge: no cargar scripts externos, no usar eval(), no usar inline styles que ejecuten JavaScript, y no cargar estilos de dominios externos no declarados.

Fuente: [`runbooks/links/forge/RB-008-forge-custom-ui.md`](runbooks/links/forge/RB-008-forge-custom-ui.md)

---

### UI-ADS-0821

**DEFINICION:** Los mensajes de enforcement (bloqueo de ticket, fallo de PR check) deben explicar directamente por que se bloqueo y que accion concreta debe tomar el usuario, sin eufemismos ni jerga tecnica interna.

Fuente: [`runbooks/books/strategy/RB-082-radical-candor.md`](runbooks/books/strategy/RB-082-radical-candor.md)

---

### UI-ADS-0841

**DEFINICION:** El Jira issue panel de Rovo Execution Guard debe mostrar exactamente tres estados visuales (verde: aprobado, rojo: bloqueado, amarillo: advertencia) con un score numerico y una lista de acciones requeridas. Nada mas.

Fuente: [`runbooks/books/strategy/RB-084-steve-jobs.md`](runbooks/books/strategy/RB-084-steve-jobs.md)

---

### UI-ADS-0862

**DEFINICION:** El Jira issue panel muestra solo informacion esencial para la decision del usuario: estado del ticket, score, y la accion prioritaria. Cualquier dato adicional requiere un click explicito del usuario para expandir.

Fuente: [`runbooks/books/culture/RB-086-essentialism.md`](runbooks/books/culture/RB-086-essentialism.md)

---

### UI-ADS-0873

**DEFINICION:** Las notificaciones del sistema (bloqueos, advertencias) deben ser no intrusivas: usar el issue panel y comentarios en PR, nunca emails ni popups. El usuario ve la informacion cuando decide mirarla.

Fuente: [`runbooks/books/culture/RB-087-peopleware.md`](runbooks/books/culture/RB-087-peopleware.md)

---

### UI-ADS-0892

**DEFINICION:** La UI del issue panel debe ser disenada iterativamente: version 1 con HTML basico funcional, version 2 con estilos ADS, version 3 con animaciones y micro-interacciones. La funcionalidad siempre precede a la estetica.

Fuente: [`runbooks/books/culture/RB-089-hackers-painters.md`](runbooks/books/culture/RB-089-hackers-painters.md)

---

### UI-ADS-0932

**DEFINICION:** El Forge app debe "venderse" a los usuarios en los primeros 30 segundos de uso: el issue panel debe mostrar valor inmediato (score del ticket + accion prioritaria) sin requerir configuracion ni tutorial.

Fuente: [`runbooks/books/culture/RB-093-soft-skills.md`](runbooks/books/culture/RB-093-soft-skills.md)

---

### UI-ADS-0955

**DEFINICION:** Los componentes React del issue panel deben usar functional components con hooks nativos (`useState`, `useEffect`, `useCallback`), prohibiendo class components y librerias de state management externas (Redux, MobX).

Fuente: [`runbooks/books/culture/RB-095-eloquent-javascript.md`](runbooks/books/culture/RB-095-eloquent-javascript.md)

---

### UI-ADS-0975

**DEFINICION:** La UI del issue panel debe poder mostrar informacion sobre si misma: un modo "debug" que muestre que reglas se evaluaron, cuanto tiempo tomo cada una, y que datos se usaron, accesible solo para administradores del proyecto.

Fuente: [`runbooks/books/ai-future/RB-097-godel-escher-bach.md`](runbooks/books/ai-future/RB-097-godel-escher-bach.md)

---

### UI-ADS-201

**DEFINICION:** Los hooks (`useState`, `useEffect`, `useCallback`, `useMemo`) solo pueden ser llamados en el nivel superior de un componente React o de un custom hook; prohibido llamar hooks dentro de condicionales, loops, o funciones anidadas.

Fuente: [`runbooks/links/RB-035-react-best-practices.md`](runbooks/links/RB-035-react-best-practices.md)

---

### UI-ADS-202

**DEFINICION:** Los componentes React deben separarse en dos categorias: (1) presentational (sin estado, solo props -> UI) y (2) container (con logica de negocio, hooks, data fetching); un componente no debe mezclar logica de negocio compleja con rendering JSX.

Fuente: [`runbooks/links/RB-035-react-best-practices.md`](runbooks/links/RB-035-react-best-practices.md)

---

### UI-ADS-203

**DEFINICION:** Memoizar componentes y valores solo cuando exista evidencia de rendimiento medible; prohibido envolver todos los componentes en `React.memo` o todos los valores en `useMemo` de forma preventiva.

Fuente: [`runbooks/links/RB-035-react-best-practices.md`](runbooks/links/RB-035-react-best-practices.md)

---

### UI-ADS-204

**DEFINICION:** Toda propiedad de evento (`onClick`, `onChange`) pasada a componentes hijos debe ser estabilizada con `useCallback` si el hijo esta memoizado; de lo contrario, la memoization del hijo es ineficaz porque la funcion se recrea en cada render del padre.

Fuente: [`runbooks/links/RB-035-react-best-practices.md`](runbooks/links/RB-035-react-best-practices.md)

---

### UI-ADS-205

**DEFINICION:** Prohibido usar `useEffect` para sincronizar estado derivado; usar `useMemo` o computacion directa durante el render para valores que se calculan a partir de props o estado existente.

Fuente: [`runbooks/links/RB-035-react-best-practices.md`](runbooks/links/RB-035-react-best-practices.md)

---

## ROVO-INTEG - Rovo & IA Integration

> 48 reglas

### ROVO-INTEG-001

**DEFINICION:** Toda llamada a la Confluence REST API v2 debe usar paginacion basada en cursores (`cursor` y `limit`), no paginacion offset-based.

Fuente: [`runbooks/links/forge/RB-005-confluence-rest-api.md`](runbooks/links/forge/RB-005-confluence-rest-api.md)

---

### ROVO-INTEG-002

**DEFINICION:** Las respuestas de la API v2 deben usar los `Link` headers para navegacion, no construir URLs manualmente.

Fuente: [`runbooks/links/forge/RB-005-confluence-rest-api.md`](runbooks/links/forge/RB-005-confluence-rest-api.md)

---

### ROVO-INTEG-003

**DEFINICION:** El parametro `limit` en endpoints de la API v2 no debe exceder 250.

Fuente: [`runbooks/links/forge/RB-005-confluence-rest-api.md`](runbooks/links/forge/RB-005-confluence-rest-api.md)

---

### ROVO-INTEG-004

**DEFINICION:** El contexto extraido via Rovo debe ser tratado como datos no confiables y validado antes de ser usado en decisiones de scoring o blocking de PRs.

Fuente: [`runbooks/links/forge/RB-013-rovo-docs.md`](runbooks/links/forge/RB-013-rovo-docs.md)

---

### ROVO-INTEG-005

**DEFINICION:** Las llamadas al API de Rovo deben implementar timeout propio (maximo 5 segundos) y fallback graceful cuando Rovo no esta disponible.

Fuente: [`runbooks/links/forge/RB-013-rovo-docs.md`](runbooks/links/forge/RB-013-rovo-docs.md)

---

### ROVO-INTEG-006

**DEFINICION:** Los resultados de Rovo deben cachearse en Forge Storage con un TTL para evitar llamadas repetidas para el mismo contexto.

Fuente: [`runbooks/links/forge/RB-013-rovo-docs.md`](runbooks/links/forge/RB-013-rovo-docs.md)

---

### ROVO-INTEG-046-04

**DEFINICION:** Antes de abrir un ticket de soporte a Atlassian, se debe buscar en la comunidad si el issue ya fue reportado; si existe, anadir el contexto especifico del proyecto como reply en vez de duplicar.

Fuente: [`runbooks/links/RB-046-atlassian-community.md`](runbooks/links/RB-046-atlassian-community.md)

---

### ROVO-INTEG-046-05

**DEFINICION:** Las soluciones y workarounds descubiertos durante el desarrollo deben contribuirse de vuelta a la comunidad Atlassian dentro de los 15 dias posteriores a su implementacion exitosa.

Fuente: [`runbooks/links/RB-046-atlassian-community.md`](runbooks/links/RB-046-atlassian-community.md)

---

### ROVO-INTEG-051

**DEFINICION:** El resultado de una consulta a Rovo debe ser consistente durante la duracion de una transaccion de validacion completa, incluso si el contexto organizacional cambia entre la consulta inicial y el enforcement final.

Fuente: [`runbooks/books/engineering/RB-053-designing-data-intensive-apps.md`](runbooks/books/engineering/RB-053-designing-data-intensive-apps.md)

---

### ROVO-INTEG-052

**DEFINICION:** El equipo debe usar un lenguaje ubicuo consistente en codigo, tests, documentacion, y comunicacion, definido en un glosario central que Ralph audita.

Fuente: [`runbooks/books/engineering/RB-057-domain-driven-design.md`](runbooks/books/engineering/RB-057-domain-driven-design.md)

---

### ROVO-INTEG-053

**DEFINICION:** El sistema debe modelar el tiempo como un concepto de primera clase, con representaciones inmutables para instantes (timestamp de validacion), duraciones (TTL de cache), y periodos (ventana de reintentos).

Fuente: [`runbooks/books/engineering/RB-062-sicp.md`](runbooks/books/engineering/RB-062-sicp.md)

---

### ROVO-INTEG-054

**DEFINICION:** Los contratos de comunicacion entre los modulos de Jira, GitHub, y Rovo deben estar definidos explicitamente como interfaces TypeScript versionadas, no como implementaciones compartidas.

Fuente: [`runbooks/books/engineering/RB-063-building-microservices.md`](runbooks/books/engineering/RB-063-building-microservices.md)

---

### ROVO-INTEG-055

**DEFINICION:** Las respuestas de Rovo que alimentan el calculo del Consistency Score nunca deben ser aceptadas como verdad absoluta. El sistema debe incluir mecanismos de verificacion cruzada y fallback para cuando Rovo produzca resultados inconsistentes.

Fuente: [`runbooks/books/ai-future/RB-071-life-3.md`](runbooks/books/ai-future/RB-071-life-3.md)

---

### ROVO-INTEG-056

**DEFINICION:** Las decisiones de enforcement (bloquear un ticket o un PR) deben ser siempre explicable por el sistema. El usuario debe poder entender POR QUE se bloqueo su ticket en terminos de negocio, no en terminos de scoring algoritmico.

Fuente: [`runbooks/books/ai-future/RB-071-life-3.md`](runbooks/books/ai-future/RB-071-life-3.md)

---

### ROVO-INTEG-057

**DEFINICION:** El sistema debe implementar controles de capacidad sobre las acciones que Rovo puede desencadenar: ninguna accion de enforcement puede ejecutarse sin pasar por un conjunto de reglas deterministas que actuen como guardrails.

Fuente: [`runbooks/books/ai-future/RB-072-superintelligence.md`](runbooks/books/ai-future/RB-072-superintelligence.md)

---

### ROVO-INTEG-058

**DEFINICION:** El sistema debe implementar un "kill switch" configurable por proyecto que permita desactivar completamente la integracion con Rovo y el enforcement, manteniendo la app funcional en modo observacion (sin bloqueo).

Fuente: [`runbooks/books/ai-future/RB-072-superintelligence.md`](runbooks/books/ai-future/RB-072-superintelligence.md)

---

### ROVO-INTEG-059

**DEFINICION:** El sistema debe tratar las preferencias del usuario como inciertas y actualizables: si un usuario override un bloqueo del Quality Gate, el sistema debe aprender de esa decision y ajustar su comportamiento futuro para ese tipo de tickets.

Fuente: [`runbooks/books/ai-future/RB-073-human-compatible.md`](runbooks/books/ai-future/RB-073-human-compatible.md)

---

### ROVO-INTEG-060

**DEFINICION:** El sistema nunca debe asumir que tiene informacion completa. Las validaciones deben manejar explicitamente la incertidumbre cuando Rovo no devuelve suficiente contexto o cuando los datos de Confluence estan desactualizados.

Fuente: [`runbooks/books/ai-future/RB-073-human-compatible.md`](runbooks/books/ai-future/RB-073-human-compatible.md)

---

### ROVO-INTEG-061

**DEFINICION:** El sistema debe ser beneficioso por diseno: cada enforcement action debe estar orientada a reducir el retrabajo del equipo, no a maximizar el numero de tickets bloqueados.

Fuente: [`runbooks/books/ai-future/RB-073-human-compatible.md`](runbooks/books/ai-future/RB-073-human-compatible.md)

---

### ROVO-INTEG-062

**DEFINICION:** El calculo del Consistency Score debe evitar sesgos de anclaje: el score no debe estar influenciado artificialmente por el primer eje evaluado ni por el orden de presentacion de las senales de Rovo.

Fuente: [`runbooks/books/ai-future/RB-074-thinking-fast-slow.md`](runbooks/books/ai-future/RB-074-thinking-fast-slow.md)

---

### ROVO-INTEG-063

**DEFINICION:** Las notificaciones de enforcement al usuario deben estar disenadas para mitigar el sesgo de confirmacion: deben presentar evidencia tanto a favor como en contra del bloqueo, no solo las razones para bloquear.

Fuente: [`runbooks/books/ai-future/RB-074-thinking-fast-slow.md`](runbooks/books/ai-future/RB-074-thinking-fast-slow.md)

---

### ROVO-INTEG-064

**DEFINICION:** Las decisiones de configuracion del sistema (thresholds, pesos de ejes, reglas de bloqueo) deben tomarse con datos y evidencia, no basandose en intuicion o preferencia personal del configurador.

Fuente: [`runbooks/books/ai-future/RB-074-thinking-fast-slow.md`](runbooks/books/ai-future/RB-074-thinking-fast-slow.md)

---

### ROVO-INTEG-065

**DEFINICION:** El sistema de scoring de Rovo Execution Guard debe permitir la seleccion y ajuste del modelo de evaluacion segun el contexto del proyecto, reconociendo que diferentes equipos pueden requerir diferentes enfoques de validacion.

Fuente: [`runbooks/books/ai-future/RB-075-master-algorithm.md`](runbooks/books/ai-future/RB-075-master-algorithm.md)

---

### ROVO-INTEG-066

**DEFINICION:** El sistema debe combinar multiples senales de validacion (estructural, contextual, historica) como un ensemble, donde cada senal contribuye al score final de forma ponderada y configurable, en vez de depender de un unico criterio.

Fuente: [`runbooks/books/ai-future/RB-075-master-algorithm.md`](runbooks/books/ai-future/RB-075-master-algorithm.md)

---

### ROVO-INTEG-067

**DEFINICION:** El sistema debe evaluar la calidad de sus propias predicciones y ajustar su comportamiento en base a la precision historica, manteniendo metricas de efectividad por proyecto y por tipo de ticket.

Fuente: [`runbooks/books/ai-future/RB-075-master-algorithm.md`](runbooks/books/ai-future/RB-075-master-algorithm.md)

---

### ROVO-INTEG-0765

**DEFINICION:** Las llamadas a Rovo para obtener contexto organizacional deben agruparse en una unica funcion `fetchRovoContext()` que cachee resultados por ticket por 5 minutos, evitando llamadas repetidas durante una sesion de validacion.

Fuente: [`runbooks/books/strategy/RB-076-deep-work.md`](runbooks/books/strategy/RB-076-deep-work.md)

---

### ROVO-INTEG-0775

**DEFINICION:** Cada llamada a Rovo debe envolver la respuesta en un type guard que valide la estructura antes de procesarla, agregando una capa de proteccion incremental por cada nuevo campo utilizado.

Fuente: [`runbooks/books/strategy/RB-077-atomic-habits.md`](runbooks/books/strategy/RB-077-atomic-habits.md)

---

### ROVO-INTEG-0781

**DEFINICION:** El MVP del scoring engine debe calcular un score basado exclusivamente en campos nativos de Jira (summary, description, acceptance criteria) antes de integrar contexto de Rovo.

Fuente: [`runbooks/books/strategy/RB-078-lean-startup.md`](runbooks/books/strategy/RB-078-lean-startup.md)

---

### ROVO-INTEG-0795

**DEFINICION:** Cada llamada a una API externa (Rovo, Jira, GitHub) debe tener un timeout explicito y un fallback definido. El sistema nunca debe quedar en estado indeterminado por una dependencia externa.

Fuente: [`runbooks/books/strategy/RB-079-extreme-ownership.md`](runbooks/books/strategy/RB-079-extreme-ownership.md)

---

### ROVO-INTEG-0801

**DEFINICION:** Rovo Execution Guard debe ofrecer una capacidad que no existe en ningun otro producto de Atlassian Marketplace: validacion cruzada automatica entre tickets Jira, documentacion Confluence y PRs GitHub con enforcement activo (bloqueo, no sugerencia).

Fuente: [`runbooks/books/strategy/RB-080-zero-to-one.md`](runbooks/books/strategy/RB-080-zero-to-one.md)

---

### ROVO-INTEG-0813

**DEFINICION:** El output del sistema debe medirse con KPIs claros: tickets bloqueados vs permitidos, false positive rate de inconsistencias, tiempo ahorrado por equipo, y adopcion de quality gates por proyecto.

Fuente: [`runbooks/books/strategy/RB-081-high-output-management.md`](runbooks/books/strategy/RB-081-high-output-management.md)

---

### ROVO-INTEG-0824

**DEFINICION:** Cuando Rovo Execution Guard detecta una inconsistencia entre un ticket y la documentacion, el mensaje al usuario debe citar la fuente especifica de la contradiccion, no solo decir "hay inconsistencia".

Fuente: [`runbooks/books/strategy/RB-082-radical-candor.md`](runbooks/books/strategy/RB-082-radical-candor.md)

---

### ROVO-INTEG-0831

**DEFINICION:** La integracion con Rovo debe ser iterativa: la primera version usa solo campos basicos de tickets, la segunda agrega contexto de Confluence, la tercera incorpora patrones historicos del equipo. Cada iteracion agrega valor sin invalidar la anterior.

Fuente: [`runbooks/books/strategy/RB-083-the-innovators.md`](runbooks/books/strategy/RB-083-the-innovators.md)

---

### ROVO-INTEG-0845

**DEFINICION:** La configuracion por proyecto debe tener defaults que funcionen correctamente sin personalizacion, de modo que un equipo nuevo instale el Forge app y obtenga valor inmediato sin configurar nada.

Fuente: [`runbooks/books/strategy/RB-084-steve-jobs.md`](runbooks/books/strategy/RB-084-steve-jobs.md)

---

### ROVO-INTEG-0855

**DEFINICION:** Si la integracion con Rovo falla completamente (API no disponible por mas de 30 minutos), el sistema debe notificar al administrador del proyecto y operar en modo degradado usando solo validacion local (sin contexto organizacional).

Fuente: [`runbooks/books/strategy/RB-085-hard-things.md`](runbooks/books/strategy/RB-085-hard-things.md)

---

### ROVO-INTEG-0863

**DEFINICION:** El sistema solo debe hacer llamadas a Rovo que contribuyan directamente a la decision de enforcement actual. No prefetchar datos "por si acaso" ni obtener contexto que no se va a usar.

Fuente: [`runbooks/books/culture/RB-086-essentialism.md`](runbooks/books/culture/RB-086-essentialism.md)

---

### ROVO-INTEG-0884

**DEFINICION:** El proceso de obtener contexto de Rovo debe iterar hasta que la precision del scoring sea >= 90% (medido por false positive rate), dedicando el tiempo necesario a calibrar las senales.

Fuente: [`runbooks/books/culture/RB-088-soul-new-machine.md`](runbooks/books/culture/RB-088-soul-new-machine.md)

---

### ROVO-INTEG-0893

**DEFINICION:** La integracion con Rovo debe ser como una API bien disenada: simple por fuera, sofisticada por dentro. El consumidor (scoring engine) no necesita saber como Rovo obtiene el contexto, solo que recibe un `RovoContext` tipado y confiable.

Fuente: [`runbooks/books/culture/RB-089-hackers-painters.md`](runbooks/books/culture/RB-089-hackers-painters.md)

---

### ROVO-INTEG-0902

**DEFINICION:** El scheduling de validaciones (cuando se ejecutan los quality gates) debe seguir un algoritmo de "earliest deadline first": las validaciones mas urgentes (bloqueo de PR pendiente de merge) se ejecutan antes que las de baja prioridad (re-score periodico).

Fuente: [`runbooks/books/culture/RB-090-algorithms-live-by.md`](runbooks/books/culture/RB-090-algorithms-live-by.md)

---

### ROVO-INTEG-0915

**DEFINICION:** El sistema nunca debe depender de que Rovo este disponible para tomar decisiones de enforcement criticas. Rovo es un enhancer, nunca un requerimiento obligatorio para el funcionamiento basico.

Fuente: [`runbooks/books/culture/RB-091-black-swan.md`](runbooks/books/culture/RB-091-black-swan.md)

---

### ROVO-INTEG-0924

**DEFINICION:** Cuando Rovo cambia su API o formato de respuesta, el sistema debe detectar el cambio automaticamente (via schema validation fallida), adaptarse usando el modo degradado, y notificar al equipo para actualizar el adapter.

Fuente: [`runbooks/books/culture/RB-092-antifragile.md`](runbooks/books/culture/RB-092-antifragile.md)

---

### ROVO-INTEG-0943

**DEFINICION:** La deteccion de inconsistencias entre tickets y documentacion debe usar algoritmos de similitud de texto con umbrales calibrados empiricamente, no heuristicas arbitrarias.

Fuente: [`runbooks/books/culture/RB-094-art-computer-programming.md`](runbooks/books/culture/RB-094-art-computer-programming.md)

---

### ROVO-INTEG-0953

**DEFINICION:** Las funciones que interactuan con APIs externas deben usar `async generators` o `for-await-of` cuando procesan respuestas paginadas, evitando cargar todos los datos en memoria simultaneamente.

Fuente: [`runbooks/books/culture/RB-095-eloquent-javascript.md`](runbooks/books/culture/RB-095-eloquent-javascript.md)

---

### ROVO-INTEG-0972

**DEFINICION:** El sistema debe poder evaluar su propia precision: un meta-score que mida la confiabilidad del scoring engine comparando sus predicciones (score alto = ticket valido) con los resultados reales (ticket genero rework o no).

Fuente: [`runbooks/books/ai-future/RB-097-godel-escher-bach.md`](runbooks/books/ai-future/RB-097-godel-escher-bach.md)

---

### ROVO-INTEG-0981

**DEFINICION:** Las funciones de IA en Rovo Execution Guard (sugerencias de reescritura, explicacion de inconsistencias) deben tratar a la IA como co-piloto, no como piloto: la IA sugiere, el humano decide, el sistema ejecuta.

Fuente: [`runbooks/books/ai-future/RB-098-co-intelligence.md`](runbooks/books/ai-future/RB-098-co-intelligence.md)

---

### ROVO-INTEG-0991

**DEFINICION:** El sistema de deteccion de inconsistencias debe modelarse como un agente inteligente con percepciones (datos del ticket, contexto de Rovo), una funcion de utilidad (precision de deteccion), y acciones (reportar inconsistencia, descartar falso positivo, solicitar mas contexto).

Fuente: [`runbooks/books/ai-future/RB-099-ai-modern-approach.md`](runbooks/books/ai-future/RB-099-ai-modern-approach.md)

---

### ROVO-INTEG-0995

**DEFINICION:** El sistema debe implementar un modelo de "agente con objetivos" donde el objetivo principal es maximizar la calidad de los tickets que pasan los quality gates, medido por la reduccion de rework post-entrega.

Fuente: [`runbooks/books/ai-future/RB-099-ai-modern-approach.md`](runbooks/books/ai-future/RB-099-ai-modern-approach.md)

---

### ROVO-INTEG-1002

**DEFINICION:** Las nuevas capacidades de Rovo (nuevos tipos de contexto, nuevas APIs) deben integrarse como features opt-in con valor incremental, no como cambios obligatorios que reescriben la funcionalidad existente.

Fuente: [`runbooks/books/strategy/RB-100-innovators-dilemma.md`](runbooks/books/strategy/RB-100-innovators-dilemma.md)

---

## GH-INTEG - GitHub Integration

> 13 reglas

### GH-INTEG-001

**DEFINICION:** Toda llamada a la Jira REST API v3 debe implementar paginacion usando `startAt` y `maxResults`, procesando resultados en lotes.

Fuente: [`runbooks/links/forge/RB-004-jira-rest-api.md`](runbooks/links/forge/RB-004-jira-rest-api.md)

---

### GH-INTEG-002

**DEFINICION:** Las llamadas a la Jira API deben usar el parametro `fields` para solicitar unicamente los campos necesarios, nunca `fields=*all`.

Fuente: [`runbooks/links/forge/RB-004-jira-rest-api.md`](runbooks/links/forge/RB-004-jira-rest-api.md)

---

### GH-INTEG-301

**DEFINICION:** Toda llamada a la GitHub REST API debe implementar paginacion usando el header `Link` relacional, solicitando maximo 100 items por pagina (`per_page=100`), y nunca asumir que una unica pagina contiene todos los resultados.

Fuente: [`runbooks/links/github-devops/RB-014-github-rest-api.md`](runbooks/links/github-devops/RB-014-github-rest-api.md)

---

### GH-INTEG-302

**DEFINICION:** Toda llamada a la GitHub REST API debe respetar los limites de rate limiting (5000 req/hr para authenticated requests con token de GitHub App) y debe leer los headers `X-RateLimit-Remaining`, `X-RateLimit-Limit` y `X-RateLimit-Reset` antes de cada llamada para anticipar throttling.

Fuente: [`runbooks/links/github-devops/RB-014-github-rest-api.md`](runbooks/links/github-devops/RB-014-github-rest-api.md)

---

### GH-INTEG-303

**DEFINICION:** Las llamadas GET a la GitHub REST API deben usar conditional requests con los headers `If-None-Match` (ETag) e `If-Modified-Since` para aprovechar cache hits (HTTP 304) y reducir consumo de rate limit.

Fuente: [`runbooks/links/github-devops/RB-014-github-rest-api.md`](runbooks/links/github-devops/RB-014-github-rest-api.md)

---

### GH-INTEG-304

**DEFINICION:** Las respuestas de error de la GitHub REST API deben clasificarse por status code semantico: 400 (bad request, retry sin修正), 403 (rate limit o forbidden, backoff), 404 (recurso no encontrado, skip), 422 (validacion fallida, log y skip), 500/502/503 (error transitorio, retry con exponential backoff).

Fuente: [`runbooks/links/github-devops/RB-014-github-rest-api.md`](runbooks/links/github-devops/RB-014-github-rest-api.md)

---

### GH-INTEG-305

**DEFINICION:** Los status checks de Rovo Execution Guard deben publicarse usando el endpoint `POST /repos/{owner}/{repo}/statuses/{sha}` con un `context` unico (ej. `rovo-execution-guard/consistency`) y un `target_url` que enlace al detalle del score en el panel de Jira.

Fuente: [`runbooks/links/github-devops/RB-014-github-rest-api.md`](runbooks/links/github-devops/RB-014-github-rest-api.md)

---

### GH-INTEG-306

**DEFINICION:** Los webhook handlers deben ser idempotentes: procesar el mismo evento multiples veces debe producir el mismo resultado final. Esto se logra usando el header `X-GitHub-Delivery` (UUID) como clave de deduplicacion con un TTL de al menos 5 minutos.

Fuente: [`runbooks/links/github-devops/RB-015-github-webhooks.md`](runbooks/links/github-devops/RB-015-github-webhooks.md)

---

### GH-INTEG-307

**DEFINICION:** Los webhook handlers deben filtrar eventos por tipo usando el header `X-GitHub-Event` y procesar unicamente los eventos relevantes para Rovo Execution Guard: `pull_request` (acciones: opened, synchronize, reopened), `pull_request_review` (acciones: submitted) y `status`. Los demas eventos deben s...

Fuente: [`runbooks/links/github-devops/RB-015-github-webhooks.md`](runbooks/links/github-devops/RB-015-github-webhooks.md)

---

### GH-INTEG-308

**DEFINICION:** Toda interaccion programatica con la GitHub API debe realizarse a traves de Octokit.js (no fetch manual ni axios), instanciando un cliente autenticado con el installation token de la GitHub App, usando los plugins oficiales `@octokit/plugin-retry` y `@octokit/plugin-throttling` para manejo automa...

Fuente: [`runbooks/links/github-devops/RB-020-octokit.md`](runbooks/links/github-devops/RB-020-octokit.md)

---

### GH-INTEG-309

**DEFINICION:** Las llamadas a la GitHub API a traves de Octokit deben usar retry con exponential backoff configurado a maximo 3 reintentos, con delays de 1s, 4s y 16s (base 4), y un jitter aleatorio de +-500ms. Los errores de cliente (400, 401, 403, 404, 422) no deben reintentarse.

Fuente: [`runbooks/links/github-devops/RB-020-octokit.md`](runbooks/links/github-devops/RB-020-octokit.md)

---

### GH-INTEG-310

**DEFINICION:** Los errores de Octokit deben capturarse usando `RequestError` de `@octokit/request-error` y clasificarse en tres categorias con acciones distintas: (1) errores transitorios (5xx, rate limit) para retry automatico, (2) errores de recurso no encontrado (404) para skip silencioso con log, (3) errore...

Fuente: [`runbooks/links/github-devops/RB-020-octokit.md`](runbooks/links/github-devops/RB-020-octokit.md)

---

### GH-INTEG-311

**DEFINICION:** La paginacion con Octokit debe usar el metodo `octokit.paginate()` o el iterador `octokit.paginate.iterator()` en lugar de paginacion manual. Nunca usar `autoPaginate` (deprecated) ni implementar paginacion propia con llamadas GET sucesivas.

Fuente: [`runbooks/links/github-devops/RB-020-octokit.md`](runbooks/links/github-devops/RB-020-octokit.md)

---

## Indice de Fuentes

### Links (50 fuentes tecnicas)

- [RB-021](runbooks/links/RB-021-typescript-handbook.md)
- [RB-022](runbooks/links/RB-022-jest-testing.md)
- [RB-023](runbooks/links/RB-023-playwright-e2e.md)
- [RB-024](runbooks/links/RB-024-husky-hooks.md)
- [RB-025](runbooks/links/RB-025-commitlint.md)
- [RB-026](runbooks/links/RB-026-eslint-rules.md)
- [RB-027](runbooks/links/RB-027-airbnb-style.md)
- [RB-028](runbooks/links/RB-028-nodejs-best-practices.md)
- [RB-029](runbooks/links/RB-029-owasp-top10.md)
- [RB-030](runbooks/links/RB-030-oauth2.md)
- [RB-031](runbooks/links/RB-031-jwt.md)
- [RB-032](runbooks/links/RB-032-twelve-factor.md)
- [RB-033](runbooks/links/RB-033-keep-a-changelog.md)
- [RB-034](runbooks/links/RB-034-snyk-security.md)
- [RB-035](runbooks/links/RB-035-react-best-practices.md)
- [RB-036](runbooks/links/RB-036-sentry-docs.md)
- [RB-037](runbooks/links/RB-037-google-sre.md)
- [RB-038](runbooks/links/RB-038-datadog-api.md)
- [RB-039](runbooks/links/RB-039-cloudevents.md)
- [RB-040](runbooks/links/RB-040-rest-api-design.md)
- [RB-041](runbooks/links/RB-041-marketplace-terms.md)
- [RB-042](runbooks/links/RB-042-openapi-spec.md)
- [RB-043](runbooks/links/RB-043-dependabot.md)
- [RB-044](runbooks/links/RB-044-prettier.md)
- [RB-045](runbooks/links/RB-045-markdown-guide.md)
- [RB-046](runbooks/links/RB-046-atlassian-community.md)
- [RB-047](runbooks/links/RB-047-http-status-codes.md)
- [RB-048](runbooks/links/RB-048-gitflow.md)
- [RB-049](runbooks/links/RB-049-solid-principles.md)
- [RB-050](runbooks/links/RB-050-forge-graphql.md)
- [RB-SEC-001](runbooks/links/RB-SEC-001-security-privacy-auth.md)
- [RB-001](runbooks/links/forge/RB-001-forge-manifest.md)
- [RB-002](runbooks/links/forge/RB-002-forge-platform-limits.md)
- [RB-003](runbooks/links/forge/RB-003-forge-security.md)
- [RB-004](runbooks/links/forge/RB-004-jira-rest-api.md)
- [RB-005](runbooks/links/forge/RB-005-confluence-rest-api.md)
- [RB-006](runbooks/links/forge/RB-006-atlassian-design-system.md)
- [RB-007](runbooks/links/forge/RB-007-forge-ui-kit.md)
- [RB-008](runbooks/links/forge/RB-008-forge-custom-ui.md)
- [RB-009](runbooks/links/forge/RB-009-forge-storage-api.md)
- [RB-010](runbooks/links/forge/RB-010-forge-runtime.md)
- [RB-011](runbooks/links/forge/RB-011-data-privacy.md)
- [RB-012](runbooks/links/forge/RB-012-forge-tunneling.md)
- [RB-013](runbooks/links/forge/RB-013-rovo-docs.md)
- [RB-014](runbooks/links/github-devops/RB-014-github-rest-api.md)
- [RB-015](runbooks/links/github-devops/RB-015-github-webhooks.md)
- [RB-016](runbooks/links/github-devops/RB-016-github-actions.md)
- [RB-017](runbooks/links/github-devops/RB-017-semantic-versioning.md)
- [RB-018](runbooks/links/github-devops/RB-018-conventional-commits.md)
- [RB-019](runbooks/links/github-devops/RB-019-github-apps-auth.md)
- [RB-020](runbooks/links/github-devops/RB-020-octokit.md)

### Libros (50 fuentes de ingenieria)

- [RB-071](runbooks/books/ai-future/RB-071-life-3.md)
- [RB-072](runbooks/books/ai-future/RB-072-superintelligence.md)
- [RB-073](runbooks/books/ai-future/RB-073-human-compatible.md)
- [RB-074](runbooks/books/ai-future/RB-074-thinking-fast-slow.md)
- [RB-075](runbooks/books/ai-future/RB-075-master-algorithm.md)
- [RB-097](runbooks/books/ai-future/RB-097-godel-escher-bach.md)
- [RB-098](runbooks/books/ai-future/RB-098-co-intelligence.md)
- [RB-099](runbooks/books/ai-future/RB-099-ai-modern-approach.md)
- [RB-086](runbooks/books/culture/RB-086-essentialism.md)
- [RB-087](runbooks/books/culture/RB-087-peopleware.md)
- [RB-088](runbooks/books/culture/RB-088-soul-new-machine.md)
- [RB-089](runbooks/books/culture/RB-089-hackers-painters.md)
- [RB-090](runbooks/books/culture/RB-090-algorithms-live-by.md)
- [RB-091](runbooks/books/culture/RB-091-black-swan.md)
- [RB-092](runbooks/books/culture/RB-092-antifragile.md)
- [RB-093](runbooks/books/culture/RB-093-soft-skills.md)
- [RB-094](runbooks/books/culture/RB-094-art-computer-programming.md)
- [RB-095](runbooks/books/culture/RB-095-eloquent-javascript.md)
- [RB-096](runbooks/books/culture/RB-096-clean-coder.md)
- [RB-066](runbooks/books/devops/RB-066-phoenix-project.md)
- [RB-067](runbooks/books/devops/RB-067-unicorn-project.md)
- [RB-068](runbooks/books/devops/RB-068-devops-handbook.md)
- [RB-069](runbooks/books/devops/RB-069-accelerate.md)
- [RB-070](runbooks/books/devops/RB-070-team-topologies.md)
- [RB-051](runbooks/books/engineering/RB-051-clean-code.md)
- [RB-052](runbooks/books/engineering/RB-052-pragmatic-programmer.md)
- [RB-053](runbooks/books/engineering/RB-053-designing-data-intensive-apps.md)
- [RB-054](runbooks/books/engineering/RB-054-clean-architecture.md)
- [RB-055](runbooks/books/engineering/RB-055-refactoring.md)
- [RB-056](runbooks/books/engineering/RB-056-code-complete.md)
- [RB-057](runbooks/books/engineering/RB-057-domain-driven-design.md)
- [RB-058](runbooks/books/engineering/RB-058-legacy-code.md)
- [RB-059](runbooks/books/engineering/RB-059-mythical-man-month.md)
- [RB-060](runbooks/books/engineering/RB-060-enterprise-patterns.md)
- [RB-061](runbooks/books/engineering/RB-061-introduction-algorithms.md)
- [RB-062](runbooks/books/engineering/RB-062-sicp.md)
- [RB-063](runbooks/books/engineering/RB-063-building-microservices.md)
- [RB-064](runbooks/books/engineering/RB-064-tdd-by-example.md)
- [RB-065](runbooks/books/engineering/RB-065-continuous-delivery.md)
- [RB-076](runbooks/books/strategy/RB-076-deep-work.md)
- [RB-077](runbooks/books/strategy/RB-077-atomic-habits.md)
- [RB-078](runbooks/books/strategy/RB-078-lean-startup.md)
- [RB-079](runbooks/books/strategy/RB-079-extreme-ownership.md)
- [RB-080](runbooks/books/strategy/RB-080-zero-to-one.md)
- [RB-081](runbooks/books/strategy/RB-081-high-output-management.md)
- [RB-082](runbooks/books/strategy/RB-082-radical-candor.md)
- [RB-083](runbooks/books/strategy/RB-083-the-innovators.md)
- [RB-084](runbooks/books/strategy/RB-084-steve-jobs.md)
- [RB-085](runbooks/books/strategy/RB-085-hard-things.md)
- [RB-100](runbooks/books/strategy/RB-100-innovators-dilemma.md)

---

## Indice de Resolucion de Conflictos

### Prioridad de Verdad

Cuando existen contradicciones entre fuentes, se aplica:

1. **Prioridad 1**: Limites oficiales de Atlassian Forge (runtime, storage, network)
2. **Prioridad 2**: Seguridad (OWASP, OAuth, JWT, Data Privacy)
3. **Prioridad 3**: APIs de GitHub y estandares de integracion
4. **Prioridad 4**: Principios de arquitectura de libros (Clean Code, SOLID, DDD)

### Reglas Duplicadas Resueltas

- SEC-PRIV-001 a SEC-PRIV-005: Aparecen en RB-003 y RB-SEC-001. Se mantiene la version de RB-003 (Forge Security Guide, fuente oficial).
- ARCH-SOLID-0103: Fusionado con ARCH-SOLID-005 (mismo concepto sobre limites de Forge).
- Reglas con sub-numeracion (ej: GIT-CI-043-01): Son subsidiarias de su runbook padre.

### Sin Contradicciones Significativas

El analisis de las 100 fuentes no revela contradicciones significativas entre categorias.
Las reglas de performance (FORGE-OPS) y las de mantenibilidad (ARCH-SOLID) son complementarias:
el dominio debe ser puro (ARCH-SOLID-058) PERO dentro de los limites de ejecucion de Forge
(FORGE-OPS-005). Esto no es una contradiccion sino un constraint de plataforma.
