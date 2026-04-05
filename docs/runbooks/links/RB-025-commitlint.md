# [RB-025] Commitlint

> Fuente: Commitlint

## Reglas

### GIT-CI-211
**DEFINICION:** Todo commit message debe seguir el formato Conventional Commits: `type(scope): descripcion` donde type es uno de `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`.
**VALOR:** Los conventional commits permiten generar changelogs automaticos, determinar el proximo versionado semver (feat = minor, fix = patch, feat con BREAKING CHANGE = major), y filtrar historial por tipo de cambio.
**IMPLEMENTACION:** En `commitlint.config.ts`:
```typescript
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [2, 'always', ['feat','fix','docs','style','refactor','perf','test','build','ci','chore','revert']],
  },
};
```
Ejemplo valido: `feat(scoring): add weighted penalty for missing tests`
**AUDITORIA:** Ralph verifica que `commitlint.config.ts` extienda `@commitlint/config-conventional` y que los ultimos commits en git log cumplan el formato.

### GIT-CI-212
**DEFINICION:** El scope del commit debe corresponder a un modulo valido del proyecto: `domain`, `scoring`, `inconsistency`, `jira`, `rovo`, `github`, `confluence`, `forge`, `ui`, `api`, `config`, `ci`, `deps`, `docs`.
**VALOR:** Los scopes validos permiten filtrar changelogs por modulo, facilitan code reviews por area de dominio, y evitan scopes genericos que no aportan informacion.
**IMPLEMENTACION:** En `commitlint.config.ts` agregar:
```typescript
'scope-enum': [2, 'always', [
  'domain', 'scoring', 'inconsistency', 'jira', 'rovo',
  'github', 'confluence', 'forge', 'ui', 'api', 'config',
  'ci', 'deps', 'docs'
]],
'scope-case': [2, 'always', 'lower-case'],
```
**AUDITORIA:** Ralph busca en `commitlint.config.ts` la regla `scope-enum` y verifica que la lista de scopes este sincronizada con la estructura de directorios en `src/`.

### GIT-CI-213
**DEFINICION:** La descripcion del commit debe contener un ID de Jira en formato `PROJECTKEY-NNN` cuando el scope es un modulo funcional (`feat`, `fix`, `refactor`, `perf`); los commits de infraestructura (`ci`, `chore`, `build`, `deps`) estan exentos.
**VALOR:** El ID de Jira crea trazabilidad automatica entre el ticket de trabajo y el cambio en codigo, habilitando auditorias y reportes de coverage de tickets.
**IMPLEMENTACION:** En `commitlint.config.ts`:
```typescript
'references-empty': [2, 'never', (parsed) => {
  const infraTypes = ['ci', 'chore', 'build', 'deps', 'docs'];
  if (infraTypes.includes(parsed.type)) return [true];
  return [false];
}],
'footer-max-line-length': [2, 'always', 100],
```
Ejemplo: `feat(scoring): add penalty calculation RG-1234`
**AUDITORIA:** Ralph verifica que commits funcionales recientes (type `feat|fix|refactor|perf`) contengan un patron `RG-\d{4}` o el project key configurado en la descripcion o footer.

### GIT-CI-214
**DEFINICION:** La linea de asunto (subject) del commit no debe exceder 72 caracteres y la linea en blanco entre subject y body es obligatoria si el body existe.
**VALOR:** GitHub y GitLab truncan mensajes largos en la UI. 72 caracteres es el limite universal que mantiene la legibilidad en `git log --oneline`, GitHub, y terminales sin wrap.
**IMPLEMENTACION:** En `commitlint.config.ts`:
```typescript
'subject-max-length': [2, 'always', 72],
'body-leading-blank': [2, 'always'],
'header-max-length': [2, 'always', 72],
```
Usar `git commit` sin `-m` para mensajes con body (abre editor) o usar multiples `-m`: `git commit -m "subject" -m "body paragraph"`.
**AUDITORIA:** Ralph verifica las reglas `subject-max-length` y `header-max-length` en `commitlint.config.ts` y reporta commits recientes que excedan 72 caracteres.

### GIT-CI-215
**DEFINICION:** Prohibido usar `BREAKING CHANGE!` sin un body que describa (1) que cambia, (2) por que, y (3) como migrar; el footer `BREAKING CHANGE:` debe incluir instrucciones de migracion.
**VALOR:** Un breaking change sin contexto obliga a consumidores a leer el diff completo para entender el impacto. Las instrucciones de migracion reducen el tiempo de adaptacion de horas a minutos.
**IMPLEMENTACION:** Formato requerido:
```
feat(api)!: change scoring response structure

BREAKING CHANGE: scoring endpoint now returns { data: ScoringResult }
instead of ScoringResult directly.

Migration: wrap existing response handlers in { data: ... }
```
En `commitlint.config.ts` no se necesita regla adicional; esto se audita manualmente en PR review.
**AUDITORIA:** Ralph busca commits con `BREAKING CHANGE` en el mensaje y verifica que tengan al menos 3 lineas de body describiendo el cambio y la migracion.
