import { z } from "zod";
import { apiError, parseBody, withAuth } from "@/lib/api";
import { citaSchema } from "@/lib/citas";
import { agendaDisabledResponse, agendaEnabled } from "@/server/agenda/flag";
import { bookingErrorResponse } from "@/server/agenda/http";
import { guardarCita, opcionesCitas, proximasCitas, recordatoriosCitas } from "@/server/agenda/gestion";

export const dynamic = "force-dynamic";
export const GET = withAuth(async (session, req: Request) => {
  if (!agendaEnabled()) return agendaDisabledResponse();
  const query = z.object({ contactId: z.string().min(1).max(100).optional() }).safeParse(Object.fromEntries(new URL(req.url).searchParams));
  if (!query.success) return apiError(422, "invalid_query", query.error.message);
  const [options, upcoming, reminders] = await Promise.all([opcionesCitas(session.organizationId), proximasCitas(session.organizationId, query.data.contactId), recordatoriosCitas(session)]);
  return Response.json({ ...options, upcoming, reminders });
});
export const POST = withAuth(async (session, req: Request) => {
  if (!agendaEnabled()) return agendaDisabledResponse();
  const body = await parseBody(req, citaSchema);
  if (!body.ok) return body.response;
  try { return Response.json({ booking: await guardarCita(session, body.data) }, { status: 201 }); }
  catch (error) { return bookingErrorResponse(error); }
});
