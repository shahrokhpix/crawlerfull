#!/bin/bash

# رنگ‌ها برای خروجی
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}    کرالر فارس نیوز - نصب خودکار سرور    ${NC}"
echo -e "${BLUE}========================================${NC}"
echo -e "${YELLOW}شروع نصب کرالر فارس نیوز...${NC}"

# بررسی دسترسی sudo
if ! sudo -n true 2>/dev/null; then
    echo -e "${RED}خطا: دسترسی sudo مورد نیاز است${NC}"
    exit 1
fi

# ایجاد دایرکتوری‌های مورد نیاز
echo -e "${YELLOW}ایجاد دایرکتوری‌های مورد نیاز...${NC}"
mkdir -p logs/pm2
mkdir -p data
mkdir -p config
mkdir -p database
mkdir -p temp
mkdir -p node_modules

# به‌روزرسانی سیستم
echo -e "${YELLOW}به‌روزرسانی سیستم...${NC}"
sudo apt-get update

# نصب ابزارهای مورد نیاز
echo -e "${YELLOW}نصب ابزارهای مورد نیاز...${NC}"
sudo apt-get install -y curl wget gnupg2 software-properties-common build-essential

# نصب Node.js و npm اگر نصب نباشند
if ! command -v node &> /dev/null; then
    echo -e "${YELLOW}نصب Node.js...${NC}"
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
else
    echo -e "${GREEN}Node.js از قبل نصب است: $(node --version)${NC}"
fi

# نصب PM2 به صورت گلوبال
echo -e "${YELLOW}نصب PM2...${NC}"
sudo npm install -g pm2

# نصب Chromium و وابستگی‌های مورد نیاز
echo -e "${YELLOW}نصب Chromium و وابستگی‌های مورد نیاز...${NC}"
sudo apt-get install -y chromium-browser
sudo apt-get install -y libnss3 libatk-bridge2.0-0 libdrm2 libxcomposite1 libxdamage1 libxrandr2 libgbm1 libxss1 libasound2

# تنظیم متغیرهای محیطی برای Puppeteer
echo -e "${YELLOW}تنظیم متغیرهای محیطی برای Puppeteer...${NC}"
export PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
export PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
echo 'export PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true' >> ~/.bashrc
echo 'export PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser' >> ~/.bashrc

# ایجاد فایل .npmrc برای تنظیمات npm
echo -e "${YELLOW}تنظیم npm برای Puppeteer...${NC}"
cat > .npmrc << EOF
puppeteer_skip_chromium_download=true
PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
EOF

# پاک کردن کش npm
echo -e "${YELLOW}پاک کردن کش npm...${NC}"
npm cache clean --force

# حذف node_modules قدیمی در صورت وجود
if [ -d "node_modules" ]; then
    echo -e "${YELLOW}حذف node_modules قدیمی...${NC}"
    rm -rf node_modules
fi

# نصب وابستگی‌های پروژه
echo -e "${YELLOW}نصب وابستگی‌های پروژه...${NC}"
npm install --ignore-scripts

# تست PostgreSQL
echo -e "${YELLOW}تست PostgreSQL...${NC}"
node -e "require('pg'); console.log('✅ PostgreSQL کار می‌کند');"

# کپی فایل env نمونه اگر وجود نداشته باشد
if [ ! -f .env ]; then
    echo -e "${YELLOW}ایجاد فایل .env...${NC}"
    cp .env.example .env
    echo -e "${GREEN}فایل .env ایجاد شد${NC}"
fi

# تنظیم متغیرهای محیطی برای بهینه‌سازی
echo -e "${YELLOW}تنظیم متغیرهای محیطی...${NC}"

# اضافه کردن تنظیمات بهینه‌سازی به .env
if ! grep -q "LOG_LEVEL" .env; then
    echo "LOG_LEVEL=warn" >> .env
fi
if ! grep -q "NODE_ENV" .env; then
    echo "NODE_ENV=production" >> .env
fi
if ! grep -q "MAX_OLD_SPACE_SIZE" .env; then
    echo "MAX_OLD_SPACE_SIZE=2048" >> .env
fi
if ! grep -q "PUPPETEER_EXECUTABLE_PATH" .env; then
    echo "PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser" >> .env
fi
if ! grep -q "PUPPETEER_SKIP_CHROMIUM_DOWNLOAD" .env; then
    echo "PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true" >> .env
fi

# تنظیم مجوزهای فایل
echo -e "${YELLOW}تنظیم مجوزهای فایل...${NC}"
chmod +x index.js
chmod +x install-server.sh
chmod +x install-dependencies.sh 2>/dev/null || true

# بررسی وجود ecosystem.config.js
if [ ! -f ecosystem.config.js ]; then
    echo -e "${YELLOW}ایجاد فایل ecosystem.config.js...${NC}"
    cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'farsnews-crawler',
    script: 'index.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '2G',
    env: {
      NODE_ENV: 'development',
      PORT: 3004
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 3004,
      LOG_LEVEL: 'warn',
      MAX_OLD_SPACE_SIZE: 2048
    },
    error_file: './logs/pm2/err.log',
    out_file: './logs/pm2/out.log',
    log_file: './logs/pm2/combined.log',
    time: true
  }]
};
EOF
fi

# توقف PM2 قدیمی در صورت وجود
echo -e "${YELLOW}بررسی و توقف فرآیندهای قدیمی...${NC}"
pm2 stop farsnews-crawler 2>/dev/null || true
pm2 delete farsnews-crawler 2>/dev/null || true

# تست اجرای برنامه
echo -e "${YELLOW}تست اجرای برنامه...${NC}"
timeout 10s node index.js &
TEST_PID=$!
sleep 5
if kill -0 $TEST_PID 2>/dev/null; then
    echo -e "${GREEN}تست اجرای برنامه موفق بود${NC}"
    kill $TEST_PID 2>/dev/null || true
else
    echo -e "${RED}خطا در تست اجرای برنامه${NC}"
    echo -e "${YELLOW}بررسی لاگ‌ها برای جزئیات بیشتر${NC}"
fi

# راه‌اندازی با PM2
echo -e "${YELLOW}راه‌اندازی برنامه با PM2...${NC}"
pm2 start ecosystem.config.js --env production

# انتظار برای اطمینان از شروع برنامه
sleep 3

# بررسی وضعیت PM2
echo -e "${YELLOW}بررسی وضعیت PM2...${NC}"
pm2 status

# تنظیم PM2 برای اجرای خودکار در هنگام ریبوت
echo -e "${YELLOW}تنظیم PM2 برای اجرای خودکار...${NC}"
pm2 startup
pm2 save

# ایجاد اسکریپت مدیریت سیستم
echo -e "${YELLOW}ایجاد اسکریپت‌های مدیریت...${NC}"
cat > manage.sh << 'EOF'
#!/bin/bash
case "$1" in
    start)
        pm2 start ecosystem.config.js --env production
        ;;
    stop)
        pm2 stop farsnews-crawler
        ;;
    restart)
        pm2 restart farsnews-crawler
        ;;
    status)
        pm2 status
        ;;
    logs)
        pm2 logs farsnews-crawler
        ;;
    monitor)
        pm2 monit
        ;;
    *)
        echo "استفاده: $0 {start|stop|restart|status|logs|monitor}"
        exit 1
        ;;
esac
EOF
chmod +x manage.sh

echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}✅ نصب با موفقیت انجام شد!${NC}"
echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}🚀 برنامه در پورت 3004 در حال اجراست${NC}"
echo -e "${GREEN}🔧 پنل ادمین: http://localhost:3004/admin${NC}"
echo -e "${GREEN}📰 RSS Feed: http://localhost:3004/rss${NC}"
echo -e "${GREEN}📊 API: http://localhost:3004/api${NC}"
echo -e "${BLUE}========================================${NC}"
echo -e "${YELLOW}📋 دستورات مدیریت:${NC}"
echo -e "${YELLOW}   ./manage.sh start    - شروع سرویس${NC}"
echo -e "${YELLOW}   ./manage.sh stop     - توقف سرویس${NC}"
echo -e "${YELLOW}   ./manage.sh restart  - راه‌اندازی مجدد${NC}"
echo -e "${YELLOW}   ./manage.sh status   - وضعیت سرویس${NC}"
echo -e "${YELLOW}   ./manage.sh logs     - مشاهده لاگ‌ها${NC}"
echo -e "${YELLOW}   ./manage.sh monitor  - مانیتورینگ${NC}"
echo -e "${BLUE}========================================${NC}"
echo -e "${YELLOW}📁 مسیرهای مهم:${NC}"
echo -e "${YELLOW}   لاگ‌ها: ./logs/${NC}"
echo -e "${YELLOW}   دیتابیس: PostgreSQL${NC}"
echo -e "${YELLOW}   تنظیمات: ./.env${NC}"
echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}👤 اطلاعات ورود پیش‌فرض:${NC}"
echo -e "${GREEN}   نام کاربری: admin${NC}"
echo -e "${GREEN}   رمز عبور: admin123${NC}"
echo -e "${BLUE}========================================${NC}"