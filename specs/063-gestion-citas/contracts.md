# API interna, sesión obligatoria, AGENDA apagada = 404

- GET /api/bookings/manage?contactId=…: miembros de la organización, próximas
  citas (50) y recordatorios internos propios/sin responsable (50).
- POST /api/bookings/manage: campos del esquema src/lib/citas.ts. 201 y booking.
- GET /api/bookings/{id}/manage: booking + últimas 100 entradas de historial.
- PATCH /api/bookings/{id}/manage: estado completo validado del formulario, 200.

422 por payload inválido; 404 por cita/contacto/responsable fuera del alcance;
409 slot_taken por conflicto. organizationId y actor vienen exclusivamente de
la sesión. Owner, admin y member operan como en la agenda existente.

Confirmada se guarda como status=agendada + confirmed_at; no se agrega un estado
al contrato del bot. Los listados internos añaden metadatos opcionales.
No hay DELETE: cancelar conserva la cita. No se hacen llamadas externas desde
estas rutas. El envío de recordatorios WhatsApp está fuera del alcance.
