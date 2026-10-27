import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { esRecurso } from "@/lib/inmobiliaria";
import { inmobiliariaActiva } from "@/server/inmobiliaria/flag";
import { InmobiliariaClient } from "@/components/inmobiliaria/inmobiliaria-client";
export const dynamic = "force-dynamic";
export default async function Pagina({ params }: { params: Promise<{ seccion?: string[] }> }) {
  if (!inmobiliariaActiva()) notFound();
  const { seccion = [] } = await params;
  if (seccion.length > 1 || (seccion[0] && !esRecurso(seccion[0]))) notFound();
  const session = await requireSession();
  return <InmobiliariaClient seccion={seccion[0] ?? "dashboard"} rol={session.role} />;
}
