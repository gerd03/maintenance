@echo off
echo ========================================
echo   AOAS WEB - Starting Server (Background)
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

REM Check if PM2 is installed globally
where pm2 >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo PM2 is not installed. Installing PM2 globally...
    call npm install -g pm2
    if %ERRORLEVEL% NEQ 0 (
        echo.
        echo ERROR: Failed to install PM2!
        pause
        exit /b 1
    )
    echo PM2 installed successfully!
    echo.
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

REM Create logs directory if it doesn't exist
if not exist logs mkdir logs

REM Check if server is already running
pm2 describe aoas-web >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo Server is already running!
    echo.
    echo Options:
    echo 1. Restart the server
    echo 2. View logs
    echo 3. Stop the server
    echo 4. Exit
    echo.
    set /p choice="Enter your choice (1-4): "
    
    if "%choice%"=="1" (
        echo Restarting server...
        call pm2 restart aoas-web
    ) else if "%choice%"=="2" (
        echo Opening logs (Press Ctrl+C to exit)...
        call pm2 logs aoas-web
    ) else if "%choice%"=="3" (
        echo Stopping server...
        call pm2 stop aoas-web
        echo Server stopped!
    )
    pause
    exit /b 0
)

echo Starting server in background with PM2...
echo Server will be available at: http://localhost:3000
echo.
echo To manage the server:
echo   - View status: pm2 status
echo   - View logs: pm2 logs aoas-web
echo   - Stop server: pm2 stop aoas-web
echo   - Restart server: pm2 restart aoas-web
echo   - Delete server: pm2 delete aoas-web
echo.
echo You can close this window - the server will keep running!
echo.

call pm2 start ecosystem.config.js
call pm2 save
call pm2 startup

echo.
echo ========================================
echo   Server started successfully!
echo ========================================
echo.
echo The server is now running in the background.
echo You can close this window and the server will continue running.
echo.
echo To stop the server later, run: STOP_SERVER.bat
echo.
pause

