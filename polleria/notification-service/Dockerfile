FROM node:20-bookworm-slim

# Chromium del sistema para whatsapp-web.js (puppeteer) y git para dependencias de GitHub
RUN apt-get update \
    && apt-get install -y --no-install-recommends chromium fonts-noto-color-emoji git \
    && rm -rf /var/lib/apt/lists/*

# Forzar git a usar HTTPS para evitar fallos por SSH dentro del contenedor
RUN git config --global url."https://github.com/".insteadOf "ssh://git@github.com/" \
    && git config --global url."https://github.com/".insteadOf "git@github.com:"


ENV PUPPETEER_SKIP_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    WHATSAPP_SESSION_PATH=/app/whatsapp-session \
    TZ=America/Lima \
    NODE_ENV=production

WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .

EXPOSE 3001
# La sesión debe montarse como volumen para no re-escanear el QR en cada reinicio
VOLUME ["/app/whatsapp-session"]
CMD ["node", "main.js"]
