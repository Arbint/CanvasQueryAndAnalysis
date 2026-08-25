@echo off
setlocal EnableDelayedExpansion

set "ROOT=%~dp0"
set "MOCK_BACKEND=%ROOT%mock_backend"
set "FRONTEND=%ROOT%frontend"

echo =========================================
echo   Canvas Query ^& Analysis  --  Mock Mode
echo =========================================
echo.

REM -- Python check
where python >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python not found. Install Python 3.11+ and add it to PATH.
    pause & exit /b 1
)
echo [OK] Python

REM -- Node check
where node >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js not found. Install Node.js 20+ and add it to PATH.
    pause & exit /b 1
)
echo [OK] Node.js

REM -- Mock backend dependencies
python -c "import uvicorn, fastapi" >nul 2>&1
if errorlevel 1 (
    echo Installing mock backend dependencies...
    pip install -r "%MOCK_BACKEND%\requirements.txt"
    if errorlevel 1 (
        echo [ERROR] pip install failed.
        pause & exit /b 1
    )
    echo [OK] Mock backend dependencies installed
) else (
    echo [OK] Mock backend dependencies
)

REM -- Frontend dependencies
if not exist "%FRONTEND%\node_modules" (
    echo Installing frontend dependencies...
    pushd "%FRONTEND%"
    npm install
    if errorlevel 1 (
        popd
        echo [ERROR] npm install failed.
        pause & exit /b 1
    )
    popd
    echo [OK] Frontend dependencies installed
) else (
    echo [OK] Frontend dependencies
)

REM -- Network access mode
echo.
echo Network access:
echo   [1] This computer only (localhost)  [default]
echo   [2] This computer and other devices on the LAN
set "NET_CHOICE="
set /p "NET_CHOICE=Choice (1/2): "
if not "%NET_CHOICE%"=="2" set "NET_CHOICE=1"

set "BACKEND_HOST_ARGS="
set "FRONTEND_HOST_ARGS="
set "FRONTEND_ENV_PREFIX="
set "LAN_IP="
if "%NET_CHOICE%"=="2" (
    for /f "usebackq delims=" %%I in (`python -c "import socket; s=socket.socket(socket.AF_INET,socket.SOCK_DGRAM); s.connect(('8.8.8.8',80)); print(s.getsockname()[0]); s.close()" 2^>nul`) do set "LAN_IP=%%I"
    if not defined LAN_IP set "LAN_IP=localhost"
    set "BACKEND_HOST_ARGS=--host 0.0.0.0"
    set "FRONTEND_HOST_ARGS=--host"
    set "FRONTEND_ENV_PREFIX=set VITE_API_URL=http://!LAN_IP!:8000&& "
    echo [OK] LAN access enabled ^(!LAN_IP!^)
) else (
    echo [OK] Localhost-only access
)

echo.
echo Starting servers in MOCK mode ^(no Canvas credentials required^)...
echo.

REM -- Launch mock backend
start "Canvas Mock Backend" cmd /k "cd /d "%MOCK_BACKEND%" && uvicorn app.main:app --reload %BACKEND_HOST_ARGS%"

timeout /t 2 /nobreak >nul

REM -- Launch frontend
start "Canvas Frontend" cmd /k "cd /d "%FRONTEND%" && %FRONTEND_ENV_PREFIX%npm run dev -- %FRONTEND_HOST_ARGS%"

echo   Mock Backend  ^>  http://localhost:8000
echo   Frontend      ^>  http://localhost:5173
if "%NET_CHOICE%"=="2" (
    echo                  http://%LAN_IP%:8000  ^(LAN^)
    echo                  http://%LAN_IP%:5173  ^(LAN^)
)
echo.
echo Both servers are running in separate windows.
echo Close those windows to stop the servers.
echo.
pause
