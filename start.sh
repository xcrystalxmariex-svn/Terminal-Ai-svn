#!/bin/bash
# Terminal-Ai Start Script
# Optimized for Terminal-Ai-svn in Termux

cd "$(dirname "$0")"

echo "Starting Terminal-Ai-svn..."

# Detect environment
if [ -d "/data/data/com.termux" ]; then
    # Termux environment
    termux-wake-lock 2>/dev/null || true
    
    # Kill existing sessions
    tmux kill-session -t termuxai-backend 2>/dev/null || true
    tmux kill-session -t termuxai-frontend 2>/dev/null || true
    sleep 1
    
    # Start backend
    tmux new-session -d -s termuxai-backend "cd $HOME/Terminal-Ai-svn/backend && while true; do echo '=== Backend Starting ===' && uvicorn server:app --host 0.0.0.0 --port 8000 --reload; echo 'Restarting in 3s...'; sleep 3; done"
    
    # Wait for backend
    sleep 3
    
    # Start frontend
    tmux new-session -d -s termuxai-frontend "cd $HOME/Terminal-Ai-svn/frontend && PORT=8081 npm start"
    
    echo ""
    echo "Terminal-Ai-svn Started!"
    echo "  Backend:  http://127.0.0.1:8000"
    echo "  Frontend: http://127.0.0.1:8081"
    echo ""
    echo "  View logs: tmux attach -t termuxai-backend"
    echo "  Stop: ./stop.sh"
else
    echo "This script is optimized for Termux."
    echo "For standard Linux, please update the paths in this script."
fi
