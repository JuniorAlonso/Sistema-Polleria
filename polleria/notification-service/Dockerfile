FROM node:20-bookworm-slim

# Chromium del sistema para whatsapp-web.js (puppeteer)
RUN apt-get update \
    && apt-get install -y --no-install-recommends chromium fonts-noto-color-emoji \
    && rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_SKIP_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    WHATSAPP_SESSION_PATH=/app/whatsapp-session \
    NODE_ENV=production

WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .

EXPOSE 3001
# La sesión debe montarse como volumen para no re-escanear el QR en cada reinicio
VOLUME ["/app/whatsapp-session"]
CMD ["node", "main.js"]
