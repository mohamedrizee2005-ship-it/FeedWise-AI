@echo off
setlocal
cd /d "%~dp0"
if not exist dist\index.html (
  echo Run FIRST_SETUP.bat first.
  pause
  exit /b 1
)
call npm start
pause
