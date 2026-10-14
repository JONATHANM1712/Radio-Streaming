
@echo off
setlocal
cd /d "%~dp0"

powershell -NoProfile -Command "$p = Get-CimInstance Win32_Process | Where-Object { $_.Name -in @('python.exe','pythonw.exe') -and $_.CommandLine -match 'uvicorn backend:app' -and $_.CommandLine -match '8765' }; if ($p) { $p | ForEach-Object { Stop-Process -Id $_.ProcessId -Force; Write-Host ('Stopped radio detector PID: ' + $_.ProcessId) } } else { Write-Host 'No matching radio detector found.' }"

timeout /t 2 >nul
exit /b 0
