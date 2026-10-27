import { z } from "zod";

/** Instantes explícitos: nunca interpretar hora local del navegador como UTC. */
export const citaSchema = z.object({
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().max(4000).nullable().default(null),
  notes: z.string().trim().max(4000).nullable().default(null),
  appointmentType: z.string().trim().min(1).max(80),
  location: z.string().trim().max(500).nullable().default(null),
  meetingLink: z.string().url().max(1000).refine((v) => /^https?:\/\//i.test(v), "Usa un enlace http o https").nullable().default(null),
  contactId: z.string().min(1).nullable().default(null),
  responsibleUserId: z.string().min(1).nullable().default(null),
  startUtc: z.string().datetime({ offset: true }),
  endUtc: z.string().datetime({ offset: true }),
  status: z.enum(["agendada", "confirmada", "realizada", "cancelada", "no_show"]),
  reminderMinutes: z.number().int().min(1).max(10080).nullable().default(null),
}).superRefine((v, ctx) => {
  const minutes = (Date.parse(v.endUtc) - Date.parse(v.startUtc)) / 60000;
  if (!Number.isInteger(minutes) || minutes < 5 || minutes > 600) {
    ctx.addIssue({ code: "custom", path: ["endUtc"], message: "El fin debe ser posterior al inicio, entre 5 y 600 minutos" });
  }
});
export type CitaInput = z.infer<typeof citaSchema>;

export function seSolapan(inicio: Date, minutos: number, otroInicio: Date, otrosMinutos: number): boolean {
  return inicio.getTime() < otroInicio.getTime() + otrosMinutos * 60000 &&
    otroInicio.getTime() < inicio.getTime() + minutos * 60000;
}
