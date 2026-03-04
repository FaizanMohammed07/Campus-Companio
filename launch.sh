#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
#  GUIDO — Campus Companion Robot — Unified Launcher
# ═══════════════════════════════════════════════════════════════
#  Starts all three services in the correct order:
#    1. Python Vision Server  (port 8000)  — single authority
#    2. Node.js Backend        (port 5002)  — API gateway
#    3. React Frontend         (port 5173)  — user interface
#
#  Usage:
#    chmod +x launch.sh
#    ./launch.sh              # start everything
#    ./launch.sh --skip-install  # skip npm/pip install steps
# ═══════════════════════════════════════════════════════════════

set -euo pipefail

# ── colours ──────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# ── paths (relative to this script) ─────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VISION_DIR="$SCRIPT_DIR/mechanics/guidence"
BACKEND_DIR="$SCRIPT_DIR/Campus-Companio/BACKEND"
FRONTEND_DIR="$SCRIPT_DIR/Campus-Companio/FRONTEND"
VENV_DIR="$VISION_DIR/.venv"

# ── ports ────────────────────────────────────────────────────
VISION_PORT=8000
BACKEND_PORT=5002
FRONTEND_PORT=5173

# ── PIDs (for cleanup) ──────────────────────────────────────
VISION_PID=""
BACKEND_PID=""
FRONTEND_PID=""

# ── flags ────────────────────────────────────────────────────
SKIP_INSTALL=false
for arg in "$@"; do
  case "$arg" in
    --skip-install) SKIP_INSTALL=true ;;
  esac
done

# ─────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────

log()    { echo -e "${BLUE}[GUIDO]${NC} $*"; }
ok()     { echo -e "${GREEN}  ✔${NC} $*"; }
warn()   { echo -e "${YELLOW}  ⚠${NC} $*"; }
err()    { echo -e "${RED}  ✖${NC} $*"; }
header() { echo -e "\n${BOLD}${CYAN}━━━ $* ━━━${NC}\n"; }

# Wait for a port to respond to HTTP, with timeout
wait_for_port() {
  local port=$1 name=$2 timeout=${3:-30}
  local elapsed=0
  log "Waiting for ${BOLD}$name${NC} on port $port …"
  while ! curl -sf "http://127.0.0.1:$port/health" >/dev/null 2>&1; do
    sleep 1
    elapsed=$((elapsed + 1))
    if [ $elapsed -ge $timeout ]; then
      err "$name did not start within ${timeout}s"
      cleanup
      exit 1
    fi
  done
  ok "$name is UP  (port $port, ${elapsed}s)"
}

# Kill all child processes on exit
cleanup() {
  echo ""
  header "Shutting down all services"
  for pid_var in FRONTEND_PID BACKEND_PID VISION_PID; do
    pid=${!pid_var}
    if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
      log "Stopping PID $pid …"
      kill -TERM "$pid" 2>/dev/null || true
      # Give it a moment then force-kill if needed
      sleep 1
      kill -0 "$pid" 2>/dev/null && kill -9 "$pid" 2>/dev/null || true
    fi
  done
  ok "All services stopped."
  exit 0
}

trap cleanup SIGINT SIGTERM

# ─────────────────────────────────────────────────────────────
# Pre-flight checks
# ─────────────────────────────────────────────────────────────

header "Pre-flight checks"

# Check required tools
for cmd in node npm python3 curl; do
  if ! command -v "$cmd" &>/dev/null; then
    err "'$cmd' is not installed — please install it first."
    exit 1
  fi
done
ok "node $(node -v), npm $(npm -v), python3 $(python3 --version 2>&1 | awk '{print $2}')"

# Check directories exist
for dir_var in VISION_DIR BACKEND_DIR FRONTEND_DIR; do
  dir=${!dir_var}
  if [ ! -d "$dir" ]; then
    err "Directory not found: $dir"
    exit 1
  fi
done
ok "All project directories found"

# Check for port conflicts
for port in $VISION_PORT $BACKEND_PORT $FRONTEND_PORT; do
  if lsof -i ":$port" -sTCP:LISTEN >/dev/null 2>&1; then
    err "Port $port is already in use — kill the process first:"
    lsof -i ":$port" -sTCP:LISTEN
    exit 1
  fi
done
ok "Ports $VISION_PORT, $BACKEND_PORT, $FRONTEND_PORT are free"

# ─────────────────────────────────────────────────────────────
# Install dependencies (unless --skip-install)
# ─────────────────────────────────────────────────────────────

if [ "$SKIP_INSTALL" = false ]; then
  header "Installing dependencies"

  # ── Python virtual environment ──
  log "Setting up Python virtual environment …"
  if [ ! -d "$VENV_DIR" ]; then
    python3 -m venv "$VENV_DIR"
    ok "Created venv at $VENV_DIR"
  else
    ok "Using existing venv at $VENV_DIR"
  fi
  log "Installing Python packages …"
  ("$VENV_DIR/bin/pip" install -q -r "$VISION_DIR/requirements.txt") && ok "Python deps" || warn "Python deps (some may be missing)"

  log "Backend npm packages …"
  (cd "$BACKEND_DIR" && npm install --silent) && ok "Backend deps" || warn "Backend deps"

  log "Frontend npm packages …"
  (cd "$FRONTEND_DIR" && npm install --silent) && ok "Frontend deps" || warn "Frontend deps"
else
  warn "Skipping dependency installation (--skip-install)"
  if [ ! -d "$VENV_DIR" ]; then
    err "No Python venv found at $VENV_DIR — run without --skip-install first"
    exit 1
  fi
fi

# Resolve the Python binary (venv if available, else system)
if [ -x "$VENV_DIR/bin/python" ]; then
  PYTHON="$VENV_DIR/bin/python"
else
  PYTHON="python3"
fi

# ─────────────────────────────────────────────────────────────
# 1. Start Python Vision Server (port 8000)
# ─────────────────────────────────────────────────────────────

header "1/3  Python Vision Server  →  port $VISION_PORT"

(cd "$VISION_DIR" && "$PYTHON" run_server.py) &
VISION_PID=$!
log "Started with PID $VISION_PID"
wait_for_port $VISION_PORT "Vision Server" 45

# ─────────────────────────────────────────────────────────────
# 2. Start Node.js Backend (port 5002)
# ─────────────────────────────────────────────────────────────

header "2/3  Node.js Backend  →  port $BACKEND_PORT"

export VISION_SERVER_URL="http://127.0.0.1:$VISION_PORT"
export PORT=$BACKEND_PORT

(cd "$BACKEND_DIR" && npm run dev) &
BACKEND_PID=$!
log "Started with PID $BACKEND_PID"
sleep 4  # give tsx a moment to compile
ok "Backend launched (PID $BACKEND_PID)"

# ─────────────────────────────────────────────────────────────
# 3. Start React Frontend (port 5000)
# ─────────────────────────────────────────────────────────────

header "3/3  React Frontend  →  port $FRONTEND_PORT"

export VITE_API_TARGET="http://127.0.0.1:$BACKEND_PORT"

(cd "$FRONTEND_DIR" && npm run dev) &
FRONTEND_PID=$!
log "Started with PID $FRONTEND_PID"
sleep 3
ok "Frontend launched (PID $FRONTEND_PID)"

# ─────────────────────────────────────────────────────────────
# Ready!
# ─────────────────────────────────────────────────────────────

echo ""
echo -e "${BOLD}${GREEN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BOLD}${GREEN}   🤖  GUIDO is READY!${NC}"
echo -e "${BOLD}${GREEN}═══════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "   ${CYAN}Frontend${NC}       → ${BOLD}http://localhost:$FRONTEND_PORT${NC}"
echo -e "   ${CYAN}Backend API${NC}    → ${BOLD}http://localhost:$BACKEND_PORT${NC}"
echo -e "   ${CYAN}Vision Server${NC}  → ${BOLD}http://localhost:$VISION_PORT${NC}"
echo ""
echo -e "   ${CYAN}Architecture${NC}   → Frontend → Backend → Vision → ESP32"
echo ""
echo -e "   ${YELLOW}Press Ctrl+C to stop all services${NC}"
echo ""

# Keep the script alive — wait for any child to exit
wait
