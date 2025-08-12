@echo off
echo ========================================
echo    FarsNews Crawler - PostgreSQL Edition
echo ========================================
echo.

echo [1/4] راه‌اندازی PostgreSQL...
docker-compose -f docker-compose.postgres.yml up -d
if %errorlevel% neq 0 (
    echo ❌ خطا در راه‌اندازی PostgreSQL
    pause
    exit /b 1
)
echo ✅ PostgreSQL راه‌اندازی شد
echo.

echo [2/4] انتظار برای آماده شدن PostgreSQL...
timeout /t 10 /nobreak > nul
echo ✅ PostgreSQL آماده است
echo.

echo [3/4] بررسی وضعیت کانتینرها...
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
echo.

echo [4/4] راه‌اندازی سرور Node.js...
echo.
echo 🚀 سرور در حال راه‌اندازی...
echo 📍 آدرس‌های دسترسی:
echo    - سرور اصلی: http://localhost:3004
echo    - پنل ادمین: http://localhost:3004/admin
echo    - PgAdmin: http://localhost:8080
echo    - کاربر ادمین: admin/admin123
echo.
echo ⏹️ برای توقف سرور، Ctrl+C را فشار دهید
echo.

node index.js

pause 