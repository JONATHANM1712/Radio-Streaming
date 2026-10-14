
@echo off
setlocal
title Radio Detector Launcher
cd /d "%~dp0"

REM Prevent duplicate backend instances
powershell -NoProfile -Command "if (Get-NetTCPConnection -LocalPort 8765 -State Listen -ErrorAction SilentlyContinue) { exit 1 } else { exit 0 }"

if errorlevel 1 (
    echo Radio detector is already running on port 8765.
    timeout /t 3 >nul
    exit /b 0
)

REM Start Python silently in the background
set "PYTHONW=%LocalAppData%\Programs\Python\Python313\pythonw.exe"

if not exist "%PYTHONW%" (
    echo Python 3.13 pythonw.exe not found.
    pause
    exit /b 1
)

REM Start backend and redirect logs to files
powershell -NoProfile -Command "$p = Start-Process -FilePath '%PYTHONW%' -ArgumentList '-m uvicorn backend:app --host 127.0.0.1 --port 8765' -WorkingDirectory '%CD%' -RedirectStandardOutput 'backend-output.txt' -RedirectStandardError 'backend-error.txt' -PassThru; Write-Host ('Radio detector started. PID: ' + $p.Id)"

echo.
echo KIS 95.1 FM, JAK 101 FM and MOST 105.8 FM
echo Background detector launch requested.
echo This window will close automatically.
timeout /t 3 >nul
exit /b 0
