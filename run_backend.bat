@echo off
title TrafficIQ - Backend (FastAPI + CUDA)
echo =================================================================
echo   Starting TrafficIQ Backend API on http://localhost:8000
echo =================================================================
cd /d "%~dp0"
.\venv\Scripts\python.exe -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
pause
