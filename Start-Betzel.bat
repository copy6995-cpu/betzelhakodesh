@echo off
cd /d "%~dp0"
title Betzel Hakodesh (Local Server)

echo Starting Betzel Hakodesh...
echo Chrome will open once the server is ready.
echo Close this window to stop the app.
echo.

REM Open Chrome after a short delay so Next.js has time to bind :3000.
start "" /min cmd /c "timeout /t 4 /nobreak >nul && start http://localhost:3000"

REM Foreground the server so closing this window stops it.
call npm start
