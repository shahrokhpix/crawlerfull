@echo off
echo 🐳 Starting News Crawler with Docker
echo ========================================

REM Check if Docker is installed
docker --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Docker not found. Please install Docker Desktop.
    pause
    exit /b 1
)

REM Check if Docker Compose is installed
docker-compose --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Docker Compose not found. Please install Docker Compose.
    pause
    exit /b 1
)

echo ✅ Docker and Docker Compose are ready
echo.

REM Check if .env file exists
if not exist ".env" (
    echo ⚠️ .env file not found. Copying from .env.example...
    copy .env.example .env
    echo ✅ .env file created. Please check the settings.
    echo.
)

echo Select execution type:
echo 1. Full execution (Recommended)
echo 2. Execute without Nginx
echo 3. Execute with PM2
echo 4. Execute in development mode
echo 5. Execute without Puppeteer (for problematic servers)
echo 6. Execute with alternative Dockerfile
echo 7. Execute with Iranian mirrors (Recommended for Iran)
echo 8. Clean and restart
echo.

set /p choice="Please select execution type (1-8): "

if "%choice%"=="1" (
    echo 🚀 Starting full project...
    docker-compose up -d
) else if "%choice%"=="2" (
    echo 🚀 Execute without Nginx...
    docker-compose up -d postgres redis crawler
) else if "%choice%"=="3" (
    echo 🚀 Execute with PM2...
    docker-compose --profile pm2 up -d
) else if "%choice%"=="4" (
    echo 🚀 Execute in development mode...
    docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d
) else if "%choice%"=="5" (
    echo 🚀 Execute without Puppeteer...
    docker-compose -f docker-compose.yml build --build-arg DOCKERFILE=Dockerfile.no-puppeteer
    docker-compose up -d postgres redis crawler
) else if "%choice%"=="6" (
    echo 🚀 Execute with alternative Dockerfile...
    docker-compose -f docker-compose.yml build --build-arg DOCKERFILE=Dockerfile.alpine
    docker-compose up -d
) else if "%choice%"=="7" (
    echo 🚀 Execute with Iranian mirrors...
    docker-compose -f docker-compose.yml build --build-arg DOCKERFILE=Dockerfile.iran
    docker-compose up -d
) else if "%choice%"=="8" (
    echo 🧹 Clean and restart...
    docker-compose down -v
    docker-compose build --no-cache
    docker-compose up -d
) else (
    echo ❌ Invalid selection
    pause
    exit /b 1
)

echo.
echo ⏳ Waiting for services to start...
timeout /t 10 /nobreak >nul

echo.
echo 📊 Container status:
docker-compose ps

echo.
echo 🌐 Service access:
echo    Admin Panel: http://localhost:3004/admin
echo    API: http://localhost:3004/api
echo    RSS Feed: http://localhost:3004/rss
echo.

echo Useful commands:
echo   View logs: docker-compose logs -f
echo   Stop: docker-compose down
echo   Restart: docker-compose restart
echo.

pause 