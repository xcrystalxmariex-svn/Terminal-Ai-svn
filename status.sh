#!/bin/bash
# Terminal-Ai-svn Status Script

echo "Terminal-Ai-svn Status:"
echo ""

if [ -d "/data/data/com.termux" ]; then
    # Termux environment
    if tmux has-session -t termuxai-backend 2>/dev/null; then
        echo "  Backend:  RUNNING (tmux attach -t termuxai-backend)"
        health=$(curl -s http://127.0.0.1:8000/api/health 2>/dev/null)
        if [ -n "$health" ]; then
            echo "    API: OK"
        else
            echo "    API: Starting..."
        fi
    else
        echo "  Backend:  STOPPED"
    fi
    
    if tmux has-session -t termuxai-frontend 2>/dev/null; then
        echo "  Frontend: RUNNING (tmux attach -t termuxai-frontend)"
        echo "    Access: http://127.0.0.1:8081"
    else
        echo "  Frontend: STOPPED"
    fi
else
    echo "This script is optimized for Termux."
fi

echo ""
echo "Start: ./start.sh"
echo "Stop:  ./stop.sh"
