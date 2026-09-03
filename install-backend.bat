@echo off
title Install MOST & KIS Local Recognizer
echo Installing Python packages...
echo.
python -m pip install -r requirements.txt
echo.
echo ------------------------------------------
echo Python dependencies finished.
echo ------------------------------------------
echo.
echo IMPORTANT:
echo FFmpeg must also be installed and available
echo from the Windows PATH.
echo.
echo Test it with:
echo   ffmpeg -version
echo.
pause
