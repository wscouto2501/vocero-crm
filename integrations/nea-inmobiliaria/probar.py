"""Prueba el overlay sobre una copia efímera de Nea, sin modificar su imagen.

Con INMOBILIARIA_E2E_INPUT ejecuta además run_turn contra el CRM local de pruebas.
El LLM es determinista: cero llamadas a proveedores o a Meta.
"""
import asyncio
import importlib.util
import json
import os
from pathlib import Path
import shutil
import sys
import tempfile
import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock

origen = Path(__file__).parent
raiz = Path(tempfile.mkdtemp(prefix="nea-inmobiliaria-"))
shutil.copytree("/app/app", raiz / "app")
shutil.copyfile(origen / "inmobiliaria.py", raiz / "app/inmobiliaria.py")
spec = importlib.util.spec_from_file_location("aplicar_overlay", origen / "aplicar.py")
parche = importlib.util.module_from_spec(spec)
spec.loader.exec_module(parche)
parche.aplicar(raiz / "app")
sys.path.insert(0, str(raiz))

import httpx
from app.inmobiliaria import RuntimeInmobiliario, agregar_herramientas, capacidad_valida, RUTA
from app.crm import CrmClient, CrmUnreachable
from app.config import Settings
from app.state import AppContext, MemoryStore, InboundMessage
from app.llm import LlmReply, ToolCall
from app.turn import run_turn

CAPACIDAD = {"version": 1, "searchPath": RUTA}


class AdaptadorTest(unittest.IsolatedAsyncioTestCase):
    def runtime(self, capacidad=CAPACIDAD):
        crm = SimpleNamespace(_request=AsyncMock())
        runtime = RuntimeInmobiliario(SimpleNamespace(crm=crm, settings=Settings(_env_file=None)), SimpleNamespace(), "cv_del_runtime", inmobiliaria=capacidad)
        return runtime, crm

    async def test_apagado_no_ofrece_ni_consulta(self):
        r, crm = self.runtime(None)
        self.assertEqual(agregar_herramientas(r, []), [])
        self.assertEqual((await r.execute("search_properties", {}))["error"], "catalog_disabled")
        crm._request.assert_not_called()

    async def test_ruta_y_conversacion_no_vienen_del_modelo(self):
        r, crm = self.runtime()
        self.assertFalse(capacidad_valida({"version": 1, "searchPath": "https://otro/"}))
        self.assertEqual((await r.execute("search_properties", {"conversationId": "ajena"}))["error"], "invalid_query")
        crm._request.assert_not_called()
        crm._request.return_value = httpx.Response(200, json={"properties": [{"code": "C-1"}]})
        resultado = await r.execute("search_properties", {"code": "C-1"})
        self.assertTrue(resultado["ok"])
        crm._request.assert_awaited_once_with("GET", RUTA, params={"code": "C-1", "conversationId": "cv_del_runtime"})
        self.assertEqual(agregar_herramientas(r, [])[0]["function"]["name"], "search_properties")

    async def test_fallo_no_inventa_y_404_retira_herramienta(self):
        for status in [422, 429, 503]:
            r, crm = self.runtime(); crm._request.return_value = httpx.Response(status)
            self.assertFalse((await r.execute("search_properties", {}))["ok"])
        r, crm = self.runtime(); crm._request.side_effect = CrmUnreachable("red")
        self.assertEqual((await r.execute("search_properties", {}))["error"], "catalog_unavailable")
        crm._request.side_effect = None; crm._request.return_value = httpx.Response(404)
        await r.execute("search_properties", {})
        self.assertEqual(agregar_herramientas(r, []), [])

    async def test_version_incompatible_falla_sin_escribir(self):
        nuevo = Path(tempfile.mkdtemp()); (nuevo / "turn.py").write_text("pass\n")
        with self.assertRaises(SystemExit): parche.aplicar(nuevo)
        self.assertEqual((nuevo / "turn.py").read_text(), "pass\n")


class ModeloLocal:
    def __init__(self, filtros):
        self.filtros = filtros
        self.rondas = 0

    async def complete(self, messages, tools=None):
        self.rondas += 1
        if self.rondas == 1:
            assert any(t.get("function", {}).get("name") == "search_properties" for t in tools)
            assert "CATÁLOGO INMOBILIARIO EN VIVO" in messages[0]["content"]
            return LlmReply(content=None, tool_calls=[ToolCall(id="consulta-local", name="search_properties", arguments=self.filtros)])
        datos = json.loads(messages[-1]["content"])
        assert datos["ok"] is True
        if not datos["properties"]:
            return LlmReply(content="Não encontrei imóveis disponíveis com esses critérios. Podemos ajustar a busca?")
        p = datos["properties"][0]
        return LlmReply(content=f"O imóvel {p['code']} está disponível em {p['neighborhood']}, {p['city']}. Preço de venda: R$ {p['salePrice']:.2f}. Quer mais detalhes?")


async def prueba_viva():
    fixture = json.loads(Path(os.environ["INMOBILIARIA_E2E_INPUT"]).read_text())
    base = os.environ["APP_BASE_URL"]
    assert base.startswith("http://127.0.0.1:")
    assert "/vocero_inmobiliaria_test" in os.environ["DATABASE_URL"]
    crm = CrmClient(base, os.environ["BOT_API_KEY"])
    try:
        for caso in fixture["casos"]:
            crm.registrar(caso["identity"], caso["conversationId"])
            modelo = ModeloLocal(caso["filtros"])
            ctx = AppContext(settings=Settings(_env_file=None, allowed_wa_ids="", cloud_mode=False), store=MemoryStore(), crm=crm, llm=modelo, agenda_enabled=False)
            await run_turn(ctx, caso["identity"], [InboundMessage(wa_message_id=caso["messageId"], identity=caso["identity"], type="text", text=caso["pregunta"], channel="whatsapp", prueba=True)])
            assert modelo.rondas == 2, "El turno no ejecutó la consulta y respuesta"
            respuestas = [m.content for m in ctx.store.messages if m.role == "assistant"]
            assert respuestas, "El cerebro no devolvió respuesta por el CRM"
            assert caso["esperado"] in respuestas[-1], respuestas[-1]
            assert "NOTA_PRIVADA" not in respuestas[-1]
            print("OK Nea run_turn: consulta real y respuesta guardada en sandbox", flush=True)
    finally:
        await crm._http.aclose()


if __name__ == "__main__":
    resultados = unittest.TextTestRunner().run(unittest.defaultTestLoader.loadTestsFromTestCase(AdaptadorTest))
    if not resultados.wasSuccessful(): sys.exit(1)
    if os.environ.get("INMOBILIARIA_E2E_INPUT"): asyncio.run(prueba_viva())
