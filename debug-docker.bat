@echo off
chcp 65001 > nul

echo === Docker Debug Helper ===
echo.

REM Check if Docker is running
docker info >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Docker is not running!
    pause
    exit /b 1
)

echo 🔍 Available commands:
echo 1. Show all container status
echo 2. Show PostgreSQL logs
echo 3. Show application logs
echo 4. Show Redis logs
echo 5. Show all logs (live)
echo 6. Connect to PostgreSQL
echo 7. Reset everything and restart
echo 8. Show container resource usage
echo.

set /p choice="Select option (1-8): "

if "%choice%"=="1" goto status
if "%choice%"=="2" goto postgres_logs
if "%choice%"=="3" goto app_logs
if "%choice%"=="4" goto redis_logs
if "%choice%"=="5" goto all_logs
if "%choice%"=="6" goto connect_db
if "%choice%"=="7" goto reset
if "%choice%"=="8" goto stats
goto invalid

:status
echo 📊 Container Status:
docker-compose ps
echo.
echo 🔍 Detailed Status:
docker ps -a --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
goto end

:postgres_logs
echo 📜 PostgreSQL Logs (last 50 lines):
docker-compose logs --tail=50 postgres
echo.
echo 🔴 Follow PostgreSQL logs (Ctrl+C to stop):
docker-compose logs -f postgres
goto end

:app_logs
echo 📜 Application Logs (last 50 lines):
docker-compose logs --tail=50 crawler
echo.
echo 🔴 Follow Application logs (Ctrl+C to stop):
docker-compose logs -f crawler
goto end

:redis_logs
echo 📜 Redis Logs (last 50 lines):
docker-compose logs --tail=50 redis
goto end

:all_logs
echo 📜 All Service Logs (live - Ctrl+C to stop):
docker-compose logs -f
goto end

:connect_db
echo 🔌 Connecting to PostgreSQL...
docker exec -it crawler_postgres psql -U crawler_user -d crawler_db
goto end

:reset
echo 🔄 Resetting everything...
docker-compose down -v
docker system prune -f
echo 🚀 Starting fresh...
docker-compose up -d --build
echo ⏳ Waiting for services...
timeout /t 15 /nobreak > nul
docker-compose ps
goto end

:stats
echo 💻 Container Resource Usage:
docker stats --no-stream
goto end

:invalid
echo ❌ Invalid option
goto end

:end
echo.
echo 🌐 Service URLs:
echo   Admin Panel: http://localhost:3005/admin
echo   API Health:  http://localhost:3005/api/health
echo   PostgreSQL:  localhost:5433
echo   Redis:       localhost:6380
echo.
pause 