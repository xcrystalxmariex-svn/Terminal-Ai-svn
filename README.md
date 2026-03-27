# 📱 Terminal-Ai

AI-powered terminal assistant for Android (Termux) with full bash execution, file management, and multi-provider LLM support.

## ✨ Features

- **🤖 Multi-Provider AI**: OpenAI, Anthropic Claude, Google Gemini, Nvidia NIM, or any OpenAI-compatible API
- **⚡ Grounding Loop**: AI executes bash commands and sees real output (stdout/stderr feedback)
- **🔧 Universal Tool Dispatcher**: MCP-style JSON tool calls for file operations
- **💻 Full PTY Terminal**: Real terminal emulator via WebSocket
- **📁 File Browser**: Navigate, read, write, delete files
- **🎨 Themes**: Cyberpunk Void, Monokai Pro, Dracula
- **📱 Termux Optimized**: Runs entirely on Android

---

## 🚀 Quick Start (Termux)

### One-Line Install

```bash
curl -sSL https://raw.githubusercontent.com/SeVin-DEV/Terminal-Ai/main/install-termux.sh | bash
```

### Manual Install

```bash
# 1. Install system packages
pkg update && pkg upgrade -y
pkg install python nodejs-lts git tmux

# 2. Clone repo
git clone https://github.com/SeVin-DEV/Terminal-Ai.git ~/Terminal-Ai
cd ~/Terminal-Ai

# 3. Install Python deps (MANUAL - not pip install -r)
pip install fastapi==0.95.2 pydantic==1.10.13 uvicorn httpx python-dotenv

# 4. Install frontend deps
cd frontend && npm install && cd ..

# 5. Start services
./start.sh
```

---

## 📦 Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Termux (Android)                  │
│  ┌──────────────────┐    ┌────────────────────────┐ │
│  │  tmux: backend   │    │   tmux: frontend       │ │
│  │  uvicorn :8000   │◄──►│   expo web :19006      │ │
│  │                  │    │                        │ │
│  │  • AI Chat API   │    │   • Terminal View      │ │
│  │  • Grounding     │    │   • Agent Chat         │ │
│  │  • Tool Dispatch │    │   • File Browser       │ │
│  │  • File API      │    │   • Settings           │ │
│  │  • WebSocket PTY │    │                        │ │
│  └──────────────────┘    └────────────────────────┘ │
│                  │                                   │
│                  ▼                                   │
│         Browser: http://127.0.0.1:19006             │
└─────────────────────────────────────────────────────┘
```

---

## 🛠️ Configuration

### AI Providers

| Provider | Endpoint | Model Example |
|----------|----------|---------------|
| OpenAI | `https://api.openai.com/v1/chat/completions` | `gpt-4o` |
| Anthropic | `https://api.anthropic.com/v1/messages` | `claude-sonnet-4-20250514` |
| Google | `https://generativelanguage.googleapis.com/v1beta` | `gemini-2.0-flash` |
| **Nvidia NIM** | `https://integrate.api.nvidia.com/v1/chat/completions` | `meta/llama-3.1-70b-instruct` |
| OpenAI Compatible | Your endpoint | Your model |

### Settings UI

Access Settings tab to configure:
- AI Provider & API Key
- **NIM API Key** (separate tab)
- Agent Name & System Prompt
- Theme
- Auto-Execute toggle

---

## 🔄 Changelog

### v2.0.0 (Latest)

#### ✅ Completed Tasks

1. **Grounding Loop Interceptor** (`server.py`)
   - Executes bash code blocks from AI responses
   - Captures stdout/stderr and feeds back to model
   - Configurable timeout per command

2. **Universal Tool Dispatcher** (`server.py`)
   - Parses MCP-style JSON tool calls: `{"tool": "...", "arguments": {...}}`
   - Available tools: `bash`, `read_file`, `write_file`, `list_files`, `browser`
   - Extensible handler system

3. **Nvidia NIM Provider** (`server.py`)
   - Full NIM API integration (OpenAI-compatible)
   - Separate NIM API key storage
   - Default endpoint: `https://integrate.api.nvidia.com/v1/chat/completions`
   - Default model: `meta/llama-3.1-70b-instruct`

4. **Dynamic `/chat` Config** (`server.py`)
   - Override `api_key`, `model`, `endpoint`, `provider` per-request
   - Useful for multi-tenant or testing scenarios

5. **NIM Settings Tab** (`settings.tsx`)
   - Dedicated NIM configuration section
   - NIM API key input (separate from main provider key)
   - NIM endpoint & model fields
   - Provider chip for quick selection

6. **WebSocket Reconnect Fix** (`terminal.tsx` / `terminal-html`)
   - Exponential backoff: 1s → 2s → 4s → ... → 30s max
   - Random jitter to prevent thundering herd
   - Max 10 reconnect attempts before giving up
   - Visual feedback: "[Reconnecting in Xs...]"

7. **Playwright/Browser MCP Stub** (`server.py`)
   - Tool handler placeholder for browser automation
   - Ready for full Playwright integration

#### 📝 Termux Compatibility Notes

- **Pydantic v1.10.13**: Pure Python, avoids Rust `pydantic-core` build
- **FastAPI v0.95.2**: Compatible with Pydantic v1
- **No MongoDB required**: JSON file storage fallback
- **PTY optional**: Graceful fallback to subprocess if PTY unavailable

---

## 🏃 Running

### Start Both Services

```bash
cd ~/Terminal-Ai
./start.sh
```

### Start Individually

**Backend:**
```bash
cd ~/Terminal-Ai/backend
uvicorn server:app --host 0.0.0.0 --port 8000 --reload
```

**Frontend:**
```bash
cd ~/Terminal-Ai/frontend
EXPO_PUBLIC_BACKEND_URL=http://127.0.0.1:8000 npx expo start --web --host 0.0.0.0
```

### Access

- **Same device**: `http://127.0.0.1:19006`
- **LAN access**: `http://<PHONE_IP>:19006`
  - Find IP: `ip addr show wlan0 | grep 'inet '`

---

## 🔧 API Reference

### Chat

```bash
# Basic chat
curl -X POST http://localhost:8000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"content": "list files in current directory"}'

# With dynamic config override
curl -X POST http://localhost:8000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "content": "hello",
    "provider": "nvidia_nim",
    "api_key": "nvapi-xxx",
    "model": "meta/llama-3.1-70b-instruct"
  }'
```

### Grounding (Direct Execution)

```bash
curl -X POST http://localhost:8000/api/grounding/execute \
  -H "Content-Type: application/json" \
  -d '{"command": "ls -la", "timeout": 10}'
```

### Tool Dispatch

```bash
curl -X POST http://localhost:8000/api/tools/dispatch \
  -H "Content-Type: application/json" \
  -d '{"tool": "read_file", "arguments": {"path": "/etc/hostname"}}'
```

### List Tools

```bash
curl http://localhost:8000/api/tools/list
```

---

## 🐛 Troubleshooting

### Rust/Maturin Build Errors

```bash
pkg install rust clang cmake ninja
export ANDROID_API_LEVEL=24
pip install --no-build-isolation pydantic==1.10.13
```

### WebSocket Connection Issues

- Check backend is running: `curl http://localhost:8000/api/health`
- Check firewall/network
- Try refreshing browser

### PTY Not Available

Server will fallback to subprocess execution. Full PTY requires proper Termux environment.

---

## 📁 File Structure

```
Terminal-Ai/
├── backend/
│   ├── server.py              # Main FastAPI server
│   ├── requirements.txt       # Standard deps
│   ├── requirements-termux.txt # Termux-specific deps
│   └── data/                  # JSON storage
├── frontend/
│   ├── app/
│   │   ├── (tabs)/
│   │   │   ├── terminal.tsx   # Terminal view
│   │   │   ├── agent.tsx      # AI chat
│   │   │   ├── files.tsx      # File browser
│   │   │   └── settings.tsx   # Settings (NIM tab)
│   │   └── ...
│   └── src/
│       ├── constants/themes.ts
│       └── contexts/ThemeContext.tsx
├── start.sh                   # Start script
├── stop.sh                    # Stop script
├── install-termux.sh          # One-line installer
└── README.md
```

---

## 🤝 Contributing

1. Fork the repo
2. Create feature branch
3. Test on Termux
4. Submit PR

---

## 📄 License

MIT
