@echo off
setlocal
cd /d "%~dp0"

echo ============================================
echo    Installing Betzel Hakodesh (local)
echo ============================================
echo.

echo [1/4] Installing npm packages...
call npm install
if errorlevel 1 goto fail

echo.
echo [2/4] Creating local database...
call npx prisma db push
if errorlevel 1 goto fail

echo.
echo [3/4] Importing data from Postgres dump...
call npx tsx scripts/migrate-from-pg-dump.ts
if errorlevel 1 goto fail

echo.
echo [4/4] Seeding admin + catalog...
call npx tsx prisma/seed-admin.ts
call npx tsx prisma/seed-catalog.ts

echo.
echo [5/4] Building production bundle...
call npm run build
if errorlevel 1 goto fail

echo.
echo ============================================
echo    All done. Run Start-Betzel.bat to launch.
echo ============================================
pause
exit /b 0

:fail
echo.
echo ############################################
echo    Install failed. See the error above.
echo ############################################
pause
exit /b 1
