@echo off
setlocal

cd /d "%~dp0"

echo Starting Flask backend on port 8000 in the background...
start "" /b python server.py > backend.log 2>&1

echo Starting Vite frontend in this terminal...
call npm run dev --prefix client

echo.
echo Frontend stopped.
echo Backend output was written to backend.log.
