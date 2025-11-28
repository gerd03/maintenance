@echo off
echo ========================================
echo   AOAS WEB - Stopping Server
echo ========================================
echo.

REM Check if PM2 is installed
where pm2 >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo PM2 is not installed. The server might not be running with PM2.
    echo.
    pause
    exit /b 1
)

REM Check if server is running
pm2 describe aoas-web >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo Server is not running with PM2.
    echo.
    pause
    exit /b 0
)

echo Stopping server...
call pm2 stop aoas-web
call pm2 delete aoas-web

echo.
echo ========================================
echo   Server stopped successfully!
echo ========================================
echo.
pause



