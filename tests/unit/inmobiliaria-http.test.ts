import { afterEach, expect, it, vi } from "vitest";
vi.mock("@/lib/auth/session", () => ({ requireSession: async () => ({ userId: "u", organizationId: "org_propia", role: "member" }), UnauthorizedError: class extends Error {} }));
vi.mock("@/server/inmobiliaria/service", async () => {
  const { ErrorInmobiliario } = await import("@/server/inmobiliaria/flag");
  return { descargarArchivo: vi.fn(async () => { throw new ErrorInmobiliario(404, "Archivo no encontrado"); }), listar: vi.fn(), guardar: vi.fn(), detalle: vi.fn(), opciones: vi.fn(), subirArchivo: vi.fn() };
});
import { atender } from "@/server/inmobiliaria/http";
import { descargarArchivo } from "@/server/inmobiliaria/service";
afterEach(() => vi.unstubAllEnvs());
it("un adjunto ajeno responde 404, también cuando la lectura falla asincrónicamente", async () => {
  vi.stubEnv("FEATURE_REAL_ESTATE", "true");
  const respuesta = await atender(new Request("http://localhost/api/real-estate/archivos?archivo=ajeno"), { params: Promise.resolve({ recurso: "archivos" }) });
  expect(respuesta.status).toBe(404);
  expect(descargarArchivo).toHaveBeenCalledWith("org_propia", "ajeno");
});
