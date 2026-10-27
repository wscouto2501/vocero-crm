# Modelo aditivo

booking conserva sus relaciones y todos los valores existentes. Añade title,
description, appointment_type, location, responsible_user_id (FK user, SET NULL),
confirmed_at y reminder_minutes, todos opcionales. Fin = scheduled_at +
duration_minutes; el formulario permite 5–600 minutos. UTC en persistencia y
conexión, conversión Intl con zona del negocio en la interfaz.

booking_history: id prefijado bkh, organization_id obligatorio, booking_id,
actor_user_id, before/after JSONB y created_at UTC. Índice org + cita + fecha.
Cada escritura de gestión y su snapshot comparten transacción. La auditoría
empieza con el nuevo formulario; no reconstruye acciones de versiones anteriores.

Se conserva el índice único parcial existente: agenda empresarial única para
reservas del bot. La comprobación adicional por responsable no permite duplicar
un inicio activo ya ocupado, aunque el responsable sea otro. El bloqueo asesor
serializa el nuevo formulario por organización; las reservas antiguas siguen
protegidas por su índice y disponibilidad originales.
