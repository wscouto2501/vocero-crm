import { beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ authenticated: true, enabled: true, guardar: vi.fn(), detalle: vi.fn() }));
vi.mock("@/lib/auth/session", () => {
  class UnauthorizedError extends Error {}
  return { UnauthorizedError, requireSession: async () => { if (!state.authenticated) throw new UnauthorizedError(); return { userId: "user_a", organizationId: "org_a", role: "member" }; } };
});
vi.mock("@/server/agenda/flag", () => ({ agendaEnabled: () => state.enabled, agendaDisabledResponse: () => new Response(null, { status: 404 }) }));
vi.mock("@/server/agenda/gestion", () => ({ guardarCita: state.guardar, detalleCita: state.detalle, opcionesCitas: async () => ({ members: [] }), proximasCitas: async () => [], recordatoriosCitas: async () => [] }));
beforeEach(() => { state.authenticated = true; state.enabled = true; state.guardar.mockReset().mockResolvedValue({ id: "bk_a" }); state.detalle.mockReset(); });
it("exige sesión antes de consultar o escribir", async () => {
  state.authenticated = false;
  const { GET, POST } = await import("@/app/api/bookings/manage/route");
  expect((await GET(new Request("http://localhost/api/bookings/manage"))).status).toBe(401);
  expect((await POST(new Request("http://localhost/api/bookings/manage", { method: "POST" }))).status).toBe(401);
  expect(state.guardar).not.toHaveBeenCalled();
}, 15000);
it("apagada, la superficie no existe", async () => {
  state.enabled = false;
  const { GET, POST } = await import("@/app/api/bookings/manage/route");
  expect((await GET(new Request("http://localhost/api/bookings/manage"))).status).toBe(404);
  expect((await POST(new Request("http://localhost/api/bookings/manage", { method: "POST" }))).status).toBe(404);
});
it("rechaza campos inválidos sin llamar al dominio", async () => {
  const { POST } = await import("@/app/api/bookings/manage/route");
  expect((await POST(new Request("http://localhost/api/bookings/manage", { method: "POST", body: JSON.stringify({ title: "" }) }))).status).toBe(422);
  expect(state.guardar).not.toHaveBeenCalled();
});
it("el tenant de escritura viene de la sesión, jamás del body", async () => {
  const { POST } = await import("@/app/api/bookings/manage/route");
  const res = await POST(new Request("http://localhost/api/bookings/manage", { method: "POST", body: JSON.stringify({ organizationId: "org_b", title: "Visita", appointmentType: "Venta", startUtc: "2026-11-10T15:00:00Z", endUtc: "2026-11-10T15:30:00Z", status: "agendada" }) }));
  expect(res.status).toBe(201);
  expect(state.guardar.mock.calls[0]?.[0].organizationId).toBe("org_a");
  expect(state.guardar.mock.calls[0]?.[1]).not.toHaveProperty("organizationId");
});
