# Gestión inmobiliaria opcional (064)

`FEATURE_REAL_ESTATE=true` habilita el módulo. Solo ese valor literal es válido;
`false`, ausente o inválido lo apagan. El servidor lee la bandera en runtime y pasa
solo un booleano al menú. No hay variable `NEXT_PUBLIC_*` ni secretos del entorno
expuestos. Código, documentación y UI siguen el español del repositorio; el menú
conserva el nombre solicitado «Gestão Imobiliária».

## Instalación y Docker

La migración aditiva `0027_wonderful_talos.sql` crea tres tablas privadas del módulo.
No modifica registros existentes. Se requiere instalarla antes de habilitarlo.
El arranque habitual de la imagen aplica las migraciones pendientes. Revisar el
SQL, hacer backup y autorizar la actualización de producción antes de ejecutarla.
La cadena incluye `0026`, una migración de agenda que ya existía en este workspace.

En un fork se debe construir la imagen desde el código que incluye el módulo.
El Dockerfile existente admite configuración runtime y no necesita build args.
Editar únicamente la línea deseada en `.env` (no reemplazar el archivo):

```dotenv
FEATURE_REAL_ESTATE=true
```

Cuando se autorice la instalación, ejecutar:

```bash
docker compose up -d --build app
```

Para apagar, cambiar a `FEATURE_REAL_ESTATE=false` y recrear solo la aplicación:

```bash
docker compose up -d --no-deps --force-recreate app
```

`docker compose restart` solo no actualiza el entorno del contenedor. No se borran
tablas, archivos ni datos al desactivar. Todas las superficies responden 404 y no
consultan las tablas inmobiliarias. El CRM apagado puede iniciar sin esas tablas;
el migrador estándar igualmente instala todas las migraciones al actualizar.

`docker-compose.dev.yml` solo contiene Postgres: Next ejecutado con `pnpm dev` lee
`.env`; reiniciar ese proceso después de cambiar la flag. No ejecutar migraciones
contra producción sin autorización. En una BD local de desarrollo: `pnpm db:migrate`.

## Uso y permisos

Abrir Gestión inmobiliaria. Administración vincula corredores a miembros de Equipo
y configura etapas del embudo; «Crear etapas sugeridas» instala diez etapas
editables. Operadores owner/admin/member gestionan inventario, fichas y visitas.
La flag no concede permisos: sesión, rol y organización se verifican aparte.

Los interesados y propietarios seleccionan contactos existentes. Crear contactos
en la pantalla Contactos del CRM; no se duplica identidad ni se exige teléfono a
los contactos existentes. El formulario permite seleccionar varios inmuebles de
interés. Los importes son BRL; áreas en m²; precios de alquiler/condominio e IPTU
se guardan como importes informados, sin prorrateo ni cálculo fiscal.

Cada ficha se abre desde la lista para editar, archivar o consultar el historial.
Las fotos y PDF se adjuntan después de guardar el inmueble (10 MB por archivo),
usan el adaptador disco/bucket y solo se descargan con sesión de la organización.
El historial conserva usuario, fecha y estados anterior/nuevo de cada edición.
Las ediciones obsoletas se rechazan con 409 para impedir sobrescritura silenciosa.

Las visitas pueden crearse desde inmueble, interesado o agenda. Horarios y vistas
diaria/semanal/mensual usan la zona local del navegador, indicada en la agenda;
el transporte y almacenamiento son UTC. El final del intervalo es exclusivo:
10–11 y 11–12 no se cruzan. Canceladas, ausentes y archivadas liberan el horario.
El bloqueo transaccional por organización evita conflictos simultáneos entre
corredores incluso con varios procesos de la app. Cambiar fechas reprograma y
conserva el historial; cancelar exige motivo. No se envían recordatorios ni mensajes.

Las oportunidades cambian de etapa editando su ficha; propuesta y valor se conservan
con el historial. Una etapa de resultado perdida exige motivo. El dashboard cuenta
inmuebles disponibles, reservados, interesados nuevos (30 días), visitas locales
de hoy, propuestas abiertas, negocios ganados y actividades sin completar. No
actualiza automáticamente el estado del inmueble al cerrar una oportunidad.

## Verificación

`node node_modules/vitest/vitest.mjs run tests/unit/inmobiliaria.test.ts`.
El arnés `scripts/e2e-inmobiliaria.mjs` exige una BD descartable llamada
`vocero_inmobiliaria_test`, localhost y mocks. Comprueba API y UI, organizaciones,
concurrencia, archivos, historial y flujos infelices. Nunca usar datos de producción.

Para verificar el mismo build encendido, apagado, ausente e inválido en runtime, ejecutar
`scripts/e2e-inmobiliaria-flags.mjs` con `INMOBILIARIA_BUILD_DIR` apuntando al
directorio del build local y las mismas variables de la BD descartable. Levanta
y cierra únicamente servidores temporales en el puerto 3065.

## Respuestas de WhatsApp

El catálogo puede consultarlo el cerebro mediante el adaptador opcional de Nea.
Ver [activación, ejemplos y contrato](inmobiliaria-whatsapp.md). Requiere actualizar
la app y el cerebro con ese adaptador; no basta con encender la bandera.
