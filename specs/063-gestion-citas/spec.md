# 063 — Gestión completa de citas del operador

Ampliar la agenda 015, bajo AGENDA, sin cambiar contratos del bot. Carril completo por migración aditiva.

## Criterios de aceptación
- Crear y editar una cita con título, descripción, notas, inicio y fin, contacto opcional, responsable miembro de la organización, lugar/enlace y tipo.
- Calendario existente día/semana/mes/lista con filtros por responsable y estado; creación desde contacto y próximas citas en su ficha.
- Estados existentes conservados; confirmación mediante confirmed_at (agendada + confirmed_at = confirmada), sin alterar el enum público del bot.
- Intervalos UTC explícitos, duración 5–600 minutos, hora de pared en zona del negocio. Rechazar intervalos inválidos y cruces de organización.
- Detectar solapamientos del mismo responsable (sin responsable = recurso compartido); responder 409 sin guardar y mostrar aviso. Conservar índice anti doble reserva global y reglas de disponibilidad del bot.
- Cancelar con confirmación, sin borrado físico. Historial de antes/después y actor, atómico con cada cambio del nuevo formulario.
- Recordatorio interno persistido por minutos previos: visible al abrir la agenda, sin llamadas externas, sin mensajes reales. Solo citas propias o sin responsable.
- Las citas creadas aquí no invocan conectores. Las citas externas conservan su flujo de reprogramación original; el formulario no puede modificar su horario/enlace.

## Exclusiones
No eliminación física ni envío automático WhatsApp; no configuración de conectores nuevos. No multi-recurso para reservas del bot: su contrato sigue siendo una agenda del negocio.

## Puerta constitucional
Aislamiento por scoped y validación de referencias; transacción y bloqueo asesor por organización; sin dependencias, sin secretos, sin tráfico externo nuevo; bandera apagada 404; pruebas felices e infelices.
