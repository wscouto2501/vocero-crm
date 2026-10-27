import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import { resetRateLimit } from "@/lib/rate-limit";
const estado = vi.hoisted(() => ({ cola: [] as unknown[][], condiciones: [] as unknown[] }));
vi.mock("@/lib/db", async original => {
  const real = await original<typeof import("@/lib/db")>();
  const builder: Record<string, unknown> = {};
  for (const m of ["select", "from", "limit", "orderBy"]) builder[m] = () => builder;
  builder.where = (condicion: unknown) => { estado.condiciones.push(condicion); return builder; };
  builder.then = (resolve: (v: unknown) => void) => resolve(estado.cola.shift() ?? []);
  return { ...real, getDb: () => builder };
});
vi.mock("@/server/bot/auth", async original => ({ ...await original<typeof import("@/server/bot/auth")>(), resolveInstanceOrg: async () => "org_propia" }));
import { buscarInmuebles } from "@/server/bot/inmuebles";
import { capacidadInmobiliaria, consultarInmuebles, consultaCatalogoSchema, inmuebleComercial } from "@/server/inmobiliaria/catalogo-bot";
const key = "bot-key-local-inmobiliaria-065";
const datos = { nombre: "Casa", codigo: "C-1", tipo: "casa", finalidad: "venta", precioVenta: 300000, notas: "SECRETO", direccion: "DIRECCION_PRIVADA", propietarioId: "PROPIETARIO_PRIVADO", corredorId: "CORREDOR_PRIVADO" };
const consultar = (query = "conversationId=cv_1", autorizado = true) => buscarInmuebles(new Request(`http://localhost/api/bot/real-estate/properties?${query}`, { headers: autorizado ? { "X-API-Key": key } : {} }));
beforeEach(() => { estado.cola = []; estado.condiciones = []; resetRateLimit(); vi.stubEnv("BOT_API_KEY", key); vi.stubEnv("FEATURE_REAL_ESTATE", "true"); });
afterEach(() => vi.unstubAllEnvs());
describe("065 — API inmobiliaria del cerebro", () => {
  it.each(["false", "", "incorrecto"])("%s: 404 sin autenticar ni consultar BD y capacidad ausente", async valor => {
    vi.stubEnv("FEATURE_REAL_ESTATE", valor);
    expect((await consultar(undefined, false)).status).toBe(404);
    expect(capacidadInmobiliaria()).toEqual({}); expect(estado.condiciones).toHaveLength(0);
    await expect(consultarInmuebles("org_propia", { conversationId: "cv_1", limit: 5 })).rejects.toMatchObject({ status: 404 });
  });
  it("capacidad aditiva solo encendida", () => expect(capacidadInmobiliaria()).toEqual({ realEstate: { version: 1, searchPath: "/api/bot/real-estate/properties" } }));
  it("401 sin llave; nada de BD", async () => { expect((await consultar(undefined, false)).status).toBe(401); expect(estado.condiciones).toHaveLength(0); });
  it.each(["", "conversationId=x&organizationId=otra", "conversationId=x&limit=11", "conversationId=x&minPrice=20", "conversationId=x&purpose=venta&minPrice=20&maxPrice=10", "conversationId=x&minBedrooms=-1", "conversationId=x&code=A&code=B", "conversationId=x&minArea=100&maxArea=10"])("rechaza query %s", async q => { expect((await consultar(q)).status).toBe(422); expect(estado.condiciones).toHaveLength(0); });
  it("404 para conversación ajena", async () => { estado.cola = [[]]; expect((await consultar()).status).toBe(404); });
  it.each([{ aiEnabled: false, handoffAt: null }, { aiEnabled: true, handoffAt: new Date() }])("409 para IA pausada o handoff", async conv => { estado.cola = [[conv]]; const r = await consultar(); expect(r.status).toBe(409); expect((await r.json()).error.code).toBe("ai_paused"); expect(estado.condiciones).toHaveLength(1); });
  it("devuelve datos comerciales, límites y cache desactivada", async () => {
    estado.cola = [[{ aiEnabled: true, handoffAt: null }], [{ datos }, { datos }]];
    const r = await consultar("conversationId=cv_1&limit=1&city=Sao%20Paulo&purpose=venta&maxPrice=350000&minBedrooms=2&features=piscina");
    expect(r.status).toBe(200); expect(r.headers.get("cache-control")).toBe("private, no-store");
    const body = await r.json(); expect(body.properties).toHaveLength(1); expect(body.hasMore).toBe(true); expect(body.currency).toBe("BRL");
    const json = JSON.stringify(body); for (const privado of ["SECRETO", "DIRECCION_PRIVADA", "PROPIETARIO_PRIVADO", "CORREDOR_PRIVADO"]) expect(json).not.toContain(privado);
    const dialect = new PgDialect();
    for (const condicion of estado.condiciones) { const q = dialect.sqlToQuery(condicion as Parameters<typeof dialect.sqlToQuery>[0]); expect(q.params).toContain("org_propia"); }
    const inventario = dialect.sqlToQuery(estado.condiciones[1] as Parameters<typeof dialect.sqlToQuery>[0]);
    expect(inventario.sql).toContain("'disponible'"); expect(inventario.sql).toContain("'archivado'"); expect(inventario.params).toContain(350000);
  });
  it("lista vacía no inventa inmuebles", async () => { estado.cola = [[{ aiEnabled: true }], []]; const r = await consultar(); expect((await r.json()).properties).toEqual([]); });
  it("la proyección nunca expone la fila ni precios de otra finalidad", () => { const p = inmuebleComercial(datos); expect(p.salePrice).toBe(300000); expect(p.rentPrice).toBeNull(); expect(p).not.toHaveProperty("notas"); expect(p).not.toHaveProperty("id"); });
  it("valida rangos incluso cuando se llama sin HTTP", () => { expect(consultaCatalogoSchema.safeParse({ conversationId: "x", purpose: "venta", maxPrice: NaN }).success).toBe(false); });
});
