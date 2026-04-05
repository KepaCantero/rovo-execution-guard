# [RB-032] Twelve-Factor App

> Fuente: Twelve-Factor App

## Reglas

### ARCH-SOLID-251
**DEFINICION:** Toda configuracion que varie entre entornos (desarrollo, staging, produccion) debe leerse de variables de entorno (`process.env`); prohibido usar archivos de configuracion hardcodeados o constantes en codigo para valores que cambian por entorno.
**VALOR:** La configuracion en entorno (no en codigo) permite desplegar el mismo build en cualquier entorno sin recompilar. Facilita el rotation de secretos, el despliegue en multiples regiones, y elimina el riesgo de commitar configuracion de produccion en el repositorio.
**IMPLEMENTACION:**
```typescript
// config.ts - capa de configuracion centralizada
const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  jira: {
    apiUrl: process.env.JIRA_API_URL ?? 'https://api.atlassian.com',
    timeout: parseInt(process.env.JIRA_TIMEOUT_MS || '5000', 10),
  },
  scoring: {
    defaultThreshold: parseInt(process.env.SCORING_THRESHOLD || '80', 10),
  },
} as const;

// Validar al arrancar
function validateConfig(): void {
  const required = ['JIRA_API_URL', 'GITHUB_TOKEN'];
  const missing = required.filter(key => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required env vars: ${missing.join(', ')}`);
  }
}
```
Usar `.env.example` versionado con los nombres de variables (sin valores reales).
**AUDITORIA:** Ralph verifica que no existan URLs, puertos, o tokens hardcodeados en archivos de configuracion que no sean `.env.example`, y que exista un `.env.example` con todas las variables requeridas documentadas.

### ARCH-SOLID-252
**DEFINICION:** La aplicacion debe ser stateless: toda la sesion y estado debe almacenarse en un backing store (Redis, Forge Storage, base de datos); prohibido depender de estado en memoria local que se pierde entre requests o invocaciones.
**VALOR:** Las funciones serverless (como Forge) se invocan en contenedores efimeros que pueden ser reciclados en cualquier momento. El estado en memoria local se pierde sin previo aviso. Ademas, el stateless permite escalado horizontal sin sticky sessions.
**IMPLEMENTACION:**
```typescript
// Correcto: estado en backing store
async function getSession(sessionId: string): Promise<Session> {
  const raw = await forgeStorage.get(`session:${sessionId}`);
  return JSON.parse(raw);
}

// Prohibido: estado en memoria global
const sessionCache = new Map<string, Session>(); // Se pierde al reciclar
```
Es aceptable cachear en memoria con TTL como optimizacion (read-through cache) siempre que la fuente de verdad sea el backing store.
**AUDITORIA:** Ralph busca variables globales mutables (Map, Set, objetos literales fuera de funciones) que actuen como store de estado y verifica que sean caches con backing store, no fuentes de verdad.

### ARCH-SOLID-253
**DEFINICION:** Los procesos deben ser disposables: deben poder ser iniciados y detenidos en cualquier momento sin corrupcion de datos; implementar graceful shutdown que complete requests en vuelo, cierre conexiones, y flush logs antes de terminar.
**VALOR:** En entornos orquestados (Kubernetes, Forge), los procesos son terminados sin aviso. Sin graceful shutdown, un request en vuelo se corta a la mitad, dejando datos en estado inconsistente.
**IMPLEMENTACION:**
```typescript
const server = app.listen(port);

function gracefulShutdown(signal: string): void {
  logger.info(`Received ${signal}, shutting down gracefully...`);
  server.close(() => {
    logger.info('All connections closed');
    process.exit(0);
  });
  // Timeout de seguridad: forzar salida despues de 10s
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
```
En Forge Functions, usar el lifecycle hook `onDispose` para limpieza.
**AUDITORIA:** Ralph verifica que la aplicacion registre handlers para `SIGTERM` y `SIGINT`, que exista un `server.close()` o equivalente, y que el timeout de fuerza no exceda 15 segundos.

### ARCH-SOLID-254
**DEFINICION:** Separar la aplicacion en procesos con responsabilidad unica: proceso web para HTTP, proceso worker para jobs en background, proceso scheduler para tareas periodicas; cada tipo de proceso escala independientemente.
**VALOR:** Un proceso monolitico que sirve HTTP y ejecuta jobs pesados se bloquea bajo carga. Separarlos permite escalar los workers sin escalar el web server, y aisla fallos: un worker que crashea por OOM no afecta las peticiones HTTP.
**IMPLEMENTACION:** En Forge, esta separacion es natural: cada Function es un proceso independiente. Para el backend complementario:
```typescript
// web.ts - solo HTTP
app.listen(port);

// worker.ts - solo procesamiento en background
queue.process('scoring', async (job) => {
  return calculateScore(job.data);
});
```
En `package.json` scripts: `"start:web"`, `"start:worker"`, `"start:scheduler"`.
**AUDITORIA:** Ralph verifica que la aplicacion no mezcle procesamiento CPU-intensivo en el mismo proceso que sirve HTTP requests, y que exista separacion clara entre entry points de web y worker.

### ARCH-SOLID-255
**DEFINICION:** Los logs deben ser tratados como event streams: escribir en stdout/stderr en formato JSON estructurado; prohibido escribir logs a archivos, usar formato no parseable, o incluir datos sensibles en el output.
**VALOR:** Los logs en archivos requieren rotacion, limpieza y acceso al filesystem. Los logs en stdout son consumidos automaticamente por la plataforma (Forge, CloudWatch, Datadog). El formato JSON permite busqueda estructurada y alertas basadas en campos.
**IMPLEMENTACION:**
```typescript
import { logger } from './logger';

// Correcto: JSON estructurado a stdout
logger.info('Scoring completed', {
  ticketId: 'RG-1234',
  score: 85,
  threshold: 80,
  durationMs: 234,
});

// Prohibido
console.log('Score is ' + score + ' for ticket ' + ticketId);
fs.appendFileSync('app.log', `Score: ${score}\n`);
```
Configurar el logger (pino, winston) con transport a stdout en JSON con `severity`, `timestamp`, `message`, y `context` fields.
**AUDITORIA:** Ralph verifica que el logger este configurado con JSON transport a stdout, que no existan `fs.appendFileSync` ni `fs.createWriteStream` para logs, y que no se usen `console.log` para logging de produccion.
