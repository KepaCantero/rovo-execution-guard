# [RB-035] React 18 Best Practices

> Fuente: React 18 Best Practices

## Reglas

### UI-ADS-201
**DEFINICION:** Los hooks (`useState`, `useEffect`, `useCallback`, `useMemo`) solo pueden ser llamados en el nivel superior de un componente React o de un custom hook; prohibido llamar hooks dentro de condicionales, loops, o funciones anidadas.
**VALOR:** React depende del orden de llamada de hooks para mantener el estado entre renders. Si un hook se llama condicionalmente, el orden cambia entre renders, causando bugs de estado impredecibles y errores de hydration en SSR.
**IMPLEMENTACION:**
```typescript
// Correcto: hooks en nivel superior
function QualityGatePanel({ projectId }: Props) {
  const [score, setScore] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (projectId) {
      fetchScore(projectId).then(setScore).finally(() => setLoading(false));
    }
  }, [projectId]);

  return loading ? <Spinner /> : <ScoreDisplay score={score} />;
}

// Prohibido: hook en condicional
function BadComponent({ projectId }: Props) {
  if (projectId) {
    const [score, setScore] = useState(0); // VIOLACION
  }
}
```
Configurar `react-hooks/rules-of-hooks` en ESLint para deteccion automatica.
**AUDITORIA:** Ralph verifica que la regla ESLint `react-hooks/rules-of-hooks` este activa en `error` y que no existan hooks dentro de condicionales, loops, o funciones anidadas en componentes.

### UI-ADS-202
**DEFINICION:** Los componentes React deben separarse en dos categorias: (1) presentational (sin estado, solo props -> UI) y (2) container (con logica de negocio, hooks, data fetching); un componente no debe mezclar logica de negocio compleja con rendering JSX.
**VALOR:** La separacion presentational/container permite reutilizar componentes UI con diferentes fuentes de datos, facilita el testing (presentational components son funciones puras de props -> JSX), y reduce la complejidad cognitiva de cada archivo.
**IMPLEMENTACION:**
```typescript
// Presentational: sin estado, sin side effects
function ScoreBadge({ score, status }: { score: number; status: string }) {
  return <Badge appearance={status === 'pass' ? 'success' : 'important'}>{score}</Badge>;
}

// Container: logica, hooks, data fetching
function ScoreBadgeContainer({ projectId }: { projectId: string }) {
  const { data, isLoading } = useQuery(['score', projectId], () => fetchScore(projectId));
  if (isLoading) return <Spinner size="small" />;
  return <ScoreBadge score={data.score} status={data.status} />;
}
```
Los container components no deben tener mas de 3 hooks personalizados.
**AUDITORIA:** Ralph verifica que los componentes en `src/presentation/components/` no contengan llamadas a API o logica de negocio, y que los container components deleguen el rendering a componentes presentacionales.

### UI-ADS-203
**DEFINICION:** Memoizar componentes y valores solo cuando exista evidencia de rendimiento medible; prohibido envolver todos los componentes en `React.memo` o todos los valores en `useMemo` de forma preventiva.
**VALOR:** `React.memo` y `useMemo` tienen un costo de memoria y CPU (comparacion de props, almacenamiento del valor cacheado). Envolver todo preventivamente degrada el rendimiento inicial sin beneficio medible. React 18 con automatic batching ya optimiza muchos re-renders innecesarios.
**IMPLEMENTACION:** Aplicar memoization solo cuando:
1. El componente re-renderiza frecuentemente con las mismas props (medido con React DevTools Profiler).
2. El calculo es costoso (>5ms medido con `performance.now()`).
3. El componente es una lista grande (>50 items) con items complejos.
```typescript
// Correcto: memoizar solo si el profiler lo justifica
const ExpensiveScoringMatrix = React.memo(function ScoringMatrix({ rules }: Props) {
  // Renderizado medido >5ms con mismos rules
});

// Prohibido: memoizar todo por defecto
const SimpleLabel = React.memo(function Label({ text }: Props) { ... }); // Desnecesario
```
**AUDITORIA:** Ralph busca `React.memo`, `useMemo`, y `useCallback` en el codigo y verifica que exista un comentario documentando la razon de la memoization o que el componente pase los criterios de complejidad definidos.

### UI-ADS-204
**DEFINICION:** Toda propiedad de evento (`onClick`, `onChange`) pasada a componentes hijos debe ser estabilizada con `useCallback` si el hijo esta memoizado; de lo contrario, la memoization del hijo es ineficaz porque la funcion se recrea en cada render del padre.
**VALOR:** Las funciones en JavaScript se comparan por referencia. Si un componente hijo esta memoizado con `React.memo` pero recibe una nueva funcion en cada render del padre, la memoization nunca se activa porque las props son siempre diferentes.
**IMPLEMENTACION:**
```typescript
function ScoringRulesList({ rules }: Props) {
  // Correcto: estabilizar callback para hijo memoizado
  const handleRuleToggle = useCallback((ruleId: string) => {
    setRules(prev => prev.map(r => r.id === ruleId ? { ...r, enabled: !r.enabled } : r));
  }, []);

  return (
    <ul>
      {rules.map(rule => (
        <RuleItem key={rule.id} rule={rule} onToggle={handleRuleToggle} />
      ))}
    </ul>
  );
}
```
Si el hijo NO esta memoizado, `useCallback` no es necesario.
**AUDITORIA:** Ralph verifica que los componentes `React.memo` reciban callbacks estabilizados con `useCallback` y reporta cuando una funcion inline se pasa a un componente memoizado.

### UI-ADS-205
**DEFINICION:** Prohibido usar `useEffect` para sincronizar estado derivado; usar `useMemo` o computacion directa durante el render para valores que se calculan a partir de props o estado existente.
**VALOR:** Usar `useEffect` para estado derivado genera un render extra (render con valor viejo -> effect -> setState -> render con valor nuevo). La computacion directa durante el render produce el valor correcto en un solo render.
**IMPLEMENTACION:**
```typescript
// Prohibido: estado derivado con useEffect
function ScoringPanel({ rawScore }: Props) {
  const [grade, setGrade] = useState('');
  useEffect(() => {
    setGrade(rawScore >= 90 ? 'A' : rawScore >= 80 ? 'B' : 'C');
  }, [rawScore]); // Render extra innecesario
}

// Correcto: computacion directa durante render
function ScoringPanel({ rawScore }: Props) {
  const grade = rawScore >= 90 ? 'A' : rawScore >= 80 ? 'B' : 'C';
  return <div>Grade: {grade}</div>;
}

// Correcto: useMemo solo si el calculo es costoso
const expensiveResult = useMemo(() => complexCalculation(data), [data]);
```
**AUDITORIA:** Ralph busca patrones donde `useEffect` contiene un `setState` que deriva su valor enteramente de props o estado existente (sin async/await, sin side effects externos) y lo reporta como violacion.
