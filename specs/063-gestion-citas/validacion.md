# Entrega y verificación — 063

## Archivos

- `src/lib/db/schema.ts`: siete campos opcionales en booking y tabla booking_history.
- `src/lib/db/ids.ts`: prefijo bkh para auditoría.
- `drizzle/0026_secret_luckman.sql`, `drizzle/meta/0026_snapshot.json`, `drizzle/meta/_journal.json`: migración generada con Drizzle; sin DROP/TRUNCATE.
- `src/lib/citas.ts`: validación Zod de campos, intervalos y enlaces.
- `src/server/agenda/gestion.ts`: referencias por organización, transacción, conflictos, auditoría, próximas citas y avisos internos.
- `src/server/agenda/queries.ts`: metadatos aditivos para el calendario existente.
- `src/app/api/bookings/manage/route.ts`: opciones, próximas citas, recordatorios y creación autenticada.
- `src/app/api/bookings/[id]/manage/route.ts`: detalle, historial y edición autenticada.
- `src/components/bookings/cita-form.tsx`: formulario real de creación/edición, zona del negocio, errores y auditoría.
- `src/components/bookings/bookings-client.tsx`: acceso al formulario, filtros y avisos internos; acciones de las nuevas citas pasan por el servicio auditado.
- `src/components/bookings/booking-look.ts`: título y estado confirmado.
- `src/components/bookings/booking-drawer.tsx`: detalles, responsable, edición y confirmación de cancelación.
- `src/components/bookings/contacto-citas.tsx`: próximas citas y acceso desde contacto.
- `src/components/contacts/contacts-client.tsx`, `src/components/inbox/contact-panel.tsx`: integración del widget en las fichas.
- `tests/unit/gestion-citas.test.ts`, `tests/unit/gestion-citas-api.test.ts`: doce pruebas nuevas.
- `scripts/e2e-gestion-citas.mjs`, `tests/e2e/us-gestion-citas.md`: API real y Playwright con dos organizaciones y datos ficticios.
- `specs/063-gestion-citas/{spec,plan,tasks,data-model,contracts,validacion}.md`: diseño, contratos y evidencia.
- `README.md`: uso, alcance de avisos y migración.

Los cambios previos del usuario en Caddyfile y Caddyfile.backup no pertenecen a esta entrega.

## Entorno de verificación

PostgreSQL temporal `vocero-citas-test-063`, puerto local 55463, base
`vocero_citas_test`. Copia de la app en /tmp, puerto 3063, mocks y credenciales
ficticias. Se consultaron únicamente nombres/tipos de columnas de booking en
producción para comprobar compatibilidad. Ninguna migración en producción,
ningún reinicio de sus containers, ningún mensaje real.

La migración se aplicó con el migrador del proyecto a la base temporal. El
esquema previo tenía 18 columnas de booking; la migración añade siete y una
tabla de auditoría, conservando todos los datos y el índice original.

## Comandos

Gates habituales:

```sh
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

E2E: aplicación local con AGENDA=on, WA_MOCK_ENABLED=true, ALLOW_SIGNUP=true y
DATABASE_URL apuntando exclusivamente a una base llamada vocero_citas_test.
Aplicar las migraciones en esa base antes de iniciar la app. Playwright necesita
Chromium instalado. El arnés rechaza URL pública, base distinta y mocks apagados:

```sh
node --env-file=<archivo-exclusivo-de-pruebas> scripts/e2e-gestion-citas.mjs
```

Para la futura implantación, con autorización del operador: definir AGENDA=on
en la configuración del despliegue y construir la imagen propia:

```sh
docker compose build app
docker compose up -d --no-deps --pull never app
```

El arranque aplica 0026 automáticamente antes del servidor. No ejecutar una
migración manual adicional sobre producción. No se cambian servicios ni llaves
de IA, WhatsApp o Nea para activar esta función.

## Alcance deliberado

- Avisos dentro de la agenda abierta, actualizados cada minuto; sin push, email
  ni mensajes WhatsApp. Editar/cancelar modifica la condición del aviso porque
  se calcula desde la cita persistida, sin tareas obsoletas.
- Historial del nuevo formulario desde su instalación; no inventa auditoría
  histórica ni cambia los flujos originales de conectores y bot.
- Se conserva el candado empresarial: dos citas activas con el mismo inicio se
  rechazan aunque tengan responsables distintos. Los demás solapamientos se
  comprueban por responsable; bloqueos y citas sin responsable son compartidos.
- Zoom/Google mantienen sus acciones originales para modificar horario/estado;
  el nuevo formulario crea citas sin invocar proveedores y acepta enlace manual.

## Resultados comprobados

- TypeScript sin errores y ESLint sin errores.
- Vitest completo: 124 archivos, 1 401 pruebas aprobadas. La primera ejecución
  en sandbox falló por permisos de red/subprocesos en pruebas existentes;
  la repetición con esos permisos pasó completa.
- E2E real aprobado: API y Playwright, dos organizaciones, conflictos concurrentes,
  creación, edición de título y horario, confirmación, cancelación rechazada y
  aceptada, historial, avisos y retirada del aviso al cancelar, navegador en Tokio
  contra agenda de México e interfaz móvil sin desbordamiento.
- Migración aplicada únicamente al PostgreSQL temporal.
- Servidor de pruebas y PostgreSQL temporal detenidos tras la verificación; sus
  datos se conservan. No se instalaron bibliotecas en el sistema: Chromium y sus
  bibliotecas se descargaron/extrajeron en /tmp.

- Build final en la raíz del repositorio aprobado (salida 0), con variables
  exclusivas de prueba. Compilación, lint, tipos, generación de páginas y
  standalone completados. Las copias con node_modules enlazado produjeron
  advertencias de resolución de Next; la comprobación final usó la raíz real.
