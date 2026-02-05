# Starfish Backend Dockerfile
FROM node:20-slim AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# === Production stage ===
FROM node:20-slim

RUN apt-get update && apt-get install -y \
    curl wget gnupg ca-certificates fonts-liberation \
    libasound2 libatk-bridge2.0-0 libatk1.0-0 libcups2 \
    libdbus-1-3 libdrm2 libgbm1 libgtk-3-0 libnspr4 libnss3 \
    libxcomposite1 libxdamage1 libxfixes3 libxkbcommon0 \
    libxrandr2 xdg-utils python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts && npm rebuild bcrypt
RUN npx playwright install chromium

COPY --from=builder /app/dist ./dist
COPY agent-configs ./agent-configs
RUN mkdir -p /app/data /app/skills

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1
CMD ["node", "dist/index.js"]
