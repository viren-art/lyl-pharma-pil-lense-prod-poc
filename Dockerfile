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

# Install system Chromium + CJK/Thai fonts + Python 3 + system deps for camelot
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-noto-cjk \
    fonts-noto-color-emoji \
    python3 \
    python3-pip \
    python3-venv \
    ghostscript \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Tell puppeteer-core to use system Chromium
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

# Install Python dependencies (layer cached separately)
COPY python-doc-service/requirements.txt /app/python-doc-service/
RUN pip3 install --no-cache-dir --break-system-packages -r /app/python-doc-service/requirements.txt

# Layer caching: Node dependencies first, code second
COPY package*.json ./
RUN npm install --omit=dev

# Copy built frontend + backend + Python service
COPY --from=build /app/dist ./dist
COPY --from=build /app/server.js ./
COPY --from=build /app/backend ./backend
COPY python-doc-service/ ./python-doc-service/

# Create writable directories for runtime data
RUN mkdir -p /app/backend/src/logs /app/backend/src/config/market-learned && \
    chown -R node:node /app

# Run as non-root for security
USER node

EXPOSE 8080 8081

# Start both Python doc service and Node.js server
CMD python3 /app/python-doc-service/main.py & node server.js
