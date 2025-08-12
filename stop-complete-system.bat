@echo off
echo ========================================
echo    توقف FarsNews Crawler System
echo ========================================
echo.

echo [1/3] توقف سرور Node.js...
taskkill /f /im node.exe 2>nul
if %errorlevel% equ 0 (
    echo ✅ سرور Node.js متوقف شد
) else (
    echo ℹ️ سرور Node.js در حال اجرا نبود
)
echo.

echo [2/3] توقف کانتینرهای Docker...
docker-compose -f docker-compose.postgres.yml down
if %errorlevel% equ 0 (
    echo ✅ کانتینرهای Docker متوقف شدند
) else (
    echo ℹ️ کانتینرهای Docker در حال اجرا نبودند
)
echo.

echo [3/3] بررسی وضعیت نهایی...
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
echo.

echo ✅ سیستم کاملاً متوقف شد
echo.
pause 