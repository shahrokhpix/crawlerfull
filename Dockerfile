# Use Node.js 20 Debian slim for broader compatibility (Playwright support)
FROM node:20-bullseye-slim

# Install system dependencies for Chromium, Chromedriver, and headless browsing
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    ca-certificates \
    curl \
    git \
    chromium \
    chromium-driver \
    fonts-liberation \
    fonts-freefont-ttf \
    libnss3 \
    libatk-bridge2.0-0 \
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
    libatspi2.0-0 \
    libgtk-3-0 \
    xvfb \
  && rm -rf /var/lib/apt/lists/*

# Environment variables
ENV NODE_ENV=production \
    TZ=Asia/Tehran \
    PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_SKIP_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# Create working directory
WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./

# Use fast mirror and install deps
RUN npm config set registry https://registry.npmmirror.com && \
    npm install --only=production --ignore-scripts && \
    npm cache clean --force

# Copy application code
COPY . .

# Prepare playwright browser cache directory for node user and install chromium browser
# Do this as the node user so caches live under /home/node/.cache
RUN mkdir -p /home/node/.cache/ms-playwright && chown -R node:node /home/node/.cache
USER node
RUN npx playwright install chromium && npx playwright --version || true

# Switch back to root to set permissions on app dirs, then return to node
USER root
RUN mkdir -p logs data && \
    chmod 755 /app && \
    chmod -R 777 logs data public && \
    chown -R node:node /app

# Use non-root user for running the app
USER node

# Expose port
EXPOSE 3004

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:3004/api/health || exit 1

# Start command
CMD ["npm", "start"]
