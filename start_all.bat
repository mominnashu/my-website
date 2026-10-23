@echo off
echo ===================================================
echo   RiskProtect Enterprise SOC - Startup Script
echo ===================================================

echo [1/3] Starting ML Inference Service on http://127.0.0.1:8001 ...
start "RiskProtect ML Service (Port 8001)" cmd /k "cd /d %~dp0ml-service && python -m uvicorn main:app --host 127.0.0.1 --port 8001 --reload"

timeout /t 3 /nobreak > nul

echo [2/3] Starting Express Backend API on http://127.0.0.1:5000 ...
start "RiskProtect Backend (Port 5000)" cmd /k "cd /d %~dp0backend && npm run dev"

timeout /t 3 /nobreak > nul

echo [3/3] Starting Vite React Frontend on http://127.0.0.1:5173 ...
start "RiskProtect Frontend (Port 5173)" cmd /k "cd /d %~dp0frontend && npm run dev"

echo.
echo All services launched!
echo - Frontend:   http://127.0.0.1:5173
echo - Backend:    http://127.0.0.1:5000
echo - ML Service: http://127.0.0.1:8001/docs
echo ===================================================
