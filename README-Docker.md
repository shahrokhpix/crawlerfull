# راهنمای کامل Docker برای کرالر خبری

## 🐳 نصب و راه‌اندازی با Docker

### پیش‌نیازها
- **Docker** (نسخه 20.10+)
- **Docker Compose** (نسخه 2.0+)

### نصب Docker

#### Windows:
```bash
# دانلود Docker Desktop از سایت رسمی
# https://www.docker.com/products/docker-desktop
```

#### Linux (Ubuntu):
```bash
# نصب Docker
sudo apt update
sudo apt install docker.io docker-compose

# اضافه کردن کاربر به گروه docker
sudo usermod -aG docker $USER

# راه‌اندازی Docker
sudo systemctl start docker
sudo systemctl enable docker
```

#### macOS:
```bash
# نصب با Homebrew
brew install --cask docker
```

## 🚀 راه‌اندازی سریع

### 1. کلون کردن پروژه
```bash
git clone https://github.com/shahrokhpix/crawlerfull.git
cd crawlerfull
```

### 2. تنظیم متغیرهای محیطی
فایل `.env` را ایجاد کنید:
```env
# Database Configuration
DB_HOST=postgres
DB_PORT=5432
DB_NAME=crawler_db
DB_USER=crawler_user
DB_PASSWORD=your_secure_password

# Application Configuration
NODE_ENV=production
PORT=3004
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123

# Docker Configuration
DOCKER_IMAGE_TAG=latest
```

### 3. اجرای پروژه
```bash
# ساخت و اجرای کانتینرها
docker-compose up -d

# مشاهده لاگ‌ها
docker-compose logs -f
```

## 📁 فایل‌های Docker

### Dockerfile
```dockerfile
FROM node:18-alpine

# نصب وابستگی‌های سیستم
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    freetype-dev \
    harfbuzz \
    ca-certificates \
    ttf-freefont

# تنظیم متغیرهای محیطی برای Puppeteer
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# ایجاد دایرکتوری کار
WORKDIR /app

# کپی package.json و package-lock.json
COPY package*.json ./

# نصب وابستگی‌ها
RUN npm ci --only=production

# کپی کدهای برنامه
COPY . .

# ایجاد دایرکتوری‌های مورد نیاز
RUN mkdir -p logs data

# تنظیم مجوزها
RUN chown -R node:node /app
USER node

# پورت
EXPOSE 3004

# دستور اجرا
CMD ["npm", "start"]
```

### docker-compose.yml
```yaml
version: '3.8'

services:
  # PostgreSQL Database
  postgres:
    image: postgres:15-alpine
    container_name: crawler_postgres
    environment:
      POSTGRES_DB: crawler_db
      POSTGRES_USER: crawler_user
      POSTGRES_PASSWORD: your_secure_password
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./scripts/init-postgres.sql:/docker-entrypoint-initdb.d/init.sql
    ports:
      - "5432:5432"
    networks:
      - crawler_network
    restart: unless-stopped

  # Redis Cache (اختیاری)
  redis:
    image: redis:7-alpine
    container_name: crawler_redis
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    networks:
      - crawler_network
    restart: unless-stopped

  # Main Application
  crawler:
    build: .
    container_name: crawler_app
    environment:
      - NODE_ENV=production
      - DB_HOST=postgres
      - DB_PORT=5432
      - DB_NAME=crawler_db
      - DB_USER=crawler_user
      - DB_PASSWORD=your_secure_password
    ports:
      - "3004:3004"
    volumes:
      - ./logs:/app/logs
      - ./data:/app/data
      - ./config:/app/config
    depends_on:
      - postgres
      - redis
    networks:
      - crawler_network
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3004/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  # Nginx Reverse Proxy (اختیاری)
  nginx:
    image: nginx:alpine
    container_name: crawler_nginx
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf
      - ./nginx/ssl:/etc/nginx/ssl
    depends_on:
      - crawler
    networks:
      - crawler_network
    restart: unless-stopped

volumes:
  postgres_data:
  redis_data:

networks:
  crawler_network:
    driver: bridge
```

## 🔧 دستورات Docker

### مدیریت کانتینرها
```bash
# اجرای پروژه
docker-compose up -d

# توقف پروژه
docker-compose down

# راه‌اندازی مجدد
docker-compose restart

# مشاهده لاگ‌ها
docker-compose logs -f crawler

# مشاهده لاگ‌های همه سرویس‌ها
docker-compose logs -f

# ورود به کانتینر
docker-compose exec crawler sh

# مشاهده وضعیت
docker-compose ps
```

### مدیریت تصاویر
```bash
# ساخت تصویر
docker-compose build

# ساخت مجدد تصویر
docker-compose build --no-cache

# حذف تصاویر
docker-compose down --rmi all

# مشاهده تصاویر
docker images
```

### مدیریت داده‌ها
```bash
# پاک کردن داده‌ها
docker-compose down -v

# پشتیبان‌گیری از دیتابیس
docker-compose exec postgres pg_dump -U crawler_user crawler_db > backup.sql

# بازگردانی دیتابیس
docker-compose exec -T postgres psql -U crawler_user crawler_db < backup.sql
```

## 🌐 دسترسی به سرویس‌ها

پس از اجرای Docker:

- **پنل ادمین**: http://localhost:3004/admin
- **API**: http://localhost:3004/api
- **RSS Feed**: http://localhost:3004/rss
- **دیتابیس**: localhost:5432
- **Redis**: localhost:6379

## 🔒 تنظیمات امنیتی

### فایل .env امن
```env
# Database
DB_HOST=postgres
DB_PORT=5432
DB_NAME=crawler_db
DB_USER=crawler_user
DB_PASSWORD=your_very_secure_password_here

# Application
NODE_ENV=production
PORT=3004
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your_secure_admin_password

# Security
JWT_SECRET=your_jwt_secret_key_here
SESSION_SECRET=your_session_secret_here

# Docker
DOCKER_IMAGE_TAG=latest
```

### Nginx Configuration
```nginx
# nginx/nginx.conf
events {
    worker_connections 1024;
}

http {
    upstream crawler_backend {
        server crawler:3004;
    }

    server {
        listen 80;
        server_name your-domain.com;

        location / {
            proxy_pass http://crawler_backend;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
    }
}
```

## 📊 مانیتورینگ

### Docker Stats
```bash
# مشاهده آمار کانتینرها
docker stats

# مشاهده آمار خاص
docker stats crawler_app postgres redis
```

### Health Check
```bash
# بررسی سلامت سرویس‌ها
curl http://localhost:3004/api/health

# بررسی از داخل کانتینر
docker-compose exec crawler curl http://localhost:3004/api/health
```

## 🚀 Production Deployment

### 1. تنظیمات Production
```bash
# کپی فایل‌های تنظیمات
cp .env.example .env.production

# ویرایش تنظیمات
nano .env.production
```

### 2. اجرا در Production
```bash
# اجرا با تنظیمات production
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# یا استفاده از اسکریپت
./deploy.sh
```

### 3. SSL Certificate
```bash
# نصب Certbot
docker-compose exec nginx apk add certbot

# دریافت گواهی SSL
docker-compose exec nginx certbot --nginx -d your-domain.com
```

## 🔧 Troubleshooting

### مشکلات رایج

#### کانتینر اجرا نمی‌شود:
```bash
# بررسی لاگ‌ها
docker-compose logs crawler

# بررسی وضعیت
docker-compose ps

# راه‌اندازی مجدد
docker-compose restart crawler
```

#### مشکل اتصال دیتابیس:
```bash
# بررسی وضعیت PostgreSQL
docker-compose logs postgres

# ورود به دیتابیس
docker-compose exec postgres psql -U crawler_user -d crawler_db
```

#### مشکل حافظه:
```bash
# تنظیم محدودیت حافظه در docker-compose.yml
services:
  crawler:
    deploy:
      resources:
        limits:
          memory: 1G
```

### پاک‌سازی
```bash
# پاک کردن همه چیز
docker-compose down -v --rmi all

# پاک کردن تصاویر استفاده نشده
docker image prune -a

# پاک کردن کانتینرهای متوقف شده
docker container prune
```

## 📈 Scaling

### افزایش تعداد نمونه‌ها
```bash
# افزایش تعداد نمونه‌های کرالر
docker-compose up -d --scale crawler=3
```

### Load Balancer
```bash
# اضافه کردن Load Balancer
docker-compose -f docker-compose.yml -f docker-compose.scale.yml up -d
```

## 🎯 مزایای استفاده از Docker

1. **سازگاری**: اجرا در هر محیطی
2. **ایزولاسیون**: جداسازی کامل سرویس‌ها
3. **مقیاس‌پذیری**: افزایش آسان نمونه‌ها
4. **مدیریت آسان**: دستورات ساده
5. **پشتیبان‌گیری**: مدیریت آسان داده‌ها
6. **امنیت**: ایزولاسیون و محدودیت‌ها

---

**نکته**: برای استفاده در محیط production، حتماً تنظیمات امنیتی و SSL را فعال کنید.