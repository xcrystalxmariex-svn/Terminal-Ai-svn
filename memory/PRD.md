# Terminal-Ai PRD

## Overview
AI-powered terminal assistant for Android (Termux) with full bash execution, file management, and multi-provider LLM support.

## Original Problem Statement
Implement all pending tasks for Terminal-Ai:
1. Grounding loop interceptor (catch bash blocks, execute in Termux, feed stdout/stderr back to model)
2. Universal Tool Dispatcher (parse bash blocks + JSON MCP tool calls, route to correct handler)
3. Nvidia NIM provider + dynamic `/chat` config (api_key, model, base_url in request body)
4. NIM API key tab + provider chip in settings
5. WebSocket reconnect fix (backoff loop, stop hammering)
6. Playwright/Chromium MCP backend integration stub
7. Fresh Termux reinstall instructions

## User Personas
- **Mobile Developer**: Runs AI coding assistant on Android phone via Termux
- **Power User**: Wants local AI terminal access without cloud dependency
- **Developer**: Testing AI agents with grounding capabilities

## Core Requirements
- Multi-provider AI support (OpenAI, Anthropic, Google, Nvidia NIM, Generic)
- Real terminal access via PTY/WebSocket
- File browser with read/write capabilities
- Grounding loop for AI to see command output
- MCP-style tool dispatch

## Architecture
```
Frontend (React/Expo) ←→ Backend (FastAPI) ←→ AI Providers
                           ↓
                      PTY Terminal
                           ↓
                    JSON/MongoDB Storage
```

## What's Been Implemented (Jan 27, 2026)

### Backend (server.py)
- ✅ Grounding Loop Interceptor - `execute_bash_grounded()` captures stdout/stderr
- ✅ Universal Tool Dispatcher - `ToolDispatcher` class with handlers for bash, read_file, write_file, list_files, browser
- ✅ Nvidia NIM Provider - Full support with dedicated fields
- ✅ Dynamic /chat config - Override provider, api_key, endpoint, model per-request
- ✅ Playwright/Browser MCP stub - Placeholder ready for expansion
- ✅ WebSocket reconnect fix - Exponential backoff in terminal-html endpoint
- ✅ **Edge TTS Integration** - /api/tts/voices and /api/tts/speak endpoints
- ✅ **Voice Config Storage** - voice_enabled, voice_id, voice_rate, voice_pitch, voice_auto_speak

### Frontend
- ✅ Terminal page with xterm.js and WebSocket reconnect backoff
- ✅ Agent page with chat, code block parsing, run buttons
- ✅ Files page with directory browsing and file editor
- ✅ Settings page with:
  - Theme selection (Cyberpunk Void, Monokai Pro, Dracula)
  - AI Provider tab (OpenAI, Anthropic, Google, NIM, Generic)
  - **Nvidia NIM tab** with dedicated API key, endpoint, model fields
  - Quick select buttons for NIM models
  - Agent name and system prompt
  - Auto-execute toggle
  - **Voice tab** with voice selection, rate controls, test button

### Voice Chat Features (NEW)
- ✅ **Live Chat Mode** - Phone-call style hands-free conversation
- ✅ **Voice Input** - Browser Web Speech API (free, offline)
- ✅ **Voice Output** - Edge TTS with 18+ natural Microsoft voices
- ✅ **Real-time Transcription** - Speech shown in input as you talk
- ✅ **Auto-send on Silence** - Sends message after 2s pause in Live mode
- ✅ **Visual Indicators** - LIVE badge, listening/speaking status

### Scripts & Documentation
- ✅ install-termux.sh - One-line installer for Termux
- ✅ start.sh, stop.sh, status.sh - Management scripts
- ✅ requirements-termux.txt - Termux-specific deps
- ✅ README.md - Full documentation with changelog

## API Endpoints
| Endpoint | Method | Description |
|----------|--------|-------------|
| /api/health | GET | Health check with version |
| /api/config | GET/POST | Config management |
| /api/chat | POST | AI chat with dynamic config |
| /api/chat/history | GET/DELETE | Chat history |
| /api/grounding/execute | POST | Execute command with grounding |
| /api/tools/dispatch | POST | MCP tool dispatch |
| /api/tools/list | GET | List available tools |
| /api/terminal/execute | POST | Send command to PTY |
| /api/ws/terminal | WS | Terminal WebSocket |
| /api/files | GET/DELETE | File browser |
| /api/files/read | GET | Read file |
| /api/files/write | POST | Write file |
| /api/tts/voices | GET | Get available TTS voices |
| /api/tts/speak | POST | Convert text to speech |

## Prioritized Backlog

### P0 (Critical) - DONE
- [x] Grounding loop
- [x] Tool dispatcher
- [x] NIM provider
- [x] WebSocket reconnect

### P1 (High)
- [ ] Full Playwright integration (requires playwright install)
- [ ] Streaming responses for long AI outputs
- [ ] MCP server mode for external tools

### P2 (Medium)
- [ ] Voice input/output
- [ ] Multi-file code editing
- [ ] Git integration

### P3 (Low)
- [ ] Plugin system
- [ ] Custom themes editor
- [ ] Session export/import

## Next Tasks
1. Test on actual Termux device
2. Add more NIM models to quick select
3. Implement streaming for chat responses
4. Add full Playwright browser automation
