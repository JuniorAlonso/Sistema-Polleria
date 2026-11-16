FROM node:20.18.1-bookworm-slim

# Chromium del sistema para whatsapp-web.js (puppeteer) y git para dependencias de GitHub
RUN apt-get update \
    && apt-get install -y --no-install-recommends chromium fonts-noto-color-emoji git \
    && rm -rf /var/lib/apt/lists/*

# Forzar git a usar HTTPS para evitar fallos por SSH dentro del contenedor
RUN git config --system url."https://github.com/".insteadOf "ssh://git@github.com/" \
    && git config --system url."https://github.com/".insteadOf "git@github.com:"

ENV PUPPETEER_SKIP_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    PUPPETEER_NO_SANDBOX=true \
    WHATSAPP_SESSION_PATH=/app/whatsapp-session \
    TZ=America/Lima \
    NODE_ENV=production

WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
RUN mkdir -p /app/whatsapp-session && chown -R node:node /app

USER node

EXPOSE 3001
# La sesión debe montarse como volumen para no re-escanear el QR en cada reinicio
VOLUME ["/app/whatsapp-session"]
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 3001) + '/api/notificaciones/status').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"
CMD ["node", "main.js"]
