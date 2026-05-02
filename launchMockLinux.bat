#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MOCK_BACKEND="$ROOT/mock_backend"
FRONTEND="$ROOT/frontend"
VENV="$ROOT/.venv"

echo "========================================="
echo "  Canvas Query & Analysis  --  Mock Mode "
echo "========================================="
echo

# -- Python check
if ! command -v python3 &>/dev/null; then
    echo "[ERROR] python3 not found. Install Python 3.11+ and add it to PATH."
    exit 1
fi
echo "[OK] Python3"

# -- Node check
if ! command -v node &>/dev/null; then
    echo "[ERROR] Node.js not found. Install Node.js 20+ and add it to PATH."
    exit 1
fi
echo "[OK] Node.js"

# -- Virtual environment
if [ ! -d "$VENV" ]; then
    echo "Creating virtual environment..."
    python3 -m venv "$VENV"
    echo "[OK] Virtual environment created"
fi

source "$VENV/bin/activate"
echo "[OK] Virtual environment active"

# -- Mock backend dependencies
if ! python -c "import uvicorn, fastapi" &>/dev/null; then
    echo "Installing mock backend dependencies..."
    pip install -r "$MOCK_BACKEND/requirements.txt"
    echo "[OK] Mock backend dependencies installed"
else
    echo "[OK] Mock backend dependencies"
fi

# -- Frontend dependencies
if [ ! -d "$FRONTEND/node_modules" ]; then
    echo "Installing frontend dependencies..."
    (cd "$FRONTEND" && npm install)
    echo "[OK] Frontend dependencies installed"
else
    echo "[OK] Frontend dependencies"
fi

echo
echo "Starting servers in MOCK mode (no Canvas credentials required)..."
echo

find_free_port() {
    python3 -c "
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

[ "$BACKEND_PORT" -ne 8000 ]  && echo "[INFO] Port 8000 busy — using $BACKEND_PORT for backend"
[ "$FRONTEND_PORT" -ne 5173 ] && echo "[INFO] Port 5173 busy — using $FRONTEND_PORT for frontend"

cleanup() {
    echo
    echo "Shutting down servers..."
    kill "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null || true
    wait "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null || true
    echo "Done."
}
trap cleanup EXIT INT TERM

LAN_IP=$(python3 -c "import socket; s=socket.socket(socket.AF_INET,socket.SOCK_DGRAM); s.connect(('8.8.8.8',80)); print(s.getsockname()[0]); s.close()" 2>/dev/null || echo "localhost")

# -- Launch mock backend
(cd "$MOCK_BACKEND" && source "$VENV/bin/activate" && uvicorn app.main:app --reload --host 0.0.0.0 --port "$BACKEND_PORT") &
BACKEND_PID=$!

sleep 2

# -- Launch frontend
(cd "$FRONTEND" && VITE_API_URL="http://$LAN_IP:$BACKEND_PORT" npm run dev -- --host --port "$FRONTEND_PORT") &
FRONTEND_PID=$!

echo "  Mock Backend  >  http://localhost:$BACKEND_PORT"
echo "                http://$LAN_IP:$BACKEND_PORT  (LAN)"
echo "  Frontend      >  http://localhost:$FRONTEND_PORT"
echo "                http://$LAN_IP:$FRONTEND_PORT  (LAN)"
echo
echo "Press Ctrl+C to stop both servers."
echo

wait "$BACKEND_PID" "$FRONTEND_PID"
