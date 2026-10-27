"""Parche mínimo y verificado al construir: una imagen incompatible falla.

Solo modifica la copia de turn.py de la imagen nueva; nunca un contenedor vivo.
"""
import ast
from pathlib import Path
import sys


def aplicar(raiz: Path) -> None:
    archivo = raiz / "turn.py"
    fuente = archivo.read_text()
    cambios = [
        ("logger = logging.getLogger(\"nea.turn\")", "from app.inmobiliaria import RuntimeInmobiliario as ToolRuntime, prompt_inmobiliario as build_system_prompt, agregar_herramientas\n\nlogger = logging.getLogger(\"nea.turn\")"),
        ("        etapas=etapas_siguientes(context),\n", "        etapas=etapas_siguientes(context),\n        inmobiliaria=(context or {}).get(\"realEstate\"),\n"),
        ("            tools=solo_encendidas(\n", "            tools=agregar_herramientas(runtime, solo_encendidas(\n"),
        ("                getattr(runtime, \"_profile\", None),\n            ),", "                getattr(runtime, \"_profile\", None),\n            )),"),
    ]
    for antes, despues in cambios:
        if fuente.count(antes) != 1:
            raise SystemExit("Nea incompatible con el adaptador inmobiliario: revisar versión y anclas; no se aplicó el parche")
        fuente = fuente.replace(antes, despues, 1)
    ast.parse(fuente)
    archivo.write_text(fuente)


if __name__ == "__main__":
    aplicar(Path(sys.argv[1] if len(sys.argv) > 1 else "/app/app"))
