@echo off
echo ========================================
echo    FarsNews Crawler - Docker System
echo ========================================
echo.

echo [1/5] بررسی Docker...
docker --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Docker نصب نشده است
    echo لطفاً Docker Desktop را نصب کنید
    pause
    exit /b 1
)
echo ✅ Docker آماده است
echo.

echo [2/5] توقف کانتینرهای قبلی...
docker-compose down >nul 2>&1
echo ✅ کانتینرهای قبلی متوقف شدند
echo.

echo [3/5] ساخت و راه‌اندازی کانتینرها...
docker-compose up --build -d
if %errorlevel% neq 0 (
    echo ❌ خطا در راه‌اندازی Docker
    pause
    exit /b 1
)
echo ✅ کانتینرها راه‌اندازی شدند
echo.

echo [4/5] انتظار برای آماده شدن سرویس‌ها...
echo ⏳ در حال انتظار...
timeout /t 45 /nobreak > nul
echo ✅ سرویس‌ها آماده شدند
echo.

echo [5/5] بررسی وضعیت نهایی...
docker-compose ps
echo.

echo 🎉 سیستم با موفقیت راه‌اندازی شد!
echo.
echo 📍 آدرس‌های دسترسی:
echo    - سرور اصلی: http://localhost:3004
echo    - پنل ادمین: http://localhost:3004/admin
echo    - PgAdmin: http://localhost:8080
echo    - کاربر ادمین: admin/admin123
echo.
echo 📊 دستورات مفید:
echo    - نمایش لاگ‌ها: docker-compose logs -f
echo    - توقف سیستم: docker-compose down
echo    - راه‌اندازی مجدد: docker-compose restart
echo    - تست سیستم: cd test && node simple-test.js
echo.

echo 🔍 تست اتصال...
timeout /t 3 /nobreak > nul
curl -s http://localhost:3004/api/health >nul 2>&1
if %errorlevel% equ 0 (
    echo ✅ سرور پاسخ می‌دهد
) else (
    echo ⚠️ سرور در حال راه‌اندازی است
)
echo.

pause 