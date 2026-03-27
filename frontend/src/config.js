// Terminal-Ai Configuration

export const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://127.0.0.1:8000';

export const API_ENDPOINTS = {
  health: `${BACKEND_URL}/api/health`,
  config: `${BACKEND_URL}/api/config`,
  chat: `${BACKEND_URL}/api/chat`,
  chatHistory: `${BACKEND_URL}/api/chat/history`,
  terminalExecute: `${BACKEND_URL}/api/terminal/execute`,
  terminalHistory: `${BACKEND_URL}/api/terminal/history`,
  files: `${BACKEND_URL}/api/files`,
  filesRead: `${BACKEND_URL}/api/files/read`,
  filesWrite: `${BACKEND_URL}/api/files/write`,
  filesMkdir: `${BACKEND_URL}/api/files/mkdir`,
  groundingExecute: `${BACKEND_URL}/api/grounding/execute`,
  toolsDispatch: `${BACKEND_URL}/api/tools/dispatch`,
  toolsList: `${BACKEND_URL}/api/tools/list`,
  ttsVoices: `${BACKEND_URL}/api/tts/voices`,
  ttsSpeak: `${BACKEND_URL}/api/tts/speak`,
};

export const WS_URL = BACKEND_URL.replace('http', 'ws') + '/api/ws/terminal';

export const PROVIDERS = [
  { id: 'openai', label: 'OpenAI', endpoint: 'https://api.openai.com/v1/chat/completions', model: 'gpt-4o' },
  { id: 'anthropic', label: 'Anthropic', endpoint: 'https://api.anthropic.com/v1/messages', model: 'claude-sonnet-4-20250514' },
  { id: 'google', label: 'Google Gemini', endpoint: 'https://generativelanguage.googleapis.com/v1beta', model: 'gemini-2.0-flash' },
  { id: 'nvidia_nim', label: 'Nvidia NIM', endpoint: 'https://integrate.api.nvidia.com/v1/chat/completions', model: 'meta/llama-3.1-70b-instruct' },
  { id: 'openai_compatible', label: 'OpenAI Compatible', endpoint: '', model: '' },
  { id: 'generic', label: 'Generic HTTP', endpoint: '', model: '' },
];
