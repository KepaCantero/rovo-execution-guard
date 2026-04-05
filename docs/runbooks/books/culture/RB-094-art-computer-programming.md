# [RB-094] The Art of Computer Programming

> Libro: Donald Knuth - The Art of Computer Programming

## Reglas

### ARCH-SOLID-0941
**DEFINICION:** Los algoritmos criticos del scoring engine (calculos de score ponderado, deteccion de inconsistencias por similitud de texto, merge de senales) deben documentar su complejidad temporal y espacial con notacion Big-O.
**VALOR:** Knuth exige rigor algoritmico. En un Forge app con limites de ejecucion de 25 segundos, la complejidad del scoring no puede ser una sorpresa. Si el scoring es O(n^2) en el numero de reglas, escalara mal cuando se agreguen reglas.
**IMPLEMENTACION:** Cada funcion publica del scoring engine tiene un comentario JSDoc con `@complexity O(n)` o similar. Las funciones que procesan colecciones (evaluar reglas, comparar textos) deben ser O(n) o O(n log n), nunca O(n^2) o peor. Si un algoritmo O(n^2) es necesario, justificar por que n es pequeno y acotado.
**AUDITORIA:** Ralph verifica que cada funcion publica del dominio tenga su complejidad documentada y que ninguna funcion tenga complejidad peor que O(n log n) sin justificacion explicita.

### TEST-QA-0942
**DEFINICION:** Los tests del scoring engine deben incluir mediciones de rendimiento: cada regla de scoring debe ejecutarse en menos de 1ms, y el scoring completo de un ticket en menos de 50ms, medidos en el entorno de Forge.
**VALOR:** El rendimiento no es accidental, se disena. Si una regla de scoring toma 100ms, 20 reglas tomaran 2 segundos. Knuth demostro que la eficiencia se logra midiendo, no adivinando. Los benchmarks previenen regresiones de rendimiento.
**IMPLEMENTACION:** Crear `tests/benchmark/scoring.bench.ts` que mide el tiempo de cada regla y del scoring completo. Usar `performance.now()` con multiples iteraciones y reportar el percentil 95. Si alguna regla supera 1ms o el scoring completo supera 50ms, el test falla. Ejecutar benchmarks en CI como job separado (no bloquea merge pero genera alertas).
**AUDITORIA:** Ralph verifica que existan benchmarks para el scoring engine y que ninguna regla supere 1ms ni el scoring completo supere 50ms en P95.

### ROVO-INTEG-0943
**DEFINICION:** La deteccion de inconsistencias entre tickets y documentacion debe usar algoritmos de similitud de texto con umbrales calibrados empiricamente, no heuristicas arbitrarias.
**VALOR:** Knuth exige rigor en los algoritmos. Decir "el ticket contradice la documentacion" requiere un algoritmo preciso de comparacion, no un `includes()` casual. La precision del detector de inconsistencias es la base de la confianza del usuario en el enforcement.
**IMPLEMENTACION:** Implementar `TextSimilarityDetector` en `src/backend/domain/inconsistency/detectors/` usando Jaccard similarity o cosine similarity sobre tokens. El umbral de "inconsistencia" se calibra con un dataset de prueba: 50 pares de textos inconsistentes y 50 consistentes. El umbral se ajusta para maximizar F1-score. Documentar el umbral elegido y la calibracion en el codigo.
**AUDITORIA:** Ralph verifica que el detector de inconsistencias use un algoritmo de similitud definido (no heuristica), que el umbral este calibrado, y que la precision se mida y reporte.

### FORGE-OPS-0944
**DEFINICION:** Todas las operaciones de Forge Storage deben optimizar el numero de llamadas: batch reads en una unica llamada, y usar queries con prefijo para evitar escaneos completos.
**VALOR:** Forge Storage es un recurso limitado. Si el scoring engine hace 10 llamadas individuales para leer configuracion de cada regla, agrega 10 round-trips. Knuth optimizaria esto en una unica llamada batch.
**IMPLEMENTACION:** Almacenar configuracion de reglas como un unico objeto JSON en Forge Storage con clave `config:scoring:rules:{projectKey}`. Leer toda la configuracion en una llamada y cachear en memoria durante la ejecucion. Para queries de audit, usar `forge/storage.query().where('key', 'startsWith', 'audit:')` con limite de resultados, no cargar todo.
**AUDITORIA:** Ralph verifica que ninguna operacion de validacion haga mas de 3 llamadas a Forge Storage y que las configuraciones se lean en batch, no una por una.

### GIT-CI-0945
**DEFINICION:** Las optimizaciones de rendimiento deben basarse en mediciones (profiling), no en suposiciones. Ningun refactor "por rendimiento" se aprueba sin un benchmark antes y despues que demuestre la mejora.
**VALOR:** Knuth: "Premature optimization is the root of all evil." Optimizar sin medir es gastar tiempo en el lugar equivocado. Los unicos refactors de rendimiento validos son los que tienen datos que los respaldan.
**IMPLEMENTACION:** Si un PR incluye un refactor por rendimiento: 1) debe incluir un benchmark del codigo anterior, 2) un benchmark del codigo nuevo, 3) la mejora porcentual documentada en el PR, 4) justificacion de por que el rendimiento anterior era insuficiente. Sin estos datos, el PR se rechaza como "premature optimization".
**AUDITORIA:** Ralph verifica que cada PR etiquetado como "performance" tenga benchmarks antes/despues documentados y que la mejora sea medible (> 10%).
