# [RB-099] Artificial Intelligence: A Modern Approach

> Libro: Stuart Russell & Peter Norvig - Artificial Intelligence: A Modern Approach

## Reglas

### ROVO-INTEG-0991
**DEFINICION:** El sistema de deteccion de inconsistencias debe modelarse como un agente inteligente con percepciones (datos del ticket, contexto de Rovo), una funcion de utilidad (precision de deteccion), y acciones (reportar inconsistencia, descartar falso positivo, solicitar mas contexto).
**VALOR:** Russell y Norvig definen los agentes inteligentes por su funcion de utilidad. El detector de inconsistencias no es solo un filtro booleano sino un agente que busca maximizar la utilidad (detecciones correctas) minimizando el costo (falsos positivos). Esto da un marco para mejorarlo sistematicamente.
**IMPLEMENTACION:** Modelar cada detector como un agente con interfaz `InconsistencyAgent { perceive(context: TicketContext): Observation; decide(observation: Observation): AgentAction; act(action: AgentAction): InconsistencyResult; }`. La funcion de utilidad se define como `utility = true_positives - (false_positives * false_positive_penalty)`. Los pesos se ajustan para maximizar la utilidad.
**AUDITORIA:** Ralph verifica que cada detector de inconsistencias modele su logica de decision como una funcion de utilidad medible y que la utilidad se reporte en el admin dashboard.

### ARCH-SOLID-0992
**DEFINICION:** La busqueda de contexto relevante en Confluence (via Rovo) debe usar un algoritmo de busqueda informada (heuristic search) que priorice documentos relacionados con el proyecto y epic del ticket, no una busqueda lineal de todo el espacio.
**VALOR:** La busqueda exhaustiva en todo Confluence es O(n) y lenta. Una busqueda informada que empieza por los documentos del proyecto del ticket y expande gradualmente es mas eficiente y produce resultados mas relevantes. Russell demuestra que la informacion heuristica reduce drasticamente el espacio de busqueda.
**IMPLEMENTACION:** Implementar `HeuristicContextSearch` en `src/backend/integration/rovo/search/`. Heuristicas: 1) documentos del mismo espacio de Confluence del proyecto (peso 1.0), 2) documentos vinculados al epic del ticket (peso 0.8), 3) documentos mencionados en tickets relacionados (peso 0.5). Buscar primero con peso alto, expandir solo si el contexto es insuficiente. Limite de 10 documentos por busqueda.
**AUDITORIA:** Ralph verifica que la busqueda de contexto use heuristicas de prioridad y que no busque exhaustivamente en todo Confluence para cada ticket.

### TEST-QA-0993
**DEFINICION:** El rendimiento del detector de inconsistencias debe medirse con metricas de information retrieval: precision, recall, y F1-score, usando un dataset etiquetado de tickets con inconsistencias conocidas.
**VALOR:** Russell y Norvig usan precision/recall/F1 como metricas estandar para sistemas de busqueda y clasificacion. Si el detector tiene alta precision pero bajo recall, pierde inconsistencias reales. Si tiene alto recall pero baja precision, genera ruido. El F1-score balancea ambas.
**IMPLEMENTACION:** Crear dataset etiquetado en `tests/fixtures/evaluation/` con 200 tickets: 100 con inconsistencias conocidas y 100 sin inconsistencias. Ejecutar los detectores sobre el dataset y calcular: `precision = TP / (TP + FP)`, `recall = TP / (TP + FN)`, `F1 = 2 * precision * recall / (precision + recall)`. Meta: F1 >= 0.85. Los resultados se reportan en CI como artefacto.
**AUDITORIA:** Ralph verifica que el F1-score del sistema de deteccion sea >= 0.85 y que el dataset de evaluacion este balanceado y actualizado.

### FORGE-OPS-0994
**DEFINICION:** El razonamiento del sistema sobre un ticket (evaluacion de reglas, deteccion de inconsistencias) debe ser completamente trazeable: cada paso de la cadena de razonamiento se registra como un nodo en un arbol de decision auditable.
**VALOR:** Russell y Norvig enfatizan que los agentes inteligentes deben poder explicar sus decisiones. Un sistema que dice "ticket bloqueado" sin explicar el arbol de razonamiento es una caja negra. La trazabilidad permite auditar y mejorar el sistema.
**IMPLEMENTACION:** Cada evaluacion genera un `ReasoningTree` con formato: `{ root: { type: 'validation', children: [{ type: 'rule', id: 'hasAcceptanceCriteria', result: 'pass', evidence: '...' }, { type: 'rule', id: 'rovoConsistency', result: 'fail', evidence: '...' }] } }`. El arbol se almacena en Forge Storage con el score. El modo debug de la UI puede renderizar este arbol visualmente.
**AUDITORIA:** Ralph verifica que cada score generado tenga su arbol de razonamiento asociado y que el arbol contenga todos los pasos de la evaluacion.

### ROVO-INTEG-0995
**DEFINICION:** El sistema debe implementar un modelo de "agente con objetivos" donde el objetivo principal es maximizar la calidad de los tickets que pasan los quality gates, medido por la reduccion de rework post-entrega.
**VALOR:** Un agente que optimiza por "maximo numero de tickets aprobados" aprobara todo. Un agente que optimiza por "maximo numero de tickets bloqueados" bloqueara todo. El objetivo correcto es "maximizar la calidad de tickets aprobados", que se mide por la reduccion de rework despues de la entrega.
**IMPLEMENTACION:** Definir la funcion objetivo como `objective = approved_tickets_without_rework / total_approved_tickets`. Medir rework como: tickets que se reabren dentro de 7 dias de cerrados, PRs que se revierten dentro de 7 dias de mergeados, o tickets con comentarios de confusion post-entrega. El sistema reporta esta metrica semanalmente y los ajustes a reglas se evaluan contra este objetivo.
**AUDITORIA:** Ralph verifica que la metrica de rework post-entrega se calcule semanalmente y que los ajustes al scoring engine se evaluen contra esta metrica.
