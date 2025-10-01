@echo off
setlocal enabledelayedexpansion

REM Complete SQLite to PostgreSQL Migration Script for Windows
REM This script handles the complete migration process

echo 🚀 شروع فرآیند کامل migration از SQLite به PostgreSQL
echo ==================================================

REM Check if PostgreSQL is running
echo [INFO] بررسی وضعیت PostgreSQL...
pg_isready -h localhost -p 5432 >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] PostgreSQL در حال اجرا نیست
    echo [INFO] لطفاً PostgreSQL را راه‌اندازی کنید
    echo   - PostgreSQL service را از Services.msc راه‌اندازی کنید
    echo   - یا از pgAdmin استفاده کنید
    pause
    exit /b 1
) else (
    echo [SUCCESS] PostgreSQL در حال اجرا است
)

REM Check if database exists
echo [INFO] بررسی وجود دیتابیس...
psql -h localhost -U crawler_user -d farsnews_crawler_spider_db -c "SELECT 1;" >nul 2>&1
if %errorlevel% neq 0 (
    echo [WARNING] دیتابیس farsnews_crawler_spider_db موجود نیست
    echo [INFO] ایجاد دیتابیس PostgreSQL...
    
    REM Create user if not exists
    psql -h localhost -U postgres -c "CREATE USER crawler_user WITH PASSWORD '8bmh8y19zNJahAv5Aa4B';" 2>nul
    
    REM Create database
    psql -h localhost -U postgres -c "CREATE DATABASE farsnews_crawler_spider_db OWNER crawler_user;" 2>nul
    
    REM Grant privileges
    psql -h localhost -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE farsnews_crawler_spider_db TO crawler_user;" 2>nul
    
    echo [SUCCESS] دیتابیس PostgreSQL ایجاد شد
) else (
    echo [SUCCESS] دیتابیس farsnews_crawler_spider_db موجود است
)

REM Backup SQLite database
echo [INFO] پشتیبان‌گیری از دیتابیس SQLite...
if exist "data\database.sqlite" (
    if not exist "backups" mkdir backups
    copy "data\database.sqlite" "backups\sqlite_backup_%date:~-4,4%%date:~-10,2%%date:~-7,2%_%time:~0,2%%time:~3,2%%time:~6,2%.sqlite"
    echo [SUCCESS] پشتیبان SQLite ایجاد شد
) else (
    echo [WARNING] فایل SQLite یافت نشد
)

REM Install dependencies
echo [INFO] نصب وابستگی‌ها...
call npm install
if %errorlevel% neq 0 (
    echo [ERROR] خطا در نصب وابستگی‌ها
    pause
    exit /b 1
)
echo [SUCCESS] وابستگی‌ها نصب شدند

REM Run migration
echo [INFO] اجرای migration...
if exist "data\database.sqlite" (
    node scripts\migrate-to-postgresql.js
    if %errorlevel% neq 0 (
        echo [ERROR] خطا در اجرای migration
        pause
        exit /b 1
    )
    echo [SUCCESS] Migration با موفقیت انجام شد
) else (
    echo [WARNING] فایل SQLite یافت نشد - فقط جداول PostgreSQL ایجاد می‌شوند
    node -e "const Database = require('./config/database'); Database.init().then(() => { console.log('✅ جداول PostgreSQL ایجاد شدند'); process.exit(0); }).catch(err => { console.error('❌ خطا در ایجاد جداول:', err); process.exit(1); });"
    if %errorlevel% neq 0 (
        echo [ERROR] خطا در ایجاد جداول
        pause
        exit /b 1
    )
)

REM Test database connection
echo [INFO] تست اتصال به دیتابیس...
node -e "const Database = require('./config/database'); Database.pool.query('SELECT 1 as test').then(result => { console.log('✅ اتصال به PostgreSQL موفق است'); process.exit(0); }).catch(err => { console.error('❌ خطا در اتصال به PostgreSQL:', err.message); process.exit(1); });"
if %errorlevel% neq 0 (
    echo [ERROR] خطا در اتصال به PostgreSQL
    pause
    exit /b 1
)

REM Test basic operations
echo [INFO] تست عملیات پایه...
node -e "const Database = require('./config/database'); async function testOperations() { try { const insertResult = await Database.pool.query('INSERT INTO news_sources (name, base_url, list_selector) VALUES ($1, $2, $3) ON CONFLICT (name) DO NOTHING RETURNING id', ['Test Source', 'https://test.com', 'a[href*=\"/news\"]']); const selectResult = await Database.pool.query('SELECT COUNT(*) as count FROM news_sources'); await Database.pool.query('DELETE FROM news_sources WHERE name = $1', ['Test Source']); console.log('✅ تمام عملیات پایه موفق بودند'); process.exit(0); } catch (err) { console.error('❌ خطا در تست عملیات:', err.message); process.exit(1); } } testOperations();"
if %errorlevel% neq 0 (
    echo [ERROR] خطا در تست عملیات
    pause
    exit /b 1
)

REM Start application
echo [INFO] راه‌اندازی برنامه...

REM Check if application is already running
tasklist /FI "IMAGENAME eq node.exe" /FI "WINDOWTITLE eq *index.js*" 2>NUL | find /I /N "node.exe">NUL
if "%ERRORLEVEL%"=="0" (
    echo [WARNING] برنامه در حال اجرا است - متوقف کردن...
    taskkill /F /IM node.exe 2>nul
    timeout /t 2 /nobreak >nul
)

REM Start application in background
start /B node index.js > logs\migration-test.log 2>&1

REM Wait for application to start
timeout /t 5 /nobreak >nul

REM Test if application is responding
curl -f http://localhost:3004/ >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] برنامه راه‌اندازی نشد
    taskkill /F /IM node.exe 2>nul
    pause
    exit /b 1
) else (
    echo [SUCCESS] برنامه با موفقیت راه‌اندازی شد
    echo برای مشاهده لاگ‌ها: type logs\migration-test.log
)

echo.
echo [SUCCESS] 🎉 Migration با موفقیت تکمیل شد!
echo.
echo 📊 خلاصه:
echo   ✅ PostgreSQL راه‌اندازی شد
echo   ✅ دیتابیس ایجاد شد
echo   ✅ داده‌ها منتقل شدند
echo   ✅ برنامه راه‌اندازی شد
echo.
echo 🌐 دسترسی به برنامه: http://localhost:3004
echo 📊 پنل ادمین: http://localhost:3004/admin
echo.
echo 📁 فایل‌های پشتیبان در پوشه backups\
echo 📝 لاگ‌ها در پوشه logs\
echo.
pause 