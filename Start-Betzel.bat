@echo off
cd /d "%~dp0"
title Betzel Hakodesh (Local Server)

echo ============================================
echo    Betzel Hakodesh
echo ============================================
echo.

REM Free port 3000 if a previous server is still running, so relaunching
REM always picks up the latest version (avoids the "old version still shows"
REM problem when a stale window is left open).
for /f "tokens=5" %%P in ('netstat -ano ^| findstr ":3000 " ^| findstr LISTENING') do taskkill /F /PID %%P >nul 2>&1

echo [1/2] Building the latest version (about 15-30 seconds)...
call npm run build
if errorlevel 1 goto fail

echo.
echo [2/2] Starting the server...
echo Chrome will open in a moment. Close this window to stop the app.

REM Open Chrome shortly after we start the server below.
start "" /min cmd /c "timeout /t 5 /nobreak >nul && start http://localhost:3000"

REM Foreground the server so closing this window stops it.
call npm start
goto :eof

:fail
echo.
echo ############################################
echo    Build failed - see the error above.
echo    The app was NOT started.
echo ############################################
pause
