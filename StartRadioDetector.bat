
@echo off
setlocal
cd /d "%~dp0"
title Radio Detector Startup

echo Starting KIS, JAK and MOST in background...

py -3 "%~dp0launch_detector.py"

if errorlevel 1 (
    echo Startup failed.
    pause
    exit /b 1
)

timeout /t 2 /nobreak >nul
exit /b 0
