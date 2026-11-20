@echo off
title Helpdesk Database Studio
cd /d "%~dp0database-studio"
echo Starting Helpdesk Database Studio on http://localhost:5555 ...
"%USERPROFILE%\.bun\bin\bun.exe" server.ts
pause
