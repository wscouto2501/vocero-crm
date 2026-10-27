import { parseBody, withAuth } from "@/lib/api";
import { citaSchema } from "@/lib/citas";
import { agendaDisabledResponse, agendaEnabled } from "@/server/agenda/flag";
import { bookingErrorResponse } from "@/server/agenda/http";
import { detalleCita, guardarCita } from "@/server/agenda/gestion";

export const dynamic = "force-dynamic";
type Params = { params: Promise<{ id: string }> };
export const GET = withAuth(async (session, _req: Request, ctx: Params) => {
  if (!agendaEnabled()) return agendaDisabledResponse();
  try { return Response.json(await detalleCita(session.organizationId, (await ctx.params).id)); }
  catch (error) { return bookingErrorResponse(error); }
});
export const PATCH = withAuth(async (session, req: Request, ctx: Params) => {
  if (!agendaEnabled()) return agendaDisabledResponse();
  const body = await parseBody(req, citaSchema);
  if (!body.ok) return body.response;
  try { return Response.json({ booking: await guardarCita(session, body.data, (await ctx.params).id) }); }
  catch (error) { return bookingErrorResponse(error); }
});
