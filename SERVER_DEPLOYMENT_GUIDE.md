# راهنمای استقرار سرور - رفع مشکل Puppeteer

## مشکل فعلی
خطای `Cannot find module 'puppeteer'` در سرور که نشان‌دهنده عدم نصب صحیح ماژول puppeteer است.

## مراحل رفع مشکل در سرور

### مرحله 1: اتصال به سرور
```bash
ssh username@your-server-ip
cd /var/www/farsnews
```

### مرحله 2: توقف کرالر
```bash
pm2 stop farsnews-crawler
pm2 delete farsnews-crawler
```

### مرحله 3: پاکسازی کامل node_modules
```bash
rm -rf node_modules
rm -f package-lock.json
```

### مرحله 4: بررسی نسخه Node.js
```bash
node --version
npm --version
# باید Node.js 16+ باشد
```

### مرحله 5: پاکسازی npm cache
```bash
npm cache clean --force
```

### مرحله 6: نصب مجدد وابستگی‌ها
```bash
npm install
```

### مرحله 7: نصب مستقیم puppeteer (اگر مرحله 6 کافی نبود)
```bash
npm install puppeteer@latest --save
```

### مرحله 8: نصب Chrome dependencies
```bash
# برای Ubuntu/Debian
sudo apt-get update
sudo apt-get install -y \
    ca-certificates \
    fonts-liberation \
    libappindicator3-1 \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libc6 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libexpat1 \
    libfontconfig1 \
    libgbm1 \
    libgcc1 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libstdc++6 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxi6 \
    libxrandr2 \
    libxrender1 \
    libxss1 \
    libxtst6 \
    lsb-release \
    wget \
    xdg-utils
```

### مرحله 9: تست puppeteer
```bash
node -e "const puppeteer = require('puppeteer'); console.log('Puppeteer loaded successfully');"
```

### مرحله 10: راه‌اندازی مجدد کرالر
```bash
pm2 start ecosystem.config.js
```

### مرحله 11: بررسی وضعیت
```bash
pm2 status
pm2 logs farsnews-crawler --lines 20
```

## رفع خطای کتابخانه‌های مفقود Chrome

### اگر خطای `libatk-1.0.so.0: cannot open shared object file` دریافت کردید:

```bash
# نصب کتابخانه‌های مفقود ATK
sudo apt-get update
sudo apt-get install -y \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libgtk-3-0 \
    libgdk-pixbuf2.0-0 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    libasound2 \
    libpangocairo-1.0-0 \
    libatk1.0-0 \
    libcairo-gobject2 \
    libgtk-3-0 \
    libgdk-pixbuf2.0-0
```

### اگر همچنان مشکل دارید:

### گزینه A: نصب کامل Chrome browser
```bash
wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | sudo apt-key add -
echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" | sudo tee /etc/apt/sources.list.d/google-chrome.list
sudo apt-get update
sudo apt-get install -y google-chrome-stable

# نصب کتابخانه‌های اضافی
sudo apt-get install -y \
    libxss1 \
    libgconf-2-4 \
    libxtst6 \
    libxrandr2 \
    libasound2 \
    libpangocairo-1.0-0 \
    libatk1.0-0 \
    libcairo-gobject2 \
    libgtk-3-0 \
    libgdk-pixbuf2.0-0
```

### گزینه B: استفاده از puppeteer-core + Chrome جداگانه
```bash
npm uninstall puppeteer
npm install puppeteer-core@latest
# سپس Chrome را به صورت جداگانه نصب کنید
```

### گزینه C: بررسی مجوزها
```bash
sudo chown -R $USER:$USER /var/www/farsnews
sudo chmod -R 755 /var/www/farsnews
```

## تنظیمات اضافی برای سرور production

### 1. تنظیم متغیرهای محیطی
```bash
export PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=false
export PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable
```

### 2. تنظیم حافظه برای npm
```bash
npm config set maxsockets 1
npm config set registry https://registry.npmjs.org/
```

### 3. افزایش timeout برای نصب
```bash
npm config set timeout 300000
```

## بررسی نهایی

### چک‌لیست:
- [ ] Node.js نسخه 16+ نصب است
- [ ] npm cache پاک شده
- [ ] node_modules و package-lock.json حذف شده
- [ ] npm install با موفقیت انجام شده
- [ ] puppeteer به درستی لود می‌شود
- [ ] Chrome dependencies نصب شده
- [ ] مجوزهای فایل‌ها صحیح است
- [ ] PM2 کرالر را راه‌اندازی کرده
- [ ] لاگ‌ها خطای جدیدی نشان نمی‌دهند

## دستورات سریع (خلاصه)
```bash
# توقف کرالر
pm2 stop farsnews-crawler
pm2 delete farsnews-crawler

# پاکسازی
rm -rf node_modules package-lock.json
npm cache clean --force

# نصب کتابخانه‌های Chrome (اگر خطای libatk دریافت کردید)
sudo apt-get update
sudo apt-get install -y libatk1.0-0 libatk-bridge2.0-0 libgtk-3-0 libgdk-pixbuf2.0-0 libxcomposite1 libxdamage1 libxrandr2 libasound2 libpangocairo-1.0-0 libcairo-gobject2

# نصب مجدد
npm install

# تست
node -e "const puppeteer = require('puppeteer'); console.log('OK');"

# راه‌اندازی
pm2 start ecosystem.config.js
pm2 logs farsnews-crawler
```

## نکات مهم

1. **حافظه**: اطمینان حاصل کنید سرور حافظه کافی دارد (حداقل 2GB)
2. **فضای دیسک**: حداقل 1GB فضای خالی برای Chrome و dependencies
3. **مجوزها**: کاربر باید مجوز نوشتن در پوشه پروژه داشته باشد
4. **فایروال**: پورت‌های لازم باز باشند
5. **DNS**: اتصال اینترنت برای دانلود packages

## مشکلات رایج و راه‌حل‌ها

### 1. خطای Cannot find module 'puppeteer'
**علت:** عدم نصب کامل وابستگی‌ها پس از تغییر از puppeteer-core به puppeteer

**راه‌حل:**
```bash
# حذف node_modules و package-lock.json
rm -rf node_modules package-lock.json

# پاکسازی npm cache
npm cache clean --force

# نصب مجدد وابستگی‌ها
npm install

# نصب مستقیم puppeteer
npm install puppeteer
```

### 2. خطای page.waitForTimeout is not a function
**علت:** در نسخه‌های جدید puppeteer، متد `waitForTimeout` به `waitForDelay` تغییر کرده است

**راه‌حل:**
- این مشکل در کد رفع شده است
- اگر هنوز خطا دارید، مطمئن شوید که آخرین نسخه کد را دارید
- در صورت نیاز، کرالر را مجدداً راه‌اندازی کنید:
```bash
pm2 restart farsnews-crawler
```

## پشتیبانی

اگر مشکل همچنان ادامه دارد:
1. لاگ کامل خطا را بررسی کنید
2. نسخه‌های Node.js و npm را چک کنید
3. فضای دیسک و حافظه را بررسی کنید
4. مجوزهای فایل‌ها را تأیید کنید