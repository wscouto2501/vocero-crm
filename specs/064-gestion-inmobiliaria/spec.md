# 064 — Gestión inmobiliaria opcional

Carril completo, especificado antes de implementar. Sirve para convertir contactos
existentes en operaciones inmobiliarias sin cambiar la bandeja ni el cerebro.

## Comportamiento y aceptación
- Solo FEATURE_REAL_ESTATE=true habilita menú «Gestão Imobiliária», páginas y API.
  Ausente, false o inválida: 404 y ninguna consulta del módulo; datos preservados.
- Inmuebles: ficha completa, búsqueda y filtros, edición y archivo sin borrado.
  Fotos y PDF privados usan el almacenamiento existente y acceso autenticado.
- Interesados y propietarios referencian contactos existentes; los corredores son
  miembros existentes de la organización, sin duplicar usuarios ni contactos.
- Visitas desde inmueble, interesado y agenda diaria/semanal/mensual; intervalo
  final exclusivo, rechazo de cruces del mismo corredor incluso con concurrencia.
  Cancelar exige motivo. Reprogramaciones y cambios quedan en historial.
- Oportunidades relacionan inmueble, interesado y corredor; propuestas, etapas
  configurables, cierre y pérdida con motivo. Dashboard usa datos persistidos.
- Toda lectura/escritura y referencia pertenece a la organización autenticada.
  Miembros operan; owner/admin configuran etapas y habilitan corredores.
- Sin llamadas a WhatsApp, proveedores externos ni servicios pagados.

## Decisiones
UI y código en español según guía del repositorio, salvo el nombre solicitado del
módulo. Importes decimales en BRL; fechas almacenadas en UTC y mostradas en zona
local del navegador. Visitas independientes de AGENDA: no dependen de conectores.
No se incluyen portales públicos, publicación de anuncios ni automatizaciones.
