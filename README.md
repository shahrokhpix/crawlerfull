# 🚀 کرالر خبری پیشرفته

یک سیستم کرالر خبری کامل و پیشرفته با قابلیت‌های مدیریتی، API کامل و پشتیبانی از Docker.

## 🌟 ویژگی‌های کلیدی

- **🐳 پشتیبانی کامل از Docker** - راه‌اندازی آسان با یک دستور
- **🌐 کرالر جهانی** - پشتیبانی از منابع خبری مختلف
- **🎛️ پنل مدیریتی** - رابط کاربری کامل برای مدیریت
- **🔌 WebSocket** - لاگ‌های realtime
- **⚖️ Load Balancer** - مدیریت بار خودکار
- **🗄️ PostgreSQL** - دیتابیس قدرتمند و بهینه
- **📊 API کامل** - RESTful API برای توسعه‌دهندگان
- **📝 سیستم لاگ** - ثبت و نظارت کامل عملیات
- **⏰ زمان‌بندی** - کرال خودکار
- **🧹 پاک‌سازی** - مدیریت حافظه و دیتابیس

## 🚀 راه‌اندازی سریع با Docker

### پیش‌نیازها
- **Docker** (نسخه 20.10+)
- **Docker Compose** (نسخه 2.0+)

### نصب و راه‌اندازی

```bash
# 1. کلون کردن پروژه
git clone https://github.com/shahrokhpix/crawlerfull.git
cd crawlerfull

# 2. تنظیم متغیرهای محیطی
cp .env.example .env
# فایل .env را ویرایش کنید

# 3. اجرای پروژه
# Windows:
docker-start.bat

# Linux/Mac:
chmod +x docker-start.sh
./docker-start.sh

# یا مستقیماً:
docker-compose up -d
```

### دسترسی به سرویس‌ها
- **پنل ادمین**: http://localhost:3004/admin
- **API**: http://localhost:3004/api
- **RSS Feed**: http://localhost:3004/rss

### اطلاعات ورود پیش‌فرض
- **نام کاربری**: admin
- **رمز عبور**: admin123

## 📚 مستندات کامل

- [📖 راهنمای Docker](README-Docker.md) - راهنمای کامل Docker
- [🔧 راهنمای نصب](README-FINAL.md) - نصب بدون Docker
- [🐳 راهنمای Docker](README-Docker.md) - راهنمای Docker
- [🚀 راهنمای استقرار](SERVER_DEPLOYMENT_GUIDE.md) - استقرار در سرور

## 🛠️ دستورات مفید Docker

```bash
# اجرای پروژه
docker-compose up -d

# مشاهده لاگ‌ها
docker-compose logs -f

# توقف پروژه
docker-compose down

# راه‌اندازی مجدد
docker-compose restart

# پاک کردن کامل
docker-compose down -v --rmi all

# به‌روزرسانی
docker-compose pull
docker-compose up -d
```

## 🧪 تست‌ها

```bash
# تست سریع
cd test
node quick-test.js

# تست استرس
node stress-test.js

# تست پیشرفته
node advanced-stress-test.js
```

## 📊 API Documentation

### Legacy Endpoints
- `GET /api/farsnews` - کرال مقالات جدید
- `GET /api/articles` - دریافت مقالات ذخیره شده
- `GET /api/stats` - آمار کرال
- `GET /rss` - RSS feed

### New Universal Crawler API
- `POST /api/auth/login` - ورود ادمین
- `GET /api/sources` - مدیریت منابع خبری
- `POST /api/crawler/crawl` - کرالر جهانی
- `GET /api/logs` - مشاهده لاگ‌های کرال

### Load Balancer API
- `GET /api/load-balancer/status` - وضعیت Load Balancer
- `POST /api/load-balancer/mode` - تنظیم حالت بار

## 🏗️ ساختار پروژه

```
farsnews/
├── 📄 index.js                 # فایل اصلی برنامه
├── 📁 config/                  # تنظیمات
├── 📁 services/                # سرویس‌های اصلی
├── 📁 routes/                  # مسیرهای API
├── 📁 middleware/              # میان‌افزارها
├── 📁 public/                  # فایل‌های عمومی
├── 📁 logs/                    # لاگ‌ها
├── 📁 utils/                   # ابزارهای کمکی
├── 📁 test/                    # تست‌ها
├── 🗄️ PostgreSQL               # دیتابیس PostgreSQL
├── ⚙️ ecosystem.config.js      # تنظیمات PM2
├── 🔧 .env                     # متغیرهای محیطی
├── 📦 package.json             # وابستگی‌ها
├── 🐳 docker-compose.yml       # تنظیمات Docker
├── 🐳 Dockerfile               # فایل Docker
└── 🚀 docker-start.sh          # اسکریپت Docker
```

## 🔒 امنیت

### تنظیمات امنیتی توصیه شده:
1. **تغییر رمز عبور پیش‌فرض**
2. **استفاده از HTTPS** (با Nginx)
3. **محدودیت دسترسی IP** (در صورت نیاز)
4. **به‌روزرسانی منظم سیستم**
5. **نظارت بر لاگ‌ها**

## 🐛 عیب‌یابی

### مشکلات رایج Docker:

#### کانتینر اجرا نمی‌شود:
```bash
docker-compose logs crawler
docker-compose ps
```

#### مشکل اتصال دیتابیس:
```bash
docker-compose logs postgres
docker-compose exec postgres psql -U crawler_user -d crawler_db
```

#### مشکل حافظه:
```bash
docker stats
docker system prune
```

## 🤝 مشارکت

برای مشارکت در پروژه:

1. Fork کنید
2. Branch جدید ایجاد کنید (`git checkout -b feature/AmazingFeature`)
3. تغییرات را commit کنید (`git commit -m 'Add some AmazingFeature'`)
4. Push کنید (`git push origin feature/AmazingFeature`)
5. Pull Request ایجاد کنید

## 📄 لایسنس

این پروژه تحت لایسنس MIT منتشر شده است.

## 📞 پشتیبانی

برای گزارش مشکلات یا سوالات:
- GitHub Issues: [اینجا](https://github.com/shahrokhpix/crawlerfull/issues)
- Email: shahrokhpix@gmail.com

---

**⭐ اگر این پروژه برایتان مفید بود، لطفاً آن را ستاره دهید!**

**⚠️ نکته**: قبل از استفاده در محیط production، حتماً تنظیمات امنیتی را بررسی و بهینه کنید.