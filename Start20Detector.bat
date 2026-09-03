@echo off
setlocal
cd /d "%~dp0"

set "BACKEND_URL=http://127.0.0.1:8765/"
set "PID_FILE=%~dp0.radio-detector.pid"
set "OUT_LOG=%~dp0backend-output.log"
set "ERR_LOG=%~dp0backend-error.log"

rem ============================================================
rem MOST 105.8 + KIS 95.1 Radio Detector
rem - Starts the FastAPI/Uvicorn recognizer hidden in background
rem - Avoids starting a second backend if port 8765 is already up
rem - Waits for the backend to become ready
rem - Opens both radio dashboards automatically
rem ============================================================

rem Check whether the recognizer is already running.
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "try { $r = Invoke-WebRequest -UseBasicParsing -Uri '%BACKEND_URL%' -TimeoutSec 1; if ($r.StatusCode -eq 200) { exit 0 } } catch {}; exit 1" >nul 2>&1

if errorlevel 1 (
  rem Start Uvicorn completely hidden and remember its process ID.
  powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -Command ^
    "$p = Start-Process -FilePath 'python' -ArgumentList @('-m','uvicorn','backend:app','--host','127.0.0.1','--port','8765') -WorkingDirectory '%~dp0' -WindowStyle Hidden -RedirectStandardOutput '%OUT_LOG%' -RedirectStandardError '%ERR_LOG%' -PassThru; Set-Content -LiteralPath '%PID_FILE%' -Value $p.Id" >nul 2>&1
)

rem Wait up to about 10 seconds for the backend to answer.
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ok=$false; for($i=0;$i -lt 40;$i++){ try { $r=Invoke-WebRequest -UseBasicParsing -Uri '%BACKEND_URL%' -TimeoutSec 1; if($r.StatusCode -eq 200){$ok=$true;break} } catch {}; Start-Sleep -Milliseconds 250 }; if(-not $ok){ exit 1 }" >nul 2>&1

if errorlevel 1 (
  powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -Command ^
    "Add-Type -AssemblyName PresentationFramework; [System.Windows.MessageBox]::Show('The radio recognizer could not start. Check backend-error.log, Python, FFmpeg, and the installed requirements.','Radio Detector','OK','Error') | Out-Null"
  exit /b 1
)

rem Open both dashboards in the default browser.
start "" "%~dp0most-streaming.html"
start "" "%~dp0kis-streaming.html"

exit /b 0
