@echo off
title MOST & KIS Local Song Recognizer
echo ==========================================
echo MOST 105.8 + KIS 95.1 Song Recognizer
echo ==========================================
echo.
echo Starting local recognizer on:
echo http://127.0.0.1:8765
echo.
echo Keep this window open while detecting songs.
echo.

python -m uvicorn backend:app --host 127.0.0.1 --port 8765

echo.
echo Server stopped.
pause
