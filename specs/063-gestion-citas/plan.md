# Plan
1. Extender booking con metadatos opcionales y confirmación; añadir booking_history con snapshots y actor. Generar SQL con Drizzle sin aplicar a producción.
2. Servicio de operador con Zod, referencias scoped, transacción, bloqueo por organización y comprobación de intervalos. API interna separada /api/bookings/manage y /api/bookings/{id}/manage para preservar rutas antiguas.
3. Reutilizar calendario y drawer, añadir formulario y filtros, historial, widget de contacto y recordatorios internos.
4. Tests de servicio/API, gates y E2E aislado con mocks si hay infraestructura local disponible.

Diseño revisado: conservación de enum y unique existentes; consultas nuevas siempre scoped; no cambios en bot ni conectores. Recordatorio calculado de datos persistidos: editar/cancelar lo actualiza sin tareas obsoletas.
