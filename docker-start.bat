@echo off
echo 🐳 راه‌اندازی کرالر خبری با Docker
echo ========================================

REM بررسی وجود Docker
docker --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Docker یافت نشد. لطفاً Docker Desktop را نصب کنید.
    pause
    exit /b 1
)

REM بررسی وجود Docker Compose
docker-compose --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Docker Compose یافت نشد. لطفاً Docker Compose را نصب کنید.
    pause
    exit /b 1
)

echo ✅ Docker و Docker Compose آماده هستند
echo.

REM بررسی وجود فایل .env
if not exist ".env" (
    echo ⚠️ فایل .env یافت نشد. فایل .env.example کپی می‌شود...
    copy .env.example .env
    echo ✅ فایل .env ایجاد شد. لطفاً تنظیمات را بررسی کنید.
    echo.
)

echo انتخاب نوع اجرا:
echo 1. اجرای کامل (پیشنهادی)
echo 2. اجرا بدون Nginx
echo 3. اجرا با PM2
echo 4. اجرا در حالت توسعه
echo 5. اجرا بدون Puppeteer (برای سرورهای مشکل‌دار)
echo 6. اجرا با Dockerfile جایگزین
echo 7. پاک کردن و اجرای مجدد
echo.

set /p choice="لطفاً نوع اجرا را انتخاب کنید (1-7): "

if "%choice%"=="1" (
    echo 🚀 اجرای کامل پروژه...
    docker-compose up -d
) else if "%choice%"=="2" (
    echo 🚀 اجرا بدون Nginx...
    docker-compose up -d postgres redis crawler
) else if "%choice%"=="3" (
    echo 🚀 اجرا با PM2...
    docker-compose --profile pm2 up -d
) else if "%choice%"=="4" (
    echo 🚀 اجرا در حالت توسعه...
    docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d
) else if "%choice%"=="5" (
    echo 🚀 اجرا بدون Puppeteer...
    docker-compose -f docker-compose.yml build --build-arg DOCKERFILE=Dockerfile.no-puppeteer
    docker-compose up -d postgres redis crawler
) else if "%choice%"=="6" (
    echo 🚀 اجرا با Dockerfile جایگزین...
    docker-compose -f docker-compose.yml build --build-arg DOCKERFILE=Dockerfile.alpine
    docker-compose up -d
) else if "%choice%"=="7" (
    echo 🧹 پاک کردن و اجرای مجدد...
    docker-compose down -v
    docker-compose build --no-cache
    docker-compose up -d
) else (
    echo ❌ انتخاب نامعتبر
    pause
    exit /b 1
)

echo.
echo ⏳ منتظر راه‌اندازی سرویس‌ها...
timeout /t 10 /nobreak >nul

echo.
echo 📊 وضعیت کانتینرها:
docker-compose ps

echo.
echo 🌐 دسترسی به سرویس‌ها:
echo    پنل ادمین: http://localhost:3004/admin
echo    API: http://localhost:3004/api
echo    RSS Feed: http://localhost:3004/rss
echo.

echo دستورات مفید:
echo   مشاهده لاگ‌ها: docker-compose logs -f
echo   توقف: docker-compose down
echo   راه‌اندازی مجدد: docker-compose restart
echo.

pause 