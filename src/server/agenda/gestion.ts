import { and, asc, desc, eq, gte, inArray, lt, sql } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { scoped } from "@/lib/db/tenant";
import { newId } from "@/lib/db/ids";
import { citaSchema, seSolapan } from "@/lib/citas";
import type { SessionContext } from "@/lib/auth/session";
import { publish } from "@/server/events/bus";
import { BookingError } from "./service";

/** Todas las escrituras del formulario y su auditoría comparten transacción. */
export async function guardarCita(session: SessionContext, raw: unknown, id?: string) {
  const data = citaSchema.parse(raw);
  const org = session.organizationId;
  const inicio = new Date(data.startUtc);
  const minutos = (Date.parse(data.endUtc) - inicio.getTime()) / 60000;
  try {
    const result = await getDb().transaction(async (tx) => {
      // Serializa las escrituras de este formulario, incluido editar/cancelar.
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${org}))`);
      const [previa] = id ? await tx.select().from(schema.booking).where(scoped(schema.booking.organizationId, org, eq(schema.booking.id, id))).for("update") : [];
      if (id && !previa) throw new BookingError("not_found", "Cita no encontrada");
      if (previa?.kind === "block" || previa?.isTest) throw new BookingError("invalid", "Usa las acciones originales para bloqueos y pruebas");
      if (previa?.externalRef && (previa.scheduledAt.getTime() !== inicio.getTime() || previa.durationMinutes !== minutos || previa.meetingLink !== data.meetingLink || previa.status !== (data.status === "confirmada" ? "agendada" : data.status))) {
        throw new BookingError("invalid", "Esta cita usa un conector: cambia su horario o estado desde las acciones del panel");
      }
      if (data.contactId) {
        const [contacto] = await tx.select({ id: schema.contact.id }).from(schema.contact).where(scoped(schema.contact.organizationId, org, eq(schema.contact.id, data.contactId)));
        if (!contacto) throw new BookingError("not_found", "Contacto no encontrado");
      }
      if (data.responsibleUserId) {
        const [miembro] = await tx.select({ id: schema.member.id }).from(schema.member).where(scoped(schema.member.organizationId, org, eq(schema.member.userId, data.responsibleUserId)));
        if (!miembro) throw new BookingError("not_found", "Responsable no encontrado");
      }
      if (data.status === "agendada" || data.status === "confirmada") {
        const ocupadas = await tx.select().from(schema.booking).where(scoped(schema.booking.organizationId, org,
          eq(schema.booking.isTest, false), inArray(schema.booking.status, ["agendada", "realizada"]),
          gte(schema.booking.scheduledAt, new Date(inicio.getTime() - 600 * 60000)), lt(schema.booking.scheduledAt, new Date(data.endUtc))));
        if (ocupadas.some((b) => b.id !== id && (b.kind === "block" || !b.responsibleUserId || !data.responsibleUserId || b.responsibleUserId === data.responsibleUserId) && seSolapan(inicio, minutos, b.scheduledAt, b.durationMinutes))) {
          throw new BookingError("slot_taken", "Conflicto de horario: el responsable ya tiene una cita o bloqueo en ese intervalo");
        }
      }
      const values = {
        title: data.title, description: data.description, notes: data.notes,
        appointmentType: data.appointmentType, location: data.location,
        meetingLink: data.meetingLink, contactId: data.contactId,
        responsibleUserId: data.responsibleUserId, scheduledAt: inicio, durationMinutes: minutos,
        status: data.status === "confirmada" ? "agendada" as const : data.status,
        confirmedAt: data.status === "confirmada" ? previa?.confirmedAt ?? new Date() : null,
        reminderMinutes: data.reminderMinutes, updatedAt: new Date(),
        // Cambiar de contacto no debe conservar enlaces a otra conversación/lead.
        ...(previa && previa.contactId !== data.contactId ? { conversationId: null, leadId: null } : {}),
      };
      const [cita] = previa
        ? await tx.update(schema.booking).set(values).where(scoped(schema.booking.organizationId, org, eq(schema.booking.id, previa.id))).returning()
        : await tx.insert(schema.booking).values({ ...values, id: newId("booking"), organizationId: org, kind: "session", source: "manual" }).returning();
      if (!cita) throw new Error("No se guardó la cita");
      await tx.insert(schema.bookingHistory).values({ id: newId("bookingHistory"), organizationId: org, bookingId: cita.id, actorUserId: session.userId, before: previa ?? null, after: cita });
      return cita;
    });
    publish(org, { type: "booking.updated", data: { bookingId: result.id } });
    return result;
  } catch (error) {
    const e = error as { code?: string; cause?: { code?: string } };
    if (e.code === "23505" || e.cause?.code === "23505") throw new BookingError("slot_taken", "Ese inicio ya está reservado en la agenda del negocio");
    throw error;
  }
}

export async function detalleCita(org: string, id: string) {
  const db = getDb();
  const [booking] = await db.select().from(schema.booking).where(scoped(schema.booking.organizationId, org, eq(schema.booking.id, id)));
  if (!booking) throw new BookingError("not_found", "Cita no encontrada");
  const history = await db.select().from(schema.bookingHistory).where(scoped(schema.bookingHistory.organizationId, org, eq(schema.bookingHistory.bookingId, id))).orderBy(desc(schema.bookingHistory.createdAt)).limit(100);
  return { booking, history };
}

export async function opcionesCitas(org: string) {
  const db = getDb();
  const members = await db.select({ id: schema.user.id, name: schema.user.name }).from(schema.member).innerJoin(schema.user, eq(schema.member.userId, schema.user.id)).where(scoped(schema.member.organizationId, org));
  return { members };
}

export async function proximasCitas(org: string, contactId?: string) {
  return getDb().select().from(schema.booking).where(scoped(schema.booking.organizationId, org,
    eq(schema.booking.isTest, false), eq(schema.booking.status, "agendada"),
    contactId ? eq(schema.booking.contactId, contactId) : undefined,
    gte(schema.booking.scheduledAt, new Date()))).orderBy(asc(schema.booking.scheduledAt)).limit(50);
}

/** Avisos internos derivados de configuración persistida; no envía mensajes. */
export async function recordatoriosCitas(session: SessionContext) {
  return getDb().select().from(schema.booking).where(scoped(schema.booking.organizationId, session.organizationId,
    eq(schema.booking.isTest, false), eq(schema.booking.status, "agendada"),
    and(sql`${schema.booking.reminderMinutes} is not null`,
      sql`${schema.booking.scheduledAt} > now()`,
      sql`${schema.booking.scheduledAt} - ${schema.booking.reminderMinutes} * interval '1 minute' <= now()`,
      sql`(${schema.booking.responsibleUserId} is null or ${schema.booking.responsibleUserId} = ${session.userId})`)
  )).orderBy(asc(schema.booking.scheduledAt)).limit(50);
}
