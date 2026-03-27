"""
Terminal-Ai Backend Server
Termux-optimized FastAPI server with:
- Grounding Loop Interceptor (bash execution + feedback)
- Universal Tool Dispatcher (bash + MCP JSON routing)
- Multi-provider AI support (OpenAI, Anthropic, Google, Nvidia NIM, Generic)
- Dynamic /chat config (api_key, model, base_url in request body)
- JSON file storage (MongoDB-compatible async interface)
- PTY Terminal with WebSocket
- File browser API
"""

from fastapi import FastAPI, APIRouter, WebSocket, WebSocketDisconnect, Request
from fastapi.responses import JSONResponse, HTMLResponse, PlainTextResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
import os
import logging
import json
import subprocess
import asyncio
import threading
import re
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone
import httpx

# Optional PTY imports (may not work on all systems)
try:
    import pty
    import fcntl
    import struct
    import termios
    import select
    import signal
    PTY_AVAILABLE = True
except ImportError:
    PTY_AVAILABLE = False

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# ===== JSON File Storage (MongoDB-compatible async interface) =====

class _JDoc:
    def __init__(self, path):
        self._path = Path(path)
        self._path.parent.mkdir(parents=True, exist_ok=True)
        self._lock = threading.Lock()

    def _read(self):
        if self._path.exists():
            try:
                return json.loads(self._path.read_text())
            except Exception:
                return []
        return []

    def _write(self, data):
        self._path.write_text(json.dumps(data, default=str, indent=2))

    def _match(self, doc, filt):
        return all(doc.get(k) == v for k, v in filt.items()) if filt else True

    def _clean(self, doc):
        return {k: v for k, v in doc.items() if k != '_id'}

    async def find_one(self, filt=None, proj=None):
        filt = filt or {}
        for d in self._read():
            if self._match(d, filt):
                return self._clean(d)
        return None

    async def insert_one(self, doc):
        with self._lock:
            data = self._read()
            data.append(self._clean(doc))
            self._write(data)

    async def update_one(self, filt, update, upsert=False):
        with self._lock:
            data = self._read()
            filt = filt or {}
            for i, d in enumerate(data):
                if self._match(d, filt):
                    if '$set' in update:
                        data[i].update(update['$set'])
                    self._write(data)
                    return
            if upsert and '$set' in update:
                data.append(update['$set'])
                self._write(data)

    async def delete_many(self, filt=None):
        with self._lock:
            if not filt:
                self._write([])
            else:
                data = [d for d in self._read() if not self._match(d, filt)]
                self._write(data)

    def find(self, filt=None, proj=None):
        filt = filt or {}
        return _JCursor([self._clean(d) for d in self._read() if self._match(d, filt)])


class _JCursor:
    def __init__(self, data):
        self._data = data

    def sort(self, key, direction=1):
        self._data.sort(key=lambda x: x.get(key, ''), reverse=(direction == -1))
        return self

    def limit(self, n):
        self._data = self._data[:n]
        return self

    async def to_list(self, length=None):
        return self._data[:length] if length else self._data


class _JDB:
    def __init__(self, data_dir):
        self._dir = Path(data_dir)
        self._dir.mkdir(parents=True, exist_ok=True)

    def __getattr__(self, name):
        return _JDoc(self._dir / f"{name}.json")


# ===== Auto-detect storage backend =====
STORAGE_TYPE = 'json'
client = None

try:
    mongo_url = os.environ.get('MONGO_URL', '')
    if mongo_url:
        from motor.motor_asyncio import AsyncIOMotorClient
        client = AsyncIOMotorClient(mongo_url)
        db = client[os.environ.get('DB_NAME', 'termuxai')]
        STORAGE_TYPE = 'mongodb'
    else:
        raise KeyError("No MONGO_URL")
except (ImportError, KeyError, Exception):
    data_dir = os.environ.get('DATA_DIR', str(ROOT_DIR / 'data'))
    db = _JDB(data_dir)
    STORAGE_TYPE = 'json'

app = FastAPI(title="Terminal-Ai", version="2.0.0")
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ===== Pydantic Models =====

class AppConfigCreate(BaseModel):
    provider: str
    api_key: str = ""
    endpoint: str = ""
    model: str = ""
    agent_name: Optional[str] = "TermuxAI"
    system_prompt: Optional[str] = ""
    theme: str = "cyberpunk_void"
    auto_execute: bool = False
    # NIM-specific fields
    nim_api_key: Optional[str] = ""
    nim_endpoint: Optional[str] = "https://integrate.api.nvidia.com/v1/chat/completions"
    nim_model: Optional[str] = "meta/llama-3.1-70b-instruct"


class ChatMessageCreate(BaseModel):
    content: str
    # Dynamic config override (optional)
    provider: Optional[str] = None
    api_key: Optional[str] = None
    endpoint: Optional[str] = None
    model: Optional[str] = None


class TerminalExecuteRequest(BaseModel):
    command: str
    timeout: Optional[int] = 30


class FileWriteRequest(BaseModel):
    path: str
    content: str


class MkdirRequest(BaseModel):
    path: str


class MCPToolCall(BaseModel):
    """MCP-style tool call structure"""
    tool: str
    arguments: Dict[str, Any] = {}


class GroundingResult(BaseModel):
    """Result from grounding loop execution"""
    command: str
    stdout: str
    stderr: str
    exit_code: int
    executed_at: str


# ===== Terminal Session (PTY-based) =====

class TerminalSession:
    def __init__(self):
        self.master_fd = None
        self.pid = None
        self.clients: set = set()
        self.history_buffer: List[str] = []
        self.max_history = 2000
        self._running = False
        self._read_task = None
        self._save_task = None

    def start(self):
        if not PTY_AVAILABLE:
            logger.warning("PTY not available on this system")
            return
        if self._running:
            return
        self.master_fd, slave_fd = pty.openpty()
        winsize = struct.pack('HHHH', 30, 120, 0, 0)
        fcntl.ioctl(self.master_fd, termios.TIOCSWINSZ, winsize)

        self.pid = os.fork()
        if self.pid == 0:
            os.close(self.master_fd)
            os.setsid()
            fcntl.ioctl(slave_fd, termios.TIOCSCTTY, 0)
            os.dup2(slave_fd, 0)
            os.dup2(slave_fd, 1)
            os.dup2(slave_fd, 2)
            if slave_fd > 2:
                os.close(slave_fd)
            env = os.environ.copy()
            env['TERM'] = 'xterm-256color'
            env['HOME'] = os.environ.get('HOME', '/data/data/com.termux/files/home')
            shell = os.environ.get('SHELL', '/bin/bash')
            os.execvpe(shell, [shell, '--login'], env)
        else:
            os.close(slave_fd)
            flags = fcntl.fcntl(self.master_fd, fcntl.F_GETFL)
            fcntl.fcntl(self.master_fd, fcntl.F_SETFL, flags | os.O_NONBLOCK)
            self._running = True

    async def start_reading(self):
        if self._read_task is None or self._read_task.done():
            self._read_task = asyncio.create_task(self._read_loop())
        if self._save_task is None or self._save_task.done():
            self._save_task = asyncio.create_task(self._periodic_save())

    async def restore_session(self):
        try:
            saved = await db.terminal_session.find_one({}, {"_id": 0})
            if saved and saved.get("buffer"):
                self.history_buffer = saved["buffer"][-self.max_history:]
                logger.info(f"Restored terminal session ({len(self.history_buffer)} chunks)")
        except Exception as e:
            logger.error(f"Failed to restore session: {e}")

    async def _periodic_save(self):
        while self._running:
            try:
                await asyncio.sleep(30)
                if self.history_buffer:
                    await db.terminal_session.update_one(
                        {},
                        {"$set": {
                            "buffer": self.history_buffer[-self.max_history:],
                            "updated_at": datetime.now(timezone.utc).isoformat(),
                        }},
                        upsert=True,
                    )
            except Exception as e:
                logger.error(f"Failed to save session: {e}")

    async def save_now(self):
        try:
            if self.history_buffer:
                await db.terminal_session.update_one(
                    {},
                    {"$set": {
                        "buffer": self.history_buffer[-self.max_history:],
                        "updated_at": datetime.now(timezone.utc).isoformat(),
                    }},
                    upsert=True,
                )
        except Exception:
            pass

    async def _read_loop(self):
        if not PTY_AVAILABLE:
            return
        loop = asyncio.get_event_loop()
        while self._running:
            try:
                data = await loop.run_in_executor(None, self._read)
                if data:
                    text = data.decode('utf-8', errors='replace')
                    self.history_buffer.append(text)
                    if len(self.history_buffer) > self.max_history:
                        self.history_buffer = self.history_buffer[-self.max_history:]
                    disconnected = set()
                    for ws in self.clients:
                        try:
                            await ws.send_text(text)
                        except Exception:
                            disconnected.add(ws)
                    self.clients -= disconnected
            except Exception:
                if self._running:
                    await asyncio.sleep(0.01)

    def _read(self):
        if not PTY_AVAILABLE or self.master_fd is None:
            return None
        try:
            r, _, _ = select.select([self.master_fd], [], [], 0.1)
            if r:
                return os.read(self.master_fd, 4096)
        except (OSError, ValueError):
            pass
        return None

    def write(self, data: str):
        if PTY_AVAILABLE and self.master_fd is not None:
            try:
                os.write(self.master_fd, data.encode('utf-8'))
            except OSError:
                pass

    def resize(self, rows: int, cols: int):
        if PTY_AVAILABLE and self.master_fd is not None:
            try:
                winsize = struct.pack('HHHH', rows, cols, 0, 0)
                fcntl.ioctl(self.master_fd, termios.TIOCSWINSZ, winsize)
            except OSError:
                pass

    def get_history(self, chars=5000):
        history = ''.join(self.history_buffer)
        return history[-chars:] if len(history) > chars else history

    def stop(self):
        self._running = False
        if self.pid:
            try:
                os.kill(self.pid, signal.SIGTERM)
                os.waitpid(self.pid, os.WNOHANG)
            except Exception:
                pass
        if self.master_fd is not None:
            try:
                os.close(self.master_fd)
            except Exception:
                pass


terminal = TerminalSession()

# ===== Grounding Loop Interceptor =====

async def execute_bash_grounded(command: str, timeout: int = 30) -> GroundingResult:
    """
    Execute a bash command and capture stdout/stderr for grounding.
    This feeds real terminal output back to the AI model.
    """
    try:
        proc = await asyncio.create_subprocess_shell(
            command,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            cwd=os.environ.get('HOME', '/data/data/com.termux/files/home'),
            env={**os.environ, 'TERM': 'xterm-256color'}
        )
        try:
            stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=timeout)
            exit_code = proc.returncode or 0
        except asyncio.TimeoutError:
            proc.kill()
            stdout, stderr = b"", b"Command timed out"
            exit_code = -1
        
        return GroundingResult(
            command=command,
            stdout=stdout.decode('utf-8', errors='replace')[:10000],
            stderr=stderr.decode('utf-8', errors='replace')[:5000],
            exit_code=exit_code,
            executed_at=datetime.now(timezone.utc).isoformat()
        )
    except Exception as e:
        return GroundingResult(
            command=command,
            stdout="",
            stderr=str(e),
            exit_code=-1,
            executed_at=datetime.now(timezone.utc).isoformat()
        )


def parse_code_blocks(text: str) -> List[str]:
    """Extract bash/shell code blocks from AI response"""
    commands = []
    pattern = r'```(?:bash|shell|sh)\n([\s\S]*?)```'
    matches = re.findall(pattern, text)
    for match in matches:
        cmd = match.strip()
        if cmd:
            commands.append(cmd)
    return commands


def parse_mcp_tool_calls(text: str) -> List[MCPToolCall]:
    """
    Parse MCP-style JSON tool calls from AI response.
    Format: ```json\n{"tool": "tool_name", "arguments": {...}}\n```
    """
    tool_calls = []
    pattern = r'```json\n([\s\S]*?)```'
    matches = re.findall(pattern, text)
    for match in matches:
        try:
            data = json.loads(match.strip())
            if 'tool' in data:
                tool_calls.append(MCPToolCall(
                    tool=data['tool'],
                    arguments=data.get('arguments', {})
                ))
        except json.JSONDecodeError:
            continue
    return tool_calls


# ===== Universal Tool Dispatcher =====

class ToolDispatcher:
    """Routes tool calls to appropriate handlers"""
    
    def __init__(self):
        self.handlers = {
            'bash': self._handle_bash,
            'execute': self._handle_bash,
            'read_file': self._handle_read_file,
            'write_file': self._handle_write_file,
            'list_files': self._handle_list_files,
            'browser': self._handle_browser,
            'playwright': self._handle_browser,
        }
    
    async def dispatch(self, tool_call: MCPToolCall) -> Dict[str, Any]:
        """Dispatch a tool call to its handler"""
        handler = self.handlers.get(tool_call.tool.lower())
        if handler:
            return await handler(tool_call.arguments)
        return {"error": f"Unknown tool: {tool_call.tool}", "available_tools": list(self.handlers.keys())}
    
    async def _handle_bash(self, args: Dict[str, Any]) -> Dict[str, Any]:
        """Execute bash command"""
        command = args.get('command', '')
        timeout = args.get('timeout', 30)
        if not command:
            return {"error": "No command provided"}
        result = await execute_bash_grounded(command, timeout)
        return result.dict()
    
    async def _handle_read_file(self, args: Dict[str, Any]) -> Dict[str, Any]:
        """Read file contents"""
        path = args.get('path', '')
        if not path:
            return {"error": "No path provided"}
        try:
            resolved = Path(path).resolve()
            if not resolved.exists():
                return {"error": "File not found"}
            content = resolved.read_text(encoding='utf-8', errors='replace')
            return {"path": str(resolved), "content": content[:50000]}
        except Exception as e:
            return {"error": str(e)}
    
    async def _handle_write_file(self, args: Dict[str, Any]) -> Dict[str, Any]:
        """Write file contents"""
        path = args.get('path', '')
        content = args.get('content', '')
        if not path:
            return {"error": "No path provided"}
        try:
            resolved = Path(path).resolve()
            resolved.parent.mkdir(parents=True, exist_ok=True)
            resolved.write_text(content, encoding='utf-8')
            return {"success": True, "path": str(resolved)}
        except Exception as e:
            return {"error": str(e)}
    
    async def _handle_list_files(self, args: Dict[str, Any]) -> Dict[str, Any]:
        """List directory contents"""
        path = args.get('path', '.')
        try:
            resolved = Path(path).resolve()
            if not resolved.is_dir():
                return {"error": "Not a directory"}
            items = []
            for entry in sorted(resolved.iterdir()):
                items.append({
                    "name": entry.name,
                    "is_dir": entry.is_dir(),
                    "size": entry.stat().st_size if entry.is_file() else None
                })
            return {"path": str(resolved), "items": items[:100]}
        except Exception as e:
            return {"error": str(e)}
    
    async def _handle_browser(self, args: Dict[str, Any]) -> Dict[str, Any]:
        """
        Playwright/browser automation placeholder.
        Requires playwright to be installed separately.
        """
        action = args.get('action', 'navigate')
        url = args.get('url', '')
        
        # Check if playwright is available
        try:
            # Note: Full playwright integration requires separate setup
            # This is a stub that can be extended
            return {
                "status": "browser_stub",
                "message": "Playwright MCP integration placeholder. Install playwright for full support.",
                "action": action,
                "url": url
            }
        except Exception as e:
            return {"error": str(e)}


tool_dispatcher = ToolDispatcher()

# ===== AI Provider Interface =====

async def call_ai_provider(config: dict, messages: list) -> str:
    """Call AI provider with unified interface"""
    provider = config['provider']
    api_key = config['api_key']
    endpoint = config['endpoint']
    model = config['model']

    try:
        async with httpx.AsyncClient(timeout=120.0) as http_client:
            
            if provider in ['openai', 'openai_compatible']:
                headers = {
                    'Authorization': f'Bearer {api_key}',
                    'Content-Type': 'application/json'
                }
                payload = {
                    'model': model,
                    'messages': messages,
                    'max_tokens': 4096
                }
                response = await http_client.post(endpoint, json=payload, headers=headers)
                response.raise_for_status()
                data = response.json()
                return data['choices'][0]['message']['content']

            elif provider == 'anthropic':
                headers = {
                    'x-api-key': api_key,
                    'anthropic-version': '2023-06-01',
                    'Content-Type': 'application/json'
                }
                system_msg = None
                chat_msgs = []
                for m in messages:
                    if m['role'] == 'system':
                        system_msg = m['content']
                    else:
                        chat_msgs.append({'role': m['role'], 'content': m['content']})
                payload = {
                    'model': model,
                    'messages': chat_msgs,
                    'max_tokens': 4096
                }
                if system_msg:
                    payload['system'] = system_msg
                response = await http_client.post(endpoint, json=payload, headers=headers)
                response.raise_for_status()
                data = response.json()
                return data['content'][0]['text']

            elif provider == 'google':
                url = f"{endpoint}/models/{model}:generateContent?key={api_key}"
                system_msg = None
                contents = []
                for m in messages:
                    if m['role'] == 'system':
                        system_msg = m['content']
                    else:
                        role = 'user' if m['role'] == 'user' else 'model'
                        contents.append({'role': role, 'parts': [{'text': m['content']}]})
                payload = {'contents': contents}
                if system_msg:
                    payload['systemInstruction'] = {'parts': [{'text': system_msg}]}
                response = await http_client.post(url, json=payload)
                response.raise_for_status()
                data = response.json()
                return data['candidates'][0]['content']['parts'][0]['text']

            elif provider == 'nvidia_nim':
                # Nvidia NIM provider - OpenAI-compatible API
                headers = {
                    'Authorization': f'Bearer {api_key}',
                    'Content-Type': 'application/json'
                }
                payload = {
                    'model': model,
                    'messages': messages,
                    'max_tokens': 4096,
                    'temperature': 0.7
                }
                response = await http_client.post(endpoint, json=payload, headers=headers)
                response.raise_for_status()
                data = response.json()
                return data['choices'][0]['message']['content']

            elif provider == 'generic':
                headers = {'Content-Type': 'application/json'}
                if api_key:
                    headers['Authorization'] = f'Bearer {api_key}'
                payload = {'messages': messages}
                if model:
                    payload['model'] = model
                response = await http_client.post(endpoint, json=payload, headers=headers)
                response.raise_for_status()
                try:
                    data = response.json()
                    if 'choices' in data:
                        return data['choices'][0]['message']['content']
                    elif 'content' in data:
                        if isinstance(data['content'], list):
                            return data['content'][0]['text']
                        return data['content']
                    else:
                        return json.dumps(data)
                except Exception:
                    return response.text
            else:
                raise Exception(f"Unknown provider: {provider}")

    except httpx.HTTPStatusError as e:
        raise Exception(f"AI API error ({e.response.status_code}): {e.response.text[:500]}")
    except Exception as e:
        if "AI API error" in str(e):
            raise
        raise Exception(f"AI provider error: {str(e)}")


# ===== API Routes =====

@api_router.get("/")
async def root():
    return {"message": "TermuxAI API", "version": "2.0.0", "storage": STORAGE_TYPE}


@api_router.get("/health")
async def health_check():
    return {
        "status": "ok",
        "storage": STORAGE_TYPE,
        "terminal_active": terminal._running,
        "pty_available": PTY_AVAILABLE,
        "version": "2.0.0",
    }


@api_router.get("/config")
async def get_config():
    config = await db.config.find_one({}, {"_id": 0})
    if not config:
        return JSONResponse(status_code=404, content={"detail": "No configuration found"})
    return {
        "id": config.get("id", ""),
        "provider": config.get("provider", ""),
        "endpoint": config.get("endpoint", ""),
        "model": config.get("model", ""),
        "agent_name": config.get("agent_name", "TermuxAI"),
        "system_prompt": config.get("system_prompt", ""),
        "theme": config.get("theme", "cyberpunk_void"),
        "auto_execute": config.get("auto_execute", False),
        "has_api_key": bool(config.get("api_key", "")),
        "nim_endpoint": config.get("nim_endpoint", "https://integrate.api.nvidia.com/v1/chat/completions"),
        "nim_model": config.get("nim_model", "meta/llama-3.1-70b-instruct"),
        "has_nim_key": bool(config.get("nim_api_key", "")),
        "created_at": config.get("created_at", ""),
        "updated_at": config.get("updated_at", ""),
    }


@api_router.post("/config")
async def save_config(config_data: AppConfigCreate):
    now = datetime.now(timezone.utc).isoformat()
    existing = await db.config.find_one({}, {"_id": 0})
    config_dict = config_data.dict()
    config_dict["updated_at"] = now

    # Preserve existing keys if not provided
    if existing:
        if config_dict.get("api_key") in ["", "UNCHANGED", None]:
            config_dict["api_key"] = existing.get("api_key", "")
        if config_dict.get("nim_api_key") in ["", "UNCHANGED", None]:
            config_dict["nim_api_key"] = existing.get("nim_api_key", "")

    if existing:
        config_dict["id"] = existing.get("id", str(uuid.uuid4()))
        config_dict["created_at"] = existing.get("created_at", now)
        await db.config.update_one({}, {"$set": config_dict})
    else:
        config_dict["id"] = str(uuid.uuid4())
        config_dict["created_at"] = now
        await db.config.insert_one(config_dict)

    return {
        "id": config_dict["id"],
        "provider": config_dict["provider"],
        "endpoint": config_dict["endpoint"],
        "model": config_dict["model"],
        "agent_name": config_dict["agent_name"],
        "system_prompt": config_dict["system_prompt"],
        "theme": config_dict["theme"],
        "auto_execute": config_dict["auto_execute"],
        "has_api_key": bool(config_dict["api_key"]),
        "nim_endpoint": config_dict.get("nim_endpoint", ""),
        "nim_model": config_dict.get("nim_model", ""),
        "has_nim_key": bool(config_dict.get("nim_api_key", "")),
        "created_at": config_dict["created_at"],
        "updated_at": config_dict["updated_at"],
    }


@api_router.post("/chat")
async def chat(message: ChatMessageCreate):
    """
    Main chat endpoint with:
    - Dynamic config override (api_key, model, endpoint in request body)
    - Grounding loop (executes bash blocks, feeds output back)
    - Tool dispatch (MCP JSON tool calls)
    """
    # Load saved config
    config = await db.config.find_one({}, {"_id": 0})
    if not config:
        config = {}
    
    # Apply dynamic overrides from request
    effective_config = {
        'provider': message.provider or config.get('provider', 'openai'),
        'api_key': message.api_key or config.get('api_key', ''),
        'endpoint': message.endpoint or config.get('endpoint', ''),
        'model': message.model or config.get('model', ''),
    }
    
    # Handle NIM provider specially
    if effective_config['provider'] == 'nvidia_nim':
        effective_config['api_key'] = message.api_key or config.get('nim_api_key', '')
        effective_config['endpoint'] = message.endpoint or config.get('nim_endpoint', 'https://integrate.api.nvidia.com/v1/chat/completions')
        effective_config['model'] = message.model or config.get('nim_model', 'meta/llama-3.1-70b-instruct')
    
    if not effective_config['api_key']:
        return JSONResponse(status_code=400, content={"detail": "AI not configured - missing API key"})

    # Save user message
    user_msg_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    user_msg = {"id": user_msg_id, "role": "user", "content": message.content, "timestamp": now}
    await db.chat_history.insert_one({**user_msg})

    # Build context
    terminal_history = terminal.get_history(3000) if terminal._running else "(Terminal not active)"
    agent_name = config.get("agent_name", "TermuxAI")
    custom_prompt = config.get("system_prompt", "")

    system_content = f"""You are {agent_name}, an AI coding assistant with full access to a Linux terminal running on Android via Termux.

{custom_prompt}

CURRENT TERMINAL OUTPUT (last activity):
```
{terminal_history}
```

CAPABILITIES:
1. Run bash commands - wrap in ```bash code blocks
2. Read/write files - use JSON tool calls
3. Execute multi-step tasks with grounding (you'll see command output)

When you want to run a command, put it in a bash code block:
```bash
command here
```

For tool calls, use JSON blocks:
```json
{{"tool": "read_file", "arguments": {{"path": "/path/to/file"}}}}
```

Available tools: bash, read_file, write_file, list_files

Be concise. Help with coding, debugging, installations, and system tasks."""

    # Fetch recent messages
    recent_msgs = await db.chat_history.find({}, {"_id": 0}).sort("timestamp", -1).limit(20).to_list(20)
    recent_msgs.reverse()

    messages = [{"role": "system", "content": system_content}]
    for msg in recent_msgs:
        messages.append({"role": msg["role"], "content": msg["content"]})

    # Call AI
    try:
        ai_response = await call_ai_provider(effective_config, messages)
    except Exception as e:
        return JSONResponse(status_code=500, content={"detail": str(e)})

    # === GROUNDING LOOP ===
    executed_commands = []
    grounding_results = []
    tool_results = []
    
    auto_execute = config.get("auto_execute", False)
    
    if auto_execute:
        # Execute bash blocks
        bash_commands = parse_code_blocks(ai_response)
        for cmd in bash_commands:
            result = await execute_bash_grounded(cmd, timeout=30)
            executed_commands.append(cmd)
            grounding_results.append(result.dict())
            # Also write to PTY terminal if running
            if terminal._running:
                terminal.write(cmd + '\n')
            await asyncio.sleep(0.2)
        
        # Execute MCP tool calls
        mcp_calls = parse_mcp_tool_calls(ai_response)
        for tool_call in mcp_calls:
            result = await tool_dispatcher.dispatch(tool_call)
            tool_results.append({"tool": tool_call.tool, "result": result})

    # Save assistant message
    assistant_msg_id = str(uuid.uuid4())
    assistant_msg = {
        "id": assistant_msg_id,
        "role": "assistant",
        "content": ai_response,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "executed_commands": executed_commands if executed_commands else None,
        "grounding_results": grounding_results if grounding_results else None,
        "tool_results": tool_results if tool_results else None,
    }
    await db.chat_history.insert_one({**assistant_msg})

    return {
        "id": assistant_msg_id,
        "role": "assistant",
        "content": ai_response,
        "timestamp": assistant_msg["timestamp"],
        "executed_commands": executed_commands if executed_commands else None,
        "grounding_results": grounding_results if grounding_results else None,
        "tool_results": tool_results if tool_results else None,
    }


@api_router.get("/chat/history")
async def get_chat_history():
    messages = await db.chat_history.find({}, {"_id": 0}).sort("timestamp", 1).to_list(200)
    return messages


@api_router.delete("/chat/history")
async def clear_chat_history():
    await db.chat_history.delete_many({})
    return {"message": "Chat history cleared"}


# === Grounding Endpoint (manual execution) ===

@api_router.post("/grounding/execute")
async def grounding_execute(req: TerminalExecuteRequest):
    """Execute a command and return grounded output (stdout/stderr)"""
    result = await execute_bash_grounded(req.command, req.timeout or 30)
    return result.dict()


# === Tool Dispatch Endpoint ===

@api_router.post("/tools/dispatch")
async def dispatch_tool(tool_call: MCPToolCall):
    """Dispatch an MCP-style tool call"""
    result = await tool_dispatcher.dispatch(tool_call)
    return result


@api_router.get("/tools/list")
async def list_tools():
    """List available tools"""
    return {
        "tools": [
            {"name": "bash", "description": "Execute bash command", "args": ["command", "timeout"]},
            {"name": "read_file", "description": "Read file contents", "args": ["path"]},
            {"name": "write_file", "description": "Write file contents", "args": ["path", "content"]},
            {"name": "list_files", "description": "List directory contents", "args": ["path"]},
            {"name": "browser", "description": "Browser automation (requires playwright)", "args": ["action", "url"]},
        ]
    }


# === Terminal Routes ===

@api_router.post("/terminal/execute")
async def execute_terminal_command(req: TerminalExecuteRequest):
    if not PTY_AVAILABLE:
        # Fallback to subprocess
        result = await execute_bash_grounded(req.command, req.timeout or 30)
        return {"message": "Command executed (subprocess)", "result": result.dict()}
    
    if not terminal._running:
        terminal.start()
        await terminal.start_reading()
        await asyncio.sleep(0.5)
    terminal.write(req.command + '\n')
    return {"message": "Command sent", "command": req.command}


@api_router.get("/terminal/history")
async def get_terminal_history():
    history = terminal.get_history(5000) if terminal._running else ""
    return {"history": history}


@api_router.post("/terminal/save-session")
async def save_terminal_session():
    await terminal.save_now()
    return {"message": "Session saved"}


# ===== File Browser API =====

BLOCKED_PATHS = ['/proc', '/sys', '/dev']

def safe_resolve(path: str) -> Path:
    resolved = Path(path).resolve()
    for b in BLOCKED_PATHS:
        if str(resolved).startswith(b):
            raise ValueError("Access denied to system directory")
    return resolved


@api_router.get("/files")
async def list_files(path: str = "/"):
    try:
        resolved = safe_resolve(path)
        if not resolved.exists():
            return JSONResponse(status_code=404, content={"detail": "Path not found"})
        if not resolved.is_dir():
            return JSONResponse(status_code=400, content={"detail": "Not a directory"})

        items = []
        try:
            entries = sorted(resolved.iterdir(), key=lambda e: (not e.is_dir(), e.name.lower()))
        except PermissionError:
            return JSONResponse(status_code=403, content={"detail": "Permission denied"})

        for entry in entries:
            if entry.name.startswith('.') and entry.name not in ['.env', '.gitignore', '.bashrc', '.profile']:
                continue
            try:
                stat = entry.stat()
                items.append({
                    "name": entry.name,
                    "path": str(entry),
                    "is_dir": entry.is_dir(),
                    "size": stat.st_size if entry.is_file() else None,
                    "modified": datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc).isoformat(),
                })
            except (PermissionError, OSError):
                continue

        parent = str(resolved.parent) if str(resolved) != "/" else None
        return {"path": str(resolved), "parent": parent, "items": items}
    except ValueError as e:
        return JSONResponse(status_code=403, content={"detail": str(e)})


@api_router.get("/files/read")
async def read_file(path: str):
    try:
        resolved = safe_resolve(path)
        if not resolved.exists():
            return JSONResponse(status_code=404, content={"detail": "File not found"})
        if not resolved.is_file():
            return JSONResponse(status_code=400, content={"detail": "Not a file"})
        if resolved.stat().st_size > 1024 * 512:
            return JSONResponse(status_code=400, content={"detail": "File too large (>512KB)"})

        try:
            content = resolved.read_text(encoding='utf-8', errors='replace')
        except Exception:
            content = resolved.read_text(encoding='latin-1')

        ext = resolved.suffix.lower()
        lang_map = {
            '.py': 'python', '.js': 'javascript', '.ts': 'typescript',
            '.tsx': 'tsx', '.jsx': 'jsx', '.json': 'json', '.md': 'markdown',
            '.html': 'html', '.css': 'css', '.sh': 'bash', '.yml': 'yaml',
            '.yaml': 'yaml', '.toml': 'toml', '.rs': 'rust', '.go': 'go',
            '.java': 'java', '.c': 'c', '.cpp': 'cpp', '.h': 'c',
            '.rb': 'ruby', '.php': 'php', '.sql': 'sql', '.xml': 'xml',
            '.env': 'bash', '.txt': 'text', '.log': 'text',
        }

        return {
            "path": str(resolved),
            "name": resolved.name,
            "content": content,
            "language": lang_map.get(ext, 'text'),
            "size": resolved.stat().st_size,
        }
    except ValueError as e:
        return JSONResponse(status_code=403, content={"detail": str(e)})


@api_router.post("/files/write")
async def write_file(req: FileWriteRequest):
    try:
        resolved = safe_resolve(req.path)
        resolved.parent.mkdir(parents=True, exist_ok=True)
        resolved.write_text(req.content, encoding='utf-8')
        return {"message": "File saved", "path": str(resolved)}
    except ValueError as e:
        return JSONResponse(status_code=403, content={"detail": str(e)})
    except Exception as e:
        return JSONResponse(status_code=500, content={"detail": str(e)})


@api_router.post("/files/mkdir")
async def create_directory(req: MkdirRequest):
    try:
        resolved = safe_resolve(req.path)
        resolved.mkdir(parents=True, exist_ok=True)
        return {"message": "Directory created", "path": str(resolved)}
    except ValueError as e:
        return JSONResponse(status_code=403, content={"detail": str(e)})


@api_router.delete("/files")
async def delete_file(path: str):
    try:
        resolved = safe_resolve(path)
        if not resolved.exists():
            return JSONResponse(status_code=404, content={"detail": "Not found"})
        if resolved.is_dir():
            import shutil
            shutil.rmtree(resolved)
        else:
            resolved.unlink()
        return {"message": "Deleted", "path": path}
    except ValueError as e:
        return JSONResponse(status_code=403, content={"detail": str(e)})
    except Exception as e:
        return JSONResponse(status_code=500, content={"detail": str(e)})


# ===== Terminal HTML (for web iframe) =====

@api_router.get("/terminal-html", response_class=HTMLResponse)
async def terminal_html(request: Request):
    config = await db.config.find_one({}, {"_id": 0})
    theme_name = config.get("theme", "cyberpunk_void") if config else "cyberpunk_void"

    terminal_themes = {
        "cyberpunk_void": {"background":"#050505","foreground":"#00FF9C","cursor":"#00FF9C","cursorAccent":"#050505","selectionBackground":"rgba(0,255,156,0.3)","black":"#050505","red":"#FF0055","green":"#00FF9C","yellow":"#FFD60A","blue":"#64D2FF","magenta":"#FF79C6","cyan":"#00FFFF","white":"#E0E0E0","brightBlack":"#808080","brightRed":"#FF4488","brightGreen":"#33FFAA","brightYellow":"#FFE033","brightBlue":"#88DDFF","brightMagenta":"#FF99DD","brightCyan":"#33FFFF","brightWhite":"#FFFFFF"},
        "monokai_pro": {"background":"#2D2A2E","foreground":"#FCFCFA","cursor":"#FFD866","cursorAccent":"#2D2A2E","selectionBackground":"rgba(255,216,102,0.3)","black":"#2D2A2E","red":"#FF6188","green":"#A9DC76","yellow":"#FFD866","blue":"#78DCE8","magenta":"#AB9DF2","cyan":"#78DCE8","white":"#FCFCFA","brightBlack":"#727072","brightRed":"#FF6188","brightGreen":"#A9DC76","brightYellow":"#FFD866","brightBlue":"#78DCE8","brightMagenta":"#AB9DF2","brightCyan":"#78DCE8","brightWhite":"#FFFFFF"},
        "dracula": {"background":"#282A36","foreground":"#F8F8F2","cursor":"#BD93F9","cursorAccent":"#282A36","selectionBackground":"rgba(189,147,249,0.3)","black":"#21222C","red":"#FF5555","green":"#50FA7B","yellow":"#F1FA8C","blue":"#BD93F9","magenta":"#FF79C6","cyan":"#8BE9FD","white":"#F8F8F2","brightBlack":"#6272A4","brightRed":"#FF6E6E","brightGreen":"#69FF94","brightYellow":"#FFFFA5","brightBlue":"#D6ACFF","brightMagenta":"#FF92DF","brightCyan":"#A4FFFF","brightWhite":"#FFFFFF"},
    }
    t = terminal_themes.get(theme_name, terminal_themes["cyberpunk_void"])
    bg = t["background"]
    theme_json = json.dumps(t)

    # Get WebSocket URL
    host = request.headers.get("host", "localhost:8000")
    ws_protocol = "wss" if request.headers.get("x-forwarded-proto") == "https" else "ws"

    html = f"""<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<title>Terminal</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/xterm@5.3.0/css/xterm.css">
<style>
*{{margin:0;padding:0;box-sizing:border-box}}
html,body{{height:100%;overflow:hidden;background:{bg}}}
#terminal{{height:100%;width:100%}}
.xterm{{height:100%;padding:4px}}
</style>
</head>
<body>
<div id="terminal"></div>
<script src="https://cdn.jsdelivr.net/npm/xterm@5.3.0/lib/xterm.js"></script>
<script src="https://cdn.jsdelivr.net/npm/xterm-addon-fit@0.8.0/lib/xterm-addon-fit.js"></script>
<script src="https://cdn.jsdelivr.net/npm/xterm-addon-web-links@0.9.0/lib/xterm-addon-web-links.js"></script>
<script>
const theme={theme_json};
const term=new Terminal({{
cursorBlink:true,
cursorStyle:'block',
fontSize:14,
fontFamily:"'Fira Code','SF Mono','Monaco','Inconsolata','Roboto Mono',monospace",
theme:theme,
scrollback:5000,
allowProposedApi:true
}});
const fitAddon=new FitAddon.FitAddon();
const webLinksAddon=new WebLinksAddon.WebLinksAddon();
term.loadAddon(fitAddon);
term.loadAddon(webLinksAddon);
term.open(document.getElementById('terminal'));
fitAddon.fit();

// WebSocket with exponential backoff reconnection
let ws=null;
let reconnectAttempts=0;
const maxReconnectAttempts=10;
const baseDelay=1000;
const maxDelay=30000;

function getReconnectDelay(){{
  const delay=Math.min(baseDelay*Math.pow(2,reconnectAttempts),maxDelay);
  return delay+Math.random()*1000;
}}

function connect(){{
  if(ws&&(ws.readyState===WebSocket.CONNECTING||ws.readyState===WebSocket.OPEN))return;
  
  const wsUrl='{ws_protocol}://'+window.location.host+'/api/ws/terminal';
  ws=new WebSocket(wsUrl);
  
  ws.onopen=()=>{{
    console.log('WebSocket connected');
    reconnectAttempts=0;
    term.write('\\r\\n\\x1b[32m[Connected]\\x1b[0m\\r\\n');
  }};
  
  ws.onmessage=(e)=>{{term.write(e.data)}};
  
  ws.onclose=(e)=>{{
    console.log('WebSocket closed:',e.code);
    if(reconnectAttempts<maxReconnectAttempts){{
      const delay=getReconnectDelay();
      term.write('\\r\\n\\x1b[33m[Reconnecting in '+Math.round(delay/1000)+'s...]\\x1b[0m\\r\\n');
      reconnectAttempts++;
      setTimeout(connect,delay);
    }}else{{
      term.write('\\r\\n\\x1b[31m[Connection failed. Refresh to retry.]\\x1b[0m\\r\\n');
    }}
  }};
  
  ws.onerror=(e)=>{{console.error('WebSocket error:',e)}};
}}

term.onData((data)=>{{
  if(ws&&ws.readyState===WebSocket.OPEN){{
    ws.send(JSON.stringify({{type:'input',data:data}}));
  }}
}});

window.addEventListener('resize',()=>{{
  fitAddon.fit();
  if(ws&&ws.readyState===WebSocket.OPEN){{
    ws.send(JSON.stringify({{type:'resize',rows:term.rows,cols:term.cols}}));
  }}
}});

connect();
</script>
</body>
</html>"""
    return HTMLResponse(content=html)


# ===== WebSocket Terminal =====

@app.websocket("/api/ws/terminal")
async def websocket_terminal(websocket: WebSocket):
    await websocket.accept()
    
    if PTY_AVAILABLE:
        if not terminal._running:
            terminal.start()
            await terminal.start_reading()
            await asyncio.sleep(0.3)

        terminal.clients.add(websocket)
        history = ''.join(terminal.history_buffer)
        if history:
            try:
                await websocket.send_text(history)
            except Exception:
                pass

    try:
        while True:
            data = await websocket.receive_text()
            try:
                msg = json.loads(data)
                if msg.get('type') == 'input':
                    if PTY_AVAILABLE:
                        terminal.write(msg['data'])
                    else:
                        # Non-PTY fallback: just echo
                        await websocket.send_text(msg['data'])
                elif msg.get('type') == 'resize':
                    if PTY_AVAILABLE:
                        terminal.resize(msg.get('rows', 30), msg.get('cols', 120))
            except json.JSONDecodeError:
                if PTY_AVAILABLE:
                    terminal.write(data)
    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
    finally:
        if PTY_AVAILABLE:
            terminal.clients.discard(websocket)


# ===== App Setup =====

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup():
    logger.info(f"TermuxAI backend starting... (storage: {STORAGE_TYPE}, PTY: {PTY_AVAILABLE})")
    if PTY_AVAILABLE:
        await terminal.restore_session()


@app.on_event("shutdown")
async def shutdown():
    if PTY_AVAILABLE:
        await terminal.save_now()
        terminal.stop()
    if client:
        client.close()
