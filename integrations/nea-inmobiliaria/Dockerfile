# Overlay opcional; no cambia las etiquetas oficiales ni el usuario de runtime.
ARG NEA_VERSION=2.0.2
FROM ghcr.io/kevinrivm/nea-agent:${NEA_VERSION} AS adaptador
USER root
COPY aplicar.py /tmp/aplicar-inmobiliaria.py
RUN python /tmp/aplicar-inmobiliaria.py /app/app

# Hereda intactos el usuario sin root, entrypoint y CMD de la imagen original.
FROM ghcr.io/kevinrivm/nea-agent:${NEA_VERSION}
COPY --from=adaptador /app/app/turn.py /app/app/turn.py
COPY inmobiliaria.py /app/app/inmobiliaria.py
