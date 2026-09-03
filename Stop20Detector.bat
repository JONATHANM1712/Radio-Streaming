@echo off
setlocal
cd /d "%~dp0"

set "PID_FILE=%~dp0.radio-detector.pid"

rem Stop only the hidden backend started by Start Radio Detector.bat.
if exist "%PID_FILE%" (
  for /f "usebackq delims=" %%P in ("%PID_FILE%") do set "RADIO_PID=%%P"

  if defined RADIO_PID (
    powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -Command ^
      "Stop-Process -Id %RADIO_PID% -Force -ErrorAction SilentlyContinue" >nul 2>&1
  )

  del /q "%PID_FILE%" >nul 2>&1
)

exit /b 0
