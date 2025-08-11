@echo off
echo 🚀 شروع تست استرس سیستم
echo ======================================

REM بررسی وجود Node.js
node --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Node.js یافت نشد. لطفاً Node.js را نصب کنید.
    pause
    exit /b 1
)

REM بررسی وجود فایل تست
if not exist "stress-test.js" (
    echo ❌ فایل stress-test.js یافت نشد.
    pause
    exit /b 1
)

echo ✅ Node.js و فایل تست آماده هستند
echo.

echo انتخاب نوع تست:
echo 1. تست کامل استرس (پیشنهادی)
echo 2. تست کرال همزمان
echo 3. تست استرس دیتابیس
echo 4. تست استرس حافظه
echo 5. تست API های مدیریتی
echo 6. تست Load Balancer
echo 7. تست WebSocket
echo 8. تست Circuit Breaker
echo 9. تست ساده
echo.

set /p choice="لطفاً نوع تست را انتخاب کنید (1-9): "

if "%choice%"=="1" (
    echo 🚀 اجرای تست کامل استرس...
    node stress-test.js --full
) else if "%choice%"=="2" (
    echo 🕷️ اجرای تست کرال همزمان...
    node stress-test.js --crawl
) else if "%choice%"=="3" (
    echo 🗄️ اجرای تست استرس دیتابیس...
    node stress-test.js --database
) else if "%choice%"=="4" (
    echo 🧠 اجرای تست استرس حافظه...
    node stress-test.js --memory
) else if "%choice%"=="5" (
    echo 🔧 اجرای تست API های مدیریتی...
    node stress-test.js --admin
) else if "%choice%"=="6" (
    echo ⚖️ اجرای تست Load Balancer...
    node stress-test.js --load-balancer
) else if "%choice%"=="7" (
    echo 🔌 اجرای تست WebSocket...
    node stress-test.js --websocket
) else if "%choice%"=="8" (
    echo 🔌 اجرای تست Circuit Breaker...
    node stress-test.js --circuit-breaker
) else if "%choice%"=="9" (
    echo 📊 اجرای تست ساده...
    node stress-test.js
) else (
    echo ❌ انتخاب نامعتبر
    pause
    exit /b 1
)

echo.
echo ✅ تست تکمیل شد
echo 📁 نتایج در پوشه results ذخیره شده‌اند
echo.
pause 