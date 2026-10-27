import { asc, eq, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@/lib/db";
import { scoped } from "@/lib/db/tenant";
import { normalizeText } from "@/lib/search";
import { esquemas, tiposInmueble } from "@/lib/inmobiliaria";
import { exigirInmobiliaria, inmobiliariaActiva, ErrorInmobiliario } from "./flag";

const texto = z.string().trim().min(1).max(120);
const numero = z.coerce.number().finite().nonnegative().max(1e12);
export const consultaCatalogoSchema = z.object({
  conversationId: texto,
  code: texto.optional(), query: texto.optional(), type: z.enum(tiposInmueble).optional(),
  purpose: z.enum(["venta", "alquiler"]).optional(), city: texto.optional(), neighborhood: texto.optional(),
  minPrice: numero.optional(), maxPrice: numero.optional(), minArea: numero.optional(), maxArea: numero.optional(),
  minBedrooms: numero.int().max(1000).optional(), minParking: numero.int().max(1000).optional(),
  features: texto.optional(), limit: z.coerce.number().int().min(1).max(10).default(5),
}).strict().superRefine((v, ctx) => {
  if ((v.minPrice !== undefined || v.maxPrice !== undefined) && !v.purpose) ctx.addIssue({ code: "custom", path: ["purpose"], message: "Indica venta o alquiler para filtrar precios" });
  if (v.minPrice !== undefined && v.maxPrice !== undefined && v.minPrice > v.maxPrice) ctx.addIssue({ code: "custom", path: ["maxPrice"], message: "Rango de precios inválido" });
  if (v.minArea !== undefined && v.maxArea !== undefined && v.minArea > v.maxArea) ctx.addIssue({ code: "custom", path: ["maxArea"], message: "Rango de área inválido" });
});
export type ConsultaCatalogo = z.infer<typeof consultaCatalogoSchema>;

/** Capacidad aditiva, sin consultar inventario ni depender de secretos. */
export function capacidadInmobiliaria() {
  return inmobiliariaActiva() ? { realEstate: { version: 1, searchPath: "/api/bot/real-estate/properties" } } : {};
}

/** Lista blanca; jamás serializar la fila o datos completos hacia el cerebro. */
export function inmuebleComercial(entrada: unknown) {
  const d = esquemas.inmuebles.parse(entrada);
  return {
    code: d.codigo, title: d.nombre, description: d.descripcion.slice(0, 2000), type: d.tipo, purpose: d.finalidad,
    city: d.ciudad, neighborhood: d.barrio, region: d.estadoRegion,
    totalArea: d.areaTotal, privateArea: d.areaPrivada, bedrooms: d.habitaciones, suites: d.suites,
    bathrooms: d.banos, parking: d.estacionamientos, livingRooms: d.salas,
    features: d.caracteristicas.slice(0, 30),
    salePrice: ["venta", "ambos"].includes(d.finalidad) ? d.precioVenta : null,
    rentPrice: ["alquiler", "ambos"].includes(d.finalidad) ? d.alquiler : null,
    condominium: d.condominio, propertyTax: d.iptu, additionalFees: d.tasas,
    financing: d.financiacion, exchange: d.permuta,
  };
}
const ACENTOS = "áàäâãéèëêíìïîóòöôõúùüûñçÁÀÄÂÃÉÈËÊÍÌÏÎÓÒÖÔÕÚÙÜÛÑÇ";
const SIMPLES = "aaaaaeeeeiiiiooooouuuuncAAAAAEEEEIIIIOOOOOUUUUNC";
const tabla = schema.inmuebleRegistro;
function cadena(campo: string) { return sql`lower(translate(coalesce(${tabla.datos}->>${campo}, ''), ${ACENTOS}, ${SIMPLES}))`; }
function contiene(campo: string, valor: string) {
  const patron = `%${normalizeText(valor).replace(/[\\%_]/g, "\\$&")}%`;
  return sql`${cadena(campo)} like ${patron}`;
}
export async function consultarInmuebles(org: string, consulta: ConsultaCatalogo) {
  exigirInmobiliaria();
  // El servicio revalida incluso a los consumidores internos.
  const q = consultaCatalogoSchema.parse(consulta);
  const db = getDb();
  const [conversacion] = await db.select({ aiEnabled: schema.conversation.aiEnabled, handoffAt: schema.conversation.handoffAt })
    .from(schema.conversation).where(scoped(schema.conversation.organizationId, org, eq(schema.conversation.id, q.conversationId))).limit(1);
  if (!conversacion) throw new ErrorInmobiliario(404, "Conversación no encontrada");
  if (!conversacion.aiEnabled || conversacion.handoffAt) throw new ErrorInmobiliario(409, "ai_paused");
  const condiciones: SQL[] = [eq(tabla.tipo, "inmuebles"), sql`${tabla.datos}->>'estado' = 'disponible'`, sql`${tabla.datos}->>'archivado' = 'false'`];
  if (q.code) condiciones.push(sql`${cadena("codigo")} = ${normalizeText(q.code)}`);
  if (q.type) condiciones.push(sql`${tabla.datos}->>'tipo' = ${q.type}`);
  if (q.purpose) condiciones.push(sql`${tabla.datos}->>'finalidad' in (${q.purpose}, 'ambos')`);
  if (q.city) condiciones.push(contiene("ciudad", q.city));
  if (q.neighborhood) condiciones.push(contiene("barrio", q.neighborhood));
  if (q.query) condiciones.push(sql`(${contiene("nombre", q.query)} or ${contiene("codigo", q.query)} or ${contiene("ciudad", q.query)} or ${contiene("barrio", q.query)})`);
  const precio = q.purpose === "alquiler" ? "alquiler" : "precioVenta";
  for (const [campo, minimo, maximo] of [[precio, q.minPrice, q.maxPrice], ["areaTotal", q.minArea, q.maxArea], ["habitaciones", q.minBedrooms, undefined], ["estacionamientos", q.minParking, undefined]] as const) {
    if (minimo !== undefined) condiciones.push(sql`(${tabla.datos}->>${campo})::numeric >= ${minimo}`);
    if (maximo !== undefined) condiciones.push(sql`(${tabla.datos}->>${campo})::numeric <= ${maximo}`);
  }
  for (const caracteristica of (q.features ?? "").split(",").map(c => c.trim()).filter(Boolean)) {
    condiciones.push(sql`exists (select 1 from jsonb_array_elements_text(${tabla.datos}->'caracteristicas') as c(valor) where lower(translate(c.valor, ${ACENTOS}, ${SIMPLES})) = ${normalizeText(caracteristica)})`);
  }
  const filas = await db.select({ datos: tabla.datos }).from(tabla).where(scoped(tabla.organizationId, org, ...condiciones)).orderBy(asc(tabla.codigo), asc(tabla.id)).limit(q.limit + 1);
  return { properties: filas.slice(0, q.limit).map(f => inmuebleComercial(f.datos)), returned: Math.min(filas.length, q.limit), hasMore: filas.length > q.limit, currency: "BRL", checkedAt: new Date().toISOString() };
}
