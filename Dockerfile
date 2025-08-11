# Use Node.js 20 Alpine for smaller size
FROM node:20-alpine

# Install system dependencies
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    freetype-dev \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    curl \
    bash \
    git \
    && rm -rf /var/cache/apk/*

# Set environment variables for Puppeteer
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser \
    PUPPETEER_SKIP_DOWNLOAD=true \
    NODE_ENV=production \
    TZ=Asia/Tehran

# Create working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Configure npm for Iranian mirrors and install dependencies
RUN npm config set registry https://registry.npmmirror.com && \
    npm install --only=production --ignore-scripts && \
    npm cache clean --force

# Copy application code
COPY . .

# Create required directories with proper permissions
RUN mkdir -p logs data config public && \
    chmod 755 /app && \
    chmod -R 755 logs data config public && \
    chown -R node:node /app

# Switch to node user for security
USER node

# Expose port
EXPOSE 3004

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:3004/api/health || exit 1

# Start command
CMD ["npm", "start"]
