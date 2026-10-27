/** Mismo build, cuatro configuraciones de runtime. Solo servidor y BD de pruebas. */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { resolve } from "node:path";
const carpeta = process.env.INMOBILIARIA_BUILD_DIR;
assert.ok(carpeta, "Indica INMOBILIARIA_BUILD_DIR con un build local ya generado");
assert.equal(new URL(process.env.DATABASE_URL).pathname, "/vocero_inmobiliaria_test");
const puerto = 3065;
const base = `http://127.0.0.1:${puerto}`;
for (const valor of ["true", "false", undefined, "invalido"]) {
  const env = { ...process.env, APP_BASE_URL: base, NODE_ENV: "production", BRAIN_DISPATCH_URL: "", BRAIN_HEALTH_URL: "" };
  if (valor === undefined) delete env.FEATURE_REAL_ESTATE;
  else env.FEATURE_REAL_ESTATE = valor;
  const servidor = spawn(process.execPath, [resolve("node_modules/next/dist/bin/next"), "start", "-p", String(puerto), "-H", "127.0.0.1"], { cwd: carpeta, env, stdio: "pipe" });
  let salida = "";
  servidor.stdout.on("data", d => { salida += d; });
  servidor.stderr.on("data", d => { salida += d; });
  try {
    let listo = false;
    for (let i = 0; i < 120; i++) {
      if (servidor.exitCode !== null) throw new Error(salida);
      if (await fetch(`${base}/api/health`).then(r => r.ok).catch(() => false)) { listo = true; break; }
      await new Promise(r => setTimeout(r, 500));
    }
    assert.ok(listo, `No arrancó el servidor de pruebas: ${salida}`);
    const codigo = await new Promise((resolveCode, reject) => {
      const prueba = spawn(process.execPath, [resolve("scripts/e2e-inmobiliaria.mjs")], { env, stdio: "inherit" });
      prueba.once("error", reject); prueba.once("exit", resolveCode);
    });
    assert.equal(codigo, 0, `Configuración ${valor ?? "ausente"}: ${salida}`);
    console.log(`OK runtime: FEATURE_REAL_ESTATE=${valor ?? "ausente"}`);
  } finally {
    if (servidor.exitCode === null && servidor.signalCode === null) await new Promise(r => { servidor.once("exit", r); servidor.kill("SIGTERM"); });
  }
}
