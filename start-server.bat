@echo off
echo Starting FarsNews Crawler Server...
echo.
echo PostgreSQL Status:
docker ps | findstr postgres
echo.
echo Starting Node.js server...
node index.js
pause 