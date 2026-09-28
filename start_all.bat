@echo off
title TrafficIQ - System Launcher
echo =================================================================
echo   Launching TrafficIQ System (Backend + Frontend)
echo =================================================================
cd /d "%~dp0"
start "TrafficIQ Backend" run_backend.bat
timeout /t 2 /nobreak >nul
start "TrafficIQ Frontend" run_frontend.bat
echo Both services launched in separate windows!
echo Backend:  http://localhost:8000
echo Frontend: http://localhost:5173
pause
