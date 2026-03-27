#!/bin/bash
# Terminal-Ai Stop Script

echo "Stopping Terminal-Ai..."

if [ -d "/data/data/com.termux" ]; then
    # Termux environment
    tmux kill-session -t termuxai-backend 2>/dev/null || true
    tmux kill-session -t termuxai-frontend 2>/dev/null || true
    termux-wake-unlock 2>/dev/null || true
    echo "Terminal-Ai stopped."
else
    echo "Use supervisor to manage services:"
    echo "  sudo supervisorctl stop backend frontend"
fi
