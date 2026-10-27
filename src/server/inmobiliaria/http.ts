import { z } from "zod";
import { apiError, parseBody, withAuth } from "@/lib/api";
import { esRecurso } from "@/lib/inmobiliaria";
import { inmobiliariaActiva, ErrorInmobiliario } from "./flag";
import { listar, guardar, detalle, opciones, subirArchivo, descargarArchivo } from "./service";

const consulta = z.object({ id: z.string().min(1).max(100).optional(), archivo: z.string().min(1).max(100).optional() });
const cuerpo = z.object({ id: z.string().min(1).max(100).optional(), version: z.string().datetime().optional(), datos: z.unknown() }).strict();
type Contexto = { params: Promise<{ recurso: string }> };
export async function atender(req: Request, contexto: Contexto): Promise<Response> {
  if (!inmobiliariaActiva()) return new Response(null, { status: 404 });
  return withAuth(async (session) => {
    try {
      const { recurso } = await contexto.params;
      if (req.method === "GET") {
        const q = consulta.safeParse(Object.fromEntries(new URL(req.url).searchParams));
        if (!q.success) return apiError(422, "invalid_query", q.error.message);
        if (recurso === "opciones") return Response.json(await opciones(session.organizationId));
        if (recurso === "archivos" && q.data.archivo) return await descargarArchivo(session.organizationId, q.data.archivo);
        if (!esRecurso(recurso)) return new Response(null, { status: 404 });
        if (q.data.id) {
          const resultado = await detalle(session.organizationId, q.data.id);
          if (resultado.registro.tipo !== recurso) return new Response(null, { status: 404 });
          return Response.json(resultado);
        }
        return Response.json({ registros: await listar(session.organizationId, recurso) });
      }
      if (recurso === "archivos") {
        const q = consulta.safeParse(Object.fromEntries(new URL(req.url).searchParams));
        if (!q.success || !q.data.id) return apiError(422, "invalid_query", "Falta el inmueble");
        const body = await parseBody(req, z.unknown());
        if (!body.ok) return body.response;
        return Response.json(await subirArchivo(session, q.data.id, body.data), { status: 201 });
      }
      if (!esRecurso(recurso)) return new Response(null, { status: 404 });
      const body = await parseBody(req, cuerpo);
      if (!body.ok) return body.response;
      if (req.method === "PATCH" && !body.data.id) return apiError(422, "invalid_body", "Falta el identificador");
      if (req.method === "POST" && body.data.id) return apiError(422, "invalid_body", "POST crea un registro nuevo");
      return Response.json({ registro: await guardar(session, recurso, body.data.datos, body.data.id, body.data.version) }, { status: req.method === "POST" ? 201 : 200 });
    } catch (err) {
      if (err instanceof ErrorInmobiliario) return apiError(err.status, "inmobiliaria", err.message);
      throw err;
    }
  })();
}
