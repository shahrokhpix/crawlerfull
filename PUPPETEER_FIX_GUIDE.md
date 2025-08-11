# راهنمای رفع مشکل Puppeteer

## مشکل
خطای `Cannot find module './chromedriver.js'` هنگام اجرای کرالر که نشان‌دهنده مشکل در نسخه یا پیکربندی puppeteer است.

## تغییرات انجام شده

### 1. به‌روزرسانی package.json
- تغییر از `puppeteer-core` به `puppeteer` نسخه 23.9.0
- puppeteer کامل شامل Chrome browser داخلی است

### 2. به‌روزرسانی فایل‌های کد
- `index.js`: تغییر import از puppeteer-core به puppeteer
- `services/webDriverManager.js`: تغییر import از puppeteer-core به puppeteer
- `install-dependencies.sh`: تغییر دستور نصب

## دستورات رفع مشکل در سرور

### مرحله 1: پاکسازی node_modules
```bash
cd /var/www/farsnews
rm -rf node_modules
rm package-lock.json
```

### مرحله 2: نصب مجدد وابستگی‌ها
```bash
npm install
```

### مرحله 3: نصب Chrome dependencies (اگر لازم باشد)
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

### مرحله 4: راه‌اندازی مجدد کرالر
```bash
pm2 restart farsnews-crawler
```

### مرحله 5: بررسی لاگ‌ها
```bash
pm2 logs farsnews-crawler --lines 50
```

## تفاوت puppeteer و puppeteer-core

### puppeteer-core
- فقط API puppeteer
- نیاز به نصب جداگانه Chrome/Chromium
- کنترل بیشتر بر نسخه browser
- حجم کمتر

### puppeteer (توصیه شده)
- شامل Chrome browser داخلی
- نصب آسان‌تر
- سازگاری بهتر
- به‌روزرسانی خودکار browser

## عیب‌یابی اضافی

### اگر همچنان مشکل دارید:

1. **بررسی نسخه Node.js:**
```bash
node --version
# باید 16 یا بالاتر باشد
```

2. **پاکسازی کامل npm cache:**
```bash
npm cache clean --force
```

3. **نصب مستقیم puppeteer:**
```bash
npm install puppeteer@latest
```

4. **تست puppeteer:**
```bash
node -e "const puppeteer = require('puppeteer'); console.log('Puppeteer loaded successfully');"
```

### اگر مشکل Chrome dependencies است:

```bash
# نصب Chrome browser
wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | sudo apt-key add -
echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" | sudo tee /etc/apt/sources.list.d/google-chrome.list
sudo apt-get update
sudo apt-get install -y google-chrome-stable
```

## تنظیمات اضافی برای سرور

### اگر سرور headless است:
```javascript
// در فایل‌های puppeteer، اطمینان حاصل کنید که:
const browser = await puppeteer.launch({
  headless: true,
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu'
  ]
});
```

## بررسی نهایی

پس از انجام تغییرات:

1. ✅ package.json به‌روزرسانی شده
2. ✅ فایل‌های کد تغییر کرده‌اند
3. ✅ node_modules پاک و مجدداً نصب شده
4. ✅ Chrome dependencies نصب شده
5. ✅ کرالر راه‌اندازی مجدد شده
6. ✅ لاگ‌ها بررسی شده

اگر همه مراحل انجام شد، کرالر باید بدون مشکل کار کند.