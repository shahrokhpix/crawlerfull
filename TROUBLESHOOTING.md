# 🔧 راهنمای عیب‌یابی FarsNews Crawler

## 🚨 مشکلات رایج و راه‌حل‌ها

### 1. تغییر غیرمجاز پارامتر PostgreSQL در زمان اجرا

**خطا:**
```
error: parameter "shared_preload_libraries" cannot be changed without restarting the server
code: '55P02'
```

**علت:** پارامتر سطح سرور بوده و وسط اجرا قابل تغییر نیست.

**راه‌حل:**
```bash
# ری‌استارت کامل دیتابیس
docker-compose restart postgres
```

### 2. سینتکس اشتباه در پارامترهای زمانی PostgreSQL

**خطا:**
```
error: trailing junk after numeric literal at or near "30000ms"
code: '42601'
```

**علت:** PostgreSQL مقدار زمان را به صورت `30000` یا `'30s'` می‌گیرد، عبارت `30000ms` معتبر نیست.

**راه‌حل:**
```sql
SET statement_timeout = '30s';
-- یا
SET statement_timeout = 30000;
```

### 3. خطا در پردازش داده بازگشتی

**خطا:**
```
Cannot read properties of undefined (reading 'count')
rows.forEach is not a function
```

**علت:** نتیجه query گاهی undefined یا ساختارش متفاوت از انتظار است.

**راه‌حل:**
```javascript
if (rows && Array.isArray(rows)) {
  rows.forEach(...)
}
```

### 4. مشکل اتصال به دیتابیس (ECONNREFUSED)

**خطا:**
```
connect ECONNREFUSED 127.0.0.1:5432
```

**علت:** PostgreSQL در دسترس نبوده یا پورت/هاست اشتباه تنظیم شده.

**راه‌حل:**
```bash
# بررسی وضعیت PostgreSQL
docker-compose ps

# اطمینان از آدرس درست در DATABASE_HOST 
# در Docker باید سرویس Network Name باشد نه 127.0.0.1
```

### 5. استفاده اشتباه از global.databaseOptimizer

**خطا:**
```
global.databaseOptimizer.on is not a function
```

**علت:** global.databaseOptimizer باید EventEmitter باشد اما مقداردهی نشده یا نوعش اشتباه است.

**راه‌حل:**
```javascript
const EventEmitter = require('events');
global.databaseOptimizer = new EventEmitter();
```

### 6. خطا در graceful shutdown

**خطا:**
```
global.cacheManager.clearAll is not a function
```

**علت:** تابع clearAll در cacheManager وجود ندارد.

**راه‌حل:** ✅ **حل شده** - چک کردن وجود تابع قبل از فراخوانی

### 7. خطا در scheduler

**خطا:**
```
TypeError: rows.map is not a function
```

**علت:** در PostgreSQL، `db.query` یک object برمی‌گرداند که شامل `rows` است.

**راه‌حل:** ✅ **حل شده** - استفاده از `result.rows`

## 🚀 راه‌اندازی سیستم

### روش 1: Docker (توصیه شده)
```bash
# راه‌اندازی کامل
start-docker-system.bat

# یا مستقیماً
docker-compose up --build -d
```

### روش 2: PM2
```bash
# راه‌اندازی با PM2
pm2-manager.bat

# یا مستقیماً
pm2 start index.js --name "farsnews-crawler"
```

### روش 3: مستقیم
```bash
cd farsnewslatest1
node index.js
```

## 📊 تست سیستم

### تست ساده
```bash
cd test
node simple-test.js
```

### تست سلامت
```bash
curl http://localhost:3004/api/health
```

## 🔍 بررسی لاگ‌ها

### Docker
```bash
# همه لاگ‌ها
docker-compose logs

# لاگ‌های خاص
docker logs farsnews-crawler
docker logs farsnews_postgres
```

### PM2
```bash
# لاگ‌های PM2
pm2 logs

# لاگ‌های خاص
pm2 logs farsnews-crawler
```

## 🛠️ دستورات مفید

### Docker
```bash
# راه‌اندازی
docker-compose up -d

# توقف
docker-compose down

# راه‌اندازی مجدد
docker-compose restart

# بازسازی
docker-compose up --build -d
```

### PM2
```bash
# وضعیت
pm2 status

# راه‌اندازی مجدد
pm2 restart all

# توقف
pm2 stop all

# حذف
pm2 delete all
```

## 📍 آدرس‌های دسترسی

- **سرور اصلی**: http://localhost:3004
- **پنل ادمین**: http://localhost:3004/admin
- **PgAdmin**: http://localhost:8080
  - Email: admin@example.com
  - Password: admin123

## 🔧 تنظیمات دیتابیس

### متغیرهای محیطی
```env
DB_HOST=postgres
DB_PORT=5432
DB_USER=crawler_user
DB_NAME=farsnews_crawler_spider_db
DB_PASSWORD=8bmh8y19zNJahAv5Aa4B
```

### جداول اصلی
- `news_sources` - منابع خبری
- `articles` - مقالات
- `schedules` - زمان‌بندی‌ها
- `cleanup_schedules` - زمان‌بندی‌های پاک‌سازی
- `admin_users` - کاربران ادمین

## ⚠️ نکات مهم

1. **Docker**: همیشه از Docker استفاده کنید برای محیط ایزوله
2. **PostgreSQL**: اطمینان حاصل کنید که دیتابیس healthy است
3. **Ports**: پورت‌های 3004، 5433، 8080 باید آزاد باشند
4. **Memory**: حداقل 2GB RAM نیاز است
5. **Network**: در Docker، سرویس‌ها باید در یک network باشند

## 🆘 درخواست کمک

اگر مشکل حل نشد:

1. لاگ‌های کامل را بررسی کنید
2. وضعیت کانتینرها را چک کنید
3. تست‌های ساده را اجرا کنید
4. مستندات Docker و PostgreSQL را مطالعه کنید 