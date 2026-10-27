# 063 — Gestión completa de citas

Ejecutar scripts/e2e-gestion-citas.mjs solo contra vocero_citas_test local,
AGENDA=on, WA_MOCK_ENABLED=true y ALLOW_SIGNUP=true. No usar una BD compartida.

1. Registrar primer propietario; crear contacto de prueba.
2. Crear cita con campos completos: 201; fin inválido: 422; solapamiento: 409.
3. Reprogramar y confirmar: status público agendada y confirmed_at presente;
   snapshots de creación y edición conservados.
4. Otra organización no puede consultar, editar ni vincular contactos ajenos.
5. Dos solicitudes concurrentes solapadas del mismo responsable: 201 y 409.
6. Aviso interno aparece antes del inicio; ningún proveedor externo recibe tráfico.
7. Navegador en otra zona: crear, editar y cancelar desde UI; rechazar y aceptar
   el diálogo de cancelación. Comprobar persistencia y cuatro snapshots.
8. Móvil: formulario usable sin desbordamiento horizontal.
9. AGENDA apagada y falta de sesión: verificar 404 y 401 (tests unitarios API).
