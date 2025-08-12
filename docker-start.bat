@echo off
echo ========================================
echo    FarsNews Crawler - Docker Edition
echo ========================================
echo.

echo [1/4] توقف کانتینرهای قبلی...
docker-compose down
echo ✅ کانتینرهای قبلی متوقف شدند
echo.

echo [2/4] ساخت و راه‌اندازی کانتینرها...
docker-compose up --build -d
if %errorlevel% neq 0 (
    echo ❌ خطا در راه‌اندازی Docker
    pause
    exit /b 1
)
echo ✅ کانتینرها راه‌اندازی شدند
echo.

echo [3/4] انتظار برای آماده شدن سرویس‌ها...
timeout /t 30 /nobreak > nul
echo ✅ سرویس‌ها آماده شدند
echo.

echo [4/4] بررسی وضعیت کانتینرها...
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
echo.

pause 