# Validación de 065 — 2026-10-25

- `pnpm test`: 127 archivos, 1440 tests aprobados.
- `node node_modules/typescript/bin/tsc --noEmit`: aprobado.
- `node node_modules/eslint/bin/eslint.js .`: aprobado; archivo final del handler
  también comprobado individualmente y durante el build.
- Build Next.js final en /opt/vocero, con entorno de pruebas: aprobado. Incluye
  /api/bot/real-estate/properties; tipos, lint, páginas y standalone terminados.
- `git diff --check`: aprobado.
- Configuración Compose principal + override inmobiliario: válida.
- Adaptador sobre imagen Nea 2.0.2, sin red: 4 pruebas Python aprobadas.
- Imagen local vocero-nea-inmobiliaria:test-065 construida; import de app.turn
  confirma RuntimeInmobiliario y usuario sin root. No se alteró una imagen oficial.
- E2E real: SQL con estados, archivos privados representados por datos internos,
  filtros con acentos, finalidad, presupuesto, área, habitaciones y características;
  clave ausente 401, consulta inválida 422, conversación ajena 404, handoff 409.
- run_turn REAL de Nea ejecutado tres veces con modelo local determinista:
  pregunta por código, pregunta por preferencias y cero resultados. Cada respuesta
  se guardó por /api/bot/messages y se verificó en el hilo del CRM.
- Cambiar el inmueble a reservado lo elimina inmediatamente de la próxima consulta.

Se usó exclusivamente la BD descartable vocero_inmobiliaria_test y conversaciones
is_test. No se llamó a Meta ni a un proveedor LLM. El modelo simulado valida la
integración y el transporte; no equivale a evaluar respuestas de un LLM real.
No hubo deploy, migraciones nuevas, edición de .env ni reinicio de producción.
El servidor temporal 3064 se cerró tras el E2E.

Incidencias corregidas: el contenedor Nea sin root no podía leer una fixture 0600
(solo datos sintéticos; se habilitó su lectura). El código original de la imagen
es de solo lectura para su usuario: el Dockerfile aplica el parche en una etapa
root de construcción y hereda el usuario original en la imagen final.

## Archivos de esta integración

Nuevos: src/server/inmobiliaria/catalogo-bot.ts; src/server/bot/inmuebles.ts;
src/app/api/bot/real-estate/properties/route.ts; integrations/nea-inmobiliaria/
(inmobiliaria.py, aplicar.py, probar.py, Dockerfile); docker-compose.inmobiliaria.yml;
tests/unit/inmobiliaria-bot.test.ts; scripts/e2e-inmobiliaria-bot.mjs;
tests/e2e/us-inmobiliaria-bot.md; docs/inmobiliaria-whatsapp.md; specs/065-*/.
Ampliados: src/app/api/bot/context/route.ts (capacidad aditiva), docs/openapi.json,
docs/gestion-inmobiliaria.md y README.md. Sin cambios al despacho, LLM proxy,
credenciales, sender, datos existentes ni tablas del módulo.
