@echo off
setlocal

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

echo.
echo Starting servers in MOCK mode ^(no Canvas credentials required^)...
echo.

REM -- Launch mock backend
start "Canvas Mock Backend" cmd /k "cd /d "%MOCK_BACKEND%" && uvicorn app.main:app --reload"

timeout /t 2 /nobreak >nul

REM -- Launch frontend
start "Canvas Frontend" cmd /k "cd /d "%FRONTEND%" && npm run dev"

echo   Mock Backend  ^>  http://localhost:8000
echo   Frontend      ^>  http://localhost:5173
echo.
echo Both servers are running in separate windows.
echo Close those windows to stop the servers.
echo.
pause
