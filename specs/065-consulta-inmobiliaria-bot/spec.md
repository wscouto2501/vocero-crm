# 065 — Consultar inmuebles desde WhatsApp

Carril completo: extensión aditiva del contrato público del bot, sin migración.
Especificación escrita antes del código.

El cliente pregunta por código o por preferencias y el cerebro consulta los
inmuebles disponibles en ese momento. Responde por /api/bot/messages; el CRM no
incorpora un turno propio ni entrega credenciales de WhatsApp al cerebro.

## Aceptación
- FEATURE_REAL_ESTATE=true: GET /api/bot/real-estate/properties con BOT_API_KEY,
  conversationId y filtros validados devuelve hasta 10 inmuebles disponibles.
- False/ausente/inválido: 404 antes de autenticar o consultar tablas del módulo.
- La conversación pertenece a la organización de la instancia. Handoff o IA
  pausada: 409 ai_paused. Conversación ajena: 404. No hay escritura de dominio.
- Solo datos comerciales mediante lista explícita: sin notas, dirección exacta,
  propietarios, corredores, documentos, historial ni otros clientes.
- Filtros: código, texto, tipo, venta/alquiler, ciudad, barrio, precio, área,
  habitaciones, estacionamientos y características. Presupuesto exige finalidad.
- El contexto anuncia la capacidad solo encendida. Sin inventario encontrado no
  se inventan alternativas, precios, disponibilidad ni confirmaciones de visita.
- Nea 2.0.2 necesita adaptador: su catálogo de herramientas es fijo. Se entrega un
  overlay opcional reproducible que incorpora search_properties y consulta por
  conversación en cada llamada; no cambia su proxy LLM, envío ni gates.
- Se prueban API, filtros, privacidad, aislamiento, degradación y el turno real
  de Nea con LLM determinista local, sin Meta ni proveedor pagado.

## Fuera de alcance
Reserva de visitas, envío de fotos/documentos, publicaciones externas y despliegue
automático. No se ofrece una visita inmobiliaria con la agenda genérica.
