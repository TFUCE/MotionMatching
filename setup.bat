@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo [1/3] Creating virtualenv backend\.venv ...
if not exist "backend\.venv\Scripts\python.exe" (
  python -m venv "backend\.venv"
  if errorlevel 1 (
    echo Failed: python not found. Install Python 3 and retry.
    pause
    exit /b 1
  )
) else (
  echo backend\.venv already exists, skip.
)

echo [2/3] Installing backend packages ...
call "backend\.venv\Scripts\activate.bat"
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
