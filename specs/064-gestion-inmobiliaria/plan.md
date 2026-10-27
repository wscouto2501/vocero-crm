# Plan
1. Flag estricta server-only, booleano por props, env de runtime en compose.
2. Área y API autenticadas con guardia previa; servicios vuelven a comprobar flag.
3. Tablas aditivas: registros tipados (inmueble/interesado/propietario/corredor/
   etapa/oportunidad/visita), adjuntos e historial. Payload JSON validado por Zod;
   columnas de identidad, clase y organización indexadas; código único por org.
4. Referencias comprobadas con scoped en la misma transacción. Bloqueo advisory
   transaccional por organización serializa escrituras y evita carreras de visitas
   y duplicados; historial atómico. Sin borrar registros.
5. UI con formularios tipados, filtros, calendario y métricas, almacenamiento propio.
6. Migración generada por Drizzle sin aplicarla a servicios existentes; pruebas y gates.

Constitution check antes y después del diseño: aislamiento, soberanía y contratos
existentes preservados. Sin nuevas dependencias ni cambio a API pública del bot.
La flexibilidad JSON permite ampliar atributos sin cambiar las tablas genéricas del
CRM. Cada tipo mantiene un esquema cerrado; no se acepta JSON arbitrario del cliente.
