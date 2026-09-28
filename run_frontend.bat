@echo off
title TrafficIQ - Frontend (React + Vite)
echo =================================================================
echo   Starting TrafficIQ Dashboard on http://localhost:5173
echo =================================================================
cd /d "%~dp0\frontend"
npm run dev
pause
