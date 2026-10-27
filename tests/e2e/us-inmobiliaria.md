# 064 — Gestión inmobiliaria

Entorno: localhost, BD descartable vocero_inmobiliaria_test, mocks, sin despacho.
Aplicar migraciones solo a la BD de pruebas. Ejecutar scripts/e2e-inmobiliaria.mjs.

1. true: menú y área visibles; crear corredor de miembro y propietario de contacto.
2. Crear inmueble con características, editar y consultar; código duplicado 409,
   edición obsoleta 409; historial conserva ambas versiones.
3. Crear interesado reutilizando contacto e intereses; referencia ajena 422.
4. Dos visitas simultáneas al mismo corredor: una 201 y otra 409. Contigua válida.
   Reprogramar y ver historial. Cancelar sin motivo devuelve 422.
5. Crear propuesta y mover a pérdida sin motivo: 422. Miembro no configura etapas.
6. Adjuntar PDF y descargar; otra organización recibe 404 en ficha y archivo.
7. Navegador: crear/editar inmueble, buscar, agendar desde ficha; conflicto visible,
   corregir horario y guardar; abrir las tres vistas de calendario.
8. Reiniciar solo servidor de pruebas con flag false y repetir arnés: API y página
   404, menú oculto, count de datos conservado y Contactos sigue respondiendo 200.
9. Repetir arranque sin flag y con valor inválido: mismas guardias unitarias y 404.

No se usa WhatsApp ni proveedor externo. No ejecutar contra producción.
