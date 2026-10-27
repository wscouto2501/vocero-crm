/** 065 — API real y turno real de Nea con LLM local y mensajes sandbox. */
import assert from "node:assert/strict";
import { writeFile, chmod } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import postgres from "postgres";
const base = process.env.APP_BASE_URL;
assert.ok(base && ["127.0.0.1", "localhost"].includes(new URL(base).hostname));
assert.equal(new URL(process.env.DATABASE_URL).pathname, "/vocero_inmobiliaria_test");
assert.equal(process.env.WA_MOCK_ENABLED, "true");
assert.equal(process.env.FEATURE_REAL_ESTATE, "true");
assert.ok(process.env.BOT_API_KEY?.length >= 16);
const sql = postgres(process.env.DATABASE_URL, { connection: { TimeZone: "UTC" } });
async function api(path, key = process.env.BOT_API_KEY) {
  const r = await fetch(`${base}${path}`, { headers: key ? { "X-API-Key": key } : {} });
  return { status: r.status, body: await r.json().catch(() => null) };
}
const run = Date.now();
try {
  const [org] = await sql`select id from organization limit 1`;
  assert.ok(org);
  const otra = `org_bot_${run}`;
  await sql`insert into organization (id, name, slug) values (${otra}, 'Otra organización de prueba', ${otra})`;
  const codigo = `BOT-${run}`;
  async function propiedad(code, cambios = {}, organizacion = org.id) {
    const datos = { nombre: "Casa comercial", codigo: code, tipo: "casa", finalidad: "venta", estado: "disponible", archivado: false, ciudad: "São Paulo", barrio: "Centro", precioVenta: 350000, alquiler: 2200, areaTotal: 130, habitaciones: 3, estacionamientos: 2, caracteristicas: ["piscina", "jardín"], notas: "NOTA_PRIVADA", direccion: "DIRECCION_PRIVADA", propietarioId: "PROPIETARIO_PRIVADO", ...cambios };
    const id = `inm_bot_${code}`;
    await sql`insert into inmueble_registro (id, organization_id, tipo, codigo, datos) values (${id}, ${organizacion}, 'inmuebles', ${code}, ${sql.json(datos)})`;
    return id;
  }
  const inmueble = await propiedad(codigo);
  for (const estado of ["reservado", "negociacion", "vendido", "alquilado", "inactivo"]) await propiedad(`${codigo}-${estado}`, { estado });
  await propiedad(`${codigo}-archivado`, { archivado: true });
  await propiedad(`${codigo}-ajeno`, {}, otra);
  await propiedad(`${codigo}-alquiler`, { finalidad: "alquiler" });
  const casos = [];
  for (const [sufijo, filtros, pregunta, esperado] of [
    ["codigo", { code: codigo }, `Olá, quanto custa o imóvel ${codigo}?`, codigo],
    ["filtros", { purpose: "venta", city: "Sao Paulo", neighborhood: "Centro", minBedrooms: 3, maxPrice: 400000, features: "piscina,jardin", query: codigo }, "Tem casa no Centro de São Paulo com piscina, 3 quartos e até 400 mil?", codigo],
    ["vazio", { code: `${codigo}-inexistente` }, "Tem o imóvel que pedi?", "Não encontrei"],
  ]) {
    const ct = `ct_bot_${run}_${sufijo}`, cv = `cv_bot_${run}_${sufijo}`, msg = `msg_bot_${run}_${sufijo}`, identity = `bsuid:inm-${run}-${sufijo}`;
    await sql`insert into contact (id, organization_id, name, wa_identity) values (${ct}, ${org.id}, 'Cliente simulado', ${identity})`;
    await sql`insert into conversation (id, organization_id, contact_id, is_test, ai_enabled, last_inbound_at) values (${cv}, ${org.id}, ${ct}, true, true, now())`;
    await sql`insert into message (id, organization_id, conversation_id, direction, type, text) values (${msg}, ${org.id}, ${cv}, 'in', 'text', ${pregunta})`;
    casos.push({ conversationId: cv, identity, messageId: msg, filtros, pregunta, esperado });
  }
  const cv = casos[0].conversationId, ruta = `/api/bot/real-estate/properties?conversationId=${cv}`;
  assert.equal((await api(ruta, "")).status, 401);
  for (const q of [`&organizationId=${otra}`, "&maxPrice=400000", "&purpose=venta&minPrice=400000&maxPrice=1"]) assert.equal((await api(ruta + q)).status, 422);
  assert.deepEqual((await api(`/api/bot/context?conversationId=${cv}`)).body.realEstate, { version: 1, searchPath: "/api/bot/real-estate/properties" });
  const res = await api(`${ruta}&query=${codigo}&limit=10&purpose=venta&city=Sao%20Paulo&minArea=100&maxArea=150&minParking=2&features=piscina,jardin`);
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.deepEqual(res.body.properties.map(p => p.code), [codigo]);
  for (const privado of ["NOTA_PRIVADA", "DIRECCION_PRIVADA", "PROPIETARIO_PRIVADO"]) assert.ok(!JSON.stringify(res.body).includes(privado));
  assert.equal((await api(`${ruta}&code=${codigo}-ajeno`)).body.returned, 0);
  assert.equal((await api(`${ruta}&code=${codigo}-alquiler&purpose=venta`)).body.returned, 0);
  const alquiler = await api(`${ruta}&code=${codigo}-alquiler&purpose=alquiler&maxPrice=2300`);
  assert.equal(alquiler.body.returned, 1); assert.equal(alquiler.body.properties[0].salePrice, null);
  const ctAjeno = `ct_ajeno_${run}`, cvAjena = `cv_ajena_${run}`;
  await sql`insert into contact (id, organization_id, name, wa_identity) values (${ctAjeno}, ${otra}, 'Ajeno', ${ctAjeno})`;
  await sql`insert into conversation (id, organization_id, contact_id, ai_enabled) values (${cvAjena}, ${otra}, ${ctAjeno}, true)`;
  assert.equal((await api(`/api/bot/real-estate/properties?conversationId=${cvAjena}`)).status, 404);
  await sql`update conversation set handoff_at = now() where id = ${cv}`;
  assert.equal((await api(ruta)).status, 409);
  await sql`update conversation set handoff_at = null where id = ${cv}`;
  const fixture = "/tmp/vocero-inmobiliaria-bot-fixture.json";
  await writeFile(fixture, JSON.stringify({ casos }), { mode: 0o644 });
  await chmod(fixture, 0o644); // Solo identidades sintéticas, sin credenciales; Nea ejecuta sin root.
  const resultado = spawnSync("docker", ["run", "--rm", "--network", "host", "--env-file", "/tmp/vocero-inmobiliaria.env", "-e", "INMOBILIARIA_E2E_INPUT=/fixture.json", "-v", `${process.cwd()}/integrations/nea-inmobiliaria:/integracion:ro`, "-v", `${fixture}:/fixture.json:ro`, "ghcr.io/kevinrivm/nea-agent:2.0.2", "python", "/integracion/probar.py"], { stdio: "inherit", timeout: 240000 });
  assert.equal(resultado.status, 0);
  for (const caso of casos) {
    const mensajes = await sql`select text from message where organization_id = ${org.id} and conversation_id = ${caso.conversationId} and direction = 'out' and ai_generated = true`;
    assert.ok(mensajes.some(m => m.text.includes(caso.esperado)), "Falta respuesta visible en el CRM");
  }
  await sql`update inmueble_registro set datos = jsonb_set(datos, '{estado}', '"reservado"') where id = ${inmueble} and organization_id = ${org.id}`;
  assert.equal((await api(`${ruta}&code=${codigo}`)).body.returned, 0);
  console.log("OK 065: privacidad, aislamiento, filtros, disponibilidad fresca y Nea → catálogo real → respuesta sandbox visible en CRM");
} finally { await sql.end(); }
