import { apiError } from "@/lib/api";
import { requireBotKey, resolveInstanceOrg } from "./auth";
import { inmobiliariaActiva, ErrorInmobiliario } from "@/server/inmobiliaria/flag";
import { consultaCatalogoSchema, consultarInmuebles } from "@/server/inmobiliaria/catalogo-bot";

export async function buscarInmuebles(req: Request): Promise<Response> {
  if (!inmobiliariaActiva()) return new Response(null, { status: 404 });
  const denied = requireBotKey(req);
  if (denied) return denied;
  const parametros = new URL(req.url).searchParams;
  // No aceptar claves repetidas: no hay dos interpretaciones de un presupuesto.
  if ([...new Set(parametros.keys())].some(k => parametros.getAll(k).length !== 1)) return apiError(422, "invalid_query", "Parámetros duplicados");
  const q = consultaCatalogoSchema.safeParse(Object.fromEntries(parametros));
  if (!q.success) return apiError(422, "invalid_query", q.error.issues.map(i => `${i.path.join(".")}: ${i.message}`).join("; "));
  try {
    const org = await resolveInstanceOrg();
    if (!org) return apiError(409, "no_org", "La instancia aún no tiene organización");
    return Response.json(await consultarInmuebles(org, q.data), { headers: { "Cache-Control": "private, no-store" } });
  } catch (e) {
    if (e instanceof ErrorInmobiliario) return apiError(e.status, e.status === 409 ? "ai_paused" : "not_found", e.message);
    // No enviar datos, consultas ni errores de Postgres al cerebro o a logs.
    return apiError(503, "catalog_unavailable", "No se pudo consultar el catálogo; no confirmes precios ni disponibilidad");
  }
}
