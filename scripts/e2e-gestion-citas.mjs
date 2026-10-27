/** 063 — API real y navegador. Solo base de pruebas aislada, nunca producción.
 * APP_BASE_URL=http://localhost:3063 DATABASE_URL=.../vocero_citas_test
 * node --env-file=/tmp/vocero-citas.env scripts/e2e-gestion-citas.mjs
 */
import assert from "node:assert/strict";
import { chromium } from "playwright";
import postgres from "postgres";

const base = process.env.APP_BASE_URL;
const dbUrl = new URL(process.env.DATABASE_URL ?? "");
if (!base || !["localhost", "127.0.0.1"].includes(new URL(base).hostname) || dbUrl.pathname !== "/vocero_citas_test" || process.env.WA_MOCK_ENABLED !== "true") throw new Error("Solo entorno local y base vocero_citas_test con mocks");
const sql = postgres(dbUrl.toString(), { connection: { TimeZone: "UTC" } });
const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, timezoneId: "Asia/Tokyo" });
const api = async (path, method = "GET", data, context = ctx) => {
  const res = await context.request.fetch(`${base}${path}`, { method, data, headers: { origin: base }, timeout: 120000, failOnStatusCode: false });
  return { status: res.status(), body: await res.json().catch(() => null) };
};
const run = Date.now();
const email = `citas-${run}@example.test`;
const password = "pruebas-locales-citas-063";
try {
  assert.equal((await api("/api/auth/sign-up/email", "POST", { name: "Operador citas", email, password })).status, 200);
  const [user] = await sql`select id from "user" where email = ${email}`;
  let [member] = await sql`select organization_id from member where user_id = ${user.id}`;
  if (!member) {
    const orgId = `org_citas_${run}`;
    await sql`insert into organization (id, name, slug) values (${orgId}, 'Pruebas citas', ${orgId})`;
    await sql`insert into member (id, organization_id, user_id, role) values (${`mem_citas_${run}`}, ${orgId}, ${user.id}, 'owner')`;
    member = { organization_id: orgId };
  }
  const org = member.organization_id;
  const contactId = `ct_e2e_${run}`;
  await sql`insert into contact (id, organization_id, name, wa_identity) values (${contactId}, ${org}, 'Cliente prueba', ${String(run)})`;
  const utc = new Date(); utc.setUTCDate(utc.getUTCDate() + 1); utc.setUTCHours(15, 0, 0, 0);
  const payload = { title: "Consulta inicial", appointmentType: "Venta", contactId, responsibleUserId: user.id, startUtc: utc.toISOString(), endUtc: new Date(+utc + 30 * 60000).toISOString(), status: "agendada", reminderMinutes: 60, description: "Descripción prueba", notes: "Nota privada", location: "Oficina" };
  assert.equal((await api("/api/bookings/manage", "POST", { ...payload, endUtc: payload.startUtc })).status, 422);
  const created = await api("/api/bookings/manage", "POST", payload);
  assert.equal(created.status, 201, JSON.stringify(created.body));
  const id = created.body.booking.id;
  assert.equal((await api("/api/bookings/manage", "POST", { ...payload, startUtc: new Date(+utc + 15 * 60000).toISOString(), endUtc: new Date(+utc + 45 * 60000).toISOString() })).status, 409);
  const edit = { ...payload, title: "Consulta confirmada", status: "confirmada", startUtc: new Date(+utc + 3600000).toISOString(), endUtc: new Date(+utc + 5400000).toISOString() };
  assert.equal((await api(`/api/bookings/${id}/manage`, "PATCH", edit)).status, 200);
  assert.equal((await api(`/api/bookings/${id}/manage`)).body.history.length, 2);

  // Segunda organización real: usuario registrado sin membresía automática.
  const other = await browser.newContext();
  // Alta de cuenta de prueba por auth interno no accesible: habilitar ALLOW_SIGNUP en entorno de pruebas.
  const emailB = `otro-${run}@example.test`;
  assert.equal((await api("/api/auth/sign-up/email", "POST", { name: "Otro negocio", email: emailB, password }, other)).status, 200);
  const [userB] = await sql`select id from "user" where email = ${emailB}`;
  const orgB = `org_otro_${run}`;
  await sql`insert into organization (id, name, slug) values (${orgB}, 'Otro negocio', ${orgB})`;
  await sql`insert into member (id, organization_id, user_id, role) values (${`mem_${run}`}, ${orgB}, ${userB.id}, 'owner')`;
  assert.equal((await api(`/api/bookings/${id}/manage`, "GET", undefined, other)).status, 404);
  assert.equal((await api(`/api/bookings/${id}/manage`, "PATCH", edit, other)).status, 404);
  assert.equal((await api("/api/bookings/manage", "POST", payload, other)).status, 404);
  assert.equal((await api("/api/bookings/manage", "GET", undefined, other)).body.upcoming.length, 0);
  await other.close();

  const soon = new Date(Date.now() + 30 * 60000); soon.setUTCSeconds(0, 0);
  const reminder = await api("/api/bookings/manage", "POST", { ...payload, title: "Aviso interno", startUtc: soon.toISOString(), endUtc: new Date(+soon + 30 * 60000).toISOString() });
  assert.equal(reminder.status, 201);
  assert.ok((await api("/api/bookings/manage")).body.reminders.some((b) => b.title === "Aviso interno"));
  assert.equal((await api(`/api/bookings/${reminder.body.booking.id}/manage`, "PATCH", { ...payload, title: "Aviso interno", startUtc: soon.toISOString(), endUtc: new Date(+soon + 30 * 60000).toISOString(), status: "cancelada" })).status, 200);
  assert.ok(!(await api("/api/bookings/manage")).body.reminders.some((b) => b.id === reminder.body.booking.id));
  const raceStart = new Date(+utc + 5 * 3600000);
  const races = await Promise.all([0, 15].map((offset) => api("/api/bookings/manage", "POST", { ...payload, title: "Carrera", startUtc: new Date(+raceStart + offset * 60000).toISOString(), endUtc: new Date(+raceStart + (offset + 30) * 60000).toISOString() })));
  assert.deepEqual(races.map((r) => r.status).sort(), [201, 409]);
  console.log("OK: API real, aislamiento, recordatorios y concurrencia");
  const page = await ctx.newPage();
  page.setDefaultTimeout(60000);
  page.setDefaultNavigationTimeout(120000);
  const day = edit.startUtc.slice(0, 10);
  await page.goto(`${base}/bookings?vista=dia&fecha=${day}`);
  await page.getByRole("button", { name: "Nueva cita", exact: true }).waitFor();
  await page.getByRole("button", { name: "Nueva cita", exact: true }).click();
  await page.getByLabel("Título", { exact: true }).fill("Creada en navegador");
  await page.getByLabel("Inicio", { exact: true }).fill(`${day}T10:00`);
  await page.getByLabel("Fin", { exact: true }).fill(`${day}T10:30`);
  await page.getByRole("button", { name: "Guardar cita", exact: true }).click();
  await page.getByRole("alert").filter({ hasText: "Conflicto de horario" }).waitFor();
  await page.getByLabel("Inicio", { exact: true }).fill(`${day}T13:00`);
  await page.getByLabel("Fin", { exact: true }).fill(`${day}T13:30`);
  await page.getByRole("button", { name: "Guardar cita", exact: true }).click();
  await page.getByRole("dialog", { name: "Nueva cita" }).waitFor({ state: "hidden" });
  const uiBooking = (await api("/api/bookings/manage")).body.upcoming.find((b) => b.title === "Creada en navegador");
  assert.ok(uiBooking);
  assert.equal(new Date(uiBooking.scheduledAt).getUTCHours(), 19, "13:00 México, aunque el navegador esté en Tokio");
  await page.getByLabel("Filtrar por responsable").selectOption(user.id);
  await page.getByLabel("Filtrar por estado").selectOption("confirmada");
  await page.getByText("Consulta confirmada", { exact: true }).first().click();
  await page.getByRole("button", { name: "Editar detalles e historial" }).click();
  await page.getByLabel("Título", { exact: true }).fill("Editada en navegador");
  await page.getByLabel("Inicio", { exact: true }).fill(`${day}T11:00`);
  await page.getByLabel("Fin", { exact: true }).fill(`${day}T11:30`);
  await page.getByRole("button", { name: "Guardar cita", exact: true }).click();
  await page.getByRole("dialog", { name: "Editar cita", exact: true }).waitFor({ state: "hidden" });
  assert.equal((await api(`/api/bookings/${id}/manage`)).body.booking.title, "Editada en navegador");
  await page.getByRole("button", { name: "Cancelar cita", exact: true }).waitFor();
  page.once("dialog", (dialog) => dialog.dismiss());
  await page.getByRole("button", { name: "Cancelar cita", exact: true }).click();
  assert.equal((await api(`/api/bookings/${id}/manage`)).body.booking.status, "agendada");
  page.once("dialog", (dialog) => dialog.accept());
  const cancelled = page.waitForResponse((r) => r.url().endsWith(`/api/bookings/${id}/manage`) && r.request().method() === "PATCH");
  await page.getByRole("button", { name: "Cancelar cita", exact: true }).click();
  assert.equal((await cancelled).status(), 200);
  const detail = (await api(`/api/bookings/${id}/manage`)).body;
  assert.equal(detail.booking.status, "cancelada");
  assert.equal(detail.booking.title, "Editada en navegador");
  assert.equal(new Date(detail.booking.scheduledAt).getUTCHours(), 17);
  assert.equal(detail.history.length, 4);
  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await mobile.addCookies(await ctx.cookies());
  const mp = await mobile.newPage();
  await mp.goto(`${base}/bookings`);
  await mp.getByRole("button", { name: "Nueva cita", exact: true }).click();
  assert.equal(await mp.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await mobile.close();
  console.log("OK: creación/edición/cancelación reales, conflicto, historial, aislamiento de dos organizaciones, UI escritorio/móvil y confirmación de cancelación.");
} finally { await browser.close(); await sql.end(); }
