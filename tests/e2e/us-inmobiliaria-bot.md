# 065 — Cliente pregunta por un inmueble

Entorno local con mocks, Postgres descartable, FEATURE_REAL_ESTATE=true y BOT_API_KEY.

1. Registrar disponible, reservado, vendido, archivado y otro tenant. Consultar
   por código y preferencias (presupuesto, barrio, área, habitaciones, piscina).
   Solo coincide el disponible propio. Buscar Sao Paulo y jardin encuentra acentos.
2. No hay nota interna, dirección exacta ni propietario en respuesta. Una
   conversación ajena da 404, handoff 409, query inválida 422 y sin llave 401.
3. Tres mensajes simulados: código, preferencias y sin resultados. Conducir el
   `run_turn` real de Nea con el adaptador y LLM determinista. El modelo llama
   search_properties; el resultado llega al modelo y su respuesta queda visible
   en el hilo del CRM por /api/bot/messages. Ningún tráfico a Meta/proveedor LLM.
4. Reservar el inmueble y consultar otra vez: ya no aparece, sin caché del perfil.
5. Flag apagada/ausente/inválida: 404 y ausencia de capacidad. Nea sin capacidad
   no muestra herramienta; 404 durante llamada la retira; 503/red no inventan.
6. Ejecutar tests/unit/inmobiliaria-bot.test.ts e integrations/.../probar.py;
   el arnés scripts/e2e-inmobiliaria-bot.mjs conduce los pasos en vivo.
