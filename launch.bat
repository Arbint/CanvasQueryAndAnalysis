@echo off
setlocal EnableExtensions EnableDelayedExpansion

set "ROOT=%~dp0"
set "BACKEND=%ROOT%backend"
set "FRONTEND=%ROOT%frontend"
set "VENV=%BACKEND%\.venv"
set "VENV_PYTHON=%VENV%\Scripts\python.exe"

echo =========================================
echo   Canvas Query ^& Analysis  --  Launcher
echo =========================================
echo.

REM -- Python check
where python >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python not found. Install Python 3.11+ and add it to PATH.
    pause & exit /b 1
)
echo [OK] Python

REM -- uv check/install
where uv >nul 2>&1
if errorlevel 1 (
    echo Installing uv...
    python -m pip install --user uv
    if errorlevel 1 (
        echo [ERROR] uv install failed.
        pause & exit /b 1
    )
    for /f "usebackq delims=" %%I in (`python -c "import pathlib, site; print(pathlib.Path(site.USER_BASE) / 'Scripts' / 'uv.exe')"`) do set "UV=%%I"
    if not exist "!UV!" (
        echo [ERROR] uv was installed, but uv.exe was not found in the Python user scripts directory.
        pause & exit /b 1
    )
) else (
    set "UV=uv"
)
"%UV%" --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] uv was installed but is not available. Restart this terminal and try again.
    pause & exit /b 1
)
echo [OK] uv

REM -- Node check
where node >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js not found. Install Node.js 20+ and add it to PATH.
    pause & exit /b 1
)
echo [OK] Node.js

REM -- Canvas credentials
REM    Accepts user/system env vars or backend\.env file
if defined CANVAS_API_TOKEN if defined CANVAS_API_URL (
    echo [OK] Canvas credentials ^(environment variables^)
    goto :creds_ok
)
if exist "%BACKEND%\.env" (
    echo [OK] Canvas credentials ^(backend\.env^)
    goto :creds_ok
)
echo.
echo [ERROR] Canvas credentials not found.
echo.
echo   Option 1 - Set user environment variables:
echo     CANVAS_API_TOKEN = your_token_here
echo     CANVAS_API_URL   = https://your.canvas.instance
echo.
echo   Option 2 - Create the file backend\.env with those two lines.
echo.
pause & exit /b 1
:creds_ok

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

REM -- Backend virtual environment
if not exist "%VENV_PYTHON%" (
    echo Creating backend virtual environment...
    "%UV%" venv "%VENV%" --python python
    if errorlevel 1 (
        echo [ERROR] uv venv failed.
        pause & exit /b 1
    )
    echo [OK] Backend virtual environment created
) else (
    echo [OK] Backend virtual environment
)

REM -- Backend dependencies
echo Installing/updating backend dependencies...
"%UV%" pip install --python "%VENV_PYTHON%" -r "%BACKEND%\requirements.txt"
if errorlevel 1 (
    echo [ERROR] Backend dependency install failed.
    pause & exit /b 1
)
"%UV%" pip check --python "%VENV_PYTHON%" >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Backend dependency check failed.
    pause & exit /b 1
)
echo [OK] Backend dependencies installed

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

echo.
echo Starting servers...
echo.

REM -- Launch backend
start "Canvas Backend" /D "%BACKEND%" cmd /k ""%VENV_PYTHON%" -m uvicorn app.main:app --reload %BACKEND_HOST_ARGS%"

timeout /t 2 /nobreak >nul

REM -- Launch frontend
start "Canvas Frontend" /D "%FRONTEND%" cmd /k "%FRONTEND_ENV_PREFIX%npm run dev -- %FRONTEND_HOST_ARGS%"

echo   Backend   ^>  http://localhost:8000
echo   Frontend  ^>  http://localhost:5173
if "%NET_CHOICE%"=="2" (
    echo              http://%LAN_IP%:8000  ^(LAN^)
    echo              http://%LAN_IP%:5173  ^(LAN^)
)
echo.
echo Both servers are running in separate windows.
echo Close those windows to stop the servers.
echo.
pause
