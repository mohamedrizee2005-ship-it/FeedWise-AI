@echo off
setlocal
cd /d "%~dp0"
node -e "if(Number(process.versions.node.split('.')[0])<24)process.exit(1)" >nul 2>&1
if errorlevel 1 (
  echo Install Node.js 24 or newer and run FIRST_SETUP.bat again.
  pause
  exit /b 1
)
call npm ci --no-audit --no-fund
if errorlevel 1 goto failed
call npm run build
if errorlevel 1 goto failed
echo Setup complete. Run RUN_FEEDWISE.bat to open FeedWise.
pause
exit /b 0
:failed
echo Setup stopped. Read the error above.
pause
exit /b 1
