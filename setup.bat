@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo [1/3] Creating virtualenv .venv ...
if not exist ".venv\Scripts\python.exe" (
  python -m venv .venv
  if errorlevel 1 (
    echo Failed: python not found. Install Python 3 and retry.
    pause
    exit /b 1
  )
) else (
  echo .venv already exists, skip.
)

echo [2/3] Installing backend packages ...
call ".venv\Scripts\activate.bat"
python -m pip install --upgrade pip
pip install -r "backend\requirements.txt"
if errorlevel 1 (
  echo Failed installing Python packages.
  pause
  exit /b 1
)

echo [3/3] Installing frontend packages ...
call npm install
if errorlevel 1 (
  echo Failed: npm not found or install error. Install Node.js and retry.
  pause
  exit /b 1
)

echo.
echo Setup done. Next: double-click start-dev.bat
pause
