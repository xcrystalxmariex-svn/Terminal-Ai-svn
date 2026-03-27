# 📱 Terminal-Ai

AI-powered terminal assistant for Android (Termux) with full bash execution, file management, multi-provider LLM support, and **live voice chat**.

## ✨ Features

- **🤖 Multi-Provider AI**: OpenAI, Anthropic Claude, Google Gemini, Nvidia NIM, or any OpenAI-compatible API
- **⚡ Grounding Loop**: AI executes bash commands and sees real output (stdout/stderr feedback)
- **🔧 Universal Tool Dispatcher**: MCP-style JSON tool calls for file operations
- **💻 Full PTY Terminal**: Real terminal emulator via WebSocket
- **📁 File Browser**: Navigate, read, write, delete files
- **🎨 Themes**: Cyberpunk Void, Monokai Pro, Dracula
- **📱 Termux Optimized**: Runs entirely on Android
- **🎙️ Live Voice Chat**: Phone-call style hands-free conversation with natural AI voices

---

## 🚀 First-Time Termux Setup (Complete Guide)

### Prerequisites
- Android device (tested on Pixel 3 XL)
- [Termux app from F-Droid](https://f-droid.org/en/packages/com.termux/) (NOT Play Store version)
- Optional: [Termux:Boot](https://f-droid.org/en/packages/com.termux.boot/) for auto-start

### Step 1: Install Termux
1. Download Termux from **F-Droid** (Play Store version is outdated)
2. Open Termux and grant storage permission when prompted

### Step 2: Initial Termux Setup
```bash
# Update package lists and upgrade existing packages
pkg update && pkg upgrade -y

# Install required system packages
pkg install -y python nodejs-lts git tmux curl

# Grant Termux access to storage (for file browser)
termux-setup-storage
```

### Step 3: Clone Terminal-Ai
```bash
# Clone the repository
git clone https://github.com/SeVin-DEV/Terminal-Ai.git ~/Terminal-Ai
cd ~/Terminal-Ai
```

### Step 4: Install Python Dependencies
```bash
# IMPORTANT: Do NOT use pip install -r requirements.txt
# Termux requires specific versions to avoid Rust build errors

pip install fastapi==0.95.2 pydantic==1.10.13 uvicorn httpx python-dotenv edge-tts
```

### Step 5: Install Frontend Dependencies
```bash
cd ~/Terminal-Ai/frontend
npm install --legacy-peer-deps
cd ..
```

### Step 6: Create Environment File
```bash
# Create backend .env file
cat > ~/Terminal-Ai/backend/.env << 'EOF'
STORAGE_TYPE=json
DATA_DIR=/data/data/com.termux/files/home/Terminal-Ai/backend/data
DB_NAME=termuxai
EOF
```

### Step 7: Start Terminal-Ai
```bash
# Make scripts executable
chmod +x ~/Terminal-Ai/*.sh

# Start the app
~/Terminal-Ai/start.sh
```

### Step 8: Access the App
- Open browser on your phone: `http://127.0.0.1:8081`
- Or from another device on same WiFi: `http://<PHONE_IP>:8081`
- Find your phone IP: `ip addr show wlan0 | grep 'inet '`

---

## 🔄 One-Line Install (After Termux Setup)

If you already have Termux set up with packages:

```bash
curl -sSL https://raw.githubusercontent.com/SeVin-DEV/Terminal-Ai/main/install-termux.sh | bash
```

---

## 📦 Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Termux (Android)                  │
│  ┌──────────────────┐    ┌────────────────────────┐ │
│  │  tmux: backend   │    │   tmux: frontend       │ │
│  │  uvicorn :8000   │◄──►│   react-scripts :8081  │ │
│  │                  │    │                        │ │
│  │  • AI Chat API   │    │   • Terminal View      │ │
│  │  • Grounding     │    │   • Agent Chat         │ │
│  │  • Tool Dispatch │    │   • File Browser       │ │
│  │  • TTS Engine    │    │   • Settings           │ │
│  │  • WebSocket PTY │    │   • Voice Chat         │ │
│  └──────────────────┘    └────────────────────────┘ │
│                  │                                   │
│                  ▼                                   │
│         Browser: http://127.0.0.1:8081              │
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

### Settings Tabs

1. **AI Provider** - Select provider, enter API key, endpoint, model
2. **Nvidia NIM** - Dedicated NIM configuration with quick-select models
3. **Voice** - Enable voice output, select AI voice, adjust speech rate

---

## 🎙️ Voice Chat

### Live Chat Mode
1. Go to **Agent** tab
2. Click **Live Chat** button (phone icon)
3. Speak naturally - your words appear in real-time
4. After 2 seconds of silence, message auto-sends
5. AI responds and speaks aloud
6. Click **End Call** to exit

### Voice Settings
- **18+ natural voices** (Microsoft Edge TTS - free)
- Male/female options from US, UK, Australia
- Adjustable speech rate (-20% to +30%)
- Test voice before selecting

---

## 🏃 Management Commands

```bash
# Start services
~/Terminal-Ai/start.sh

# Stop services
~/Terminal-Ai/stop.sh

# Check status
~/Terminal-Ai/status.sh

# View backend logs
tmux attach -t termuxai-backend

# View frontend logs
tmux attach -t termuxai-frontend

# Detach from tmux: Ctrl+B, then D
```

---

## 🔄 Changelog

### v2.1.0 (Latest) - Voice Chat Update

- **Live Voice Chat** - Phone-call style hands-free conversation
- **Voice Input** - Browser Web Speech API (free, offline)
- **Voice Output** - Edge TTS with 18+ natural Microsoft voices
- **Voice Settings Tab** - Voice selection, speech rate, test button

### v2.0.0 - Core Features

- **Grounding Loop** - AI executes bash and sees output
- **Tool Dispatcher** - MCP-style tool calls
- **Nvidia NIM** - Full provider support
- **Dynamic Config** - Override settings per-request
- **WebSocket Reconnect** - Exponential backoff

---

## 🐛 Troubleshooting

### "pip install" fails with Rust errors
```bash
# Use specific versions that don't require Rust
pip install fastapi==0.95.2 pydantic==1.10.13

# Or if you must build from source:
pkg install rust clang cmake ninja
export ANDROID_API_LEVEL=24
```

### Frontend won't start
```bash
# Clear npm cache and reinstall
cd ~/Terminal-Ai/frontend
rm -rf node_modules package-lock.json
npm install --legacy-peer-deps
```

### WebSocket disconnects
- Check backend is running: `curl http://localhost:8000/api/health`
- Backend auto-restarts on crash (tmux loop)
- Try refreshing browser

### Voice input not working
- Grant microphone permission to browser
- Use Chrome/Chromium (best Web Speech API support)
- Check that HTTPS or localhost is used

### Can't access from other devices
```bash
# Find your phone's IP
ip addr show wlan0 | grep 'inet '

# Access from: http://<PHONE_IP>:8081
# Make sure devices are on same WiFi
```

---

## 📁 File Structure

```
Terminal-Ai/
├── backend/
│   ├── server.py              # FastAPI server + TTS + Grounding
│   ├── requirements.txt       # Standard deps
│   ├── requirements-termux.txt # Termux-specific deps
│   ├── .env                   # Environment config
│   └── data/                  # JSON storage (auto-created)
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Terminal.js    # Terminal view
│   │   │   ├── Agent.js       # AI chat + voice
│   │   │   ├── Files.js       # File browser
│   │   │   └── Settings.js    # Settings (3 tabs)
│   │   ├── contexts/
│   │   │   └── ThemeContext.js
│   │   └── config.js          # API endpoints
│   └── package.json
├── start.sh                   # Start both services
├── stop.sh                    # Stop services
├── status.sh                  # Check status
├── install-termux.sh          # One-line installer
└── README.md
```

---

## 🔌 API Reference

### Chat
```bash
curl -X POST http://localhost:8000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"content": "list files"}'
```

### Text-to-Speech
```bash
# Get available voices
curl http://localhost:8000/api/tts/voices

# Generate speech
curl -X POST http://localhost:8000/api/tts/speak \
  -H "Content-Type: application/json" \
  -d '{"text": "Hello world", "voice": "en-US-AriaNeural"}'
```

### Grounding
```bash
curl -X POST http://localhost:8000/api/grounding/execute \
  -H "Content-Type: application/json" \
  -d '{"command": "ls -la", "timeout": 10}'
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
