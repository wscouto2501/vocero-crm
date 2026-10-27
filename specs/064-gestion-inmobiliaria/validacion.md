# Validación ejecutada — 2026-10-25

- Tipos: `node node_modules/typescript/bin/tsc --noEmit` — aprobado.
- Lint: `node node_modules/eslint/bin/eslint.js .` — aprobado; cambios finales
  del componente y servicios comprobados también por lint y build.
- Suite completa: `pnpm test` — 126 archivos, 1420 pruebas aprobadas.
- Build final en el workspace: `node --env-file=/tmp/vocero-inmobiliaria-build.env
  /opt/vocero/node_modules/next/dist/bin/next build` — aprobado, sin errores.
  El entorno temporal utiliza exclusivamente la BD descartable y NODE_ENV=production.
- `git diff --check` — aprobado.
- E2E con API real y Playwright: CRUD, historial, versiones obsoletas, códigos
  duplicados, contactos, propuestas, cancelación, archivos privados, permisos,
  organizaciones y solicitudes de visitas simultáneas — aprobado.
- UI en America/Sao_Paulo: crear y editar inmueble, buscar, agendar desde ficha,
  ver conflicto, corregir, guardar y observar visita en día/semana/mes — aprobado.
- Mismo build final, sin reconstruir: true, false, ausente e inválido — aprobado.
  Apagado: GET/POST/PATCH 404, página 404, menú oculto, cantidad de registros
  preservada y Contactos operativo. Encendido: E2E completo aprobado también
  sobre el build de producción, sin errores JavaScript del navegador.

## Incidencias resueltas durante la verificación

El sandbox impedía puertos/subprocesos de pruebas existentes: la suite completa
pasó al ejecutarla con los permisos necesarios. Chromium y sus bibliotecas estaban
ausentes y se instalaron para probar la interfaz. Una copia temporal incompleta
no contenía el OpenAPI; los builds repetidos sobre enlaces de node_modules de esa
copia generaron referencias internas inválidas. El build final se ejecutó con
éxito directamente en el workspace, tras cerrar solo el servidor temporal.

El E2E detectó una promesa de descarga sin await: un archivo ajeno daba 500 en vez
de 404, sin revelar contenido. Se corrigió y agregó prueba de regresión. Se
asociaron explícitamente rótulos a selectores y se inicializó la zona del calendario
en el navegador para evitar divergencia con SSR.

## Alcance del entorno

Migraciones ejecutadas solo en `vocero_inmobiliaria_test`, Postgres descartable
local en puerto 5464. Servidores temporales en puertos 3064/3065 cerrados. No se
alteró `.env`, no se migró producción y no se modificaron ni reiniciaron sus
servicios o imágenes. Datos anteriores del workspace preservados.
