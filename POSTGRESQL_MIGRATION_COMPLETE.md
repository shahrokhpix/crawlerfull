# ✅ تبدیل کامل از SQLite به PostgreSQL

## خلاصه تبدیل

تمام کوئری‌های SQLite در کدبیس به PostgreSQL تبدیل شده‌اند. در ادامه جزئیات کامل تغییرات ارائه می‌شود:

## فایل‌های تبدیل شده

### 1. تنظیمات پایگاه داده
- ✅ `config/database.js` - تبدیل کامل به PostgreSQL
- ✅ `config/config.js` - به‌روزرسانی تنظیمات دیتابیس
- ✅ `config/postgresql.js` - تنظیمات PostgreSQL
- ✅ `config/database-postgresql.js` - تنظیمات PostgreSQL جایگزین

### 2. سرویس‌های اصلی
- ✅ `services/crawler.js` - استفاده از PostgreSQL
- ✅ `services/scheduler.js` - استفاده از PostgreSQL
- ✅ `services/queueManager.js` - استفاده از PostgreSQL
- ✅ `services/performanceMonitor.js` - استفاده از PostgreSQL
- ✅ `services/databaseOptimizer.js` - بهینه‌سازی PostgreSQL
- ✅ `services/compressionService.js` - تبدیل کوئری‌های SQLite
- ✅ `services/cleanup.js` - استفاده از PostgreSQL
- ✅ `services/loadBalancer.js` - استفاده از PostgreSQL
- ✅ `services/connectionPool.js` - پول اتصال PostgreSQL

### 3. فایل‌های پیکربندی
- ✅ `package.json` - انتقال sqlite3 به devDependencies
- ✅ `Makefile` - به‌روزرسانی دستورات backup
- ✅ `README-Docker.md` - به‌روزرسانی مستندات

### 4. اسکریپت‌های migration
- ✅ `scripts/migrate-to-postgresql.js` - اسکریپت migration

## تغییرات کلیدی

### قبل (SQLite)
```javascript
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./database/news.db');
db.all('SELECT * FROM articles', callback);
```

### بعد (PostgreSQL)
```javascript
const { Pool } = require('pg');
const pool = new Pool({
  user: 'farsnews_user',
  host: 'localhost',
  database: 'farsnews_crawler_spider_db',
  password: 'farsnews123',
  port: 5432
});
const result = await pool.query('SELECT * FROM articles');
```

### قبل (SQLite)
```javascript
db.run('INSERT INTO articles (title, link) VALUES (?, ?)', [title, link]);
```

### بعد (PostgreSQL)
```javascript
await pool.query('INSERT INTO articles (title, link) VALUES ($1, $2)', [title, link]);
```

### قبل (SQLite)
```javascript
db.all('SELECT * FROM articles WHERE created_at < datetime("now", "-7 days")');
```

### بعد (PostgreSQL)
```javascript
await pool.query('SELECT * FROM articles WHERE created_at < NOW() - INTERVAL \'7 days\'');
```

### قبل (SQLite)
```javascript
db.run('VACUUM');
```

### بعد (PostgreSQL)
```javascript
await pool.query('VACUUM ANALYZE');
```

## جداول ایجاد شده

تمام جداول PostgreSQL با ساختار مناسب ایجاد شده‌اند:

- `news_sources` - منابع خبری
- `articles` - مقالات
- `queue_jobs` - صف کارها
- `performance_metrics` - متریک‌های عملکرد
- `selector_configs` - پیکربندی selector
- `admin_users` - کاربران ادمین
- `crawl_logs` - لاگ‌های کرال
- `operation_logs` - لاگ‌های عملیات
- `crawl_history` - تاریخچه کرال
- `schedules` - زمان‌بندی‌ها

## ایندکس‌های بهینه

ایندکس‌های ضروری برای عملکرد بهتر ایجاد شده‌اند:

- `idx_articles_created_at`
- `idx_articles_source_id`
- `idx_articles_hash`
- `idx_sources_active`
- `idx_crawl_history_timestamp`
- `idx_performance_metrics_timestamp`
- `idx_queue_status_priority`

## تنظیمات محیطی

متغیرهای محیطی برای PostgreSQL:

```bash
DB_HOST=localhost
DB_PORT=5432
DB_NAME=farsnews_crawler_spider_db
DB_USER=farsnews_user
DB_PASSWORD=farsnews123
```

## دستورات migration

### اجرای migration
```bash
npm run migrate
```

### پشتیبان‌گیری از PostgreSQL
```bash
make db-backup
```

### دسترسی به shell دیتابیس
```bash
make db-shell
```

## بهینه‌سازی‌های PostgreSQL

- استفاده از connection pooling
- تنظیم timeout های مناسب
- استفاده از prepared statements
- بهینه‌سازی کوئری‌ها
- استفاده از VACUUM ANALYZE

## وضعیت نهایی

✅ تمام کوئری‌های SQLite تبدیل شده‌اند
✅ تمام سرویس‌ها از PostgreSQL استفاده می‌کنند
✅ تنظیمات محیطی به‌روزرسانی شده‌اند
✅ مستندات به‌روزرسانی شده‌اند
✅ اسکریپت migration آماده است
✅ پشتیبان‌گیری PostgreSQL فعال است

کدبیس حالا کاملاً آماده استفاده از PostgreSQL است. تمام کدهای SQLite-specific حذف شده و سیستم بهینه‌سازی شده است. با اجرای migration script، داده‌های موجود نیز منتقل خواهند شد.

**نکته مهم**: قبل از اجرای migration، حتماً از دیتابیس SQLite backup بگیرید.

## تست نهایی

برای اطمینان از عملکرد صحیح:

1. راه‌اندازی PostgreSQL
2. اجرای migration
3. تست تمام API endpoints
4. بررسی لاگ‌ها برای خطاهای دیتابیس
5. تست عملکرد سیستم

## پشتیبانی

در صورت بروز مشکل در migration، فایل‌های backup در دسترس خواهند بود و می‌توانید به SQLite برگردید. 