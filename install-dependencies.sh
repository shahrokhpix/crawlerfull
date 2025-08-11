#!/bin/bash

# رنگ‌ها برای خروجی
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}    نصب وابستگی‌های کرالر فارس نیوز    ${NC}"
echo -e "${BLUE}========================================${NC}"

# بررسی وجود Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}خطا: Node.js نصب نشده است${NC}"
    echo -e "${YELLOW}لطفاً ابتدا install-server.sh را اجرا کنید${NC}"
    exit 1
fi

echo -e "${GREEN}Node.js نسخه: $(node --version)${NC}"
echo -e "${GREEN}npm نسخه: $(npm --version)${NC}"

# تنظیم متغیرهای محیطی برای Puppeteer
echo -e "${YELLOW}تنظیم متغیرهای محیطی...${NC}"
export PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
export PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# ایجاد فایل .npmrc
echo -e "${YELLOW}تنظیم npm...${NC}"
cat > .npmrc << EOF
puppeteer_skip_chromium_download=true
PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
EOF

# پاک کردن کش npm
echo -e "${YELLOW}پاک کردن کش npm...${NC}"
npm cache clean --force

# حذف node_modules قدیمی
if [ -d "node_modules" ]; then
    echo -e "${YELLOW}حذف node_modules قدیمی...${NC}"
    rm -rf node_modules
fi

# حذف package-lock.json قدیمی
if [ -f "package-lock.json" ]; then
    echo -e "${YELLOW}حذف package-lock.json قدیمی...${NC}"
    rm -f package-lock.json
fi

# نصب وابستگی‌ها
echo -e "${YELLOW}نصب وابستگی‌ها...${NC}"
npm install --ignore-scripts

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ نصب وابستگی‌ها موفق بود${NC}"
else
    echo -e "${RED}❌ خطا در نصب وابستگی‌ها${NC}"
    exit 1
fi

# تست وابستگی‌ها
echo -e "${YELLOW}تست وابستگی‌ها...${NC}"
node -e "console.log('✅ Node.js کار می‌کند');"
node -e "require('express'); console.log('✅ Express کار می‌کند');"
node -e "require('pg'); console.log('✅ PostgreSQL کار می‌کند');"
node -e "require('cheerio'); console.log('✅ Cheerio کار می‌کند');"
node -e "require('axios'); console.log('✅ Axios کار می‌کند');"

# بررسی Puppeteer
echo -e "${YELLOW}بررسی Puppeteer...${NC}"
node -e "const puppeteer = require('puppeteer'); console.log('✅ Puppeteer کار می‌کند');"

echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}✅ تمام وابستگی‌ها با موفقیت نصب شدند${NC}"
echo -e "${BLUE}========================================${NC}"
echo -e "${YELLOW}مرحله بعد: اجرای install-server.sh${NC}"
echo -e "${BLUE}========================================${NC}"
