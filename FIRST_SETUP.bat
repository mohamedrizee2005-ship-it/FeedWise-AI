@echo off
setlocal
cd /d "%~dp0"
node --version >nul 2>&1
if errorlevel 1 (
  echo Install Node.js 24 LTS, reopen this folder, and run FIRST_SETUP.bat again.
  pause
  exit /b 1
)
call npm ci --no-audit --no-fund
if errorlevel 1 goto failed
call npm run prepare:local
if errorlevel 1 goto failed
echo Setup complete. Open RUN_FEEDWISE.bat to start FeedWise.
pause
exit /b 0
:failed
echo Setup stopped. Read the error above and docs/GETTING_STARTED.md.
pause
exit /b 1
