@echo off
title MOST + KIS + JAK Radio Recognition Backend

cd /d "%~dp0"

echo ============================================================
echo   MOST + KIS + JAK Radio Recognition Backend
echo ============================================================
echo.
echo Starting local server on:
echo http://127.0.0.1:8765
echo.
echo KIS: automatic ShazamIO direct-stream recognition
echo JAK: automatic ShazamIO Noice direct-stream recognition
echo.
echo Keep this window open.
echo ============================================================
echo.

python -m uvicorn backend:app --host 127.0.0.1 --port 8765

echo.
echo Backend stopped.
pause