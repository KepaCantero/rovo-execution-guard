# [RB-061] Introduction to Algorithms

> Libro: Thomas H. Cormen, Charles E. Leiserson, Ronald L. Rivest, Clifford Stein - Introduction to Algorithms (CLRS)

## Reglas

### FORGE-OPS-058
**DEFINICION:** Ningun algoritmo de calculo de Consistency Score o deteccion de inconsistencias debe tener complejidad peor que O(n log n) donde n es el numero de elementos de contexto consultados desde Rovo.
**VALOR:** Forge impone un limite estricto de 25 segundos por ejecucion de resolver. Si el algoritmo de scoring escala cuadraticamente con el numero de tickets historicos consultados, un proyecto grande con miles de tickets causara timeouts.
**IMPLEMENTACION:** El calculo del score debe usar busqueda binaria en listas ordenadas, hash maps para lookup de duplicados, y evitar bucles anidados sobre colecciones de contexto. Si se necesita comparar N tickets contra M documentos de Confluence, usar estructuras indexadas en vez de doble iteracion.
**AUDITORIA:** Ralph analiza la complejidad ciclomatica y temporal de las funciones en `/services/scoring/` y rechaza implementaciones con bucles anidados sin justificacion documentada.

### FORGE-OPS-059
**DEFINICION:** Las operaciones de busqueda y filtrado sobre resultados de Rovo deben usar estructuras de datos indexadas (Map, Set) en vez de busqueda lineal sobre arrays.
**VALOR:** Buscar si un ticket ya fue evaluado usando `Array.find()` sobre una lista de miles de resultados de Rovo es O(n). Con un `Map<string, ValidationRecord>` es O(1), lo que reduce la latencia del trigger de Forge.
**IMPLEMENTACION:** Transformar las respuestas de Rovo en Maps indexados por clave de dominio: `new Map(entries.map(e => [e.issueKey, e]))`. Usar `Set` para deteccion rapida de duplicados. Evitar `filter` + `find` encadenados sobre colecciones grandes.
**AUDITORIA:** Ralph busca patrones de `Array.find()` o `Array.filter().find()` en bucles y sugiere reemplazo con estructuras indexadas.

### ARCH-SOLID-067
**DEFINICION:** Toda funcion de dominio que procese colecciones de inconsistencias debe tener documentada su complejidad temporal esperada en el archivo `.reqs.md` correspondiente.
**VALOR:** Conocer la complejidad permite predecir el comportamiento del sistema cuando un proyecto tiene 10 tickets vs 1000 tickets, y tomar decisiones informadas sobre la viabilidad de las operaciones dentro del timeout de Forge.
**IMPLEMENTACION:** En cada archivo `.reqs.md` de funciones de scoring, incluir una seccion "Complejidad" que especifique: `O(n)` para validacion lineal, `O(n log n)` para scoring con ordenamiento, `O(1)` para lookup indexado. Ralph verifica que la complejidad documentada coincida con la implementacion real.
**AUDITORIA:** Ralph compara la complejidad documentada en el `.reqs.md` contra el analisis estatico del codigo y marca discrepancias.
