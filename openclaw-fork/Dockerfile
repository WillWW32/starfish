# Starfish Backend Dockerfile
FROM node:20-slim AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install ALL dependencies (need devDeps for TypeScript build)
RUN npm install

# Copy source
COPY . .

# Build TypeScript
RUN npm run build

# === Production stage ===
FROM node:20-slim

# Install dependencies for Playwright + native modules
RUN apt-get update && apt-get install -y \
  curl \
  wget \
  gnupg \
  ca-certificates \
  fonts-liberation \
  libasound2 \
  libatk-bridge2.0-0 \
  libatk1.0-0 \
  libcups2 \
  libdbus-1-3 \
  libdrm2 \
  libgbm1 \
  libgtk-3-0 \
  libnspr4 \
  libnss3 \
  libxcomposite1 \
  libxdamage1 \
  libxfixes3 \
  libxkbcommon0 \
  libxrandr2 \
  xdg-utils \
  python3 \
  make \
  g++ \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files and install production deps, rebuild native modules
COPY package*.json ./
RUN npm install --omit=dev --ignore-scripts && npm rebuild bcrypt better-sqlite3

# Install Playwright browsers
RUN npx playwright install chromium

# Copy built files from builder
COPY --from=builder /app/dist ./dist

# Copy agent configs
COPY agent-configs ./agent-configs

# Create directories for data persistence
RUN mkdir -p /app/data /app/skills

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Start
CMD ["node", "dist/index.js"]
