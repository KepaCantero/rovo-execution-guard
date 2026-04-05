# [RB-049] SOLID Principles (DigitalOcean) - SRP, OCP, LSP, ISP, DIP

> Fuente: SOLID Principles (DigitalOcean) - SRP, OCP, LSP, ISP, DIP

## Reglas

### ARCH-SOLID-049-01
**DEFINICION:** Cada modulo debe tener una unica razon para cambiar (SRP): los adapters manejan solo comunicacion externa, los services solo logica de negocio, y los repositories solo acceso a datos; ningun archivo puede importar de mas de una capa superior.
**VALOR:** La separacion de responsabilidades permite cambiar la implementacion de una capa sin afectar las demas y hace que cada archivo sea testeable de forma aislada con mocks simples.
**IMPLEMENTACION:** Estructura de directorios: `src/adapters/` (API calls), `src/services/` (business logic), `src/repositories/` (Forge Storage access), `src/handlers/` (HTTP/event routing). Regla de dependencia: `handlers -> services -> repositories`, `handlers -> adapters`. Un service nunca importa de un adapter directamente; usa interfaces.
**AUDITORIA:** Ralph verifica que ningun archivo de service importa directamente de un adapter, que ningun repository contiene logica de negocio, y que los handlers solo orquestan llamadas a services.

### ARCH-SOLID-049-02
**DEFINICION:** Los services deben estar abiertos para extension pero cerrados para modificacion (OCP): usar el patron Strategy para variantes de scoring y el patron Factory para creacion de adaptadores, anadiendo nuevas variantes sin modificar codigo existente.
**VALOR:** El OCP permite anadir nuevos tipos de quality gate o nuevos adaptadores sin riesgo de romper los existentes, reduciendo el scope de testing de regresion.
**IMPLEMENTACION:** Definir `interface ScoringStrategy { calculate(data: ScoringData): ScoreResult }`. Implementar `WeightedScoringStrategy`, `RuleBasedScoringStrategy`. Seleccionar via factory: `const strategy = ScoringStrategyFactory.create(gateConfig.type)`. Para adaptadores: `interface ProviderAdapter { ... }` con implementaciones por provider.
**AUDITORIA:** Ralph verifica que no existen condicionales `if/switch` sobre tipos de adaptadores o estrategias en los services, y que nuevas variantes se anaden como nuevas clases que implementan la interfaz.

### ARCH-SOLID-049-03
**DEFINICION:** Las implementaciones de adaptadores deben ser sustituibles por sus interfaces sin alterar el comportamiento (LSP): `JiraAdapter` y `ConfluenceAdapter` deben ser reemplazables por mocks o fakes en tests sin cambiar el comportamiento del service.
**VALOR:** La sustituibilidad permite tests rapidos con fakes en desarrollo y tests de integracion con implementaciones reales en CI, sin duplicar logica de test.
**IMPLEMENTACION:** Definir `interface TicketProvider { getTicket(key: string): Promise<Ticket>; updateTicket(key: string, data: Partial<Ticket>): Promise<void> }`. Crear `FakeTicketProvider` para tests unitarios que retorna datos predefinidos. El service que usa `TicketProvider` no debe saber si usa la implementacion real o el fake.
**AUDITORIA:** Ralph verifica que cada adaptador tiene una interfaz y que existe al menos una implementacion fake para testing, y que el service no depende de metodos especificos de la implementacion.

### ARCH-SOLID-049-04
**DEFINICION:** Los clients de API externa deben definir interfaces especificas para cada consumidor (ISP): un servicio que solo lee issues no debe depender de metodos de escritura; crear interfaces `IssueReader` y `IssueWriter` segregadas.
**VALOR:** Las interfaces segregadas previenen que cambios en funcionalidades no utilizadas rompan consumidores y reducen el acoplamiento entre modulos.
**IMPLEMENTACION:** En vez de `interface JiraClient { getIssue, createIssue, updateIssue, deleteIssue, searchIssues, addComment, ... }`, crear: `interface IssueReader { getIssue(key: string): Promise<Issue>; searchIssues(query: string): Promise<Issue[]> }` y `interface IssueWriter { updateIssue(key: string, data: Partial<Issue>): Promise<void>; addComment(key: string, body: string): Promise<void> }`. Los services inyectan solo las interfaces que necesitan.
**AUDITORIA:** Ralph verifica que ningun servicio inyecta una interfaz que contiene metodos que no utiliza y que las interfaces de adaptadores no tienen mas de 5 metodos.

### ARCH-SOLID-049-05
**DEFINICION:** Las dependencias deben inyectarse por interfaz, no por implementacion concreta (DIP): los services reciben adaptadores y repositories via constructor o factory, nunca instancian dependencias directamente.
**VALOR:** La inyeccion de dependencias permite intercambiar implementaciones (real, mock, fake) sin modificar el consumidor, facilitando testing y evolucion independiente.
**IMPLEMENTACION:** Usar constructor injection: `class ScoringService { constructor(private readonly repo: QualityGateRepository, private readonly strategy: ScoringStrategy) {} }`. Crear con factory: `const service = new ScoringService(ForgeStorageRepository.create(), ScoringStrategyFactory.create(config.type))`. Nunca usar `new JiraAdapter()` dentro de un service.
**AUDITORIA:** Ralph verifica que ningun service contiene `new` de un adaptador o repositorio y que todas las dependencias se reciben via constructor o parametros de factory.
