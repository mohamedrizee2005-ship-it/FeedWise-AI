@echo off
cd /d "%~dp0"
if not exist .venv\Scripts\python.exe (
  echo Run 01_FIRST_SETUP.bat first.
  pause
  exit /b 1
)
.venv\Scripts\python.exe -m streamlit run student_app.py --server.address 127.0.0.1 --server.port 8501 --server.headless true
pause
