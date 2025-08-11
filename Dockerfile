# استفاده از Node.js 18 Alpine برای حجم کمتر
FROM node:18-alpine

# نصب وابستگی‌های سیستم مورد نیاز
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

# تنظیم متغیرهای محیطی برای Puppeteer
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser \
    NODE_ENV=production \
    TZ=Asia/Tehran

# ایجاد دایرکتوری کار
WORKDIR /app

# کپی package.json و package-lock.json
COPY package*.json ./

# نصب وابستگی‌ها
RUN npm ci --only=production && npm cache clean --force

# کپی کدهای برنامه
COPY . .

# ایجاد دایرکتوری‌های مورد نیاز
RUN mkdir -p logs data config public && \
    chown -R node:node /app

# تغییر به کاربر node برای امنیت
USER node

# پورت
EXPOSE 3004

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:3004/api/health || exit 1

# دستور اجرا
CMD ["npm", "start"]
