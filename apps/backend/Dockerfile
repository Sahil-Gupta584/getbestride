FROM node:22-slim AS base

# Install system dependencies for Chromium / Playwright
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    ca-certificates \
    libnss3 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libpango-1.0-0 \
    libcairo2 \
    libasound2 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy root configurations and workspace packages
COPY package*.json turbo.json ./
COPY packages/ ./packages/
COPY apps/backend/ ./apps/backend/

# Install dependencies across monorepo workspaces
RUN npm install

WORKDIR /app/apps/backend

EXPOSE 4000
ENV PORT=4000
ENV NODE_ENV=production

CMD ["npm", "run", "dev"]
