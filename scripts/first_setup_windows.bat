@echo off
cd /d "%~dp0.."
echo FeedWise AI - First-time setup
where py >nul 2>nul
if %errorlevel%==0 (set "PYTHON=py -3") else (set "PYTHON=python")
if not exist .venv\Scripts\python.exe (
  %PYTHON% -m venv .venv
  if errorlevel 1 goto failed
)
call .venv\Scripts\python.exe -m pip install -r requirements.txt
if errorlevel 1 goto failed
call .venv\Scripts\python.exe setup.py
if errorlevel 1 goto failed
call .venv\Scripts\python.exe create_admin.py
if errorlevel 1 goto failed
echo.
echo Setup finished. Double-click the Admin, Student and Lecturer launchers.
pause
exit /b 0
:failed
echo Setup failed. Read error messages above.
pause
exit /b 1
