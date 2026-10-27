"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { blockStartUtc, wallClock, hhmm } from "@/lib/time/calendar";
import { dayIsoInTz } from "@/lib/time/slots";
import type { CitaInput } from "@/lib/citas";
import type { Booking } from "./booking-look";

type Option = { id: string; name: string };
export function CitaForm({ booking, timezone, initialContactId, initialDate, onClose, onSaved }: {
  booking?: Booking; timezone: string; initialContactId?: string; initialDate: string;
  onClose: () => void; onSaved: (day: string) => void;
}) {
  const [title, setTitle] = useState(booking?.title ?? booking?.contact?.name ?? "");
  const [description, setDescription] = useState(booking?.description ?? "");
  const [notes, setNotes] = useState(booking?.notes ?? "");
  const [appointmentType, setType] = useState(booking?.appointmentType ?? "Atención");
  const [location, setLocation] = useState(booking?.location ?? "");
  const [meetingLink, setLink] = useState(booking?.meetingLink ?? "");
  const [contactId, setContact] = useState(booking?.contact?.id ?? initialContactId ?? "");
  const [responsibleUserId, setResponsible] = useState(booking?.responsibleUserId ?? "");
  const [status, setStatus] = useState<CitaInput["status"]>(booking?.status === "agendada" && booking.confirmedAt ? "confirmada" : booking?.status ?? "agendada");
  const [reminder, setReminder] = useState(String(booking?.reminderMinutes ?? ""));
  const start = booking ? new Date(booking.scheduledAtUtc) : null;
  const end = booking ? new Date(Date.parse(booking.scheduledAtUtc) + booking.durationMinutes * 60000) : null;
  const local = (d: Date) => `${dayIsoInTz(d, timezone)}T${hhmm(wallClock(d, timezone).minutes)}`;
  const [from, setFrom] = useState(start ? local(start) : `${initialDate}T09:00`);
  const [to, setTo] = useState(end ? local(end) : `${initialDate}T09:30`);
  const [members, setMembers] = useState<Option[]>([]);
  const [contacts, setContacts] = useState<Option[]>([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<{ id: string; createdAt: string; actorUserId: string | null; before: Record<string, unknown> | null; after: Record<string, unknown> }[]>([]);
  useEffect(() => {
    const abort = new AbortController();
    fetch("/api/bookings/manage", { signal: abort.signal }).then((r) => r.ok ? r.json() : Promise.reject()).then((d) => setMembers(d.members)).catch(() => {});
    if (booking) fetch(`/api/bookings/${booking.id}/manage`, { signal: abort.signal }).then((r) => r.ok ? r.json() : Promise.reject()).then((d) => setHistory(d.history)).catch(() => setError("No se pudo cargar el historial"));
    return () => abort.abort();
  }, [booking]);
  useEffect(() => {
    const abort = new AbortController();
    const timer = setTimeout(() => {
      fetch(`/api/contacts?q=${encodeURIComponent(query)}`, { signal: abort.signal }).then((r) => r.ok ? r.json() : Promise.reject()).then((d) => setContacts(d.contacts)).catch(() => {});
    }, 200);
    return () => { clearTimeout(timer); abort.abort(); };
  }, [query]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === "Escape" && !busy) onClose(); };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [onClose, busy]);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const utc = (v: string) => blockStartUtc(v.slice(0, 10), v.slice(11, 16), timezone);
    const startUtc = utc(from), endUtc = utc(to);
    if (!startUtc || !endUtc) { setError("La hora no existe en la zona del negocio"); return; }
    if (status === "cancelada" && booking?.status !== "cancelada" && !window.confirm("¿Cancelar esta cita? Se conservará su historial.")) return;
    setBusy(true); setError(null);
    try {
      const res = await fetch(booking ? `/api/bookings/${booking.id}/manage` : "/api/bookings/manage", {
        method: booking ? "PATCH" : "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ title, description: description || null, notes: notes || null, appointmentType,
          location: location || null, meetingLink: meetingLink || null, contactId: contactId || null,
          responsibleUserId: responsibleUserId || null, status, startUtc, endUtc,
          reminderMinutes: reminder ? Number(reminder) : null }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error?.message ?? "No se pudo guardar"); return; }
      onSaved(from.slice(0, 10));
    } catch { setError("No se pudo conectar. Intenta de nuevo."); }
    finally { setBusy(false); }
  }
  const historyLabels: Record<string, string> = { title: "Título", description: "Descripción", notes: "Observaciones", appointmentType: "Tipo", location: "Lugar", meetingLink: "Enlace", contactId: "Contacto", responsibleUserId: "Responsable", scheduledAt: "Inicio", durationMinutes: "Duración (min)", status: "Estado", confirmedAt: "Confirmación", reminderMinutes: "Aviso (min antes)" };
  function historyValue(field: string, value: unknown): string {
    if (value === null || value === undefined || value === "") return "—";
    if (field === "responsibleUserId") return members.find((m) => m.id === value)?.name ?? "Miembro anterior";
    if (field === "contactId") return contacts.find((c) => c.id === value)?.name ?? (booking?.contact?.id === value ? booking.contact.name : "Contacto anterior");
    if (field === "scheduledAt") return new Date(String(value)).toLocaleString("es", { timeZone: timezone });
    if (field === "confirmedAt") return "Confirmada";
    if (field === "status") return ({ agendada: "Agendada", realizada: "Realizada", cancelada: "Cancelada", no_show: "No asistió" } as Record<string, string>)[String(value)] ?? String(value);
    return String(value);
  }
  const external = booking?.connector === "zoom" || booking?.connector === "google";
  const selectClass = "h-9 w-full rounded-md border bg-background px-2 text-sm";
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-overlay p-3" role="dialog" aria-modal="true" aria-labelledby="cita-titulo">
    <form onSubmit={submit} className="max-h-[94dvh] w-full max-w-xl space-y-3 overflow-y-auto rounded-lg border bg-popover p-5 shadow-pop">
      <h3 id="cita-titulo" className="text-lg font-bold">{booking ? "Editar cita" : "Nueva cita"}</h3>
      <p className="text-xs text-muted-foreground">Hora del negocio: {timezone}. Los avisos son internos; no se enviarán mensajes.</p>
      {external && <p className="text-sm text-muted-foreground">Esta cita usa un conector. Reprograma o cancela desde las acciones del panel.</p>}
      <Label htmlFor="cita-title">Título</Label><Input autoFocus id="cita-title" required maxLength={160} value={title} onChange={(e) => setTitle(e.target.value)} />
      <Label htmlFor="cita-desc">Descripción</Label><Textarea id="cita-desc" maxLength={4000} value={description} onChange={(e) => setDescription(e.target.value)} />
      <div className="grid gap-3 sm:grid-cols-2">
        <div><Label htmlFor="cita-from">Inicio</Label><Input id="cita-from" disabled={external} type="datetime-local" required value={from} onChange={(e) => setFrom(e.target.value)} /></div>
        <div><Label htmlFor="cita-to">Fin</Label><Input id="cita-to" disabled={external} type="datetime-local" required value={to} onChange={(e) => setTo(e.target.value)} /></div>
        <div><Label htmlFor="cita-type">Tipo</Label><Input id="cita-type" required maxLength={80} value={appointmentType} onChange={(e) => setType(e.target.value)} /></div>
        <div><Label htmlFor="cita-status">Estado</Label><select id="cita-status" disabled={external} className={selectClass} value={status} onChange={(e) => setStatus(e.target.value as CitaInput["status"])}>
          <option value="agendada">Agendada</option><option value="confirmada">Confirmada</option><option value="realizada">Realizada</option><option value="cancelada">Cancelada</option><option value="no_show">No asistió</option>
        </select></div>
      </div>
      <Label htmlFor="cita-search">Buscar contacto</Label><Input id="cita-search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Nombre o teléfono" />
      <Label htmlFor="cita-contact">Contacto (opcional)</Label><select id="cita-contact" className={selectClass} value={contactId} onChange={(e) => setContact(e.target.value)}>
        <option value="">Sin contacto</option>
        {contactId && !contacts.some((c) => c.id === contactId) && <option value={contactId}>{booking?.contact?.name ?? "Contacto seleccionado"}</option>}
        {contacts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
      <Label htmlFor="cita-responsible">Responsable</Label><select id="cita-responsible" className={selectClass} value={responsibleUserId} onChange={(e) => setResponsible(e.target.value)}><option value="">Agenda compartida</option>{members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select>
      <Label htmlFor="cita-location">Lugar</Label><Input id="cita-location" maxLength={500} value={location} onChange={(e) => setLocation(e.target.value)} />
      <Label htmlFor="cita-link">Enlace de reunión</Label><Input id="cita-link" disabled={external} type="url" maxLength={1000} value={meetingLink} onChange={(e) => setLink(e.target.value)} />
      <Label htmlFor="cita-notes">Observaciones</Label><Textarea id="cita-notes" maxLength={4000} value={notes} onChange={(e) => setNotes(e.target.value)} />
      <Label htmlFor="cita-reminder">Aviso interno (minutos antes)</Label><Input id="cita-reminder" type="number" min={1} max={10080} value={reminder} onChange={(e) => setReminder(e.target.value)} placeholder="Sin aviso" />
      {history.length > 0 && <details><summary className="cursor-pointer text-sm">Historial de cambios ({history.length})</summary><ul className="space-y-1 text-xs text-muted-foreground">{history.map((h) => <li key={h.id}>{new Date(h.createdAt).toLocaleString("es", { timeZone: timezone })} · {members.find((m) => m.id === h.actorUserId)?.name ?? "Equipo"} · {h.before ? "Edición" : "Creación"}<pre className="whitespace-pre-wrap">{Object.keys(historyLabels).filter((k) => JSON.stringify(h.before?.[k]) !== JSON.stringify(h.after[k])).map((k) => `${historyLabels[k]}: ${historyValue(k, h.before?.[k])} → ${historyValue(k, h.after[k])}`).join("\n")}</pre></li>)}</ul></details>}
      {error && <p role="alert" className="text-sm text-danger-text">{error}</p>}
      <div className="flex justify-end gap-2"><Button type="button" variant="ghost" disabled={busy} onClick={onClose}>Cerrar</Button><Button disabled={busy} type="submit">{busy ? "Guardando…" : "Guardar cita"}</Button></div>
    </form>
  </div>;
}
