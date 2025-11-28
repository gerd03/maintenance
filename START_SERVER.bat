@echo off
echo ========================================
echo   AOAS WEB - Starting Server
echo ========================================
echo.

REM Check if Node.js is installed
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Node.js is not installed!
    echo.
    echo Please install Node.js first:
    echo 1. Go to https://nodejs.org/
    echo 2. Download the LTS version for Windows
    echo 3. Run the installer
    echo 4. Restart your terminal
    echo 5. Run this script again
    echo.
    pause
    exit /b 1
)

REM Check if .env file exists
if not exist .env (
    echo Creating .env file...
    (
        echo RESEND_API_KEY=re_crv62pzq_DAaSY1Q8B6jsKxSjLk5KFhi8
        echo PORT=3000
    ) > .env
    echo .env file created!
    echo.
)

REM Check if node_modules exists
if not exist node_modules (
    echo Installing dependencies...
    call npm install
    if %ERRORLEVEL% NEQ 0 (
        echo.
        echo ERROR: Failed to install dependencies!
        pause
        exit /b 1
    )
    echo.
)

echo Starting server...
echo Server will be available at: http://localhost:3000
echo Press Ctrl+C to stop the server
echo.
call npm start

