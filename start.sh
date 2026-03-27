#!/bin/bash
# Terminal-Ai Start Script
# Works on both Termux and standard Linux

cd "$(dirname "$0")"

echo "Starting Terminal-Ai..."

# Detect environment
if [ -d "/data/data/com.termux" ]; then
    # Termux environment
    termux-wake-lock 2>/dev/null || true
    
    # Kill existing sessions
    tmux kill-session -t termuxai-backend 2>/dev/null || true
    tmux kill-session -t termuxai-frontend 2>/dev/null || true
    sleep 1
    
    # Start backend
    tmux new-session -d -s termuxai-backend "cd ~/Terminal-Ai/backend && while true; do echo '=== Backend Starting ===' && uvicorn server:app --host 0.0.0.0 --port 8000 --reload; echo 'Restarting in 3s...'; sleep 3; done"
    
    # Wait for backend
    sleep 3
    
    # Start frontend
    tmux new-session -d -s termuxai-frontend "cd ~/Terminal-Ai/frontend && EXPO_PUBLIC_BACKEND_URL=http://127.0.0.1:8000 npx expo start --web --host 0.0.0.0 --port 19006"
    
    echo ""
    echo "Terminal-Ai Started!"
    echo "  Backend:  http://127.0.0.1:8000"
    echo "  Frontend: http://127.0.0.1:19006"
    echo ""
    echo "  View logs: tmux attach -t termuxai-backend"
    echo "  Stop: ./stop.sh"
else
    # Standard Linux/Docker environment
    echo "Use supervisor to manage services:"
    echo "  sudo supervisorctl restart backend frontend"
    echo "  sudo supervisorctl status"
fi
