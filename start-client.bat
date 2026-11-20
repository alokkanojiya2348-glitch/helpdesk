@echo off
title Helpdesk Client (Frontend)
cd /d "%~dp0client"
echo Starting Helpdesk Frontend on http://localhost:5173 ...
"%USERPROFILE%\.bun\bin\bun.exe" run dev
pause
