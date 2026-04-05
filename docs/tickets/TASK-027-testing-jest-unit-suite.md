# TASK-027: Testing - Jest Unit Test Suite

## Objetivo
Configurar Jest y escribir la suite completa de tests unitarios para todas las capas del dominio y utilidades, alcanzando >90% de cobertura en la capa de dominio y >85% global.

## Contexto
Los tests unitarios son la base de la piramide de testing. Cada modulo de dominio y utilidad debe tener tests exhaustivos que validen su comportamiento.

## Especificacion Tecnica

### Ubicacion
`tests/unit/` (espejo de `src/backend/`)

### Configuracion Jest (`jest.config.js`)
```javascript
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/tests/unit', '<rootDir>/src'],
  testMatch: ['**/*.spec.ts', '**/*.test.ts'],
  collectCoverageFrom: [
    'src/backend/**/*.ts',
    '!src/backend/types/**',
    '!**/node_modules/**',
    '!**/*.d.ts',
  ],
  coverageThresholds: {
    global: { branches: 85, functions: 85, lines: 85, statements: 85 },
    'src/backend/services/scoring/': {
      branches: 90, functions: 90, lines: 90, statements: 90,
    },
  },
  moduleNameMapper: {
    '@domain/(.*)': '<rootDir>/src/backend/$1',
    '@services/(.*)': '<rootDir>/src/backend/services/$1',
  },
  transform: { '^.+\\.tsx?$': 'ts-jest' },
};
```

### Tests a escribir (por modulo)

#### `tests/unit/services/scoring/scoring-engine.spec.ts`
- `calculateScore` con datos completos -> score correcto
- `calculateScore` con datos parciales -> score parcial
- `calculateScore` con datos invalidos -> error
- `evaluateQualityGate` Gate 1 score >= threshold -> pass
- `evaluateQualityGate` Gate 1 score < threshold -> fail
- `evaluateQualityGate` Gate 2 con inconsistencias criticas -> fail
- Pesos configurables

#### `tests/unit/services/scoring/inconsistency-detector.spec.ts`
- Detectar contradiccion
- Detectar duplicado
- Detectar missing context
- Detectar ambiguedad
- Clasificacion de severidad
- Generacion de sugerencias

#### `tests/unit/utils/resilience.spec.ts`
- `withTimeout` con exito
- `withTimeout` con timeout -> TimeoutError
- `retryWithBackoff` reintenta en error transitorio
- `retryWithBackoff` no reintenta en error permanente
- `createCircuitBreaker` abre circuito tras N fallos
- `createCircuitBreaker` cierra circuito tras reset
- `isTransientError` clasificacion

#### `tests/unit/utils/logger.spec.ts`
- Formato JSON correcto
- Nivel configurable
- Filtrado de datos sensibles
- Propagacion de executionId

#### `tests/unit/services/jira/*.spec.ts`
- Mock de `@forge/api`
- Test de cada funcion del adapter

#### `tests/unit/services/github/*.spec.ts`
- Mock de GitHub API
- Test de status checks, comentarios, extraccion de keys

#### `tests/unit/services/rovo/*.spec.ts`
- Mock de Rovo API
- Test de busqueda de contexto, fallback

### npm scripts
- `test:unit`: `jest --coverage`
- `test:unit:watch`: `jest --watch`
- `test:unit:ci`: `jest --ci --coverage --reporters=default`

## Acceptance Criteria
- [ ] AC-01: Jest configurado con TypeScript (ts-jest)
- [ ] AC-02: Cobertura > 90% en capa de dominio (scoring)
- [ ] AC-03: Cobertura > 85% global
- [ ] AC-04: Todos los modulos de dominio tienen tests
- [ ] AC-05: Todos los adapters tienen tests con mocks
- [ ] AC-06: Utilidades (resilience, logger) con cobertura > 90%
- [ ] AC-07: `npm run test:unit` pasa sin errores
- [ ] AC-08: Coverage report generado en `coverage/`

## Reglas del Rulebook
- **[TEST-QA-001]**: Cobertura > 90% en dominio
- **[TEST-QA-002]**: Cobertura > 85% global
- **[TEST-QA-003]**: Tests independientes y repetibles

## Estrategia de Test
- N/A (es la tarea de tests)

## Dependencias
- TASK-006 (scoring engine)
- TASK-007 (inconsistency detector)
- TASK-013 (resilience)
- TASK-021 (logger)
- TASK-009, TASK-010, TASK-011 (adapters)

## Estado: PENDIENTE
