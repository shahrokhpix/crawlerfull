@echo off
setlocal enabledelayedexpansion

set MODE=full

:parse
if "%~1"=="" goto endparse
if /I "%~1"=="--full" set MODE=full& shift & goto parse
if /I "%~1"=="--no-nginx" set MODE=no-nginx& shift & goto parse
if /I "%~1"=="--pm2" set MODE=pm2& shift & goto parse
if /I "%~1"=="--dev" set MODE=dev& shift & goto parse
if /I "%~1"=="--no-puppeteer" set MODE=no-puppeteer& shift & goto parse
if /I "%~1"=="--alpine" set MODE=alpine& shift & goto parse
if /I "%~1"=="--iran" set MODE=iran& shift & goto parse
if /I "%~1"=="--clean" set MODE=clean& shift & goto parse
shift
goto parse
:endparse

where docker >nul 2>nul || (echo Docker not found& exit /b 1)
where docker-compose >nul 2>nul || (echo Docker Compose not found& exit /b 1)

if not exist .env copy .env.example .env >nul

echo Building with Node 20 Alpine...
set DOCKERFILE_OPT=Dockerfile.iran

if /I "%MODE%"=="full" (
  docker-compose -f docker-compose.yml build --build-arg DOCKERFILE=%DOCKERFILE_OPT%
  docker-compose up -d
) else if /I "%MODE%"=="no-nginx" (
  docker-compose -f docker-compose.yml build --build-arg DOCKERFILE=%DOCKERFILE_OPT%
  docker-compose up -d postgres redis crawler
) else if /I "%MODE%"=="pm2" (
  docker-compose -f docker-compose.yml build --build-arg DOCKERFILE=%DOCKERFILE_OPT%
  docker-compose --profile pm2 up -d
) else if /I "%MODE%"=="dev" (
  docker-compose -f docker-compose.yml -f docker-compose.dev.yml build --build-arg DOCKERFILE=%DOCKERFILE_OPT%
  docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d
) else if /I "%MODE%"=="no-puppeteer" (
  docker-compose -f docker-compose.yml build --build-arg DOCKERFILE=Dockerfile.no-puppeteer
  docker-compose up -d postgres redis crawler
) else if /I "%MODE%"=="alpine" (
  docker-compose -f docker-compose.yml build --build-arg DOCKERFILE=Dockerfile.alpine
  docker-compose up -d
) else if /I "%MODE%"=="iran" (
  docker-compose -f docker-compose.yml build --build-arg DOCKERFILE=Dockerfile.iran
  docker-compose up -d
) else if /I "%MODE%"=="clean" (
  docker-compose down -v
  docker system prune -a -f --volumes
  docker-compose -f docker-compose.yml build --no-cache --build-arg DOCKERFILE=%DOCKERFILE_OPT%
  docker-compose up -d
) else (
  echo Unknown mode: %MODE%
  exit /b 1
)

echo Waiting for services...
ping -n 10 127.0.0.1 >nul

docker-compose ps

echo Service access:
echo   Admin:  http://localhost:3005/admin
echo   API:    http://localhost:3005/api
echo   RSS:    http://localhost:3005/rss
echo   PG:     localhost:5433
echo   Redis:  localhost:6380

endlocal 