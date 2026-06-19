@echo off
title VIBE Automotives - Server Manager
color 0B
cls

:menu
cls
echo ====================================================================
echo    VIBE AUTOMOTIVES - ENTERPRISE PORTAL LAUNCHER
echo ====================================================================
echo.
echo  [1] Start Original Consumer Landing Page (Port 3001)
echo      - Access: http://localhost:3001/
echo.
echo  [2] Start Direct Staff Login Portal (Port 3002)
echo      - Access: http://localhost:3002/ (auto-redirects to direct login)
echo.
echo  [3] Start BOTH Servers Simultaneously (Ports 3001 & 3002)
echo.
echo  [4] Exit Launcher
echo.
echo ====================================================================
set /p choice="Enter your choice (1-4): "

if "%choice%"=="1" goto opt1
if "%choice%"=="2" goto opt2
if "%choice%"=="3" goto opt3
if "%choice%"=="4" goto exit
echo.
echo [!] Invalid selection, please enter a number from 1 to 4.
timeout /t 2 >nul
goto menu

:opt1
cls
echo ====================================================================
echo  Starting Original Consumer Landing Page...
echo  URL: http://localhost:3001/
echo  Press Ctrl+C to terminate the server.
echo ====================================================================
echo.
python3 -m http.server 3001
goto end

:opt2
cls
echo ====================================================================
echo  Starting Direct Staff Login Portal...
echo  URL: http://localhost:3002/
echo  Press Ctrl+C to terminate the server.
echo ====================================================================
echo.
python3 server_3002.py
goto end

:opt3
cls
echo ====================================================================
echo  Starting BOTH VIBE Automotives Servers...
echo.
echo  [Active] Original Landing Page: http://localhost:3001/
echo  [Active] Direct Login Portal:   http://localhost:3002/
echo.
echo  NOTE: Closing this window will stop both servers.
echo        To stop them in-place, press Ctrl+C twice.
echo ====================================================================
echo.
:: Start Port 3001 server in background
start "VIBE Port 3001" /B python3 -m http.server 3001
:: Start Port 3002 server in foreground
python3 server_3002.py
goto end

:end
echo.
echo Servers stopped. Press any key to return to menu...
pause >nul
goto menu

:exit
exit
