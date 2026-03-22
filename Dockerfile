# Stage 1: Build frontend
FROM node:20-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Stage 2: Production
FROM node:20-slim
WORKDIR /app

# Install system Chromium + CJK/Thai fonts (no 400MB Chromium download)
RUN apt-get update && apt-get install -y \
    chromium \
    poppler-utils \
    fonts-noto-cjk \
    fonts-noto-color-emoji \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Tell puppeteer-core to use system Chromium
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

# Layer caching: dependencies first, code second
COPY package*.json ./
RUN npm install --omit=dev

# Copy built frontend + backend
COPY --from=build /app/dist ./dist
COPY --from=build /app/server.js ./
COPY --from=build /app/backend ./backend

EXPOSE 8080
CMD ["node", "server.js"]
