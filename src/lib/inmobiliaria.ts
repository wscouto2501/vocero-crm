import { z } from "zod";

const texto = z.string().trim().max(10000);
const id = z.string().min(1).max(100);
const importe = z.number().finite().nonnegative().max(1e12);
const cantidad = z.number().int().min(0).max(1000);
const base = z.object({ nombre: texto.min(1).max(200), notas: texto.default(""), archivado: z.boolean().default(false) });
export const tiposInmueble = ["casa", "apartamento", "terreno", "oficina", "local", "bodega", "finca", "otro"] as const;
export const estadosInmueble = ["disponible", "reservado", "negociacion", "vendido", "alquilado", "inactivo"] as const;
export const estadosVisita = ["solicitada", "pendiente", "confirmada", "realizada", "cancelada", "ausente"] as const;
export const etapasIniciales = ["Nuevo interesado", "Primer contacto", "Calificación", "Inmuebles presentados", "Visita agendada", "Visita realizada", "Propuesta enviada", "Negociación", "Cerrado", "Perdido"];
export const esquemas = {
  inmuebles: base.extend({
    codigo: texto.min(1).max(60), descripcion: texto.default(""), tipo: z.enum(tiposInmueble),
    finalidad: z.enum(["venta", "alquiler", "ambos"]), estado: z.enum(estadosInmueble).default("disponible"),
    cp: texto.max(20).default(""), estadoRegion: texto.max(100).default(""), ciudad: texto.max(100).default(""), barrio: texto.max(100).default(""), direccion: texto.default(""), complemento: texto.default(""),
    areaTotal: importe.default(0), areaPrivada: importe.default(0), habitaciones: cantidad.default(0), suites: cantidad.default(0), banos: cantidad.default(0), estacionamientos: cantidad.default(0), salas: cantidad.default(0),
    caracteristicas: z.array(texto.max(100)).max(100).default([]), precioVenta: importe.default(0), alquiler: importe.default(0), condominio: importe.default(0), iptu: importe.default(0), tasas: importe.default(0),
    financiacion: z.boolean().default(false), permuta: z.boolean().default(false), propietarioId: id.optional(), corredorId: id.optional(),
  }).strict(),
  interesados: base.extend({ contactoId: id, perfil: texto.default(""), inmueblesIds: z.array(id).max(200).default([]), presupuestoMin: importe.default(0), presupuestoMax: importe.default(0), tipo: z.enum(tiposInmueble).optional(), ciudades: texto.default(""), barrios: texto.default(""), habitaciones: cantidad.default(0), estacionamientos: cantidad.default(0), caracteristicas: z.array(texto.max(100)).max(100).default([]), pago: texto.default(""), corredorId: id.optional(), historialAtencion: texto.default(""), proximaActividad: texto.default(""), fechaActividad: z.string().datetime().optional(), actividadCompletada: z.boolean().default(false) }).strict().refine(v => v.presupuestoMax === 0 || v.presupuestoMax >= v.presupuestoMin, "Presupuesto máximo menor que el mínimo"),
  propietarios: base.extend({ contactoId: id }).strict(),
  corredores: base.extend({ miembroId: id, registro: texto.max(100).default("") }).strict(),
  etapas: base.extend({ orden: cantidad, resultado: z.enum(["abierta", "ganada", "perdida"]).default("abierta") }).strict(),
  oportunidades: base.extend({ interesadoId: id, inmuebleId: id, corredorId: id, etapaId: id, propuesta: texto.default(""), valor: importe.default(0), motivoPerdida: texto.default("") }).strict(),
  visitas: base.extend({ inmuebleId: id, interesadoId: id, corredorId: id, inicio: z.string().datetime(), fin: z.string().datetime(), lugar: texto.default(""), estado: z.enum(estadosVisita).default("solicitada"), motivoCancelacion: texto.default("") }).strict().superRefine((v, ctx) => {
    if (new Date(v.fin) <= new Date(v.inicio)) ctx.addIssue({ code: "custom", path: ["fin"], message: "El final debe ser posterior al inicio" });
    if (v.estado === "cancelada" && !v.motivoCancelacion.trim()) ctx.addIssue({ code: "custom", path: ["motivoCancelacion"], message: "Indica el motivo de cancelación" });
  }),
};
export type Recurso = keyof typeof esquemas;
export type Datos = { [K in Recurso]: z.infer<(typeof esquemas)[K]> }[Recurso];
export type Registro = { id: string; tipo: Recurso; datos: Datos; createdAt: string; updatedAt: string };
export const recursos = Object.keys(esquemas) as Recurso[];
export function esRecurso(valor: string): valor is Recurso { return recursos.includes(valor as Recurso); }
export const etiquetas: Record<Recurso, string> = { inmuebles: "Inmuebles", interesados: "Clientes interesados", propietarios: "Propietarios", visitas: "Agenda y visitas", corredores: "Corredores", oportunidades: "Oportunidades y negociaciones", etapas: "Etapas del embudo" };
export function seCruzan(a: { inicio: string; fin: string }, b: { inicio: string; fin: string }): boolean {
  return new Date(a.inicio) < new Date(b.fin) && new Date(b.inicio) < new Date(a.fin);
}
export function visitaActiva(datos: z.infer<typeof esquemas.visitas>): boolean {
  return !datos.archivado && !["cancelada", "ausente"].includes(datos.estado);
}
