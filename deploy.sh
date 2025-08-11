#!/bin/bash

set -e

echo "=== توقف سرویس با PM2 (در صورت نیاز) ==="
pm2 stop farsnews-crawler || true
pm2 delete farsnews-crawler || true

echo "=== پاک کردن node_modules و cache ==="
rm -rf node_modules package-lock.json
npm cache clean --force

echo "=== بررسی و نصب Chrome Dependencies (فقط برای Ubuntu/Debian) ==="
sudo apt-get update
sudo apt-get install -y \
    ca-certificates fonts-liberation libappindicator3-1 libasound2 libatk-bridge2.0-0 \
    libatk1.0-0 libc6 libcairo2 libcups2 libdbus-1-3 libexpat1 libfontconfig1 \
    libgbm1 libgcc1 libglib2.0-0 libgtk-3-0 libnspr4 libnss3 libpango-1.0-0 \
    libpangocairo-1.0-0 libstdc++6 libx11-6 libx11-xcb1 libxcb1 libxcomposite1 \
    libxcursor1 libxdamage1 libxext6 libxfixes3 libxi6 libxrandr2 libxrender1 \
    libxss1 libxtst6 lsb-release wget xdg-utils

echo "=== اگر Google Chrome نصب نیست، نصب کن (خودکار!) ==="
if ! command -v google-chrome >/dev/null 2>&1; then
    wget https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb
    sudo dpkg -i google-chrome-stable_current_amd64.deb || sudo apt-get -f install -y
    rm -f google-chrome-stable_current_amd64.deb
fi

echo "=== نصب npm dependencies بدون دانلود Chrome از puppeteer ==="
export PUPPETEER_SKIP_DOWNLOAD=true
npm install

echo "=== تست Puppeteer ==="
node -e "const puppeteer = require('puppeteer'); console.log('Puppeteer loaded successfully!')"

echo "=== راه‌اندازی مجدد سرویس با PM2 ==="
pm2 start ecosystem.config.js

echo "=== نمایش وضعیت لاگ ==="
pm2 logs farsnews-crawler --lines 20

echo "✅ استقرار به پایان رسید."
