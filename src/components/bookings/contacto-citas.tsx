"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useEvents } from "@/components/use-events";

/** Oculto si AGENDA está apagada (la API responde 404). */
export function ContactoCitas({ contactId }: { contactId: string }) {
  const [data, setData] = useState<{ upcoming: { id: string; title: string | null; scheduledAt: string }[] } | null>(null);
  const [timezone, setTimezone] = useState<string | undefined>(undefined);
  const load = useCallback(() => {
    void fetch(`/api/bookings/manage?contactId=${encodeURIComponent(contactId)}`).then((r) => r.ok ? r.json() : null).then(setData).catch(() => setData(null));
    void fetch("/api/calendar/settings").then((r) => r.ok ? r.json() : null).then((d) => setTimezone(d?.settings?.timezone)).catch(() => {});
  }, [contactId]);
  useEffect(() => { setData(null); load(); }, [load]);
  useEvents({ onBookingUpdated: load, onReconnect: load });
  if (!data) return null;
  return <section className="space-y-2 rounded-md border p-3">
    <p className="text-sm font-semibold">Próximas citas</p>
    {data.upcoming.length === 0 && <p className="text-xs text-muted-foreground">Sin citas próximas</p>}
    {data.upcoming.map((b) => <p key={b.id} className="text-xs">{b.title ?? "Cita"} · {new Date(b.scheduledAt).toLocaleString("es", { timeZone: timezone })}</p>)}
    <Link className="text-sm text-primary underline" href={`/bookings?crear=1&contact=${encodeURIComponent(contactId)}`}>Agendar cita</Link>
  </section>;
}
