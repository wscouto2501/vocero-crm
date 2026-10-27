"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { canConfigure } from "@/lib/auth/roles";
import { campos, type Campo } from "@/lib/inmobiliaria-form";
import { etiquetas, esRecurso, recursos, esquemas, etapasIniciales, tiposInmueble, estadosInmueble, type Recurso, type Registro } from "@/lib/inmobiliaria";
import { indicadores, diaLocal } from "@/lib/inmobiliaria-dashboard";

type Opcion = { id: string; nombre: string };
type Opciones = { contactos: Opcion[]; miembros: Opcion[] };
type Detalle = { cambios: { id: string; usuarioId: string; createdAt: string; anterior: unknown; nuevo: unknown }[]; archivos: { id: string; nombre: string; mime: string }[] };
const estilo = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground";
const boton = "rounded-md border px-3 py-2 text-sm hover:bg-accent disabled:opacity-50";
const principal = `${boton} bg-primary text-primary-foreground`;
async function pedir(url: string, opciones?: RequestInit) {
  const respuesta = await fetch(`/api/real-estate/${url}`, opciones);
  if (!respuesta.ok) { const error = await respuesta.json().catch(() => null); throw new Error(error?.error?.message ?? `Error ${respuesta.status}`); }
  return respuesta.json();
}
function fechaLocal(valor: unknown) {
  if (typeof valor !== "string" || !valor) return "";
  const fecha = new Date(valor);
  return `${diaLocal(fecha)}T${String(fecha.getHours()).padStart(2, "0")}:${String(fecha.getMinutes()).padStart(2, "0")}`;
}
export function InmobiliariaClient({ seccion, rol }: { seccion: string; rol: string }) {
  const [registros, setRegistros] = useState<Registro[]>([]);
  const [opciones, setOpciones] = useState<Opciones>({ contactos: [], miembros: [] });
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(true);
  const [ocupado, setOcupado] = useState(false);
  const [editor, setEditor] = useState<{ tipo: Recurso; registro?: Registro; datos: Record<string, unknown> } | null>(null);
  const [detalle, setDetalle] = useState<Detalle | null>(null);
  const [filtros, setFiltros] = useState<Record<string, string>>({});
  const [vista, setVista] = useState("semana");
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [zona, setZona] = useState("UTC");
  useEffect(() => { setFecha(diaLocal(new Date())); setZona(Intl.DateTimeFormat().resolvedOptions().timeZone); }, []);
  const configurar = canConfigure(rol);
  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const resultados = await Promise.all(recursos.map(tipo => pedir(tipo)));
      setRegistros(resultados.flatMap(r => r.registros));
      setOpciones(await pedir("opciones"));
    } catch (e) { setError((e as Error).message); }
    finally { setCargando(false); }
  }, []);
  useEffect(() => { void cargar(); }, [cargar]);
  useEffect(() => { setEditor(null); setDetalle(null); setFiltros({}); }, [seccion]);
  const nombre = (id: unknown) => registros.find(r => r.id === id)?.datos.nombre ?? opciones.contactos.find(c => c.id === id)?.nombre ?? opciones.miembros.find(c => c.id === id)?.nombre ?? String(id ?? "");
  function nuevo(tipo: Recurso, datos: Record<string, unknown> = {}) {
    setError(""); setDetalle(null);
    setEditor({ tipo, datos: { ...Object.fromEntries(campos[tipo].filter(c => c.opciones).map(c => [c.clave, c.opciones![0]])), ...datos } });
  }
  async function editar(registro: Registro) {
    setEditor({ tipo: registro.tipo, registro, datos: { ...registro.datos } });
    setError(""); setDetalle(null);
    try { setDetalle(await pedir(`${registro.tipo}?id=${registro.id}`)); } catch (e) { setError((e as Error).message); }
  }
  async function guardar(evento: React.FormEvent) {
    evento.preventDefault();
    if (!editor) return;
    setError(""); setOcupado(true);
    try {
      const validado = esquemas[editor.tipo].safeParse(editor.datos);
      if (!validado.success) throw new Error(validado.error.issues.map(i => `${i.path.join(".")}: ${i.message}`).join("; "));
      await pedir(editor.tipo, { method: editor.registro ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: editor.registro?.id, version: editor.registro?.updatedAt, datos: validado.data }) });
      setEditor(null); setDetalle(null); await cargar();
    } catch (e) { setError((e as Error).message); } finally { setOcupado(false); }
  }
  async function crearEtapas() {
    setOcupado(true); setError("");
    try {
      for (const [orden, nombreEtapa] of etapasIniciales.entries()) {
        if (registros.some(r => r.tipo === "etapas" && r.datos.nombre === nombreEtapa)) continue;
        await pedir("etapas", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ datos: { nombre: nombreEtapa, orden, resultado: orden === 8 ? "ganada" : orden === 9 ? "perdida" : "abierta" } }) });
      }
      await cargar();
    } catch (e) { setError((e as Error).message); } finally { setOcupado(false); }
  }
  function campo(c: Campo) {
    if (!editor) return null;
    const valor = editor.datos[c.clave];
    const cambiar = (v: unknown) => setEditor({ ...editor, datos: { ...editor.datos, [c.clave]: v } });
    const opts = c.referencia ? (c.referencia === "contactos" || c.referencia === "miembros" ? opciones[c.referencia] : registros.filter(r => r.tipo === c.referencia && !r.datos.archivado).map(r => ({ id: r.id, nombre: r.datos.nombre }))) : [];
    return <div key={c.clave} className="flex flex-col gap-1 text-sm"><label htmlFor={`inm-${c.clave}`}>{c.etiqueta}</label>{c.referencia ? <select id={`inm-${c.clave}`} className={estilo} required={c.obligatorio} multiple={c.multiple} value={c.multiple ? (valor as string[] ?? []) : String(valor ?? "")} onChange={e => cambiar(c.multiple ? Array.from(e.target.selectedOptions, o => o.value) : e.target.value || undefined)}>{!c.multiple && <option value="">Seleccionar</option>}{opts.map(o => <option key={o.id} value={o.id}>{o.nombre}</option>)}</select> : c.opciones ? <select id={`inm-${c.clave}`} className={estilo} value={String(valor ?? "")} onChange={e => cambiar(e.target.value || undefined)}><option value="">Seleccionar</option>{c.opciones.map(o => <option key={o} value={o}>{o}</option>)}</select> : c.tipo === "booleano" ? <input id={`inm-${c.clave}`} type="checkbox" checked={Boolean(valor)} onChange={e => cambiar(e.target.checked)} /> : c.tipo === "textoLargo" ? <textarea id={`inm-${c.clave}`} className={estilo} rows={3} value={String(valor ?? "")} onChange={e => cambiar(e.target.value)} /> : <input id={`inm-${c.clave}`} className={estilo} type={c.tipo === "numero" ? "number" : c.tipo === "fecha" ? "datetime-local" : "text"} min={c.tipo === "numero" ? 0 : undefined} step={c.tipo === "numero" ? "any" : undefined} value={c.tipo === "fecha" ? fechaLocal(valor) : c.tipo === "lista" ? (Array.isArray(valor) ? valor.join(", ") : "") : String(valor ?? "")} onChange={e => cambiar(c.tipo === "numero" ? Number(e.target.value) : c.tipo === "fecha" ? (e.target.value ? new Date(e.target.value).toISOString() : undefined) : c.tipo === "lista" ? e.target.value.split(",").map(v => v.trim()).filter(Boolean) : e.target.value)} />}</div>;
  }
  async function subir(archivo: File) {
    if (!editor?.registro) return;
    if (archivo.size > 10 * 1024 * 1024) { setError("El archivo supera 10 MB"); return; }
    setOcupado(true); setError("");
    try {
      const base64 = await new Promise<string>((resolve, reject) => { const lector = new FileReader(); lector.onload = () => resolve(String(lector.result).split(",")[1]!); lector.onerror = reject; lector.readAsDataURL(archivo); });
      await pedir(`archivos?id=${editor.registro.id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nombre: archivo.name, mime: archivo.type, contenido: base64 }) });
      setDetalle(await pedir(`${editor.tipo}?id=${editor.registro.id}`));
    } catch (e) { setError((e as Error).message); } finally { setOcupado(false); }
  }
  const tablero = indicadores(registros);
  const tipo = esRecurso(seccion) ? seccion : null;
  const lista = registros.filter(r => {
    if (r.tipo !== tipo || (!filtros.archivados && r.datos.archivado)) return false;
    const d = r.datos as unknown as Record<string, unknown>;
    if (filtros.buscar && !JSON.stringify(d).toLocaleLowerCase().includes(filtros.buscar.toLocaleLowerCase())) return false;
    for (const clave of ["tipo", "finalidad", "estado", "corredorId"]) if (filtros[clave] && d[clave] !== filtros[clave]) return false;
    for (const clave of ["ciudad", "barrio"]) if (filtros[clave] && !String(d[clave]).toLocaleLowerCase().includes(filtros[clave].toLocaleLowerCase())) return false;
    const precio = filtros.finalidad === "alquiler" ? Number(d.alquiler) : Number(d.precioVenta);
    if (filtros.precioMin && precio < Number(filtros.precioMin)) return false;
    if (filtros.precioMax && precio > Number(filtros.precioMax)) return false;
    if (filtros.areaMin && Number(d.areaTotal) < Number(filtros.areaMin)) return false;
    if (filtros.areaMax && Number(d.areaTotal) > Number(filtros.areaMax)) return false;
    if (filtros.habitaciones && Number(d.habitaciones) < Number(filtros.habitaciones)) return false;
    return true;
  });
  const filtro = (clave: string, etiqueta: string, opcionesFiltro?: Opcion[]) => <label key={clave} className="text-xs">{etiqueta}{opcionesFiltro ? <select className={estilo} value={filtros[clave] ?? ""} onChange={e => setFiltros({ ...filtros, [clave]: e.target.value })}><option value="">Todos</option>{opcionesFiltro.map(o => <option key={o.id} value={o.id}>{o.nombre}</option>)}</select> : <input className={estilo} value={filtros[clave] ?? ""} onChange={e => setFiltros({ ...filtros, [clave]: e.target.value })} />}</label>;
  const fila = (registro: Registro) => {
    const d = registro.datos as unknown as Record<string, unknown>;
    return <article key={registro.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-4"><div><button className="font-semibold underline" onClick={() => void editar(registro)}>{registro.datos.nombre}</button><p className="text-sm text-muted-foreground">{[d.codigo, d.estado, d.ciudad, d.barrio, d.etapaId ? nombre(d.etapaId) : "", d.inicio ? new Date(String(d.inicio)).toLocaleString() : "", registro.datos.archivado ? "Archivado" : ""].filter(Boolean).join(" · ")}</p>{registro.tipo === "inmuebles" && <p className="text-sm">{Number(d.precioVenta).toLocaleString(undefined, { style: "currency", currency: "BRL" })} · Alquiler: {Number(d.alquiler).toLocaleString(undefined, { style: "currency", currency: "BRL" })}</p>}</div><div className="flex gap-2"><button className={boton} onClick={() => void editar(registro)}>Abrir ficha</button>{["inmuebles", "interesados"].includes(registro.tipo) && !registro.datos.archivado && <button className={boton} onClick={() => nuevo("visitas", { [registro.tipo === "inmuebles" ? "inmuebleId" : "interesadoId"]: registro.id, corredorId: d.corredorId })}>Agendar visita</button>}</div></article>;
  };
  const fechaInicio = new Date(`${fecha}T00:00:00`);
  if (vista === "semana") fechaInicio.setDate(fechaInicio.getDate() - ((fechaInicio.getDay() + 6) % 7));
  if (vista === "mes") fechaInicio.setDate(1);
  const dias = vista === "dia" ? 1 : vista === "semana" ? 7 : new Date(fechaInicio.getFullYear(), fechaInicio.getMonth() + 1, 0).getDate();
  return <div className="h-full overflow-auto p-4 md:p-6"><h1 className="text-2xl font-semibold">Gestão Imobiliária</h1><nav aria-label="Gestión inmobiliaria" className="my-4 flex flex-wrap gap-2"><Link className={boton} href="/real-estate">Dashboard inmobiliario</Link>{recursos.filter(r => r !== "etapas" || configurar).map(r => <Link key={r} className={boton} href={`/real-estate/${r}`} aria-current={seccion === r ? "page" : undefined}>{etiquetas[r]}</Link>)}</nav>
    {error && <p role="alert" className="mb-4 rounded border border-destructive p-3 text-destructive">{error}</p>}{cargando && <p role="status">Cargando…</p>}
    {editor ? <section className="rounded-lg border p-4"><div className="mb-4 flex justify-between"><h2 className="text-xl font-semibold">{editor.registro ? "Editar" : "Crear"}: {etiquetas[editor.tipo]}</h2><button className={boton} onClick={() => setEditor(null)}>Cerrar</button></div><form onSubmit={guardar}><div className="grid gap-4 md:grid-cols-2">{campo({ clave: "nombre", etiqueta: editor.tipo === "inmuebles" ? "Título" : "Nombre" })}{campos[editor.tipo].map(campo)}{campo({ clave: "notas", etiqueta: "Observaciones internas", tipo: "textoLargo" })}{campo({ clave: "archivado", etiqueta: "Archivado", tipo: "booleano" })}</div><button disabled={ocupado || (["etapas", "corredores"].includes(editor.tipo) && !configurar)} className={`${principal} mt-4`} type="submit">{ocupado ? "Guardando…" : "Guardar"}</button></form>{editor.registro && <p className="mt-4 text-xs text-muted-foreground">Registro: {new Date(editor.registro.createdAt).toLocaleString()} · Última modificación: {new Date(editor.registro.updatedAt).toLocaleString()}</p>}
      {editor.registro && editor.tipo === "inmuebles" && <div className="mt-5"><h3 className="font-semibold">Fotos y documentos privados</h3><label className="block py-2">Adjuntar JPEG, PNG, WebP o PDF (máximo 10 MB)<input disabled={ocupado} className={estilo} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={e => { const archivo = e.target.files?.[0]; if (archivo) void subir(archivo); }} /></label>{detalle?.archivos.map(a => <a key={a.id} className="mr-4 underline" href={`/api/real-estate/archivos?archivo=${a.id}`}>{a.nombre}</a>)}</div>}
      {detalle && <div className="mt-5"><h3 className="font-semibold">Historial de cambios</h3>{detalle.cambios.map(c => <details className="border-b py-2" key={c.id}><summary>{new Date(c.createdAt).toLocaleString()} · Usuario {c.usuarioId}</summary><pre className="overflow-auto whitespace-pre-wrap text-xs">{JSON.stringify({ anterior: c.anterior, nuevo: c.nuevo }, null, 2)}</pre></details>)}</div>}</section> : seccion === "dashboard" ? <><div className="mb-4 flex flex-wrap gap-2"><button className={principal} onClick={() => nuevo("inmuebles")}>Crear inmueble</button><button className={boton} onClick={() => nuevo("interesados")}>Crear interesado</button><button className={boton} onClick={() => nuevo("visitas")}>Agendar visita</button></div><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{Object.entries(tablero.metricas).map(([etiqueta, valor]) => <div key={etiqueta} className="rounded-lg border bg-card p-4"><p className="text-sm text-muted-foreground">{etiqueta}</p><p className="text-3xl font-semibold">{valor}</p></div>)}</div><h2 className="my-4 text-lg font-semibold">Próximos compromisos</h2>{tablero.proximas.length ? tablero.proximas.map(v => fila(registros.find(r => r.id === v.id)!)) : <p>No hay próximas visitas.</p>}</> : tipo && <><div className="mb-4 flex flex-wrap gap-3"><h2 className="flex-1 text-xl font-semibold">{etiquetas[tipo]}</h2><button className={principal} disabled={["etapas", "corredores"].includes(tipo) && !configurar} onClick={() => nuevo(tipo)}>Crear registro</button>{tipo === "etapas" && configurar && <button className={boton} disabled={ocupado} onClick={() => void crearEtapas()}>Crear etapas sugeridas</button>}</div>{["interesados", "propietarios"].includes(tipo) && <p className="mb-3 text-sm text-muted-foreground">Selecciona un contacto existente. Puedes darlo de alta en <Link className="underline" href="/contacts">Contactos</Link>.</p>}{tipo === "corredores" && <p className="mb-3 text-sm text-muted-foreground">Los corredores se vinculan a miembros existentes del equipo; administración gestiona sus fichas.</p>}
      <div className="mb-4 grid gap-2 sm:grid-cols-3 lg:grid-cols-4">{filtro("buscar", "Buscar")}{tipo === "inmuebles" && <>{filtro("tipo", "Tipo", tiposInmueble.map(v => ({ id: v, nombre: v })))}{filtro("finalidad", "Finalidad", ["venta", "alquiler", "ambos"].map(v => ({ id: v, nombre: v })))}{filtro("estado", "Estado", estadosInmueble.map(v => ({ id: v, nombre: v })))}{filtro("ciudad", "Ciudad")}{filtro("barrio", "Barrio")}{filtro("precioMin", "Precio mínimo")}{filtro("precioMax", "Precio máximo")}{filtro("areaMin", "Área mínima")}{filtro("areaMax", "Área máxima")}{filtro("habitaciones", "Habitaciones mínimas")}</>}{["inmuebles", "visitas", "interesados", "oportunidades"].includes(tipo) && filtro("corredorId", "Corredor", registros.filter(r => r.tipo === "corredores").map(r => ({ id: r.id, nombre: r.datos.nombre })))}<label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(filtros.archivados)} onChange={e => setFiltros({ ...filtros, archivados: e.target.checked ? "si" : "" })} />Incluir archivados</label></div>
      {tipo === "visitas" ? <><div className="mb-3 flex flex-wrap gap-2"><input aria-label="Fecha de agenda" className={estilo} type="date" value={fecha} onChange={e => { if (e.target.value) setFecha(e.target.value); }} />{["dia", "semana", "mes"].map(v => <button className={boton} key={v} aria-pressed={vista === v} onClick={() => setVista(v)}>{v === "dia" ? "Diaria" : v === "semana" ? "Semanal" : "Mensual"}</button>)}</div><p className="mb-3 text-xs text-muted-foreground">Horarios en la zona local de tu navegador: {zona}</p><div className={vista === "mes" ? "grid gap-2 sm:grid-cols-7" : "grid gap-2"}>{Array.from({ length: dias }, (_, i) => { const dia = new Date(fechaInicio); dia.setDate(dia.getDate() + i); const visitas = lista.filter(r => "inicio" in r.datos && diaLocal(new Date(r.datos.inicio)) === diaLocal(dia)).sort((a, b) => String((a.datos as Record<string, unknown>).inicio).localeCompare(String((b.datos as Record<string, unknown>).inicio))); return <section key={i} className="min-h-24 rounded border p-2"><h3 className="text-sm font-semibold">{dia.toLocaleDateString()}</h3>{visitas.map(fila)}{!visitas.length && <p className="text-xs text-muted-foreground">Sin visitas</p>}</section>; })}</div></> : tipo === "oportunidades" ? <div className="flex gap-3 overflow-auto">{registros.filter(r => r.tipo === "etapas" && !r.datos.archivado).sort((a, b) => esquemas.etapas.parse(a.datos).orden - esquemas.etapas.parse(b.datos).orden).map(etapa => <section key={etapa.id} className="min-w-64 flex-1 rounded border p-3"><h3 className="mb-3 font-semibold">{etapa.datos.nombre}</h3>{lista.filter(r => "etapaId" in r.datos && r.datos.etapaId === etapa.id).map(fila)}</section>)}{!registros.some(r => r.tipo === "etapas" && !r.datos.archivado) && <p>Administración debe configurar las etapas del embudo.</p>}</div> : <div className="grid gap-3">{lista.map(fila)}{!lista.length && !cargando && <p>No hay registros con estos filtros.</p>}</div>}</>}
  </div>;
}
