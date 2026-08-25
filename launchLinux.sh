#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND="$ROOT/backend"
FRONTEND="$ROOT/frontend"
VENV="$BACKEND/.venv"
VENV_PYTHON="$VENV/bin/python"

echo "========================================="
echo "  Canvas Query & Analysis  --  Launcher  "
echo "========================================="
echo

# -- Python check
if command -v python3 &>/dev/null; then
    PYTHON="python3"
elif command -v python &>/dev/null; then
    PYTHON="python"
else
    echo "[ERROR] Python not found. Install Python 3.11+ and add it to PATH."
    exit 1
fi
echo "[OK] Python"

# -- uv check/install
if command -v uv &>/dev/null; then
    UV=(uv)
else
    echo "Installing uv..."
    "$PYTHON" -m pip install --user uv
    USER_BASE="$("$PYTHON" -m site --user-base)"
    UV=("$USER_BASE/bin/uv")
fi

if ! "${UV[@]}" --version &>/dev/null; then
    echo "[ERROR] uv was installed but is not available. Restart this shell and try again."
    exit 1
fi
echo "[OK] uv"

# -- Node check
if ! command -v node &>/dev/null; then
    echo "[ERROR] Node.js not found. Install Node.js 20+ and add it to PATH."
    exit 1
fi
echo "[OK] Node.js"

# -- Canvas credentials
if { [ -n "${CANVAS_API_TOKEN:-}" ] && [ -n "${CANVAS_API_URL:-}" ]; }; then
    echo "[OK] Canvas credentials (environment variables)"
elif [ -f "$BACKEND/.env" ]; then
    echo "[OK] Canvas credentials (backend/.env)"
else
    echo
    echo "[ERROR] Canvas credentials not found."
    echo
    echo "  Option 1 - Export environment variables:"
    echo "    export CANVAS_API_TOKEN=your_token_here"
    echo "    export CANVAS_API_URL=https://your.canvas.instance"
    echo
    echo "  Option 2 - Create the file backend/.env with those two lines."
    echo
    exit 1
fi

# -- Backend virtual environment
if [ ! -x "$VENV_PYTHON" ]; then
    echo "Creating backend virtual environment..."
    "${UV[@]}" venv "$VENV" --python "$PYTHON"
    echo "[OK] Backend virtual environment created"
else
    echo "[OK] Backend virtual environment"
fi

# -- Backend dependencies
echo "Installing/updating backend dependencies..."
"${UV[@]}" pip install --python "$VENV_PYTHON" -r "$BACKEND/requirements.txt"
"${UV[@]}" pip check --python "$VENV_PYTHON"
echo "[OK] Backend dependencies installed"

# -- Frontend dependencies
if [ ! -d "$FRONTEND/node_modules" ]; then
    echo "Installing frontend dependencies..."
    (cd "$FRONTEND" && npm install)
    echo "[OK] Frontend dependencies installed"
else
    echo "[OK] Frontend dependencies"
fi

echo
echo "Network access:"
echo "  [1] This computer only (localhost)  [default]"
echo "  [2] This computer and other devices on the LAN"
read -p "Choice (1/2): " NET_CHOICE
echo

find_free_port() {
    "$PYTHON" -c "
import socket
port = $1
while True:
    try:
        s = socket.socket()
        s.bind(('', port))
        s.close()
        print(port)
        break
    except OSError:
        port += 1
"
}

BACKEND_PORT=$(find_free_port 8000)
FRONTEND_PORT=$(find_free_port 5173)

[ "$BACKEND_PORT" -ne 8000 ]  && echo "[INFO] Port 8000 busy - using $BACKEND_PORT for backend"
[ "$FRONTEND_PORT" -ne 5173 ] && echo "[INFO] Port 5173 busy - using $FRONTEND_PORT for frontend"

cleanup() {
    echo
    echo "Shutting down servers..."
    kill "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null || true
    wait "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null || true
    echo "Done."
}
trap cleanup EXIT INT TERM

if [ "$NET_CHOICE" = "2" ]; then
    LAN_IP=$("$PYTHON" -c "import socket; s=socket.socket(socket.AF_INET,socket.SOCK_DGRAM); s.connect(('8.8.8.8',80)); print(s.getsockname()[0]); s.close()" 2>/dev/null || echo "localhost")
    BACKEND_HOST_ARGS=(--host 0.0.0.0)
    FRONTEND_HOST_ARGS=(--host)
    echo "[OK] LAN access enabled ($LAN_IP)"
else
    BACKEND_HOST_ARGS=()
    FRONTEND_HOST_ARGS=()
    echo "[OK] Localhost-only access"
fi

# -- Launch backend
(cd "$BACKEND" && "$VENV_PYTHON" -m uvicorn app.main:app --reload --port "$BACKEND_PORT" "${BACKEND_HOST_ARGS[@]}") &
BACKEND_PID=$!

sleep 2

# -- Launch frontend
if [ "$NET_CHOICE" = "2" ]; then
    (cd "$FRONTEND" && VITE_API_URL="http://$LAN_IP:$BACKEND_PORT" npm run dev -- --port "$FRONTEND_PORT" "${FRONTEND_HOST_ARGS[@]}") &
else
    (cd "$FRONTEND" && npm run dev -- --port "$FRONTEND_PORT") &
fi
FRONTEND_PID=$!

echo "  Backend   >  http://localhost:$BACKEND_PORT"
echo "  Frontend  >  http://localhost:$FRONTEND_PORT"
if [ "$NET_CHOICE" = "2" ]; then
    echo "             http://$LAN_IP:$BACKEND_PORT  (LAN)"
    echo "             http://$LAN_IP:$FRONTEND_PORT  (LAN)"
fi
echo
echo "Press Ctrl+C to stop both servers."
echo

wait "$BACKEND_PID" "$FRONTEND_PID"
