# Archivos de la implementación

## Configuración e integración existente
- `.env.example`: variable opcional sin credenciales.
- `docker-compose.yml`: flag en el entorno runtime de app.
- `src/lib/env.ts`: validación booleana con default apagado.
- `src/lib/nav.ts`, `src/components/app-nav.tsx`, `src/components/app-shell.tsx`,
  `src/app/(app)/layout.tsx`: entrada condicional y booleano desde servidor.
- `src/lib/db/schema.ts`: tablas del módulo, añadidas al final del esquema.
- `drizzle/meta/_journal.json`: entrada generada de la migración 0027.
- `README.md`: enlace a la guía del módulo.

## Archivos nuevos
- `src/lib/inmobiliaria.ts`: datos, validación y reglas de intervalos.
- `src/lib/inmobiliaria-form.ts`: campos de las fichas.
- `src/lib/inmobiliaria-dashboard.ts`: métricas derivadas y día local.
- `src/server/inmobiliaria/flag.ts`: decisión central y error del dominio.
- `src/server/inmobiliaria/service.ts`: consultas, transacciones, referencias,
  conflictos, historial y almacenamiento de archivos.
- `src/server/inmobiliaria/http.ts`: sesión, validación y respuestas HTTP.
- `src/app/api/real-estate/[recurso]/route.ts`: GET, POST y PATCH.
- `src/app/(app)/real-estate/[[...seccion]]/page.tsx`: páginas protegidas.
- `src/components/inmobiliaria/inmobiliaria-client.tsx`: área del módulo.
- `drizzle/0027_wonderful_talos.sql`, `drizzle/meta/0027_snapshot.json`:
  migración y snapshot generados, exclusivamente aditivos.
- `tests/unit/inmobiliaria.test.ts`, `tests/unit/inmobiliaria-http.test.ts`:
  flag, navegación, guardias, datos, intervalos y regresión de archivos privados.
- `scripts/e2e-inmobiliaria.mjs`: API real y Playwright, casos felices e infelices.
- `scripts/e2e-inmobiliaria-flags.mjs`: mismo build apagado/ausente/inválido.
- `tests/e2e/us-inmobiliaria.md`: guion funcional.
- `docs/gestion-inmobiliaria.md`: configuración, permisos, uso y despliegue.
- `specs/064-gestion-inmobiliaria/{spec,plan,tasks,archivos,validacion}.md`: diseño y trazabilidad.

Las modificaciones previas del workspace (agenda 063, Caddy, migración 0026 y
otros cambios preexistentes) se preservaron. Los archivos compartidos README,
schema y journal conservan esas modificaciones además de las adiciones 064.
