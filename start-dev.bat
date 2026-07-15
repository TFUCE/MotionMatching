@echo off
chcp 65001 >nul
cd /d "%~dp0"

if not exist ".venv\Scripts\uvicorn.exe" (
  echo Missing .venv. Double-click setup.bat first, then try again.
  pause
  exit /b 1
)

if not exist "node_modules\vite" (
  echo Missing node_modules. Double-click setup.bat first, then try again.
  pause
  exit /b 1
)

echo Starting backend :8000 and frontend :5173 ...
echo Close the two terminal windows to stop.
echo.

start "Motion Match API" /D "%~dp0" cmd /k ".venv\Scripts\uvicorn.exe app.main:app --app-dir backend --reload --host 0.0.0.0 --port 8000"
timeout /t 2 /nobreak >nul
start "Motion Match Web" /D "%~dp0" cmd /k "npm run dev"

echo API docs:  http://127.0.0.1:8000/docs
echo Web app:   http://localhost:5173/
echo Phone:     use the Network URL printed in the Web window
echo.
timeout /t 4 >nul
