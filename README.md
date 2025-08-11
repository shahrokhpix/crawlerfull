# Universal News Crawler

یک سیستم کرال اخبار پیشرفته با قابلیت پشتیبانی از انواع مختلف وب‌سایت‌ها و درایورها.

## 🚀 ویژگی‌ها

- **پشتیبانی از چندین درایور:** Puppeteer, Selenium, Playwright, Cheerio
- **مدیریت هوشمند Rate Limiting**
- **پنل ادمین کامل** برای مدیریت منابع خبری
- **پشتیبانی از PostgreSQL و Redis**
- **سیستم لاگینگ پیشرفته**
- **API کامل** برای مدیریت و کرال

## 📋 پیش‌نیازها

- Docker و Docker Compose
- Node.js 18+
- PostgreSQL (اختیاری - در Docker موجود است)

## 🛠️ نصب و راه‌اندازی

### 1. کلون کردن پروژه
```bash
git clone <repository-url>
cd farsnewslatest1
```

### 2. تنظیم متغیرهای محیطی
```bash
cp .env.example .env
# فایل .env را ویرایش کنید
```

### 3. راه‌اندازی با Docker
```bash
docker-compose up -d
```

### 4. دسترسی به پنل ادمین
- **URL:** http://localhost:3004/admin
- **نام کاربری:** admin
- **رمز عبور:** admin123

## 🔧 تنظیمات

### متغیرهای محیطی مهم:
- `DB_PASSWORD`: رمز عبور دیتابیس PostgreSQL
- `ADMIN_USERNAME`: نام کاربری ادمین
- `ADMIN_PASSWORD`: رمز عبور ادمین
- `NODE_ENV`: محیط اجرا (production/development)

## 📊 API Endpoints

### احراز هویت
- `POST /api/auth/login` - ورود ادمین

### مدیریت منابع خبری
- `GET /api/sources` - دریافت لیست منابع
- `POST /api/sources` - افزودن منبع جدید
- `PUT /api/sources/:id` - ویرایش منبع
- `DELETE /api/sources/:id` - حذف منبع

### کرال
- `POST /api/crawler/crawl` - شروع کرال
- `POST /api/crawler/test-selector` - تست سلکتور
- `GET /api/logs` - مشاهده لاگ‌ها

### مقالات
- `GET /api/articles` - دریافت مقالات
- `GET /api/articles?new=true` - مقالات جدید
- `GET /rss` - فید RSS

## 🎯 استفاده

1. **مدیریت منابع خبری:** از طریق پنل ادمین منابع خبری را اضافه کنید
2. **تنظیم سلکتورها:** برای هر منبع سلکتورهای CSS مناسب تعریف کنید
3. **انتخاب درایور:** بر اساس پیچیدگی سایت، درایور مناسب انتخاب کنید
4. **شروع کرال:** از طریق API یا پنل ادمین کرال را شروع کنید

## 🔍 عیب‌یابی

### مشکلات رایج:
1. **خطای اتصال دیتابیس:** رمز عبور PostgreSQL را بررسی کنید
2. **کرال ناموفق:** سلکتورها و درایور را بررسی کنید
3. **Rate Limiting:** تنظیمات محدودیت نرخ را بررسی کنید

## 📝 لایسنس

این پروژه تحت لایسنس MIT منتشر شده است.