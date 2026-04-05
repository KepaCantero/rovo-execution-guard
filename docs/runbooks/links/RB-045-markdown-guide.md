# [RB-045] Markdown Guide - Documentation Formatting

> Fuente: Markdown Guide - Documentation formatting

## Reglas

### GIT-CI-045-01
**DEFINICION:** Todo archivo Markdown debe comenzar con un heading H1 unico que identifique el documento, seguido de una descripcion de una linea en bloquequote (`>`), y una tabla de contenidos con anchors si el documento supera 100 lineas.
**VALOR:** El H1 unico y la descripcion permiten a Ralph y a los desarrolladores identificar instantaneamente el proposito del archivo; la tabla de contenidos facilita la navegacion en documentos extensos.
**IMPLEMENTACION:** Formato: `# [RB-XXX] Titulo Descriptivo\n\n> Descripcion de una linea\n\n## Tabla de Contenidos\n\n- [Seccion 1](#seccion-1)\n- [Seccion 2](#seccion-2)`. Para archivos menores de 100 lineas, la tabla de contenidos es opcional. Usar heading H2 (`##`) para secciones principales y H3 (`###`) para subsecciones; nunca saltar niveles.
**AUDITORIA:** Ralph verifica que cada archivo Markdown comienza con un unico H1, tiene descripcion en bloquequote, y contiene tabla de contenidos si supera 100 lineas.

### GIT-CI-045-02
**DEFINICION:** Los bloques de codigo deben especificar siempre el lenguaje (````typescript`, ````yaml`, ````bash`) y los bloques sin lenguaje especificado se consideran violaciones de formato.
**VALOR:** El syntax highlighting mejora la legibilidad en revisores de codigo y en la documentacion web; ademas, los linters de Markdown pueden validar la correccion del codigo si conocen el lenguaje.
**IMPLEMENTACION:** Siempre usar: ` ```typescript ` para TypeScript, ` ```yaml ` para YAML, ` ```bash ` para comandos shell, ` ```text ` para salida generica. Configurar `markdownlint` con regla `MD040: false` (permite bloques de codigo) y `MD046: { style: 'fenced' }` (requiere bloques fenced).
**AUDITORIA:** Ralph escanea todos los archivos Markdown y reporta bloques de codigo sin especificacion de lenguaje como violacion.

### GIT-CI-045-03
**DEFINICION:** Las listas deben usar `-` para listas no ordenadas y `1.` para listas ordenadas (sin numeros secuenciales manuales); nunca mezclar marcadores de lista (`-`, `*`, `+`) en el mismo archivo.
**VALOR:** La consistencia en marcadores reduce la carga cognitiva al leer y editar, y evita conflictos de formato entre diferentes editores y herramientas de formateo.
**IMPLEMENTACION:** Formato: para listas no ordenadas usar `- item` consistentemente. Para listas ordenadas: `1. Primer item\n1. Segundo item\n1. Tercer item` (renumeracion automatica). Prettier con plugin `prettier-plugin-markdown` puede normalizar estos estilos automaticamente.
**AUDITORIA:** Ralph verifica que no existen archivos Markdown que mezclen marcadores de lista y que las listas ordenadas usan `1.` para todos los items.

### GIT-CI-045-04
**DEFINICION:** Las URLs en Markdown deben usar el formato de referencia (`[texto][ref]`) cuando la URL tiene mas de 80 caracteres o aparece mas de una vez en el documento; las URLs cortas y unicas pueden usarse inline.
**VALOR:** Las URLs de referencia mantienen la legibilidad del texto y centralizan la gestion de links, facilitando actualizaciones cuando una URL cambia.
**IMPLEMENTACION:** Para URLs repetidas o largas: `[Sentry Docs][sentry-docs]` en el texto y al final del documento: `[sentry-docs]: https://docs.sentry.io/platforms/node/`. Para URLs cortas unicas: `[GitHub](https://github.com)` inline es aceptable.
**AUDITORIA:** Ralph verifica que las URLs de mas de 80 caracteres o repetidas usan el formato de referencia y que las referencias estan definidas al final del documento.

### GIT-CI-045-05
**DEFINICION:** Todo archivo Markdown debe pasar `markdownlint-cli` con la configuracion del proyecto en CI; las reglas deshabilitadas deben estar documentadas con justificacion en `.markdownlint.json`.
**VALOR:** El linting de Markdown en CI garantiza consistencia en toda la documentacion y previene que errores de formato se acumulen silenciosamente.
**IMPLEMENTACION:** Crear `.markdownlint.json` con: `{ "default": true, "MD013": { "line_length": 120 }, "MD033": false, "MD041": true }`. Anadir en CI: `- name: Lint Markdown\n  run: npx markdownlint-cli 'docs/**/*.md'`. Para deshabilitar reglas especificas inline: `<!-- markdownlint-disable MD013 -->`.
**AUDITORIA:** Ralph verifica que el pipeline CI contiene el step de markdownlint, que `.markdownlint.json` existe, y que toda deshabilitacion de regla tiene justificacion documentada.
