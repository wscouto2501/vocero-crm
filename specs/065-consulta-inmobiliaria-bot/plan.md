# Plan y revisión constitucional

1. Servicio de búsqueda SQL scoped, Zod de query, proyección comercial cerrada.
2. Ruta autenticada por BOT_API_KEY y contexto aditivo realEstate (sin DB extra).
3. OpenAPI y contrato de capacidad versión 1; rutas actuales y firma intactas.
4. Adaptador opcional Nea: módulo propio, parche mínimo de turn.py con anclas
   verificadas al construir. Imagen base versionada, override compose explícito.
   Nunca se modifica el contenedor de producción ni se aplica un turno en el CRM.
5. Pruebas unitarias y de contrato, integración contra Postgres descartable y Nea
   real con modelo falso; tipos, lint y build. Documentar activación manual.

Constitution check previo y posterior al diseño: sin dependencias externas nuevas,
sin cambios a los datos guardados, scoped en toda consulta de dominio, sin secretos
en respuestas. Solo el cerebro ejecuta el LLM. Aislamiento y soberanía preservados.
Decisión explícita: overlay de la imagen Nea existente porque su repositorio no
está en el workspace. El parche rechaza versiones incompatibles, no las adapta a
ciegas; otros cerebros implementan la ruta pública documentada.
