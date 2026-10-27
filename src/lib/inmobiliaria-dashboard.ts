import { esquemas, type Registro } from "./inmobiliaria";
/** Usa el día local del usuario igual que el calendario del módulo. */
export function diaLocal(fecha: Date): string {
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}-${String(fecha.getDate()).padStart(2, "0")}`;
}
export function indicadores(registros: Registro[], ahora = new Date()) {
  const activos = registros.filter(r => !r.datos.archivado);
  const inmuebles = activos.filter(r => r.tipo === "inmuebles").map(r => esquemas.inmuebles.parse(r.datos));
  const visitas = activos.filter(r => r.tipo === "visitas").map(r => ({ ...esquemas.visitas.parse(r.datos), id: r.id })).filter(v => !["cancelada", "ausente"].includes(v.estado));
  const interesados = activos.filter(r => r.tipo === "interesados").map(r => ({ ...esquemas.interesados.parse(r.datos), createdAt: r.createdAt }));
  const oportunidades = activos.filter(r => r.tipo === "oportunidades").map(r => esquemas.oportunidades.parse(r.datos));
  const resultado = (id: string) => {
    const etapa = registros.find(r => r.id === id && r.tipo === "etapas");
    return etapa ? esquemas.etapas.parse(etapa.datos).resultado : "abierta";
  };
  return {
    metricas: {
      "Inmuebles disponibles": inmuebles.filter(i => i.estado === "disponible").length,
      "En venta": inmuebles.filter(i => ["venta", "ambos"].includes(i.finalidad) && i.estado === "disponible").length,
      "En alquiler": inmuebles.filter(i => ["alquiler", "ambos"].includes(i.finalidad) && i.estado === "disponible").length,
      "Reservados": inmuebles.filter(i => i.estado === "reservado").length,
      "Nuevos interesados (30 días)": interesados.filter(i => +new Date(i.createdAt) >= +ahora - 30 * 86400000).length,
      "Visitas de hoy": visitas.filter(v => diaLocal(new Date(v.inicio)) === diaLocal(ahora)).length,
      "Propuestas en curso": oportunidades.filter(o => o.propuesta.trim() && resultado(o.etapaId) === "abierta").length,
      "Negociaciones cerradas": oportunidades.filter(o => resultado(o.etapaId) === "ganada").length,
      "Actividades pendientes": interesados.filter(i => i.proximaActividad.trim() && !i.actividadCompletada).length,
    },
    proximas: visitas.filter(v => new Date(v.inicio) >= ahora && v.estado !== "realizada").sort((a, b) => a.inicio.localeCompare(b.inicio)).slice(0, 10),
  };
}
