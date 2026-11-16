@echo off
setlocal
cd /d "%~dp0"
if not exist node_modules (
 echo Run FIRST_SETUP.bat first.
 pause
 exit /b 1
)
call npm run dev
pause
