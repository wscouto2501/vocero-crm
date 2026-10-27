import { afterEach, describe, expect, it, vi } from "vitest";
import { parseRealEstateFlag } from "@/server/inmobiliaria/flag";
import { appNavGroups } from "@/lib/nav";
import { esquemas, seCruzan } from "@/lib/inmobiliaria";
import { indicadores } from "@/lib/inmobiliaria-dashboard";

const db = vi.hoisted(() => ({ getDb: vi.fn(() => { throw new Error("No debe consultar BD"); }) }));
vi.mock("@/lib/db", () => db);
vi.mock("@/lib/auth/session", () => ({ requireSession: vi.fn(() => { throw new Error("No debe autenticar apagado"); }), UnauthorizedError: class extends Error {} }));
import { atender } from "@/server/inmobiliaria/http";
import { listar, guardar, detalle, opciones, subirArchivo, descargarArchivo } from "@/server/inmobiliaria/service";
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });
describe("064 — bandera, navegación y aislamiento apagado", () => {
  it.each([undefined, "", "false", "TRUE", "1", "on", " true ", "incorrecto"])("apagado con %s", valor => expect(parseRealEstateFlag(valor)).toBe(false));
  it("solo true habilita", () => expect(parseRealEstateFlag("true")).toBe(true));
  it("menú conserva CRM y añade solo la entrada opcional", () => {
    const apagado = appNavGroups({}).flatMap(g => g.items).map(i => i.href);
    const activo = appNavGroups({ inmobiliaria: true }).flatMap(g => g.items);
    expect(apagado).toContain("/inbox"); expect(apagado).toContain("/contacts");
    expect(apagado).not.toContain("/real-estate");
    expect(activo.find(i => i.href === "/real-estate")?.label).toBe("Gestão Imobiliária");
    expect(activo.filter(i => i.href !== "/real-estate").map(i => i.href)).toEqual(apagado);
  });
  it.each(["false", "", "invalido"])("API apagada con %s responde 404 antes de auth o BD", async valor => {
    vi.stubEnv("FEATURE_REAL_ESTATE", valor);
    for (const method of ["GET", "POST", "PATCH"]) for (const recurso of ["inmuebles", "visitas", "archivos", "opciones"]) expect((await atender(new Request(`http://localhost/api/real-estate/${recurso}`, { method }), { params: Promise.resolve({ recurso }) })).status).toBe(404);
    expect(db.getDb).not.toHaveBeenCalled();
  });
  it("todas las puertas de datos rechazan sin tocar BD", async () => {
    vi.stubEnv("FEATURE_REAL_ESTATE", "false");
    const sesion = { userId: "u", organizationId: "o", role: "owner" };
    for (const operacion of [() => listar("o"), () => opciones("o"), () => guardar(sesion, "inmuebles", {}), () => detalle("o", "x"), () => subirArchivo(sesion, "x", {}), () => descargarArchivo("o", "x")]) await expect(operacion()).rejects.toMatchObject({ status: 404 });
    expect(db.getDb).not.toHaveBeenCalled();
  });
});
describe("064 — validación", () => {
  it("ficha completa conserva atributos y rechaza campos arbitrarios", () => {
    const inmueble = { nombre: "Casa", codigo: "C-01", tipo: "casa", finalidad: "ambos", precioVenta: 200000, caracteristicas: ["piscina", "jardín"] };
    expect(esquemas.inmuebles.parse(inmueble).caracteristicas).toContain("piscina");
    expect(esquemas.inmuebles.safeParse({ ...inmueble, organizationId: "otra" }).success).toBe(false);
    expect(esquemas.inmuebles.safeParse({ ...inmueble, precioVenta: -1 }).success).toBe(false);
  });
  const visita = { nombre: "Visita", inmuebleId: "i", interesadoId: "c", corredorId: "r", inicio: "2026-10-25T10:00:00.000Z", fin: "2026-10-25T11:00:00.000Z" };
  it("rechaza final anterior y cancelación sin motivo", () => {
    expect(esquemas.visitas.safeParse(visita).success).toBe(true);
    expect(esquemas.visitas.safeParse({ ...visita, fin: visita.inicio }).success).toBe(false);
    expect(esquemas.visitas.safeParse({ ...visita, estado: "cancelada" }).success).toBe(false);
  });
  it("detecta solapamiento, permite visitas contiguas y compara instantes", () => {
    expect(seCruzan(visita, { inicio: "2026-10-25T10:30:00Z", fin: "2026-10-25T12:00:00Z" })).toBe(true);
    expect(seCruzan(visita, { inicio: visita.fin, fin: "2026-10-25T12:00:00Z" })).toBe(false);
    expect(seCruzan(visita, { inicio: "2026-10-25T07:30:00-03:00", fin: "2026-10-25T08:30:00-03:00" })).toBe(true);
  });
  it("dashboard vacío sin métricas inventadas", () => {
    expect(Object.values(indicadores([]).metricas).every(v => v === 0)).toBe(true);
  });
});
