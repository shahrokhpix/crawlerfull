# راهنمای سیستم مدیریت بار (Load Balancer)

## مقدمه

سیستم مدیریت بار به صورت خودکار بار سیستم را کنترل می‌کند و از مشکلات عملکرد جلوگیری می‌کند. این سیستم شامل cron jobs هوشمند است که به صورت مداوم وضعیت سیستم را بررسی و تنظیم می‌کند.

## ویژگی‌های اصلی

### 1. مانیتورینگ خودکار
- بررسی بار CPU هر 30 ثانیه
- بررسی حافظه هر 5 دقیقه
- بررسی دیتابیس هر 30 دقیقه
- بررسی سلامت سیستم هر 10 دقیقه

### 2. تنظیم خودکار بار
- **حالت عادی (Normal)**: 3 کرال همزمان
- **حالت متوسط (Moderate)**: 2 کرال همزمان
- **حالت بالا (High)**: 1 کرال همزمان
- **حالت اضطراری (Emergency)**: 0 کرال همزمان

### 3. پاکسازی خودکار
- پاکسازی حافظه در صورت استفاده بالا
- پاکسازی cache هر 15 دقیقه
- پاکسازی لاگ‌های قدیمی هر ساعت
- بهینه‌سازی دیتابیس هر 30 دقیقه

## API Endpoints

### 1. دریافت وضعیت
```bash
GET /api/load-balancer/status
```

### 2. تنظیم حالت بار
```bash
POST /api/load-balancer/mode
{
  "mode": "normal" // normal, moderate, high, emergency
}
```

### 3. پاکسازی اضطراری
```bash
POST /api/load-balancer/emergency-cleanup
```

### 4. پاکسازی حافظه
```bash
POST /api/load-balancer/memory-cleanup
```

### 5. بهینه‌سازی دیتابیس
```bash
POST /api/load-balancer/database-optimization
```

### 6. تنظیم آستانه‌ها
```bash
POST /api/load-balancer/thresholds
{
  "cpu": 70,
  "memory": 75,
  "disk": 85,
  "database": 2000
}
```

### 7. دریافت آمار سیستم
```bash
GET /api/load-balancer/system-stats
```

### 8. شروع/توقف سیستم
```bash
POST /api/load-balancer/toggle
{
  "action": "start" // start, stop
}
```

## Cron Jobs

### 1. بررسی بار (هر 30 ثانیه)
```javascript
'*/30 * * * * *'
```
- بررسی CPU، حافظه، دیتابیس
- تشخیص سطح بار
- تنظیم خودکار حالت

### 2. پاکسازی حافظه (هر 5 دقیقه)
```javascript
'*/5 * * * *'
```
- پاکسازی cache ها
- Garbage Collection
- پاکسازی حافظه غیرضروری

### 3. بهینه‌سازی دیتابیس (هر 30 دقیقه)
```javascript
'*/30 * * * *'
```
- تحلیل جداول
- پاکسازی داده‌های قدیمی
- بهینه‌سازی index ها

### 4. پاکسازی لاگ‌ها (هر ساعت)
```javascript
'0 * * * *'
```
- حذف لاگ‌های قدیمی (بیش از 7 روز)
- آزادسازی فضای دیسک

### 5. بررسی سلامت (هر 10 دقیقه)
```javascript
'*/10 * * * *'
```
- بررسی وضعیت کلی سیستم
- اقدامات اصلاحی خودکار

### 6. پاکسازی Cache (هر 15 دقیقه)
```javascript
'*/15 * * * *'
```
- پاکسازی cache های منقضی شده
- آزادسازی حافظه

### 7. تنظیم مجدد بار (هر 2 دقیقه)
```javascript
'*/2 * * * *'
```
- بهبود تدریجی در صورت کاهش بار
- تنظیم خودکار حالت‌ها

## حالت‌های بار

### حالت عادی (Normal)
```javascript
{
  concurrentCrawls: 3,
  delayBetweenCrawls: 2000,
  timeoutMultiplier: 1
}
```

### حالت متوسط (Moderate)
```javascript
{
  concurrentCrawls: 2,
  delayBetweenCrawls: 5000,
  timeoutMultiplier: 1.5
}
```

### حالت بالا (High)
```javascript
{
  concurrentCrawls: 1,
  delayBetweenCrawls: 10000,
  timeoutMultiplier: 2
}
```

### حالت اضطراری (Emergency)
```javascript
{
  concurrentCrawls: 0,
  delayBetweenCrawls: 30000,
  timeoutMultiplier: 3
}
```

## آستانه‌های پیش‌فرض

- **CPU**: 70%
- **حافظه**: 75%
- **دیسک**: 85%
- **دیتابیس**: 2000ms

## اقدامات خودکار

### 1. حافظه بحرانی (>85%)
- پاکسازی اضطراری cache ها
- Garbage Collection اجباری
- تنظیم حالت اضطراری

### 2. CPU بحرانی (>85%)
- کاهش تعداد کرال‌های همزمان
- تنظیم حالت اضطراری
- افزایش delay بین کرال‌ها

### 3. دیتابیس کند (>3000ms)
- بهینه‌سازی خودکار دیتابیس
- پاکسازی داده‌های قدیمی
- تحلیل جداول

### 4. بهبود تدریجی
- در صورت کاهش بار، حالت‌ها به تدریج بهبود می‌یابند
- از حالت اضطراری به بالا، سپس متوسط و نهایتاً عادی

## لاگ‌ها و مانیتورینگ

### لاگ‌های مهم
```
🔄 تغییر حالت بار: normal → moderate
⚠️ بار سیستم: high - CPU: 82%, Memory: 78%
🚨 حافظه بحرانی، شروع پاکسازی اضطراری...
✅ پاکسازی حافظه تکمیل شد
```

### مانیتورینگ
- تمام تغییرات در لاگ‌ها ثبت می‌شوند
- آمار سیستم در API قابل دسترسی است
- هشدارهای خودکار برای مشکلات

## تنظیمات پیشرفته

### تنظیم آستانه‌ها
```javascript
loadBalancer.setThresholds(65, 70, 80, 1500);
```

### تنظیم حالت‌های بار
```javascript
loadBalancer.setLoadModes({
  custom: {
    concurrentCrawls: 1,
    delayBetweenCrawls: 15000,
    timeoutMultiplier: 2.5
  }
});
```

## عیب‌یابی

### مشکلات رایج

1. **سیستم در حالت اضطراری گیر کرده**
   - بررسی لاگ‌ها برای علت
   - اجرای پاکسازی اضطراری
   - بررسی منابع سیستم

2. **تغییرات حالت اعمال نمی‌شوند**
   - بررسی وضعیت cron jobs
   - بررسی لاگ‌های خطا
   - راه‌اندازی مجدد سرویس

3. **عملکرد کند**
   - بررسی آستانه‌ها
   - تنظیم مجدد آستانه‌ها
   - بررسی منابع سیستم

### دستورات مفید

```bash
# بررسی وضعیت
curl http://localhost:3004/api/load-balancer/status

# تنظیم حالت اضطراری
curl -X POST http://localhost:3004/api/load-balancer/mode \
  -H "Content-Type: application/json" \
  -d '{"mode": "emergency"}'

# پاکسازی اضطراری
curl -X POST http://localhost:3004/api/load-balancer/emergency-cleanup

# دریافت آمار سیستم
curl http://localhost:3004/api/load-balancer/system-stats
```

## نتیجه‌گیری

سیستم مدیریت بار به صورت خودکار از مشکلات عملکرد جلوگیری می‌کند و پایداری سیستم را تضمین می‌کند. با استفاده از این سیستم، مشکلات مشابه گذشته تکرار نخواهند شد. 