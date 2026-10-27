# Consultar inmuebles desde WhatsApp (065)

El cerebro consulta los inmuebles del módulo antes de contestar, con datos frescos
en cada llamada. No se incorpora ningún turno LLM al proceso del CRM.

## Activar con Nea

1. Instalar el módulo inmobiliario y su migración 0027 (guía
   [Gestión inmobiliaria](gestion-inmobiliaria.md)).
2. Configurar `FEATURE_REAL_ESTATE=true` en el entorno de la app. Registrar
   inmuebles con estado **disponible**, sin archivar, y descripciones comerciales.
3. Usar el overlay opcional de Nea. La imagen oficial 2.0.2 tiene herramientas
   fijas; actualizar solo el CRM no incorpora `search_properties` al cerebro.
4. Con la actualización autorizada, desde la raíz del repositorio:

```bash
docker compose -f docker-compose.yml -f docker-compose.inmobiliaria.yml up -d --build app nea
```

Este comando construye una imagen local `vocero-nea-inmobiliaria:local` derivada de
Nea 2.0.2, sin sustituir etiquetas oficiales. No se ejecutó sobre producción durante
la implementación. El adaptador no agrega servicios ni dependencias. Al cambiar
`NEA_VERSION`, el build verifica las anclas y falla si la nueva versión es
incompatible: revisar y probar antes de actualizar, nunca parchear a ciegas.

Conectar WhatsApp, configurar IA en Ajustes, mantener el despacho hacia Nea y
encender el Agente siguen siendo necesarios. La bandera no enciende al agente ni
autoriza a usar Meta. No hay consultas/respuestas automáticas sin cerebro activo.

## Ejemplos

- «Quanto custa o imóvel CASA-001?» → busca el código, precio y disponibilidad.
- «Tem apartamento para alugar no Centro de São Paulo, até 2.500, com 2 quartos?»
  → filtra finalidad, ciudad, barrio, presupuesto y habitaciones.
- Sin coincidencias, pregunta por alternativas; no inventa un inmueble.
- Si la consulta falla, no confirma disponibilidad y ofrece atención humana.

El idioma lo decide el cliente. Importes en BRL; áreas en m². Los precios son los
registrados, sin cálculos fiscales ni validación de crédito. El catálogo es una
foto del momento de la consulta, no una reserva o garantía futura.

Solo se ofrecen inmuebles disponibles y no archivados. Se excluyen propietarios,
corredores, clientes, notas internas, dirección exacta, documentos e historial.
La descripción y las características son datos comerciales: no poner secretos
allí. En esta integración se responde con texto; no se mandan fotos o archivos.
Las visitas se coordinan con una persona: la agenda genérica no reserva visitas
inmobiliarias automáticamente.

## Desactivar

Configurar `FEATURE_REAL_ESTATE=false` y recrear solamente la app con el mismo
conjunto de archivos Compose:

```bash
docker compose -f docker-compose.yml -f docker-compose.inmobiliaria.yml up -d --no-deps --force-recreate app
```

La capacidad desaparece del contexto en el siguiente turno. El endpoint devuelve
404 incluso si Nea tenía una búsqueda en vuelo. Los datos se conservan; las
herramientas habituales del cerebro siguen funcionando.

## Otros cerebros y contrato público

`GET /api/bot/context` agrega, solo encendido:

```json
{"realEstate":{"version":1,"searchPath":"/api/bot/real-estate/properties"}}
```

El cerebro registra una herramienta de lectura y hace la consulta autenticada:

```http
GET /api/bot/real-estate/properties?conversationId=cv_...&purpose=alquiler&city=Sao%20Paulo&maxPrice=2500&minBedrooms=2
X-API-Key: <BOT_API_KEY configurada en el servidor del cerebro>
```

También soporta `code`, `query`, `type`, `neighborhood`, `minPrice`, `minArea`,
`maxArea`, `minParking`, `features` (coma, deben coincidir todas) y `limit` (1–10,
5 por defecto). `purpose` es `venta` o `alquiler` y se exige con presupuesto.
No se acepta organización ni conversación proporcionada por el modelo: el cerebro
fija la conversación del turno. El tipo usa las claves del catálogo del CRM.

Respuesta: `properties`, `returned`, `hasMore`, `currency: "BRL"`, `checkedAt`.
Nunca utilizar precios del historial: consultar de nuevo. Si `hasMore`, pedir
criterios más precisos. 401/429 conservan la autenticación/límites del bot;
404 módulo apagado o conversación ajena; 409 `ai_paused`/`no_org`; 422 consulta
inválida; 503 `catalog_unavailable`. El envío final permanece en
`POST /api/bot/messages`, con sus guardias de ventana, handoff y sandbox.
Contrato completo en [OpenAPI](openapi.json).

## Pruebas

- `tests/unit/inmobiliaria-bot.test.ts`: validación, autenticación, flag,
  privacidad, consulta parametrizada y scope.
- `integrations/nea-inmobiliaria/probar.py`: adaptador sobre copia efímera de Nea,
  fallos, flag, ruta fija y conversación no controlada por el LLM.
- `scripts/e2e-inmobiliaria-bot.mjs`: exige localhost, mocks y BD
  `vocero_inmobiliaria_test`. Usa la imagen Nea en un contenedor descartable,
  un LLM determinista local y conversaciones `is_test`; ejecuta `run_turn`,
  consulta el catálogo real y observa la respuesta guardada en el CRM.
  No llama a un proveedor LLM ni a Meta; no usa producción.
