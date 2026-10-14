@echo off
cd /d "%~dp0"
title MOST + KIS + JAK Background Radio Detector
echo Starting all three radio detectors and the daily SQLite history...
echo Close this window to stop detection. The saved history remains on disk.
set "PUBLISH_HISTORY_TO_GITHUB=1"
python -m uvicorn backend:app --host 127.0.0.1 --port 8765 --workers 1
pause
