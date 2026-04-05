# TASK-013: Integration Layer - Resilience (Circuit Breaker, Retry, AbortController)

## Objetivo
Implementar los patrones de resiliencia que usaran todos los adapters: Circuit Breaker, Exponential Backoff, AbortController para timeouts y manejo centralizado de reintentos.

## Contexto
Todos los adapters (Jira, Confluence, Rovo, GitHub) dependen de este modulo de resiliencia. Debe ser generico y reutilizable.

## Especificacion Tecnica

### Ubicacion
`src/backend/utils/` o `src/backend/middleware/`

### Componentes

#### AbortController wrapper (`withTimeout`)
```typescript
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T>
```
- Timeout por defecto: 10 segundos (limite Forge)
- Aborta la operacion y lanza `TimeoutError`

#### Exponential Backoff (`retryWithBackoff`)
```typescript
function retryWithBackoff<T>(fn: () => Promise<T>, options: RetryOptions): Promise<T>
```
- `maxRetries`: 3 (default)
- `baseDelay`: 1000ms (default)
- `maxDelay`: 10000ms
- Backoff: delay * 2^attempt + jitter
- Solo reintentar en errores transitorios (429, 500, 502, 503, 504)

#### Circuit Breaker (`createCircuitBreaker`)
```typescript
function createCircuitBreaker(options: CircuitBreakerOptions): CircuitBreaker
```
- Estados: `closed`, `open`, `half-open`
- `failureThreshold`: 5 fallos consecutivos abre el circuito
- `resetTimeout`: 30 segundos antes de half-open
- En estado `open`: lanza `CircuitOpenError` inmediatamente

#### Error classification (`isTransientError`)
```typescript
function isTransientError(error: unknown): boolean
```
- Clasifica errores como transitorios o permanentes
- Transitorios: timeout, rate limit (429), server errors (5xx), network errors
- Permanentes: 401, 403, 404, 400

### Tipos de error
- `TimeoutError`: Operacion excedio el tiempo limite
- `CircuitOpenError`: Circuit breaker abierto
- `MaxRetriesExceededError`: Todos los reintentos fallaron

## Acceptance Criteria
- [ ] AC-01: `withTimeout` aborta operaciones que exceden el timeout
- [ ] AC-02: `retryWithBackoff` reintenta con backoff exponencial + jitter
- [ ] AC-03: `createCircuitBreaker` abre/cierra circuito correctamente
- [ ] AC-04: `isTransientError` clasifica errores correctamente
- [ ] AC-05: No se reintentan errores permanentes (401, 403, 404)
- [ ] AC-06: Logging estructurado en cada reintento y cambio de estado
- [ ] AC-07: Zero dependencias externas
- [ ] AC-08: Cobertura de tests unitarios > 95%
- [ ] AC-09: Archivo `.reqs.md` sidecar creado

## Reglas del Rulebook
- **[FORGE-OPS-001]**: Timeout maximo 10s (limite Forge)
- **[ARCH-SOLID-004]**: Patrones de resiliencia centralizados y reutilizables
- **[TEST-QA-001]**: Cobertura > 90% en utilidades criticas

## Estrategia de Test
- **Unit**: Tests exhaustivos de cada patron con timers mock
- **Integration**: Verificar interaccion entre retry + circuit breaker
- **E2E**: N/A

## Dependencias
- TASK-005 (tipos de error custom)

## Estado: PENDIENTE
