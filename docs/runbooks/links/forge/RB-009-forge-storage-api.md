# [RB-009] Forge Storage API

> Fuente: Forge Storage API - https://developer.atlassian.com/platform/forge/storage/

## Reglas

### FORGE-OPS-012

**DEFINICION:** Los keys del key-value store deben tener un formato jerarquico usando separadores `:` (ej. `tenant:PRJ-123:score`) y no exceder 500 caracteres.

**VALOR:** Keys descriptivos y jerarquicos permiten queries eficientes con `storage.query()` usando prefijos. Keys sin estructura causan escaneos completos y dificultan la depuracion. El limite de 500 caracteres es un hard limit de la plataforma.

**IMPLEMENTACION:**
```typescript
import { storage } from '@forge/api';

// CORRECTO - key jerarquico:
const scoreKey = `score:${context.cloudId}:${issueKey}`;
await storage.set(scoreKey, { value: 87, timestamp: Date.now() });

// Query por prefijo:
const allScores = await storage.query()
  .where('key', 'startsWith', `score:${context.cloudId}:`)
  .limit(100)
  .getMany();

// INCORRECTO - key sin estructura:
// await storage.set('data', hugeObject);
```

**AUDITORIA:** Ralph verifica que todas las llamadas a `storage.set()` y `storage.setAsync()` usen keys con al menos un separador `:` y que el patron sea consistente dentro del modulo. Verifica que ningun key supere 500 caracteres.

---

### FORGE-OPS-013

**DEFINICION:** Los valores almacenados en Forge Storage no deben exceder 4 KB para el key-value store. Para datos mayores, usar el Entity Store con entidades custom.

**VALOR:** El key-value store esta disenado para datos pequenos (configuracion, flags, sesion). Almacenar objetos grandes causa errores de serializacion y degrada el rendimiento de lecturas. El Entity Store soporta entidades con multiples campos y indices.

**IMPLEMENTACION:**
```typescript
import { storage } from '@forge/api';

// Key-value store: solo datos pequenos
await storage.set('config:threshold', '85');

// Entity Store para datos complejos:
const entity = {
  issueKey: 'PRJ-123',
  score: 87,
  violations: ['missing-context', 'duplicate-detected'],
  evaluatedAt: new Date().toISOString(),
  // ... puede ser mas grande
};
// Usar storage entity API con entidades custom definidas en manifest
```

**AUDITORIA:** Ralph verifica que los valores pasados a `storage.set()` no sean objetos con mas de 10 campos anidados o arrays grandes. Si se detectan datos complejos, sugiere migrar al Entity Store.

---

### ARCH-SOLID-005

**DEFINICION:** El acceso a Forge Storage debe estar encapsulado en un repositorio (Data Access Layer), no esparcido en la logica de negocio.

**VALOR:** Encapsular el Storage en un repositorio permite cambiar la implementacion (ej. migrar de KV a Entity Store o a SQL) sin modificar la logica de negocio. Tambien centraliza el manejo de errores de Storage (throttling, serializacion).

**IMPLEMENTACION:**
```typescript
// repositories/score-repository.ts
export class ScoreRepository {
  private getKey(cloudId: string, issueKey: string): string {
    return `score:${cloudId}:${issueKey}`;
  }

  async getScore(cloudId: string, issueKey: string): Promise<ScoreData | null> {
    const key = this.getKey(cloudId, issueKey);
    return await storage.get(key);
  }

  async saveScore(cloudId: string, issueKey: string, data: ScoreData): Promise<void> {
    const key = this.getKey(cloudId, issueKey);
    await storage.set(key, data);
  }

  async getScoresByCloud(cloudId: string): Promise<ScoreData[]> {
    const results = await storage.query()
      .where('key', 'startsWith', `score:${cloudId}:`)
      .limit(100)
      .getMany();
    return results.map((r: any) => r.value);
  }
}
```

**AUDITORIA:** Ralph verifica que no existan llamadas directas a `storage.get()`, `storage.set()`, o `storage.query()` fuera de archivos en un directorio `repositories/` o `storage/`. Si encuentra una llamada directa en un handler o service, el check falla.

---

### FORGE-OPS-014

**DEFINICION:** La app debe implementar limpieza periodica de datos temporales en Storage usando scheduled triggers, aprovechando la ventana de 28 dias para datos eliminados accidentalmente.

**VALOR:** Sin limpieza, Storage crece hasta el limite de 100 MB y causa fallos de escritura. Los scheduled triggers permiten garbage collection automatico. La ventana de 28 dias de Atlassian para datos eliminados es el safety net.

**IMPLEMENTACION:**
```typescript
// manifest.yml:
// triggers:
//   - key: cleanup-storage
//     handler: cleanup.cleanupOldScores
//     schedule: '0 2 * * 0'  // Domingos a las 2 AM

// cleanup.ts:
import { storage } from '@forge/api';

export async function cleanupOldScores(): Promise<void> {
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const results = await storage.query()
    .where('key', 'startsWith', 'score:')
    .limit(100)
    .getMany();

  for (const result of results) {
    if (result.value?.timestamp && result.value.timestamp < thirtyDaysAgo) {
      await storage.delete(result.key);
    }
  }
}
```

**AUDITORIA:** Ralph verifica que exista al menos un scheduled trigger configurado para limpieza de Storage y que la funcion de limpieza elimine registros con antiguedad superior a un umbral configurable.
