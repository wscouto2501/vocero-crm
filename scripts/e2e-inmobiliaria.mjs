/** 064 — Ejecutar únicamente contra servidor local y Postgres descartable. */
import assert from "node:assert/strict";
import { chromium } from "playwright";
import postgres from "postgres";
const base = process.env.APP_BASE_URL;
const url = new URL(process.env.DATABASE_URL ?? "");
if (!base || !["localhost", "127.0.0.1"].includes(new URL(base).hostname) || url.pathname !== "/vocero_inmobiliaria_test" || process.env.WA_MOCK_ENABLED !== "true") throw new Error("Solo localhost, mocks y vocero_inmobiliaria_test");
const sql = postgres(url.toString(), { connection: { TimeZone: "UTC" } });
const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, timezoneId: "America/Sao_Paulo" });
ctx.setDefaultTimeout(30000);
ctx.setDefaultNavigationTimeout(120000);
const api = async (path, method = "GET", data, contexto = ctx) => {
  const res = await contexto.request.fetch(`${base}${path}`, { method, data, headers: { origin: base }, timeout: 120000 });
  return { status: res.status(), body: await res.json().catch(() => null) };
};
const horaLocal = (fecha) => new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(fecha).replace(" ", "T");
const run = Date.now();
let pagina;
try {
  const alta = async (contexto, sufijo) => {
    const email = `inm-${run}-${sufijo}@example.test`;
    const registro = await api("/api/auth/sign-up/email", "POST", { name: `Operador ${sufijo}`, email, password: "pruebas-locales-inmobiliaria-064" }, contexto);
    assert.equal(registro.status, 200, JSON.stringify(registro.body));
    const [usuario] = await sql`select id from "user" where email = ${email}`;
    let [miembro] = await sql`select id, organization_id from member where user_id = ${usuario.id}`;
    if (!miembro) {
      const org = `org_inm_${run}_${sufijo}`;
      await sql`insert into organization (id, name, slug) values (${org}, 'Pruebas inmobiliarias', ${org})`;
      await sql`insert into member (id, organization_id, user_id, role) values (${`mem_${org}`}, ${org}, ${usuario.id}, 'owner')`;
      miembro = { id: `mem_${org}`, organization_id: org };
    }
    return { ...miembro, userId: usuario.id };
  };
  const miembro = await alta(ctx, "a");
  const page = await ctx.newPage();
  pagina = page;
  const erroresNavegador = [];
  page.on("pageerror", e => erroresNavegador.push(e.message));
  if (process.env.FEATURE_REAL_ESTATE !== "true") {
    const [{ n: antes }] = await sql`select count(*)::int as n from inmueble_registro`;
    for (const recurso of ["inmuebles", "interesados", "visitas", "archivos", "opciones"]) for (const metodo of ["GET", "POST", "PATCH"]) assert.equal((await api(`/api/real-estate/${recurso}`, metodo, metodo === "GET" ? undefined : { datos: {} })).status, 404);
    const respuesta = await page.goto(`${base}/real-estate/inmuebles`);
    assert.equal(respuesta.status(), 404);
    await page.goto(`${base}/contacts`);
    assert.equal(await page.getByRole("link", { name: "Gestão Imobiliária", exact: true }).count(), 0);
    assert.equal((await api("/api/contacts")).status, 200);
    const [{ n: despues }] = await sql`select count(*)::int as n from inmueble_registro`;
    assert.equal(antes, despues);
    console.log("OK: apagado, páginas y API 404, menú oculto, datos preservados, contactos operativos");
  } else {
    const crear = async (tipo, datos, contexto = ctx) => {
      const res = await api(`/api/real-estate/${tipo}`, "POST", { datos }, contexto);
      assert.equal(res.status, 201, JSON.stringify(res.body)); return res.body.registro;
    };
    const contacto = `ct_inm_${run}`;
    await sql`insert into contact (id, organization_id, name, wa_identity) values (${contacto}, ${miembro.organization_id}, 'Cliente inmobiliario', ${String(run)})`;
    const propietario = await crear("propietarios", { nombre: "Propietario", contactoId: contacto });
    const corredor = await crear("corredores", { nombre: "Corredor", miembroId: miembro.id });
    let inmueble = await crear("inmuebles", { nombre: "Casa de prueba", codigo: `C-${run}`, tipo: "casa", finalidad: "ambos", ciudad: "São Paulo", barrio: "Centro", precioVenta: 350000, alquiler: 2000, propietarioId: propietario.id, corredorId: corredor.id, caracteristicas: ["piscina"] });
    assert.equal((await api("/api/real-estate/inmuebles", "POST", { datos: inmueble.datos })).status, 409);
    const editado = await api("/api/real-estate/inmuebles", "PATCH", { id: inmueble.id, version: inmueble.updatedAt, datos: { ...inmueble.datos, nombre: "Casa editada" } });
    assert.equal(editado.status, 200); inmueble = editado.body.registro;
    assert.equal((await api("/api/real-estate/inmuebles", "PATCH", { id: inmueble.id, version: "2020-01-01T00:00:00.000Z", datos: inmueble.datos })).status, 409);
    assert.equal((await api(`/api/real-estate/inmuebles?id=${inmueble.id}`)).body.cambios.length, 2);
    const interesado = await crear("interesados", { nombre: "Interesado", contactoId: contacto, inmueblesIds: [inmueble.id], presupuestoMax: 400000, proximaActividad: "Enviar propuesta" });
    const inicio = new Date(); inicio.setDate(inicio.getDate() + 1); inicio.setHours(10, 0, 0, 0);
    const visita = { nombre: "Visita de prueba", inmuebleId: inmueble.id, interesadoId: interesado.id, corredorId: corredor.id, inicio: inicio.toISOString(), fin: new Date(+inicio + 3600000).toISOString(), estado: "confirmada" };
    const simultaneas = await Promise.all([api("/api/real-estate/visitas", "POST", { datos: visita }), api("/api/real-estate/visitas", "POST", { datos: visita })]);
    assert.deepEqual(simultaneas.map(r => r.status).sort(), [201, 409]);
    const reserva = simultaneas.find(r => r.status === 201).body.registro;
    await crear("visitas", { ...visita, nombre: "Contigua", inicio: visita.fin, fin: new Date(+inicio + 7200000).toISOString() });
    assert.equal((await api("/api/real-estate/visitas", "PATCH", { id: reserva.id, version: reserva.updatedAt, datos: { ...reserva.datos, estado: "cancelada" } })).status, 422);
    const reprogramada = await api("/api/real-estate/visitas", "PATCH", { id: reserva.id, version: reserva.updatedAt, datos: { ...reserva.datos, inicio: new Date(+inicio + 10800000).toISOString(), fin: new Date(+inicio + 14400000).toISOString() } });
    assert.equal(reprogramada.status, 200);
    assert.equal((await api(`/api/real-estate/visitas?id=${reserva.id}`)).body.cambios.length, 2);
    const etapa = await crear("etapas", { nombre: "Propuesta enviada", orden: 1 });
    const perdida = await crear("etapas", { nombre: "Perdido", orden: 2, resultado: "perdida" });
    const oportunidad = await crear("oportunidades", { nombre: "Oferta casa", interesadoId: interesado.id, inmuebleId: inmueble.id, corredorId: corredor.id, etapaId: etapa.id, propuesta: "Pago al contado", valor: 340000 });
    assert.equal((await api("/api/real-estate/oportunidades", "PATCH", { id: oportunidad.id, version: oportunidad.updatedAt, datos: { ...oportunidad.datos, etapaId: perdida.id } })).status, 422);
    const archivo = await api(`/api/real-estate/archivos?id=${inmueble.id}`, "POST", { nombre: "ficha.pdf", mime: "application/pdf", contenido: Buffer.from("%PDF-1.4\nprueba").toString("base64") });
    assert.equal(archivo.status, 201);
    assert.equal((await ctx.request.get(`${base}/api/real-estate/archivos?archivo=${archivo.body.id}`)).status(), 200);
    const otroCtx = await browser.newContext(); const otro = await alta(otroCtx, "b");
    assert.equal((await api("/api/real-estate/inmuebles", "GET", undefined, otroCtx)).body.registros.length, 0);
    assert.equal((await api(`/api/real-estate/inmuebles?id=${inmueble.id}`, "GET", undefined, otroCtx)).status, 404);
    assert.equal((await api(`/api/real-estate/archivos?archivo=${archivo.body.id}`, "GET", undefined, otroCtx)).status, 404);
    assert.equal((await api("/api/real-estate/interesados", "POST", { datos: { nombre: "Intruso", contactoId: contacto } }, otroCtx)).status, 422);
    const otroCorredor = await crear("corredores", { nombre: "Otro", miembroId: otro.id }, otroCtx);
    assert.equal((await api("/api/real-estate/inmuebles", "POST", { datos: { nombre: "Intruso", codigo: "OTRO", tipo: "casa", finalidad: "venta", corredorId: corredor.id } }, otroCtx)).status, 422);
    assert.ok(otroCorredor);
    await sql`update member set role = 'member' where id = ${miembro.id}`;
    assert.equal((await api("/api/real-estate/etapas", "POST", { datos: { nombre: "No permitido", orden: 3 } })).status, 403);
    await sql`update member set role = 'owner' where id = ${miembro.id}`;
    assert.equal((await api("/api/contacts")).status, 200);
    await page.goto(`${base}/real-estate`);
    await page.getByRole("link", { name: "Gestão Imobiliária", exact: true }).first().waitFor();
    await page.getByText("Inmuebles disponibles", { exact: true }).waitFor();
    await page.getByRole("button", { name: "Crear inmueble", exact: true }).click();
    await page.getByLabel("Título", { exact: true }).fill("Creado desde navegador");
    await page.getByLabel("Código interno", { exact: true }).fill(`UI-${run}`);
    await page.getByRole("button", { name: "Guardar", exact: true }).click();
    await page.getByRole("button", { name: "Crear inmueble", exact: true }).waitFor();
    await page.getByRole("link", { name: "Inmuebles", exact: true }).click();
    await page.getByRole("button", { name: "Creado desde navegador", exact: true }).waitFor();
    await page.getByLabel("Buscar", { exact: true }).fill("Casa editada");
    await page.getByRole("button", { name: "Casa editada", exact: true }).click();
    await page.getByLabel("Título", { exact: true }).fill("Casa editada desde navegador");
    await page.getByRole("button", { name: "Guardar", exact: true }).click();
    await page.getByRole("button", { name: "Casa editada desde navegador", exact: true }).waitFor();
    await page.getByRole("button", { name: "Agendar visita", exact: true }).click();
    await page.getByLabel("Nombre", { exact: true }).fill("Visita desde navegador");
    await page.getByLabel("Cliente interesado", { exact: true }).selectOption(interesado.id);
    await page.getByLabel("Inicio", { exact: true }).fill(horaLocal(new Date(+inicio + 1 * 3600000)));
    await page.getByLabel("Final", { exact: true }).fill(horaLocal(new Date(+inicio + 2 * 3600000)));
    await page.getByRole("button", { name: "Guardar", exact: true }).click();
    await page.getByRole("alert").filter({ hasText: "ya tiene una visita" }).waitFor();
    await page.getByLabel("Inicio", { exact: true }).fill(horaLocal(new Date(+inicio + 6 * 3600000)));
    await page.getByLabel("Final", { exact: true }).fill(horaLocal(new Date(+inicio + 7 * 3600000)));
    await page.getByRole("button", { name: "Guardar", exact: true }).click();
    await page.getByRole("heading", { name: "Crear: Agenda y visitas", exact: true }).waitFor({ state: "hidden" });
    await page.getByRole("link", { name: "Agenda y visitas", exact: true }).click();
    await page.getByLabel("Fecha de agenda", { exact: true }).fill(horaLocal(inicio).slice(0, 10));
    await page.getByRole("status").filter({ hasText: "Cargando" }).waitFor({ state: "hidden" });
    for (const vista of ["Diaria", "Semanal", "Mensual"]) {
      await page.getByRole("button", { name: vista, exact: true }).click();
      await page.getByRole("button", { name: "Visita desde navegador", exact: true }).waitFor();
    }
    assert.ok((await api("/api/real-estate/visitas")).body.registros.some(r => r.datos.nombre === "Visita desde navegador"));
    await page.screenshot({ path: "/tmp/vocero-inmobiliaria-agenda.png", fullPage: true });
    assert.deepEqual(erroresNavegador, []);
    console.log("OK: CRUD, versiones, contactos, propuestas, historial, adjuntos, aislamiento, permisos, concurrencia y UI con camino infeliz");
    await otroCtx.close();
  }
} catch (error) {
  if (pagina) { await pagina.screenshot({ path: "/tmp/vocero-inmobiliaria-error.png", fullPage: true }).catch(() => {}); console.error(await pagina.locator("body").innerText().catch(() => "Sin página")); }
  throw error;
} finally { await browser.close(); await sql.end(); }
