import React, { useState, useEffect } from 'react';
import { Save, Check, Loader2, Cpu, Zap, Volume2, Play } from 'lucide-react';
import { useTheme, themes } from '../contexts/ThemeContext';
import { API_ENDPOINTS, BACKEND_URL } from '../config';
import { useToast } from '../hooks/use-toast';

export default function SettingsPage() {
  const { theme, themeName, setThemeName } = useTheme();
  const { toast } = useToast();
  
  // Config state
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  
  // Provider settings
  const [provider, setProvider] = useState('openai');
  const [apiKey, setApiKey] = useState('');
  const [endpoint, setEndpoint] = useState('');
  const [model, setModel] = useState('');
  
  // NIM settings
  const [nimApiKey, setNimApiKey] = useState('');
  const [nimEndpoint, setNimEndpoint] = useState('https://integrate.api.nvidia.com/v1/chat/completions');
  const [nimModel, setNimModel] = useState('meta/llama-3.1-70b-instruct');
  
  // Voice settings
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [voiceId, setVoiceId] = useState('en-US-AriaNeural');
  const [voiceRate, setVoiceRate] = useState('+0%');
  const [voicePitch, setVoicePitch] = useState('+0Hz');
  const [voiceAutoSpeak, setVoiceAutoSpeak] = useState(true);
  const [voices, setVoices] = useState([]);
  const [testingVoice, setTestingVoice] = useState(false);
  
  // Agent settings
  const [agentName, setAgentName] = useState('TermuxAI');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [autoExecute, setAutoExecute] = useState(false);
  
  // Active tab
  const [activeTab, setActiveTab] = useState('provider');

  const PROVIDERS = [
    { id: 'openai', label: 'OpenAI', endpoint: 'https://api.openai.com/v1/chat/completions', model: 'gpt-4o' },
    { id: 'anthropic', label: 'Anthropic', endpoint: 'https://api.anthropic.com/v1/messages', model: 'claude-sonnet-4-20250514' },
    { id: 'google', label: 'Google Gemini', endpoint: 'https://generativelanguage.googleapis.com/v1beta', model: 'gemini-2.0-flash' },
    { id: 'nvidia_nim', label: 'Nvidia NIM', endpoint: 'https://integrate.api.nvidia.com/v1/chat/completions', model: 'meta/llama-3.1-70b-instruct' },
    { id: 'openai_compatible', label: 'OpenAI Compatible', endpoint: '', model: '' },
    { id: 'generic', label: 'Generic HTTP', endpoint: '', model: '' },
  ];

  useEffect(() => {
    loadConfig();
    loadVoices();
  }, []);

  const loadConfig = async () => {
    try {
      const res = await fetch(API_ENDPOINTS.config);
      if (res.ok) {
        const data = await res.json();
        setConfig(data);
        setProvider(data.provider || 'openai');
        setEndpoint(data.endpoint || '');
        setModel(data.model || '');
        setAgentName(data.agent_name || 'TermuxAI');
        setSystemPrompt(data.system_prompt || '');
        setAutoExecute(data.auto_execute || false);
        setNimEndpoint(data.nim_endpoint || 'https://integrate.api.nvidia.com/v1/chat/completions');
        setNimModel(data.nim_model || 'meta/llama-3.1-70b-instruct');
        // Voice settings
        setVoiceEnabled(data.voice_enabled || false);
        setVoiceId(data.voice_id || 'en-US-AriaNeural');
        setVoiceRate(data.voice_rate || '+0%');
        setVoicePitch(data.voice_pitch || '+0Hz');
        setVoiceAutoSpeak(data.voice_auto_speak !== false);
      }
    } catch (e) {
      console.error('Failed to load config:', e);
    } finally {
      setLoading(false);
    }
  };

  const loadVoices = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/tts/voices`);
      if (res.ok) {
        const data = await res.json();
        setVoices(data.voices || []);
      }
    } catch (e) {
      console.error('Failed to load voices:', e);
    }
  };

  const testVoice = async () => {
    setTestingVoice(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/tts/speak`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: 'Hello! This is how I will sound when I speak to you.',
          voice: voiceId,
          rate: voiceRate,
          pitch: voicePitch,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const audio = new Audio(`data:audio/mpeg;base64,${data.audio}`);
        audio.onended = () => setTestingVoice(false);
        audio.onerror = () => setTestingVoice(false);
        await audio.play();
      } else {
        throw new Error('TTS request failed');
      }
    } catch (e) {
      toast({ title: 'Error', description: 'Failed to test voice', variant: 'destructive' });
      setTestingVoice(false);
    }
  };

  const selectProvider = (p) => {
    setProvider(p.id);
    if (p.endpoint) setEndpoint(p.endpoint);
    if (p.model) setModel(p.model);
    setDirty(true);
  };

  const saveConfig = async () => {
    setSaving(true);
    try {
      const body = {
        provider,
        api_key: apiKey || '',
        endpoint,
        model,
        agent_name: agentName || 'TermuxAI',
        system_prompt: systemPrompt,
        theme: themeName,
        auto_execute: autoExecute,
        nim_api_key: nimApiKey || '',
        nim_endpoint: nimEndpoint,
        nim_model: nimModel,
        // Voice settings
        voice_enabled: voiceEnabled,
        voice_id: voiceId,
        voice_rate: voiceRate,
        voice_pitch: voicePitch,
        voice_auto_speak: voiceAutoSpeak,
      };
      const res = await fetch(API_ENDPOINTS.config, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('Save failed');
      setDirty(false);
      setApiKey('');
      setNimApiKey('');
      toast({ title: 'Saved', description: 'Configuration updated successfully' });
    } catch (e) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleThemeChange = (name) => {
    setThemeName(name);
    setDirty(true);
  };

  const themeKeys = Object.keys(themes);

  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100%',
          background: theme.background,
        }}
      >
        <Loader2 size={32} style={{ animation: 'spin 1s linear infinite', color: theme.primary }} />
      </div>
    );
  }

  return (
    <div
      data-testid="settings-page"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: theme.background,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 16px',
          borderBottom: `1px solid ${theme.border}`,
        }}
      >
        <span style={{ fontSize: '16px', fontWeight: 700, letterSpacing: '0.5px' }}>Settings</span>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto', padding: '16px' }}>
        {/* Theme Section */}
        <div style={{ marginBottom: '24px' }}>
          <h3 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Theme
          </h3>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {themeKeys.map((key) => {
              const t = themes[key];
              const isSelected = themeName === key;
              return (
                <button
                  key={key}
                  data-testid={`theme-${key}`}
                  onClick={() => handleThemeChange(key)}
                  style={{
                    flex: '1 1 100px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '12px',
                    borderRadius: '10px',
                    border: `2px solid ${isSelected ? theme.primary : theme.border}`,
                    background: isSelected ? theme.primary + '22' : 'transparent',
                    cursor: 'pointer',
                  }}
                >
                  <div
                    style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      background: t.primary,
                      border: `2px solid ${t.background}`,
                    }}
                  />
                  <span style={{ fontSize: '11px', fontWeight: 600, color: theme.foreground }}>
                    {t.displayName}
                  </span>
                  {isSelected && <Check size={14} style={{ color: theme.primary }} />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '4px', marginBottom: '16px', borderBottom: `1px solid ${theme.border}`, paddingBottom: '8px', overflowX: 'auto' }}>
          {[
            { id: 'provider', label: 'AI Provider', icon: Zap },
            { id: 'nim', label: 'Nvidia NIM', icon: Cpu },
            { id: 'voice', label: 'Voice', icon: Volume2 },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              data-testid={`tab-${id}`}
              onClick={() => setActiveTab(id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 16px',
                borderRadius: '8px 8px 0 0',
                border: 'none',
                background: activeTab === id ? theme.secondary : 'transparent',
                color: activeTab === id ? theme.primary : theme.textDim,
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: 600,
                whiteSpace: 'nowrap',
              }}
            >
              <Icon size={16} />
              {label}
            </button>
          ))}
        </div>

        {/* Provider Tab */}
        {activeTab === 'provider' && (
          <div>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600, marginBottom: '6px', display: 'block', textTransform: 'uppercase', letterSpacing: '0.5px', color: theme.textDim }}>
                Provider
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {PROVIDERS.map((p) => (
                  <button
                    key={p.id}
                    data-testid={`provider-${p.id}`}
                    onClick={() => selectProvider(p)}
                    style={{
                      padding: '8px 14px',
                      borderRadius: '8px',
                      border: `1px solid ${provider === p.id ? theme.primary : theme.border}`,
                      background: provider === p.id ? theme.primary + '22' : 'transparent',
                      color: provider === p.id ? theme.primary : theme.textDim,
                      cursor: 'pointer',
                      fontSize: '13px',
                      fontWeight: 600,
                    }}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: '14px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600, marginBottom: '6px', display: 'block', textTransform: 'uppercase', letterSpacing: '0.5px', color: theme.textDim }}>
                API Key {config?.has_api_key && <span style={{ color: theme.success }}>(saved)</span>}
              </label>
              <input
                data-testid="api-key-input"
                type="password"
                value={apiKey}
                onChange={(e) => { setApiKey(e.target.value); setDirty(true); }}
                placeholder={config?.has_api_key ? '••••••••' : 'Enter API key'}
                style={{
                  width: '100%',
                  padding: '11px 14px',
                  borderRadius: '8px',
                  border: `1px solid ${theme.border}`,
                  background: theme.secondary,
                  color: theme.foreground,
                  fontSize: '14px',
                  fontFamily: 'monospace',
                }}
              />
            </div>

            <div style={{ marginBottom: '14px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600, marginBottom: '6px', display: 'block', textTransform: 'uppercase', letterSpacing: '0.5px', color: theme.textDim }}>
                Endpoint
              </label>
              <input
                data-testid="endpoint-input"
                type="text"
                value={endpoint}
                onChange={(e) => { setEndpoint(e.target.value); setDirty(true); }}
                placeholder="API endpoint URL"
                style={{
                  width: '100%',
                  padding: '11px 14px',
                  borderRadius: '8px',
                  border: `1px solid ${theme.border}`,
                  background: theme.secondary,
                  color: theme.foreground,
                  fontSize: '14px',
                  fontFamily: 'monospace',
                }}
              />
            </div>

            <div style={{ marginBottom: '14px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600, marginBottom: '6px', display: 'block', textTransform: 'uppercase', letterSpacing: '0.5px', color: theme.textDim }}>
                Model
              </label>
              <input
                data-testid="model-input"
                type="text"
                value={model}
                onChange={(e) => { setModel(e.target.value); setDirty(true); }}
                placeholder="Model name"
                style={{
                  width: '100%',
                  padding: '11px 14px',
                  borderRadius: '8px',
                  border: `1px solid ${theme.border}`,
                  background: theme.secondary,
                  color: theme.foreground,
                  fontSize: '14px',
                  fontFamily: 'monospace',
                }}
              />
            </div>
          </div>
        )}

        {/* NIM Tab */}
        {activeTab === 'nim' && (
          <div>
            <div style={{ padding: '12px', marginBottom: '16px', borderRadius: '8px', background: theme.primary + '11', border: `1px solid ${theme.primary}33` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <Cpu size={18} style={{ color: theme.primary }} />
                <span style={{ fontWeight: 700, color: theme.primary }}>Nvidia NIM</span>
              </div>
              <p style={{ fontSize: '13px', color: theme.textDim, lineHeight: '1.5' }}>
                Configure Nvidia NIM for high-performance inference. Select "Nvidia NIM" as your provider to use these settings.
              </p>
            </div>

            <div style={{ marginBottom: '14px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600, marginBottom: '6px', display: 'block', textTransform: 'uppercase', letterSpacing: '0.5px', color: theme.textDim }}>
                NIM API Key {config?.has_nim_key && <span style={{ color: theme.success }}>(saved)</span>}
              </label>
              <input
                data-testid="nim-api-key-input"
                type="password"
                value={nimApiKey}
                onChange={(e) => { setNimApiKey(e.target.value); setDirty(true); }}
                placeholder={config?.has_nim_key ? '••••••••' : 'nvapi-xxx'}
                style={{
                  width: '100%',
                  padding: '11px 14px',
                  borderRadius: '8px',
                  border: `1px solid ${theme.border}`,
                  background: theme.secondary,
                  color: theme.foreground,
                  fontSize: '14px',
                  fontFamily: 'monospace',
                }}
              />
            </div>

            <div style={{ marginBottom: '14px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600, marginBottom: '6px', display: 'block', textTransform: 'uppercase', letterSpacing: '0.5px', color: theme.textDim }}>
                NIM Endpoint
              </label>
              <input
                data-testid="nim-endpoint-input"
                type="text"
                value={nimEndpoint}
                onChange={(e) => { setNimEndpoint(e.target.value); setDirty(true); }}
                style={{
                  width: '100%',
                  padding: '11px 14px',
                  borderRadius: '8px',
                  border: `1px solid ${theme.border}`,
                  background: theme.secondary,
                  color: theme.foreground,
                  fontSize: '14px',
                  fontFamily: 'monospace',
                }}
              />
            </div>

            <div style={{ marginBottom: '14px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600, marginBottom: '6px', display: 'block', textTransform: 'uppercase', letterSpacing: '0.5px', color: theme.textDim }}>
                NIM Model
              </label>
              <input
                data-testid="nim-model-input"
                type="text"
                value={nimModel}
                onChange={(e) => { setNimModel(e.target.value); setDirty(true); }}
                style={{
                  width: '100%',
                  padding: '11px 14px',
                  borderRadius: '8px',
                  border: `1px solid ${theme.border}`,
                  background: theme.secondary,
                  color: theme.foreground,
                  fontSize: '14px',
                  fontFamily: 'monospace',
                }}
              />
            </div>

            <div style={{ marginBottom: '14px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600, marginBottom: '6px', display: 'block', textTransform: 'uppercase', letterSpacing: '0.5px', color: theme.textDim }}>
                Quick Select
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {[
                  'meta/llama-3.1-70b-instruct',
                  'meta/llama-3.1-8b-instruct',
                  'nvidia/llama-3.1-nemotron-70b-instruct',
                  'mistralai/mixtral-8x22b-instruct-v0.1',
                ].map((m) => (
                  <button
                    key={m}
                    onClick={() => { setNimModel(m); setDirty(true); }}
                    style={{
                      padding: '6px 10px',
                      borderRadius: '6px',
                      border: `1px solid ${nimModel === m ? theme.primary : theme.border}`,
                      background: nimModel === m ? theme.primary + '22' : 'transparent',
                      color: nimModel === m ? theme.primary : theme.textDim,
                      cursor: 'pointer',
                      fontSize: '11px',
                      fontFamily: 'monospace',
                    }}
                  >
                    {m.split('/')[1]}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Voice Tab */}
        {activeTab === 'voice' && (
          <div>
            <div style={{ padding: '12px', marginBottom: '16px', borderRadius: '8px', background: theme.primary + '11', border: `1px solid ${theme.primary}33` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <Volume2 size={18} style={{ color: theme.primary }} />
                <span style={{ fontWeight: 700, color: theme.primary }}>Voice Chat</span>
              </div>
              <p style={{ fontSize: '13px', color: theme.textDim, lineHeight: '1.5' }}>
                Enable voice input and output for hands-free conversations. Use the "Live Chat" button on the Agent tab for phone-call style interaction.
              </p>
            </div>

            {/* Enable Voice */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '14px',
                borderRadius: '10px',
                border: `1px solid ${theme.border}`,
                marginBottom: '14px',
              }}
            >
              <div>
                <div style={{ fontSize: '15px', fontWeight: 600 }}>Enable Voice Output</div>
                <div style={{ fontSize: '12px', color: theme.textDim, marginTop: '2px' }}>
                  AI will speak responses aloud
                </div>
              </div>
              <label style={{ position: 'relative', display: 'inline-block', width: '48px', height: '24px' }}>
                <input
                  data-testid="voice-enabled-toggle"
                  type="checkbox"
                  checked={voiceEnabled}
                  onChange={(e) => { setVoiceEnabled(e.target.checked); setDirty(true); }}
                  style={{ opacity: 0, width: 0, height: 0 }}
                />
                <span
                  style={{
                    position: 'absolute',
                    cursor: 'pointer',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: voiceEnabled ? theme.primary : theme.border,
                    borderRadius: '24px',
                    transition: 'background 0.2s',
                  }}
                >
                  <span
                    style={{
                      position: 'absolute',
                      content: '',
                      height: '18px',
                      width: '18px',
                      left: voiceEnabled ? '27px' : '3px',
                      bottom: '3px',
                      background: '#fff',
                      borderRadius: '50%',
                      transition: 'left 0.2s',
                    }}
                  />
                </span>
              </label>
            </div>

            {/* Auto-speak */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '14px',
                borderRadius: '10px',
                border: `1px solid ${theme.border}`,
                marginBottom: '14px',
              }}
            >
              <div>
                <div style={{ fontSize: '15px', fontWeight: 600 }}>Auto-Speak Responses</div>
                <div style={{ fontSize: '12px', color: theme.textDim, marginTop: '2px' }}>
                  Automatically speak AI responses
                </div>
              </div>
              <label style={{ position: 'relative', display: 'inline-block', width: '48px', height: '24px' }}>
                <input
                  type="checkbox"
                  checked={voiceAutoSpeak}
                  onChange={(e) => { setVoiceAutoSpeak(e.target.checked); setDirty(true); }}
                  style={{ opacity: 0, width: 0, height: 0 }}
                />
                <span
                  style={{
                    position: 'absolute',
                    cursor: 'pointer',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: voiceAutoSpeak ? theme.primary : theme.border,
                    borderRadius: '24px',
                    transition: 'background 0.2s',
                  }}
                >
                  <span
                    style={{
                      position: 'absolute',
                      content: '',
                      height: '18px',
                      width: '18px',
                      left: voiceAutoSpeak ? '27px' : '3px',
                      bottom: '3px',
                      background: '#fff',
                      borderRadius: '50%',
                      transition: 'left 0.2s',
                    }}
                  />
                </span>
              </label>
            </div>

            {/* Voice Selection */}
            <div style={{ marginBottom: '14px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600, marginBottom: '6px', display: 'block', textTransform: 'uppercase', letterSpacing: '0.5px', color: theme.textDim }}>
                AI Voice
              </label>
              <select
                data-testid="voice-select"
                value={voiceId}
                onChange={(e) => { setVoiceId(e.target.value); setDirty(true); }}
                style={{
                  width: '100%',
                  padding: '11px 14px',
                  borderRadius: '8px',
                  border: `1px solid ${theme.border}`,
                  background: theme.secondary,
                  color: theme.foreground,
                  fontSize: '14px',
                }}
              >
                {voices.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name} ({v.gender})
                  </option>
                ))}
              </select>
            </div>

            {/* Voice Rate */}
            <div style={{ marginBottom: '14px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600, marginBottom: '6px', display: 'block', textTransform: 'uppercase', letterSpacing: '0.5px', color: theme.textDim }}>
                Speech Rate
              </label>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {['-20%', '-10%', '+0%', '+10%', '+20%', '+30%'].map((rate) => (
                  <button
                    key={rate}
                    onClick={() => { setVoiceRate(rate); setDirty(true); }}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '6px',
                      border: `1px solid ${voiceRate === rate ? theme.primary : theme.border}`,
                      background: voiceRate === rate ? theme.primary + '22' : 'transparent',
                      color: voiceRate === rate ? theme.primary : theme.textDim,
                      cursor: 'pointer',
                      fontSize: '12px',
                    }}
                  >
                    {rate === '+0%' ? 'Normal' : rate}
                  </button>
                ))}
              </div>
            </div>

            {/* Test Voice */}
            <button
              data-testid="test-voice-btn"
              onClick={testVoice}
              disabled={testingVoice}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                width: '100%',
                padding: '12px',
                borderRadius: '8px',
                border: `1px solid ${theme.primary}`,
                background: 'transparent',
                color: theme.primary,
                cursor: testingVoice ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                fontWeight: 600,
                marginTop: '8px',
              }}
            >
              {testingVoice ? (
                <>
                  <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                  Playing...
                </>
              ) : (
                <>
                  <Play size={16} />
                  Test Voice
                </>
              )}
            </button>
          </div>
        )}

        {/* Agent Settings */}
        <div style={{ marginTop: '24px', borderTop: `1px solid ${theme.border}`, paddingTop: '16px' }}>
          <h3 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Agent
          </h3>

          <div style={{ marginBottom: '14px' }}>
            <label style={{ fontSize: '12px', fontWeight: 600, marginBottom: '6px', display: 'block', textTransform: 'uppercase', letterSpacing: '0.5px', color: theme.textDim }}>
              Agent Name
            </label>
            <input
              data-testid="agent-name-input"
              type="text"
              value={agentName}
              onChange={(e) => { setAgentName(e.target.value); setDirty(true); }}
              placeholder="TermuxAI"
              style={{
                width: '100%',
                padding: '11px 14px',
                borderRadius: '8px',
                border: `1px solid ${theme.border}`,
                background: theme.secondary,
                color: theme.foreground,
                fontSize: '14px',
              }}
            />
          </div>

          <div style={{ marginBottom: '14px' }}>
            <label style={{ fontSize: '12px', fontWeight: 600, marginBottom: '6px', display: 'block', textTransform: 'uppercase', letterSpacing: '0.5px', color: theme.textDim }}>
              System Prompt
            </label>
            <textarea
              data-testid="system-prompt-input"
              value={systemPrompt}
              onChange={(e) => { setSystemPrompt(e.target.value); setDirty(true); }}
              placeholder="Custom instructions for the AI agent..."
              rows={4}
              style={{
                width: '100%',
                padding: '11px 14px',
                borderRadius: '8px',
                border: `1px solid ${theme.border}`,
                background: theme.secondary,
                color: theme.foreground,
                fontSize: '14px',
                fontFamily: 'inherit',
                resize: 'vertical',
              }}
            />
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '14px',
              borderRadius: '10px',
              border: `1px solid ${theme.border}`,
              marginBottom: '14px',
            }}
          >
            <div>
              <div style={{ fontSize: '15px', fontWeight: 600 }}>Auto-Execute Commands</div>
              <div style={{ fontSize: '12px', color: theme.textDim, marginTop: '2px' }}>
                AI will run terminal commands automatically
              </div>
            </div>
            <label style={{ position: 'relative', display: 'inline-block', width: '48px', height: '24px' }}>
              <input
                data-testid="auto-execute-toggle"
                type="checkbox"
                checked={autoExecute}
                onChange={(e) => { setAutoExecute(e.target.checked); setDirty(true); }}
                style={{ opacity: 0, width: 0, height: 0 }}
              />
              <span
                style={{
                  position: 'absolute',
                  cursor: 'pointer',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  background: autoExecute ? theme.primary : theme.border,
                  borderRadius: '24px',
                  transition: 'background 0.2s',
                }}
              >
                <span
                  style={{
                    position: 'absolute',
                    content: '',
                    height: '18px',
                    width: '18px',
                    left: autoExecute ? '27px' : '3px',
                    bottom: '3px',
                    background: '#fff',
                    borderRadius: '50%',
                    transition: 'left 0.2s',
                  }}
                />
              </span>
            </label>
          </div>
        </div>

        {/* Save Button */}
        <button
          data-testid="save-settings-btn"
          onClick={saveConfig}
          disabled={saving}
          style={{
            width: '100%',
            padding: '14px',
            borderRadius: '10px',
            border: 'none',
            background: theme.primary,
            color: theme.background,
            fontSize: '16px',
            fontWeight: 700,
            letterSpacing: '0.5px',
            cursor: saving ? 'not-allowed' : 'pointer',
            opacity: saving ? 0.7 : 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            marginTop: '16px',
          }}
        >
          {saving ? <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={18} />}
          {saving ? 'Saving...' : 'Save Changes'}
        </button>

        <div style={{ height: '40px' }} />
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
