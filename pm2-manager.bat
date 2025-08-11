@echo off
echo ========================================
echo    FarsNews Crawler - PM2 Manager
echo ========================================
echo.

:menu
echo انتخاب کنید:
echo 1. راه‌اندازی سرور ساده
echo 2. راه‌اندازی سرور کامل
echo 3. توقف همه سرورها
echo 4. نمایش وضعیت
echo 5. نمایش لاگ‌ها
echo 6. راه‌اندازی مجدد
echo 7. خروج
echo.
set /p choice="انتخاب شما (1-7): "

if "%choice%"=="1" goto start_simple
if "%choice%"=="2" goto start_full
if "%choice%"=="3" goto stop_all
if "%choice%"=="4" goto status
if "%choice%"=="5" goto logs
if "%choice%"=="6" goto restart
if "%choice%"=="7" goto exit
goto menu

:start_simple
echo.
echo 🚀 راه‌اندازی سرور ساده...
pm2 stop all
pm2 start simple-server.js --name "farsnews-simple"
echo ✅ سرور ساده راه‌اندازی شد
echo.
pause
goto menu

:start_full
echo.
echo 🚀 راه‌اندازی سرور کامل...
pm2 stop all
pm2 start index.js --name "farsnews-crawler"
echo ✅ سرور کامل راه‌اندازی شد
echo.
pause
goto menu

:stop_all
echo.
echo 🛑 توقف همه سرورها...
pm2 stop all
echo ✅ همه سرورها متوقف شدند
echo.
pause
goto menu

:status
echo.
echo 📊 وضعیت سرورها:
pm2 status
echo.
pause
goto menu

:logs
echo.
echo 📋 لاگ‌های سرور:
pm2 logs --lines 20
echo.
pause
goto menu

:restart
echo.
echo 🔄 راه‌اندازی مجدد...
pm2 restart all
echo ✅ سرورها راه‌اندازی مجدد شدند
echo.
pause
goto menu

:exit
echo.
echo 👋 خروج از PM2 Manager
exit 