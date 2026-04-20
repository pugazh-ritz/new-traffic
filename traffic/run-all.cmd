@echo off
setlocal enabledelayedexpansion

rem Smart Traffic Management System - Run All (Local Setup)
rem Starts backend, frontend, and three video detectors in separate windows.

set "ROOT=%~dp0"
cd /d "%ROOT%"

rem Pick the video source you want to use:
rem traffic_video.mp4 lives one level above the project folder
set "VIDEO_SOURCE=%ROOT%..\traffic_video.mp4"
rem set "VIDEO_SOURCE=%ROOT%vecteezy_traffic-cars-passing-in-road-with-asphalt-with-cracks-seen_36990287.mov"

rem Explicit executables (avoid PATH issues in new cmd windows)
set "NODE_EXE=C:\Users\pugazh_ritz\AppData\Local\Microsoft\WinGet\Packages\OpenJS.NodeJS.LTS_Microsoft.Winget.Source_8wekyb3d8bbwe\node-v24.13.1-win-x64\node.exe"
set "PYTHON_EXE=C:\Users\pugazh_ritz\AppData\Local\Programs\Python\Python311\python.exe"

echo Using VIDEO_SOURCE=%VIDEO_SOURCE%
echo.

rem Backend (Admin Server)
start "Traffic Backend" /D "%ROOT%backend" "%NODE_EXE%" src/index.js

rem Frontend (Dashboard)
start "Traffic Frontend" /D "%ROOT%frontend" "%NODE_EXE%" node_modules\react-scripts\bin\react-scripts.js start

rem Video Detectors (A/B/C)
start "Detector A" /D "%ROOT%" cmd /k "set VIDEO_SOURCE=%VIDEO_SOURCE%&& set SIGNAL_ID=A&& \"%PYTHON_EXE%\" video-detector.py"
start "Detector B" /D "%ROOT%" cmd /k "set VIDEO_SOURCE=%VIDEO_SOURCE%&& set SIGNAL_ID=B&& \"%PYTHON_EXE%\" video-detector.py"
start "Detector C" /D "%ROOT%" cmd /k "set VIDEO_SOURCE=%VIDEO_SOURCE%&& set SIGNAL_ID=C&& \"%PYTHON_EXE%\" video-detector.py"

echo All components launched.
echo If any window exits immediately, check the error output in that window.
echo.
pause
