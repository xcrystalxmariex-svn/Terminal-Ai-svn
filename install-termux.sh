#!/data/data/com.termux/files/usr/bin/bash
# Terminal-Ai Termux Installer
# One-line install: curl -sSL https://raw.githubusercontent.com/SeVin-DEV/Terminal-Ai/main/install-termux.sh | bash

set -e

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║           Terminal-Ai Termux Installer v2.0              ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

log_step() { echo -e "${CYAN}[STEP]${NC} $1"; }
log_ok() { echo -e "${GREEN}[OK]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_err() { echo -e "${RED}[ERROR]${NC} $1"; }

# Step 1: Update packages
log_step "Updating Termux packages..."
pkg update -y && pkg upgrade -y
log_ok "Packages updated"

# Step 2: Install dependencies
log_step "Installing system dependencies..."
pkg install -y python nodejs-lts git tmux curl
log_ok "Dependencies installed"

# Step 3: Clone or update repo
log_step "Setting up Terminal-Ai..."
if [ -d "$HOME/Terminal-Ai" ]; then
    log_warn "Existing installation found, updating..."
    cd "$HOME/Terminal-Ai"
    git pull || true
else
    git clone https://github.com/SeVin-DEV/Terminal-Ai.git "$HOME/Terminal-Ai"
    cd "$HOME/Terminal-Ai"
fi
log_ok "Repository ready"

# Step 4: Install Python dependencies
log_step "Installing Python packages..."
pip install --upgrade pip
pip install fastapi==0.95.2 pydantic==1.10.13 uvicorn httpx python-dotenv
log_ok "Python packages installed"

# Step 5: Install frontend dependencies
log_step "Installing frontend packages..."
cd "$HOME/Terminal-Ai/frontend"
npm install --legacy-peer-deps 2>/dev/null || npm install
cd "$HOME/Terminal-Ai"
log_ok "Frontend packages installed"

# Step 6: Create .env if not exists
log_step "Configuring environment..."
if [ ! -f "$HOME/Terminal-Ai/backend/.env" ]; then
    cat > "$HOME/Terminal-Ai/backend/.env" << 'EOF'
# Terminal-Ai Backend Config
STORAGE_TYPE=json
DATA_DIR=/data/data/com.termux/files/home/Terminal-Ai/backend/data
DB_NAME=termuxai
EOF
fi
log_ok "Environment configured"

# Step 7: Create management scripts
log_step "Creating management scripts..."

# Start script
cat > "$HOME/Terminal-Ai/start.sh" << 'STARTEOF'
#!/data/data/com.termux/files/usr/bin/bash
cd "$(dirname "$0")"

echo "Starting Terminal-Ai..."

# Acquire wake lock
termux-wake-lock 2>/dev/null || true

# Kill existing sessions
tmux kill-session -t termuxai-backend 2>/dev/null || true
tmux kill-session -t termuxai-frontend 2>/dev/null || true
sleep 1

# Start backend
tmux new-session -d -s termuxai-backend "cd $HOME/Terminal-Ai/backend && while true; do echo '=== Backend Starting ===' && uvicorn server:app --host 0.0.0.0 --port 8000 --reload; echo 'Restarting in 3s...'; sleep 3; done"

# Wait for backend
sleep 3

# Start frontend
tmux new-session -d -s termuxai-frontend "cd $HOME/Terminal-Ai/frontend && EXPO_PUBLIC_BACKEND_URL=http://127.0.0.1:8000 npx expo start --web --host 0.0.0.0 --port 19006"

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║              Terminal-Ai Started!                        ║"
echo "╠══════════════════════════════════════════════════════════╣"
echo "║  Backend:  http://127.0.0.1:8000                         ║"
echo "║  Frontend: http://127.0.0.1:19006                        ║"
echo "║                                                          ║"
echo "║  View logs:                                              ║"
echo "║    tmux attach -t termuxai-backend                       ║"
echo "║    tmux attach -t termuxai-frontend                      ║"
echo "║                                                          ║"
echo "║  Stop: ~/Terminal-Ai/stop.sh                             ║"
echo "╚══════════════════════════════════════════════════════════╝"
STARTEOF
chmod +x "$HOME/Terminal-Ai/start.sh"

# Stop script
cat > "$HOME/Terminal-Ai/stop.sh" << 'STOPEOF'
#!/data/data/com.termux/files/usr/bin/bash
echo "Stopping Terminal-Ai..."
tmux kill-session -t termuxai-backend 2>/dev/null || true
tmux kill-session -t termuxai-frontend 2>/dev/null || true
termux-wake-unlock 2>/dev/null || true
echo "Terminal-Ai stopped."
STOPEOF
chmod +x "$HOME/Terminal-Ai/stop.sh"

# Status script
cat > "$HOME/Terminal-Ai/status.sh" << 'STATUSEOF'
#!/data/data/com.termux/files/usr/bin/bash
echo "Terminal-Ai Status:"
echo ""

if tmux has-session -t termuxai-backend 2>/dev/null; then
    echo "  Backend:  RUNNING (tmux attach -t termuxai-backend)"
    curl -s http://127.0.0.1:8000/api/health 2>/dev/null && echo "    API: OK" || echo "    API: Starting..."
else
    echo "  Backend:  STOPPED"
fi

if tmux has-session -t termuxai-frontend 2>/dev/null; then
    echo "  Frontend: RUNNING (tmux attach -t termuxai-frontend)"
else
    echo "  Frontend: STOPPED"
fi

echo ""
echo "Start: ~/Terminal-Ai/start.sh"
echo "Stop:  ~/Terminal-Ai/stop.sh"
STATUSEOF
chmod +x "$HOME/Terminal-Ai/status.sh"

# Auto-start on Termux:Boot
mkdir -p "$HOME/.termux/boot"
cat > "$HOME/.termux/boot/termuxai" << 'BOOTEOF'
#!/data/data/com.termux/files/usr/bin/bash
sleep 5
cd ~/Terminal-Ai && ./start.sh
BOOTEOF
chmod +x "$HOME/.termux/boot/termuxai"

log_ok "Management scripts created"

# Step 8: Done
echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║           Installation Complete!                         ║"
echo "╠══════════════════════════════════════════════════════════╣"
echo "║                                                          ║"
echo "║  Start:  ~/Terminal-Ai/start.sh                          ║"
echo "║  Stop:   ~/Terminal-Ai/stop.sh                           ║"
echo "║  Status: ~/Terminal-Ai/status.sh                         ║"
echo "║                                                          ║"
echo "║  Auto-start: Install Termux:Boot app from F-Droid       ║"
echo "║                                                          ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

read -p "Start Terminal-Ai now? (y/n) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    "$HOME/Terminal-Ai/start.sh"
fi
