@echo off
setlocal
cd /d "%~dp0"

if not exist backups mkdir backups

REM Use ISO-ish yyyy-MM-dd_HHmm (independent of Windows locale).
for /f "tokens=2 delims==" %%I in ('wmic os get LocalDateTime /value') do set LDT=%%I
set STAMP=%LDT:~0,4%-%LDT:~4,2%-%LDT:~6,2%_%LDT:~8,2%%LDT:~10,2%

copy /Y betzel.db "backups\betzel-%STAMP%.db" >nul
if errorlevel 1 (
  echo Backup FAILED.
  exit /b 1
)

echo Backup saved: backups\betzel-%STAMP%.db

REM Optional: prune backups older than 30 days.
forfiles /p backups /m betzel-*.db /d -30 /c "cmd /c del @path" 2>nul

endlocal
