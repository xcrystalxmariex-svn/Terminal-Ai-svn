#!/bin/bash
# Terminal-Ai Start Script

cd "$(dirname "$0")"

echo "Starting Terminal-Ai-svn..."

if [ -d "/data/data/com.termux" ]; then
    # Termux environment
    termux-wake-lock 2>/dev/null || true

    tmux kill-session -t termuxai-backend 2>/dev/null || true
    tmux kill-session -t termuxai-frontend 2>/dev/null || true
    sleep 1

    tmux new-session -d -s termuxai-backend "cd $HOME/Terminal-Ai-svn/backend && while true; do echo '=== Backend Starting ===' && uvicorn server:app --host 0.0.0.0 --port 8000 --reload; echo 'Restarting in 3s...'; sleep 3; done"
    sleep 3
    tmux new-session -d -s termuxai-frontend "cd $HOME/Terminal-Ai-svn/frontend && PORT=8081 npm start"

    echo ""
    echo "Terminal-Ai-svn Started!"
    echo "  Backend:  http://127.0.0.1:8000"
    echo "  Frontend: http://127.0.0.1:8081"
    echo ""
    echo "  View logs: tmux attach -t termuxai-backend"
    echo "  Stop: ./stop.sh"

else
    # Generic Linux (iSH, Alpine, etc.)
    SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

    # Kill any existing instances
    pkill -f "uvicorn server:app" 2>/dev/null || true
    pkill -f "npm start" 2>/dev/null || true
    sleep 1

    # Start backend in background
    echo "Starting backend..."
    cd "$SCRIPT_DIR/backend"
    nohup uvicorn server:app --host 0.0.0.0 --port 8000 --reload > "$SCRIPT_DIR/backend.log" 2>&1 &
    BACKEND_PID=$!
    echo "Backend PID: $BACKEND_PID"
    sleep 3

    # Start frontend in background
    echo "Starting frontend..."
    cd "$SCRIPT_DIR/frontend"
    PORT=8081 nohup npm start > "$SCRIPT_DIR/frontend.log" 2>&1 &
    FRONTEND_PID=$!
    echo "Frontend PID: $FRONTEND_PID"

    echo ""
    echo "Terminal-Ai-svn Started!"
    echo "  Backend:  http://127.0.0.1:8000"
    echo "  Frontend: http://127.0.0.1:8081"
    echo ""
    echo "  Backend log:  tail -f $SCRIPT_DIR/backend.log"
    echo "  Frontend log: tail -f $SCRIPT_DIR/frontend.log"
    echo "  Stop: kill $BACKEND_PID $FRONTEND_PID"
fi
