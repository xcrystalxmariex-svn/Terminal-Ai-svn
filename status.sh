#!/bin/bash
# Terminal-Ai Status Script

echo "Terminal-Ai Status:"
echo ""

if [ -d "/data/data/com.termux" ]; then
    # Termux environment
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
else
    # Standard Linux/Docker environment
    sudo supervisorctl status 2>/dev/null || echo "Supervisor not available"
fi

echo ""
echo "Start: ./start.sh"
echo "Stop:  ./stop.sh"
