# [RB-024] Husky Git Hooks

> Fuente: Husky Git Hooks

## Reglas

### GIT-CI-201
**DEFINICION:** El hook `pre-commit` debe ejecutar `lint-staged` configurado para ESLint con `--fix` y Prettier con `--write` unicamente sobre archivos staged; prohibido ejecutar lint sobre todo el proyecto.
**VALOR:** Ejecutar lint solo en archivos staged reduce el tiempo de commit de 30+ segundos a menos de 3 segundos, eliminando la friccion que lleva a los desarrolladores a usar `--no-verify`.
**IMPLEMENTACION:** En `.husky/pre-commit`:
```bash
npx lint-staged
```
En `package.json` o `.lintstagedrc.json`:
```json
{
  "*.{ts,tsx}": ["eslint --fix", "prettier --write"],
  "*.{json,md}": ["prettier --write"]
}
```
**AUDITORIA:** Ralph verifica que `.husky/pre-commit` exista, contenga `npx lint-staged`, y que `lint-staged` este configurado con los comandos de ESLint y Prettier.

### GIT-CI-202
**DEFINICION:** El hook `pre-push` debe ejecutar la suite de tests unitarios con `jest --changedSince=origin/main --coverage --passWithNoTests` y fallar si cualquier umbral de cobertura no se cumple.
**VALOR:** Ejecutar solo tests afectados por los cambios (vs. toda la suite) mantiene el feedback rapido (<30s) mientras asegura que codigo nuevo no baje la cobertura bajo los umbrales definidos.
**IMPLEMENTACION:** En `.husky/pre-push`:
```bash
npx jest --changedSince=origin/main --coverage --passWithNoTests
```
Esto ejecuta solo tests relacionados con commits nuevos desde main. El flag `--coverage` activa la verificacion contra `coverageThreshold`.
**AUDITORIA:** Ralph verifica que `.husky/pre-push` exista, contenga el comando `jest` con `--coverage`, y que no ejecute tests E2E (playwright) dentro del hook.

### GIT-CI-203
**DEFINICION:** Los hooks de Husky deben ser instalados automaticamente via el script `prepare` en `package.json` con `"prepare": "husky"` para que `npm install` los configure sin pasos manuales.
**VALOR:** Sin instalacion automatica, los desarrolladores nuevos clonan el repo y su primer commit salta los hooks, introduciendo codigo no verificado.
**IMPLEMENTACION:** En `package.json`:
```json
{ "scripts": { "prepare": "husky" } }
```
El directorio `.husky/` debe estar versionado en git con los archivos de hook (`pre-commit`, `pre-push`, `commit-msg`).
**AUDITORIA:** Ralph verifica que `package.json` contenga `"prepare": "husky"` y que `.husky/` este versionado (no este en `.gitignore`).

### GIT-CI-204
**DEFINICION:** Prohibido usar `--no-verify` o `git commit --no-verify` en cualquier flujo de trabajo documentado; cualquier bypass de hooks debe requerir aprobacion de un segundo desarrollador.
**VALOR:** `--no-verify` existe como escape hatch para emergencias, pero normalizar su uso elimina la efectividad de los hooks y permite que codigo no verificado entre a la rama principal.
**IMPLEMENTACION:** Agregar en la guia de contribucion que `--no-verify` requiere justificacion escrita en el PR. Configurar la pipeline de CI para ejecutar las mismas validaciones que los hooks (lint + test) como segunda linea de defensa.
**AUDITORIA:** Ralph no puede auditar uso local de `--no-verify`, pero verifica que los workflows de CI (`.github/workflows/`) ejecuten lint y tests como respaldo de los hooks locales.

### GIT-CI-205
**DEFINICION:** El hook `commit-msg` debe invocar `commitlint` con la configuracion extendida de conventional commits y reglas de scope del proyecto; este hook es el unico responsable de validar el formato del mensaje.
**VALOR:** Centralizar la validacion del mensaje en `commit-msg` (en lugar de `pre-commit`) garantiza que el check se ejecuta exactamente cuando se crea el mensaje, no antes ni despues.
**IMPLEMENTACION:** En `.husky/commit-msg`:
```bash
npx --no -- commitlint --edit "$1"
```
Configurar `commitlint.config.ts` con `extends: ['@commitlint/config-conventional']` y reglas de scope personalizadas.
**AUDITORIA:** Ralph verifica que `.husky/commit-msg` exista, contenga `commitlint --edit`, y que `commitlint.config.ts` este configurado con conventional commits.
