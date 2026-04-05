# [RB-006] Atlassian Design System

> Fuente: Atlassian Design System (ADS) - https://atlassian.design/

## Reglas

### UI-ADS-001

**DEFINICION:** Todo componente visual debe usar design tokens de Atlassian (`@atlaskit/tokens`) en lugar de valores hexadecimales, RGB o colores hardcodeados.

**VALOR:** Los design tokens garantizan consistencia visual, soporte para temas (light/dark), y accesibilidad. Hardcodear colores rompe el theming y puede causar problemas de contraste en modo oscuro. Los tokens son semanticos (ej. `color.text` en lugar de `#172B4D`).

**IMPLEMENTACION:**
```tsx
import { token } from '@atlaskit/tokens';

// CORRECTO:
<Box style={{ color: token('color.text'), backgroundColor: token('color.background.neutral') }}>
  Content
</Box>

// INCORRECTO:
<Box style={{ color: '#172B4D', backgroundColor: '#F4F5F7' }}>
  Content
</Box>
```

**AUDITORIA:** Ralph escanea archivos `.tsx`, `.jsx` y CSS en busca de valores hexadecimales (`#` seguido de 3-8 caracteres hex), funciones `rgb()` o `rgba()`, y nombres de colores CSS inline. Si encuentra alguno fuera de un archivo de temas, el check falla.

---

### UI-ADS-002

**DEFINICION:** Todo texto visible debe pasar los criterios WCAG 2.1 nivel AA: ratio de contraste minimo de 4.5:1 para texto normal y 3:1 para texto grande (18px+ o 14px+ bold).

**VALOR:** La accesibilidad no es opcional. Atlassian tiene usuarios con discapacidades visuales y cumple con regulaciones de accesibilidad (Section 508, EN 301 549). Usar tokens semanticos de ADS garantiza automaticamente el contraste correcto.

**IMPLEMENTACION:** Usar las combinaciones de tokens documentadas por ADS. Nunca mezclar tokens de foreground/background que no esten testeados. Para texto custom, verificar con herramientas como axe-core o el plugin de contraste del navegador.

**AUDITORIA:** Ralph verifica que no existan combinaciones de `color` y `backgroundColor` en el mismo elemento donde ambos sean valores hardcodeados (no tokens). Si se encuentran, sugiere reemplazar con tokens semanticos.

---

### UI-ADS-003

**DEFINICION:** La internacionalizacion (i18n) debe usar el componente `I18nProvider` de `@forge/react` o el framework i18n de ADS, nunca concatenar strings para formar mensajes.

**VALOR:** La concatenacion de strings rompe el orden de palabras en idiomas con diferente estructura gramatical (ej. japones, arabe). Usar ICU MessageFormat con placeholders permite que los traductores reordenen componentes del mensaje.

**IMPLEMENTACION:**
```tsx
import { I18nProvider } from '@forge/react';

// CORRECTO - con placeholders:
const messages = {
  'pr.status.check': 'PR #{number} status: {status}',
  'score.result': 'Consistency score: {score}%',
};

// INCORRECTO - concatenacion:
// const msg = `PR #${number} status: ${status}`;
```

**AUDITORIA:** Ralph escanea archivos TSX en busca de template literals que contengan texto visible junto a interpolaciones de variables (`${var}`), sin estar envueltas en una funcion de traduccion o `formatMessage`.

---

### UI-ADS-004

**DEFINICION:** Todo componente interactivo (botones, links, inputs) debe tener labels accesibles, estados de foco visibles y ser navegable por teclado.

**VALOR:** Los componentes sin labels accesibles no pueden ser usados con screen readers. La navegacion por teclado es esencial para usuarios con discapacidades motoras. Los estados de foco son requeridos por WCAG 2.1 nivel A (criterio 2.4.7).

**IMPLEMENTACION:**
```tsx
// CORRECTO - label explicito:
<Button appearance="primary" onClick={handleClick}>
  Approve PR
</Button>

<TextField label="Repository URL" value={url} onChange={setUrl} />

// INCORRECTO - sin label:
<Button onClick={handleClick}><Icon glyph="check" /></Button>
```
Usar los componentes de Atlaskit que ya implementan foco y aria labels por defecto.

**AUDITORIA:** Ralph verifica que todo componente `<Button>` tenga contenido textual o un atributo `aria-label`. Verifica que todo `<TextField>`, `<Textfield>`, o input tenga una prop `label`. Busca iconos clickeables sin texto alternativo.
