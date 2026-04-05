# [RB-011] Data Privacy Guidelines

> Fuente: Shared Responsibility Model & Forge Security - https://developer.atlassian.com/platform/forge/security/

## Reglas

### SEC-PRIV-007

**DEFINICION:** La app no debe procesar ni almacenar categorias de datos sensibles (datos de salud, financieros, de menores de edad, biometricos) sin un Data Protection Impact Assessment (DPIA) documentado.

**VALOR:** Forge esta clasificado como un procesador de datos bajo GDPR. Datos de categorias especiales requieren consentimiento explicito y DPIA. Procesarlos sin evaluacion expone a la organizacion a multas de hasta el 4% de la facturacion global bajo GDPR Art. 35.

**IMPLEMENTACION:** Antes de procesar datos de tickets que puedan contener informacion sensible, implementar filtros:
```typescript
const SENSITIVE_PATTERNS = [
  /\b\d{3}-\d{2}-\d{4}\b/,  // SSN
  /\b\d{16}\b/,              // Credit card
  /\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/,  // CPF (Brazil)
];

function containsSensitiveData(text: string): boolean {
  return SENSITIVE_PATTERNS.some(pattern => pattern.test(text));
}

// Si se detectan datos sensibles, sanitizar antes de procesar:
function sanitizeForAnalysis(text: string): string {
  return SENSITIVE_PATTERNS.reduce(
    (sanitized, pattern) => sanitized.replace(pattern, '[REDACTED]'),
    text
  );
}
```

**AUDITORIA:** Ralph verifica que exista un documento DPIA en `docs/compliance/` si la app procesa campos de Jira/Confluence que pueden contener PII. Verifica que las funciones de scoring/validacion apliquen sanitizacion antes de procesar texto.

---

### SEC-PRIV-008

**DEFINICION:** La app debe implementar data minimization: solo recopilar y retener los datos estrictamente necesarios para la funcion de consistency scoring.

**VALOR:** El principio de minimizacion de datos (GDPR Art. 5(1)(c)) requiere que solo se procesen los datos necesarios para el proposito declarado. Recopilar datos adicionales "por si acaso" viola este principio y incrementa la responsabilidad en caso de breach.

**IMPLEMENTACION:**
```typescript
// CORRECTO - solo campos necesarios para scoring:
async function extractRelevantFields(issue: JiraIssue): Promise<ScoreInput> {
  return {
    key: issue.key,
    summary: issue.fields.summary,
    description: extractTextFromADF(issue.fields.description),
    labels: issue.fields.labels,
    status: issue.fields.status?.name,
    // NO recopilar: assignee.email, comments completo, attachments, etc.
  };
}

// Definir retencion explicita:
const RETENTION_DAYS = 30;
const isExpired = (timestamp: number) =>
  Date.now() - timestamp > RETENTION_DAYS * 24 * 60 * 60 * 1000;
```

**AUDITORIA:** Ralph verifica que las llamadas a la API de Jira/Confluence usen el parametro `fields` para limitar los campos retornados. Verifica que los datos almacenados en Storage incluyan un campo `expiresAt` o `timestamp` para retencion.

---

### SEC-PRIV-009

**DEFINICION:** La app debe respetar el modelo de responsabilidad compartida: el desarrollador es responsable de la seguridad de la logica de la app, el cifrado de datos en transito y el manejo correcto de errores.

**VALOR:** Atlassian se encarga de la infraestructura (AWS Lambda, cifrado en reposo, red, fisico). El desarrollador debe encargarse de: validacion de inputs, cifrado de datos sensibles antes de enviarlos a APIs externas, manejo de errores que no exponga datos, y control de acceso a la app.

**IMPLEMENTACION:**
```typescript
// Responsabilidad del desarrollador:
// 1. Validar inputs
function validateInput(data: unknown): void {
  if (!data || typeof data !== 'object') throw new Error('Invalid input');
}

// 2. Cifrar datos sensibles antes de enviar a APIs externas
async function sendToGitHub(data: ReportData): Promise<void> {
  // No enviar PII a GitHub comments
  const sanitized = {
    score: data.score,
    violations: data.violations,
    // NO enviar: issue.description, user.email, etc.
  };
  await fetch('https://api.github.com/...', {
    method: 'POST',
    body: JSON.stringify(sanitized),
  });
}

// 3. Manejo de errores sanitizado
catch (error) {
  console.error('Error:', error.message);  // Log completo solo en Forge
  throw new Error('Processing failed');     // Error generico al caller
}
```

**AUDITORIA:** Ralph verifica que exista un documento en `docs/compliance/` que mapee las responsabilidades del modelo compartido. Verifica que los comentarios en PRs de GitHub no contengan datos de tickets de Jira (descripcion, comentarios), solo scores y violaciones.

---

### SEC-PRIV-010

**DEFINICION:** La app debe implementar un mecanismo de auditoria que registre quien (accountId) ejecuto que accion (accion), cuando (timestamp) y sobre que recurso (issueKey/PR URL).

**VALOR:** El registro de auditoria es un requisito de compliance (SOC 2, ISO 27001, GDPR Art. 30). Sin trazabilidad, es imposible investigar incidentes de seguridad o responder a solicitudes de derechos del titular de datos.

**IMPLEMENTACION:**
```typescript
interface AuditEntry {
  accountId: string;
  action: 'score_calculated' | 'pr_blocked' | 'pr_approved' | 'context_extracted';
  resource: string;
  timestamp: string;
  metadata?: Record<string, string | number>;
}

async function audit(entry: Omit<AuditEntry, 'timestamp'>): Promise<void> {
  const auditEntry: AuditEntry = {
    ...entry,
    timestamp: new Date().toISOString(),
  };
  await storage.set(
    `audit:${entry.accountId}:${Date.now()}`,
    auditEntry
  );
}
```

**AUDITORIA:** Ralph verifica que exista una funcion de auditoria centralizada y que sea llamada en cada punto de decision de la app (scoring, blocking, approving). Verifica que los entries incluyan accountId, action, resource y timestamp.
