@echo off
cd /d "%~dp0.."
where py >nul 2>nul
if %errorlevel%==0 (set "FEEDWISE_PYTHON=py -3") else (set "FEEDWISE_PYTHON=python")
if not exist .venv\Scripts\python.exe (
  %FEEDWISE_PYTHON% -m venv .venv
  if errorlevel 1 goto failed
)
.venv\Scripts\python.exe -m pip install -r requirements.txt
if errorlevel 1 goto failed
.venv\Scripts\python.exe setup.py
if errorlevel 1 goto failed
echo Setup finished. Open RUN_FEEDWISE.bat.
pause
exit /b 0
:failed
echo Setup failed. Read the error above.
pause
exit /b 1
