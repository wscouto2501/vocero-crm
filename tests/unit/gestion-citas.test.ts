import { beforeEach, describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import { citaSchema, seSolapan } from "@/lib/citas";
import { schema } from "@/lib/db";

const state = vi.hoisted(() => ({ rows: [] as unknown[][], writes: [] as { table: unknown; values: Record<string, unknown> }[], filters: [] as unknown[], events: [] as unknown[] }));
vi.mock("@/server/events/bus", () => ({ publish: (...args: unknown[]) => state.events.push(args) }));
vi.mock("@/lib/db", async (original) => {
  const actual = await original<typeof import("@/lib/db")>();
  const chain = () => {
    const rows = state.rows.shift() ?? [];
    const c = { from: () => c, where: (filter: unknown) => { state.filters.push(filter); return c; }, for: () => Promise.resolve(rows), then: (resolve: (v: unknown[]) => unknown) => Promise.resolve(rows).then(resolve) };
    return c;
  };
  const tx = {
    execute: vi.fn(), select: chain,
    insert: (table: unknown) => ({ values: (values: Record<string, unknown>) => {
      state.writes.push({ table, values });
      return { returning: async () => [{ ...values }] };
    } }),
    update: (table: unknown) => ({ set: (values: Record<string, unknown>) => ({ where: (filter: unknown) => {
      state.filters.push(filter); state.writes.push({ table, values });
      return { returning: async () => [{ ...baseRow, ...values }] };
    } }) }),
  };
  return { ...actual, getDb: () => ({ transaction: (fn: (t: typeof tx) => unknown) => fn(tx) }) };
});
const session = { organizationId: "org_a", userId: "user_a", role: "member" };
const input = { title: "Consulta", appointmentType: "Venta", startUtc: "2026-11-10T15:00:00Z", endUtc: "2026-11-10T15:30:00Z", status: "agendada" as const, contactId: "ct_a", responsibleUserId: "user_a" };
const baseRow = { id: "bk_a", organizationId: "org_a", kind: "session", isTest: false, status: "agendada", contactId: "ct_a", responsibleUserId: "user_a", scheduledAt: new Date(input.startUtc), durationMinutes: 30, externalRef: null, confirmedAt: null };

beforeEach(() => { state.rows.length = 0; state.writes.length = 0; state.filters.length = 0; state.events.length = 0; });
describe("gestión de citas", () => {
  it("valida título, intervalo, minutos y enlaces en el servidor", () => {
    expect(citaSchema.safeParse(input).success).toBe(true);
    for (const patch of [{ title: " " }, { endUtc: input.startUtc }, { startUtc: "2026-11-10T15:00" }, { meetingLink: "javascript:alert(1)" }, { reminderMinutes: -1 }, { endUtc: "2026-11-11T15:00:00Z" }]) expect(citaSchema.safeParse({ ...input, ...patch }).success).toBe(false);
  });
  it("los intervalos contiguos no chocan", () => {
    expect(seSolapan(new Date(input.startUtc), 30, new Date(input.endUtc), 30)).toBe(false);
    expect(seSolapan(new Date(input.startUtc), 30, new Date("2026-11-10T15:15:00Z"), 30)).toBe(true);
  });
  it("crea con auditoría y publica después de escribir", async () => {
    state.rows.push([{ id: "ct_a" }], [{ id: "member_a" }], []);
    const { guardarCita } = await import("@/server/agenda/gestion");
    const result = await guardarCita(session, input);
    expect(result.title).toBe("Consulta");
    expect(result.durationMinutes).toBe(30);
    expect(state.writes.map((w) => w.table)).toEqual([schema.booking, schema.bookingHistory]);
    expect(state.writes[1]?.values).toMatchObject({ organizationId: "org_a", actorUserId: "user_a", before: null });
    expect(state.events).toHaveLength(1);
  });
  it("edita conservando el antes y confirma sin cambiar el enum público", async () => {
    state.rows.push([baseRow], [{ id: "ct_a" }], [{ id: "member_a" }], []);
    const { guardarCita } = await import("@/server/agenda/gestion");
    const result = await guardarCita(session, { ...input, title: "Consulta nueva", status: "confirmada" }, "bk_a");
    expect(result.status).toBe("agendada");
    expect(result.confirmedAt).toBeInstanceOf(Date);
    expect(state.writes[1]?.values.before).toEqual(baseRow);
  });
  it("cancela sin borrar y preserva el historial", async () => {
    state.rows.push([baseRow], [{ id: "ct_a" }], [{ id: "member_a" }]);
    const { guardarCita } = await import("@/server/agenda/gestion");
    expect((await guardarCita(session, { ...input, status: "cancelada" }, "bk_a")).status).toBe("cancelada");
    expect(state.writes).toHaveLength(2);
    expect(state.writes[1]?.values.before).toEqual(baseRow);
  });
  it("rechaza un solapamiento sin escribir", async () => {
    state.rows.push([{ id: "ct_a" }], [{ id: "member_a" }], [{ ...baseRow, id: "bk_ocupada", scheduledAt: new Date("2026-11-10T15:15:00Z") }]);
    const { guardarCita } = await import("@/server/agenda/gestion");
    await expect(guardarCita(session, input)).rejects.toMatchObject({ code: "slot_taken" });
    expect(state.writes).toHaveLength(0);
  });
  it("no edita una cita ausente del scope y filtra por organización", async () => {
    state.rows.push([]);
    const { guardarCita } = await import("@/server/agenda/gestion");
    await expect(guardarCita(session, input, "bk_otro_tenant")).rejects.toMatchObject({ code: "not_found" });
    const query = new PgDialect().sqlToQuery(state.filters[0] as Parameters<PgDialect["sqlToQuery"]>[0]);
    expect(query.params).toEqual(["org_a", "bk_otro_tenant"]);
    expect(query.sql).toContain('"booking"."organization_id"');
    expect(state.writes).toHaveLength(0);
  });
  it("no acepta contactos ni responsables ajenos", async () => {
    const { guardarCita } = await import("@/server/agenda/gestion");
    state.rows.push([]);
    await expect(guardarCita(session, input)).rejects.toMatchObject({ code: "not_found" });
    state.rows.push([{ id: "ct_a" }], []);
    await expect(guardarCita(session, input)).rejects.toMatchObject({ code: "not_found" });
    expect(state.writes).toHaveLength(0);
    for (const filter of state.filters) expect(new PgDialect().sqlToQuery(filter as Parameters<PgDialect["sqlToQuery"]>[0]).params).toContain("org_a");
  });
});
