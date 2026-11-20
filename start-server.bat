@echo off
title Helpdesk Server (Backend)
cd /d "%~dp0server"
echo Starting Helpdesk Backend on http://localhost:3000 ...
"%USERPROFILE%\.bun\bin\bun.exe" run dev
pause
