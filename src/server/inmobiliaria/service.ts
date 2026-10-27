import { randomUUID } from "node:crypto";
import { desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { contact, member, user, inmuebleRegistro as tabla, inmuebleHistorial as historial, inmuebleAdjunto as adjunto } from "@/lib/db/schema";
import { scoped } from "@/lib/db/tenant";
import { canConfigure } from "@/lib/auth/roles";
import type { SessionContext } from "@/lib/auth/session";
import { esquemas, visitaActiva, seCruzan, type Datos, type Recurso } from "@/lib/inmobiliaria";
import { exigirInmobiliaria, ErrorInmobiliario } from "./flag";
import { guardarMedia, leerMedia } from "@/lib/storage/medios";

export async function listar(org: string, tipo?: Recurso) {
  exigirInmobiliaria();
  return getDb().select().from(tabla).where(scoped(tabla.organizationId, org, tipo ? eq(tabla.tipo, tipo) : undefined)).orderBy(desc(tabla.createdAt));
}
export async function opciones(org: string) {
  exigirInmobiliaria();
  const db = getDb();
  const [contactos, miembros] = await Promise.all([
    db.select({ id: contact.id, nombre: contact.name }).from(contact).where(scoped(contact.organizationId, org)),
    db.select({ id: member.id, nombre: user.name }).from(member).innerJoin(user, eq(user.id, member.userId)).where(scoped(member.organizationId, org)),
  ]);
  return { contactos, miembros };
}

/** Todas las escrituras del módulo se serializan por organización, dentro de la
 * transacción. También protege referencias frente a archivo concurrente. */
export async function guardar(session: SessionContext, tipo: Recurso, entrada: unknown, id?: string, version?: string) {
  exigirInmobiliaria();
  if (!["owner", "admin", "member"].includes(session.role)) throw new ErrorInmobiliario(403, "Rol sin permiso de operación");
  if (["etapas", "corredores"].includes(tipo) && !canConfigure(session.role)) throw new ErrorInmobiliario(403, "Solo administración configura etapas y corredores");
  const validado = esquemas[tipo].safeParse(entrada);
  if (!validado.success) throw new ErrorInmobiliario(422, validado.error.issues.map(i => `${i.path.join(".")}: ${i.message}`).join("; "));
  const datos: Datos = validado.data;
  const org = session.organizationId;
  return getDb().transaction(async tx => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`inmobiliaria:${org}`}, 0))`);
    exigirInmobiliaria();
    const registros = await tx.select().from(tabla).where(scoped(tabla.organizationId, org));
    const anterior = id ? registros.find(r => r.id === id && r.tipo === tipo) : undefined;
    if (id && !anterior) throw new ErrorInmobiliario(404, "Registro no encontrado");
    if (anterior && (!version || anterior.updatedAt.toISOString() !== version)) throw new ErrorInmobiliario(409, "El registro cambió. Recarga antes de editar");
    const referencia = (valor: string, clase: Recurso) => {
      const fila = registros.find(r => r.id === valor && r.tipo === clase);
      if (!fila || fila.datos.archivado) throw new ErrorInmobiliario(422, `Referencia no disponible: ${clase}`);
      return fila;
    };
    const objeto = datos as unknown as Record<string, unknown>;
    for (const [campo, clase] of Object.entries({ propietarioId: "propietarios", corredorId: "corredores", inmuebleId: "inmuebles", interesadoId: "interesados", etapaId: "etapas" } as const)) {
      if (typeof objeto[campo] === "string") referencia(objeto[campo], clase);
    }
    if ("contactoId" in datos) {
      const [c] = await tx.select({ id: contact.id }).from(contact).where(scoped(contact.organizationId, org, eq(contact.id, datos.contactoId)));
      if (!c) throw new ErrorInmobiliario(422, "Contacto no encontrado en la organización");
      if (registros.some(r => r.tipo === tipo && r.id !== id && "contactoId" in r.datos && r.datos.contactoId === datos.contactoId)) throw new ErrorInmobiliario(409, "Este contacto ya tiene una ficha; edita la existente");
    }
    if ("miembroId" in datos) {
      const [m] = await tx.select({ id: member.id }).from(member).where(scoped(member.organizationId, org, eq(member.id, datos.miembroId)));
      if (!m) throw new ErrorInmobiliario(422, "Miembro no encontrado en la organización");
      if (registros.some(r => r.id !== id && r.tipo === tipo && "miembroId" in r.datos && r.datos.miembroId === datos.miembroId)) throw new ErrorInmobiliario(409, "El miembro ya tiene ficha de corredor");
    }
    if (tipo === "interesados") esquemas.interesados.parse(datos).inmueblesIds.forEach(valor => referencia(valor, "inmuebles"));
    if (tipo === "inmuebles") {
      const d = esquemas.inmuebles.parse(datos);
      if (registros.some(r => r.id !== id && r.codigo === d.codigo)) throw new ErrorInmobiliario(409, "Código de inmueble duplicado");
    }
    if (tipo === "visitas") {
      const visita = esquemas.visitas.parse(datos);
      if (visitaActiva(visita) && registros.some(r => {
        if (r.tipo !== "visitas" || r.id === id) return false;
        const otra = esquemas.visitas.parse(r.datos);
        return visitaActiva(otra) && otra.corredorId === visita.corredorId && seCruzan(visita, otra);
      })) throw new ErrorInmobiliario(409, "El corredor ya tiene una visita en este horario");
    }
    if (tipo === "oportunidades") {
      const oportunidad = esquemas.oportunidades.parse(datos);
      const etapa = esquemas.etapas.parse(referencia(oportunidad.etapaId, "etapas").datos);
      if (etapa.resultado === "perdida" && !oportunidad.motivoPerdida.trim()) throw new ErrorInmobiliario(422, "Indica el motivo de pérdida");
    }
    const registroId = id ?? `inm_${randomUUID()}`;
    const ahora = new Date();
    const valores = { datos, codigo: "codigo" in datos ? datos.codigo : null, updatedAt: ahora };
    const [registro] = anterior
      ? await tx.update(tabla).set(valores).where(scoped(tabla.organizationId, org, eq(tabla.id, registroId))).returning()
      : await tx.insert(tabla).values({ ...valores, id: registroId, organizationId: org, tipo }).returning();
    await tx.insert(historial).values({ id: `imh_${randomUUID()}`, organizationId: org, registroId, usuarioId: session.userId, anterior: anterior?.datos ?? null, nuevo: datos });
    return registro!;
  });
}

export async function detalle(org: string, id: string) {
  exigirInmobiliaria();
  const db = getDb();
  const [registro] = await db.select().from(tabla).where(scoped(tabla.organizationId, org, eq(tabla.id, id)));
  if (!registro) throw new ErrorInmobiliario(404, "Registro no encontrado");
  const [cambios, archivos] = await Promise.all([
    db.select().from(historial).where(scoped(historial.organizationId, org, eq(historial.registroId, id))).orderBy(desc(historial.createdAt)),
    db.select().from(adjunto).where(scoped(adjunto.organizationId, org, eq(adjunto.registroId, id))),
  ]);
  return { registro, cambios, archivos };
}
const archivoSchema = z.object({ nombre: z.string().min(1).max(200), mime: z.enum(["image/jpeg", "image/png", "image/webp", "application/pdf"]), contenido: z.string().min(1).max(14_000_000).regex(/^[A-Za-z0-9+/]*={0,2}$/) }).strict();
export async function subirArchivo(session: SessionContext, id: string, entrada: unknown) {
  exigirInmobiliaria();
  if (!["owner", "admin", "member"].includes(session.role)) throw new ErrorInmobiliario(403, "Rol sin permiso de operación");
  const parseado = archivoSchema.safeParse(entrada);
  if (!parseado.success) throw new ErrorInmobiliario(422, "Archivo inválido: JPEG, PNG, WebP o PDF; máximo 10 MB");
  const archivo = parseado.data;
  const { registro } = await detalle(session.organizationId, id);
  if (registro.tipo !== "inmuebles") throw new ErrorInmobiliario(422, "Solo los inmuebles admiten archivos");
  const contenido = Buffer.from(archivo.contenido, "base64");
  const firmas: Record<string, boolean> = {
    "image/jpeg": contenido.subarray(0, 3).equals(Buffer.from([255, 216, 255])),
    "image/png": contenido.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])),
    "image/webp": contenido.toString("ascii", 0, 4) === "RIFF" && contenido.toString("ascii", 8, 12) === "WEBP",
    "application/pdf": contenido.toString("ascii", 0, 5) === "%PDF-",
  };
  if (contenido.length > 10 * 1024 * 1024 || !firmas[archivo.mime]) throw new ErrorInmobiliario(422, "Contenido o tamaño de archivo inválido");
  const archivoId = `ima_${randomUUID()}`;
  await guardarMedia(session.organizationId, archivoId, contenido, archivo.mime);
  await getDb().insert(adjunto).values({ id: archivoId, organizationId: session.organizationId, registroId: id, nombre: archivo.nombre, mime: archivo.mime });
  return { id: archivoId };
}
export async function descargarArchivo(org: string, id: string) {
  exigirInmobiliaria();
  const [fila] = await getDb().select().from(adjunto).where(scoped(adjunto.organizationId, org, eq(adjunto.id, id)));
  if (!fila) throw new ErrorInmobiliario(404, "Archivo no encontrado");
  const contenido = await leerMedia(org, fila.id);
  return new Response(new Uint8Array(contenido), { headers: { "Content-Type": fila.mime, "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(fila.nombre)}`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
}
